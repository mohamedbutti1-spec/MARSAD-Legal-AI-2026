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

/**
 * Access-tier roles (added for the Production RBAC system).
 * These are NOT governance seats — they carry no place in the 14-role
 * governance decision lifecycle and must never be added to GOVERNANCE_ROLES.
 *
 * - admin: platform operator. Manages users and can view (read-only) all
 *   operational pages, but cannot manage system settings, API keys, the
 *   owner panel, or Al-Shamsi/experimental surfaces — those stay owner-only.
 * - professional_user: non-governance-seat account for outside professionals.
 *   Access to research tools, the AI assistant, legal forms (PGF), and file
 *   upload — no governance dashboards, no org scoping, no decision writes.
 */
export type AccessTierRole = 'admin' | 'professional_user';

/**
 * Legal-professional / academic / demo roles (added to map MARSAD's legal
 * workflows onto the Production RBAC system).
 *
 * Like admin/professional_user, none of these are governance seats — they
 * are NOT added to GOVERNANCE_ROLES and carry no place in the frozen 14-role
 * governance decision lifecycle.
 *
 * - prosecutor: investigation and prosecution outputs — governance-read
 *   access (decision list/detail/stages, JDP litigation-strategy artifact,
 *   DCI, constitutional gates) plus case-number search and uploads, but no
 *   audit log, no CAR, no settings/user management.
 * - lawyer: legal memoranda and appeals — same governance-read shape as
 *   prosecutor plus CAR (referenced when drafting an appeal).
 * - researcher: comparative studies and academic outputs — broad read
 *   access restricted to sealed (finalized) decisions only; no JDP
 *   (litigation strategy is not an academic concern), no write actions.
 * - student: educational simulations only — zero access to real decision
 *   data or governance dashboards. Granted access to the Professional Case
 *   Simulator (PCS) ONLY, via a dedicated middleware in pcs.ts (not via
 *   requireAnyRole/requireOperationalRole, which stay scoped to real data).
 * - guest: restricted public demo access — same shape as citizen minus CAR
 *   lookup; sees only the always-public reference pages.
 */
export type LegalProfessionalRole = 'prosecutor' | 'lawyer' | 'researcher' | 'student' | 'guest';

export type UserRole = LegacyRole | GovernanceRole | AccessTierRole | LegalProfessionalRole;

