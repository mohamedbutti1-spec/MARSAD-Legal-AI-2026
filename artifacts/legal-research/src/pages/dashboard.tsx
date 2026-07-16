import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Search,
  FolderOpen,
  Library,
  GitCompareArrows,
  UserCircle,
  Settings,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';
import { useLocation } from 'wouter';

// ─── Judicial Command Center — Dashboard ───────────────────────────────────────
// Per the visual rebuild spec: the dashboard is a single command card with one
// large call to action beneath it. Every other capability (role selection,
// legal-context and answer-mode selection, quick shortcuts) still exists in
// the app — it lives inside the AI Assistant composer (see
// guided-assistant-config.ts and ai-assistant.tsx's PreAnalysisPanel /
// SessionConfigBar) or the sidebar. Secondary destinations are reachable from
// the "More" menu below the CTA rather than as widgets on the home screen.

function getGreeting(): { ar: string; en: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { ar: 'صباح الخير', en: 'Good morning' };
  if (hour >= 12 && hour < 18) return { ar: 'مساء الخير', en: 'Good afternoon' };
  return { ar: 'مساء الخير', en: 'Good evening' };
}

interface MoreOption {
  href: string;
  labelAr: string;
  labelEn: string;
  icon: React.ReactNode;
  show: boolean;
}

export default function Dashboard() {
  const { lang, canUseAi, canManageSettings } = useUserContext();
  const t = useT();
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const greeting = getGreeting();
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  // Secondary destinations — everything that used to be a home-screen widget.
  const moreOptions: MoreOption[] = [
    { href: '/search', labelAr: 'البحث القانوني الذكي', labelEn: 'Smart Legal Search', icon: <Search className="w-4 h-4" />, show: canUseAi },
    { href: '/workspace', labelAr: 'مساحة البحث', labelEn: 'Research Workspace', icon: <FolderOpen className="w-4 h-4" />, show: canUseAi },
    { href: '/library', labelAr: 'مكتبتي الشخصية', labelEn: 'Personal Library', icon: <Library className="w-4 h-4" />, show: true },
    { href: '/comparison', labelAr: 'مقارنة المستندات', labelEn: 'Document Comparison', icon: <GitCompareArrows className="w-4 h-4" />, show: true },
    { href: '/citizen', labelAr: 'بوابة المواطن', labelEn: 'Citizen Portal', icon: <UserCircle className="w-4 h-4" />, show: true },
    { href: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: <Settings className="w-4 h-4" />, show: canManageSettings },
  ].filter((o) => o.show);

  return (
    <AppLayout>
      <div className="flex h-full items-center justify-center overflow-y-auto bg-background px-4 py-12">
        <div
          className="w-full max-w-lg flex flex-col items-stretch"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 350ms ease-out, transform 350ms ease-out',
          }}
        >
          {/* ── Main command card ── */}
          <div className="moj-card rounded-xl px-6 py-10 sm:px-10 sm:py-12 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-[10px] font-mono font-bold tracking-widest text-gold/70 uppercase select-none">MLOS</span>
              <span className="text-border select-none">·</span>
              <span className="text-[10px] text-muted-foreground/70 font-medium">Marsad Legal Operating System</span>
            </div>

            <h1
              className="text-2xl sm:text-3xl font-bold text-heading mb-2"
              style={{ fontFamily: 'var(--app-font-serif)' }}
            >
              {t(greeting.ar, greeting.en)}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              {t('منصة القرار الإداري الذكي', 'Intelligent Administrative Decision Platform')}
            </p>
          </div>

          {/* ── Primary call to action — one large button below the card ── */}
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="gold-hover-glow mt-6 w-full inline-flex items-center justify-center gap-3 px-8 py-4 sm:py-5 rounded-xl bg-gold text-background text-base sm:text-lg font-bold hover:opacity-90 transition-all"
          >
            {t('ابدأ الرحلة معنا من هنا', 'Start your journey here')}
            <ArrowIcon className="w-5 h-5" aria-hidden />
          </button>

          {/* ── More menu — secondary options (inline panel, flows with layout) ── */}
          <div className="mt-4 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-gold hover:bg-gold/5 border border-transparent hover:border-gold/20 transition-colors"
            >
              {t('المزيد', 'More')}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {moreOpen && (
              <div role="menu" className="mt-2 w-full max-w-xs moj-card rounded-xl overflow-hidden py-1.5">
                {moreOptions.map((opt) => (
                  <button
                    key={opt.href}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(opt.href);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground/80 hover:text-gold hover:bg-gold/5 transition-colors text-start"
                  >
                    <span className="text-gold/60 shrink-0">{opt.icon}</span>
                    <span className="truncate">{lang === 'ar' ? opt.labelAr : opt.labelEn}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
