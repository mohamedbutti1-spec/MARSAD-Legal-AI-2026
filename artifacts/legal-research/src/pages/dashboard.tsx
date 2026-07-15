import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ArrowLeft, ArrowRight, Scale } from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';
import { useLocation } from 'wouter';

// ─── MARSAD Executive Dashboard ────────────────────────────────────────────────
// The home screen is a single large executive command card on a matte-black
// stage: emblem → wordmark → platform line → one gold call to action. Nothing
// else renders here — no stats, no widgets, no lower sections. Every selector
// (jurisdictions, legal taxonomy, frameworks, filters, advanced settings)
// lives in the sidebar or inside the MLOS assistant composer, never on this
// screen.

function getGreeting(): { ar: string; en: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { ar: 'صباح الخير', en: 'Good morning' };
  if (hour >= 12 && hour < 18) return { ar: 'مساء الخير', en: 'Good afternoon' };
  return { ar: 'مساء الخير', en: 'Good evening' };
}

export default function Dashboard() {
  const { lang } = useUserContext();
  const t = useT();
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const greeting = getGreeting();
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <AppLayout variant="chat" hideDemoBanner>
      <div className="flex-1 flex items-center justify-center overflow-y-auto px-4 py-10 bg-background">
        {/* ── The one executive card ─────────────────────────────────── */}
        <div
          className="w-full max-w-3xl rounded-2xl bg-card p-1.5 sm:p-2"
          style={{
            border: '1px solid var(--gold-border-strong)',
            boxShadow: 'var(--shadow-xl), 0 0 60px -30px var(--gold-glow)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 450ms ease-out, transform 450ms ease-out',
          }}
        >
          {/* Inner hairline frame — the double gold border */}
          <div
            className="rounded-xl px-6 py-14 sm:px-14 sm:py-16 lg:px-20 lg:py-20 text-center"
            style={{ border: '1px solid var(--gold-border)' }}
          >
            {/* Emblem */}
            <div
              className="mx-auto mb-7 w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gold/10 flex items-center justify-center"
              style={{ border: '1px solid var(--gold-border-strong)' }}
            >
              <Scale className="w-9 h-9 sm:w-10 sm:h-10 text-gold" aria-hidden />
            </div>

            {/* Wordmark */}
            <h1
              className="text-4xl sm:text-5xl font-bold mb-2"
              style={{ fontFamily: 'var(--app-font-serif)', color: 'hsl(var(--gold))' }}
            >
              {t('مرصد', 'MARSAD')}
            </h1>
            <p className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.35em] text-gold/60 uppercase select-none mb-6">
              MARSAD · MLOS
            </p>

            {/* Gold divider */}
            <div className="gold-bar w-16 h-px mx-auto mb-6 opacity-60" />

            {/* Greeting + platform line */}
            <h2 className="text-xl sm:text-2xl font-bold text-heading mb-2">
              {t(greeting.ar, greeting.en)}
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground font-medium mb-12">
              {t('منصة القرار الإداري الذكي', 'Intelligent Administrative Decision Platform')}
            </p>

            {/* The one primary action — opens the MLOS AI assistant */}
            <button
              type="button"
              onClick={() => navigate('/assistant')}
              className="gold-hover-glow inline-flex items-center gap-3 px-10 py-4 sm:px-12 sm:py-5 rounded-xl bg-gold text-background text-lg sm:text-xl font-bold hover:opacity-90 transition-all"
            >
              {t('ابدأ الرحلة معنا من هنا', 'Start your journey here')}
              <ArrowIcon className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
