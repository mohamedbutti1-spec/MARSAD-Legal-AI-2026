/**
 * National Risk Modeling Engine (NRME) — Database Schema
 * ────────────────────────────────────────────────────────
 * 9 tables covering the full risk lifecycle for every administrative decision.
 * Scoring is driven by the 16 Al-Shamsi Theory dimensions and 15 national risk indices.
 * Every change is fully audited and replayable through the Decision Replay Engine.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  json,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { decisionsTable } from "./decisions";
// Re-use the canonical RiskLevel type from judicial-review to avoid duplicate exports
import type { RiskLevel } from "./judicial-review";
export type { RiskLevel } from "./judicial-review";

// ─── Risk Index Types ─────────────────────────────────────────────────────────

export type RiskIndexScore = {
  /** Score 0–100 (0 = no risk / fully positive) */
  score: number;
  /** Plain-language explanation with legal + constitutional references */
  reason: string;
  /** Al-Shamsi dimension(s) that drove this score */
  alShamsiDrivers: string[];
  /** UAE constitutional/legal articles cited */
  legalCitations: string[];
  /** Change since last assessment */
  delta: number | null;
};

export type RiskIndices = {
  likelihood:                  RiskIndexScore;
  impact:                      RiskIndexScore;
  velocity:                    RiskIndexScore;
  detectability:               RiskIndexScore;
  controllability:             RiskIndexScore;
  nationalSecurityImpact:      RiskIndexScore;
  constitutionalImpact:        RiskIndexScore;
  financialImpact:             RiskIndexScore;
  reputationImpact:            RiskIndexScore;
  publicTrustImpact:           RiskIndexScore;
  humanRightsImpact:           RiskIndexScore;
  aiBiasRisk:                  RiskIndexScore;
  digitalSovereigntyRisk:      RiskIndexScore;
  operationalContinuity:       RiskIndexScore;
  judicialChallengeProbability: RiskIndexScore;
};

export type AlShamsiRiskMapping = {
  /** dimension key from judicial_reviews.dimensions */
  dimension: string;
  /** 0–100 risk score for this dimension */
  riskScore: number;
  status: string;
  finding: string;
  /** Which NRME indices this dimension drives */
  drivesIndices: string[];
};

export type RiskAssessmentStatus = "pending" | "calculating" | "ready" | "failed" | "stale";

// ─── 1. Risk Categories ───────────────────────────────────────────────────────
// UAE Government risk taxonomy — seeded at startup

