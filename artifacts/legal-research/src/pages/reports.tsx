import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { BarChart3, Loader2, MessageSquareText, CalendarClock } from 'lucide-react';

interface Session { id: number; title: string; updatedAt: string; }

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="moj-card rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-heading leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const t = useT();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/assistant/sessions')
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => { if (!cancelled) setSessions(d.sessions ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const last7d = sessions.filter((s) => now - new Date(s.updatedAt).getTime() <= 7 * 86400_000).length;
    const last30d = sessions.filter((s) => now - new Date(s.updatedAt).getTime() <= 30 * 86400_000).length;
    return { total: sessions.length, last7d, last30d };
  }, [sessions]);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-gold" />
          <h1 className="text-xl font-bold text-heading">{t('التقارير والإحصاءات', 'Reports & Statistics')}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gold" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <StatCard icon={<MessageSquareText className="w-5 h-5" />} label={t('إجمالي الطلبات', 'Total requests')} value={stats.total} />
              <StatCard icon={<CalendarClock className="w-5 h-5" />} label={t('آخر 7 أيام', 'Last 7 days')} value={stats.last7d} />
              <StatCard icon={<CalendarClock className="w-5 h-5" />} label={t('آخر 30 يومًا', 'Last 30 days')} value={stats.last30d} />
            </div>

            <div className="moj-card rounded-xl p-4">
              <h2 className="text-sm font-bold text-heading mb-3">{t('أحدث الطلبات', 'Most recent requests')}</h2>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('لا توجد بيانات بعد.', 'No data yet.')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {sessions.slice(0, 10).map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm border-b border-border/40 py-1.5 last:border-0">
                      <span className="truncate text-foreground/85">{s.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ms-3">{new Date(s.updatedAt).toLocaleDateString('ar-AE')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
