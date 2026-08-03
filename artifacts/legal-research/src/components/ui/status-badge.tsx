import React from 'react';
import { cn } from '@/lib/utils';
import { ROLE_META, type UserRole } from '@/lib/permissions';

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
  | 'viewer'
  | 'executive'
  | 'oversight'
  | 'judicial'
  | 'public'
  | 'access-tier'
  | 'legal-professional'
  | 'academic'
  | 'demo';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  active:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive:    'bg-slate-50   text-slate-600   border-slate-200',
  pending:     'bg-gold/10   text-gold   border-gold/25',
  success:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  error:       'bg-red-50     text-red-700     border-red-200',
  gold:        'bg-gold/10   text-gold/75   border-gold/25',
  navy:        'bg-primary/8  text-primary     border-primary/20',
  owner:       'bg-gold/10   text-gold/75   border-gold/25',
  supervisor:  'bg-sky-50     text-sky-800     border-sky-200',
  viewer:      'bg-slate-50   text-slate-700   border-slate-200',
  executive:   'bg-violet-50  text-violet-700  border-violet-200',
  oversight:   'bg-amber-50   text-amber-700   border-amber-200',
  judicial:    'bg-indigo-50  text-indigo-700  border-indigo-200',
  public:      'bg-slate-50   text-slate-600   border-slate-200',
  'access-tier': 'bg-teal-50  text-teal-700    border-teal-200',
  'legal-professional': 'bg-rose-50 text-rose-700 border-rose-200',
  academic:    'bg-cyan-50   text-cyan-700    border-cyan-200',
  demo:        'bg-neutral-50 text-neutral-600 border-neutral-200',
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

// Roles with a dedicated, historically-established variant; every other role
// falls back to a variant derived from its ROLE_META tier (executive/
// oversight/judicial/public/access-tier), so newly added roles (admin,
// professional_user) render sensibly without needing a bespoke entry here.
const ROLE_VARIANT_OVERRIDES: Partial<Record<UserRole, StatusVariant>> = {
  owner: 'owner',
  supervisor: 'supervisor',
  viewer: 'viewer',
};

/** Convenience: maps a role string to a StatusBadge with correct variant */
export function RoleBadge({ role, lang = 'ar' }: { role: string; lang?: 'ar' | 'en' }) {
  const meta = ROLE_META[role as UserRole];
  if (!meta) {
    return <StatusBadge variant="inactive">{role}</StatusBadge>;
  }
  const variant = ROLE_VARIANT_OVERRIDES[role as UserRole] ?? (meta.tier as StatusVariant);
  return (
    <StatusBadge variant={variant}>
      {lang === 'ar' ? meta.ar : meta.en}
    </StatusBadge>
  );
}
