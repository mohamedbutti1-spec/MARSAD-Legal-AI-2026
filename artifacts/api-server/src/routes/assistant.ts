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
import { eq, desc, and } from "drizzle-orm";
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
import {
  buildContext,
  extractCitationTokens,
  resolveCitations,
  makeDocCitations,
  makeSrcCitations,
} from "../utils/rag";

const router: IRouter = Router();

/** How many past messages to include as conversation context */
const SESSION_CONTEXT_MESSAGES = 12;

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h, 10);
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
    // Pass uid to scope DOC lookups to this user's documents only.
    const rawTokens = extractCitationTokens(aiResult.text);
    const citations = await resolveCitations(rawTokens, sourceIndex, uid);

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
