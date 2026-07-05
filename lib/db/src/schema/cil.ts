/**
 * Phase 42 — Constitutional Intelligence Layer (CIL)
 *
 * The constitutional brain of MARSAD.
 * Evaluates every administrative decision against 12 constitutional principles
 * and produces 6 structured scores with full legal backing.
 *
 * One assessment row per decision (upserted on each run).
 * Constitutional warnings are stored separately for fine-grained resolution tracking.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  json,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { decisionsTable } from "./decisions";

// ─── Constitutional Principle Keys ────────────────────────────────────────────

export const CONSTITUTIONAL_PRINCIPLE_KEYS = [
  "legality",              // المشروعية
  "jurisdiction",          // الاختصاص
  "due_process",           // ضمانات المحاكمة العادلة
  "equality",              // المساواة
  "proportionality",       // التناسب
  "transparency",          // الشفافية
  "explainability",        // قابلية التفسير
  "human_rights",          // حقوق الإنسان
  "legitimate_expectation",// التوقع المشروع
  "legal_certainty",       // اليقين القانوني
  "abuse_of_power",        // إساءة استخدام السلطة
  "administrative_justice",// العدالة الإدارية
] as const;

export type ConstitutionalPrincipleKey = (typeof CONSTITUTIONAL_PRINCIPLE_KEYS)[number];

export const CONSTITUTIONAL_PRINCIPLE_LABELS_AR: Record<ConstitutionalPrincipleKey, string> = {
  legality:               "المشروعية",
  jurisdiction:           "الاختصاص",
  due_process:            "ضمانات المحاكمة العادلة",
  equality:               "المساواة",
  proportionality:        "التناسب",
  transparency:           "الشفافية",
  explainability:         "قابلية التفسير",
  human_rights:           "حقوق الإنسان",
  legitimate_expectation: "التوقع المشروع",
  legal_certainty:        "اليقين القانوني",
  abuse_of_power:         "إساءة استخدام السلطة",
  administrative_justice: "العدالة الإدارية",
};

export const CONSTITUTIONAL_PRINCIPLE_LABELS_EN: Record<ConstitutionalPrincipleKey, string> = {
  legality:               "Legality",
  jurisdiction:           "Jurisdiction",
  due_process:            "Due Process",
  equality:               "Equality",
  proportionality:        "Proportionality",
  transparency:           "Transparency",
  explainability:         "Explainability",
  human_rights:           "Human Rights",
  legitimate_expectation: "Legitimate Expectation",
  legal_certainty:        "Legal Certainty",
  abuse_of_power:         "Abuse of Power",
  administrative_justice: "Administrative Justice",
};

// ─── Warning Codes ────────────────────────────────────────────────────────────

export const CONSTITUTIONAL_WARNING_CODES = [
  "equality_concern",
  "weak_reasoning",
  "abuse_of_discretion",
  "high_annulment_probability",
  "due_process_gap",
  "rights_at_risk",
  "legality_defect",
  "proportionality_breach",
  "transparency_failure",
  "legal_certainty_risk",
  "jurisdiction_gap",
  "legitimate_expectation_violated",
] as const;

export type ConstitutionalWarningCode = (typeof CONSTITUTIONAL_WARNING_CODES)[number];

export const WARNING_LABELS_AR: Record<ConstitutionalWarningCode, string> = {
  equality_concern:               "⚠ مخاوف المساواة",
  weak_reasoning:                 "⚠ ضعف التسبيب",
  abuse_of_discretion:            "⚠ احتمال إساءة السلطة التقديرية",
  high_annulment_probability:     "⚠ احتمالية إلغاء قضائي مرتفعة",
  due_process_gap:                "⚠ ثغرة في ضمانات التقاضي",
  rights_at_risk:                 "⚠ حقوق في خطر",
  legality_defect:                "⚠ خلل في المشروعية",
  proportionality_breach:         "⚠ إخلال بمبدأ التناسب",
  transparency_failure:           "⚠ إخفاق في الشفافية",
  legal_certainty_risk:           "⚠ مخاطر اليقين القانوني",
  jurisdiction_gap:               "⚠ ثغرة في الاختصاص",
  legitimate_expectation_violated:"⚠ انتهاك التوقع المشروع",
};

export const WARNING_LABELS_EN: Record<ConstitutionalWarningCode, string> = {
  equality_concern:               "⚠ Equality Concern",
  weak_reasoning:                 "⚠ Weak Reasoning",
  abuse_of_discretion:            "⚠ Possible Abuse of Discretion",
  high_annulment_probability:     "⚠ High Judicial Annulment Probability",
  due_process_gap:                "⚠ Due Process Gap",
  rights_at_risk:                 "⚠ Rights at Risk",
  legality_defect:                "⚠ Legality Defect",
  proportionality_breach:         "⚠ Proportionality Breach",
  transparency_failure:           "⚠ Transparency Failure",
  legal_certainty_risk:           "⚠ Legal Certainty Risk",
  jurisdiction_gap:               "⚠ Jurisdiction Gap",
  legitimate_expectation_violated:"⚠ Legitimate Expectation Violated",
};

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type CilRiskLevel = "low" | "moderate" | "high" | "critical";

export type PrincipleStatus =
  | "compliant"
  | "minor_concern"
  | "significant_concern"
  | "deficient"
  | "not_assessed";

/** Detailed result for one of the 12 constitutional principles */
export type CilPrincipleResult = {
  principleKey: ConstitutionalPrincipleKey;
  labelAr: string;
  labelEn: string;
  /** Compliance score 0-100 for this principle (100 = fully compliant) */
  complianceScore: number;
  status: PrincipleStatus;
  /** Core legal finding in Arabic */
  findingAr: string;
  /** Legal reasoning backing the score */
  legalReasoning: string;
  /** UAE Constitution articles cited */
  constitutionalReferences: Array<{
    article: string;
    titleAr: string;
    relevance: string;
  }>;
  /** UAE Federal / Emirate laws cited */
  uaeLegalReferences: Array<{
    law: string;
    article: string;
    titleAr: string;
    relevance: string;
  }>;
  /** Al-Shamsi Theory dimensions engaged */
  alShamsiDimensions: Array<{
    dimension: string;
    score: number;
    finding: string;
  }>;
  /** Evidence ledger entries referenced */
  evidenceReferences: Array<{
    sequenceNumber: number;
    action: string;
    relevance: string;
  }>;
  /** Replay stages referenced */
  replayReferences: Array<{
    stageKey: string;
    stageLabel: string;
    relevance: string;
  }>;
  /** Specific remedy if deficient */
  remedyAr?: string | null;
  /** Is this principle a blocking issue for approval? */
  isBlockingApproval: boolean;
};