export const riskCategoriesTable = pgTable("risk_categories", {
  id:          serial("id").primaryKey(),
  code:        text("code").unique().notNull(),
  nameAr:      text("name_ar").notNull(),
  nameEn:      text("name_en").notNull(),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  /** Which Al-Shamsi dimensions map to this category */
  alShamsiDimensions: json("al_shamsi_dimensions").$type<string[]>().default([]),
  /** Which NRME indices this category covers */
  nrmeIndices: json("nrme_indices").$type<string[]>().default([]),
  /** Display order in dashboards */
  sortOrder:   integer("sort_order").notNull().default(0),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RiskCategory = typeof riskCategoriesTable.$inferSelect;

// ─── 2. Risks ─────────────────────────────────────────────────────────────────
// Master risk registry — one risk row per identified risk per decision

export const risksTable = pgTable("risks", {
  id:           serial("id").primaryKey(),
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),
  categoryId:   integer("category_id").references(() => riskCategoriesTable.id, { onDelete: "restrict" }),
  titleAr:      text("title_ar").notNull(),
  titleEn:      text("title_en"),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  /** Risk source: ai_generated | human_identified | system_derived */
  source:       text("source").notNull().default("ai_generated"),
  status:       text("status").notNull().default("open"),
  /** Risk level derived from composite score */
  riskLevel:    text("risk_level").$type<RiskLevel>(),
  /** Composite score 0–100 */
  compositeScore: real("composite_score"),
  /** Primary Al-Shamsi dimension driving this risk */
  primaryDimension: text("primary_dimension"),
  /** UAE constitutional article most relevant */
  constitutionalReference: text("constitutional_reference"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("risks_decision_id_idx").on(t.decisionId),
]);

export type Risk = typeof risksTable.$inferSelect;

// ─── 3. Risk Assessments ──────────────────────────────────────────────────────
// The full computed assessment for a decision.
// Auto-generated when a decision is created; recalculated on treatment changes.
// One row per decision (upserted). Versioned via risk_history.

export const riskAssessmentsTable = pgTable("risk_assessments", {
  id:           serial("id").primaryKey(),

  /** FK to decisions — one active assessment per decision */
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),

  /** Assessment lifecycle status */
  status:       text("status").$type<RiskAssessmentStatus>().notNull().default("pending"),

  /** Assessment version — incremented on every recalculation */
  assessmentVersion: integer("assessment_version").notNull().default(0),

  /** Timestamp of last successful calculation */
  calculatedAt: timestamp("calculated_at", { withTimezone: true }),

  // ── Three Aggregate Scores (0–100) ─────────────────────────────────────────

  /** Overall National Risk Index: weighted composite of all 15 indices */
  nationalRiskIndex: real("national_risk_index"),
  /** Risk level derived from nationalRiskIndex */
  riskLevel:    text("risk_level").$type<RiskLevel>(),

  /** How fully the decision satisfies Al-Shamsi constitutional legitimacy criteria */
  administrativeLegitimacyIndex: real("administrative_legitimacy_index"),

  /** Confidence in the decision given evidence quality, constitutional compliance, human oversight */
  decisionConfidenceScore: real("decision_confidence_score"),

  // ── 15 Individual Risk Indices ─────────────────────────────────────────────

  indices: json("indices").$type<RiskIndices>(),

  // ── Al-Shamsi 16-Dimension Risk Mapping ───────────────────────────────────

  alShamsiMapping: json("al_shamsi_mapping").$type<AlShamsiRiskMapping[]>(),

  // ── Executive Narrative ───────────────────────────────────────────────────

  /** AI-generated plain-language executive summary of the risk profile */
  executiveSummaryAr: text("executive_summary_ar"),
  executiveSummaryEn: text("executive_summary_en"),

  /** Key risk drivers (top 3 indices by score) */
  topRiskDrivers: json("top_risk_drivers").$type<string[]>().default([]),

  /** Recommended immediate actions */
  immediateRecommendations: json("immediate_recommendations").$type<string[]>().default([]),

  // ── Trigger tracking ──────────────────────────────────────────────────────

  /** What triggered this recalculation */
  triggerReason: text("trigger_reason"),
  triggeredBy:   text("triggered_by"),

  /** Error state */
  errorMessage:  text("error_message"),

  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("risk_assessments_decision_id_uniq").on(t.decisionId),
  // Performance: dashboard and lazy-load queries filter by status (pending/calculating/done)
  index("risk_assessments_status_idx").on(t.status),
]);

export type RiskAssessment = typeof riskAssessmentsTable.$inferSelect;

// ─── 4. Risk Scenarios ────────────────────────────────────────────────────────
// AI-generated risk scenarios for each decision

export const riskScenariosTable = pgTable("risk_scenarios", {
  id:           serial("id").primaryKey(),
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),
  riskId:       integer("risk_id").references(() => risksTable.id, { onDelete: "cascade" }),

  titleAr:      text("title_ar").notNull(),
  titleEn:      text("title_en"),

  /** Scenario type: judicial_challenge | constitutional_defect | public_trust_failure | operational_failure | ai_misuse */
  scenarioType: text("scenario_type").notNull(),

  /** Probability 0–100 */
  probability:  real("probability"),
  /** Potential consequence severity: low | moderate | high | critical */
  severity:     text("severity"),

  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),

  /** Specific constitutional article or legal instrument implicated */
  legalImplication: text("legal_implication"),

  /** Recommended preventive action */
  preventiveActionAr: text("preventive_action_ar"),

  /** Al-Shamsi dimension most relevant */
  primaryDimension: text("primary_dimension"),

  status:       text("status").notNull().default("active"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("risk_scenarios_decision_id_idx").on(t.decisionId),
]);

export type RiskScenario = typeof riskScenariosTable.$inferSelect;

// ─── 5. Risk Treatments ───────────────────────────────────────────────────────
// Mitigation actions — every add/update/delete triggers full recalculation

export const riskTreatmentsTable = pgTable("risk_treatments", {
  id:           serial("id").primaryKey(),
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),
  riskId:       integer("risk_id").references(() => risksTable.id, { onDelete: "set null" }),

  titleAr:      text("title_ar").notNull(),
  titleEn:      text("title_en"),

  /** Treatment type: avoid | reduce | transfer | accept | monitor */
  treatmentType: text("treatment_type").notNull().default("reduce"),

  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),

  /** Responsible party name */
  responsibleParty: text("responsible_party"),

  /** Target completion date */
  targetDate:   timestamp("target_date", { withTimezone: true }),

  /** Current status: planned | in_progress | completed | cancelled */
  status:       text("status").notNull().default("planned"),

  /** Expected risk reduction in index points (0–100) */
  expectedReduction: real("expected_reduction"),

  /** Actual risk reduction achieved (set when status = completed) */
  actualReduction: real("actual_reduction"),

  /** Legal basis for the treatment (UAE article/law) */
  legalBasis:   text("legal_basis"),

  completedAt:  timestamp("completed_at", { withTimezone: true }),
  createdBy:    text("created_by"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("risk_treatments_decision_id_idx").on(t.decisionId),
]);

