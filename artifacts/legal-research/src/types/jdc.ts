/**
 * JDC — Judicial Deliberation Chamber shared TypeScript types.
 * These must stay in sync with:
 *   artifacts/api-server/src/utils/judicial-deliberation-chamber.ts
 */

import type {
  JreLegislationItem,
  JrePrecedentItem,
  JrePrinciple,
  JreProportionality,
  JreAiDimensionFinding,
  JreAuthorityEntry,
  JreVerificationStatus,
  JreStageTheory,
} from "@/types/jre";

export type PanelSize       = 1 | 3 | 5;
export type DisposalPosition = "grant" | "dismiss" | "remand" | "conditional";
export type OpinionType     = "majority" | "concurring" | "dissenting";

export interface JudgeAnalysis {
  judgeId:  number;
  nameAr:   string;
  nameEn:   string;
  role:     "presiding" | "associate";

  jurisdictionFinding: {
    hasJurisdiction:      boolean;
    reasoning:            string;
    admissible:           boolean;
    admissibilityGrounds: string;
  };
  applicableLegislation: JreLegislationItem[];
  precedents:            JrePrecedentItem[];
  principles:            JrePrinciple[];
  proportionality:       JreProportionality;
  aiDecisionAnalysis:    { dimensions: JreAiDimensionFinding[]; overallNote: string } | null;
  /** @deprecated Use stageTheory for sessions created after the inline-theory refactor. */
  theoryNote:   string | null;
  /** Inline per-stage theory — populated when a theory lens is active. */
  stageTheory:  JreStageTheory[] | null;

  legalityAssessment: { score: number; findingAr: string };
  disposalPosition:   DisposalPosition;
  holding:            string;
  holdingEn:          string;
  reasons:            string;
  opinionType:        OpinionType | null;

  verificationStatus: JreVerificationStatus;
}

export interface PanelDeliberation {
  panelSize:  PanelSize;
  judges:     JudgeAnalysis[];

  majorityPosition:   DisposalPosition;
  majorityJudgeIds:   number[];
  dissentingJudgeIds: number[];
  concurringJudgeIds: number[];

  majorityOpinionAr:  string;
  majorityOpinionEn:  string;
  majorityReasonsAr:  string;
  majorityReasonsEn:  string;

  dissentingOpinionAr: string | null;
  dissentingOpinionEn: string | null;
  concurringOpinionAr: string | null;
  concurringOpinionEn: string | null;

  finalHoldingAr:   string;
  finalHoldingEn:   string;
  operativeOrderAr: string;
  operativeOrderEn: string;

  authorityHierarchy: JreAuthorityEntry[];

  verificationReport: {
    totalVerified:          number;
    totalFabricated:        number;
    allAuthoritiesVerified: boolean;
    perJudge: Array<{ judgeId: number; verified: number; fabricated: number }>;
    overallMessage: string;
  };

  legalityScore?: number;
  riskScore?:     number;
}

export interface JdcChamber {
  id:               number;
  userId:           number;
  title:            string;
  panelSize:        PanelSize;
  disputeType:      string;
  disputeSummary:   string;
  parties: {
    applicant:    string;
    respondent:   string;
    applicantAr:  string;
    respondentAr: string;
  };
  hasAiDecision:   string;
  theoryLensId:    string | null;
  status:          "deliberating" | "complete" | "error";
  deliberation:    PanelDeliberation | null;
  legalityScore:   number | null;
  riskScore:       number | null;
  createdAt:       string;
  updatedAt:       string;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const PANEL_SIZE_CONFIG: Record<PanelSize, { labelAr: string; labelEn: string; color: string; description: string }> = {
  1: {
    labelAr:     "قاضٍ فرد",
    labelEn:     "Single Judge",
    color:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    description: "قاضٍ إداري واحد يُصدر الحكم بصفة منفردة",
  },
  3: {
    labelAr:     "دائرة ثلاثية",
    labelEn:     "3-Judge Panel",
    color:       "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    description: "دائرة مؤلفة من ثلاثة قضاة — الأغلبية تحتاج إلى صوتين",
  },
  5: {
    labelAr:     "دائرة خماسية",
    labelEn:     "5-Judge Panel",
    color:       "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    description: "دائرة موسعة من خمسة قضاة — الأغلبية تحتاج إلى ثلاثة أصوات",
  },
};

export const DISPOSAL_POSITION_CONFIG: Record<DisposalPosition, { labelAr: string; labelEn: string; color: string; icon: string }> = {
  grant:       { labelAr: "قبول الطعن",         labelEn: "Grant",       color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: "✓" },
  dismiss:     { labelAr: "رفض الطعن",          labelEn: "Dismiss",     color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",                 icon: "✗" },
  remand:      { labelAr: "إعادة الإحالة",      labelEn: "Remand",      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",     icon: "↩" },
  conditional: { labelAr: "قبول مشروط",         labelEn: "Conditional", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",         icon: "⚑" },
};

export const OPINION_TYPE_CONFIG: Record<OpinionType, { labelAr: string; labelEn: string; color: string }> = {
  majority:   { labelAr: "رأي الأغلبية",        labelEn: "Majority Opinion",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  concurring: { labelAr: "رأي موافق",           labelEn: "Concurring Opinion", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  dissenting: { labelAr: "رأي مخالف",           labelEn: "Dissenting Opinion", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export const STATUS_CONFIG: Record<string, { labelAr: string; color: string }> = {
  deliberating: { labelAr: "جارٍ التداول",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  complete:     { labelAr: "مكتمل",          color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  error:        { labelAr: "خطأ",            color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};
