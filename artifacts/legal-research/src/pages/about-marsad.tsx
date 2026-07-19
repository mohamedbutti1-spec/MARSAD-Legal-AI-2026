import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { MarsadEmblem } from '@/components/icons/marsad-emblem';

// ─── عن مرصد — التعريف بالمنصة ────────────────────────────────────────────────

const PILLARS = [
  { icon: '⚖', nameAr: 'القانون',  descAr: 'تحليل قانوني ذكي للقرارات والأحكام والتشريعات المقارنة.' },
  { icon: '🎓', nameAr: 'التدريب', descAr: 'بيئات محاكاة مهنية تفاعلية للقطاعين القضائي والأمني.' },
  { icon: '🛡', nameAr: 'المجتمع', descAr: 'توعية مجتمعية ومجتمع مهني وأدلة إرشادية موثوقة.' },
];

export default function AboutMarsadPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8" dir="rtl">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20">
            <MarsadEmblem className="w-10 h-10 text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            مرصد — MARSAD
          </h1>
          <p className="text-sm font-bold text-gold tracking-widest" dir="ltr">MLOS · LEGAL AI</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            منصة قانونية ذكية تجمع بين التحليل القانوني والمحاكاة المهنية والدراسات المقارنة
            ودعم القرار التنفيذي، لتمنحك أدق المخرجات القانونية والمهنية بأعلى درجات
            الجودة والكفاءة.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {PILLARS.map((p) => (
            <div key={p.nameAr} className="moj-card rounded-xl border border-border p-5 text-center space-y-2">
              <span className="text-3xl block" aria-hidden>{p.icon}</span>
              <h2 className="text-base font-bold text-heading">{p.nameAr}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.descAr}</p>
            </div>
          ))}
        </div>

        <div className="moj-card rounded-xl border border-gold/25 p-6 text-center space-y-2">
          <p className="text-lg font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            كن في مجتمع مرصد لحفظ الوطن 🇦🇪
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            نجتمع على هدف واحد: صناعة عدالة ذكية، وحماية المجتمع، وتعزيز الأمن القانوني.
          </p>
          <p className="text-[11px] text-muted-foreground/60 pt-2" dir="ltr">
            مرصد (MARSAD) · MLOS — Legal AI · إطار الشامسي الدستوري™ Alpha 1.0
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
