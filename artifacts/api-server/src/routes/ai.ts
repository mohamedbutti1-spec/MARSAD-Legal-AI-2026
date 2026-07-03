import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, documentsTable } from "@workspace/db";
import {
  AiSearchBody,
  GenerateLiteratureReviewBody,
  UaeFranceCompareBody,
} from "@workspace/api-zod";
import { requireSupervisorOrOwner } from "../middlewares/roleAuth";

const router: IRouter = Router();

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// POST /ai/search
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

  // Fetch documents
  let docs = await db.select().from(documentsTable);
  if (documentIds && documentIds.length > 0) {
    docs = docs.filter((d) => documentIds.includes(d.id));
  }

  if (docs.length === 0) {
    res.json({
      query,
      results: [],
      summary: "No documents found to search.",
    });
    return;
  }

  const docsContext = docs
    .map((d) => `[Doc ID: ${d.id}] ${d.originalName}\n${d.content?.slice(0, 1000) || "(content not extracted)"}`)
    .join("\n\n---\n\n");

  const prompt = `You are a legal research assistant. Search through the following documents for information related to: "${query}"

Documents:
${docsContext}

Return a JSON object with:
- results: array of up to ${maxResults} objects with { documentId, filename, excerpt, relevance } where relevance is 0-1
- summary: a brief 2-3 sentence summary of findings

Only return valid JSON, no markdown.`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  let results: Array<{ documentId: number; filename: string; excerpt: string; relevance: number }> = [];
  let summary = "";

  try {
    const parsed = JSON.parse(responseText);
    results = parsed.results || [];
    summary = parsed.summary || "";
  } catch {
    summary = responseText.slice(0, 500);
  }

  req.log.info({ query, resultCount: results.length }, "AI search completed");
  res.json({ query, results, summary });
});

// POST /ai/literature-review
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

  const docs = await db
    .select()
    .from(documentsTable)
    .then((all) => all.filter((d) => documentIds.includes(d.id)));

  const docsContext = docs
    .map((d) => `Source: ${d.originalName}\n${d.content?.slice(0, 1500) || "(content not extracted)"}`)
    .join("\n\n---\n\n");

  const prompt = `You are an expert academic researcher specializing in legal studies. Generate a comprehensive literature review in ${language} on the topic: "${topic}"

Based on these sources:
${docsContext}

Write a structured literature review with:
1. Introduction
2. Main themes and findings
3. Critical analysis
4. Conclusion

Also provide a JSON response with:
- review: the full literature review text
- sources: array of source document names used

Return JSON only, no markdown.`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  let review = "";
  let sources: string[] = docs.map((d) => d.originalName);

  try {
    const parsed = JSON.parse(responseText);
    review = parsed.review || responseText;
    sources = parsed.sources || sources;
  } catch {
    review = responseText;
  }

  req.log.info({ topic, docCount: docs.length }, "Literature review generated");
  res.json({
    topic,
    review,
    sources,
    generatedAt: new Date().toISOString(),
  });
});

// POST /ai/uae-france-compare
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

  let docsContext = "";
  if (documentIds && documentIds.length > 0) {
    const docs = await db
      .select()
      .from(documentsTable)
      .then((all) => all.filter((d) => documentIds.includes(d.id)));
    docsContext = docs
      .map((d) => `${d.originalName}:\n${d.content?.slice(0, 1000) || "(content not extracted)"}`)
      .join("\n\n---\n\n");
  }

  const aspectsStr = aspects && aspects.length > 0
    ? `Focus on these specific aspects: ${aspects.join(", ")}.`
    : "";

  const prompt = `You are an expert in comparative law specializing in UAE and French legal systems. Compare the legal frameworks of UAE and France on the topic: "${topic}"

${docsContext ? `Reference documents:\n${docsContext}\n\n` : ""}
${aspectsStr}

Provide a comprehensive legal comparison in JSON format with:
- uaeAnalysis: detailed analysis of UAE law on this topic (in Arabic or English)
- franceAnalysis: detailed analysis of French law on this topic
- similarities: array of 3-5 key similarities
- differences: array of 3-5 key differences
- conclusion: brief concluding comparison

Return valid JSON only, no markdown.`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  let uaeAnalysis = "";
  let franceAnalysis = "";
  let similarities: string[] = [];
  let differences: string[] = [];
  let conclusion = "";

  try {
    const parsed = JSON.parse(responseText);
    uaeAnalysis = parsed.uaeAnalysis || "";
    franceAnalysis = parsed.franceAnalysis || "";
    similarities = parsed.similarities || [];
    differences = parsed.differences || [];
    conclusion = parsed.conclusion || "";
  } catch {
    uaeAnalysis = responseText;
    conclusion = "Comparison generated";
  }

  req.log.info({ topic }, "UAE-France comparison generated");
  res.json({
    topic,
    uaeAnalysis,
    franceAnalysis,
    similarities,
    differences,
    conclusion,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
