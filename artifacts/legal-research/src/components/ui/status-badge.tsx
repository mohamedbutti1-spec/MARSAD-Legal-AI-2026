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
  active:     'bg-heading/10 text-heading border-heading/25',
  inactive:   'bg-muted/40   text-muted-foreground   border-border',
  pending:    'bg-gold/10   text-gold   border-gold/25',
  success:    'bg-heading/10 text-heading border-heading/25',
  error:      'bg-destructive/10     text-destructive     border-destructive/25',
  gold:       'bg-gold/10   text-gold/75   border-gold/25',
  navy:       'bg-primary/8  text-primary     border-primary/20',
  owner:      'bg-gold/10   text-gold/75   border-gold/25',
  supervisor: 'bg-heading/10     text-heading     border-heading/25',
  viewer:     'bg-muted/40   text-muted-foreground   border-border',
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
