/**
 * User context — backed by the verified JWT session (GET /api/auth/me).
 *
 * The role, userId, and org are sourced exclusively from the server-verified
 * JWT payload. There is no localStorage role selection in production.
 *
 * The context also exposes permission flags derived from the role so that
 * UI components can gate features without re-querying the server.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  type UserRole,
  type RolePermissions,
  type GovernanceRole,
  ALL_ROLES,
  GOVERNANCE_ROLES,
  ROLE_META,
  getPermissions,
} from '@/lib/permissions';
import { setAuthErrorHandler } from '@/lib/api-fetch';

export type { UserRole, GovernanceRole };
export type AppLanguage = 'ar' | 'en';

interface SessionPayload {
  userId: number;
  role: string;
  org: string;
  mustChangePassword: boolean;
}

export interface UserContextType {
  /** True once the session check has resolved (success or failure) */
  isLoaded: boolean;
  /** True when a valid JWT session exists */
  isAuthenticated: boolean;
  /** True when the user logged in with an admin-issued temporary password and must set their own before continuing */
  mustChangePassword: boolean;
  /**
   * True when the session was explicitly revoked from another device or by an
   * admin password reset. Used to show a targeted "signed out remotely" message
   * on the login screen instead of a generic unauthenticated state.
   */
  sessionRevoked: boolean;
  role: UserRole;
  userId: number;
  /** Organisation string for org-scoped roles; '' for others */
  userOrg: string;
  lang: AppLanguage;
  dir: 'rtl' | 'ltr';
  /** setLang persists the preference to localStorage */
  setLang: (lang: AppLanguage) => void;
  /** Trigger a re-fetch of the session (call after login/logout) */
  refreshSession: () => Promise<void>;
  permissions: RolePermissions;
  // ── Legacy permission booleans (backward compat) ──────────────────────────
  canUpload: boolean;
  canCreateDecision: boolean;
  canUseAi: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canComment: boolean;
  canViewAudit: boolean;
  // Governance
  isGovernanceRole: boolean;
  canViewGovernanceDashboard: boolean;
  // NRME
  canReadRiskAssessment: boolean;
  canWriteRiskTreatment: boolean;
  canRecalculateRisk: boolean;
  canViewRiskDashboard: boolean;
  // CIL
  canReadConstitutionalAssessment: boolean;
  canRunCilAssessment: boolean;
  canAcknowledgeCilWarnings: boolean;
  canViewCilDashboard: boolean;
  // NAIP
  canViewNaipDashboard: boolean;
  canViewNaipSearch: boolean;
  // JDT
  canViewJdtSimulation: boolean;
  canRunJdtSimulation: boolean;
  // Al-Shamsi Theory / Framework — owner-only, must not appear at all for other roles
  isOwner: boolean;
  canUseShamsiFramework: boolean;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface FetchSessionResult {
  payload: SessionPayload | null;
  revoked: boolean;
}

async function fetchSession(): Promise<FetchSessionResult> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      credentials: 'include',
    });
    if (!res.ok) {
      // Check whether the server explicitly revoked this session (password
      // version mismatch) vs. a regular unauthenticated / expired token.
      if (res.status === 401) {
        try {
          const body = await res.json() as { code?: string };
          if (body.code === 'SESSION_REVOKED') {
            return { payload: null, revoked: true };
          }
        } catch { /* non-JSON 401 */ }
      }
      return { payload: null, revoked: false };
    }
    return { payload: (await res.json()) as SessionPayload, revoked: false };
  } catch {
    return { payload: null, revoked: false };
  }
}

