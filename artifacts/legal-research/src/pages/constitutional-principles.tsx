/**
 * Constitutional Principles — MARSAD Constitutional Standard v1.0
 * Immutable governance page. Updated only through a formal version upgrade.
 * Institutional-grade. Arabic-first. Fully RTL.
 */
import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Shield, Scale, Eye, Users, FileSearch, BarChart2, ClipboardCheck, RotateCcw, Activity } from 'lucide-react';
import { Gavel } from '@/components/icons/gavel';

// ─── Constitutional Data ────────────────────────────────────────────────────

const MISSION =
  'تمكين القرارات الإدارية الذكية من أن تكون أكثر مشروعيةً وشفافيةً وقابليةً للتفسير والمساءلة والحوكمة — من خلال إطار قانوني قابل للقياس.';

const MISSION_EN =
  'To make Intelligent Administrative Decisions more lawful, transparent, explainable, accountable and governable through a measurable legal framework.';

interface Principle {
  number: number;
  nameAr: string;
  nameEn: string;
  textAr: string;
  textEn: string;
  icon: React.ReactNode;
  isFoundational?: boolean;
}

const PRINCIPLES: Principle[] = [
  {
    number: 1,
    nameAr: 'الذكاء يخدم القانون',
    nameEn: 'AI Serves the Law',
    textAr:
      'لا يُعدَّل القانون ليتناسب مع الذكاء الاصطناعي. الذكاء الاصطناعي هو الذي يُعدَّل دائماً ليتناسب مع القانون.',
    textEn:
      'MARSAD shall never adapt the law to fit Artificial Intelligence. Artificial Intelligence shall always be adapted to fit the law.',
    icon: <Shield className="w-5 h-5" />,
    isFoundational: true,
  },
  {
    number: 2,
    nameAr: 'المشروعية',
    nameEn: 'Legality',
    textAr:
      'كل قرار إداري يُقيَّم أو يُنتج داخل مرصد يجب أن يكون مستنداً إلى القانون الوضعي النافذ. لا يعلو أي مخرج من الذكاء الاصطناعي على نص قانوني.',
    textEn:
      'Every administrative decision evaluated or generated within MARSAD must be grounded in applicable positive law. No AI output supersedes a legal provision.',
    icon: <Scale className="w-5 h-5" />,
  },
  {
    number: 3,
    nameAr: 'الشفافية',
    nameEn: 'Transparency',
    textAr:
      'جميع عمليات اتخاذ القرار وسلاسل الاستدلال في الذكاء الاصطناعي ومعايير التقييم يجب أن تكون مرئية وقابلة للتدقيق وموثقة توثيقاً كاملاً. لا مخرجات غامضة.',
    textEn:
      'All decision processes, AI reasoning chains, and evaluation criteria must be visible, auditable, and fully documented. No black-box outcomes.',
    icon: <Eye className="w-5 h-5" />,
  },
  {
    number: 4,
    nameAr: 'الرقابة البشرية',
    nameEn: 'Human Oversight',
    textAr:
      'يدعم الذكاء الاصطناعي الحكم البشري ولا يحل محله. كل قرار يجب أن يحمل اسم مسؤول بشري وتقع عليه مسؤوليته.',
    textEn:
      'Artificial Intelligence shall support human judgment and never substitute it. Every decision must bear the name and accountability of a human official.',
    icon: <Users className="w-5 h-5" />,
  },
  {
    number: 5,
    nameAr: 'القابلية للتفسير',
    nameEn: 'Explainability',
    textAr:
      'كل تقييم يُنتجه الذكاء الاصطناعي يجب أن يكون قابلاً للتعبير عنه بلغة قانونية. يجب أن تكون كل مخرجات الخوارزمية قابلة للترجمة الكاملة إلى استدلال قانوني يمكن لقاضٍ أو مسؤول إداري التصرف بناءً عليه.',
    textEn:
      'Every AI assessment must be expressible in legal language. Algorithmic outputs must be fully translatable into legal reasoning that a judge or administrator can act upon.',
    icon: <FileSearch className="w-5 h-5" />,
  },
  {
    number: 6,
    nameAr: 'التناسب',
    nameEn: 'Proportionality',
    textAr:
      'يُقاس كل قرار إداري بمبدأ التناسب بين الوسائل المستخدمة والغرض المشروع المنشود. وجود الغاية المشروعة وحده لا يُسوِّغ الوسيلة المفرطة.',
    textEn:
      'Every administrative decision shall be measured against the principle of proportionality between the means employed and the legitimate purpose pursued.',
    icon: <BarChart2 className="w-5 h-5" />,
  },
  {
    number: 7,
    nameAr: 'ضمانات الإجراءات القانونية',
    nameEn: 'Due Process',
    textAr:
      'يجب الاعتراف بالحقوق الإجرائية لجميع الأطراف المتضررة وحمايتها وتوثيقها في كل مرحلة من مراحل دورة حياة القرار.',
    textEn:
      'The procedural rights of all affected parties must be recognised, protected, and documented throughout every stage of the decision lifecycle.',
    icon: <ClipboardCheck className="w-5 h-5" />,
  },
  {
    number: 8,
    nameAr: 'المساءلة',
    nameEn: 'Accountability',
    textAr:
      'كل قرار وتقييم وإجراء داخل مرصد ينسب بصفة دائمة إلى فاعل بشري مسمى، مع الطابع الزمني وعدم قابليته للتغيير. لا مخرجات مجهولة.',
    textEn:
      'Every decision, assessment, and action within MARSAD is permanently attributed to a named human actor, timestamped, and immutable. No anonymous outputs.',
    icon: <ClipboardCheck className="w-5 h-5" />,
  },
  {
    number: 9,
    nameAr: 'قابلية المراجعة القضائية',
    nameEn: 'Judicial Reviewability',
    textAr:
      'يجب أن يظل كل قرار إداري خاضعاً للمراجعة الكاملة والطعن والرقابة القضائية. لا يكون أي مخرج من مرصد محصناً من الطعن القانوني.',
    textEn:
      'Every administrative decision must remain subject to full review, appeal, and judicial oversight. No MARSAD output shall be immune from legal challenge.',
    icon: <Gavel className="w-5 h-5" />,
  },
  {
    number: 10,
    nameAr: 'المشروعية المستمرة',
    nameEn: 'Continuous Legitimacy',
    textAr:
      'المشروعية ليست عتبة تُبلَغ مرةً واحدة. إنها التزام مستمر. يقيسها مرصد بصفة دائمة ويُبلِّغ عنها بشفافية كاملة.',
    textEn:
      'Legitimacy is not a threshold to be reached once. It is a continuous obligation. MARSAD measures it permanently and reports it with full transparency.',
    icon: <Activity className="w-5 h-5" />,
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConstitutionalPrinciples() {
  return (
    <AppLayout>
      <div dir="rtl" className="space-y-10 pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="border-b border-border/60 pb-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                <Shield className="w-3.5 h-3.5" />
                <span>المعيار الدستوري لمرصد</span>
                <span className="text-border/80">·</span>
                <span dir="ltr">MARSAD Constitutional Standard</span>
              </div>

              <h1 className="text-3xl font-bold text-foreground leading-tight">
                المبادئ الدستورية
              </h1>
              <p className="text-base text-muted-foreground font-medium" dir="ltr">
                Constitutional Principles
              </p>
            </div>

            {/* Version badge */}
            <div className="shrink-0 text-end">
              <div className="inline-flex flex-col items-end gap-1 px-4 py-3 rounded-lg border border-border/60 bg-muted/30">
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">الإصدار</span>
                <span className="text-sm font-bold text-foreground font-mono" dir="ltr">v 1.0</span>
                <span className="text-[10px] text-muted-foreground/70">ثابت · لا يُعدَّل إلا بترقية رسمية</span>
              </div>
            </div>
          </div>

          {/* Immutability notice */}
          <div className="mt-6 flex items-start gap-3 px-4 py-3 rounded-lg bg-gold/60 dark:bg-gold/20 border border-gold/60 dark:border-gold/40">
            <Shield className="w-4 h-4 text-gold dark:text-gold/80 mt-0.5 shrink-0" />
            <p className="text-sm text-gold/75 dark:text-gold/40 leading-relaxed">
              هذه الصفحة ثابتة وغير قابلة للتعديل إلا من خلال ترقية رسمية للإصدار.
              <span className="mx-2 text-gold/60">·</span>
              <span dir="ltr" className="text-gold dark:text-gold/80">
                This page is immutable except through a formal version upgrade.
              </span>
            </p>
          </div>
        </header>

        {/* ── Mission ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            الرسالة
          </h2>
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
            <p className="text-lg font-semibold text-foreground leading-relaxed">
              {MISSION}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed" dir="ltr">
              {MISSION_EN}
            </p>
          </div>
        </section>

        {/* ── Constitutional Rule No.1 ────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            القاعدة الدستورية الأولى
          </h2>
          <div className="rounded-xl border-2 border-foreground/20 bg-foreground/[0.03] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-foreground/10 border border-foreground/15 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-foreground/70" />
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">
                  Constitutional Rule No. 1
                </div>
                <div className="font-bold text-base text-foreground">الذكاء يخدم القانون</div>
              </div>
            </div>
            <blockquote className="border-r-2 border-foreground/20 pr-4 space-y-2">
              <p className="text-foreground font-semibold text-base leading-relaxed">
                لا يُعدَّل القانون ليتناسب مع الذكاء الاصطناعي.
                الذكاء الاصطناعي هو الذي يُعدَّل دائماً ليتناسب مع القانون.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed" dir="ltr">
                MARSAD shall never adapt the law to fit Artificial Intelligence.
                Artificial Intelligence shall always be adapted to fit the law.
              </p>
            </blockquote>
          </div>
        </section>

        {/* ── Ten Principles ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            المبادئ الدستورية العشرة
          </h2>

          <div className="space-y-3">
            {PRINCIPLES.map((p) => (
              <article
                key={p.number}
                className="rounded-xl border border-border/60 bg-card hover:border-border transition-colors duration-150"
              >
                <div className="flex items-start gap-4 p-5">
                  {/* Number */}
                  <div className="shrink-0 w-10 h-10 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center">
                    <span className="text-sm font-bold text-muted-foreground font-mono tabular-nums">
                      {String(p.number).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-foreground leading-tight">
                        {p.nameAr}
                      </h3>
                      <span className="text-xs font-medium text-muted-foreground/70 tracking-wide" dir="ltr">
                        {p.nameEn}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {p.textAr}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed" dir="ltr">
                      {p.textEn}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Framework Governance ───────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            حوكمة الإطار
          </h2>

          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">
                    Framework
                  </div>
                  <div className="font-bold text-foreground text-base" dir="ltr">
                    The M. Al-Shamsi Framework™
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-background text-xs font-semibold text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Research Framework
                  </span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/40">
              {[
                {
                  labelAr: 'الحالة',
                  labelEn: 'Status',
                  valueAr: 'إطار بحثي',
                  valueEn: 'Research Framework',
                },
                {
                  labelAr: 'التحقق',
                  labelEn: 'Validation',
                  valueAr: 'قيد المراجعة الأكاديمية المستمرة',
                  valueEn: 'Under Continuous Academic Review',
                },
                {
                  labelAr: 'الإصدار',
                  labelEn: 'Version',
                  valueAr: '1.0',
                  valueEn: '1.0',
                  mono: true,
                },
                {
                  labelAr: 'تُديره',
                  labelEn: 'Maintained by',
                  valueAr: 'فريق أبحاث مرصد',
                  valueEn: 'MARSAD Research Team',
                },
              ].map((row) => (
                <div key={row.labelEn} className="flex items-center px-5 py-3 gap-4">
                  <div className="w-44 shrink-0">
                    <div className="text-xs font-semibold text-foreground/80">{row.labelAr}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5" dir="ltr">{row.labelEn}</div>
                  </div>
                  <div className={`text-sm text-foreground/90 ${row.mono ? 'font-mono' : ''}`}>
                    {row.valueAr}
                    {row.valueAr !== row.valueEn && (
                      <span className="text-muted-foreground/50 mx-2">·</span>
                    )}
                    {row.valueAr !== row.valueEn && (
                      <span className="text-muted-foreground/70 text-xs" dir="ltr">{row.valueEn}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Constitutional Acceptance Criteria ─────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            معايير القبول الدستوري
          </h2>
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground leading-relaxed">
              كل وحدة في مرصد يجب أن تستوفي جميع معايير القبول الدستورية قبل الإصدار.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed" dir="ltr">
              Every module within MARSAD shall satisfy all constitutional acceptance criteria before release.
              Acceptance is measured against legal value, institutional readiness, transparency, explainability,
              human oversight, due process, accountability, proportionality, judicial reviewability,
              and continuous legitimacy — not against numerical thresholds.
            </p>
            <div className="pt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                'القيمة القانونية',
                'الجاهزية المؤسسية',
                'الشفافية',
                'القابلية للتفسير',
                'الرقابة البشرية',
                'ضمانات الإجراءات',
                'المساءلة',
                'التناسب',
                'قابلية المراجعة',
                'المشروعية المستمرة',
              ].map((criterion) => (
                <div
                  key={criterion}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-medium text-foreground/80 leading-tight">{criterion}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  );
}
