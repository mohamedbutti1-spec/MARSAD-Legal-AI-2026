import { pgTable, text, serial, timestamp, varchar, json } from "drizzle-orm/pg-core";

/**
 * Al-Shamsi 7 Role Profiles — Phase 2
 *
 * Each row defines one of the seven roles recognised by Al-Shamsi Theory,
 * along with their legal competence ceiling, permitted decision domains,
 * and role-specific interview modifiers that are merged with a base template
 * at query time by buildInterviewTemplate().
 */
export const adminDecisionRolesTable = pgTable("admin_decision_roles", {
  id: serial("id").primaryKey(),
  /** Stable machine key — matches VALID_ROLES in admin-os-evaluator.ts */
  roleKey: varchar("role_key", { length: 50 }).notNull().unique(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  /**
   * Highest competence level this role holds for decision issuance.
   * Hierarchy (descending): ministerial > director_general > department_head
   *                          > hr_officer > any
   * Special values: review_only (legal/court), judicial_review (court), challenge_only (citizen)
   */
  competenceCeiling: varchar("competence_ceiling", { length: 40 }).notNull(),
  /**
   * Decision domains this role is permitted to act in.
   * JSON array of domain strings, or ["all"] to mean every domain.
   */
  permittedDomains: json("permitted_domains").$type<string[]>().notNull().default([]),
  /**
   * Nature of involvement for each domain action.
   * { can_issue: boolean, can_review: boolean, can_challenge: boolean }
   */
  actionCapabilities: json("action_capabilities").$type<RoleActionCapabilities>().notNull(),
  /**
   * Per-jurisdiction authority chain metadata for the prompt.
   * { uae: { federalAuthority: boolean, legalBasis: string } }
   */
  jurisdictionScope: json("jurisdiction_scope").$type<Record<string, JurisdictionScopeEntry>>().notNull().default({}),
  /** Preferred interview/UI language: ar | en | bilingual */
  preferredLanguage: varchar("preferred_language", { length: 12 }).notNull().default("ar"),
  /**
   * Interview template modifiers — merged with base template at runtime.
   * See InterviewModifiers interface below.
   */
  interviewModifiers: json("interview_modifiers").$type<InterviewModifiers>().notNull().default({}),
  /** Plain-text summary of this role's legal basis (for prompt injection) */
  legalBasisAr: text("legal_basis_ar").notNull(),
  legalBasisEn: text("legal_basis_en").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Type definitions ───────────────────────────────────────────────────────────

export interface RoleActionCapabilities {
  /** Whether this role can issue/originate administrative decisions */
  canIssue: boolean;
  /** Whether this role can review decisions for compliance */
  canReview: boolean;
  /** Whether this role can challenge/appeal decisions */
  canChallenge: boolean;
}

export interface JurisdictionScopeEntry {
  /** True if role acts at federal (national) level */
  federalAuthority: boolean;
  /** True if role acts at emirate/local level */
  emirateAuthority: boolean;
  /** Short legal basis text for this jurisdiction */
  legalBasis: string;
}

export interface InterviewModifierOverride {
  questionId: string;
  questionAr?: string;
  questionEn?: string;
  hintAr?: string;
  required?: boolean;
}

export interface InterviewModifiers {
  /** Questions added before the base template */
  prependQuestions?: import("./admin-decision-types").InterviewQuestionNode[];
  /** Questions added after the base template */
  appendQuestions?: import("./admin-decision-types").InterviewQuestionNode[];
  /** Override specific question fields by question ID */
  overrides?: InterviewModifierOverride[];
  /** Question IDs to remove from the base template */
  removeQuestions?: string[];
}

export type AdminDecisionRole = typeof adminDecisionRolesTable.$inferSelect;
