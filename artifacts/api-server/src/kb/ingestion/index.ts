/**
 * Phase 54 — UAE Legal Knowledge Base: Ingestion Barrel
 * Re-exports all ingestion utilities for external use.
 */

export { runIngestion }                  from "./runner.js";
export { generateIngestionReport, printReport } from "./report.js";
export type { CollectionStats, IngestionReport } from "./report.js";
export type { RunIngestionOptions }      from "./runner.js";

// Seed exports (for programmatic access or incremental ingestion)
export { UAE_CONSTITUTION_SEED }         from "./seeds/uae-constitution.js";
export { FEDERAL_DECREE_LAWS_SEED }      from "./seeds/federal-decree-laws.js";
export { FEDERAL_LAWS_SEED }             from "./seeds/federal-laws.js";
export { EXECUTIVE_REGULATIONS_SEED }    from "./seeds/executive-regulations.js";
export { CABINET_MINISTERIAL_SEED }      from "./seeds/cabinet-ministerial.js";
export { OFFICIAL_GAZETTE_SEED }         from "./seeds/official-gazette.js";
export { SUPREME_COURT_PRINCIPLES_SEED } from "./seeds/supreme-court-principles.js";
export { OFFICIAL_GUIDANCE_SEED }        from "./seeds/official-guidance.js";