function buildContext(
  session: SessionPayload | null,
  lang: AppLanguage,
  sessionRevoked = false,
): UserContextType {
  const role = (
    session && ALL_ROLES.includes(session.role as UserRole) ? session.role : 'citizen'
  ) as UserRole;

  const userId  = session?.userId ?? -1;
  const userOrg = session?.org ?? '';
  const permissions = getPermissions(role);
  const isGovernanceRole = GOVERNANCE_ROLES.includes(role as GovernanceRole);

  return {
    isLoaded: true,
    isAuthenticated: session !== null,
    mustChangePassword: session?.mustChangePassword ?? false,
    sessionRevoked,
    role,
    userId,
    userOrg,
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    setLang: () => { /* handled by provider */ },
    refreshSession: async () => { /* handled by provider */ },
    permissions,
    canUpload: permissions.canUpload,
    canCreateDecision: permissions.canCreateDecision,
    canUseAi: permissions.canUseAi,
    canManageUsers: permissions.canManageUsers,
    canManageSettings: permissions.canManageSettings,
    canComment: permissions.canComment,
    canViewAudit: permissions.canReadAuditLog,
    isGovernanceRole,
    canViewGovernanceDashboard:      permissions.canViewGovernanceDashboard,
    canReadRiskAssessment:           permissions.canReadRiskAssessment           ?? false,
    canWriteRiskTreatment:           permissions.canWriteRiskTreatment           ?? false,
    canRecalculateRisk:              permissions.canRecalculateRisk              ?? false,
    canViewRiskDashboard:            permissions.canViewRiskDashboard            ?? false,
    canReadConstitutionalAssessment: permissions.canReadConstitutionalAssessment ?? false,
    canRunCilAssessment:             permissions.canRunCilAssessment             ?? false,
    canAcknowledgeCilWarnings:       permissions.canAcknowledgeCilWarnings       ?? false,
    canViewCilDashboard:             permissions.canViewCilDashboard             ?? false,
    canViewNaipDashboard:            permissions.canViewNaipDashboard            ?? false,
    canViewNaipSearch:               permissions.canViewNaipSearch               ?? false,
    canViewJdtSimulation:            permissions.canViewJdtSimulation            ?? false,
    canRunJdtSimulation:             permissions.canRunJdtSimulation             ?? false,
    isOwner:                         role === 'owner',
    canUseShamsiFramework:           permissions.canUseShamsiFramework           ?? false,
  };
}

const DEFAULT_LANG: AppLanguage = 'ar';

const UserContext = createContext<UserContextType>({
  ...buildContext(null, DEFAULT_LANG),
  isLoaded: false,
  sessionRevoked: false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]         = useState<SessionPayload | null>(null);
  const [isLoaded, setIsLoaded]       = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [lang, setLangState]          = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('appLang') as AppLanguage | null;
    return saved === 'ar' || saved === 'en' ? saved : DEFAULT_LANG;
  });

  // Register a global interceptor so any apiFetch() call that receives a
  // SESSION_REVOKED 401 immediately clears the session and sets the revoked
  // flag. This covers mid-session revocations without waiting for the next
  // explicit refreshSession() call.
  useEffect(() => {
    setAuthErrorHandler((code) => {
      if (code === 'SESSION_REVOKED') {
        setSessionRevoked(true);
        setSession(null);
      }
    });
  }, []);

  const loadSession = useCallback(async () => {
    const { payload, revoked } = await fetchSession();
    setSession(payload);
    if (revoked) setSessionRevoked(true);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = useCallback((newLang: AppLanguage) => {
    setLangState(newLang);
    localStorage.setItem('appLang', newLang);
  }, []);

  const refreshSession = useCallback(async () => {
    const { payload, revoked } = await fetchSession();
    setSession(payload);
    if (revoked) {
      setSessionRevoked(true);
    } else if (payload) {
      // A successful re-auth (e.g. user logs back in) clears the revoked flag
      setSessionRevoked(false);
    }
  }, []);

  const value: UserContextType = {
    ...buildContext(session, lang, sessionRevoked),
    isLoaded,
    setLang,
    refreshSession,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  return useContext(UserContext);
}

export function useT() {
  const { lang } = useUserContext();
  return (ar: string, en: string) => (lang === 'ar' ? ar : en);
}

export { ROLE_META, ALL_ROLES, GOVERNANCE_ROLES, getPermissions };
