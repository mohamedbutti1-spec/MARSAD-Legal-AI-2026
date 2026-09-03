import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { History, ArrowUpLeft, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

interface Session { id: number; title: string; updatedAt: string; }

export default function PreviousRequestsPage() {
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

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center gap-2 mb-6">
          <History className="w-5 h-5 text-gold" />
          <h1 className="text-xl font-bold text-heading">{t('الطلبات السابقة', 'Previous Requests')}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gold" /></div>
        ) : sessions.length === 0 ? (
          <div className="moj-card rounded-xl p-8 text-center text-muted-foreground text-sm">
            {t('لا توجد طلبات سابقة بعد.', 'No previous requests yet.')}
          </div>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s) => (
              <div key={s.id} className="moj-card rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-heading truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(s.updatedAt).toLocaleString('ar-AE')}
                  </div>
                </div>
                <Link href={`/result/${s.id}`}>
                  <Button size="sm" variant="outline" data-testid={`button-open-request-${s.id}`}>
                    <ArrowUpLeft className="w-3.5 h-3.5 me-1.5" />{t('عرض النتيجة', 'View result')}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
