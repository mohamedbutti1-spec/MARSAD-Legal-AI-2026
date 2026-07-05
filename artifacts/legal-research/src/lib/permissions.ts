/**
 * MARSAD Governance RBAC Permission Matrix
 * ─────────────────────────────────────────
 * Pure constants file — no drizzle / pg imports.
 * Safe to import from both the API server and the Vite frontend.
 *
 * Every governance endpoint reads from this matrix.
 * Every UI component reads from this matrix.
 * A role NOT in this file has zero permissions.
 */

// ─── Role Taxonomy ────────────────────────────────────────────────────────────

/** Legacy platform roles */
export type LegacyRole = 'owner' | 'supervisor' | 'viewer';

/** Phase 2 governance roles */
export type GovernanceRole =
  | 'minister'
  | 'undersecretary'
  | 'assistant_undersecretary'
  | 'director_general'
  | 'department_director'
  | 'legal_department'
  | 'constitutional_reviewer'
  | 'internal_auditor'
  | 'external_auditor'
  | 'judge'
  | 'citizen';

export type UserRole = LegacyRole | GovernanceRole;

export const ALL_ROLES: UserRole[] = [
  'owner', 'supervisor', 'viewer',
  'minister', 'undersecretary', 'assistant_undersecretary',
  'director_general', 'department_director', 'legal_department',
  'constitutional_reviewer', 'internal_auditor', 'external_auditor',
  'judge', 'citizen',
];

export const GOVERNANCE_ROLES: GovernanceRole[] = [
  'minister', 'undersecretary', 'assistant_undersecretary',
  'director_general', 'department_director', 'legal_department',
  'constitutional_reviewer', 'internal_auditor', 'external_auditor',
  'judge', 'citizen',
];

// ─── Permission Flags ─────────────────────────────────────────────────────────

export interface RolePermissions {
  // ── Decision read access ──────────────────────────────────────────────────
  /** Can see the list of decisions (governance list endpoint) */
  canReadDecisionList: boolean;
  /** Can open a decision detail */
  canReadDecisionDetail: boolean;
  /** Can see individual stage form data */
  canReadStageData: boolean;
  /** Can see AI analysis text within stages */
  canReadAiAnalysis: boolean;

  // ── Artifact access ───────────────────────────────────────────────────────
  /** Judicial Defense Package — litigation strategy artifact */
  canReadJdp: boolean;
  /** Decision Constitutional Identity — constitutional passport */
  canReadDci: boolean;
  /** Constitutional Answer Record — citizen-facing transparency doc */
  canReadCar: boolean;

  // ── Audit & integrity ─────────────────────────────────────────────────────
  /** Complete platform audit log */
  canReadAuditLog: boolean;
  /** Per-stage SHA-256 audit hashes */
  canReadAuditHashes: boolean;
  /** Full QVA raw run results array */
  canReadQvaRaw: boolean;
  /** HII + AI Actual Influence fields */
  canReadHii: boolean;
  /** Constitutional gate results (Stage 9 principle pass/fail) */
  canReadConstitutionalGates: boolean;

  // ── Write actions ─────────────────────────────────────────────────────────
  /** Undersecretary: flag a decision for mandatory review */
  canDelegateDecision: boolean;
  /** External auditor: trigger fresh hash computation + comparison */
  canRunHashVerification: boolean;

  // ── Special scoping rules ─────────────────────────────────────────────────
  /** If true, governance decisions endpoint filters by x-user-org header */
  seeOwnOrgOnly: boolean;
  /** If true, only sealed decisions are visible */
  sealedOnly: boolean;
  /** Citizen: can look up a CAR by case number (no other access) */
  canSearchByCaseNumber: boolean;

  // ── Replay access ─────────────────────────────────────────────────────────
  /** Step through the 14-stage decision replay audit trail */
  canReplayDecision: boolean;

  // ── Dashboard display ─────────────────────────────────────────────────────
  /** Access the governance hub (/governance) */
  canViewGovernanceDashboard: boolean;

  // ── NRME — National Risk Modeling Engine ──────────────────────────────────
  /** Read the risk assessment (15 indices + 3 aggregates) for a decision */
  canReadRiskAssessment: boolean;
  /** Add, edit, or delete risk treatment (mitigation) actions */
  canWriteRiskTreatment: boolean;
  /** Trigger a full AI recalculation of risk indices */
  canRecalculateRisk: boolean;
  /** Access the NRME executive dashboard at /risk-engine */
  canViewRiskDashboard: boolean;

  // ── CIL — Constitutional Intelligence Layer (Phase 42) ────────────────────
  /** Read a constitutional assessment (12 principles + 6 scores) for a decision */
  canReadConstitutionalAssessment: boolean;
  /** Trigger or re-run a CIL assessment (AI-powered) */
  canRunCilAssessment: boolean;
  /** Acknowledge / review constitutional warnings */
  canAcknowledgeCilWarnings: boolean;
  /** Access the Constitutional Intelligence Dashboard at /constitutional-intelligence */
  canViewCilDashboard: boolean;

  // ── NAIP — National Administrative Intelligence Platform (Phase 43) ────────
  /** Access the unified NAIP executive homepage and all NAIP dashboards */
  canViewNaipDashboard: boolean;
  /** Access global search across all modules (decisions, risk, CIL, replay) */
  canViewNaipSearch: boolean;
}

// ─── Permission Matrix ────────────────────────────────────────────────────────

