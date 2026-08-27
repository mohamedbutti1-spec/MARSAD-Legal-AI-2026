import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { apiFetch } from '@/lib/api-fetch';
import {
  BrainCircuit,
  ChevronLeft,
  FileSearch,
  FileText,
  Gauge,
  Loader2,
  Lock,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { MARSAD_SERVICES } from '@/lib/journey-catalog';

type Choice = {
  id: string;
  label: string;
  description?: string;
};

const JURISDICTIONS: Choice[] = [
  { id: 'uae', label: 'القانون الإماراتي', description: 'التشريعات والأحكام والمبادئ الإماراتية' },
  { id: 'france', label: 'القانون الفرنسي', description: 'التشريع والقضاء الإداري الفرنسي' },
  { id: 'comparative', label: 'مقارن', description: 'تحليل إماراتي–فرنسي مقارن' },
];

const ANSWER_MODES: Choice[] = [
  { id: 'quick', label: 'سريع', description: 'خلاصة عملية مباشرة' },
  { id: 'analysis', label: 'تحليل', description: 'تحليل قانوني متدرج ومعلل' },
  { id: 'template', label: 'نموذج', description: 'مخرج جاهز للاستخدام والصياغة' },
];

const FRAMEWORKS: Choice[] = [
  { id: 'uae', label: 'الإطار الإماراتي' },
  { id: 'france', label: 'الإطار الفرنسي' },
  { id: 'comparative', label: 'الإطار المقارن' },
  { id: 'shamsi', label: 'نظرية الشامسي', description: 'درجة المساهمة الخوارزمية والوزن القانوني والرقابة المتناسبة' },
];

const SERVICES: Choice[] = [
  { id: 'decision', label: 'فحص قرار إداري', description: 'اختبار المشروعية والمخاطر وأثر المساهمة الخوارزمية' },
  { id: 'memo', label: 'مذكرة قانونية', description: 'بناء مذكرة منظمة مع الحجج والمراجع' },
  { id: 'consultation', label: 'استشارة قانونية', description: 'تحليل سؤال أو واقعة واقتراح مسار عمل' },
];

const OUTPUTS: Choice[] = [
  { id: 'answer', label: 'إجابة' },
  { id: 'analysis', label: 'تحليل' },
  { id: 'memo', label: 'مذكرة' },
  { id: 'judgment', label: 'صياغة حكم' },
  { id: 'report', label: 'تقرير' },
  { id: 'research', label: 'بحث' },
];

const CORE_ENGINES = [
  {
    id: 'intelligence',
    title: 'MARSAD Intelligence',
    subtitle: 'تحليل قانوني ذكي للمسألة والقرار والمستند',
    icon: BrainCircuit,
  },
  {
    id: 'audit',
    title: 'MARSAD Audit',
    subtitle: 'تدقيق المشروعية والإجراءات وقابلية التفسير والتوثيق',
    icon: ShieldCheck,
  },
  {
    id: 'score',
    title: 'MARSAD Score',
    subtitle: 'قياس درجة المساهمة الخوارزمية ومستوى الرقابة المطلوبة',
    icon: Gauge,
  },
] as const;

function SelectCard({
  item,
  selected,
  onSelect,
  disabled = false,
  locked = false,
}: {
  item: Choice;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`text-right rounded-xl border p-3.5 transition-all min-h-[82px] ${
        selected
          ? 'border-gold bg-gold/10 shadow-sm'
          : 'border-border bg-card hover:border-gold/40 hover:bg-gold/5'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-sm text-heading">{item.label}</span>
        {locked && <Lock className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" aria-hidden />}
      </div>
      {item.description && (
        <p className="text-[11px] leading-relaxed text-muted-foreground mt-1.5">{item.description}</p>
      )}
    </button>
  );
}

function StepHeader({ number, title, subtitle }: { number: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <span className="w-7 h-7 rounded-lg bg-gold text-background text-xs font-black flex items-center justify-center shrink-0">
        {number}
      </span>
      <div>
        <h2 className="font-bold text-heading text-base">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function choiceLabel(items: Choice[], id: string) {
  return items.find((item) => item.id === id)?.label ?? id;
}

export default function JourneyHome() {
  const { canUseShamsiFramework, canUpload } = useUserContext();
  const [, navigate] = useLocation();
  const [jurisdiction, setJurisdiction] = useState('uae');
  const [answerMode, setAnswerMode] = useState('analysis');
  const [framework, setFramework] = useState(canUseShamsiFramework ? 'shamsi' : 'uae');
  const [service, setService] = useState('decision');
  const [output, setOutput] = useState('analysis');
  const [taskText, setTaskText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  async function startAnalysis() {
    const trimmedTask = taskText.trim();
    if (!trimmedTask) {
      setStartError('اكتب السؤال أو صف القرار/الواقعة أولاً.');
      return;
    }

    setStarting(true);
    setStartError('');
    let uploadedDocument: { id?: number; title?: string; filename?: string } | null = null;

    try {
      if (attachment) {
        if (!canUpload) {
          throw new Error('حسابك لا يملك صلاحية رفع الملفات إلى مكتبة مرصد.');
        }
        const formData = new FormData();
        formData.append('file', attachment);
        formData.append('category', 'marsad');
        const uploadRes = await apiFetch('/api/documents/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data?.error || 'تعذر رفع المستند إلى مكتبة مرصد.');
        }
        uploadedDocument = await uploadRes.json().catch(() => ({ filename: attachment.name }));
      }

      const legalReference = framework === 'shamsi'
        ? 'shamsi'
        : jurisdiction === 'france'
          ? 'france'
          : jurisdiction === 'comparative'
            ? 'comparative'
            : 'uae';

      const answerStyle = answerMode === 'quick' ? 'quick' : answerMode === 'analysis' ? 'detailed' : 'standard';
      const config = {
        userCategory: 'general_user',
        userType: 'unspecified',
        answerStyle,
        legalReference,
        legalBranch: 'admin',
        trainingMode: false,
      };

      const documentName = uploadedDocument?.title || uploadedDocument?.filename || attachment?.name || '';
      const prompt = [
        'مهمة جديدة من واجهة مرصد الموحدة.',
        `الخدمة: ${choiceLabel(SERVICES, service)}.`,
        `المرجعية القانونية: ${choiceLabel(JURISDICTIONS, jurisdiction)}.`,
        `إطار التحليل: ${choiceLabel(FRAMEWORKS, framework)}.`,
        `أسلوب الإجابة: ${choiceLabel(ANSWER_MODES, answerMode)}.`,
        `المخرج المطلوب: ${choiceLabel(OUTPUTS, output)}.`,
        framework === 'shamsi'
          ? 'طبّق نظرية الشامسي بصيغتها المعتمدة: اختبار العناصر السبعة، سلم المساهمة الأربع، X/Y/S، مبدأ التناسب الرقابي، وسجل تكوين القرار، مع عدم افتراض إرادة قانونية للآلة أو ركن سادس.'
          : '',
        service === 'decision'
          ? 'نفّذ MARSAD Intelligence ثم MARSAD Audit ثم MARSAD Score: حلّل القرار، دقّق المشروعية والإجراءات والتفسير والتوثيق، ثم قدّر مستوى المساهمة الخوارزمية والرقابة المطلوبة.'
          : service === 'memo'
            ? 'ابنِ المذكرة على وقائع واضحة، مسائل قانونية، تحليل معلل، مراجع، ثم نتيجة وتوصيات.'
            : 'قدّم استشارة عملية معللة مع البدائل والمخاطر والخطوة التالية.',
        documentName ? `تم رفع مستند إلى مكتبة مرصد باسم: ${documentName}. استخدمه ضمن التحليل متى كان متاحاً في سياق المستندات.` : '',
        '',
        'نص المستخدم:',
        trimmedTask,
      ].filter(Boolean).join('\n');

      sessionStorage.setItem('pendingAssistantQuery', prompt);
      sessionStorage.setItem('pendingAssistantConfig', JSON.stringify(config));
      sessionStorage.setItem('marsadUnifiedTask', JSON.stringify({
        jurisdiction,
        answerMode,
        framework,
        service,
        output,
        documentName,
      }));
      navigate('/assistant');
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'تعذر بدء التحليل.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-7 sm:py-9 space-y-7" dir="rtl">
        <section className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-[11px] font-bold text-gold">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            MARSAD · Observe · Analyse · Decide
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            مرصد — منصة القرارات الإدارية الذكية
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            مساحة عمل واحدة تبدأ من السؤال أو القرار وتنتهي بتحليل قانوني موثق، وتدقيق للمشروعية، وقياس واضح للمخاطر والرقابة المطلوبة.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-3">
          {CORE_ENGINES.map(({ id, title, subtitle, icon: Icon }) => (
            <div key={id} className="moj-card rounded-2xl border border-border p-4 flex gap-3 items-start">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-gold" aria-hidden />
              </div>
              <div>
                <p className="font-extrabold text-heading text-sm" dir="ltr">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{subtitle}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="moj-card rounded-2xl border border-gold/20 p-4 sm:p-6 space-y-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-xl font-black text-heading">ابدأ مهمة جديدة</h2>
              <p className="text-xs text-muted-foreground mt-1">اختر العناصر التالية ثم ابدأ التحليل. تنتقل الخيارات تلقائياً إلى محرك مرصد.</p>
            </div>
            <Link href="/search">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-gold cursor-pointer hover:underline">
                <Search className="w-4 h-4" aria-hidden /> البحث القانوني الموحد
              </span>
            </Link>
          </div>

          <div>
            <StepHeader number={1} title="اختر القانون" subtitle="حدد المرجعية القانونية الأساسية للمهمة" />
            <div className="grid sm:grid-cols-3 gap-2.5">
              {JURISDICTIONS.map((item) => (
                <SelectCard key={item.id} item={item} selected={jurisdiction === item.id} onSelect={() => setJurisdiction(item.id)} />
              ))}
            </div>
          </div>

          <div>
            <StepHeader number={2} title="اختر أسلوب الإجابة" subtitle="سرعة مختصرة، تحليل متعمق، أو نموذج جاهز" />
            <div className="grid sm:grid-cols-3 gap-2.5">
              {ANSWER_MODES.map((item) => (
                <SelectCard key={item.id} item={item} selected={answerMode === item.id} onSelect={() => setAnswerMode(item.id)} />
              ))}
            </div>
          </div>

          <div>
            <StepHeader number={3} title="اختر إطار التحليل" subtitle="يمكن تطبيق نظرية الشامسي للمستخدمين المصرح لهم" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {FRAMEWORKS.map((item) => {
                const shamsiLocked = item.id === 'shamsi' && !canUseShamsiFramework;
                return (
                  <SelectCard
                    key={item.id}
                    item={item}
                    selected={framework === item.id}
                    disabled={shamsiLocked}
                    locked={item.id === 'shamsi'}
                    onSelect={() => setFramework(item.id)}
                  />
                );
              })}
            </div>
            {canUseShamsiFramework && (
              <div className="mt-2 text-left">
                <button type="button" onClick={() => navigate('/shamsi-theory')} className="text-[11px] font-bold text-gold hover:underline">
                  فتح النظرية الكاملة
                </button>
              </div>
            )}
          </div>

          <div>
            <StepHeader number={4} title="حدد الخدمة" subtitle="ما الذي تريد من مرصد إنجازه؟" />
            <div className="grid sm:grid-cols-3 gap-2.5">
              {SERVICES.map((item) => (
                <SelectCard key={item.id} item={item} selected={service === item.id} onSelect={() => setService(item.id)} />
              ))}
            </div>
          </div>

          <div>
            <StepHeader number={5} title="اكتب السؤال أو صف القرار" subtitle="هذا النص هو الذي سيبدأ به محرك مرصد المهمة" />
            <textarea
              value={taskText}
              onChange={(event) => {
                setTaskText(event.target.value);
                if (startError) setStartError('');
              }}
              rows={5}
              placeholder="مثال: لدي قرار إداري استُخدم في إعداده نظام ذكاء اصطناعي لترتيب المرشحين، وأريد فحص مشروعيته ومدى كفاية التدخل البشري..."
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm leading-7 outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/10 resize-y"
            />
          </div>

          <div>
            <StepHeader number={6} title="أرفق مستندًا واختر المخرج" subtitle="يرفع المستند فعلياً إلى مكتبة مرصد قبل بدء المهمة، إذا كانت لديك صلاحية الرفع" />
            <label className="rounded-xl border border-dashed border-gold/30 bg-gold/5 p-5 flex flex-col sm:flex-row items-center justify-center gap-3 cursor-pointer hover:bg-gold/10 transition-colors text-center sm:text-right">
              <UploadCloud className="w-6 h-6 text-gold" aria-hidden />
              <div>
                <p className="text-sm font-bold text-heading">{attachment?.name || 'اختر ملفًا من جهازك — اختياري'}</p>
                <p className="text-[11px] text-muted-foreground mt-1">PDF أو DOCX أو TXT. سيُصنّف تلقائياً ضمن ملفات مرصد.</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
              />
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
              {OUTPUTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOutput(item.id)}
                  className={`rounded-xl border px-3 py-3 text-xs font-bold transition-all ${
                    output === item.id ? 'border-gold bg-gold/10 text-heading' : 'border-border text-muted-foreground hover:border-gold/40'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {startError && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {startError}
            </div>
          )}

          <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-3 items-start">
              <Scale className="w-6 h-6 text-gold shrink-0" aria-hidden />
              <div>
                <p className="font-extrabold text-heading">جاهز للبدء</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  عند فحص القرار ينفذ مرصد Intelligence ثم Audit ثم Score، مع إبقاء الإسناد القانوني للإدارة ورفع الرقابة بقدر أثر المساهمة الخوارزمية.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={starting}
              onClick={startAnalysis}
              className="gold-hover-glow inline-flex items-center justify-center gap-2 rounded-xl bg-gold text-background px-6 py-3 text-sm font-black hover:opacity-90 transition-all shrink-0 disabled:opacity-60"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <FileSearch className="w-4 h-4" aria-hidden />}
              {starting ? 'جارٍ تجهيز المهمة' : 'ابدأ التحليل'}
              {!starting && <ChevronLeft className="w-4 h-4" aria-hidden />}
            </button>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <Link href="/journey-services">
            <div className="moj-card rounded-xl border border-border p-4 cursor-pointer hover:border-gold/40 transition-colors h-full">
              <FileText className="w-5 h-5 text-gold mb-2" aria-hidden />
              <p className="font-bold text-heading text-sm">الخدمات المتخصصة</p>
              <p className="text-xs text-muted-foreground mt-1">الوصول إلى وحدات مرصد ومسارات العمل التفصيلية القائمة.</p>
            </div>
          </Link>
          <Link href="/research">
            <div className="moj-card rounded-xl border border-border p-4 cursor-pointer hover:border-gold/40 transition-colors h-full">
              <BrainCircuit className="w-5 h-5 text-gold mb-2" aria-hidden />
              <p className="font-bold text-heading text-sm">البحث والتحليل المتقدم</p>
              <p className="text-xs text-muted-foreground mt-1">مساحة البحث القانوني، الاستدلال، والمصادر المساندة.</p>
            </div>
          </Link>
          <Link href="/library">
            <div className="moj-card rounded-xl border border-border p-4 cursor-pointer hover:border-gold/40 transition-colors h-full">
              <ShieldCheck className="w-5 h-5 text-gold mb-2" aria-hidden />
              <p className="font-bold text-heading text-sm">المكتبة والسجل</p>
              <p className="text-xs text-muted-foreground mt-1">الملفات والمراجع والتقارير السابقة في مكان واحد.</p>
            </div>
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}

export function MarsadServicesPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-heading">خدمات مرصد</h1>
          <p className="text-sm text-muted-foreground">وحدات المنصة الأساسية — بكامل وظائفها الحالية</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {MARSAD_SERVICES.map((service) => (
            <Link key={service.id} href={service.href}>
              <div className="moj-card rounded-xl border border-border p-5 flex items-center gap-4 cursor-pointer hover:border-gold/50 hover:shadow-lg transition-all">
                <span className="text-3xl" aria-hidden>{service.icon}</span>
                <div className="min-w-0">
                  <p className="font-bold text-heading">{service.nameAr}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{service.descAr}</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground mr-auto shrink-0" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