export const ALL_ROLES: UserRole[] = [
  'owner', 'supervisor', 'viewer',
  'minister', 'undersecretary', 'assistant_undersecretary',
  'director_general', 'department_director', 'legal_department',
  'constitutional_reviewer', 'internal_auditor', 'external_auditor',
  'judge', 'citizen',
  'admin', 'professional_user',
  'prosecutor', 'lawyer', 'researcher', 'student', 'guest',
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

  // ── JDT — Judicial Digital Twin (Phase 44) ────────────────────────────────
  /** Read Judicial Digital Twin simulations for decisions */
  canViewJdtSimulation: boolean;
  /** Trigger a new JDT simulation (AI-powered judicial review simulation) */
  canRunJdtSimulation: boolean;
  /** Owner-only: Al-Shamsi Theory / Framework (admin-os, court simulation, shamsi-analysis, dimension displays) */
  canUseShamsiFramework: boolean;

  // ── Legacy convenience flags (mirror the frontend's former hardcoded
  //    role === 'owner' / 'supervisor' checks; now matrix-driven so new
  //    access-tier roles can be scoped without touching every call site) ──
  /** Upload documents */
  canUpload: boolean;
  /** Create a new Module 1 administrative decision */
  canCreateDecision: boolean;
  /** Use any AI-powered feature (assistant, JRE, PGF, etc.) */
  canUseAi: boolean;
  /** Access the User Management admin page and its API */
  canManageUsers: boolean;
  /** Access the Settings page (AI provider keys, system toggles, upload limits) */
  canManageSettings: boolean;
  /** Post comments */
  canComment: boolean;

  // ── Sensitive admin-only surfaces — owner-only, never granted to
  //    admin/professional_user regardless of canManageUsers ─────────────────
  /** Manage AI provider API keys */
  canManageApiKeys: boolean;
  /** Access the owner panel (admin-os) */
  canAccessOwnerPanel: boolean;
  /** Access experimental/secret sections (Al-Shamsi, etc.) */
  canAccessSecretSections: boolean;
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
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: true,
    canUpload: true, canCreateDecision: true, canUseAi: true,
    canManageUsers: true, canManageSettings: true, canComment: true,
    canManageApiKeys: true, canAccessOwnerPanel: true, canAccessSecretSections: true,
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
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: true, canCreateDecision: true, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: true,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: false, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canReplayDecision: false,  // Ministers see executive summary + dashboard only; full replay is operational detail
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: false, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
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
    canViewJdtSimulation: false, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: false,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },

  // ── 12. Admin — platform operator: manages users, broad read access ──────
  // NOT a governance seat (excluded from GOVERNANCE_ROLES). Cannot manage
  // settings/API keys, cannot access the owner panel or Al-Shamsi framework.
  admin: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: true, canReadDci: true, canReadCar: true,
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
    canViewJdtSimulation: true, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: true,
    canManageUsers: true, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },

  // ── 13. Professional User — outside-professional account: research tools,
  //        AI assistant, legal forms (PGF), file upload. No governance access.
  professional_user: {
    canReadDecisionList: false, canReadDecisionDetail: false,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: false, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: false,
    canReplayDecision: false,
    canReadRiskAssessment: false, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: false,
    canReadConstitutionalAssessment: false, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: false,
    canViewNaipDashboard: false, canViewNaipSearch: false,
    canViewJdtSimulation: false, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: true, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },

  // ── 14. Prosecutor — investigation and prosecution outputs ────────────────
  // Governance-read professional: decision record, litigation-strategy (JDP),
  // constitutional gates, case-number search. No audit log, no CAR, no
  // settings/user management.
  prosecutor: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: true, canReadDci: true, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: true, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: true, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: true,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },

  // ── 15. Lawyer — legal memoranda and appeals ───────────────────────────────
  // Same governance-read shape as prosecutor, plus CAR (the citizen-facing
  // transparency record referenced when drafting an appeal).
  lawyer: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: true, canReadDci: true, canReadCar: true,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: true,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: true, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
    canViewJdtSimulation: true, canRunJdtSimulation: true, canUseShamsiFramework: false,
    canUpload: true, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: true,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },

  // ── 16. Researcher — comparative studies and academic outputs ─────────────
  // Broad read access, restricted to sealed (finalized) decisions only — no
  // litigation-strategy (JDP) or write actions; purely academic study.
  researcher: {
    canReadDecisionList: true, canReadDecisionDetail: true,
    canReadStageData: true, canReadAiAnalysis: true,
    canReadJdp: false, canReadDci: true, canReadCar: true,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: true,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: true,
    canReplayDecision: true,
    canReadRiskAssessment: true, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: true,
    canReadConstitutionalAssessment: true, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: true,
    canViewNaipDashboard: true, canViewNaipSearch: true,
    canViewJdtSimulation: true, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: true, canCreateDecision: false, canUseAi: true,
    canManageUsers: false, canManageSettings: false, canComment: true,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },

  // ── 17. Student — educational simulations only ────────────────────────────
  // No access to real decision/governance data whatsoever. Access to the
  // Professional Case Simulator (synthetic scenarios, no real case data) is
  // granted via a dedicated role check in pcs.ts, not through any flag here.
  student: {
    canReadDecisionList: false, canReadDecisionDetail: false,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: false, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: false,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: false,
    canReplayDecision: false,
    canReadRiskAssessment: false, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: false,
    canReadConstitutionalAssessment: false, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: false,
    canViewNaipDashboard: false, canViewNaipSearch: false,
    canViewJdtSimulation: false, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: false,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },

  // ── 18. Guest — restricted public demo access ──────────────────────────────
  // Same shape as citizen minus CAR lookup; sees only the always-public
  // reference pages. Distinct from the password-less "Guest Login" flow
  // (which signs into the permanent Reviewer/viewer account) — this role is
  // for genuinely new, unauthenticated-adjacent demo accounts.
  guest: {
    canReadDecisionList: false, canReadDecisionDetail: false,
    canReadStageData: false, canReadAiAnalysis: false,
    canReadJdp: false, canReadDci: false, canReadCar: false,
    canReadAuditLog: false, canReadAuditHashes: false,
    canReadQvaRaw: false, canReadHii: false, canReadConstitutionalGates: false,
    canDelegateDecision: false, canRunHashVerification: false,
    seeOwnOrgOnly: false, sealedOnly: true,
    canSearchByCaseNumber: false, canViewGovernanceDashboard: false,
    canReplayDecision: false,
    canReadRiskAssessment: false, canWriteRiskTreatment: false,
    canRecalculateRisk: false, canViewRiskDashboard: false,
    canReadConstitutionalAssessment: false, canRunCilAssessment: false,
    canAcknowledgeCilWarnings: false, canViewCilDashboard: false,
    canViewNaipDashboard: false, canViewNaipSearch: false,
    canViewJdtSimulation: false, canRunJdtSimulation: false, canUseShamsiFramework: false,
    canUpload: false, canCreateDecision: false, canUseAi: false,
    canManageUsers: false, canManageSettings: false, canComment: false,
    canManageApiKeys: false, canAccessOwnerPanel: false, canAccessSecretSections: false,
  },
};

