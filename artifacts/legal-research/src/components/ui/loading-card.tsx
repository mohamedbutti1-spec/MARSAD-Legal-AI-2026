import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingCardProps {
  rows?: number;
  className?: string;
  showHeader?: boolean;
}

export function LoadingCard({ rows = 3, className, showHeader = true }: LoadingCardProps) {
  return (
    <div className={cn('moj-card p-5 space-y-3 animate-pulse', className)}>
      {showHeader && (
        <div className="flex items-center gap-3 pb-3 border-b border-border/50">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-full rounded" />
          {i < rows - 1 && <Skeleton className="h-3 w-4/5 rounded" />}
        </div>
      ))}
    </div>
  );
}

export function LoadingGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingCard key={i} rows={2} />
      ))}
    </div>
  );
}

export function LoadingTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="moj-card overflow-hidden animate-pulse">
      <div className="border-b border-border bg-muted/30 px-5 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border/40 last:border-0 px-5 py-3.5 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-3 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}