/** One constitutional warning — surfaced before approval */
export type CilWarning = {
  warningCode: ConstitutionalWarningCode;
  severity: "advisory" | "warning" | "critical";
  principleKey: ConstitutionalPrincipleKey;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  constitutionalRef: string;
  remedyAr: string;
};

// ─── Main Assessments Table ────────────────────────────────────────────────────

export const constitutionalAssessmentsTable = pgTable(
  "constitutional_assessments",
  {
    id: serial("id").primaryKey(),

    /** FK to decisions — cascade delete on decision removal */
    decisionId: integer("decision_id")
      .notNull()
      .unique()
      .references(() => decisionsTable.id, { onDelete: "cascade" }),

    /**
     * Assessment lifecycle.
     * Values: pending | running | completed | failed
     */
    status: text("status").notNull().default("pending"),

    /** Monotonically incremented on each re-run */
    assessmentVersion: integer("assessment_version").notNull().default(0),

    /** Role of the actor who triggered this run */
    triggeredBy: text("triggered_by"),

    /** ISO timestamp of the last successful assessment */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // ─── 6 Constitutional Scores ──────────────────────────────────────────

    /** Constitutional Compliance Score 0-100 (higher = more compliant) */
    constitutionalComplianceScore: integer("constitutional_compliance_score"),

    /** Constitutional Risk Index 0-100 (lower = less risky) */
    constitutionalRiskIndex: integer("constitutional_risk_index"),

    /** Equality Index 0-100 (higher = more equal treatment) */
    equalityIndex: integer("equality_index"),

    /** Due Process Index 0-100 (higher = stronger procedural guarantees) */
    dueProcessIndex: integer("due_process_index"),

    /** Rights Impact Score 0-100 (higher = more rights-protective) */
    rightsImpactScore: integer("rights_impact_score"),

    /** Judicial Survival Probability 0-100 (probability decision survives judicial review) */
    judicialSurvivalProbability: integer("judicial_survival_probability"),

    /** Aggregate risk level derived from constitutionalRiskIndex */
    overallRiskLevel: text("overall_risk_level").$type<CilRiskLevel>(),

    // ─── 12 Principle Results ─────────────────────────────────────────────

    /** Full result for each of the 12 constitutional principles */
    principleResults: json("principle_results").$type<CilPrincipleResult[]>(),

    // ─── Warnings ─────────────────────────────────────────────────────────

    /** Constitutional warnings that must be shown before approval */
    warnings: json("warnings").$type<CilWarning[]>(),

    /** Total count of active (non-resolved) warnings */
    activeWarningCount: integer("active_warning_count").default(0),

    /** True if any warning has severity === "critical" */
    hasCriticalWarning: boolean("has_critical_warning").default(false),

    // ─── Cross-module integration ──────────────────────────────────────────

    /** NRME constitutional impact cross-reference */
    nrmeIntegration: json("nrme_integration").$type<{
      constitutionalImpactScore: number;
      riskIndexAlignment: number;
      recommendation: string;
    }>(),

    /** Replay engine cross-reference */
    replayIntegration: json("replay_integration").$type<{
      stagesAnalysed: number;
      criticalStages: string[];
      replayHash: string;
    }>(),

    /** ADP integration reference */
    adpIntegration: json("adp_integration").$type<{
      includedInAdp: boolean;
      adpSectionHash: string | null;
    }>(),

    // ─── Top-level narrative ──────────────────────────────────────────────

    /** Overall constitutional reasoning narrative (Arabic) */
    overallReasoningAr: text("overall_reasoning_ar"),

    /** Suggested action for the issuing authority (Arabic) */
    recommendedActionAr: text("recommended_action_ar"),

    // ─── Integrity ────────────────────────────────────────────────────────

    /** SHA-256 audit hash over the complete assessment payload */
    auditHash: text("audit_hash"),

    // ─── Error state ──────────────────────────────────────────────────────
    errorMessage: text("error_message"),

    // ─── Acknowledgment ───────────────────────────────────────────────────
    /** Whether a constitutional_reviewer / judge has acknowledged this assessment */
    acknowledged: boolean("acknowledged").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cil_decision_id_idx").on(t.decisionId),
    index("cil_status_idx").on(t.status),
    index("cil_risk_level_idx").on(t.overallRiskLevel),
  ],
);

