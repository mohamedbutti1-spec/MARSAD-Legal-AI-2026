import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, documentsTable } from "@workspace/db";
import {
  AiSearchBody,
  GenerateLiteratureReviewBody,
  UaeFranceCompareBody,
} from "@workspace/api-zod";
import { requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { cache, TTL } from "../lib/cache";

const router: IRouter = Router();

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Chunk a document's text into ~500-word segments for RAG retrieval.
 * Returns an array of { chunkIndex, text, wordStart, wordEnd } objects.
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
    chunks.push({
      chunkIndex,
      text: slice.join(" "),
      charStart: charCursor,
    });
    charCursor += slice.reduce((s, w) => s + w.length + 1, 0);
    i += chunkSize - overlap;
    chunkIndex++;
  }
  return chunks;
}

/**
 * Build a RAG context string from documents, chunked for large texts.
 * Adds [DOC:{id} CHUNK:{n}] tags so the model can cite sources.
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
        .slice(0, Math.ceil(maxCharsPerDoc / 500)) // rough char budget
        .map((c) => `[DOC:${doc.id} CHUNK:${c.chunkIndex + 1}] ${c.text}`);
      return `Document: ${doc.originalName}\n${lines.join("\n\n")}`;
    })
    .join("\n\n" + "─".repeat(60) + "\n\n");
}

// POST /ai/search — RAG-enhanced semantic search
router.post("/ai/search", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = AiSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const client = getAnthropicClient();
  if (!client) {
    res.status(503).json({ error: "AI service not configured. Please set ANTHROPIC_API_KEY." });
    return;
  }

  const { query, documentIds, maxResults = 5 } = parsed.data;

  try {
    let docs = await db.select().from(documentsTable);
    if (documentIds && documentIds.length > 0) {
      docs = docs.filter((d) => documentIds.includes(d.id));
    }

    if (docs.length === 0) {
      res.json({ query, results: [], summary: "No documents found to search." });
      return;
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
      "section": "<describe the section, e.g. 'Article 3, Section 2' or 'Paragraph 5' or 'Chunk N'>",
      "relevance": <0.0-1.0>
    }
  ],
  "summary": "<2-4 sentence synthesis of the answer with inline citations like (Doc: filename, Section X)>",
  "confidence": <0.0-1.0>
}

Return at most ${maxResults} results, ordered by relevance (highest first). If the documents do not contain relevant information, return empty results with summary explaining that. Return ONLY valid JSON — no markdown, no commentary.`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown code fences if present
    const cleaned = responseText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let results: Array<{
      documentId: number;
      filename: string;
      excerpt: string;
      section: string;
      relevance: number;
    }> = [];
    let summary = "";
    let confidence = 0;

    try {
      const parsed = JSON.parse(cleaned);
      results = parsed.results || [];
      summary = parsed.summary || "";
      confidence = parsed.confidence || 0;
    } catch {
      summary = responseText.slice(0, 800);
    }

    logAudit(req, "ai.search", { details: { query: query.slice(0, 100), resultCount: results.length } });
    req.log.info({ query, resultCount: results.length }, "AI semantic search completed");
    res.json({ query, results, summary, confidence });
  } catch (err) {
    req.log.error({ err }, "AI search failed");
    res.status(500).json({ error: "AI search failed. Please try again." });
  }
});

// POST /ai/literature-review — RAG-enhanced literature review
router.post("/ai/literature-review", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = GenerateLiteratureReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const client = getAnthropicClient();
  if (!client) {
    res.status(503).json({ error: "AI service not configured. Please set ANTHROPIC_API_KEY." });
    return;
  }

  const { documentIds, topic, language = "Arabic" } = parsed.data;

  try {
    const docs = await db
      .select()
      .from(documentsTable)
      .then((all) => all.filter((d) => documentIds.includes(d.id)));

    if (docs.length === 0) {
      res.status(400).json({ error: "No valid documents found for the selected IDs." });
      return;
    }

    const ragContext = buildRagContext(docs, 3000);

    const prompt = `You are an expert academic researcher specializing in comparative legal studies (UAE and French law). Generate a comprehensive, scholarly literature review in ${language} on: "${topic}"

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

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = responseText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let review = "";
    let sources: Array<{ name: string; relevance: string }> = docs.map((d) => ({
      name: d.originalName,
      relevance: "Primary source",
    }));
    let wordCount = 0;

    try {
      const parsedJson = JSON.parse(cleaned);
      review = parsedJson.review || responseText;
      sources = parsedJson.sources || sources;
      wordCount = parsedJson.wordCount || 0;
    } catch {
      review = responseText;
    }

    logAudit(req, "ai.literature-review", { details: { topic: topic.slice(0, 100), docCount: docs.length } });
    req.log.info({ topic, docCount: docs.length }, "Literature review generated");
    res.json({ topic, review, sources, wordCount, generatedAt: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Literature review failed");
    res.status(500).json({ error: "Literature review generation failed. Please try again." });
  }
});

// POST /ai/uae-france-compare — RAG-enhanced comparative analysis
router.post("/ai/uae-france-compare", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = UaeFranceCompareBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const client = getAnthropicClient();
  if (!client) {
    res.status(503).json({ error: "AI service not configured. Please set ANTHROPIC_API_KEY." });
    return;
  }

  const { topic, documentIds, aspects } = parsed.data;

  try {
    const cacheKey = `uae-france:${topic}:${(documentIds || []).sort().join(",")}:${(aspects || []).join(",")}`;
    const cached = cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    let docsContext = "";
    if (documentIds && documentIds.length > 0) {
      const docs = await db
        .select()
        .from(documentsTable)
        .then((all) => all.filter((d) => documentIds.includes(d.id)));
      if (docs.length > 0) {
        docsContext = buildRagContext(docs, 2500);
      }
    }

    const aspectsStr =
      aspects && aspects.length > 0
        ? `Focus specifically on these aspects: ${aspects.join(", ")}.`
        : "Cover all relevant legal aspects including definitions, scope, procedures, penalties, and rights.";

    const prompt = `You are a senior expert in comparative law specializing in UAE and French legal systems. Provide a comprehensive, citation-rich legal comparison on: "${topic}"

${docsContext ? `Reference documents (cite them by name):\n${docsContext}\n\n` : ""}
${aspectsStr}

Return a JSON object:
{
  "uaeAnalysis": "<detailed analysis of UAE law, with article/law references where available>",
  "franceAnalysis": "<detailed analysis of French law, with code article references where available>",
  "similarities": ["<specific similarity 1>", "<specific similarity 2>", ...],
  "differences": ["<key difference 1>", "<key difference 2>", ...],
  "practicalImplications": "<what this means for practitioners>",
  "conclusion": "<balanced concluding synthesis>",
  "references": ["<UAE law/article cited>", "<French code article cited>", ...]
}

Be precise and scholarly. Return ONLY valid JSON — no markdown fences.`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 5000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = responseText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let result: Record<string, unknown> = {
      uaeAnalysis: "",
      franceAnalysis: "",
      similarities: [],
      differences: [],
      practicalImplications: "",
      conclusion: "",
      references: [],
    };

    try {
      const parsedJson = JSON.parse(cleaned);
      result = { ...result, ...parsedJson };
    } catch {
      result.uaeAnalysis = responseText;
    }

    const response = {
      topic,
      ...result,
      generatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, response, TTL.LONG);
    logAudit(req, "ai.uae-france-compare", { details: { topic: topic.slice(0, 100) } });
    req.log.info({ topic }, "UAE-France comparison generated");
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "UAE-France comparison failed");
    res.status(500).json({ error: "Comparison generation failed. Please try again." });
  }
});

export default router;
