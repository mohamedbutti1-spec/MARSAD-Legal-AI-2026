import React from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { Bell, ChevronLeft } from 'lucide-react';
import { NAFE_ALERTS } from '@/lib/journey-catalog';

// ─── الإشعارات — مركز التنبيهات ───────────────────────────────────────────────
// نعرض تنبيهات نافع القائمة كمصدر الإشعارات الحالي؛ الإشعارات الشخصية قادمة.

export default function NotificationsPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        <div className="text-center space-y-2">
          <Bell className="w-8 h-8 text-gold mx-auto" aria-hidden />
          <h1 className="text-2xl font-bold text-heading">الإشعارات</h1>
          <p className="text-sm text-muted-foreground">آخر التنبيهات والتحذيرات الرسمية</p>
        </div>

        <div className="space-y-3">
          {NAFE_ALERTS.map((alert) => (
            <div key={alert.id} className="moj-card rounded-xl border border-border p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-gold">{alert.sourceAr}</span>
                <span dir="ltr">{new Date(alert.date).toLocaleDateString('ar-AE')}</span>
              </div>
              <p className="text-sm font-bold text-heading leading-snug">{alert.titleAr}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{alert.bodyAr}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/nafe">
            <span className="inline-flex items-center gap-1.5 text-sm text-gold font-bold cursor-pointer hover:underline">
              فتح خدمة نافع الكاملة <ChevronLeft className="w-4 h-4" aria-hidden />
            </span>
          </Link>
          <p className="text-[11px] text-muted-foreground/70 mt-3">
            الإشعارات الشخصية (متابعة المحادثات والمشاريع) — قيد التفعيل.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
