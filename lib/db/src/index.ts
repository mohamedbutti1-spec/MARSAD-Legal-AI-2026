import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
export { PERMISSIONS, getPermissions, ROLE_META, ALL_ROLES, GOVERNANCE_ROLES, type UserRole, type LegacyRole, type GovernanceRole, type RolePermissions } from "./permissions";
// Phase 3 — Chain of Custody service functions
export {
  recordCustodyEvent,
  verifyCustodyChain,
  getDecisionCustody,
  type CustodyEventInput,
  type CustodyVerificationResult,
  type ChainOfCustodyRecord,
} from "./custody-service";
// Phase 4 — Evidence Ledger service functions
export {
  recordEvidenceEvent,
  getEvidenceChain,
  verifyEvidenceChain,
  type EvidenceEventInput,
  type EvidenceVerificationResult,
  type EvidenceLedgerRecord,
} from "./evidence-service";
// Phase 5 — Constitutional Judicial Intelligence service functions
export {
  collectDecisionData,
  getJudicialReview,
  markJudicialReviewRunning,
  saveJudicialReview,
  markJudicialReviewFailed,
  buildJudicialReport,
  type JudicialReview,
  type CjiAnalysisResult,
  type JudicialDimension,
  type ConstitutionalDefect,
  type OutcomePrediction,
  type RemedyRecommendation,
  type RiskLevel,
} from "./judicial-review-service";
// Phase 3 — Constitutional Memory service functions
export {
  createOrUpdateMemory,
  recordMemoryEvent,
  getConstitutionalMemory,
  sealMemory,
  archiveMemory,
  getMemoryHistory,
  type CreateMemoryInput,
  type RecordMemoryEventInput,
  type ConstitutionalMemory,
  type MemoryIntegrityResult,
} from "./memory-service";
// Decision Replay Engine service functions
export {
  recordReplayEvent,
  getReplayEvents,
  verifyReplayEventHash,
  type RecordReplayEventInput,
  type ReplayEventRecord,
} from "./replay-service";
