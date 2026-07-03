import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'owner' | 'supervisor' | 'viewer';

interface UserContextType {
  role: UserRole;
  userId: number;
  setRole: (role: UserRole) => void;
  canUpload: boolean;
  canUseAi: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canComment: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('owner');
  const [userId] = useState<number>(1); // Default to seeded owner (محمد الشامسي)

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as UserRole;
    if (savedRole && ['owner', 'supervisor', 'viewer'].includes(savedRole)) {
      setRoleState(savedRole);
    } else {
      localStorage.setItem('userRole', 'owner');
    }
    localStorage.setItem('userId', String(userId));
  }, [userId]);

  const handleSetRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('userRole', newRole);
  };

  const value: UserContextType = {
    role,
    userId,
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