export type RiskTreatment = typeof riskTreatmentsTable.$inferSelect;

// ─── 6. Risk Owners ───────────────────────────────────────────────────────────
// Assignment of accountability for each risk

export const riskOwnersTable = pgTable("risk_owners", {
  id:           serial("id").primaryKey(),
  riskId:       integer("risk_id").notNull().references(() => risksTable.id, { onDelete: "cascade" }),
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),

  ownerName:    text("owner_name").notNull(),
  ownerRole:    text("owner_role"),
  ownerOrg:     text("owner_org"),

  /** primary | secondary | escalation */
  ownerType:    text("owner_type").notNull().default("primary"),

  assignedAt:   timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RiskOwner = typeof riskOwnersTable.$inferSelect;

// ─── 7. Risk Monitoring ───────────────────────────────────────────────────────
// Ongoing monitoring records — scheduled check-ins on risk status

export const riskMonitoringTable = pgTable("risk_monitoring", {
  id:           serial("id").primaryKey(),
  riskId:       integer("risk_id").notNull().references(() => risksTable.id, { onDelete: "cascade" }),
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),

  /** Current status of the monitored risk */
  currentStatus: text("current_status").notNull().default("active"),

  /** Observations from this monitoring cycle */
  observationsAr: text("observations_ar"),

  /** Current risk score at time of monitoring */
  currentScore:  real("current_score"),
  /** Change from previous monitoring cycle */
  scoreDelta:    real("score_delta"),

  monitoredBy:   text("monitored_by"),
  monitoredByRole: text("monitored_by_role"),

  nextReviewDate: timestamp("next_review_date", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("risk_monitoring_decision_id_idx").on(t.decisionId),
]);

export type RiskMonitoring = typeof riskMonitoringTable.$inferSelect;

// ─── 8. Risk Reviews ──────────────────────────────────────────────────────────
// Periodic formal review records — governance accountability

export const riskReviewsTable = pgTable("risk_reviews", {
  id:           serial("id").primaryKey(),
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),

  /** Review outcome: satisfactory | needs_improvement | escalate | close_risk */
  reviewOutcome: text("review_outcome"),

  /** Formal review narrative */
  reviewNarrativeAr: text("review_narrative_ar"),
  reviewNarrativeEn: text("review_narrative_en"),

  /** National Risk Index at time of review */
  nriAtReview:  real("nri_at_review"),
  /** ALI at time of review */
  aliAtReview:  real("ali_at_review"),
  /** DCS at time of review */
  dcsAtReview:  real("dcs_at_review"),

  reviewedBy:   text("reviewed_by"),
  reviewedByRole: text("reviewed_by_role"),
  reviewedByOrg:  text("reviewed_by_org"),

  nextReviewDate: timestamp("next_review_date", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("risk_reviews_decision_id_idx").on(t.decisionId),
]);

export type RiskReview = typeof riskReviewsTable.$inferSelect;

// ─── 9. Risk History ──────────────────────────────────────────────────────────
// Immutable audit trail of every assessment change — replayable

export const riskHistoryTable = pgTable("risk_history", {
  id:           serial("id").primaryKey(),
  decisionId:   integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "cascade" }),

  /** The assessment version this history row represents */
  assessmentVersion: integer("assessment_version").notNull(),

  /** Snapshot of all three aggregate scores */
  nationalRiskIndex:             real("national_risk_index"),
  administrativeLegitimacyIndex: real("administrative_legitimacy_index"),
  decisionConfidenceScore:       real("decision_confidence_score"),
  riskLevel:    text("risk_level").$type<RiskLevel>(),

  /** Full snapshot of the 15-index scores at this version */
  indicesSnapshot: json("indices_snapshot").$type<RiskIndices>(),

  /** What caused this recalculation */
  triggerReason: text("trigger_reason").notNull(),
  /** Who triggered it (userId or "system") */
  triggeredBy:   text("triggered_by"),
  /** Role of the actor */
  triggeredByRole: text("triggered_by_role"),

  /** SHA-256(decisionId + assessmentVersion + nationalRiskIndex + triggeredBy + recordedAt) */
  auditHash:    text("audit_hash").notNull(),

  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("risk_history_decision_id_idx").on(t.decisionId),
]);

export type RiskHistory = typeof riskHistoryTable.$inferSelect;

// ─── Seed Data Types ──────────────────────────────────────────────────────────

