/**
 * AI routes — all AI calls go through the AIRouter abstraction.
 * No direct imports of Anthropic, Perplexity, or any other provider SDK here.
 */
import { Router, type IRouter } from "express";
import { db, documentsTable } from "@workspace/db";
import {
  AiSearchBody,
  GenerateLiteratureReviewBody,
  UaeFranceCompareBody,
} from "@workspace/api-zod";
import { requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { cache, TTL } from "../lib/cache";
import { aiRouter, TaskType, parseModelJson } from "../ai";

const router: IRouter = Router();

// ─── RAG helpers (document-agnostic; used by multiple routes) ─────────────────

/**
 * Chunk a document's text into ~500-word segments with overlap for RAG.
 * Tags each chunk with [DOC:{id} CHUNK:{n}] so the model can cite sources.
 */
function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50,
): Array<{ chunkIndex: number; text: string; charStart: number }> {
  const words = text.split(/\s+/);
  const chunks: Array<{ chunkIndex: number; text: string; charStart: number }> = [];
  let i = 0;
  let chunkIndex = 0;
  let charCursor = 0;

  while (i < words.length) {
    const slice = words.slice(i, i + chunkSize);
    chunks.push({ chunkIndex, text: slice.join(" "), charStart: charCursor });
    charCursor += slice.reduce((s, w) => s + w.length + 1, 0);
    i += chunkSize - overlap;
    chunkIndex++;
  }
  return chunks;
}

/**
 * Build a RAG context string from a list of documents.
 * Includes [DOC:{id} CHUNK:{n}] tags so Claude can produce precise citations.
 */
function buildRagContext(
  docs: Array<{ id: number; originalName: string; content: string | null }>,
  maxCharsPerDoc = 4000,
): string {
  return docs
    .map((doc) => {
      if (!doc.content) return `[DOC:${doc.id}] ${doc.originalName}\n(No text content available)`;
      const chunks = chunkText(doc.content);
      const lines = chunks
        .slice(0, Math.ceil(maxCharsPerDoc / 500))
        .map((c) => `[DOC:${doc.id} CHUNK:${c.chunkIndex + 1}] ${c.text}`);
      return `Document: ${doc.originalName}\n${lines.join("\n\n")}`;
    })
    .join("\n\n" + "─".repeat(60) + "\n\n");
}

// ─── POST /ai/search ──────────────────────────────────────────────────────────

router.post("/ai/search", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = AiSearchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { query, documentIds, maxResults = 5 } = parsed.data;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.DOCUMENT_SEARCH);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  try {
    let docs = await db.select().from(documentsTable);
    if (documentIds && documentIds.length > 0) {
      docs = docs.filter((d) => documentIds.includes(d.id));
    }

    if (docs.length === 0) {
      res.json({ query, results: [], summary: "No documents found to search." }); return;
    }

    const ragContext = buildRagContext(docs, 3000);

    const prompt = `You are an expert legal research assistant. Using ONLY the documents below, answer the query and provide precise references.

QUERY: "${query}"

DOCUMENTS:
${ragContext}

Return a JSON object with exactly this structure:
{
  "results": [
    {
      "documentId": <number — from DOC: tag>,
      "filename": "<original document name>",
      "excerpt": "<exact quoted passage from the document, 50-150 words>",
      "section": "<describe the section, e.g. 'Article 3, Section 2' or 'Chunk N'>",
      "relevance": <0.0-1.0>
    }
  ],
  "summary": "<2-4 sentence synthesis of the answer with inline citations like (Doc: filename, Section X)>",
  "confidence": <0.0-1.0>
}

Return at most ${maxResults} results, ordered by relevance (highest first). If the documents do not contain relevant information, return empty results with an explanatory summary. Return ONLY valid JSON — no markdown, no commentary.`;

    const aiResult = await provider.complete({
      taskType: TaskType.DOCUMENT_SEARCH,
      prompt,
      maxTokens: 3000,
    });

    const parsed = parseModelJson<{
      results: Array<{ documentId: number; filename: string; excerpt: string; section: string; relevance: number }>;
      summary: string;
      confidence: number;
    }>(aiResult.text);

    const results = parsed.ok ? (parsed.data.results ?? []) : [];
    const summary = parsed.ok ? (parsed.data.summary ?? "") : aiResult.text.slice(0, 800);
    const confidence = parsed.ok ? (parsed.data.confidence ?? 0) : 0;

    logAudit(req, "ai.search", { details: { query: query.slice(0, 100), resultCount: results.length, provider: aiResult.provider } });
    req.log.info({ query, resultCount: results.length, provider: aiResult.provider, model: aiResult.model }, "AI semantic search completed");
    res.json({ query, results, summary, confidence, _meta: { provider: aiResult.provider, model: aiResult.model } });
  } catch (err) {
    req.log.error({ err }, "AI search failed");
    res.status(500).json({ error: "AI search failed. Please try again." });
  }
});

// ─── POST /ai/literature-review ───────────────────────────────────────────────

