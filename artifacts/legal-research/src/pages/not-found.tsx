import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';

export default function NotFound() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-6xl font-serif font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground font-serif">Page not found / الصفحة غير موجودة</p>
      </div>
    </AppLayout>
  );
}
