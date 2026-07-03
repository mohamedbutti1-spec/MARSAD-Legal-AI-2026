import React, { useState } from 'react';
import { useUserContext } from '@/lib/user-context';
import { Shield, ChevronDown, Menu, User, LogOut } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك — Owner',
  supervisor: 'مشرف — Supervisor',
  viewer: 'مشاهد — Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800 border-amber-200',
  supervisor: 'bg-blue-100 text-blue-800 border-blue-200',
  viewer: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function Header({ onMenuClick }: HeaderProps) {
  const { role, setRole } = useUserContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden text-muted-foreground hover:text-foreground p-1 rounded"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary hidden sm:block" />
          <h2 className="font-serif font-bold text-base text-foreground hidden sm:block">
            منصة البحث القانوني
          </h2>
        </div>
      </div>

      {/* Right: user role switcher */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${
            ROLE_COLORS[role] ?? ROLE_COLORS.viewer
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{ROLE_LABELS[role] ?? role}</span>
          <span className="sm:hidden capitalize">{role}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {dropdownOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
            />
            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  تبديل الدور / Switch Role
                </p>
              </div>
              {(['owner', 'supervisor', 'viewer'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-muted/50 transition-colors ${
                    role === r ? 'bg-muted/30 font-semibold' : ''
                  }`}
                >
                  <span>{ROLE_LABELS[r]}</span>
                  {role === r && <span className="w-2 h-2 rounded-full bg-primary" />}
                </button>
              ))}
              <div className="border-t border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  المستخدم الحالي: محمد الشامسي
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