/**
 * Mutable in-memory cache, seeded from the constants above.
 *
 * At boot, the API server loads role_permissions rows from the database and
 * calls setPermissionsCache() to overlay them here — this file stays a pure
 * constants module (no drizzle/pg imports, safe for the Vite frontend), while
 * the actual source of truth for the running server becomes the DB. Every
 * lookup (getPermissions) reads from this cache, never the DB, so there is
 * no per-request query latency.
 */
let permissionsCache: Record<string, RolePermissions> = { ...PERMISSIONS };

/** Convenience: get permissions for a role (safe fallback to citizen) */
export function getPermissions(role: string): RolePermissions {
  return permissionsCache[role] ?? permissionsCache.citizen ?? PERMISSIONS.citizen;
}

/**
 * Replace the in-memory permissions cache wholesale (called by the API
 * server's rbac-service after loading role_permissions from the database,
 * and again whenever an admin edits a role's permissions).
 */
export function setPermissionsCache(next: Record<string, RolePermissions>): void {
  permissionsCache = { ...next };
}

/** Read-only snapshot of the current cache (used by admin UIs / debugging). */
export function getPermissionsCacheSnapshot(): Record<string, RolePermissions> {
  return { ...permissionsCache };
}

/**
 * True if `role` is either a built-in role (in ALL_ROLES) or a custom role an
 * owner created via the Role Permissions UI (present in the DB-backed cache
 * once loadPermissionsFromDb() has run). Used by requireRole()'s session-token
 * sanity check so custom roles aren't universally rejected as "invalid" —
 * they just don't automatically appear in any specific requireRole(...) or
 * requireAnyRole/requireWriteRole allowlist unless a developer adds them.
 */
export function isKnownRole(role: string): boolean {
  return Object.prototype.hasOwnProperty.call(permissionsCache, role);
}

/** All permission flag keys, derived at runtime (used to seed the `permissions` table). */
export const PERMISSION_KEYS: (keyof RolePermissions)[] =
  Object.keys(PERMISSIONS.owner) as (keyof RolePermissions)[];

/** Role display metadata */
export const ROLE_META: Record<UserRole, { ar: string; en: string; tier: 'legacy' | 'executive' | 'oversight' | 'judicial' | 'public' | 'access-tier' | 'legal-professional' | 'academic' | 'demo' }> = {
  owner:                    { ar: 'مالك المنصة',          en: 'Owner',                    tier: 'legacy' },
  supervisor:               { ar: 'مشرف',                  en: 'Supervisor',               tier: 'legacy' },
  viewer:                   { ar: 'مراجع',                 en: 'Reviewer',                 tier: 'legacy' },
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
  citizen:                  { ar: 'المستخدم العام',        en: 'Public User',              tier: 'public' },
  admin:                    { ar: 'مسؤول النظام',          en: 'Admin',                    tier: 'access-tier' },
  professional_user:        { ar: 'مستخدم تنفيذي',        en: 'Executive User',           tier: 'access-tier' },
  prosecutor:               { ar: 'النيابة العامة',        en: 'Prosecutor',               tier: 'legal-professional' },
  lawyer:                   { ar: 'محامٍ',                 en: 'Lawyer',                   tier: 'legal-professional' },
  researcher:               { ar: 'باحث',                  en: 'Researcher',               tier: 'academic' },
  student:                  { ar: 'طالب',                  en: 'Student',                  tier: 'academic' },
  guest:                    { ar: 'زائر',                  en: 'Guest',                    tier: 'demo' },
};
