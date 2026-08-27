import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Activity,
  Archive,
  BrainCircuit,
  FileClock,
  Gauge,
  GitBranch,
  Scale,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

const TEST_ELEMENTS = [
  { id: 'function', label: 'الوظيفة الخوارزمية', desc: 'ما الدور الذي أدته المعالجة الخوارزمية داخل عملية تكوين القرار؟' },
  { id: 'contribution', label: 'درجة المساهمة', desc: 'هل كانت المساهمة معلوماتية أم استشارية أم مؤثرة أم حاسمة/شبه آلية؟' },
  { id: 'effect', label: 'الأثر في النتيجة', desc: 'إلى أي حد غيّرت المخرجات الخوارزمية مضمون القرار أو اتجاهه؟' },
  { id: 'human', label: 'التدخل البشري', desc: 'هل كانت المراجعة البشرية حقيقية وواعية وقابلة لمخالفة مخرج النظام؟' },
  { id: 'override', label: 'قابلية المخالفة', desc: 'هل يستطيع المسؤول البشري رفض التوصية الخوارزمية أو تعديلها فعليًا؟' },
  { id: 'record', label: 'التوثيق والتفسير', desc: 'هل يمكن إعادة بناء مسار التكوين وبيان أسباب الاعتماد على المخرج الخوارزمي؟' },
  { id: 'severity', label: 'جسامة الأثر', desc: 'ما مقدار الأثر القانوني أو الحقوقي أو الأمني الواقع على الشخص أو المصلحة العامة؟' },
];

const LEVELS = [
  { level: '1', title: 'معلوماتية', desc: 'النظام يجمع أو يرتب أو يعرض معلومات دون ترجيح مؤثر في النتيجة.' },
  { level: '2', title: 'استشارية', desc: 'النظام يقدم توصية أو توقعًا، مع بقاء مساحة بشرية حقيقية ومستقلة للتقدير.' },
  { level: '3', title: 'مؤثرة', desc: 'المخرج الخوارزمي يوجّه النتيجة بصورة ملموسة ويحتاج إلى رقابة وتوثيق مشددين.' },
  { level: '4', title: 'حاسمة / شبه آلية', desc: 'المخرج يحدد النتيجة أو يكاد يحددها، فتبلغ الحاجة للرقابة والتفسير أقصاها.' },
];

const MODEL = [
  { key: 'X', title: 'مساهمة جوهرية', desc: 'بلوغ المساهمة الخوارزمية درجة تؤثر جوهريًا في تكوين القرار.' },
  { key: 'Y', title: 'قصور التدخل البشري', desc: 'ضعف المراجعة الإنسانية أو تحولها إلى اعتماد شكلي غير قادر على المخالفة.' },
  { key: 'S', title: 'أثر جسيم', desc: 'ترتب أثر قانوني أو حقوقي أو أمني مرتفع الجسامة.' },
];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`moj-card rounded-2xl border border-border p-5 sm:p-6 ${className}`}>{children}</div>;
}

