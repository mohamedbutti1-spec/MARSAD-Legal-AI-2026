import React from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { ChevronLeft } from 'lucide-react';

// ─── صفحة المجتمع — نافع والتوعية والمجتمع المهني ─────────────────────────────
// كل بطاقة تفتح وحدة قائمة فعلاً عبر مسارها الحالي — بلا أي تعديل على الأتمتة.

const COMMUNITY_SERVICES = [
  {
    id: 'nafe',
    icon: '🛡️',
    nameAr: 'نافع',
    descAr: 'خدمة التوعية والتحذير من الجرم الحديث — أحدث التنبيهات الرسمية والإبلاغ عن الحالات المشبوهة.',
    href: '/nafe',
    primary: true,
  },
  {
    id: 'campaigns',
    icon: '📢',
    nameAr: 'الحملات التوعوية',
    descAr: 'التحذيرات المالية والإلكترونية والاجتماعية مصنفة حسب النوع.',
    href: '/nafe',
  },
  {
    id: 'educational',
    icon: '📚',
    nameAr: 'المواد التثقيفية',
    descAr: 'المجتمع المهني: مشاركة الخبرات، النقاشات، والموارد المعرفية.',
    href: '/community',
  },
  {
    id: 'indicators',
    icon: '📊',
    nameAr: 'المؤشرات والإحصاءات',
    descAr: 'لوحات التحليلات والمؤشرات الإحصائية للمنصة.',
    href: '/analytics',
  },
  {
    id: 'guides',
    icon: '🧭',
    nameAr: 'الأدلة الإرشادية',
    descAr: 'بوابة المواطن: اعرف حقوقك، تقديم الشكاوى، والنماذج الإرشادية.',
    href: '/citizen',
  },
];

export default function ServicesCommunity() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
        <div className="text-center space-y-2">
          <span className="text-4xl block" aria-hidden>🛡</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            خدمات المجتمع
          </h1>
          <p className="text-sm text-muted-foreground">التوعية المجتمعية والمجتمع المهني والأدلة الإرشادية</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {COMMUNITY_SERVICES.map((s) => (
            <Link key={s.id} href={s.href}>
              <div
                className={`moj-card h-full rounded-2xl border p-5 sm:p-6 flex flex-col gap-3 cursor-pointer transition-all group hover:shadow-lg ${
                  s.primary ? 'border-gold/50 sm:col-span-2 hover:border-gold' : 'border-border hover:border-gold/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl group-hover:scale-110 transition-transform" aria-hidden>{s.icon}</span>
                  <h2 className="text-lg font-bold text-heading flex-1">{s.nameAr}</h2>
                  {s.primary && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-gold/40 bg-gold/10 text-gold shrink-0">
                      الخدمة الرئيسية
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{s.descAr}</p>
                <span className="inline-flex items-center gap-1.5 text-sm text-gold font-bold">
                  فتح الخدمة <ChevronLeft className="w-4 h-4" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
