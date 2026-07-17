import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Compass, Loader2, AlertCircle, CheckCircle2, ChevronLeft,
  Info, AlertTriangle, BookOpen, ClipboardList, FileWarning,
  XCircle, ArrowRight, ArrowLeft, Send, Shield, Star,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch }  from '@/lib/api-fetch';
import { Button }    from '@/components/ui/button';
import { Textarea }  from '@/components/ui/textarea';
import { Label }     from '@/components/ui/label';
import { Badge }     from '@/components/ui/badge';
import { useToast }  from '@/hooks/use-toast';
import {
  SPG_SECTORS, type SpgSession, type SpgGuidanceOutput,
  type SpgWizardAnswers, type SpgLegalReference, type SpgChecklistItem,
} from '@/types/spg';

// ─── Wizard step definitions ──────────────────────────────────────────────────

const WIZARD_STEPS: Array<{
  key:         keyof SpgWizardAnswers;
  questionAr:  string;
  hintAr:      string;
  minLength:   number;
}> = [
  {
    key: 'incident',
    questionAr: 'ما الواقعة أو المهمة التي تحتاج إرشاداً بشأنها؟',
    hintAr:     'صِف الموقف أو المهمة بوضوح: ما الذي حدث؟ ما التفاصيل الأساسية؟',
    minLength:  20,
  },
  {
    key: 'stage',
    questionAr: 'ما المرحلة الحالية؟',
    hintAr:     'مثلاً: مرحلة التحقيق الأولية، مرحلة إعداد الحكم، مرحلة المراجعة، مرحلة التنفيذ…',
    minLength:  10,
  },
  {
    key: 'documents',
    questionAr: 'ما المستندات أو الأدلة المتوفرة لديك؟',
    hintAr:     'عدِّد المستندات أو الأدلة المتاحة، أو اذكر "لا توجد مستندات بعد" إن كانت غير متوفرة.',
    minLength:  5,
  },
  {
    key: 'action',
    questionAr: 'ما الإجراء المطلوب أو الذي تفكر في اتخاذه؟',
    hintAr:     'صِف الإجراء الذي تنوي اتخاذه أو الذي يُطلب منك القيام به.',
    minLength:  10,
  },
  {
    key: 'risks',
    questionAr: 'ما المخاطر المحتملة التي تُدركها أو تخشاها؟',
    hintAr:     'مخاطر قانونية، إجرائية، مهنية، أو غير ذلك. يمكنك كتابة "غير واضحة بعد".',
    minLength:  5,
  },
  {
    key: 'nextStep',
    questionAr: 'ما الخطوة التالية التي تتوقع القيام بها؟',
    hintAr:     'ما الذي ستفعله بعد تلقّي الإرشاد؟ هل ستراجع جهة أعلى، تُعد مستنداً، تتواصل مع طرف آخر؟',
    minLength:  5,
  },
];

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_CONF = {
  high:   { label: 'عالية',  className: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive' },
  medium: { label: 'متوسطة', className: 'bg-gold/15 text-gold dark:bg-gold/30 dark:text-gold/80' },
  low:    { label: 'منخفضة', className: 'bg-muted/60 text-muted-foreground dark:bg-card dark:text-muted-foreground' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-bold text-foreground mb-3">
      {icon}
      {children}
    </h3>
  );
}

function LegalRefCard({ ref: r }: { ref: SpgLegalReference }) {
  return (
    <div className={`p-3 rounded-lg border text-sm ${
      r.binding
        ? 'border-heading/25 bg-heading/10 dark:border-heading/40 dark:bg-heading/10'
        : 'border-heading/25 bg-heading/10 dark:border-heading/40 dark:bg-heading/10'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
          r.binding
            ? 'bg-heading/15 text-heading dark:bg-heading/40 dark:text-heading'
            : 'bg-heading/15 text-heading dark:bg-heading/40 dark:text-heading'
        }`}>
          {r.binding ? '⚖️ ملزم قانوناً' : '💡 ممارسة فضلى'}
        </span>
        <Badge variant="outline" className="text-xs shrink-0">{r.type}</Badge>
      </div>
      <p className="font-semibold">{r.title}</p>
      <p className="text-muted-foreground text-xs mt-0.5">{r.reference}</p>
    </div>
  );
}

function ChecklistItemRow({ item }: { item: SpgChecklistItem }) {
  const [done, setDone] = useState(false);
  const pc = PRIORITY_CONF[item.priority] ?? PRIORITY_CONF.medium;
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        done ? 'bg-heading/10 dark:bg-heading/5 border-heading/25 dark:border-heading/40' : 'bg-card border-border hover:bg-muted/30'
      }`}
      onClick={() => setDone(!done)}
    >
      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        done ? 'bg-heading border-heading/40' : 'border-muted-foreground/40'
      }`}>
        {done && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {item.step}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-1.5 py-0.5 rounded ${pc.className}`}>{pc.label}</span>
          {item.mandatory && (
            <span className="text-xs text-destructive">إلزامي</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Guidance output view ─────────────────────────────────────────────────────

function GuidanceView({ output, roleNameAr, sectorNameAr }: {
  output: SpgGuidanceOutput;
  roleNameAr: string;
  sectorNameAr: string;
}) {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-4 bg-gold/10 border border-gold/25 dark:border-gold/75 rounded-xl">
        <Info className="w-4 h-4 text-gold/80 mt-0.5 shrink-0" />
        <p className="text-sm text-gold/75 dark:text-gold/40">{output.disclaimer}</p>
      </div>

      {/* Role badge */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1"><Compass className="w-3 h-3" />{sectorNameAr}</Badge>
        <Badge variant="outline">{roleNameAr}</Badge>
      </div>

      {/* Summary */}
      <section className="p-5 bg-card border rounded-xl">
        <SectionTitle icon={<Star className="w-4.5 h-4.5 text-primary" />}>
          الإرشاد المهني الموجز
        </SectionTitle>
        <p className="text-sm leading-loose text-foreground/90 whitespace-pre-wrap">{output.summary}</p>
      </section>

      {/* Required actions */}
      {output.requiredActions?.length > 0 && (
        <section>
          <SectionTitle icon={<ClipboardList className="w-4.5 h-4.5 text-heading" />}>
            الإجراءات المطلوبة
          </SectionTitle>
          <ul className="space-y-2">
            {output.requiredActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm p-3 bg-heading/10 border border-heading/25 dark:border-heading/40 rounded-lg">
                <span className="text-heading font-bold shrink-0 text-xs mt-0.5">{i + 1}.</span>
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Required documents */}
      {output.requiredDocuments?.length > 0 && (
        <section>
          <SectionTitle icon={<BookOpen className="w-4.5 h-4.5 text-heading" />}>
            المستندات المطلوبة
          </SectionTitle>
          <ul className="space-y-1.5">
            {output.requiredDocuments.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm p-2.5 bg-heading/10 border border-heading/25 dark:border-heading/40 rounded-lg">
                <FileWarning className="w-3.5 h-3.5 text-heading shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Legal references */}
      {output.legalReferences?.length > 0 && (
        <section>
          <SectionTitle icon={<Shield className="w-4.5 h-4.5 text-heading" />}>
            المراجع القانونية والتنظيمية
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {output.legalReferences.map((r, i) => (
              <LegalRefCard key={i} ref={r} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <span className="text-heading font-medium">⚖️ ملزم قانوناً</span> = متطلب قانوني إلزامي &nbsp;|&nbsp;
            <span className="text-heading font-medium">💡 ممارسة فضلى</span> = موصى به مهنياً
          </p>
        </section>
      )}

      {/* Practical warnings */}
      {output.practicalWarnings?.length > 0 && (
        <section>
          <SectionTitle icon={<AlertTriangle className="w-4.5 h-4.5 text-gold" />}>
            التحذيرات العملية
          </SectionTitle>
          <ul className="space-y-2">
            {output.practicalWarnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm p-3 bg-gold/60 dark:bg-gold/10 border border-gold/15 dark:border-gold/40 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Common mistakes */}
      {output.commonMistakes?.length > 0 && (
        <section>
          <SectionTitle icon={<XCircle className="w-4.5 h-4.5 text-destructive" />}>
            الأخطاء الشائعة
          </SectionTitle>
          <ul className="space-y-2">
            {output.commonMistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm p-3 bg-destructive/10 border border-destructive/25 dark:border-destructive/40 rounded-lg">
                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Next-step checklist */}
      {output.nextStepChecklist?.length > 0 && (
        <section>
          <SectionTitle icon={<CheckCircle2 className="w-4.5 h-4.5 text-heading" />}>
            قائمة الخطوات التالية
          </SectionTitle>
          <p className="text-xs text-muted-foreground mb-3">اضغط على الخطوة لتعليمها كمنجزة</p>
          <div className="space-y-2">
            {output.nextStepChecklist.map((item, i) => (
              <ChecklistItemRow key={i} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Escalation recommendation */}
      {output.escalationRecommendation && (
        <section className="p-4 border-2 border-dashed border-gold/40 dark:border-gold rounded-xl bg-gold/50 dark:bg-gold/5">
          <SectionTitle icon={<ArrowRight className="w-4.5 h-4.5 text-gold" />}>
            توصية التصعيد
          </SectionTitle>
          <p className="text-sm leading-relaxed text-gold/85 dark:text-gold/40">
            {output.escalationRecommendation}
          </p>
        </section>
      )}
    </div>
  );
}

// ─── Wizard step ─────────────────────────────────────────────────────────────

function WizardStep({
  stepIndex, totalSteps, step, value, onChange, onNext, onPrev, isLastStep, isSubmitting,
}: {
  stepIndex:    number;
  totalSteps:   number;
  step:         typeof WIZARD_STEPS[0];
  value:        string;
  onChange:     (v: string) => void;
  onNext:       () => void;
  onPrev:       () => void;
  isLastStep:   boolean;
  isSubmitting: boolean;
}) {
  const isValid = value.trim().length >= step.minLength;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < stepIndex ? 'bg-primary' : i === stepIndex ? 'bg-primary/60' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-right">
        السؤال {stepIndex + 1} من {totalSteps}
      </p>

      {/* Question */}
      <div className="space-y-3" dir="rtl">
        <Label className="text-base font-semibold leading-snug">{step.questionAr}</Label>
        <p className="text-sm text-muted-foreground">{step.hintAr}</p>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="اكتب إجابتك هنا…"
          className="min-h-[120px] resize-none text-right"
          dir="rtl"
        />
        {!isValid && value.trim().length > 0 && (
          <p className="text-xs text-muted-foreground">
            يُرجى إضافة المزيد من التفاصيل (الحد الأدنى {step.minLength} حرف)
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="gap-2"
        >
          <ArrowRight className="w-4 h-4" /> السابق
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid || isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحليل…</>
          ) : isLastStep ? (
            <><Send className="w-4 h-4" /> إرسال للتحليل</>
          ) : (
            <>التالي <ArrowLeft className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Session Page ────────────────────────────────────────────────────────

export default function SpgSessionPage() {
  const { id }        = useParams<{ id: string }>();
  const [, navigate]  = useLocation();
  const queryClient   = useQueryClient();
  const { toast }     = useToast();

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers]     = useState<Record<string, string>>({
    incident: '', stage: '', documents: '', action: '', risks: '', nextStep: '',
  });

  const sessionId = parseInt(id ?? '0', 10);

  // Fetch session
  const { data, isLoading, isError } = useQuery({
    queryKey: ['spg-session', sessionId],
    queryFn:  async () => {
      const res = await apiFetch(`/api/spg/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Session not found');
      return res.json() as Promise<{ session: SpgSession }>;
    },
    enabled: !!sessionId,
  });

  // Run mutation
  const runMutation = useMutation({
    mutationFn: async (wizardAnswers: SpgWizardAnswers) => {
      const res = await apiFetch(`/api/spg/sessions/${sessionId}/run`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ answers: wizardAnswers }),
      });
      if (!res.ok) throw new Error('Run failed');
      return res.json() as Promise<{ session: SpgSession }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spg-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['spg-sessions'] });
    },
    onError: () => toast({ title: 'تعذّر توليد الإرشاد. حاول مجدداً.', variant: 'destructive' }),
  });

  const session = data?.session;
  const sector  = SPG_SECTORS.find(s => s.id === session?.sectorId);

  const handleNext = () => {
    if (stepIndex < WIZARD_STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      // Submit
      runMutation.mutate(answers as unknown as SpgWizardAnswers);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !session) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
          <AlertCircle className="w-10 h-10" />
          <p>لم يتم العثور على الجلسة</p>
          <Button variant="outline" onClick={() => navigate('/spg')}>عودة</Button>
        </div>
      </AppLayout>
    );
  }

  const isComplete  = session.status === 'complete' && !!session.output;
  const isAnalyzing = session.status === 'analyzing' || runMutation.isPending;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/spg')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{sector?.icon ?? '🧭'}</span>
            <div>
              <h1 className="text-xl font-bold text-foreground">{session.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs">{session.sectorNameAr}</Badge>
                <Badge variant="outline" className="text-xs">{session.roleNameAr}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Analyzing state */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-medium">جارٍ تحليل موقفك المهني وإعداد الإرشاد…</p>
            <p className="text-sm">قد يستغرق ذلك لحظات</p>
          </div>
        )}

        {/* Complete: show output */}
        {isComplete && !isAnalyzing && session.output && (
          <GuidanceView
            output={session.output}
            roleNameAr={session.roleNameAr}
            sectorNameAr={session.sectorNameAr}
          />
        )}

        {/* Error state */}
        {session.status === 'error' && !isAnalyzing && (
          <div className="text-center py-10 space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-destructive font-medium">تعذّر توليد الإرشاد</p>
            <Button variant="outline" onClick={() => setStepIndex(0)}>
              إعادة المحاولة
            </Button>
          </div>
        )}

        {/* Draft: show wizard */}
        {(session.status === 'draft') && !isAnalyzing && (
          <div className="bg-card border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b" dir="rtl">
              <Compass className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">أجب على الأسئلة التالية للحصول على إرشادك المهني</h2>
            </div>
            <WizardStep
              stepIndex={stepIndex}
              totalSteps={WIZARD_STEPS.length}
              step={WIZARD_STEPS[stepIndex]}
              value={answers[WIZARD_STEPS[stepIndex].key] ?? ''}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [WIZARD_STEPS[stepIndex].key]: v }))}
              onNext={handleNext}
              onPrev={() => setStepIndex(Math.max(0, stepIndex - 1))}
              isLastStep={stepIndex === WIZARD_STEPS.length - 1}
              isSubmitting={runMutation.isPending}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
