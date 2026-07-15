import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';
import { useLocation } from 'wouter';

// ─── Judicial Command Center — Dashboard ───────────────────────────────────────
// Per the visual rebuild spec: the dashboard is a single command card with one
// call to action. Every other capability (role selection, legal-context and
// answer-mode selection, quick shortcuts) still exists in the app — it now
// lives inside the AI Assistant composer (see guided-assistant-config.ts and
// ai-assistant.tsx's PreAnalysisPanel / SessionConfigBar) or the sidebar,
// rather than being duplicated on the home screen.

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
    <AppLayout>
      <div className="flex flex-col h-full overflow-y-auto bg-background">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div
            className="w-full max-w-2xl moj-card rounded-2xl px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20 text-center"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 350ms ease-out, transform 350ms ease-out',
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-[10px] font-mono font-bold tracking-widest text-gold/70 uppercase select-none">MLOS</span>
              <span className="text-border select-none">·</span>
              <span className="text-[10px] text-muted-foreground/70 font-medium">Marsad Legal Operating System</span>
            </div>

            <h1
              className="text-3xl sm:text-4xl font-bold text-heading mb-3"
              style={{ fontFamily: 'var(--app-font-serif)' }}
            >
              {t(greeting.ar, greeting.en)}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground font-medium mb-10">
              {t('منصة القرار الإداري الذكي', 'Intelligent Administrative Decision Platform')}
            </p>

            <button
              type="button"
              onClick={() => navigate('/assistant')}
              className="gold-hover-glow inline-flex items-center gap-3 px-8 py-3.5 sm:px-10 sm:py-4 rounded-xl bg-gold text-background text-base sm:text-lg font-bold hover:opacity-90 transition-all"
            >
              {t('ابدأ الرحلة معنا من هنا', 'Start your journey here')}
              <ArrowIcon className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </div>

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
