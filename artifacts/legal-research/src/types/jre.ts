/**
 * JRE — Judicial Reasoning Engine shared TypeScript types.
 * These must stay in sync with the types defined in:
 *   artifacts/api-server/src/utils/judicial-reasoning-engine.ts
 */

export interface JreParties {
  applicant:    string;
  respondent:   string;
  applicantAr:  string;
  respondentAr: string;
}

export interface JreLegislationItem {
  titleAr:          string;
  documentNumber:   string | null;
  year:             number | null;
  relevantArticles: string[];
  authorityClass:   "binding" | "persuasive";
  hierarchyLevel:   string;
  ragTag:           string | null;
  isAmended:        boolean;
  amendedBy?:       string;
}

export interface JrePrecedentItem {
  caseRef:        string;
  court:          string;
  year:           string;
  principleAr:    string;
  relevance:      string;
  authorityClass: "binding" | "persuasive";
  ragTag:         string | null;
}

export interface JrePrinciple {
  nameAr:         string;
  nameEn:         string;
  applicationAr:  string;
  legalBasis:     string;
  authorityClass: "binding" | "persuasive";
}

export interface JreProportionality {
  applicable:         boolean;
  legitimateAim:      string | null;
  necessity:          { finding: string; compliant: boolean } | null;
  proportionalitySS: { finding: string; compliant: boolean } | null;
  overallFinding:     "proportionate" | "disproportionate" | "not_applicable";
}

export interface JreAiDimensionFinding {
  dimension:   string;
  dimensionAr: string;
  finding:     string;
  compliant:   boolean;
  basis:       string;
}

export interface JreAiDecisionReview {
  applicable:  boolean;
  dimensions:  JreAiDimensionFinding[] | null;
  overallNote: string | null;
}

export interface JreTheoryAnalysis {
  applied:     boolean;
  lensName:    string | null;
  analysisAr:  string | null;
  disclaimer:  string;
}

/**
 * Per-stage inline theory — one object per major analytical stage.
 * UAE binding analysis is always listed first; theory is non-binding.
 */
export interface JreStageTheory {
  stageId:   "legislation" | "precedents" | "principles" | "proportionality" | "ai_review";
  stageNameAr: string;
  uaeBindingAnalysis: string;
  theoryLensAnalysis: string | null;
  frenchComparative:  string | null;
  agreement:  string;
  difference: string;
  addedValue: string;
  disclaimer: string;
}

export interface JreAuthorityEntry {
  rank:           number;
  authorityClass: "binding" | "persuasive" | "non_binding";
  titleAr:        string;
  hierarchyLevel: string;
  ragTag:         string | null;
  role:           "primary" | "supporting" | "contextual";
}

export interface JreVerificationStatus {
  allAuthoritiesVerified:      boolean;
  verifiedCount:               number;
  unverifiedCount:             number;
  fabricatedCitationsFiltered: number;
  message:                     string;
}

export interface JudgmentOutput {
  caseTitle: string;

  facts: {
    summary:             string;
    keyFacts:            Array<{ factAr: string; significance: string }>;
    applicant:           string;
    respondent:          string;
    applicantAr:         string;
    respondentAr:        string;
    disputeType:         string;
    hasAiSystemInvolved: boolean;
  };

  legalIssues: Array<{
    issueAr:        string;
    issueEn:        string;
    classification: "procedural" | "substantive" | "competence" | "form" | "proportionality";
  }>;

  legislation:      JreLegislationItem[];
  precedents:       JrePrecedentItem[];
  principles:       JrePrinciple[];
  proportionality:  JreProportionality;
  aiDecisionReview: JreAiDecisionReview;
  theoryAnalysis:   JreTheoryAnalysis;  // backward-compat derived field
  stageTheory:      JreStageTheory[];

  reasons:  string;
  holding:  string;
  order:    string;
  orderEn:  string;

  authorityHierarchy: JreAuthorityEntry[];
  verificationStatus: JreVerificationStatus;

  legalityScore?: number;
  riskScore?:     number;
}

export interface JreSession {
  id:              number;
  userId:          number;
  title:           string;
  disputeSummary:  string;
  parties:         JreParties;
  disputeType:     string;
  hasAiDecision:   string; // "true" | "false"
  theoryLensId:    string | null;
  theoryLensName:  string | null;
  customTheoryText: string | null;
  status:          "pending" | "analyzing" | "complete" | "error";
  stageData:       unknown | null;
  judgment:        JudgmentOutput | null;
  legalityScore:   number | null;
  riskScore:       number | null;
  createdAt:       string;
  updatedAt:       string;
}

// Dispute type display labels
export const DISPUTE_TYPE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  annulment:    { ar: 'إلغاء',         en: 'Annulment',       color: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive' },
  compensation: { ar: 'تعويض',         en: 'Compensation',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  disciplinary: { ar: 'تأديبي',        en: 'Disciplinary',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  licensing:    { ar: 'ترخيص',         en: 'Licensing',       color: 'bg-heading/15 text-heading dark:bg-heading/30 dark:text-heading' },
  procurement:  { ar: 'مناقصات',       en: 'Procurement',     color: 'bg-heading/15 text-heading dark:bg-heading/30 dark:text-heading' },
  civil_service:{ ar: 'وظيفة عامة',   en: 'Civil Service',   color: 'bg-heading/15 text-heading dark:bg-heading/30 dark:text-heading' },
  expropriation:{ ar: 'نزع ملكية',    en: 'Expropriation',   color: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive' },
  other:        { ar: 'أخرى',          en: 'Other',           color: 'bg-muted/60 text-muted-foreground dark:bg-card/30 dark:text-muted-foreground' },
};

export const THEORY_LENS_OPTIONS = [
  { value: '',                  label: 'القانون الإماراتي فقط (بدون تحليل نظري)' },
  { value: 'al_shamsi',        label: 'نظرية الشامسي للقرارات الإدارية' },
  { value: 'comparative_french', label: 'القانون الإداري الفرنسي المقارن' },
  { value: 'custom',           label: 'إطار نظري مخصص' },
];

/**
 * THEORY_LENS_OPTIONS filtered for the current user. Al-Shamsi Theory
 * ('al_shamsi') is owner-only — pass `canUseShamsiFramework` from
 * useUserContext() so non-owner roles never see it as a selectable option.
 * The server independently re-enforces this in sanitizeTheoryLensId, so this
 * is UI-level hiding, not the security boundary itself.
 */
export function getVisibleTheoryLensOptions(canUseShamsiFramework: boolean) {
  return canUseShamsiFramework
    ? THEORY_LENS_OPTIONS
    : THEORY_LENS_OPTIONS.filter((o) => o.value !== 'al_shamsi');
}
