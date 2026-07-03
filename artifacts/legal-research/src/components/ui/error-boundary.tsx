import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="font-bold text-foreground mb-2">حدث خطأ غير متوقع</h3>
          <p className="text-sm text-muted-foreground mb-1">An unexpected error occurred</p>
          {this.state.error && (
            <code className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded mt-2 max-w-xs block truncate">
              {this.state.error.message}
            </code>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-6 gap-2"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Functional wrapper for inline error display (non-class use) */
export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/8 border border-destructive/20 text-destructive">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="text-sm flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium underline hover:no-underline shrink-0">
          إعادة
        </button>
      )}
    </div>
  );
}
