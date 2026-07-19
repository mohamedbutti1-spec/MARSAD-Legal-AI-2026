import React from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { ChevronLeft } from 'lucide-react';

// ─── صفحة القانون — الخدمات القانونية فقط ─────────────────────────────────────
// كل بطاقة تفتح وحدة موجودة فعلاً في المنصة عبر مسارها الحالي — لا مساس بالأتمتة.

interface LawService {
  id: string;
  icon: string;
  nameAr: string;
  descAr: string;
  href: string;
  primary?: boolean;
}

const LAW_SERVICES: LawService[] = [
  {
    id: 'decision-analysis',
    icon: '🖋️',
    nameAr: 'تحليل القرار الإداري',
    descAr: 'المنتج الرئيسي للمنصة — تحليل مشروعية القرار الإداري وفق الإطار القياسي أو M-Shamsi Framework.',
    href: '/services/law/decision-analysis',
    primary: true,
  },
  {
    id: 'judgment-analysis',
    icon: '🏛️',
    nameAr: 'تحليل الأحكام القضائية',
    descAr: 'محرك التفكير القضائي: تحليل الأحكام وبناء المنهج القضائي خطوة بخطوة.',
    href: '/jre',
  },
  {
    id: 'legislative-comparison',
    icon: '🌍',
    nameAr: 'المقارنة التشريعية',
    descAr: 'المقارنة الذكية بين التشريع الإماراتي والفرنسي والقانون المقارن.',
    href: '/uae-france',
  },
  {
    id: 'memo-drafting',
    icon: '✍️',
    nameAr: 'صياغة المذكرات القانونية',
    descAr: 'صياغة مذكرات قانونية منظمة بالشكل المهني المعتمد.',
    href: '/assistant?train=legal_memorandum',
  },
  {
    id: 'legal-reports',
    icon: '📊',
    nameAr: 'التقارير القانونية',
    descAr: 'إعداد التقارير التنفيذية والقانونية الجاهزة للاعتماد.',
    href: '/assistant?train=executive_report',
  },
  {
    id: 'legal-research',
    icon: '📚',
    nameAr: 'الدراسات والبحوث القانونية',
    descAr: 'البحث العلمي القانوني، مراجعة الأدبيات، والدراسات المقارنة.',
    href: '/assistant?train=mini_academic_research',
  },
];

export default function ServicesLaw() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
        <div className="text-center space-y-2">
          <span className="text-4xl block" aria-hidden>⚖</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            خدمات القانون
          </h1>
          <p className="text-sm text-muted-foreground">التحليل القانوني الذكي والصياغة والدراسات المقارنة</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {LAW_SERVICES.map((s) => (
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
                      المنتج الرئيسي
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
