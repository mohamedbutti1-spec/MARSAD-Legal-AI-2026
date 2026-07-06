/**
 * Phase 53 — UAE Legal Knowledge Base: Public API
 *
 * Re-exports the entire KB surface for consumers:
 *   - API routes (future KB search endpoint)
 *   - rag.ts integration via buildKbContext()
 *   - Admin scripts for batch ingestion
 */

// Collection registry
export {
  COLLECTIONS,
  getCollection,
  getAllCollections,
  getCollectionsByLevel,
  getCollectionsByJurisdiction,
  getCaseLawCollections,
  getLegislationCollections,
} from "./collections.js";

// Indexing pipeline
export {
  indexDocument,
  indexDocumentBatch,
  markCollectionOutdated,
  normaliseArabic,
  extractKeywordsAr,
  extractKeywordsEn,
  segmentArticles,
  extractCrossRefs,
  generateEmbedding,
} from "./pipeline.js";

// Retrieval engine
export {
  retrieveRelevant,
  buildKbContext,
  retrieveLegislation,
  retrieveCaseLaw,
  retrieveConstitutional,
  expandWithCrossRefs,
  resolveAmendmentChain,
} from "./retrieval.js";
export type {
  KbContextEntry,
  KbContextResult,
  CrossRefNeighbour,
  AmendingInstrument,
} from "./retrieval.js";

// Types
export type {
  KbCollectionId,
  KbHierarchyLevel,
  KbBindingStatus,
  KbDocType,
  KbReferenceType,
  KbIndexStatus,
  KbCollection,
  KbDocumentInput,
  KbArticleInput,
  KbCrossRefInput,
  AmendmentEntry,
  IndexResult,
  RetrievalOptions,
  RetrievalResult,
  RetrievalHit,
  EmbeddingRequest,
  EmbeddingResponse,
} from "./types.js";
