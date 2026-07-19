import React from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { LifeBuoy, ChevronLeft } from 'lucide-react';

// ─── المساعدة — دليل استخدام سريع ────────────────────────────────────────────

const HELP_TOPICS = [
  {
    icon: '💬',
    titleAr: 'كيف أطرح سؤالاً قانونياً؟',
    bodyAr: 'من الصفحة الرئيسية: اكتب سؤالك في مربع السؤال، اضبط إعدادات التحليل أسفله (نوع الإجابة، النظام القانوني، الفرع، مستوى التحليل)، ثم اضغط إرسال. سيفتح المساعد الذكي وتبدأ الإجابة مباشرة.',
    href: '/',
    linkAr: 'الصفحة الرئيسية',
  },
  {
    icon: '🖋️',
    titleAr: 'كيف أحلل قراراً إدارياً؟',
    bodyAr: 'من الخدمات ← القانون ← تحليل القرار الإداري: الصق نص القرار، اختر إطار التحليل (القياسي أو M-Shamsi للمصرح لهم)، ثم ابدأ التحليل.',
    href: '/services/law/decision-analysis',
    linkAr: 'تحليل القرار الإداري',
  },
  {
    icon: '🎓',
    titleAr: 'أين أجد بيئات التدريب؟',
    bodyAr: 'من الخدمات ← التدريب: مركز الشرطة، جلسة المحكمة، مسرح الجريمة، لجان التحقيق، والسيناريوهات القانونية.',
    href: '/services/training',
    linkAr: 'خدمات التدريب',
  },
  {
    icon: '📎',
    titleAr: 'كيف أرفق ملفاً للتحليل؟',
    bodyAr: 'استخدم زر «إرفاق ملف» في الصفحة الرئيسية لرفع مستندات PDF أو DOCX أو TXT، ثم اسأل عنها في المساعد الذكي.',
    href: '/upload',
    linkAr: 'رفع الملفات',
  },
  {
    icon: '🗂️',
    titleAr: 'أين أجد أعمالي السابقة؟',
    bodyAr: 'المحادثات في «المحادثات»، مشاريع البحث في «مشاريعي»، المستندات في «ملفاتي»، والمكتبة الشخصية في «المفضلة» — كلها في القائمة الجانبية.',
    href: '/workspace',
    linkAr: 'مشاريعي',
  },
];

export default function HelpPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        <div className="text-center space-y-2">
          <LifeBuoy className="w-8 h-8 text-gold mx-auto" aria-hidden />
          <h1 className="text-2xl font-bold text-heading">المساعدة</h1>
          <p className="text-sm text-muted-foreground">دليل سريع لاستخدام منصة مرصد</p>
        </div>

        <div className="space-y-3">
          {HELP_TOPICS.map((t) => (
            <div key={t.titleAr} className="moj-card rounded-xl border border-border p-5 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xl" aria-hidden>{t.icon}</span>
                <h2 className="text-base font-bold text-heading">{t.titleAr}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.bodyAr}</p>
              <Link href={t.href}>
                <span className="inline-flex items-center gap-1 text-xs text-gold font-bold cursor-pointer hover:underline">
                  {t.linkAr} <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
