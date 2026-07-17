import React, { useState } from 'react';
import { useUserContext, type UserRole, ROLE_META } from '@/lib/user-context';
import { Menu, Scale, Globe, LogOut, User } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

const TIER_STYLES: Record<string, string> = {
  legacy:    'bg-gold/10 text-gold border-gold/30',
  executive: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  oversight: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
  judicial:  'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  public:    'bg-slate-400/10 text-slate-300 border-slate-400/30',
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiLogout() {
  await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  window.location.href = BASE + '/';
}

export function Header({ onMenuClick }: HeaderProps) {
  const { role, lang, setLang, refreshSession } = useUserContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const meta = ROLE_META[role as UserRole];
  const tierStyle = TIER_STYLES[meta?.tier ?? 'legacy'];
  const isAr = lang === 'ar';

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await apiLogout();
    await refreshSession();
  };

  return (
    <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted/50 transition-colors"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground text-base">مرصد</span>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="w-4 h-4 text-gold" />
          <span className="font-semibold text-foreground">
            {isAr ? 'مرصد — منصة البحث القانوني' : 'Marsad — Legal Research Platform'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={() => setLang(isAr ? 'en' : 'ar')}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{isAr ? 'EN' : 'ع'}</span>
        </button>

        {/* User / role menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${tierStyle}`}
          >
            <User className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline max-w-[160px] truncate">
              {isAr ? meta?.ar : meta?.en}
            </span>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute end-0 top-full mt-2 w-64 bg-popover border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-serif">
                      {(meta?.ar ?? 'م')[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">
                        {isAr ? meta?.ar : meta?.en}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isAr ? 'مستخدم موثّق' : 'Authenticated user'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role badge */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{isAr ? 'الدور الحالي' : 'Current role'}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${tierStyle}`}>
                      {role}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {isAr
                      ? 'هويتك مؤكدة بواسطة JWT موقّع. لا يمكن تغيير الدور.'
                      : 'Identity verified by signed JWT. Role cannot be changed.'}
                  </p>
                </div>

                {/* Logout */}
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isAr ? 'تسجيل الخروج' : 'Sign out'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
