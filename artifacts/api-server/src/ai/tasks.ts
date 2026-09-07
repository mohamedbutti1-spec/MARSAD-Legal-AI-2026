/**
 * AI Task taxonomy for the Legal Research Platform.
 *
 * The AIRouter uses these task types to select the right provider.
 * All application code must declare a task type — never reference a
 * concrete provider directly.
 */

export enum TaskType {
  // ─── Claude tasks ─────────────────────────────────────────────────────────
  /** Semantic search over private uploaded documents (RAG). */
  DOCUMENT_SEARCH = "document_search",
  /** Phase 42 — Constitutional Intelligence Layer assessment (12 principles, 6 scores). */
  CONSTITUTIONAL_ASSESSMENT = "constitutional_assessment",
  /** General retrieval-augmented generation pass. */
  RAG = "rag",
  /** Comparative thesis / literature review over uploaded documents. */
  LITERATURE_REVIEW = "literature_review",
  /** AI-enriched citation generation (Harvard, APA, etc.). */
  CITATION = "citation",
  /** Side-by-side comparison of two legal systems (e.g. UAE vs. France). */
  DOCUMENT_COMPARE = "document_compare",

  // ─── Perplexity tasks ─────────────────────────────────────────────────────
  /** Live web search — not restricted to the private library. */
  LIVE_WEB_SEARCH = "live_web_search",
  /** Fetch and summarise the latest published legislation. */
  LATEST_LEGISLATION = "latest_legislation",
  /** Retrieve and summarise recent court decisions. */
  COURT_DECISIONS = "court_decisions",
  /** Legal news and commentary from the open web. */
  LEGAL_NEWS = "legal_news",

  // ─── Multi-provider tasks ─────────────────────────────────────────────────
  /** Hybrid analysis: private library context (Claude) + live web (Perplexity). */
  MIXED = "mixed",
  /** Side-by-side second opinion from OpenAI + Claude for the same legal question. */
  DUAL_REVIEW = "dual_review",
}

/** Provider names that can be returned by the router. */
export type ProviderName = "claude" | "gemini" | "perplexity" | "openai";

/** Canonical routing table: each task type maps to one or more providers. */
export const TASK_ROUTING: Record<TaskType, ProviderName[]> = {
  // Claude — long-form / heavy analysis
  [TaskType.CONSTITUTIONAL_ASSESSMENT]: ["claude"],
  [TaskType.RAG]:                       ["claude"],
  [TaskType.LITERATURE_REVIEW]:         ["claude"],
  [TaskType.DOCUMENT_COMPARE]:          ["claude"],
  // Gemini — fast / instant tasks
  [TaskType.DOCUMENT_SEARCH]:           ["gemini"],
  [TaskType.CITATION]:                  ["gemini"],
  // Perplexity
  [TaskType.LIVE_WEB_SEARCH]:           ["perplexity"],
  [TaskType.LATEST_LEGISLATION]:        ["perplexity"],
  [TaskType.COURT_DECISIONS]:           ["perplexity"],
  [TaskType.LEGAL_NEWS]:                ["perplexity"],
  // Multi-provider
  [TaskType.MIXED]:                     ["claude", "perplexity"],
  [TaskType.DUAL_REVIEW]:               ["openai", "claude"],
};

/** Automatic cross-provider failover map for single-provider tasks. */
export const FALLBACK_PROVIDER: Record<ProviderName, ProviderName | null> = {
  claude: "gemini",
  gemini: "claude",
  perplexity: null,
  openai: "claude",
};

/** Human-readable descriptions for the UI. */
export const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  [TaskType.DOCUMENT_SEARCH]:           "Private document search (RAG)",
  [TaskType.CONSTITUTIONAL_ASSESSMENT]: "Constitutional Intelligence Layer (12-principle AI assessment)",
  [TaskType.RAG]:                       "Retrieval-Augmented Generation",
  [TaskType.LITERATURE_REVIEW]:         "Thesis / literature review",
  [TaskType.CITATION]:                  "Citation generation",
  [TaskType.DOCUMENT_COMPARE]:          "Document comparison",
  [TaskType.LIVE_WEB_SEARCH]:           "Live web search",
  [TaskType.LATEST_LEGISLATION]:        "Latest legislation",
  [TaskType.COURT_DECISIONS]:           "Recent court decisions",
  [TaskType.LEGAL_NEWS]:                "Legal news",
  [TaskType.MIXED]:                     "Hybrid: private library + live web",
  [TaskType.DUAL_REVIEW]:               "Dual legal review: OpenAI + Claude",
};
