import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { JreAuthorityEntry } from '@/types/jre';

interface AuthorityHierarchyProps {
  authorities: JreAuthorityEntry[];
  compact?: boolean;
}

const CLASS_LABELS: Record<string, { ar: string; className: string }> = {
  binding:     { ar: 'مُلزِم',   className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700' },
  persuasive:  { ar: 'مرجعي',   className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  non_binding: { ar: 'غير مُلزِم', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
};

const ROLE_LABELS: Record<string, { ar: string; className: string }> = {
  primary:    { ar: 'أساسي',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  supporting: { ar: 'داعم',     className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  contextual: { ar: 'سياقي',    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const HIERARCHY_LEVEL_LABELS: Record<string, string> = {
  '1': 'الدستور',
  '2': 'قانون اتحادي',
  '3': 'مرسوم بقانون',
  '4': 'لائحة تنفيذية',
  '5': 'قرار وزاري / إداري',
  '6': 'سابقة قضائية',
};

export function AuthorityHierarchy({ authorities, compact = false }: AuthorityHierarchyProps) {
  if (!authorities || authorities.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-6 text-sm">
        لا توجد سلطات قانونية مُدرَجة في هذا الحكم
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {authorities.map((a, idx) => {
          const cls  = CLASS_LABELS[a.authorityClass]  ?? CLASS_LABELS.non_binding;
          return (
            <div key={idx} className="flex items-start gap-2 py-1.5">
              <span className="text-xs text-muted-foreground w-5 text-right shrink-0 mt-0.5">{a.rank}.</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-right leading-snug text-foreground">{a.titleAr}</div>
                {a.ragTag && <div className="text-[10px] text-muted-foreground text-right font-mono">{a.ragTag}</div>}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${cls.className}`}>
                {cls.ar}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-right py-2 px-3 font-medium">#</th>
            <th className="text-right py-2 px-3 font-medium">السلطة القانونية</th>
            <th className="text-right py-2 px-3 font-medium">المستوى</th>
            <th className="text-right py-2 px-3 font-medium">التصنيف</th>
            <th className="text-right py-2 px-3 font-medium">الدور</th>
            <th className="text-right py-2 px-3 font-medium">الوسم</th>
          </tr>
        </thead>
        <tbody>
          {authorities.map((a, idx) => {
            const cls  = CLASS_LABELS[a.authorityClass]  ?? CLASS_LABELS.non_binding;
            const role = ROLE_LABELS[a.role]             ?? ROLE_LABELS.contextual;
            const levelLabel = HIERARCHY_LEVEL_LABELS[a.hierarchyLevel] ?? `المستوى ${a.hierarchyLevel}`;

            return (
              <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{a.rank}</td>
                <td className="py-2.5 px-3 font-medium max-w-[260px]">
                  <div className="leading-snug">{a.titleAr}</div>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground text-xs">{levelLabel}</td>
                <td className="py-2.5 px-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${cls.className}`}>
                    {cls.ar}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${role.className}`}>
                    {role.ar}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                  {a.ragTag ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
