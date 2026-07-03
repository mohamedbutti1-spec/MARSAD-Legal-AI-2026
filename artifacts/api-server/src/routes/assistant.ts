/**
 * AI Assistant — chat sessions with persistent history and query-aware RAG
 *
 * GET    /assistant/sessions               — list user's sessions
 * POST   /assistant/sessions               — create new session
 * PATCH  /assistant/sessions/:id           — rename session
 * DELETE /assistant/sessions/:id           — delete session
 * GET    /assistant/sessions/:id/messages  — load messages
 * POST   /assistant/sessions/:id/messages  — send message, get AI reply
 *   Body: { content, documentIds?: number[], legalSourceIds?: number[] }
 * POST   /assistant/cite                   — on-demand citation formats for a source
 *   Body: { sourceType: "document"|"legal_source", sourceId: number }
 */
import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  db,
  chatSessionsTable,
  chatMessagesTable,
  documentsTable,
  legalSourcesTable,
} from "@workspace/db";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";

const router: IRouter = Router();

/** How many past messages to include as conversation context */
const SESSION_CONTEXT_MESSAGES = 12;
/** Characters per chunk when splitting large documents */
const CHUNK_CHARS = 1200;
/** Chunk overlap to preserve sentence context */
const CHUNK_OVERLAP = 150;
/** Number of most-relevant document chunks to include per source */
const CHUNKS_PER_SOURCE = 3;
/** Top-K sources to include in the final RAG context */
const TOP_K = 8;

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h, 10);
}

// ─── Keyword relevance scoring ─────────────────────────────────────────────────

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function relevanceScore(query: Set<string>, text: string): number {
  if (!text) return 0;
  const words = tokenise(text);
  let hits = 0;
  for (const q of query) if (words.has(q)) hits++;
  return hits;
}

/**
 * Split text into overlapping chunks and return the K most query-relevant ones.
 * By splitting first and scoring chunks individually we avoid biasing toward
 * the start of long documents.
 */
