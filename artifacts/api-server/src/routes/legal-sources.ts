/**
 * Legal Sources routes
 * GET    /legal-sources              — list with filters (jurisdiction, docType, year, q)
 * GET    /legal-sources/:id          — single source
 * POST   /legal-sources              — create (supervisor/owner)
 * PATCH  /legal-sources/:id          — update (supervisor/owner)
 * DELETE /legal-sources/:id          — delete (owner only)
 * POST   /legal-sources/:id/summarise — AI summarise (supervisor+)
 */
import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, legalSourcesTable } from "@workspace/db";
import { requireAnyRole, requireOwner, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { cache, TTL } from "../lib/cache";
import { aiRouter, TaskType } from "../ai";

const router: IRouter = Router();

function userId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h);
}

// ─── List ──────────────────────────────────────────────────────────────────────
router.get("/legal-sources", requireAnyRole, async (req, res): Promise<void> => {
  const { jurisdiction, docType, year, q, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const cacheKey = `legal-sources:${jurisdiction}:${docType}:${year}:${q}:${limit}:${offset}`;
  const cached = cache.get<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }

  const conditions = [];
  if (jurisdiction) conditions.push(eq(legalSourcesTable.jurisdiction, jurisdiction));
  if (docType)      conditions.push(eq(legalSourcesTable.docType, docType));
  if (year)         conditions.push(eq(legalSourcesTable.year, parseInt(year)));
  if (q) {
    conditions.push(
      sql`(${legalSourcesTable.title} ilike ${'%' + q + '%'} OR COALESCE(${legalSourcesTable.titleAr},'') ilike ${'%' + q + '%'} OR COALESCE(${legalSourcesTable.subject},'') ilike ${'%' + q + '%'} OR COALESCE(${legalSourcesTable.subjectAr},'') ilike ${'%' + q + '%'})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [sources, [{ count }]] = await Promise.all([
    db.select().from(legalSourcesTable).where(where)
      .limit(parseInt(limit)).offset(parseInt(offset))
      .orderBy(sql`${legalSourcesTable.year} DESC NULLS LAST, ${legalSourcesTable.id} DESC`),
    db.select({ count: sql<number>`count(*)` }).from(legalSourcesTable).where(where),
  ]);

  const result = { sources, total: Number(count ?? 0) };
  cache.set(cacheKey, result, TTL.MED);
  res.json(result);
});

// ─── Single ────────────────────────────────────────────────────────────────────
router.get("/legal-sources/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [source] = await db.select().from(legalSourcesTable).where(eq(legalSourcesTable.id, id));
  if (!source) { res.status(404).json({ error: "Not found" }); return; }
  res.json(source);
});

// ─── Create ────────────────────────────────────────────────────────────────────
router.post("/legal-sources", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const { jurisdiction, docType, title, titleAr, referenceNumber, year, subject, subjectAr, content, language, courtLevel } = req.body;
  if (!jurisdiction || !docType || !title) {
    res.status(400).json({ error: "jurisdiction, docType, title are required" }); return;
  }
  const [created] = await db.insert(legalSourcesTable).values({
    jurisdiction, docType, title, titleAr, referenceNumber,
    year: year ? parseInt(year) : undefined,
    subject, subjectAr, content: content ?? "", language, courtLevel,
  }).returning();
  cache.delPattern("legal-sources:");
  await logAudit(req, "legal-source.create", { entityType: "legal_source", entityId: created.id });
  res.status(201).json(created);
});

// ─── Update ────────────────────────────────────────────────────────────────────
router.patch("/legal-sources/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { title, titleAr, referenceNumber, year, subject, subjectAr, content, summary, summaryAr, language, courtLevel } = req.body;
  const [updated] = await db.update(legalSourcesTable)
    .set({ title, titleAr, referenceNumber, year: year ? parseInt(year) : undefined, subject, subjectAr, content, summary, summaryAr, language, courtLevel })
    .where(eq(legalSourcesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  cache.delPattern("legal-sources:");
  res.json(updated);
});

// ─── Delete ────────────────────────────────────────────────────────────────────
router.delete("/legal-sources/:id", requireOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(legalSourcesTable).where(eq(legalSourcesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  cache.delPattern("legal-sources:");
  await logAudit(req, "legal-source.delete", { entityType: "legal_source", entityId: id });
  res.json({ ok: true });
});

// ─── AI Summarise ──────────────────────────────────────────────────────────────
router.post("/legal-sources/:id/summarise", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [source] = await db.select().from(legalSourcesTable).where(eq(legalSourcesTable.id, id));
  if (!source) { res.status(404).json({ error: "Not found" }); return; }

  const lang = (req.query.lang as string) ?? "ar";
  const cacheKey = `ls-summary:${id}:${lang}`;
  const cached = cache.get<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.DOCUMENT_SEARCH);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  const prompt = lang === "ar"
    ? `أنت مساعد قانوني متخصص. لخّص النص القانوني التالي في فقرتين بالعربية:\n\nالعنوان: ${source.title}\n\n${source.content.slice(0, 6000)}`
    : `You are a legal AI assistant. Summarise the following legal text in 2 paragraphs in English:\n\nTitle: ${source.title}\n\n${source.content.slice(0, 6000)}`;

  try {
    const aiResult = await provider.complete({ taskType: TaskType.DOCUMENT_SEARCH, prompt });
    const payload = { summary: aiResult.text, _meta: { provider: aiResult.provider, model: aiResult.model } };

    await db.update(legalSourcesTable)
      .set(lang === "ar" ? { summaryAr: aiResult.text } : { summary: aiResult.text })
      .where(eq(legalSourcesTable.id, id));
    cache.set(cacheKey, payload, TTL.LONG);
    await logAudit(req, "ai.legal-source-summarise", { entityType: "legal_source", entityId: id });
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Summarise failed");
    res.status(500).json({ error: "AI summarise failed" });
  }
});

// ─── AI Analyse (key-findings | relevance-uae) ────────────────────────────────
// Unlike /summarise, this endpoint does NOT persist results — it returns an
// ad-hoc analysis and caches it in-memory only for the session.
router.post("/legal-sources/:id/analyse", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const analysisType = (req.query.type as string) ?? "key-findings";
  if (!["key-findings", "relevance-uae"].includes(analysisType)) {
    res.status(400).json({ error: "type must be key-findings or relevance-uae" }); return;
  }

  const [source] = await db.select().from(legalSourcesTable).where(eq(legalSourcesTable.id, id));
  if (!source) { res.status(404).json({ error: "Not found" }); return; }

  const cacheKey = `ls-analysis:${id}:${analysisType}`;
  const cached = cache.get<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.DOCUMENT_SEARCH);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  const prompt = analysisType === "key-findings"
    ? `أنت خبير قانوني متخصص في تحليل الأحكام القضائية. بناءً على نص الحكم التالي، حدّد:
1. المبدأ القانوني الأساسي (Ratio Decidendi)
2. الوقائع الجوهرية
3. الحكم والتعليل القانوني

الحكم: ${source.title}
${source.content.slice(0, 5000)}

قدّم التحليل في 3-4 فقرات بالعربية، مع تمييز واضح بين كل عنصر.`
    : `You are a legal expert specialising in comparative law between the European Union and the UAE (United Arab Emirates). Analyse the following EU legal instrument and assess:
1. Its direct relevance to UAE commercial, regulatory, or judicial practice
2. Whether there is a UAE equivalent law or regulation
3. Key differences and similarities
4. Practical implications for entities operating in both jurisdictions

Source: ${source.title}
${source.content.slice(0, 5000)}

Provide a concise 3-paragraph analysis in English with an Arabic summary at the end.`;

  try {
    const aiResult = await provider.complete({ taskType: TaskType.DOCUMENT_SEARCH, prompt });
    const payload = { analysis: aiResult.text, analysisType, _meta: { provider: aiResult.provider, model: aiResult.model } };
    cache.set(cacheKey, payload, TTL.MED);
    await logAudit(req, `ai.legal-source-${analysisType}`, { entityType: "legal_source", entityId: id });
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Analyse failed");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

export default router;
