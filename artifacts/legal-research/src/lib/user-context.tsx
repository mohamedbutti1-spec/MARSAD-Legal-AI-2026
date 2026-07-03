import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'owner' | 'supervisor' | 'viewer';

interface UserContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  canUpload: boolean;
  canUseAi: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canComment: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('owner');

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as UserRole;
    if (savedRole && ['owner', 'supervisor', 'viewer'].includes(savedRole)) {
      setRole(savedRole);
    } else {
      localStorage.setItem('userRole', 'owner');
    }
  }, []);

  const handleSetRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('userRole', newRole);
  };

  const value = {
    role,
    setRole: handleSetRole,
    canUpload: role === 'owner' || role === 'supervisor',
    canUseAi: role === 'owner' || role === 'supervisor',
    canManageUsers: role === 'owner',
    canManageSettings: role === 'owner',
    canComment: role === 'owner' || role === 'supervisor',
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
