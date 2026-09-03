import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useT } from '@/lib/user-context';
import { LifeBuoy, Mail, BookOpenText, Settings } from 'lucide-react';
import { Link } from 'wouter';

export default function SupportPage() {
  const t = useT();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        <div className="flex items-center gap-2 mb-6">
          <LifeBuoy className="w-5 h-5 text-gold" />
          <h1 className="text-xl font-bold text-heading">{t('الدعم', 'Support')}</h1>
        </div>

        <div className="space-y-3">
          <div className="moj-card rounded-xl p-5">
            <h2 className="text-sm font-bold text-heading mb-2 flex items-center gap-2">
              <BookOpenText className="w-4 h-4 text-gold" />
              {t('الأسئلة الشائعة', 'Frequently asked questions')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(
                'يمكنك طرح سؤالك مباشرة من الصفحة الرئيسية عبر مربع السؤال، مع اختيار الفئة المهنية ونوع الطلب المناسبَين للحصول على أدق إجابة.',
                'Ask your question directly from the home page composer, choosing the professional category and request type that best match your case for the most accurate answer.',
              )}
            </p>
          </div>

          <div className="moj-card rounded-xl p-5">
            <h2 className="text-sm font-bold text-heading mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gold" />
              {t('تواصل معنا', 'Contact us')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-1">
              {t('لأي استفسار تقني أو إداري، راسل فريق الدعم عبر:', 'For any technical or administrative inquiry, reach the support team at:')}
            </p>
            <a href="mailto:support@marsad.local" className="text-gold text-sm underline" dir="ltr">support@marsad.local</a>
          </div>

          <Link href="/settings" className="moj-card rounded-xl p-5 flex items-center gap-3 hover:bg-muted/20 transition-colors">
            <Settings className="w-4 h-4 text-gold shrink-0" />
            <span className="text-sm font-semibold text-heading">{t('الانتقال إلى الإعدادات', 'Go to settings')}</span>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
