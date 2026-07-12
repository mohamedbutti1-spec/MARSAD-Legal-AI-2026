/**
 * Unified Legal Research route — semantic search across documents AND legal sources
 * POST /research/search
 */
import { Router, type IRouter } from "express";
import { db, documentsTable, legalSourcesTable } from "@workspace/db";
import { requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType, parseModelJson } from "../ai";
import { aiAnalysisLimit } from "../middlewares/rateLimits.js";

const router: IRouter = Router();

const CHUNK_SIZE = 500;
const OVERLAP = 50;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(" "));
  }
  return chunks;
}

router.post("/research/search", requireSupervisorOrOwner, aiAnalysisLimit, async (req, res): Promise<void> => {
  const { query, sourceTypes = ["documents", "legal_sources"], jurisdiction, yearFrom, yearTo, limit = 5 } = req.body as {
    query: string;
    sourceTypes?: string[];
    jurisdiction?: string;
    yearFrom?: number;
    yearTo?: number;
    limit?: number;
  };

  if (!query?.trim()) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  const corpusParts: string[] = [];
  const sourceIndex: Array<{ ref: string; title: string; type: "document" | "legal_source"; id: number }> = [];

  if (sourceTypes.includes("documents")) {
    const docs = await db.select({ id: documentsTable.id, name: documentsTable.originalName, content: documentsTable.content }).from(documentsTable).limit(10);
    docs.forEach((d) => {
      if (!d.content) return;
      const chunks = chunkText(d.content).slice(0, 6);
      chunks.forEach((chunk, i) => {
        const ref = `DOC-${d.id}-${i}`;
        corpusParts.push(`[${ref}] ${d.name}\n${chunk}`);
        if (i === 0) sourceIndex.push({ ref: `DOC-${d.id}`, title: d.name, type: "document", id: d.id });
      });
    });
  }

  if (sourceTypes.includes("legal_sources")) {
    const srcs = await db.select().from(legalSourcesTable).limit(40);
    const filtered = srcs.filter((s) => {
      if (jurisdiction && s.jurisdiction !== jurisdiction) return false;
      if (yearFrom && s.year && s.year < yearFrom) return false;
      if (yearTo   && s.year && s.year > yearTo)   return false;
      return true;
    });
    filtered.forEach((s) => {
      const text = s.summaryAr ?? s.summary ?? s.content;
      if (!text) return;
      const ref = `SRC-${s.id}`;
      corpusParts.push(`[${ref}] ${s.title}\n${text.slice(0, 800)}`);
      sourceIndex.push({ ref, title: s.title, type: "legal_source", id: s.id });
    });
  }

  if (corpusParts.length === 0) {
    res.json({ results: [], summary: "لا توجد وثائق أو مصادر قانونية في المكتبة بعد.", query, _meta: null });
    return;
  }

  const systemPrompt = `أنت محرك بحث قانوني متخصص. بناءً على الوثائق والمصادر التالية، أجب على استفسار المستخدم.
يجب أن يكون ردك JSON بالهيكل التالي:
{
  "summary": "ملخص الإجابة بالعربية",
  "results": [
    { "ref": "DOC-1-0", "relevanceScore": 0.95, "excerpt": "مقطع ذو صلة", "reason": "لماذا هذا المصدر مفيد" }
  ]
}
ضمّن من 1 إلى ${limit} نتيجة مرتبة حسب الصلة.

المصادر:
${corpusParts.join("\n\n---\n\n")}`;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.DOCUMENT_SEARCH);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  try {
    const aiResult = await provider.complete({ taskType: TaskType.DOCUMENT_SEARCH, prompt: query, systemPrompt });
    const parsed = parseModelJson<{
      summary: string;
      results: Array<{ ref: string; relevanceScore: number; excerpt: string; reason: string }>;
    }>(aiResult.text);

    const rawResults = parsed.ok ? (parsed.data.results ?? []) : [];
    const summary = parsed.ok ? (parsed.data.summary ?? aiResult.text) : aiResult.text;

    const enriched = rawResults.map((r) => {
      const baseRef = r.ref.replace(/-\d+$/, "");
      const meta = sourceIndex.find((s) => s.ref === baseRef || s.ref === r.ref);
      return { ...r, meta: meta ?? null };
    });

    await logAudit(req, "ai.research-search", { details: { query } });
    res.json({ query, summary, results: enriched, _meta: { provider: aiResult.provider, model: aiResult.model } });
  } catch (err) {
    req.log.error({ err }, "Research search failed");
    res.status(500).json({ error: "Research search failed. Please try again." });
  }
});

export default router;
