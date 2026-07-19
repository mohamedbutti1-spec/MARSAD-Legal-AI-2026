import React from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { ChevronLeft } from 'lucide-react';
import { PathIcon } from '@/components/icons/prosecution-emblem';
import { JOURNEY_PATHS } from '@/lib/journey-catalog';

// ─── صفحة الخدمات — ثلاث بطاقات كبيرة: القانون / التدريب / المجتمع ─────────────
// إعادة تنظيم واجهة فقط: كل بطاقة تفتح صفحة محور تجمع روابط الوحدات الموجودة
// أصلاً في المنصة — لا حذف لأي وظيفة ولا تغيير في أي Route قائم.

const HUBS = [
  {
    id: 'law',
    icon: '⚖',
    nameAr: 'القانون',
    descAr:
      'التحليل القانوني الذكي: تحليل القرارات الإدارية والأحكام القضائية، المقارنة التشريعية، صياغة المذكرات، والتقارير والدراسات القانونية.',
    href: '/services/law',
    cta: 'دخول إلى خدمات القانون',
  },
  {
    id: 'training',
    icon: '🎓',
    nameAr: 'التدريب',
    descAr:
      'بيئات المحاكاة المهنية: مركز الشرطة، جلسة المحكمة، مسرح الجريمة، لجان التحقيق، والسيناريوهات القانونية التفاعلية والدورات والاختبارات.',
    href: '/services/training',
    cta: 'دخول إلى خدمات التدريب',
  },
  {
    id: 'community',
    icon: '🛡',
    nameAr: 'المجتمع',
    descAr:
      'خدمة نافع التوعوية، الحملات التوعوية، المواد التثقيفية، المؤشرات والإحصاءات، والأدلة الإرشادية للمجتمع المهني والعام.',
    href: '/services/community',
    cta: 'دخول إلى خدمات المجتمع',
  },
];

export default function ServicesHub() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            الخدمات
          </h1>
          <p className="text-sm text-muted-foreground">اختر المحور الذي تريد الدخول إليه</p>
        </div>

        {/* ── المحاور الثلاثة ── */}
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
          {HUBS.map((hub) => (
            <Link key={hub.id} href={hub.href}>
              <div className="moj-card h-full rounded-2xl border border-border p-6 sm:p-7 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-gold/50 hover:shadow-lg transition-all group">
                <span className="text-5xl group-hover:scale-110 transition-transform" aria-hidden>
                  {hub.icon}
                </span>
                <h2 className="text-xl font-bold text-heading">{hub.nameAr}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{hub.descAr}</p>
                <span className="gold-hover-glow inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-background text-sm font-bold group-hover:opacity-90 transition-all">
                  {hub.cta}
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* ── المسارات المهنية — الرحلة الموجهة الحالية كما هي ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-heading flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-gold inline-block" aria-hidden />
            المسارات المهنية الموجهة
          </h2>
          <p className="text-xs text-muted-foreground -mt-2">
            رحلة مرصد الموجهة حسب دورك المهني — بكامل مراحلها وأتمتتها الحالية.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {JOURNEY_PATHS.map((p) => (
              <Link key={p.id} href={`/journey/${p.id}`}>
                <div className="moj-card rounded-xl border border-border p-4 flex flex-col items-center gap-2.5 text-center cursor-pointer hover:border-gold/50 transition-all min-h-[110px] justify-center">
                  <PathIcon path={p} className="w-9 h-9 text-gold" />
                  <span className="text-sm font-bold text-heading leading-snug">{p.nameAr}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
