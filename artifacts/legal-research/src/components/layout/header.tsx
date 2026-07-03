import React, { useState } from 'react';
import { useUserContext } from '@/lib/user-context';
import { Bell, ChevronDown, Menu, User, Scale, Globe } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

const ROLE_CONFIG = {
  owner:      { ar: 'مالك',   en: 'Owner',      style: 'bg-amber-50 text-amber-800 border-amber-200' },
  supervisor: { ar: 'مشرف',   en: 'Supervisor',  style: 'bg-sky-50   text-sky-800   border-sky-200' },
  viewer:     { ar: 'مشاهد',  en: 'Viewer',      style: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export function Header({ onMenuClick }: HeaderProps) {
  const { role, setRole, lang, setLang } = useUserContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const conf = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
  const isAr = lang === 'ar';

  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0 shadow-xs">
      {/* ─── Start: hamburger + wordmark ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted/50 transition-colors"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Platform wordmark — visible only on mobile (desktop shows in sidebar) */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground text-base">مرصد</span>
        </div>

        {/* Desktop: breadcrumb placeholder */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">
            {isAr ? 'مرصد — منصة البحث القانوني' : 'Marsad — Legal Research Platform'}
          </span>
        </div>
      </div>

      {/* ─── End: language toggle + notifications + role ──────────────── */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={() => setLang(isAr ? 'en' : 'ar')}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{isAr ? 'EN' : 'ع'}</span>
        </button>

        {/* Notification bell */}
        <button
          className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title={isAr ? 'الإشعارات' : 'Notifications'}
        >
          <Bell className="w-4.5 h-4.5" />
          {/* Unread dot */}
          <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 bg-gold rounded-full" />
        </button>

        {/* Role switcher */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${conf.style}`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isAr ? conf.ar : conf.en}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute end-0 top-full mt-2 w-60 bg-white border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-serif">
                      م
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">محمد الشامسي</div>
                      <div className="text-xs text-muted-foreground">
                        {isAr ? 'تبديل الدور' : 'Switch Role'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role options */}
                <div className="p-1">
                  {(['owner', 'supervisor', 'viewer'] as const).map((r) => {
                    const rc = ROLE_CONFIG[r];
                    return (
                      <button
                        key={r}
                        onClick={() => { setRole(r); setDropdownOpen(false); }}
                        className={`w-full text-start px-3 py-2.5 text-sm flex items-center justify-between rounded-lg hover:bg-muted/50 transition-colors ${
                          role === r ? 'bg-muted/40' : ''
                        }`}
                      >
                        <span className={`font-medium ${role === r ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {rc.ar} · {rc.en}
                        </span>
                        {role === r && (
                          <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer note */}
                <div className="px-4 py-2.5 border-t border-border bg-muted/20">
                  <p className="text-[11px] text-muted-foreground">
                    {isAr
                      ? '⚠️ هذا وضع عرض توضيحي'
                      : '⚠️ Demo role switcher'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
