import { pgTable, text, serial, timestamp, varchar, json } from "drizzle-orm/pg-core";

/**
 * Catalog of UAE (and future jurisdiction) administrative decision types.
 * Each row represents one class of administrative decision (e.g. "Employee Termination")
 * together with its applicable laws, required competence level, and base interview template.
 */
export const adminDecisionTypesTable = pgTable("admin_decision_types", {
  id: serial("id").primaryKey(),
  /** Primary jurisdiction: uae | france | gcc_sa | gcc_qa | gcc_bh | gcc_kw | gcc_om */
  jurisdiction: varchar("jurisdiction", { length: 30 }).notNull().default("uae"),
  /** Thematic domain for grouping in the UI */
  domain: varchar("domain", { length: 60 }).notNull(),
  decisionTypeAr: text("decision_type_ar").notNull(),
  decisionTypeEn: text("decision_type_en").notNull(),
  descriptionAr: text("description_ar"),
  /** Who must issue this decision: ministerial | director_general | department_head | hr_officer | any */
  requiredCompetenceLevel: varchar("required_competence_level", { length: 40 }).notNull().default("any"),
  /** Inherent legal risk of this decision type: low | medium | high | critical */
  inherentRiskLevel: varchar("inherent_risk_level", { length: 20 }).notNull().default("medium"),
  /** Array of { lawAr, lawEn, referenceNumber, articles } applicable to this decision type */
  applicableLaws: json("applicable_laws").$type<ApplicableLaw[]>().notNull().default([]),
  /** Base interview question nodes — Phase 2 extends with role-specific variants */
  interviewTemplate: json("interview_template").$type<InterviewQuestionNode[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Shared type definitions ───────────────────────────────────────────────────

export interface ApplicableLaw {
  lawAr: string;
  lawEn: string;
  referenceNumber: string;
  articles?: string[];
}

export type AnswerType = "chips" | "yes-no" | "text" | "number" | "date" | "multiselect";

/** Maps to one of the 12 Al-Shamsi dimensions */
export type DimensionTag =
  | "jurisdiction"
  | "form"
  | "cause"
  | "subjectMatter"
  | "purpose"
  | "humanWill"
  | "digitalWillFormation"
  | "algorithmicWeight"
  | "algorithmicBias"
  | "explainability"
  | "humanOversight"
  | "judicialReviewReadiness";

export interface QuestionOption {
  value: string;
  labelAr: string;
  labelEn: string;
}

export interface InterviewQuestionNode {
  id: string;
  /** Which Al-Shamsi dimension this question feeds */
  dimensionTag: DimensionTag;
  questionAr: string;
  questionEn: string;
  hintAr?: string;
  answerType: AnswerType;
  options?: QuestionOption[];
  placeholder?: string;
  unit?: string;
  required: boolean;
  /** Show only when a prior question's answer matches this condition */
  conditionalOn?: { questionId: string; value: string };
}

export type AdminDecisionType = typeof adminDecisionTypesTable.$inferSelect;
