import React from 'react';
import { Redirect } from 'wouter';
import { useUserContext } from '@/lib/user-context';
import { AppLayout } from '@/components/layout/app-layout';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RouteGuardProps {
  /** Returns true when the current user is allowed to view this route */
  allow: boolean;
  /** Where to send unauthorized visitors (defaults to '/') */
  redirectTo?: string;
  children: React.ReactNode;
}

/**
 * Client-side route guard. Renders children when `allow` is true;
 * otherwise shows a styled 403 page and redirects.
 *
 * NOTE: this is a UX guard only. The backend enforces authz independently
 * via X-User-Role middleware — never rely on this for security.
 */
export function RouteGuard({ allow, redirectTo = '/', children }: RouteGuardProps) {
  const { lang } = useUserContext();
  const isAr = lang === 'ar';

  if (!allow) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isAr ? 'غير مصرح بالوصول' : 'Access Denied'}
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mb-8">
            {isAr
              ? 'ليس لديك صلاحية للوصول إلى هذه الصفحة. تواصل مع مالك المنصة.'
              : 'You do not have permission to access this page. Contact your platform owner.'}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => window.history.back()}>
              {isAr ? '← رجوع' : '← Go back'}
            </Button>
            <Redirect to={redirectTo} />
          </div>
          <div className="mt-8 w-16 h-1 gold-bar rounded-full opacity-40" />
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