export const PERMISSIONS: Record<UserRole, RolePermissions> = {

  // ── Legacy roles (full platform access) ───────────────────────────────────
  owner: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: true, canReadDci: true, canReadCar: true,
    canReadAuditLog: true, canReadAuditHashes: true,
    canReadQvaRaw: true, canReadHii: true, canReadConstitutionalGates: true,
    canDelegateDecision: true, canRunHashVerification: true,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: true, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: true,
    canRecalculateRisk: true, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: true,
    canAcknowledgeCilWarnings: true, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },
  supervisor: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: true, canReadDci: true, canReadCar: true,
    canReadAuditLog: true, canReadAuditHashes: true,
    canReadQvaRaw: true, canReadHii: true, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: true, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: true,
    canRecalculateRisk: true, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: true,
    canAcknowledgeCilWarnings: true, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },
  viewer: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: false, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: false,
    canReadConstitutionalAssessment: false, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: false,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 1. Minister — executive summary only ──────────────────────────────────
  minister: {
    canReadDecisionList: true, canReadDecisionDetail: false,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: false, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: false,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 2. Undersecretary — decisions + delegation ────────────────────────────
  undersecretary: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: true, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: true, canReadConstitutionalGates: false,
    canDelegateDecision: true, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: true,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 3. Assistant Undersecretary — full stages + JDP, no CAR/audit ─────────
  assistant_undersecretary: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: true, canReadDci: true, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: true,
    canRecalculateRisk: true, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: true,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 4. Director General — org-scoped, constitutional gates only ───────────
  director_general: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: true, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: true, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: true,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 5. Department Director — own dept, stage status only ─────────────────
  department_director: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: false, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: true, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: true,
    canRecalculateRisk: false, canViewRiskDashboard: false,
    canReadConstitutionalAssessment: false, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: false,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 6. Legal Department — legal basis + full JDP ─────────────────────────
  legal_department: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: false,
    canReadJdp: true, canReadDci: true, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: true,
    canRecalculateRisk: true, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: true,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 7. Constitutional Reviewer — all constitutional data + JDP + QVA/LSI ──
  constitutional_reviewer: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: false,
    canReadJdp: true, canReadDci: true, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: true, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: true, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: true,
    canAcknowledgeCilWarnings: true, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 8. Internal Auditor — full read, no JDP strategy ─────────────────────
  internal_auditor: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: false, canReadDci: true, canReadCar: false,
    canReadAuditLog: true, canReadAuditHashes: true,
    canReadQvaRaw: false, canReadHii: true, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 9. External Auditor — sealed decisions only + hash verification ───────
  external_auditor: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: true, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: true,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: true,
    seeOwnOrgOnly: false, sealedOnly: true,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 10. Judge — complete record except QVA raw ────────────────────────────
  judge: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: true, canReadDci: true, canReadCar: true,
    canReadAuditLog: true, canReadAuditHashes: true,
    canReadQvaRaw: false, canReadHii: true, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: true, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: true, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
  },

  // ── 11. Citizen — CAR lookup by case number only ──────────────────────────
  citizen: {
    canReadDecisionList: false, canReadDecisionDetail: false,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: false, canReadCar: true,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: true,
    canSearchByCaseNumber: true, canViewGovernanceDashboard: false,
    canReplayDecision: false,
    canReadRiskAssessment: false, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: false,
    canReadConstitutionalAssessment: false, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: false,
    canViewNaipDashboard: false, canViewNaipSearch: false,
  },
};

/** Convenience: get permissions for a role (safe fallback to citizen) */
export function getPermissions(role: string): RolePermissions {
  return PERMISSIONS[role as UserRole] ?? PERMISSIONS.citizen;
}

/** Role display metadata */
export const ROLE_META: Record<UserRole, { ar: string; en: string; tier: 'legacy' | 'executive' | 'oversight' | 'judicial' | 'public' }> = {
  owner:                    { ar: 'مالك المنصة',          en: 'Platform Owner',          tier: 'legacy' },
  supervisor:               { ar: 'مشرف',                  en: 'Supervisor',               tier: 'legacy' },
  viewer:                   { ar: 'مشاهد',                 en: 'Viewer',                   tier: 'legacy' },
  minister:                 { ar: 'وزير',                  en: 'Minister',                 tier: 'executive' },
  undersecretary:           { ar: 'وكيل الوزارة',          en: 'Undersecretary',           tier: 'executive' },
  assistant_undersecretary: { ar: 'وكيل وزارة مساعد',     en: 'Asst. Undersecretary',     tier: 'executive' },
  director_general:         { ar: 'مدير عام',              en: 'Director General',         tier: 'executive' },
  department_director:      { ar: 'مدير الإدارة',          en: 'Department Director',      tier: 'executive' },
  legal_department:         { ar: 'الإدارة القانونية',     en: 'Legal Department',         tier: 'oversight' },
  constitutional_reviewer:  { ar: 'المراجع الدستوري',      en: 'Constitutional Reviewer',  tier: 'oversight' },
  internal_auditor:         { ar: 'المدقق الداخلي',        en: 'Internal Auditor',         tier: 'oversight' },
  external_auditor:         { ar: 'المدقق الخارجي',        en: 'External Auditor',         tier: 'oversight' },
  judge:                    { ar: 'القاضي',                en: 'Judge',                    tier: 'judicial' },
  citizen:                  { ar: 'المواطن / الطرف المتأثر', en: 'Citizen / Affected Party', tier: 'public' },
};
