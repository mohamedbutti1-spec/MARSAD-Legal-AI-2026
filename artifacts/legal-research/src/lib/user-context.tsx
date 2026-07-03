import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'owner' | 'supervisor' | 'viewer';
export type AppLanguage = 'ar' | 'en';

interface UserContextType {
  role: UserRole;
  userId: number;
  lang: AppLanguage;
  dir: 'rtl' | 'ltr';
  setRole: (role: UserRole) => void;
  setLang: (lang: AppLanguage) => void;
  canUpload: boolean;
  canUseAi: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canComment: boolean;
  canViewAudit: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('owner');
  const [userId] = useState<number>(1);
  const [lang, setLangState] = useState<AppLanguage>('ar');

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as UserRole;
    if (savedRole && ['owner', 'supervisor', 'viewer'].includes(savedRole)) {
      setRoleState(savedRole);
    } else {
      localStorage.setItem('userRole', 'owner');
    }

    const savedLang = localStorage.getItem('appLang') as AppLanguage;
    if (savedLang && ['ar', 'en'].includes(savedLang)) {
      setLangState(savedLang);
    }

    localStorage.setItem('userId', String(userId));
  }, [userId]);

  // Apply dir to <html> whenever language changes
  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const handleSetRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('userRole', newRole);
  };

  const handleSetLang = (newLang: AppLanguage) => {
    setLangState(newLang);
    localStorage.setItem('appLang', newLang);
  };

  const value: UserContextType = {
    role,
    userId,
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    setRole: handleSetRole,
    setLang: handleSetLang,
    canUpload: role === 'owner' || role === 'supervisor',
    canUseAi: role === 'owner' || role === 'supervisor',
    canManageUsers: role === 'owner',
    canManageSettings: role === 'owner',
    canComment: role === 'owner' || role === 'supervisor',
    canViewAudit: role === 'owner' || role === 'supervisor',
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

/** Translation helper — returns Arabic or English string based on current lang */
export function useT() {
  const { lang } = useUserContext();
  return (ar: string, en: string) => (lang === 'ar' ? ar : en);
}
