import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ArrowLeft, ArrowRight, Library, MessagesSquare, Users, Clock } from 'lucide-react';
import { useUserContext, useT, ROLE_META } from '@/lib/user-context';
import { useLocation } from 'wouter';
import { apiFetch } from '@/lib/api-fetch';

// ─── Judicial Command Center — Dashboard ───────────────────────────────────────
// Per the visual rebuild spec: the dashboard is a single command card with one
// call to action. The card carries the greeting, the signed-in role, a quiet
// statistics row and the latest activity — no other cards, shortcuts or
// duplicated services. Every other capability lives in the sidebar (including
// the legal-context selectors) or inside the AI Assistant composer.

function getGreeting(): { ar: string; en: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { ar: 'صباح الخير', en: 'Good morning' };
  if (hour >= 12 && hour < 18) return { ar: 'مساء الخير', en: 'Good afternoon' };
  return { ar: 'مساء الخير', en: 'Good evening' };
}

interface DashboardStats {
  legalSourcesCount: number;
  aiQueriesThisMonth: number;
  activeUsers: number;
  totalUsers: number;
}

interface RecentSession { id: number; title: string; updatedAt: string; }

function formatRelativeTime(iso: string, lang: 'ar' | 'en'): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 60) return lang === 'ar' ? `قبل ${mins} دقيقة` : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return lang === 'ar' ? `قبل ${hours} ساعة` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return lang === 'ar' ? `قبل ${days} يوم` : `${days} d ago`;
}

export default function Dashboard() {
  const { lang, role, canUseAi } = useUserContext();
  const t = useT();
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [latestSession, setLatestSession] = useState<RecentSession | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Quiet, best-effort data for the card — roles without access to either
  // endpoint (e.g. citizen) simply see the card without that section.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch('/api/dashboard/stats');
        if (r.ok) {
          const d = (await r.json()) as DashboardStats;
          if (!cancelled) setStats(d);
        }
      } catch { /* stats are decorative — never block the card */ }
    })();
    if (canUseAi) {
      (async () => {
        try {
          const r = await apiFetch('/api/assistant/sessions');
          if (r.ok) {
            const d = (await r.json()) as { sessions?: RecentSession[] };
            const latest = d.sessions?.[0];
            if (!cancelled && latest) setLatestSession(latest);
          }
        } catch { /* same — best effort */ }
      })();
    }
    return () => { cancelled = true; };
  }, [canUseAi]);

  const greeting = getGreeting();
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;
  const roleMeta = ROLE_META[role];

  const statItems = stats
    ? [
        {
          icon: Library,
          value: stats.legalSourcesCount,
          labelAr: 'مصدر قانوني',
          labelEn: 'Legal sources',
        },
        {
          icon: MessagesSquare,
          value: stats.aiQueriesThisMonth,
          labelAr: 'استفسار ذكي هذا الشهر',
          labelEn: 'AI queries this month',
        },
        {
          icon: Users,
          value: stats.activeUsers,
          labelAr: 'مستخدم نشط',
          labelEn: 'Active users',
        },
      ]
    : [];

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-y-auto bg-background">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div
            className="w-full max-w-lg moj-card rounded-xl px-6 py-10 sm:px-10 sm:py-12 text-center"
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
              className="text-2xl sm:text-3xl font-bold text-heading mb-2"
              style={{ fontFamily: 'var(--app-font-serif)' }}
            >
              {t(greeting.ar, greeting.en)}
            </h1>

            {/* Signed-in role — sourced from the server-verified session */}
            {roleMeta && (
              <div className="flex items-center justify-center mb-3">
                <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-md border border-gold/30 bg-gold/10 text-gold">
                  {lang === 'ar' ? roleMeta.ar : roleMeta.en}
                </span>
              </div>
            )}

            <p className="text-sm sm:text-base text-muted-foreground font-medium mb-6">
              {t('منصة القرار الإداري الذكي', 'Intelligent Administrative Decision Platform')}
            </p>

            {/* Statistics — quiet inline row, part of the same single card */}
            {statItems.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-6 pt-5 border-t border-border/40">
                {statItems.map((s) => (
                  <div key={s.labelEn} className="flex flex-col items-center gap-1">
                    <s.icon className="w-4 h-4 text-gold/60" aria-hidden />
                    <span className="text-lg font-bold text-heading leading-none">
                      {s.value.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 leading-tight">
                      {t(s.labelAr, s.labelEn)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Latest activity — most recent assistant session */}
            {latestSession && (
              <div className="flex items-center justify-center gap-2 mb-6 text-[11px] text-muted-foreground/80">
                <Clock className="w-3.5 h-3.5 text-gold/50 shrink-0" aria-hidden />
                <span className="truncate max-w-[16rem]" title={latestSession.title}>
                  {t('آخر نشاط:', 'Latest activity:')} {latestSession.title}
                </span>
                <span className="text-muted-foreground/50 shrink-0">
                  {formatRelativeTime(latestSession.updatedAt, lang)}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/assistant')}
              className="gold-hover-glow inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gold text-background text-sm sm:text-base font-bold hover:opacity-90 transition-all"
            >
              {t('ابدأ الرحلة معنا من هنا', 'Start your journey here')}
              <ArrowIcon className="w-4 h-4" aria-hidden />
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