export const NRME_RISK_CATEGORIES = [
  {
    code: "national_security",
    nameAr: "الأمن الوطني",
    nameEn: "National Security",
    descriptionAr: "المخاطر المتعلقة بسيادة الدولة والأمن الوطني والمصالح الاستراتيجية",
    descriptionEn: "Risks related to state sovereignty, national security, and strategic interests",
    alShamsiDimensions: ["jurisdiction", "subject", "constitutional_compliance"],
    nrmeIndices: ["nationalSecurityImpact", "operationalContinuity", "likelihood"],
    sortOrder: 1,
  },
  {
    code: "constitutional_compliance",
    nameAr: "الامتثال الدستوري",
    nameEn: "Constitutional Compliance",
    descriptionAr: "المخاطر المرتبطة بمطابقة القرار لأحكام الدستور والمبادئ القانونية",
    descriptionEn: "Risks related to constitutional conformity and legal principles",
    alShamsiDimensions: ["constitutional_compliance", "form", "procedure", "due_process"],
    nrmeIndices: ["constitutionalImpact", "judicialChallengeProbability", "administrativeLegitimacyIndex"],
    sortOrder: 2,
  },
  {
    code: "financial_integrity",
    nameAr: "النزاهة المالية",
    nameEn: "Financial Integrity",
    descriptionAr: "المخاطر المالية والاقتصادية الناجمة عن القرار الإداري",
    descriptionEn: "Financial and economic risks arising from the administrative decision",
    alShamsiDimensions: ["subject", "cause", "proportionality"],
    nrmeIndices: ["financialImpact", "impact", "controllability"],
    sortOrder: 3,
  },
  {
    code: "public_trust",
    nameAr: "الثقة العامة",
    nameEn: "Public Trust",
    descriptionAr: "مخاطر تآكل الثقة العامة في المؤسسات الحكومية",
    descriptionEn: "Risks of eroding public trust in government institutions",
    alShamsiDimensions: ["transparency", "explainability", "purpose"],
    nrmeIndices: ["publicTrustImpact", "reputationImpact", "velocity"],
    sortOrder: 4,
  },
  {
    code: "human_rights",
    nameAr: "حقوق الإنسان",
    nameEn: "Human Rights",
    descriptionAr: "المخاطر المتعلقة بانتهاك حقوق الإنسان والحريات الأساسية",
    descriptionEn: "Risks related to human rights violations and fundamental freedoms",
    alShamsiDimensions: ["human_influence", "due_process", "equality", "fundamental_rights"],
    nrmeIndices: ["humanRightsImpact", "judicialChallengeProbability", "impact"],
    sortOrder: 5,
  },
  {
    code: "ai_ethics",
    nameAr: "أخلاقيات الذكاء الاصطناعي",
    nameEn: "AI Ethics",
    descriptionAr: "مخاطر الاستخدام غير الأخلاقي أو المتحيز للذكاء الاصطناعي في صنع القرار",
    descriptionEn: "Risks of unethical or biased AI use in decision-making",
    alShamsiDimensions: ["ai_influence", "algorithmic_bias", "explainability"],
    nrmeIndices: ["aiBiasRisk", "detectability", "transparency"],
    sortOrder: 6,
  },
  {
    code: "digital_sovereignty",
    nameAr: "السيادة الرقمية",
    nameEn: "Digital Sovereignty",
    descriptionAr: "مخاطر تهديد السيادة الرقمية وحوكمة البيانات الوطنية",
    descriptionEn: "Risks threatening digital sovereignty and national data governance",
    alShamsiDimensions: ["ai_influence", "algorithmic_bias", "constitutional_compliance"],
    nrmeIndices: ["digitalSovereigntyRisk", "aiBiasRisk", "operationalContinuity"],
    sortOrder: 7,
  },
  {
    code: "operational_continuity",
    nameAr: "استمرارية العمليات",
    nameEn: "Operational Continuity",
    descriptionAr: "مخاطر انقطاع الخدمات الحكومية وتعطل العمليات الإدارية",
    descriptionEn: "Risks of government service interruption and administrative process disruption",
    alShamsiDimensions: ["procedure", "form", "subject"],
    nrmeIndices: ["operationalContinuity", "velocity", "controllability"],
    sortOrder: 8,
  },
  {
    code: "judicial_integrity",
    nameAr: "النزاهة القضائية",
    nameEn: "Judicial Integrity",
    descriptionAr: "مخاطر الطعن القضائي وإلغاء القرار أمام المحاكم الإدارية",
    descriptionEn: "Risks of judicial challenge and decision annulment before administrative courts",
    alShamsiDimensions: ["jurisdiction", "proportionality", "due_process", "form"],
    nrmeIndices: ["judicialChallengeProbability", "constitutionalImpact", "likelihood"],
    sortOrder: 9,
  },
] as const;
