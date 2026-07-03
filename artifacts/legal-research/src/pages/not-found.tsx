import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  const { lang } = useUserContext();
  const [, navigate] = useLocation();
  const isAr = lang === 'ar';

  return (
    <AppLayout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <SearchX className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h1 className="text-5xl font-bold text-foreground mb-3">404</h1>
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">
          {isAr ? 'الصفحة غير موجودة' : 'Page Not Found'}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-8">
          {isAr
            ? 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.'
            : 'The page you are looking for does not exist or has been moved.'}
        </p>
        <Button onClick={() => navigate('/')} className="gap-2">
          <Home className="w-4 h-4" />
          {isAr ? 'العودة للرئيسية' : 'Back to Dashboard'}
        </Button>
        <div className="mt-8 w-20 h-1 gold-bar rounded-full opacity-50" />
      </div>
    </AppLayout>
  );
}
