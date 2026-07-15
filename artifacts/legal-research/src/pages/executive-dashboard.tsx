import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ArrowLeft, ArrowRight, Scale } from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';
import { useLocation } from 'wouter';
import { getStoredPersona, getPersonaGreeting } from '@/lib/marsad-personas';

// ─── MARSAD V2 — Executive Dashboard ───────────────────────────────────────────
// Complete homepage replacement per the V2 workflow redesign: after
// authentication the user sees ONE large, formally framed central card in
// navy/matte-gold — no legal forms, selectors, domains, filters or answer
// formats — and under it exactly ONE action:
//
//     «ابدأ الرحلة معنا من هنا»  →  the AI assistant workspace.
//
// Every secondary function (professional packages, academy, scenarios,
// Nafe, legal sources, MLOS operations, governance…) lives in the sidebar
// and its own module pages. The previous dashboard (pages/dashboard.tsx)
// is superseded, not deleted, per the platform's no-module-deletion rule.

function getTimeGreeting(): { ar: string; en: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { ar: 'صباح الخير', en: 'Good morning' };
  if (hour >= 12 && hour < 18) return { ar: 'مساء الخير', en: 'Good afternoon' };
  return { ar: 'مساء الخير', en: 'Good evening' };
}

/** Thin gold L-shaped corner ornament for the ceremonial frame. */
function FrameCorner({ pos }: { pos: 'ts' | 'te' | 'bs' | 'be' }) {
  const cls: Record<typeof pos, string> = {
    ts: 'top-3 start-3 border-t-2 border-s-2 rounded-ss-lg',
    te: 'top-3 end-3 border-t-2 border-e-2 rounded-se-lg',
    bs: 'bottom-3 start-3 border-b-2 border-s-2 rounded-es-lg',
    be: 'bottom-3 end-3 border-b-2 border-e-2 rounded-ee-lg',
  };
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute w-7 h-7 border-gold/50 ${cls[pos]}`}
    />
  );
}

export default function ExecutiveDashboard() {
  const { lang } = useUserContext();
  const t = useT();
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  // Smart greeting — persona-aware when a professional path has been chosen
  // (from /welcome); otherwise a formal time-of-day salutation. Text only:
  // the single CTA below remains the only action on this screen.
  const personaGreeting = getPersonaGreeting(getStoredPersona());
  const timeGreeting = getTimeGreeting();

  return (
    <AppLayout hideDemoBanner>
      <div className="relative flex flex-col items-center justify-center min-h-[calc(100dvh-12rem)] py-8" dir="rtl">
        {/* Ambient ceremonial glow behind the card */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="w-[40rem] h-[40rem] max-w-full rounded-full bg-gold/[0.04] blur-3xl" />
        </div>

        {/* ── The single central card ─────────────────────────────────── */}
        <div
          className="relative w-full max-w-2xl"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 450ms ease-out, transform 450ms ease-out',
          }}
        >
          {/* Outer frame band */}
          <div className="rounded-3xl border border-gold/20 bg-gradient-to-b from-gold/[0.07] via-transparent to-gold/[0.07] p-2">
            {/* Inner ceremonial frame */}
            <div className="relative rounded-2xl border border-gold/35 bg-card/85 px-6 sm:px-12 py-12 sm:py-16 text-center overflow-hidden">
              <FrameCorner pos="ts" />
              <FrameCorner pos="te" />
              <FrameCorner pos="bs" />
              <FrameCorner pos="be" />

              {/* Emblem */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border border-gold/35 bg-gold/10 mb-6">
                <Scale className="w-9 h-9 text-gold" aria-hidden />
              </div>

              {/* Wordmark */}
              <p className="text-[11px] font-black tracking-[0.45em] text-gold/70 uppercase select-none mb-1">
                MARSAD
              </p>
              <h1
                className="text-4xl sm:text-5xl font-bold text-heading leading-tight mb-2"
                style={{ fontFamily: 'var(--app-font-serif)' }}
              >
                مرصد
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-medium">
                {t('منصة القرارات الإدارية الذكية', 'Intelligent Administrative Decision Platform')}
              </p>

              {/* Gold divider */}
              <div className="flex items-center justify-center gap-3 my-7" aria-hidden>
                <span className="h-px w-16 sm:w-24 bg-gradient-to-l from-gold/40 to-transparent" />
                <span className="text-gold/60 text-xs select-none">✦</span>
                <span className="h-px w-16 sm:w-24 bg-gradient-to-r from-gold/40 to-transparent" />
              </div>

              {/* Smart greeting */}
              <h2
                className="text-xl sm:text-2xl font-bold text-heading mb-3"
                style={{ fontFamily: 'var(--app-font-serif)' }}
              >
                {personaGreeting ?? t(timeGreeting.ar, timeGreeting.en)}
              </h2>
              <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {t(
                  'منظومة التحليل القانوني والمحاكاة المهنية ودعم القرار التنفيذي — بين يديك في مكان واحد.',
                  'Legal analysis, professional simulation, and executive decision support — in one place.',
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ── The ONLY action under the card ──────────────────────────── */}
        <button
          type="button"
          onClick={() => navigate('/assistant')}
          className="gold-hover-glow relative mt-9 inline-flex items-center gap-3 px-10 sm:px-14 py-4 rounded-2xl bg-gold text-background text-base sm:text-lg font-bold hover:opacity-90 transition-all shadow-lg"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 450ms ease-out 120ms, transform 450ms ease-out 120ms',
          }}
        >
          {t('ابدأ الرحلة معنا من هنا', 'Start your journey here')}
          <ArrowIcon className="w-5 h-5" aria-hidden />
        </button>
      </div>
    </AppLayout>
  );
}
