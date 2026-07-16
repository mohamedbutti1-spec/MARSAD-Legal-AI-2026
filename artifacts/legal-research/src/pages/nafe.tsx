import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Bell } from 'lucide-react';
import { NAFE_ALERTS, NAFE_CATEGORIES, type NafeCategory } from '@/lib/journey-catalog';

// ─── خدمة نافع — التوعية والتحذير من الجرم الحديث (المرفق ١) ───────────────────
// تبويبات (أحدث التنبيهات، تحذيرات مالية، إلكترونية، اجتماعية، أخرى)
// وبطاقات تنبيه + زر «أبلغ عن حالة مشبوهة».

export default function NafePage() {
  const [category, setCategory] = useState<NafeCategory | 'latest'>('latest');
  const { toast } = useToast();

  const alerts =
    category === 'latest'
      ? [...NAFE_ALERTS].sort((a, b) => b.date.localeCompare(a.date))
      : NAFE_ALERTS.filter((a) => a.category === category);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20">
            <ShieldCheck className="w-7 h-7 text-gold" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-heading">خدمة نافع — التوعية والتحذير من الجرم الحديث</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            تنبيهات توعوية من الجهات الرسمية حول أساليب الاحتيال والجرائم الحديثة — لحماية المجتمع.
          </p>
        </div>

        {/* Category tabs — ordered per the mockup */}
        <div className="flex gap-2 overflow-x-auto pb-1 justify-center flex-wrap">
          {NAFE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap border transition-all ${
                category === c.id
                  ? 'bg-gold text-background border-gold'
                  : 'border-border text-muted-foreground hover:border-gold/40'
              }`}
            >
              {c.nameAr}
            </button>
          ))}
        </div>

        {/* Alert cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="moj-card rounded-xl border border-border p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-gold">{alert.sourceAr}</span>
                <span dir="ltr">{new Date(alert.date).toLocaleDateString('ar-AE')}</span>
              </div>
              <p className="text-sm font-bold text-heading leading-snug">{alert.titleAr}</p>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{alert.bodyAr}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Bell className="w-3 h-3" aria-hidden />
                {NAFE_CATEGORIES.find((c) => c.id === alert.category)?.nameAr}
              </span>
            </div>
          ))}
          {alerts.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-10">
              لا توجد تنبيهات في هذا التصنيف حالياً
            </p>
          )}
        </div>

        {/* Report suspicious case */}
        <div className="flex justify-center">
          <Button
            className="gold-hover-glow bg-gold text-background font-bold hover:opacity-90 gap-2 px-8"
            onClick={() =>
              toast({
                title: 'الإبلاغ عن حالة مشبوهة',
                description: 'للإبلاغ الفوري تواصل مع الجهات المختصة: شرطة الإمارات 999 — أو خدمة أمان 8002626.',
              })
            }
          >
            <ShieldCheck className="w-4 h-4" aria-hidden /> أبلغ عن حالة مشبوهة
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center select-none">
          من في مجتمع مرصد لحفظ الوطن 🇦🇪
        </p>
      </div>
    </AppLayout>
  );
}