export default function ShamsiTheory() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-8" dir="rtl">
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-3 py-1.5 text-xs font-bold text-gold">
            <BrainCircuit className="w-4 h-4" aria-hidden />
            M-Shamsi Framework
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            نظرية الشامسي للقرار الإداري الخوارزمي المركب
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-4xl mx-auto leading-8">
            نموذج تحليلي قانوني لتحديد درجة المساهمة الخوارزمية في تكوين القرار الإداري، وفعالية التدخل البشري، ثم مواءمة مستوى الرقابة والتفسير والتوثيق مع مقدار التأثير والخطر.
          </p>
          <div className="max-w-4xl mx-auto rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm text-heading leading-7">
            لا تفترض النظرية إرادة قانونية للآلة ولا تضيف ركنًا سادسًا للقرار الإداري؛ الإسناد القانوني يبقى للإدارة، بينما تُفحص المساهمة الخوارزمية داخل عملية تكوين القرار وآثار عيوبها على عناصر المشروعية بحسب طبيعة الخلل.
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-gold" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-heading">اختبار الشامسي — سبعة عناصر</h2>
              <p className="text-xs text-muted-foreground mt-1">أداة الفحص الأساسية قبل تقدير مستوى الرقابة القضائية والإدارية.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TEST_ELEMENTS.map((item, index) => (
              <Card key={item.id} className={index === 6 ? 'lg:col-start-2' : ''}>
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg bg-gold text-background flex items-center justify-center text-xs font-black shrink-0">{index + 1}</span>
                  <div>
                    <h3 className="font-black text-heading text-sm">{item.label}</h3>
                    <p className="text-xs text-muted-foreground leading-6 mt-1.5">{item.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-gold" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-heading">سُلّم الشامسي — أربع درجات للمساهمة</h2>
              <p className="text-xs text-muted-foreground mt-1">درجة المساهمة ليست هي الوزن القانوني تلقائيًا، لكنها نقطة البداية في تقديره.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LEVELS.map((item) => (
              <Card key={item.level}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-2xl font-black text-gold">{item.level}</span>
                  <Activity className="w-5 h-5 text-gold/70" aria-hidden />
                </div>
                <h3 className="font-black text-heading">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-6 mt-2">{item.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <GitBranch className="w-6 h-6 text-gold" aria-hidden />
              <div>
                <h2 className="text-xl font-black text-heading">نموذج X / Y / S</h2>
                <p className="text-xs text-muted-foreground mt-1">قاعدة تشغيلية لتحديد الحالات التي تستدعي رقابة مشددة.</p>
              </div>
            </div>
            <div className="space-y-3">
              {MODEL.map((item) => (
                <div key={item.key} className="rounded-xl border border-border bg-muted/15 p-4 flex gap-3 items-start">
                  <span className="w-9 h-9 rounded-xl bg-gold text-background flex items-center justify-center font-black shrink-0" dir="ltr">{item.key}</span>
                  <div>
                    <p className="font-black text-heading text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-6 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-gold/25 bg-gold/5 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">قاعدة الشامسي للرقابة المشددة</p>
              <p className="font-black text-xl text-heading" dir="ltr">E = S ∨ (X ∧ Y)</p>
              <p className="text-xs text-muted-foreground leading-6 mt-2">
                تتحقق الحاجة إلى الرقابة المشددة عند وجود أثر جسيم، أو عند اجتماع المساهمة الجوهرية مع قصور التدخل البشري.
              </p>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-5">
              <Scale className="w-6 h-6 text-gold" aria-hidden />
              <div>
                <h2 className="text-xl font-black text-heading">مبدأ التناسب الرقابي</h2>
                <p className="text-xs text-muted-foreground mt-1">كلما ارتفع التأثير والخطر، ارتفعت متطلبات الرقابة والتفسير.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border p-4 flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="font-bold text-heading">تدخل بشري فعّال</p>
                  <p className="text-xs text-muted-foreground leading-6 mt-1">لا يكفي وجود توقيع بشري شكلي؛ يجب أن تكون المراجعة واعية وقادرة على المخالفة ومثبتة في السجل.</p>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4 flex items-start gap-3">
                <FileClock className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="font-bold text-heading">قابلية التفسير وإعادة البناء</p>
                  <p className="text-xs text-muted-foreground leading-6 mt-1">يجب أن يستطيع المراجع أو القاضي فهم المراحل المؤثرة في النتيجة دون اشتراط كشف تقني غير لازم عن كامل النظام.</p>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4 flex items-start gap-3">
                <Archive className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="font-bold text-heading">سجل تكوين القرار</p>
                  <p className="text-xs text-muted-foreground leading-6 mt-1">يوثق المدخلات المرجعية، المخرجات المؤثرة، مراجعات الموظف، أسباب الاعتماد أو الرفض، والتعديلات التي سبقت اعتماد القرار.</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="rounded-2xl border border-gold/30 bg-gold/5 p-5 sm:p-6 text-center">
          <p className="font-black text-heading text-lg">النتيجة التي يستخدمها مرصد</p>
          <p className="text-sm text-muted-foreground leading-7 max-w-4xl mx-auto mt-2">
            لا يكتفي مرصد بالسؤال: هل استُخدم الذكاء الاصطناعي؟ بل يحدد أين تدخل، وكم كان تأثيره، وهل كانت المراجعة البشرية حقيقية، وما مقدار الأثر؛ ثم يحدد متطلبات المشروعية والتوثيق والتفسير والرقابة المناسبة لكل حالة.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
