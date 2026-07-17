/**
 * البحث القانوني الذكي — Unified Search Hub
 * Single entry point that replaces the previously scattered search pages
 * (ai-search, kb-search, naip/search). Each tab routes straight into the
 * existing, fully-built feature page — no logic duplicated, no new features.
 */
import React from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { ScrollText, BookOpen, GitCompareArrows, Bot } from 'lucide-react';
import { Gavel } from '@/components/icons/gavel';
import { useT } from '@/lib/user-context';

interface SearchTab {
  id: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const TABS: SearchTab[] = [
  {
    id: 'legislative',
    labelAr: 'تشريعي',
    labelEn: 'Legislation',
    descAr: 'التشريعات والقوانين الإماراتية',
    icon: ScrollText,
    href: '/legislation/uae',
  },
  {
    id: 'judicial',
    labelAr: 'قضائي',
    labelEn: 'Case Law',
    descAr: 'الأحكام والاجتهادات القضائية',
    icon: Gavel,
    href: '/caselaw/uae',
  },
  {
    id: 'doctrinal',
    labelAr: 'فقهي',
    labelEn: 'Knowledge Base',
    descAr: 'قاعدة المعرفة والمراجع الفقهية',
    icon: BookOpen,
    href: '/kb-search',
  },
  {
    id: 'comparative',
    labelAr: 'مقارن',
    labelEn: 'Comparison',
    descAr: 'مقارنة الوثائق والقوانين',
    icon: GitCompareArrows,
    href: '/comparison',
  },
  {
    id: 'ai',
    labelAr: 'ذكاء اصطناعي',
    labelEn: 'AI Assistant',
    descAr: 'اسأل المساعد الذكي مباشرة',
    icon: Bot,
    href: '/assistant',
  },
];

export default function LegalSearchHub() {
  const [, navigate] = useLocation();
  const t = useT();

  return (
    <AppLayout>
      <div className="p-6 sm:p-10 max-w-4xl mx-auto" dir="rtl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {t('البحث القانوني الذكي', 'Smart Legal Search')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('اختر نوع البحث للمتابعة مباشرة', 'Choose a search type to continue')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.href)}
                className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card text-right
                           hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <span className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </span>
                <span className="flex flex-col">
                  <span className="text-base font-semibold text-foreground">{t(tab.labelAr, tab.labelEn)}</span>
                  <span className="text-xs text-muted-foreground">{tab.descAr}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
