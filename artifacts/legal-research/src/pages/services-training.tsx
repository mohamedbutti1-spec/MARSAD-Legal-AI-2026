import React from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { ChevronLeft } from 'lucide-react';

// ─── صفحة التدريب — بيئات المحاكاة والتأهيل المهني ────────────────────────────
// كل بطاقة تفتح وحدة قائمة فعلاً عبر مسارها الحالي — بلا أي تعديل على الأتمتة.

const TRAINING_SERVICES = [
  {
    id: 'police-center',
    icon: '👮',
    nameAr: 'مركز الشرطة',
    descAr: 'محاكاة عمل مركز الشرطة: الاستدلالات، المحاضر، وإدارة الأدلة.',
    href: '/journey/police',
  },
  {
    id: 'court-session',
    icon: '🏛️',
    nameAr: 'جلسة المحكمة',
    descAr: 'غرفة المداولة القضائية الرقمية ومحاكاة الجلسات القضائية.',
    href: '/jdc',
  },
  {
    id: 'crime-scene',
    icon: '🕵️',
    nameAr: 'مسرح الجريمة',
    descAr: 'المعاينة التفاعلية: تأمين الموقع، رفع الأدلة، وسلسلة الحيازة.',
    href: '/journey/police/station-officer/crime-scene',
  },
  {
    id: 'investigation-committees',
    icon: '🗄️',
    nameAr: 'لجان التحقيق',
    descAr: 'مسار النيابة العامة: ملف التحقيق، الاستجواب، والتصرف في التحقيق.',
    href: '/journey/prosecution',
  },
  {
    id: 'legal-scenarios',
    icon: '🎯',
    nameAr: 'السيناريوهات القانونية',
    descAr: 'سيناريوهات تدريب مهنية تفاعلية متدرجة حسب دورك.',
    href: '/pgf',
  },
  {
    id: 'courses',
    icon: '🎓',
    nameAr: 'الدورات',
    descAr: 'الإرشاد المهني الذكي — مسارات تأهيل موجهة خطوة بخطوة.',
    href: '/spg',
  },
  {
    id: 'exams',
    icon: '📝',
    nameAr: 'الاختبارات',
    descAr: 'تقييم المهارات عبر نظام العمليات القانونية والمحاكاة التطبيقية.',
    href: '/legal-os',
  },
];

export default function ServicesTraining() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
        <div className="text-center space-y-2">
          <span className="text-4xl block" aria-hidden>🎓</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            خدمات التدريب
          </h1>
          <p className="text-sm text-muted-foreground">بيئات المحاكاة المهنية والتأهيل التفاعلي</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRAINING_SERVICES.map((s) => (
            <Link key={s.id} href={s.href}>
              <div className="moj-card h-full rounded-2xl border border-border p-5 flex flex-col gap-3 cursor-pointer hover:border-gold/50 hover:shadow-lg transition-all group">
                <div className="flex items-center gap-3">
                  <span className="text-3xl group-hover:scale-110 transition-transform" aria-hidden>{s.icon}</span>
                  <h2 className="text-base font-bold text-heading flex-1">{s.nameAr}</h2>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{s.descAr}</p>
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
