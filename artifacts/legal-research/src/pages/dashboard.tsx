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
      {/* التخطيط التنفيذي المعتمد: بطاقة معلومات مركزية واحدة كبيرة،
          لا أقسام أسفلها — كل الأدوات الثانوية في القائمة الجانبية. */}
      <div className="flex flex-col h-full overflow-y-auto bg-background">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div
            className="w-full max-w-2xl moj-card rounded-2xl px-6 py-12 sm:px-14 sm:py-16 text-center"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 350ms ease-out, transform 350ms ease-out',
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-5">
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
            <p className="text-base sm:text-lg text-muted-foreground font-medium mb-3">
              {t('منصة القرار الإداري الذكي', 'Intelligent Administrative Decision Platform')}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed max-w-xl mx-auto mb-10">
              {t(
                'تحليل قانوني ذكي، محاكاة قضائية، حوكمة تنفيذية، وإرشاد مهني موجّه — في منظومة واحدة آمنة تعمل على بيانات محلية لا تغادر المنظومة.',
                'Smart legal analysis, judicial simulation, executive governance, and guided professional workflows — in one secure system on local data that never leaves the platform.',
              )}
            </p>

            <button
              type="button"
              onClick={() => navigate('/assistant')}
              className="gold-hover-glow inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gold text-background text-lg sm:text-xl font-bold hover:opacity-90 transition-all"
            >
              {t('ابدأ الرحلة معنا من هنا', 'Start your journey here')}
              <ArrowIcon className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
