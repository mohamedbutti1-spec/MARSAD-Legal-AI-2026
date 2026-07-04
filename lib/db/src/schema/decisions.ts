import { pgTable, text, serial, timestamp, integer, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Stage Keys (ordered) ─────────────────────────────────────────────────────

export const DECISION_STAGE_KEYS = [
  "administrative_request",
  "legal_authority",
  "facts_evidence",
  "legal_basis",
  "administrative_objective",
  "discretionary_power",
  "proportionality",
  "human_oversight",
  "constitutional_validation",
  "decision_drafting",
  "final_review",
] as const;

export type DecisionStageKey = (typeof DECISION_STAGE_KEYS)[number];

// ─── Decision Status ──────────────────────────────────────────────────────────

export const DECISION_STATUS_VALUES = [
  "draft",
  "in_progress",
  "validation_failed",
  "complete",
  "signed",
] as const;

export type DecisionStatus = (typeof DECISION_STATUS_VALUES)[number];

// ─── Decisions Table ──────────────────────────────────────────────────────────
// Each row represents one administrative decision case, from first request
// through final signed output. Case number format: MARSAD-YYYY-NNNN.

export const decisionsTable = pgTable("decisions", {
  id: serial("id").primaryKey(),

  /** Unique immutable reference. Format: MARSAD-YYYY-NNNN */
  caseNumber: text("case_number").unique().notNull(),

  /** Official Arabic title of the decision */
  titleAr: text("title_ar").notNull(),

  /** Optional English title */
  titleEn: text("title_en"),

  /** Lifecycle status */
  status: text("status").notNull().default("in_progress"),

  /** Key of the stage the decision is currently at */
  currentStage: text("current_stage").notNull().default("administrative_request"),

  /** Array of stage keys that have been completed */
  stagesCompleted: json("stages_completed").$type<string[]>().default([]),

  /** Jurisdiction key (e.g., "uae", "sa", "fr") */
  jurisdiction: text("jurisdiction").notNull(),

  /** Type of administrative decision (appointment, revocation, penalty, etc.) */
  decisionType: text("decision_type").notNull(),

  /** Name of the issuing administrative unit / ministry */
  organizationUnit: text("organization_unit").notNull(),

  /** Name / position of the issuing authority official */
  issuingAuthority: text("issuing_authority"),

  /** User ID of creator */
  createdBy: integer("created_by"),

  /** Additional metadata (tags, priority, etc.) */
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionSchema = createInsertSchema(decisionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDecision = z.infer<typeof insertDecisionSchema>;
export type Decision = typeof decisionsTable.$inferSelect;

// ─── Decision Stages Table ────────────────────────────────────────────────────
// Each row is an immutable stage record. Once completed, a stage is never
// overwritten — only superseded by a new row (re-do flow). The audit_hash
// provides tamper-evidence for each individual stage record.

export const decisionStagesTable = pgTable("decision_stages", {
  id: serial("id").primaryKey(),

  /** FK to decisionsTable */
  decisionId: integer("decision_id").notNull(),

  /** Stage identifier matching DECISION_STAGE_KEYS */
  stageKey: text("stage_key").notNull(),

  /** Stage order (1-indexed) */
  stageNumber: integer("stage_number").notNull(),

  /** All form fields submitted for this stage */
  stageData: json("stage_data").$type<Record<string, unknown>>().notNull().default({}),

  /** Formal Arabic statement of what AI contributed */
  aiContribution: text("ai_contribution"),

  /** Full AI analysis response (structured) */
  aiAnalysis: json("ai_analysis").$type<Record<string, unknown>>().default({}),

  /** Whether the human official overrode an AI recommendation */
  humanOverride: boolean("human_override").default(false),

  /** Reason for override, if applicable */
  overrideReason: text("override_reason"),

  /** pending | passed | failed */
  validationStatus: text("validation_status").default("pending"),

  /** Structured validation results per-dimension */
  validationDetails: json("validation_details").$type<Record<string, unknown>>().default({}),

  validatedAt: timestamp("validated_at", { withTimezone: true }),
  validatedBy: integer("validated_by"),

  /** SHA-256(decisionId + stageKey + stageData + timestamp + userId) */
  auditHash: text("audit_hash"),

  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionStageSchema = createInsertSchema(decisionStagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDecisionStage = z.infer<typeof insertDecisionStageSchema>;
export type DecisionStage = typeof decisionStagesTable.$inferSelect;

// ─── Decision Constitutional Identity (DCI) ───────────────────────────────────
// The DCI is the constitutional passport of each administrative decision.
// It is auto-generated on creation, updated as stages complete, and sealed
// after constitutional validation. Every later module reads the DCI rather than
// recalculating these values. Immutable after sealing except through a recorded
// amendment (new versionHistory entry).

export type DciVersion = {
  /** Snapshot number (the version that was current before this amendment) */
  version: number;
  changedAt: string;    // ISO-8601
  changedBy: number;    // userId of the supervisor/owner who made the change
  reason: string;       // mandatory justification text
  /** Fields that changed and their previous values */
  snapshot: Record<string, unknown>;
};

export const decisionDciTable = pgTable("decision_dci", {
  id: serial("id").primaryKey(),

  /** FK to decisionsTable — one DCI per decision, always. Cascade-deletes with the decision. */
  decisionId: integer("decision_id").notNull().unique().references(() => decisionsTable.id, { onDelete: "cascade" }),

  // ─── Decision Identity ─────────────────────────────────────────────────────

  /** Type of the administrative decision (appointment, penalty, etc.) */
  decisionType: text("decision_type").notNull(),

  /** Issuing authority name and position — set at legal_authority stage */
  competentAuthority: text("competent_authority"),

  // ─── Constitutional Content (populated as stages complete) ─────────────────

  /** Applicable laws, articles, and instruments — set at legal_basis stage */
  applicableLegalBasis: json("applicable_legal_basis").$type<string[]>().default([]),

  /** Formal purpose statement — set at administrative_objective stage */
  purposeOfDecision: text("purpose_of_decision"),

  /** Full name, position, and organisation of the human owner — set at human_oversight stage */
  humanDecisionOwner: text("human_decision_owner"),

  // ─── AI & Human Participation Assessment ──────────────────────────────────

  /**
   * Extent of AI participation throughout the decision lifecycle.
   * Values: pending | none | advisory | analytical | drafting | comprehensive
   */
  aiParticipationLevel: text("ai_participation_level").notNull().default("pending"),

  /**
   * Verified degree of human oversight.
   * Values: pending | full | substantial | partial | minimal
   */
  humanOversightLevel: text("human_oversight_level").notNull().default("pending"),

  /**
   * Degree to which the decision can be explained to a reasonable person.
   * Values: pending | high | adequate | partial | insufficient
   */
  explainabilityLevel: text("explainability_level").notNull().default("pending"),

  /**
   * Degree of public transparency of the decision and its process.
   * Values: pending | high | adequate | partial | insufficient
   */
  transparencyLevel: text("transparency_level").notNull().default("pending"),

  // ─── Constitutional Indicators ────────────────────────────────────────────

  /**
   * Quality and completeness of the evidentiary record.
   * Values: pending | complete | substantial | partial | insufficient
   */
  evidenceCompleteness: text("evidence_completeness").notNull().default("pending"),

  /**
   * Result of the three-pronged proportionality test.
   * Values: pending | proportionate | marginally_proportionate | disproportionate
   */
  proportionalityStatus: text("proportionality_status").notNull().default("pending"),

  /**
   * Legal authority and lawfulness assessment.
   * Values: pending | confirmed | questionable | violated
   */
  legalityStatus: text("legality_status").notNull().default("pending"),

  /**
   * Result of Stage 9 — the constitutional gate (10-principle check).
   * Values: pending | passed | failed
   */
  constitutionalValidationStatus: text("constitutional_validation_status").notNull().default("pending"),

  /**
   * Overall M. Al-Shamsi Framework compliance rating.
   * Values: pending | full | substantial | partial | non_compliant
   */
  alShamsiFrameworkCompliance: text("al_shamsi_framework_compliance").notNull().default("pending"),

  // ─── Integrity ────────────────────────────────────────────────────────────

  /**
   * SHA-256 computed over all individual stage audit hashes in stage order.
   * Set when constitutional_validation passes. Recomputed on each amendment.
   */
  completeAuditHash: text("complete_audit_hash"),

  // ─── Versioning ───────────────────────────────────────────────────────────

  /** Monotonically increasing version counter (starts at 1). */
  currentVersion: integer("current_version").notNull().default(1),

  /**
   * Ordered list of amendment records. Each entry captures the previous DCI state,
   * the reason for the amendment, and who made it.
   * Entries are append-only — never deleted.
   */
  versionHistory: json("version_history").$type<DciVersion[]>().default([]),

  // ─── Immutability Seal ────────────────────────────────────────────────────

  /**
   * Becomes true when constitutional_validation stage passes.
   * After sealing, any change creates a new versionHistory entry.
   */
  isSealed: boolean("is_sealed").notNull().default(false),
  sealedAt: timestamp("sealed_at", { withTimezone: true }),
  sealedBy: integer("sealed_by"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DecisionDci = typeof decisionDciTable.$inferSelect;
export type DciInsert = typeof decisionDciTable.$inferInsert;

// ─── Judicial Defense Package (JDP) — Section Types ──────────────────────────
// Structured types for every section of the court-ready constitutional artifact.

export type FactualEvent = {
  stageNumber: number;
  stage: string;
  stageName: string;
  date?: string | null;
  description: string;
  actor?: string | null;
  aiContribution?: string | null;
};

export type LegalBasisGround = {
  law: string;
  article?: string | null;
  relevance: string;
};

export type LegalBasisSection = {
  overview: string;
  grounds: LegalBasisGround[];
  conclusion: string;
};

export type LegislationItem = {
  title: string;
  reference: string;
  applicableArticles: string[];
  relevance: string;
};

export type EvidenceItem = {
  type: string;
  description: string;
  weight: "high" | "medium" | "low";
  admissibility: string;
};

export type EvidenceSection = {
  overview: string;
  items: EvidenceItem[];
  completenessAssessment: string;
  conclusion: string;
};

export type ProportionalityTest = {
  result: "passed" | "failed" | "marginal";
  reasoning: string;
};

export type ProportionalitySection = {
  legitimateAimTest: ProportionalityTest;
  necessityTest: ProportionalityTest;
  strictProportionalityTest: ProportionalityTest;
  overallConclusion: string;
};

export type DiscretionarySection = {
  overview: string;
  factorsConsidered: string[];
  alternativesEvaluated: string;
  publicInterestBalance: string;
  conclusion: string;
};

export type StageAiContribution = {
  stage: string;
  stageName: string;
  contribution: string;
  humanVerification: string;
  reviewedBy?: string | null;
};

export type AiParticipationSection = {
  overview: string;
  totalStagesWithAiAssistance: number;
  participationLevel: string;
  stageContributions: StageAiContribution[];
  overallAssessment: string;
};

export type OversightVerificationStep = {
  stage: string;
  stageName: string;
  humanAction: string;
  outcome: string;
};

export type HumanOversightSection = {
  authorizedOfficer: string;
  position?: string | null;
  organization?: string | null;
  oversightLevel: string;
  verificationSteps: OversightVerificationStep[];
  conclusion: string;
};

export type PrincipleResult = {
  principle: string;
  passed: boolean;
  score?: number | null;
  notes: string;
};

export type ConstitutionalValidationSection = {
  overallResult: string;
  validationDate?: string | null;
  alShamsiScore?: number | null;
  principleResults: PrincipleResult[];
  conclusion: string;
};

export type DciSummarySection = {
  decisionId: string;
  decisionType: string;
  competentAuthority?: string | null;
  constitutionalValidationStatus: string;
  alShamsiFrameworkCompliance: string;
  sealedAt?: string | null;
  completeAuditHash?: string | null;
  currentVersion: number;
};

export type AuditStageRecord = {
  stageNumber: number;
  stage: string;
  stageName: string;
  auditHash?: string | null;
  completedAt?: string | null;
};

export type AuditChainSection = {
  overview: string;
  stages: AuditStageRecord[];
  completeHash?: string | null;
  integrityStatus: "verified" | "pending" | "compromised";
};

export type JdpVersionHistorySection = {
  currentVersion: number;
  isSealed: boolean;
  sealedAt?: string | null;
  amendments: DciVersion[];
};

export type JudicialQuestion = {
  category: string;
  question: string;
  legalGrounding: string;
  preparedAnswer: string;
  relevantEvidence?: string | null;
};

export type ExplainabilitySection = {
  overview: string;
  decisionRationale: string;
  alternativesConsidered: string;
  impactAssessment: string;
  publicInterestJustification: string;
  minorityInterestConsiderations?: string | null;
  conclusion: string;
};

// ─── Judicial Defense Package (JDP) Table ─────────────────────────────────────
// The JDP is generated after a decision's DCI is sealed. It assembles all
// constitutional evidence and reasoning into a court-ready artifact that lets
// any constitutionally validated decision be defended immediately before an
// administrative court without rebuilding the reasoning afterward.
//
// State machine: pending → generating → ready | error

export const decisionJdpTable = pgTable("decision_jdp", {
  id: serial("id").primaryKey(),

  /** FK to decisionsTable — one JDP per decision. Cascade-deletes with the decision. */
  decisionId: integer("decision_id")
    .notNull()
    .unique()
    .references(() => decisionsTable.id, { onDelete: "cascade" }),

  // ─── Generation State ─────────────────────────────────────────────────────
  status: text("status").notNull().default("pending"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  generatedBy: integer("generated_by"),
  /** Total milliseconds taken by the AI generation call */
  generationDurationMs: integer("generation_duration_ms"),
  errorMessage: text("error_message"),

  // ─── 14 Constitutional Sections ──────────────────────────────────────────
  factualChronology:               json("factual_chronology").$type<FactualEvent[]>(),
  legalBasis:                      json("legal_basis").$type<LegalBasisSection>(),
  applicableLegislation:           json("applicable_legislation").$type<LegislationItem[]>(),
  evidenceSummary:                 json("evidence_summary").$type<EvidenceSection>(),
  proportionalityAnalysis:         json("proportionality_analysis").$type<ProportionalitySection>(),
  discretionaryReasoning:          json("discretionary_reasoning").$type<DiscretionarySection>(),
  aiParticipationExplanation:      json("ai_participation_explanation").$type<AiParticipationSection>(),
  humanOversightRecord:            json("human_oversight_record").$type<HumanOversightSection>(),
  constitutionalValidationResults: json("constitutional_validation_results").$type<ConstitutionalValidationSection>(),
  dciSummary:                      json("dci_summary").$type<DciSummarySection>(),
  auditChain:                      json("audit_chain").$type<AuditChainSection>(),
  versionHistoryRecord:            json("version_history_record").$type<JdpVersionHistorySection>(),
  anticipatedJudicialReviewQuestions: json("anticipated_judicial_review_questions").$type<JudicialQuestion[]>(),
  explainabilityReport:            json("explainability_report").$type<ExplainabilitySection>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DecisionJdp = typeof decisionJdpTable.$inferSelect;
export type JdpInsert = typeof decisionJdpTable.$inferInsert;