router.post("/ai/literature-review", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = GenerateLiteratureReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.LITERATURE_REVIEW);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  const { documentIds, topic, language = "Arabic" } = parsed.data;

  try {
    const docs = await db
      .select()
      .from(documentsTable)
      .then((all) => all.filter((d) => documentIds.includes(d.id)));

    if (docs.length === 0) {
      res.status(400).json({ error: "No valid documents found for the selected IDs." }); return;
    }

    const ragContext = buildRagContext(docs, 3000);

    const prompt = `You are an expert academic researcher specialising in comparative legal studies (UAE and French law). Generate a comprehensive, scholarly literature review in ${language} on: "${topic}"

Base your review EXCLUSIVELY on these source documents:
${ragContext}

Write a structured literature review with:
1. Introduction (مقدمة)
2. Main themes and findings (المحاور الرئيسية)
3. Critical analysis and synthesis (التحليل النقدي)
4. Research gaps (الفجوات البحثية)
5. Conclusion (خاتمة)

Include in-text citations referencing the actual document names. Be precise, academic, and thorough.

Return a JSON object:
{
  "review": "<full literature review text with sections>",
  "sources": [{"name": "<document name>", "relevance": "<how it contributed>"}],
  "wordCount": <approximate word count>,
  "language": "${language}"
}

Return ONLY valid JSON — no markdown fences.`;

    const aiResult = await provider.complete({
      taskType: TaskType.LITERATURE_REVIEW,
      prompt,
      maxTokens: 6000,
    });

    const parsedJson = parseModelJson<{
      review: string;
      sources: Array<{ name: string; relevance: string }>;
      wordCount: number;
    }>(aiResult.text);

    const review   = parsedJson.ok ? (parsedJson.data.review   ?? aiResult.text) : aiResult.text;
    const sources  = parsedJson.ok ? (parsedJson.data.sources  ?? docs.map((d) => ({ name: d.originalName, relevance: "Primary source" }))) : [];
    const wordCount = parsedJson.ok ? (parsedJson.data.wordCount ?? 0) : 0;

    logAudit(req, "ai.literature-review", { details: { topic: topic.slice(0, 100), docCount: docs.length, provider: aiResult.provider } });
    req.log.info({ topic, docCount: docs.length, provider: aiResult.provider, model: aiResult.model }, "Literature review generated");
    res.json({ topic, review, sources, wordCount, generatedAt: new Date().toISOString(), _meta: { provider: aiResult.provider, model: aiResult.model } });
  } catch (err) {
    req.log.error({ err }, "Literature review failed");
    res.status(500).json({ error: "Literature review generation failed. Please try again." });
  }
});

// ─── POST /ai/uae-france-compare ─────────────────────────────────────────────

router.post("/ai/uae-france-compare", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = UaeFranceCompareBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.DOCUMENT_COMPARE);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  const { topic, documentIds, aspects } = parsed.data;

  try {
    const cacheKey = `uae-france:${topic}:${(documentIds || []).sort().join(",")}:${(aspects || []).join(",")}`;
    const cached = cache.get<Record<string, unknown>>(cacheKey);
    if (cached) { res.json({ ...cached, cached: true }); return; }

    let docsContext = "";
    if (documentIds && documentIds.length > 0) {
      const docs = await db
        .select()
        .from(documentsTable)
        .then((all) => all.filter((d) => documentIds.includes(d.id)));
      if (docs.length > 0) docsContext = buildRagContext(docs, 2500);
    }

    const aspectsStr =
      aspects && aspects.length > 0
        ? `Focus specifically on these aspects: ${aspects.join(", ")}.`
        : "Cover all relevant legal aspects including definitions, scope, procedures, penalties, and rights.";

    const prompt = `You are a senior expert in comparative law specialising in UAE and French legal systems. Provide a comprehensive, citation-rich legal comparison on: "${topic}"

${docsContext ? `Reference documents (cite them by name):\n${docsContext}\n\n` : ""}
${aspectsStr}

Return a JSON object:
{
  "uaeAnalysis": "<detailed analysis of UAE law, with article/law references where available>",
  "franceAnalysis": "<detailed analysis of French law, with code article references where available>",
  "similarities": ["<specific similarity 1>", ...],
  "differences": ["<key difference 1>", ...],
  "practicalImplications": "<what this means for practitioners>",
  "conclusion": "<balanced concluding synthesis>",
  "references": ["<UAE law/article cited>", "<French code article cited>", ...]
}

Be precise and scholarly. Return ONLY valid JSON — no markdown fences.`;

    const aiResult = await provider.complete({
      taskType: TaskType.DOCUMENT_COMPARE,
      prompt,
      maxTokens: 5000,
    });

    const parsedJson = parseModelJson<Record<string, unknown>>(aiResult.text);
    const base: Record<string, unknown> = {
      uaeAnalysis: "", franceAnalysis: "", similarities: [],
      differences: [], practicalImplications: "", conclusion: "", references: [],
    };
    const result = parsedJson.ok ? { ...base, ...parsedJson.data } : { ...base, uaeAnalysis: aiResult.text };

    const response = { topic, ...result, generatedAt: new Date().toISOString(), _meta: { provider: aiResult.provider, model: aiResult.model } };

    cache.set(cacheKey, response, TTL.LONG);
    logAudit(req, "ai.uae-france-compare", { details: { topic: topic.slice(0, 100), provider: aiResult.provider } });
    req.log.info({ topic, provider: aiResult.provider, model: aiResult.model }, "UAE-France comparison generated");
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "UAE-France comparison failed");
    res.status(500).json({ error: "Comparison generation failed. Please try again." });
  }
});

export default router;
