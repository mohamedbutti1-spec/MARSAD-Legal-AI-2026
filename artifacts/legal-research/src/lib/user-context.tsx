import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type UserRole,
  type RolePermissions,
  type GovernanceRole,
  ALL_ROLES,
  GOVERNANCE_ROLES,
  ROLE_META,
  getPermissions,
} from '@/lib/permissions';

// Demo organisation for org-scoped roles (director_general / department_director).
// In production this would come from a trusted identity claim.
const DEMO_ORG = 'وزارة الصحة ووقاية المجتمع — الإدارة العامة للرقابة والتفتيش الصحي — إمارة أبوظبي';

function orgForRole(role: UserRole): string {
  return getPermissions(role).seeOwnOrgOnly ? DEMO_ORG : '';
}

export type { UserRole, GovernanceRole };
export type AppLanguage = 'ar' | 'en';

interface UserContextType {
  role: UserRole;
  userId: number;
  userOrg: string; // '' for non-org-scoped roles; DEMO_ORG for seeOwnOrgOnly roles
  lang: AppLanguage;
  dir: 'rtl' | 'ltr';
  setRole: (role: UserRole) => void;
  setLang: (lang: AppLanguage) => void;
  permissions: RolePermissions;
  // Legacy permission booleans (kept for backward compatibility)
  canUpload: boolean;
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
  // CIL — Constitutional Intelligence Layer (Phase 42)
  canReadConstitutionalAssessment: boolean;
  canRunCilAssessment: boolean;
  canAcknowledgeCilWarnings: boolean;
  canViewCilDashboard: boolean;
  // NAIP — National Administrative Intelligence Platform (Phase 43)
  canViewNaipDashboard: boolean;
  canViewNaipSearch: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('owner');
  const [userId] = useState<number>(1);
  const [lang, setLangState] = useState<AppLanguage>('ar');

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as UserRole;
    if (savedRole && ALL_ROLES.includes(savedRole)) {
      setRoleState(savedRole);
      localStorage.setItem('userOrg', orgForRole(savedRole));
    } else {
      localStorage.setItem('userRole', 'owner');
      localStorage.setItem('userOrg', '');
    }

    const savedLang = localStorage.getItem('appLang') as AppLanguage;
    if (savedLang && ['ar', 'en'].includes(savedLang)) {
      setLangState(savedLang);
    }

    localStorage.setItem('userId', String(userId));
  }, [userId]);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const handleSetRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('userRole', newRole);
    localStorage.setItem('userOrg', orgForRole(newRole));
  };

  const handleSetLang = (newLang: AppLanguage) => {
    setLangState(newLang);
    localStorage.setItem('appLang', newLang);
  };

  const permissions = getPermissions(role);
  const isGovernanceRole = GOVERNANCE_ROLES.includes(role as GovernanceRole);
  const userOrg = orgForRole(role);

  const value: UserContextType = {
    role,
    userId,
    userOrg,
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    setRole: handleSetRole,
    setLang: handleSetLang,
    permissions,
    canUpload: role === 'owner' || role === 'supervisor',
    canUseAi: role === 'owner' || role === 'supervisor',
    canManageUsers: role === 'owner',
    canManageSettings: role === 'owner',
    canComment: role === 'owner' || role === 'supervisor',
    canViewAudit: permissions.canReadAuditLog,
    isGovernanceRole,
    canViewGovernanceDashboard: permissions.canViewGovernanceDashboard,
    canReadRiskAssessment: permissions.canReadRiskAssessment ?? false,
    canWriteRiskTreatment: permissions.canWriteRiskTreatment ?? false,
    canRecalculateRisk:    permissions.canRecalculateRisk    ?? false,
    canViewRiskDashboard:  permissions.canViewRiskDashboard  ?? false,
    canReadConstitutionalAssessment: permissions.canReadConstitutionalAssessment ?? false,
    canRunCilAssessment:             permissions.canRunCilAssessment             ?? false,
    canAcknowledgeCilWarnings:       permissions.canAcknowledgeCilWarnings       ?? false,
    canViewCilDashboard:             permissions.canViewCilDashboard             ?? false,
    canViewNaipDashboard:            permissions.canViewNaipDashboard            ?? false,
    canViewNaipSearch:               permissions.canViewNaipSearch               ?? false,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}

export function useT() {
  const { lang } = useUserContext();
  return (ar: string, en: string) => (lang === 'ar' ? ar : en);
}

export { ROLE_META, ALL_ROLES, GOVERNANCE_ROLES, getPermissions };
