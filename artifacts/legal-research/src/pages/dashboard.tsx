import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import {
  Scale, ScrollText, Gavel, FileCheck, PenLine,
  ArrowUp, Mic, Paperclip, GitCompareArrows, Compass, BookOpen,
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

// ─── Chip definitions ────────────────────────────────────────────────────────

type FillChip = {
  id: string;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  action: 'fill';
  fill: string;
};
type NavChip = {
  id: string;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  action: 'navigate';
  href: string;
};
type QuickChip = FillChip | NavChip;

const QUICK_CHIPS: QuickChip[] = [
  {
    id: 'analyze-decision',
    icon: Scale,
    labelAr: 'حلل قرار إداري',
    labelEn: 'Analyze Decision',
    action: 'fill',
    fill: 'حلل القرار الإداري رقم ...',
  },
  {
    id: 'caselaw',
    icon: Gavel,
    labelAr: 'ابحث عن حكم قضائي',
    labelEn: 'Search Case Law',
    action: 'navigate',
    href: '/caselaw/uae',
  },
  {
    id: 'legislation',
    icon: ScrollText,
    labelAr: 'ابحث في التشريعات',
    labelEn: 'Search Legislation',
    action: 'navigate',
    href: '/legislation/uae',
  },
  {
    id: 'compare-laws',
    icon: GitCompareArrows,
    labelAr: 'قارن بين قانونين',
    labelEn: 'Compare Two Laws',
    action: 'fill',
    fill: 'قارن بين قانون ... وقانون ... من حيث:',
  },
  {
    id: 'review-memo',
    icon: FileCheck,
    labelAr: 'راجع مذكرة قانونية',
    labelEn: 'Review Legal Memo',
    action: 'fill',
    fill: 'راجع المذكرة القانونية التالية:',
  },
  {
    id: 'draft-opinion',
    icon: PenLine,
    labelAr: 'أنشئ رأياً قانونياً',
    labelEn: 'Draft Legal Opinion',
    action: 'fill',
    fill: 'أنشئ رأياً قانونياً بشأن:',
  },
  {
    id: 'spg',
    icon: Compass,
    labelAr: 'الإرشاد المهني الذكي',
    labelEn: 'Smart Professional Guidance',
    action: 'navigate',
    href: '/spg',
  },
  {
    id: 'pgf',
    icon: BookOpen,
    labelAr: 'الإطار الاحترافي الموجَّه',
    labelEn: 'Professional Guidance Framework',
    action: 'navigate',
    href: '/pgf',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { lang } = useUserContext();
  const t = useT();
  const [, navigate] = useLocation();

  const [query, setQuery]       = useState('');
  const [dashStats, setDashStats] = useState<DashStats | null>(null);
  const [visible, setVisible]   = useState(false);
  const [listening, setListening] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fade-in on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Real stats — show nothing if the call fails ────────────────────────────
  useEffect(() => {
    apiFetch('/api/dashboard/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DashStats | null) => { if (data) setDashStats(data); })
      .catch(() => {});
  }, []);

  // ── Textarea auto-grow ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [query]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSend() {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Hand off to the full AI Legal Assistant (session-based, citations, history)
    sessionStorage.setItem('pendingAssistantQuery', trimmed);
    navigate('/assistant');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter → browser default (newline)
  }

  function handleChip(chip: QuickChip) {
    if (chip.action === 'navigate') {
      navigate(chip.href);
    } else {
      setQuery(chip.fill);
      setTimeout(() => {
        textareaRef.current?.focus();
        // Move cursor to end
        const el = textareaRef.current;
        if (el) { el.selectionStart = el.selectionEnd = el.value.length; }
      }, 0);
    }
  }

  function handleMic() {
    setListening((prev) => !prev);
  }

  const greeting = getGreeting();
  const hasText  = query.trim().length > 0;

  return (
    <AppLayout variant="chat">
      <div className="flex flex-col h-full overflow-y-auto bg-background">

        {/* ── Top ambient stats strip ───────────────────────────────────── */}
        {dashStats && dashStats.legalSourcesCount > 0 && (
          <div className="hidden sm:flex items-center justify-center gap-6 py-2.5 border-b border-border/40 bg-background/80 backdrop-blur-sm shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium tracking-wide">
              <span className="text-foreground font-semibold">
                {lang === 'ar'
                  ? toArabicNumeral(dashStats.legalSourcesCount)
                  : dashStats.legalSourcesCount.toLocaleString()}
              </span>
              {' '}
              {t('مصدر قانوني مفهرس', 'indexed legal sources')}
            </span>
            <span className="text-border select-none">·</span>
            <span className="text-[11px] text-muted-foreground font-medium tracking-wide">
              <span className="text-foreground font-semibold">
                {lang === 'ar'
                  ? toArabicNumeral(dashStats.aiQueriesThisMonth)
                  : dashStats.aiQueriesThisMonth.toLocaleString()}
              </span>
              {' '}
              {t('استعلام ذكاء اصطناعي هذا الشهر', 'AI queries this month')}
            </span>
          </div>
        )}

        {/* ── Hero center zone ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16">
          <div
            className="w-full max-w-2xl flex flex-col items-center gap-8"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 350ms ease-out, transform 350ms ease-out',
            }}
          >
            {/* Greeting + brand ──────────────────────────────────────── */}
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

            {/* Composer card ─────────────────────────────────────────── */}
            <div className="w-full">
              <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">

                {/* Textarea */}
                <label htmlFor="home-prompt" className="sr-only">
                  {t('اكتب سؤالك القانوني', 'Type your legal question')}
                </label>
                <textarea
                  id="home-prompt"
                  ref={textareaRef}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  rows={1}
                  className={[
                    'w-full bg-transparent resize-none overflow-y-auto',
                    'px-5 pt-4 pb-2',
                    'text-sm sm:text-base text-foreground',
                    'placeholder:text-muted-foreground/55',
                    'focus:outline-none',
                    'max-h-40',
                    lang === 'ar' ? 'text-right' : 'text-left',
                  ].join(' ')}
                  style={{ minHeight: '52px' }}
                  placeholder={t('اكتب سؤالك القانوني...', 'Type your legal question...')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />

                {/* Toolbar row ──────────────────────────────────── */}
                <div className="flex items-center gap-2 px-4 pb-3 pt-1">

                  {/* Attachment */}
                  <button
                    type="button"
                    aria-label={t('إرفاق ملف', 'Attach file')}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Paperclip className="w-5 h-5" aria-hidden />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    aria-hidden
                    tabIndex={-1}
                    onChange={() => {/* UI only — no upload logic */}}
                  />

                  {/* Microphone */}
                  <button
                    type="button"
                    aria-label={listening
                      ? t('إيقاف الاستماع', 'Stop listening')
                      : t('تسجيل صوتي', 'Voice input')}
                    onClick={handleMic}
                    className={[
                      'p-2 rounded-xl transition-all',
                      listening
                        ? 'text-red-600 bg-red-50 ring-2 ring-red-200'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    ].join(' ')}
                  >
                    <Mic className="w-5 h-5" aria-hidden />
                  </button>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Send */}
                  <button
                    type="button"
                    aria-label={t('إرسال', 'Send')}
                    onClick={handleSend}
                    disabled={!hasText}
                    className={[
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      'transition-all duration-150',
                      hasText
                        ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-md cursor-pointer'
                        : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
                    ].join(' ')}
                  >
                    <ArrowUp className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              </div>

              {/* Hint */}
              <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
                {t(
                  'اضغط Enter للإرسال · Shift+Enter لسطر جديد',
                  'Press Enter to send · Shift+Enter for new line',
                )}
              </p>
            </div>

            {/* Quick-action chips ─────────────────────────────────────── */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 w-full">
              {QUICK_CHIPS.map((chip, idx) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleChip(chip)}
                    className="
                      flex items-center gap-2 px-3.5 py-2 rounded-full
                      border border-border bg-card text-foreground
                      hover:-translate-y-0.5 hover:shadow-sm hover:border-primary/30 hover:bg-primary/[0.03]
                      cursor-pointer
                    "
                    style={{
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateY(0)' : 'translateY(8px)',
                      transition: `opacity 350ms ease-out ${idx * 40}ms, transform 350ms ease-out ${idx * 40}ms, box-shadow 150ms, border-color 150ms, background-color 150ms`,
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
