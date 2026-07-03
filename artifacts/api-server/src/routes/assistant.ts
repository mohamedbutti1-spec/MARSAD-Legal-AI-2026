/**
 * AI Assistant — chat sessions with persistent history and RAG context
 *
 * GET    /assistant/sessions               — list user's sessions
 * POST   /assistant/sessions               — create new session
 * DELETE /assistant/sessions/:id           — delete session
 * GET    /assistant/sessions/:id/messages  — load messages
 * POST   /assistant/sessions/:id/messages  — send message, get AI reply
 */
import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, chatSessionsTable, chatMessagesTable, documentsTable, legalSourcesTable } from "@workspace/db";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";

const router: IRouter = Router();

const SESSION_CONTEXT_MESSAGES = 10;
const MAX_DOC_CHARS = 3000;

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h);
}

// ─── RAG context builder ───────────────────────────────────────────────────────
async function buildContext(): Promise<string> {
  const [docs, sources] = await Promise.all([
    db.select({ id: documentsTable.id, name: documentsTable.originalName, content: documentsTable.content }).from(documentsTable).limit(5),
    db.select({ id: legalSourcesTable.id, title: legalSourcesTable.title, content: legalSourcesTable.content, summary: legalSourcesTable.summaryAr }).from(legalSourcesTable).limit(5),
  ]);

  const parts: string[] = [];
  docs.forEach((d) => { if (d.content) parts.push(`[DOC:${d.id}] ${d.name}\n${d.content.slice(0, MAX_DOC_CHARS)}`); });
  sources.forEach((s) => { const t = s.summary ?? s.content; if (t) parts.push(`[SRC:${s.id}] ${s.title}\n${t.slice(0, MAX_DOC_CHARS)}`); });
  return parts.join("\n\n---\n\n");
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
router.get("/assistant/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const sessions = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.userId, uid)).orderBy(desc(chatSessionsTable.updatedAt)).limit(50);
  res.json({ sessions });
});

router.post("/assistant/sessions", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const title = (req.body.title as string | undefined) ?? "محادثة جديدة";
  const [session] = await db.insert(chatSessionsTable).values({ userId: uid, title }).returning();
  res.status(201).json(session);
});

router.delete("/assistant/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Confirm ownership BEFORE deleting messages (prevents cross-user message erasure)
  const [session] = await db.select({ id: chatSessionsTable.id }).from(chatSessionsTable).where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id));
  await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  res.json({ ok: true });
});

// ─── Messages ─────────────────────────────────────────────────────────────────
router.get("/assistant/sessions/:id/messages", requireAnyRole, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Verify session belongs to caller before returning messages
  const [session] = await db.select().from(chatSessionsTable).where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const messages = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id)).orderBy(chatMessagesTable.createdAt);
  res.json({ messages });
});

router.post("/assistant/sessions/:id/messages", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.id as string);
  const uid = getUserId(req);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Verify session ownership before accepting the message
  const [ownerCheck] = await db.select({ id: chatSessionsTable.id }).from(chatSessionsTable).where(and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.userId, uid)));
  if (!ownerCheck) { res.status(404).json({ error: "Session not found" }); return; }

  const content = ((req.body.content as string) ?? "").trim();
  if (!content) { res.status(400).json({ error: "content required" }); return; }

  // Save user message
  await db.insert(chatMessagesTable).values({ sessionId, role: "user", content });

  // Load history
  const history = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId)).orderBy(desc(chatMessagesTable.createdAt)).limit(SESSION_CONTEXT_MESSAGES);

  const ragContext = await buildContext();

  const systemPrompt = `أنت مساعد قانوني ذكي متخصص في القانون الإماراتي والفرنسي والأوروبي، ومُدمَج في منصة مرصد.
ردودك دقيقة ومستندة إلى المصادر المرفقة.
إذا ذكرت حكماً أو مادة قانونية، اذكر المصدر بشكل صريح مثل [DOC:3] أو [SRC:5].
أجب بالعربية ما لم يتحدث المستخدم بلغة أخرى.

المصادر المتاحة:
${ragContext || "(لا توجد وثائق محملة بعد)"}`;

  const conversationHistory = [...history].reverse().map((m) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.content}`).join("\n");
  const fullPrompt = conversationHistory ? `${conversationHistory}\n\nالمستخدم: ${content}` : content;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  try {
    const aiResult = await provider.complete({ taskType: TaskType.RAG, prompt: fullPrompt, systemPrompt });

    const [assistantMsg] = await db.insert(chatMessagesTable).values({
      sessionId,
      role: "assistant",
      content: aiResult.text,
      meta: { provider: aiResult.provider, model: aiResult.model },
    }).returning();

    // Update session title / updatedAt
    const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId));
    if (session) {
      const updates = session.title === "محادثة جديدة"
        ? { title: content.slice(0, 60), updatedAt: new Date() }
        : { updatedAt: new Date() };
      await db.update(chatSessionsTable).set(updates).where(eq(chatSessionsTable.id, sessionId));
    }

    await logAudit(req, "ai.assistant-chat", { entityType: "chat_session", entityId: sessionId });
    res.json({ message: assistantMsg, _meta: { provider: aiResult.provider, model: aiResult.model } });
  } catch (err) {
    req.log.error({ err }, "Assistant chat failed");
    res.status(500).json({ error: "AI response failed. Please try again." });
  }
});

export default router;
