import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-xl bg-muted/20',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className,
      )}
    >
      {icon && (
        <div className={cn('text-muted-foreground/40 mb-4', compact ? 'mb-3' : 'mb-5')}>
          <div className="[&>svg]:w-10 [&>svg]:h-10">{icon}</div>
        </div>
      )}
      <p className={cn('font-semibold text-muted-foreground', compact ? 'text-sm' : 'text-base')}>
        {title}
      </p>
      {description && (
        <p className={cn('text-muted-foreground/70 mt-1.5 max-w-xs leading-relaxed', compact ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
