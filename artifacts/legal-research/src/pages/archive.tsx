import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useT } from '@/lib/user-context';
import { Archive as ArchiveIcon, Trash2, ArrowUpLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { getArchive, removeFromArchive, type ArchiveEntry } from '@/lib/marsad-local-store';

export default function ArchivePage() {
  const t = useT();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);

  useEffect(() => { setEntries(getArchive()); }, []);

  const handleRemove = (id: number) => {
    removeFromArchive(id);
    setEntries(getArchive());
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center gap-2 mb-6">
          <ArchiveIcon className="w-5 h-5 text-gold" />
          <h1 className="text-xl font-bold text-heading">{t('الأرشيف', 'Archive')}</h1>
        </div>

        {entries.length === 0 ? (
          <div className="moj-card rounded-xl p-8 text-center text-muted-foreground text-sm">
            {t(
              'لا توجد عناصر محفوظة بعد. من صفحة النتيجة، استخدم زر "حفظ في الأرشيف" لإضافة طلب هنا.',
              'Nothing saved yet. From a result page, use "Save to archive" to add a request here.',
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {entries.map((e) => (
              <div key={e.sessionId} className="moj-card rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-heading truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(e.savedAt).toLocaleString('ar-AE')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link href={`/result/${e.sessionId}`}>
                    <Button size="sm" variant="outline" data-testid={`button-open-archive-${e.sessionId}`}>
                      <ArrowUpLeft className="w-3.5 h-3.5 me-1.5" />{t('فتح', 'Open')}
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(e.sessionId)} data-testid={`button-remove-archive-${e.sessionId}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
