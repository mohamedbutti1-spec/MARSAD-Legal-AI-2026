import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import {
  Scale, ScrollText, Gavel, Sparkles, ShieldAlert,
  FileCheck, PenLine, ArrowUp,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';
import { useLocation } from 'wouter';

interface DashStats {
  legalSourcesCount: number;
  aiQueriesThisMonth: number;
  activeUsers: number;
  totalUsers: number;
}

function toArabicNumeral(n: number): string {
  return n.toLocaleString('ar-EG');
}

function getGreeting(): { ar: string; en: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { ar: 'صباح الخير', en: 'Good morning' };
  if (hour >= 12 && hour < 18) return { ar: 'مساء الخير', en: 'Good afternoon' };
  return { ar: 'مساء الخير', en: 'Good evening' };
}

const QUICK_CHIPS = [
  {
    id: 'analyze-decision',
    icon: Scale,
    labelAr: 'تحليل قرار إداري',
    labelEn: 'Analyze Administrative Decision',
    action: 'fill',
    fill: 'حلل القرار الإداري رقم ...',
  },
  {
    id: 'review-draft',
    icon: FileCheck,
    labelAr: 'مراجعة مشروع قرار',
    labelEn: 'Review Draft Decision',
    action: 'fill',
    fill: 'راجع مشروع القرار التالي من حيث المشروعية:',
  },
  {
    id: 'draft-memo',
    icon: PenLine,
    labelAr: 'صياغة مذكرة قانونية',
    labelEn: 'Draft Legal Memo',
    action: 'fill',
    fill: 'اصغ مذكرة قانونية بشأن:',
  },
  {
    id: 'legislation',
    icon: ScrollText,
    labelAr: 'البحث في التشريعات',
    labelEn: 'Search Legislation',
    action: 'navigate',
    href: '/legislation/uae',
  },
  {
    id: 'caselaw',
    icon: Gavel,
    labelAr: 'البحث في الأحكام القضائية',
    labelEn: 'Search Case Law',
    action: 'navigate',
    href: '/caselaw/uae',
  },
  {
    id: 'shamsi',
    icon: Sparkles,
    labelAr: 'تحليل وفق نظرية الشامسي',
    labelEn: 'Shamsi Theory Analysis',
    action: 'navigate',
    href: '/shamsi-theory',
  },
  {
    id: 'risk',
    icon: ShieldAlert,
    labelAr: 'تقييم المخاطر القانونية',
    labelEn: 'Legal Risk Assessment',
    action: 'navigate',
    href: '/risk-engine',
  },
] as const;

export default function Dashboard() {
  const { lang } = useUserContext();
  const t = useT();
  const [, navigate] = useLocation();

  const [query, setQuery] = useState('');
  const [dashStats, setDashStats] = useState<DashStats | null>(null);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fade-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fetch real stats — show nothing if it fails
  useEffect(() => {
    apiFetch('/api/dashboard/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DashStats | null) => { if (data) setDashStats(data); })
      .catch(() => {});
  }, []);

  function handleSend() {
    if (!query.trim()) return;
    sessionStorage.setItem('quickSearchQuery', query.trim());
    navigate('/research');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend();
  }

  function handleChip(chip: typeof QUICK_CHIPS[number]) {
    if (chip.action === 'navigate') {
      navigate(chip.href);
    } else {
      setQuery(chip.fill);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const greeting = getGreeting();

  return (
    <AppLayout variant="chat">
      <div className="flex flex-col h-full overflow-y-auto bg-background">
        {/* ── Top ambient strip ─────────────────────────────────────────── */}
        {dashStats && (
          <div className="hidden sm:flex items-center justify-center gap-6 py-2.5 border-b border-border/40 bg-background/80 backdrop-blur-sm shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium tracking-wide">
              <span className="text-foreground font-semibold">
                {lang === 'ar' ? toArabicNumeral(dashStats.legalSourcesCount) : dashStats.legalSourcesCount.toLocaleString()}
              </span>
              {' '}
              {t('مصدر قانوني مفهرس', 'indexed legal sources')}
            </span>
            <span className="text-border select-none">·</span>
            <span className="text-[11px] text-muted-foreground font-medium tracking-wide">
              <span className="text-foreground font-semibold">
                {lang === 'ar' ? toArabicNumeral(dashStats.aiQueriesThisMonth) : dashStats.aiQueriesThisMonth.toLocaleString()}
              </span>
              {' '}
              {t('استعلام ذكاء اصطناعي هذا الشهر', 'AI queries this month')}
            </span>
          </div>
        )}

        {/* ── Hero center zone ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16">
          <div
            className="w-full max-w-2xl flex flex-col items-center gap-8 transition-all duration-[350ms] ease-out"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
            }}
          >
            {/* Greeting + brand */}
            <div className="text-center space-y-2">
              <h1
                className="text-3xl sm:text-4xl font-bold text-foreground"
                style={{ fontFamily: 'var(--app-font-serif)' }}
              >
                {t(greeting.ar, greeting.en)}
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground font-medium">
                {t('منصة القرار الإداري الذكي', 'Intelligent Administrative Decision Platform')}
              </p>
            </div>

            {/* Prompt input */}
            <div className="w-full">
              <div
                className="relative flex items-center bg-card rounded-2xl border border-border shadow-xl"
                style={{ minHeight: '56px' }}
              >
                <label htmlFor="home-prompt" className="sr-only">
                  {t('اسأل مرصد أي سؤال قانوني', 'Ask MARSAD any legal question')}
                </label>
                <input
                  id="home-prompt"
                  ref={inputRef}
                  type="text"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className={`
                    flex-1 bg-transparent px-5 py-4 text-sm sm:text-base text-foreground
                    placeholder:text-muted-foreground/60 focus:outline-none
                    ${lang === 'ar' ? 'text-right' : 'text-left'}
                  `}
                  placeholder={t('اسأل مرصد أي سؤال قانوني...', 'Ask MARSAD any legal question...')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  aria-label={t('إرسال', 'Send')}
                  onClick={handleSend}
                  disabled={!query.trim()}
                  className={`
                    mx-3 w-10 h-10 rounded-full flex items-center justify-center shrink-0
                    transition-all duration-150
                    ${query.trim()
                      ? 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer shadow-md'
                      : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'}
                  `}
                >
                  <ArrowUp className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Quick-action chips */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 w-full">
              {QUICK_CHIPS.map((chip, idx) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleChip(chip)}
                    className="
                      flex items-center gap-2 px-3.5 py-2 rounded-full
                      border border-border bg-card text-sm text-foreground
                      hover:-translate-y-0.5 hover:shadow-sm hover:border-primary/30
                      transition-all duration-150 cursor-pointer
                    "
                    style={{
                      transitionDelay: `${idx * 30}ms`,
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateY(0)' : 'translateY(8px)',
                      transition: `opacity 350ms ease-out ${idx * 30}ms, transform 350ms ease-out ${idx * 30}ms, box-shadow 150ms, border-color 150ms`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                    <span className="font-medium whitespace-nowrap text-xs sm:text-sm">
                      {t(chip.labelAr, chip.labelEn)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Bottom privacy strip ──────────────────────────────────────── */}
        <div className="shrink-0 py-3 px-4 text-center border-t border-border/30">
          <p className="text-[10px] text-muted-foreground/50 select-none tracking-wide">
            {t(
              'مرصد يعمل على بيانات محلية آمنة — لا تُرسل بياناتك خارج المنظومة',
              'MARSAD operates on secure local data — your data never leaves the system',
            )}
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