export type ConstitutionalAssessment = typeof constitutionalAssessmentsTable.$inferSelect;
export type ConstitutionalAssessmentInsert = typeof constitutionalAssessmentsTable.$inferInsert;

// ─── Warnings Table ───────────────────────────────────────────────────────────
// Mirrors the warnings JSON array for queryable, resolvable warning records.

export const constitutionalWarningsTable = pgTable(
  "constitutional_warnings",
  {
    id: serial("id").primaryKey(),

    /** FK to decisions */
    decisionId: integer("decision_id")
      .notNull()
      .references(() => decisionsTable.id, { onDelete: "cascade" }),

    /** FK to the assessment that generated this warning */
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => constitutionalAssessmentsTable.id, { onDelete: "cascade" }),

    /** Warning classification code */
    warningCode: text("warning_code").$type<ConstitutionalWarningCode>().notNull(),

    /** Severity level */
    severity: text("severity").$type<"advisory" | "warning" | "critical">().notNull(),

    /** Which constitutional principle triggered this warning */
    principleKey: text("principle_key").$type<ConstitutionalPrincipleKey>().notNull(),

    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    descriptionAr: text("description_ar"),
    constitutionalRef: text("constitutional_ref"),
    remedyAr: text("remedy_ar"),

    /** Whether this warning has been resolved by the issuing authority */
    isResolved: boolean("is_resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cw_decision_id_idx").on(t.decisionId),
    index("cw_assessment_id_idx").on(t.assessmentId),
    index("cw_severity_idx").on(t.severity),
    index("cw_resolved_idx").on(t.isResolved),
  ],
);

export type ConstitutionalWarningRecord = typeof constitutionalWarningsTable.$inferSelect;
export type ConstitutionalWarningInsert = typeof constitutionalWarningsTable.$inferInsert;
