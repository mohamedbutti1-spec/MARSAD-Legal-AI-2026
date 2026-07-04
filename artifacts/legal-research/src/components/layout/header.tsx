import React, { useState } from 'react';
import { useUserContext, type UserRole, ROLE_META, ALL_ROLES } from '@/lib/user-context';
import { Bell, ChevronDown, Menu, Scale, Globe } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

const TIER_STYLES: Record<string, string> = {
  legacy:    'bg-amber-50 text-amber-800 border-amber-200',
  executive: 'bg-sky-50 text-sky-800 border-sky-200',
  oversight: 'bg-violet-50 text-violet-800 border-violet-200',
  judicial:  'bg-emerald-50 text-emerald-800 border-emerald-200',
  public:    'bg-slate-50 text-slate-700 border-slate-200',
};

const ROLE_GROUPS: { titleAr: string; titleEn: string; roles: UserRole[] }[] = [
  { titleAr: 'أدوار المنصة',        titleEn: 'Platform Roles',       roles: ['owner', 'supervisor', 'viewer'] },
  { titleAr: 'الإدارة التنفيذية',   titleEn: 'Executive Leadership',  roles: ['minister', 'undersecretary', 'assistant_undersecretary', 'director_general', 'department_director'] },
  { titleAr: 'الرقابة والمراجعة',   titleEn: 'Oversight & Review',    roles: ['legal_department', 'constitutional_reviewer', 'internal_auditor', 'external_auditor'] },
  { titleAr: 'القضاء والمواطن',     titleEn: 'Judicial & Public',     roles: ['judge', 'citizen'] },
];

export function Header({ onMenuClick }: HeaderProps) {
  const { role, setRole, lang, setLang } = useUserContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const meta = ROLE_META[role];
  const tierStyle = TIER_STYLES[meta?.tier ?? 'legacy'];
  const isAr = lang === 'ar';

  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0 shadow-xs">
      <div className="flex items-center gap-3">
        <button className="lg:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted/50 transition-colors" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center"><Scale className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-foreground text-base">مرصد</span>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">{isAr ? 'مرصد — منصة البحث القانوني' : 'Marsad — Legal Research Platform'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setLang(isAr ? 'en' : 'ar')} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
          <Globe className="w-3.5 h-3.5" />
          <span>{isAr ? 'EN' : 'ع'}</span>
        </button>

        <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 bg-gold rounded-full" />
        </button>

        <div className="relative">
          <button onClick={() => setDropdownOpen((o) => !o)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${tierStyle}`}>
            <span className="hidden sm:inline max-w-[160px] truncate">{isAr ? meta?.ar : meta?.en}</span>
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute end-0 top-full mt-2 w-72 bg-white border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-serif">م</div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">محمد الشامسي</div>
                      <div className="text-xs text-muted-foreground">{isAr ? 'تبديل دور المستخدم' : 'Switch user role'}</div>
                    </div>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {ROLE_GROUPS.map((group) => (
                    <div key={group.titleAr}>
                      <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{isAr ? group.titleAr : group.titleEn}</div>
                      <div className="px-1 pb-1 space-y-0.5">
                        {group.roles.map((r) => {
                          const m = ROLE_META[r];
                          const ts = TIER_STYLES[m.tier];
                          const isActive = role === r;
                          return (
                            <button key={r} onClick={() => { setRole(r); setDropdownOpen(false); }}
                              className={`w-full text-start px-3 py-2 text-sm flex items-center justify-between rounded-lg transition-colors ${isActive ? 'bg-muted/60' : 'hover:bg-muted/40'}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${ts}`}>
                                  {m.tier === 'legacy' ? 'SYS' : m.tier === 'executive' ? 'GOV' : m.tier === 'oversight' ? 'OVR' : m.tier === 'judicial' ? 'JUD' : 'PUB'}
                                </span>
                                <span className={`font-medium truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{isAr ? m.ar : m.en}</span>
                              </div>
                              {isActive && <span className="w-2 h-2 rounded-full bg-gold shrink-0 ms-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-2.5 border-t border-border bg-muted/20">
                  <p className="text-[10px] text-muted-foreground">{isAr ? '⚠️ وضع عرض توضيحي — كل دور يرى بياناته المصرّح بها فقط' : '⚠️ Demo mode — each role sees only permitted data'}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
