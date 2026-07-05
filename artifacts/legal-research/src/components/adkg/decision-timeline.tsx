/**
 * Phase 58 — ADKG Decision Lifecycle Timeline
 * Vertical timeline with colored event dots sorted chronologically.
 */
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useT } from '@/lib/user-context';

interface TimelineEvent {
  id: number;
  decisionId: number;
  eventType: string;
  eventDate: string;
  description?: string | null;
  descriptionAr?: string | null;
}

interface DecisionTimelineProps {
  events: TimelineEvent[];
  canEdit?: boolean;
  onAddEvent?: () => void;
  onDeleteEvent?: (id: number) => void;
}

const EVENT_STYLES: Record<string, { dot: string; bg: string; text: string; labelAr: string; labelEn: string }> = {
  draft:            { dot: '#94a3b8', bg: '#f1f5f9', text: '#475569', labelAr: 'مسودة',         labelEn: 'Draft' },
  issued:           { dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', labelAr: 'صادر',          labelEn: 'Issued' },
  challenged:       { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e', labelAr: 'مطعون فيه',     labelEn: 'Challenged' },
  suspended:        { dot: '#ef4444', bg: '#fef2f2', text: '#991b1b', labelAr: 'موقوف',         labelEn: 'Suspended' },
  amended:          { dot: '#a855f7', bg: '#faf5ff', text: '#6d28d9', labelAr: 'معدّل',          labelEn: 'Amended' },
  revoked:          { dot: '#dc2626', bg: '#fef2f2', text: '#7f1d1d', labelAr: 'ملغى',          labelEn: 'Revoked' },
  annulled:         { dot: '#7f1d1d', bg: '#fef2f2', text: '#450a0a', labelAr: 'مُبطل',         labelEn: 'Annulled' },
  executed:         { dot: '#3b82f6', bg: '#eff6ff', text: '#1e40af', labelAr: 'منفّذ',          labelEn: 'Executed' },
  appeal_filed:     { dot: '#f97316', bg: '#fff7ed', text: '#9a3412', labelAr: 'طعن مُقدَّم',   labelEn: 'Appeal Filed' },
  appeal_dismissed: { dot: '#6b7280', bg: '#f9fafb', text: '#374151', labelAr: 'طعن مرفوض',    labelEn: 'Appeal Dismissed' },
  appeal_upheld:    { dot: '#10b981', bg: '#ecfdf5', text: '#065f46', labelAr: 'طعن مقبول',     labelEn: 'Appeal Upheld' },
  court_referral:   { dot: '#8b5cf6', bg: '#f5f3ff', text: '#4c1d95', labelAr: 'إحالة قضائية', labelEn: 'Court Referral' },
  publication:      { dot: '#06b6d4', bg: '#ecfeff', text: '#0e7490', labelAr: 'نشر رسمي',      labelEn: 'Publication' },
  custom:           { dot: '#64748b', bg: '#f8fafc', text: '#334155', labelAr: 'حدث مخصص',      labelEn: 'Custom Event' },
};

export function DecisionTimeline({ events, canEdit, onAddEvent, onDeleteEvent }: DecisionTimelineProps) {
  const t = useT();

  const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          {t('المسار الزمني للقرار', 'Decision Lifecycle Timeline')}
        </h3>
        {canEdit && onAddEvent && (
          <button
            onClick={onAddEvent}
            className="flex items-center gap-1 text-xs text-[#1e3a5f] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('إضافة حدث', 'Add Event')}
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg bg-muted/10">
          {t('لا توجد أحداث زمنية بعد', 'No timeline events yet')}
        </div>
      ) : (
        <ol className="relative">
          {sorted.map((ev, i) => {
            const style = EVENT_STYLES[ev.eventType] ?? EVENT_STYLES.custom;
            const desc = ev.descriptionAr || ev.description;
            const isLast = i === sorted.length - 1;

            return (
              <li key={ev.id} className="flex gap-4 group">
                {/* Line + Dot */}
                <div className="flex flex-col items-center w-8 shrink-0">
                  <div
                    className="w-4 h-4 rounded-full mt-1 shrink-0 ring-4 ring-offset-0"
                    style={{ background: style.dot, boxShadow: `0 0 0 3px ${style.bg}` }}
                  />
                  {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: '#e2e8f0' }} />}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-5 ${isLast ? '' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: style.bg, color: style.text }}
                      >
                        {t(style.labelAr, style.labelEn)}
                      </span>
                      <span className="text-xs text-muted-foreground">{ev.eventDate}</span>
                    </div>
                    {canEdit && onDeleteEvent && (
                      <button
                        onClick={() => onDeleteEvent(ev.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                        title={t('حذف', 'Delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {desc && (
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{desc}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