function topChunks(text: string, query: Set<string>, k = CHUNKS_PER_SOURCE): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
    chunks.push(text.slice(i, i + CHUNK_CHARS));
    if (chunks.length > 200) break; // guard against enormous docs
  }
  if (chunks.length <= k) return chunks;
  return chunks
    .map((c) => ({ c, score: relevanceScore(query, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}

// ─── Query-aware RAG context builder ──────────────────────────────────────────
/**
 * Two-phase approach:
 * 1. Load lightweight metadata rows (no full content) and score by keyword overlap.
 * 2. Fetch full content only for the top-K winners in a single IN query per table.
 *
 * Documents are scoped to the requesting user (uploadedById).
 * Legal sources are shared across all users.
 */
async function buildContext(
  query: string,
  userId: number,
  pinnedDocIds: number[] = [],
  pinnedSrcIds: number[] = [],
): Promise<{
  context: string;
  sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>;
}> {
  const queryTokens = tokenise(query);
  const sourceIndex = new Map<string, { title: string; type: "document" | "legal_source" }>();

  // Phase 1 — lightweight metadata fetch (no content column)
  const [metaDocs, metaSrcs] = await Promise.all([
    db
      .select({ id: documentsTable.id, name: documentsTable.originalName, keywords: documentsTable.keywords })
      .from(documentsTable)
      .where(eq(documentsTable.uploadedById, userId)),
    db
      .select({
        id: legalSourcesTable.id,
        title: legalSourcesTable.title,
        titleAr: legalSourcesTable.titleAr,
        jurisdiction: legalSourcesTable.jurisdiction,
        referenceNumber: legalSourcesTable.referenceNumber,
        year: legalSourcesTable.year,
        keywords: legalSourcesTable.subject, // subject field serves as lightweight keywords
        summaryAr: legalSourcesTable.summaryAr,
        summary: legalSourcesTable.summary,
      })
      .from(legalSourcesTable),
  ]);

  // Phase 1 scoring — pinned items get a guaranteed top score
  const scoredDocIds = metaDocs
    .map((d) => ({
      id: d.id,
      name: d.name,
      score: pinnedDocIds.includes(d.id)
        ? 9999
        : relevanceScore(queryTokens, `${d.name} ${d.keywords ?? ""}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((d) => ({ id: d.id, name: d.name }));

  const scoredSrcIds = metaSrcs
    .map((s) => ({
      id: s.id,
      title: s.titleAr ?? s.title,
      titleEn: s.title,
      jurisdiction: s.jurisdiction,
      referenceNumber: s.referenceNumber,
      year: s.year,
      summaryText: s.summaryAr ?? s.summary ?? "",
      score: pinnedSrcIds.includes(s.id)
        ? 9999
        : relevanceScore(queryTokens, `${s.title} ${s.titleAr ?? ""} ${s.summaryAr ?? s.summary ?? ""} ${s.keywords ?? ""}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  // Phase 2 — bulk fetch content only for the winners
  const [fullDocs, fullSrcs] = await Promise.all([
    scoredDocIds.length > 0
      ? db
          .select({ id: documentsTable.id, content: documentsTable.content })
          .from(documentsTable)
          .where(inArray(documentsTable.id, scoredDocIds.map((d) => d.id)))
      : Promise.resolve([]),
    scoredSrcIds.length > 0
      ? db
          .select({ id: legalSourcesTable.id, content: legalSourcesTable.content, summaryAr: legalSourcesTable.summaryAr, summary: legalSourcesTable.summary })
          .from(legalSourcesTable)
          .where(inArray(legalSourcesTable.id, scoredSrcIds.map((s) => s.id)))
      : Promise.resolve([]),
  ]);

  const docContentMap = new Map(fullDocs.map((d) => [d.id, d.content]));
  const srcContentMap = new Map(fullSrcs.map((s) => [s.id, s.summaryAr ?? s.summary ?? s.content]));

  const parts: string[] = [];

  for (const doc of scoredDocIds) {
    const content = docContentMap.get(doc.id) ?? "";
    const chunks = topChunks(content, queryTokens);
    const tag = `DOC:${doc.id}`;
    sourceIndex.set(tag, { title: doc.name, type: "document" });
    parts.push(
      `[${tag}] ${doc.name}\n` +
      (chunks.length > 0 ? chunks.join("\n…\n") : "(no text content available)"),
    );
  }

  for (const src of scoredSrcIds) {
    const text = srcContentMap.get(src.id) ?? src.summaryText;
    const chunks = topChunks(text, queryTokens, 2);
    const tag = `SRC:${src.id}`;
    sourceIndex.set(tag, { title: src.title, type: "legal_source" });
    parts.push(
      `[${tag}] ${src.title}` +
      (src.referenceNumber ? ` (${src.referenceNumber})` : "") +
      (src.year ? `, ${src.year}` : "") +
      ` — ${src.jurisdiction}\n` +
      (chunks.length > 0 ? chunks.join("\n…\n") : "(no content available)"),
    );
  }

  return {
    context: parts.join("\n\n" + "─".repeat(50) + "\n\n"),
    sourceIndex,
  };
}

// ─── Citation helpers ──────────────────────────────────────────────────────────

/**
 * Extract citation tokens from AI text.
 * Uses a capturing regex so we get exact `DOC` / `SRC` prefix and numeric ID.
 * Avoids the split()-on-brackets bug (e.g. "[DOC:12]".split(":") → ["[DOC", "12]"]).
 */
function extractCitationTokens(text: string): Array<{ token: string; prefix: string; sourceId: number }> {
  const pattern = /\[(DOC|SRC):(\d+)\]/g;
  const seen = new Set<string>();
  const results: Array<{ token: string; prefix: string; sourceId: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const token = match[0]; // e.g. "[DOC:12]"
    if (seen.has(token)) continue;
    seen.add(token);
    results.push({ token, prefix: match[1], sourceId: parseInt(match[2], 10) });
  }
  return results;
}

/** Build Harvard / APA / UAE Gov citation strings for an uploaded document. */
function makeDocCitations(doc: { originalName: string; uploadedAt: Date | string | null }): Record<string, string> {
  const title = doc.originalName.replace(/\.[^.]+$/, "");
  const year = doc.uploadedAt ? new Date(doc.uploadedAt).getFullYear() : new Date().getFullYear();
  const accessed = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return {
    harvard: `Unknown Author (${year}) '${title}'. [Document] (Accessed: ${accessed}).`,
    apa:     `Unknown Author. (${year}). ${title}. [Document].`,
    uaeGov:  `${title}، ${year}، الإمارات العربية المتحدة`,
  };
}

/** Build Harvard / APA / UAE Gov citation strings for a legal source record. */
function makeSrcCitations(src: {
  title: string; titleAr: string | null;
  referenceNumber: string | null; year: number | null; jurisdiction: string;
}): Record<string, string> {
  const titleAr = src.titleAr ?? src.title;
  const year = src.year ?? new Date().getFullYear();
  const ref = src.referenceNumber ? ` رقم ${src.referenceNumber}،` : "";
  return {
    harvard: `${titleAr} (${year}). ${src.jurisdiction}.`,
    apa:     `${titleAr}. (${year}). ${src.jurisdiction}.`,
    uaeGov:  `${titleAr}،${ref} سنة ${year}، ${src.jurisdiction}`,
  };
}

/**
 * Resolve a list of citation tokens to their titles and formatted citations.
 * Uses two batched IN queries (one per table) to avoid N+1 round-trips.
 */
async function resolveCitations(
  tokens: Array<{ token: string; prefix: string; sourceId: number }>,
  sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>,
): Promise<Array<{ token: string; title: string; type: "document" | "legal_source"; sourceId: number; formats: Record<string, string> }>> {
  const docTokens  = tokens.filter((t) => t.prefix === "DOC");
  const srcTokens  = tokens.filter((t) => t.prefix === "SRC");

  const [docRows, srcRows] = await Promise.all([
    docTokens.length > 0
      ? db.select({ id: documentsTable.id, originalName: documentsTable.originalName, uploadedAt: documentsTable.uploadedAt })
          .from(documentsTable)
          .where(inArray(documentsTable.id, docTokens.map((t) => t.sourceId)))
      : Promise.resolve([]),
    srcTokens.length > 0
      ? db.select({ id: legalSourcesTable.id, title: legalSourcesTable.title, titleAr: legalSourcesTable.titleAr, referenceNumber: legalSourcesTable.referenceNumber, year: legalSourcesTable.year, jurisdiction: legalSourcesTable.jurisdiction })
          .from(legalSourcesTable)
          .where(inArray(legalSourcesTable.id, srcTokens.map((t) => t.sourceId)))
      : Promise.resolve([]),
  ]);

  const docMap = new Map(docRows.map((d) => [d.id, d]));
  const srcMap = new Map(srcRows.map((s) => [s.id, s]));

  type CitRow = { token: string; title: string; type: "document" | "legal_source"; sourceId: number; formats: Record<string, string> };
  const results: CitRow[] = [];
  for (const { token, prefix, sourceId } of tokens) {
    if (prefix === "DOC") {
      const doc = docMap.get(sourceId);
      if (doc) results.push({ token, title: doc.originalName, type: "document", sourceId, formats: makeDocCitations(doc) });
    } else {
      const src = srcMap.get(sourceId);
      if (src) results.push({ token, title: src.titleAr ?? src.title, type: "legal_source", sourceId, formats: makeSrcCitations(src) });
    }
  }
  return results;
}

// ─── GET /assistant/sessions ───────────────────────────────────────────────────
router.get("/assistant/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const sessions = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.userId, uid))
    .orderBy(desc(chatSessionsTable.updatedAt))
    .limit(50);
  res.json({ sessions });
});

// ─── POST /assistant/sessions ──────────────────────────────────────────────────
router.post("/assistant/sessions", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const title = (req.body.title as string | undefined) ?? "محادثة جديدة";
  const [session] = await db.insert(chatSessionsTable).values({ userId: uid, title }).returning();
  res.status(201).json(session);
});

// ─── PATCH /assistant/sessions/:id ────────────────────────────────────────────
router.patch("/assistant/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const title = (req.body.title as string | undefined)?.trim();
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  const [session] = await db
    .update(chatSessionsTable)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)))
    .returning();
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(session);
});

// ─── DELETE /assistant/sessions/:id ───────────────────────────────────────────
router.delete("/assistant/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select({ id: chatSessionsTable.id })
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id));
  await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  res.json({ ok: true });
});

