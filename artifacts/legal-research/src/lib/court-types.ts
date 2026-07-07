// ─── Stage 5 — Smart Administrative Court Simulation types ───────────────────

export interface CourtFacts {
  summary: string;
  disputedDecision: string;
  parties: Array<{ role: string; name: string }>;
  requests: string[];
}

export interface CourtIssues {
  jurisdiction: string;
  form: string;
  cause: string;
  subject: string;
  purpose: string;
  proportionality: string;
  transparency: string;
  humanOversight: string;
  algorithmicEffect: string | null;
}

export interface CourtDefense {
  ground: string;
  argument: string;
  strength: 'قوي' | 'متوسط' | 'ضعيف';
}

export interface CourtCommissioner {
  facts: string;
  applicableLaw: string;
  defenseAnalysis: string;
  legalOpinion: string;
  recommendation: string;
}

export interface CourtShamsiPrinciple {
  id: string;
  nameAr: string;
  score: number;
  reason: string;
  legalRisk: string;
  recommendation: string;
}

export interface CourtJudgment {
  preamble: string;
  facts: string;
  courtView: string;
  established: string;
  challenged: string;
  ruling: string;
}

export interface CourtOperative {
  decision: string;
  cancellation: string;
  effect: string;
  adminObligation: string | null;
  reformRecommendations: string[];
}

export interface CourtAppeal {
  isAppealable: boolean;
  successChance: number;
  strongestGrounds: string[];
  weakestPoints: string[];
}

export interface CourtScores {
  legality: number;
  transparency: number;
  algorithmicExplainability: number;
  humanOversight: number;
  judicialRisk: number;
  annulmentProbability: number;
  shamsiIndex: number;
}

export interface SupremeCourtReview {
  firstInstance: string;
  appeal: string;
  cassation: string;
  frenchCouncil: string;
  europeanCourt: string | null;
  shamsiEval: string;
  finalComparison: string;
}

export interface CourtSessionData {
  caseText: string;
  facts?: CourtFacts;
  issues?: CourtIssues;
  claimantDefenses?: CourtDefense[];
  adminDefenses?: CourtDefense[];
  commissionerReport?: CourtCommissioner;
  shamsiAnalysis?: CourtShamsiPrinciple[];
  judgment?: CourtJudgment;
  operative?: CourtOperative;
  appeal?: CourtAppeal;
  scores?: CourtScores;
  model?: string;
  supremeReview?: SupremeCourtReview;
  supremeLoading?: boolean;
}
