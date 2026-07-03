import React from 'react';
import { cn } from '@/lib/utils';

type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'success'
  | 'error'
  | 'gold'
  | 'navy'
  | 'owner'
  | 'supervisor'
  | 'viewer';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  active:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive:   'bg-slate-50   text-slate-600   border-slate-200',
  pending:    'bg-amber-50   text-amber-700   border-amber-200',
  success:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  error:      'bg-red-50     text-red-700     border-red-200',
  gold:       'bg-amber-50   text-amber-800   border-amber-200',
  navy:       'bg-primary/8  text-primary     border-primary/20',
  owner:      'bg-amber-50   text-amber-800   border-amber-200',
  supervisor: 'bg-sky-50     text-sky-800     border-sky-200',
  viewer:     'bg-slate-50   text-slate-700   border-slate-200',
};

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ variant = 'active', children, dot, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
      )}
      {children}
    </span>
  );
}

/** Convenience: maps a role string to a StatusBadge with correct variant */
export function RoleBadge({ role, lang = 'ar' }: { role: string; lang?: 'ar' | 'en' }) {
  const config: Record<string, { ar: string; en: string; variant: StatusVariant }> = {
    owner:      { ar: 'مالك',   en: 'Owner',      variant: 'owner' },
    supervisor: { ar: 'مشرف',   en: 'Supervisor',  variant: 'supervisor' },
    viewer:     { ar: 'مشاهد',  en: 'Viewer',      variant: 'viewer' },
  };
  const c = config[role] ?? { ar: role, en: role, variant: 'inactive' as StatusVariant };
  return (
    <StatusBadge variant={c.variant}>
      {lang === 'ar' ? c.ar : c.en}
    </StatusBadge>
  );
}