// ─── GET /assistant/sessions/:id/messages ─────────────────────────────────────
router.get("/assistant/sessions/:id/messages", requireAnyRole, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.createdAt);
  res.json({ session, messages });
});

// ─── POST /assistant/sessions/:id/messages ────────────────────────────────────
router.post("/assistant/sessions/:id/messages", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [ownerCheck] = await db
    .select({ id: chatSessionsTable.id })
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.userId, uid)));
  if (!ownerCheck) { res.status(404).json({ error: "Session not found" }); return; }

  const content = ((req.body.content as string) ?? "").trim();
  if (!content) { res.status(400).json({ error: "content required" }); return; }

  const pinnedDocIds: number[] = Array.isArray(req.body.documentIds)
    ? (req.body.documentIds as unknown[]).map(Number).filter((n) => !isNaN(n as number))
    : [];
  const pinnedSrcIds: number[] = Array.isArray(req.body.legalSourceIds)
    ? (req.body.legalSourceIds as unknown[]).map(Number).filter((n) => !isNaN(n as number))
    : [];

  // Save the user's message first
  await db.insert(chatMessagesTable).values({ sessionId, role: "user", content });

  // Load recent conversation history + build RAG context concurrently
  const [history, { context: ragContext, sourceIndex }] = await Promise.all([
    db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, sessionId))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(SESSION_CONTEXT_MESSAGES),
    buildContext(content, uid, pinnedDocIds, pinnedSrcIds),
  ]);

  const systemPrompt = `أنت مساعد قانوني متخصص ذكي مدمج في منصة مرصد للبحث القانوني.
تتخصص في القانون الإماراتي والفرنسي والأوروبي والقانون المقارن.

قواعد الاستشهاد:
- استشهد دائماً بالمصادر التي تستخدمها باستخدام الرموز المحددة: [DOC:رقم] للوثائق المرفوعة، [SRC:رقم] للمصادر القانونية.
- اذكر المواد القانونية والأحكام بدقة مع رقم المادة والقانون.
- إذا كان السؤال خارج نطاق المصادر المتاحة، وضّح ذلك صراحةً.

لغة الرد:
- أجب بالعربية إذا كان السؤال بالعربية.
- أجب بالإنجليزية إذا كان السؤال بالإنجليزية.
- يمكنك الجمع بين اللغتين عند الاقتضاء في التحليل القانوني المقارن.

${ragContext ? `المصادر المتاحة:\n${ragContext}` : "لا توجد وثائق في مكتبتك بعد. يمكنك رفع وثائق PDF أو DOCX أو TXT من صفحة إدارة الوثائق."}`;

  // Build conversation thread for multi-turn context (oldest first)
  const thread = [...history]
    .reverse()
    .map((m) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.content}`)
    .join("\n\n");
  const fullPrompt = thread ? `${thread}\n\nالمستخدم: ${content}` : content;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: fullPrompt,
      systemPrompt,
      maxTokens: 4000,
    });

    // Resolve citation tokens — two batched IN queries, not N+1 individual queries
    const rawTokens = extractCitationTokens(aiResult.text);
    const citations = await resolveCitations(rawTokens, sourceIndex);

    const [assistantMsg] = await db.insert(chatMessagesTable).values({
      sessionId,
      role: "assistant",
      content: aiResult.text,
      meta: {
        provider: aiResult.provider,
        model: aiResult.model,
        inputTokens: aiResult.usage?.inputTokens,
        outputTokens: aiResult.usage?.outputTokens,
        citations,
      },
    }).returning();

    // Auto-title session from first user message; always update updatedAt
    const [session] = await db
      .select({ title: chatSessionsTable.title })
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, sessionId));
    if (session) {
      const updates =
        !session.title || session.title === "محادثة جديدة"
          ? { title: content.slice(0, 70), updatedAt: new Date() }
          : { updatedAt: new Date() };
      await db.update(chatSessionsTable).set(updates).where(eq(chatSessionsTable.id, sessionId));
    }

    await logAudit(req, "ai.assistant-chat", { entityType: "chat_session", entityId: sessionId });
    res.json({
      message: assistantMsg,
      citations,
      _meta: {
        provider: aiResult.provider,
        model: aiResult.model,
        inputTokens: aiResult.usage?.inputTokens,
        outputTokens: aiResult.usage?.outputTokens,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Assistant chat failed");
    res.status(500).json({ error: "AI response failed. Please try again." });
  }
});

// ─── POST /assistant/cite ─────────────────────────────────────────────────────
// On-demand citation formatting for any source from the UI citation panel.
// Documents are fetched without ownership checks (all docs are currently shared
// across the platform — consistent with how /documents works).
router.post("/assistant/cite", requireAnyRole, async (req, res): Promise<void> => {
  const { sourceType, sourceId } = req.body as { sourceType?: string; sourceId?: number };
  if (!sourceType || !sourceId) {
    res.status(400).json({ error: "sourceType and sourceId required" }); return;
  }

  if (sourceType === "document") {
    const [doc] = await db
      .select({ originalName: documentsTable.originalName, uploadedAt: documentsTable.uploadedAt })
      .from(documentsTable)
      .where(eq(documentsTable.id, sourceId));
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    res.json({ title: doc.originalName, ...makeDocCitations(doc) });
  } else if (sourceType === "legal_source") {
    const [src] = await db
      .select({
        title: legalSourcesTable.title,
        titleAr: legalSourcesTable.titleAr,
        referenceNumber: legalSourcesTable.referenceNumber,
        year: legalSourcesTable.year,
        jurisdiction: legalSourcesTable.jurisdiction,
      })
      .from(legalSourcesTable)
      .where(eq(legalSourcesTable.id, sourceId));
    if (!src) { res.status(404).json({ error: "Legal source not found" }); return; }
    res.json({ title: src.titleAr ?? src.title, ...makeSrcCitations(src) });
  } else {
    res.status(400).json({ error: "sourceType must be 'document' or 'legal_source'" });
  }
});

export default router;
