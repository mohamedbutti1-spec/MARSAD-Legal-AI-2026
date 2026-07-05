/**
 * Phase 53 — UAE Legal Knowledge Base: shared TypeScript types
 *
 * These types are the canonical interface between:
 *   - The indexing pipeline (pipeline.ts)
 *   - The retrieval engine (retrieval.ts)
 *   - Future API routes that expose KB search
 *   - The RAG context builder (rag.ts integration)
 *
 * Do NOT import DB-layer types here — keep this file pure TypeScript.
 */

// ─── Collection identifiers ───────────────────────────────────────────────────

export type KbCollectionId =
  | "uae_constitution"
  | "federal_laws"
  | "federal_decree_laws"
  | "executive_regulations"
  | "cabinet_decisions"
  | "ministerial_decisions"
  | "circulars"
  | "explanatory_memoranda"
  | "uae_supreme_court"
  | "federal_supreme_court"
  | "federal_admin_judiciary"
  | "abu_dhabi_courts"
  | "dubai_courts"
  | "rak_courts"
  | "constitutional_judgments"
  | "official_gazette"
  | "official_guidance"
  // Phase 55 — unified case law corpus
  | "uae_case_law";

export type KbHierarchyLevel = "1" | "2" | "3" | "4" | "5" | "6" | "7a" | "7b" | "7c" | "8";

export type KbBindingStatus =
  | "constitutional"
  | "binding"
  | "persuasive"
  | "advisory"
  | "informational";

export type KbDocType =
  | "constitution"
  | "law"
  | "decree_law"
  | "decree"
  | "regulation"
  | "cabinet_decision"
  | "ministerial_decision"
  | "circular"
  | "explanatory_memorandum"
  | "judgment"
  | "gazette_notice"
  | "guidance";

export type KbReferenceType =
  | "cites"
  | "amends"
  | "repeals"
  | "implements"
  | "supplements"
  | "related"
  | "interpreted_by"
  | "appealed_from";

export type KbIndexStatus = "pending" | "indexed" | "failed" | "outdated";

// ─── Collection descriptor ────────────────────────────────────────────────────

/** Static configuration for one of the 17 indexed collections. */
export interface KbCollection {
  id: KbCollectionId;
  nameEn: string;
  nameAr: string;
  hierarchyLevel: KbHierarchyLevel;
  bindingStatus: KbBindingStatus;
  defaultDocType: KbDocType;
  jurisdiction: string;           // "federal" | "abu_dhabi" | "dubai" | "rak" | "multi"
  authorityEn: string;
  authorityAr: string;
  description: string;
}

// ─── Pipeline input ───────────────────────────────────────────────────────────

/**
 * Input shape for indexing a new document into the KB.
 * Caller supplies all metadata; the pipeline validates, segments, and stores.
 */
export interface KbDocumentInput {
  collectionId: KbCollectionId;

  // Identity
  title: string;
  titleAr: string;
  authority: string;
  authorityAr: string;
  documentNumber?: string;
  year?: number;

  // Classification
  jurisdiction: string;
  docType: KbDocType;

  // Temporal
  effectiveDate?: string;   // ISO date "YYYY-MM-DD"
  expiryDate?: string;

  // Status
  isRepealed?: boolean;
  repealReference?: string;
  isAmended?: boolean;
  amendmentLog?: AmendmentEntry[];

  // Official publication
  officialGazetteRef?: string;
  officialGazetteDate?: string;

  // Content — at least one of fullTextAr / fullTextEn must be provided
  fullTextAr?: string;
  fullTextEn?: string;

  // Search keywords (optional — pipeline auto-extracts if omitted)
  keywordsAr?: string[];
  keywordsEn?: string[];

  // Phase 55 — case law cross-reference metadata (JSON-serialised arrays)
  // relatedJudgments: JSON array of { court, number, year, topic? }
  // relatedLegislation: JSON array of { title, documentNumber?, articles? }
  relatedJudgments?: string;
  relatedLegislation?: string;
}

export interface AmendmentEntry {
  amendedBy: string;     // Reference to the amending instrument
  article?: string;      // Specific article amended (if known)
  date?: string;         // ISO date
  description?: string;
}

// ─── Article input ────────────────────────────────────────────────────────────

export interface KbArticleInput {
  articleNumber?: string;
  articleNumberAr?: string;
  heading?: string;
  headingAr?: string;
  bodyEn?: string;
  bodyAr?: string;
  paragraphSequence: number;
  isRepealed?: boolean;
  effectiveDate?: string;
}

// ─── Cross-reference input ────────────────────────────────────────────────────

export interface KbCrossRefInput {
  sourceArticleId?: number;
  targetDocumentId?: number;
  targetArticleId?: number;
  targetExternalRef?: string;
  referenceType: KbReferenceType;
  description?: string;
}

// ─── Pipeline result ──────────────────────────────────────────────────────────

export interface IndexResult {
  success: boolean;
  documentId?: number;
  articlesIndexed: number;
  crossRefsExtracted: number;
  embeddingsGenerated: number;
  errors: string[];
  durationMs: number;
}

// ─── Retrieval types ──────────────────────────────────────────────────────────

export interface RetrievalOptions {
  /** Free-text query in Arabic or English */
  query: string;

  /** Restrict to specific collections (empty = all collections) */
  collections?: KbCollectionId[];

  /** Restrict to specific jurisdictions */
  jurisdictions?: string[];

  /** Restrict to specific hierarchy levels */
  hierarchyLevels?: KbHierarchyLevel[];

  /** Restrict to specific binding statuses */
  bindingStatuses?: KbBindingStatus[];

  /** Restrict to years in range */
  yearFrom?: number;
  yearTo?: number;

  /** Exclude repealed documents */
  excludeRepealed?: boolean;

  /** Maximum results to return (default: 8) */
  topK?: number;

  /** Whether to search at article level (more precise) or document level (broader) */
  granularity?: "document" | "article" | "both";

  /** If embeddings are available, use vector search; otherwise keyword-only */
  preferSemantic?: boolean;
}

export interface RetrievalHit {
  // Source identification
  documentId: number;
  articleId?: number;
  collectionId: KbCollectionId;

  // Metadata for citation rendering (matches Phase 52 8-field format)
  titleAr: string;
  titleEn: string;
  authorityAr: string;
  hierarchyLevel: KbHierarchyLevel;
  bindingStatus: KbBindingStatus;
  jurisdiction: string;
  documentNumber?: string;
  year?: number;
  isRepealed: boolean;
  isAmended: boolean;

  // Matched content snippet
  snippet: string;         // Arabic snippet (primary)
  snippetEn?: string;      // English snippet if available
  articleNumber?: string;

  // Scores
  keywordScore: number;
  semanticScore?: number;  // cosine similarity (0–1), null if no embeddings
  combinedScore: number;   // final ranking score

  // RAG citation tag — used by rag.ts to inject into prompt as [SRC:N]
  ragTag: string;
}

export interface RetrievalResult {
  hits: RetrievalHit[];
  totalCandidates: number;
  strategy: "semantic" | "keyword" | "hybrid";
  durationMs: number;
}

// ─── Embedding types ──────────────────────────────────────────────────────────

export interface EmbeddingRequest {
  text: string;
  language: "ar" | "en";
  modelId?: string;
}

export interface EmbeddingResponse {
  vector: number[];
  modelId: string;
  dimensions: number;
}
