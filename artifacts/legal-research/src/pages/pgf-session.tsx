/**
 * PGF — Professional Guidance Framework — Session Page
 * Interactive step-by-step workflow + AI assessment output
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation }  from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Loader2, AlertCircle, CheckCircle2, ChevronLeft,
  Info, AlertTriangle, Shield, XCircle, ArrowRight, ArrowLeft,
  Send, Star, BarChart3, ChevronRight, FileWarning, BookMarked,
} from 'lucide-react';
import { AppLayout }  from '@/components/layout/app-layout';
import { apiFetch }   from '@/lib/api-fetch';
import { Button }     from '@/components/ui/button';
import { Textarea }   from '@/components/ui/textarea';
import { Label }      from '@/components/ui/label';
import { Badge }      from '@/components/ui/badge';
import { useToast }   from '@/hooks/use-toast';
import type {
  PgfSession, PgfWorkflowStage, PgfWorkflowQuestion,
  PgfAssessmentOutput, PgfLegalReference, PgfRisk,
  PgfFinalChecklistResult, PgfCommonMistake, PgfAnswerResponse,
} from '@/types/pgf';

// ─── Stage fetch ──────────────────────────────────────────────────────────────

interface ProfessionDetail {
  stages: PgfWorkflowStage[];
}

// ─── Question renderer ────────────────────────────────────────────────────────

function QuestionField({
  question, value, onChange,
}: {
  question: PgfWorkflowQuestion;
  value:    string | string[] | boolean | undefined;
  onChange: (v: string | string[] | boolean) => void;
}) {
  if (question.type === 'boolean') {
    const boolVal = value === true || value === 'true';
    return (
      <div className="flex gap-3" dir="rtl">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${boolVal ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}
        >
          نعم ✓
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${value === false || value === 'false' ? 'border-destructive/50 bg-destructive/5 text-destructive' : 'border-border hover:border-destructive/30'}`}
        >
          لا ✗
        </button>
      </div>
    );
  }

  if (question.type === 'select' && question.options) {
    const strVal = String(value ?? '');
    return (
      <div className="grid grid-cols-1 gap-2" dir="rtl">
        {question.options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`w-full text-right px-4 py-2.5 rounded-xl border-2 text-sm transition-all ${strVal === opt ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/40'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'multiselect' && question.options) {
    const arrVal: string[] = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      const next = arrVal.includes(opt) ? arrVal.filter((v) => v !== opt) : [...arrVal, opt];
      onChange(next);
    };
    return (
      <div className="grid grid-cols-2 gap-2" dir="rtl">
        {question.options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`text-right px-3 py-2 rounded-xl border-2 text-sm transition-all ${arrVal.includes(opt) ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/40'}`}
          >
            {arrVal.includes(opt) && <span className="ml-1">✓</span>}
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // Default: text
  return (
    <Textarea
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder="اكتب إجابتك هنا…"
      className="min-h-[100px] resize-none text-right"
      dir="rtl"
      minLength={question.minLength}
    />
  );
}

function isAnswerValid(q: PgfWorkflowQuestion, val: string | string[] | boolean | undefined): boolean {
  if (!q.required) return true;
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return true;
  if (Array.isArray(val)) return val.length > 0;
  const str = String(val).trim();
  if (str.length === 0) return false;
  if (q.minLength && str.length < q.minLength) return false;
  return true;
}

// ─── Stage form ───────────────────────────────────────────────────────────────

function StageForm({
  stage, completedStages, totalStages, stageIndex,
  onSubmit, isSubmitting,
}: {
  stage:           PgfWorkflowStage;
  completedStages: string[];
  totalStages:     number;
  stageIndex:      number;
  onSubmit:        (answers: Record<string, string | string[] | boolean>) => void;
  isSubmitting:    boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});

  const allValid = stage.questions
    .filter((q) => q.required)
    .every((q) => isAnswerValid(q, answers[q.id]));

  return (
    <div className="bg-card border rounded-2xl p-6 space-y-6">
      {/* Stage progress */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap" dir="rtl">
          {Array.from({ length: totalStages }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full min-w-6 ${
                i < stageIndex ? 'bg-primary' : i === stageIndex ? 'bg-primary/60' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-right">
          المرحلة {stageIndex + 1} من {totalStages}
        </p>
      </div>

      {/* Stage header */}
      <div className="border-b pb-4" dir="rtl">
        <div className="flex items-center gap-2 mb-1">
          {stage.icon && <span className="text-xl">{stage.icon}</span>}
          <h2 className="text-lg font-bold text-foreground">{stage.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{stage.description}</p>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {stage.questions.map((q) => (
          <div key={q.id} className="space-y-2" dir="rtl">
            <Label className="text-sm font-semibold leading-snug">
              {q.text}
              {q.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
            <QuestionField
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-end pt-2">
        <Button
          onClick={() => onSubmit(answers)}
          disabled={!allValid || isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ…</>
          ) : (
            <>التالي <ArrowLeft className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Confidence gauge ─────────────────────────────────────────────────────────

function ConfidenceGauge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const bg    = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3 p-4 bg-card border rounded-xl">
      <div className="relative w-14 h-14 shrink-0">
        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${(score / 100) * 88} 88`}
            className={color}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}>{score}</span>
      </div>
      <div dir="rtl">
        <p className="text-sm font-semibold text-foreground">درجة الثقة المهنية</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {score >= 80 ? 'مرتفعة — الإجراءات سليمة في معظمها' : score >= 60 ? 'متوسطة — يوجد فجوات تحتاج معالجة' : 'منخفضة — مخاطر جوهرية تستلزم انتباهاً'}
        </p>
      </div>
    </div>
  );
}

// ─── Assessment output ────────────────────────────────────────────────────────

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-bold text-foreground mb-3">
      {icon}{children}
    </h3>
  );
}

function LegalRefCard({ r }: { r: PgfLegalReference }) {
  return (
    <div className={`p-3 rounded-lg border text-sm ${r.binding ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10'}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <Badge variant="outline" className="text-xs shrink-0">{r.type}</Badge>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${r.binding ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
          {r.binding ? '⚖️ ملزم' : '💡 استرشادي'}
        </span>
      </div>
      <p className="font-semibold text-right">{r.title}</p>
      <p className="text-muted-foreground text-xs text-right mt-0.5">{r.reference}</p>
    </div>
  );
}

function RiskCard({ risk }: { risk: PgfRisk }) {
  const conf = {
    high:   { label: 'عالية',  className: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10', badge: 'bg-red-100 text-red-700' },
    medium: { label: 'متوسطة', className: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10', badge: 'bg-amber-100 text-amber-700' },
    low:    { label: 'منخفضة', className: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/10', badge: 'bg-gray-100 text-gray-600' },
  }[risk.severity] ?? { label: risk.severity, className: 'border-border bg-card', badge: 'bg-muted text-muted-foreground' };

  return (
    <div className={`p-3 rounded-lg border ${conf.className}`} dir="rtl">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${conf.badge}`}>{conf.label}</span>
        <p className="font-semibold text-sm flex-1 text-right">{risk.risk}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">التخفيف: {risk.mitigation}</p>
    </div>
  );
}

function ChecklistRow({ item }: { item: PgfFinalChecklistResult }) {
  const [done, setDone] = useState(item.status === 'complete');
  const isNA = item.status === 'not_applicable';
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        isNA ? 'opacity-50 cursor-default' : done
          ? 'bg-emerald-50/50 dark:bg-emerald-900/5 border-emerald-200 dark:border-emerald-800'
          : 'bg-card border-border hover:bg-muted/30'
      }`}
      onClick={() => !isNA && setDone(!done)}
    >
      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        isNA ? 'border-muted bg-muted' : done ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'
      }`}>
        {done && !isNA && <CheckCircle2 className="w-3 h-3 text-white" />}
        {isNA && <span className="text-xs text-muted-foreground">—</span>}
      </div>
      <div className="flex-1 min-w-0" dir="rtl">
        <p className={`text-sm ${(done && !isNA) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.item}</p>
        {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">{item.category}</Badge>
          {item.mandatory && <span className="text-xs text-red-600 dark:text-red-400">إلزامي</span>}
          {isNA && <span className="text-xs text-muted-foreground">غير منطبق</span>}
        </div>
      </div>
    </div>
  );
}

function AssessmentView({
  output, professionNameAr, sectorNameAr,
}: { output: PgfAssessmentOutput; professionNameAr: string; sectorNameAr: string }) {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-300">{output.disclaimer}</p>
      </div>

      {/* Role */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1"><BookOpen className="w-3 h-3" />{sectorNameAr}</Badge>
        <Badge variant="outline">{professionNameAr}</Badge>
      </div>

      {/* Confidence gauge */}
      <ConfidenceGauge score={output.confidenceScore} />
      {output.confidenceRationale && (
        <p className="text-sm text-muted-foreground -mt-3 px-1">{output.confidenceRationale}</p>
      )}

      {/* Summary */}
      <section className="p-5 bg-card border rounded-xl">
        <SectionTitle icon={<Star className="w-4.5 h-4.5 text-primary" />}>
          التقييم المهني الشامل
        </SectionTitle>
        <p className="text-sm leading-loose text-foreground/90 whitespace-pre-wrap">{output.summary}</p>
      </section>

      {/* Required actions */}
      {output.requiredActions?.length > 0 && (
        <section>
          <SectionTitle icon={<ChevronRight className="w-4.5 h-4.5 text-blue-500" />}>
            الإجراءات المطلوبة
          </SectionTitle>
          <ul className="space-y-2">
            {output.requiredActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm p-3 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/40 rounded-lg">
                <span className="text-blue-600 font-bold shrink-0 text-xs mt-0.5">{i + 1}.</span>
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Missing actions */}
      {output.missingActions?.length > 0 && (
        <section>
          <SectionTitle icon={<XCircle className="w-4.5 h-4.5 text-red-500" />}>
            الإجراءات الغائبة أو الناقصة
          </SectionTitle>
          <ul className="space-y-2">
            {output.missingActions.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm p-3 bg-red-50/60 dark:bg-red-900/10 border border-red-100 dark:border-red-900/40 rounded-lg">
                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Risks */}
      {output.risks?.length > 0 && (
        <section>
          <SectionTitle icon={<AlertTriangle className="w-4.5 h-4.5 text-orange-500" />}>
            المخاطر المُحددة
          </SectionTitle>
          <div className="space-y-2">
            {output.risks.map((r, i) => <RiskCard key={i} risk={r} />)}
          </div>
        </section>
      )}

      {/* Legislation */}
      {(output.applicableLegislation?.length > 0 || output.applicableRegulations?.length > 0) && (
        <section>
          <SectionTitle icon={<Shield className="w-4.5 h-4.5 text-emerald-500" />}>
            التشريعات واللوائح المنطبقة
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...(output.applicableLegislation ?? []), ...(output.applicableRegulations ?? [])].map((r, i) => (
              <LegalRefCard key={i} r={r} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <span className="text-emerald-600 font-medium">⚖️ ملزم</span> = متطلب قانوني إلزامي &nbsp;|&nbsp;
            <span className="text-blue-600 font-medium">💡 استرشادي</span> = ممارسة موصى بها
          </p>
        </section>
      )}

      {/* Best practices */}
      {output.bestPractices?.length > 0 && (
        <section>
          <SectionTitle icon={<BookMarked className="w-4.5 h-4.5 text-violet-500" />}>
            الممارسات الفضلى للموقف الحالي
          </SectionTitle>
          <ul className="space-y-1.5">
            {output.bestPractices.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm p-2.5 bg-violet-50/60 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/40 rounded-lg">
                <Star className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Common mistakes */}
      {output.commonMistakes?.length > 0 && (
        <section>
          <SectionTitle icon={<FileWarning className="w-4.5 h-4.5 text-red-500" />}>
            الأخطاء الشائعة ذات الصلة
          </SectionTitle>
          <div className="space-y-3">
            {output.commonMistakes.map((m, i) => (
              <div key={i} className="p-3 bg-red-50/40 dark:bg-red-900/5 border border-red-100 dark:border-red-900/30 rounded-lg text-sm" dir="rtl">
                <p className="font-semibold text-red-700 dark:text-red-400">⚠ {m.mistake}</p>
                <p className="text-muted-foreground mt-1 text-xs">العواقب: {m.consequence}</p>
                <p className="text-emerald-700 dark:text-emerald-400 mt-0.5 text-xs">العلاج: {m.remedy}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Escalation */}
      {output.escalationRecommendation && (
        <section className="p-4 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl bg-amber-50/50 dark:bg-amber-900/5">
          <SectionTitle icon={<ArrowRight className="w-4.5 h-4.5 text-amber-600" />}>
            توصية التصعيد
          </SectionTitle>
          <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-300">
            {output.escalationRecommendation}
          </p>
        </section>
      )}

      {/* Final checklist */}
      {output.finalChecklist?.length > 0 && (
        <section>
          <SectionTitle icon={<BarChart3 className="w-4.5 h-4.5 text-emerald-500" />}>
            قائمة التحقق النهائية
          </SectionTitle>
          <p className="text-xs text-muted-foreground mb-3">اضغط على البند لتعليمه منجزاً</p>
          <div className="space-y-2">
            {output.finalChecklist.map((item) => <ChecklistRow key={item.id} item={item} />)}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Main Session Page ────────────────────────────────────────────────────────

export default function PgfSessionPage() {
  const { id }        = useParams<{ id: string }>();
  const [, navigate]  = useLocation();
  const queryClient   = useQueryClient();
  const { toast }     = useToast();
  const sessionId     = parseInt(id ?? '0', 10);

  // Fetch session
  const { data: sessionData, isLoading: sessionLoading, isError: sessionError } = useQuery({
    queryKey: ['pgf-session', sessionId],
    queryFn:  async () => {
      const res = await apiFetch(`/api/pgf/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Not found');
      return res.json() as Promise<{ session: PgfSession }>;
    },
    refetchInterval: (query) => {
      const s = query.state.data?.session;
      return s?.status === 'finalizing' ? 3000 : false;
    },
  });

  const session = sessionData?.session;

  // Fetch profession detail (stages)
  const { data: profData } = useQuery({
    queryKey: ['pgf-profession', session?.sectorId, session?.professionId],
    queryFn:  async () => {
      const res = await apiFetch(`/api/pgf/professions/${session!.sectorId}/${session!.professionId}`);
      if (!res.ok) throw new Error('Not found');
      return res.json() as Promise<ProfessionDetail>;
    },
    enabled: !!session?.sectorId,
  });

  const stages      = profData?.stages ?? [];
  const totalStages = stages.length;

  // Current stage index
  const currentStageId = session?.currentStageId ?? stages[0]?.id;
  const currentStage   = stages.find((s) => s.id === currentStageId);
  const currentIdx     = stages.findIndex((s) => s.id === currentStageId);

  // Answer submission
  const answerMutation = useMutation({
    mutationFn: async (params: { stageId: string; stageAnswers: Record<string, string | string[] | boolean> }) => {
      const res = await apiFetch(`/api/pgf/sessions/${sessionId}/answer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Answer failed');
      return res.json() as Promise<PgfAnswerResponse>;
    },
    onSuccess: ({ isComplete }) => {
      queryClient.invalidateQueries({ queryKey: ['pgf-session', sessionId] });
      if (isComplete) {
        // Auto-finalize
        finalizeMutation.mutate();
      }
    },
    onError: () => toast({ title: 'تعذّر حفظ الإجابات', variant: 'destructive' }),
  });

  // Finalize
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/pgf/sessions/${sessionId}/finalize`, { method: 'POST' });
      if (!res.ok) throw new Error('Finalize failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pgf-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['pgf-sessions'] });
    },
    onError: () => toast({ title: 'تعذّر إنشاء التقييم. حاول مجدداً.', variant: 'destructive' }),
  });

  const handleStageSubmit = (answers: Record<string, string | string[] | boolean>) => {
    if (!currentStageId) return;
    answerMutation.mutate({ stageId: currentStageId, stageAnswers: answers });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (sessionLoading || !session) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (sessionError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
          <AlertCircle className="w-10 h-10" />
          <p>لم يتم العثور على الجلسة</p>
          <Button variant="outline" onClick={() => navigate('/pgf')}>عودة</Button>
        </div>
      </AppLayout>
    );
  }

  const isFinalizing = session.status === 'finalizing' || finalizeMutation.isPending || answerMutation.isPending;
  const isComplete   = session.status === 'complete' && !!session.output;
  const isError      = session.status === 'error';

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pgf')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">{session.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs">{session.sectorNameAr}</Badge>
                <Badge variant="outline"   className="text-xs">{session.professionNameAr}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Finalizing */}
        {isFinalizing && !isComplete && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-medium">جارٍ إعداد التقييم المهني الشامل…</p>
            <p className="text-sm">قد يستغرق ذلك لحظات</p>
          </div>
        )}

        {/* Complete */}
        {isComplete && !isFinalizing && session.output && (
          <AssessmentView
            output={session.output}
            professionNameAr={session.professionNameAr}
            sectorNameAr={session.sectorNameAr}
          />
        )}

        {/* Error */}
        {isError && !isFinalizing && (
          <div className="text-center py-10 space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-destructive font-medium">تعذّر توليد التقييم</p>
            <Button variant="outline" onClick={() => finalizeMutation.mutate()}>
              إعادة المحاولة
            </Button>
          </div>
        )}

        {/* Draft: show current stage */}
        {session.status === 'draft' && !isFinalizing && currentStage && (
          <StageForm
            stage={currentStage}
            completedStages={session.completedStages ?? []}
            totalStages={totalStages}
            stageIndex={currentIdx >= 0 ? currentIdx : 0}
            onSubmit={handleStageSubmit}
            isSubmitting={answerMutation.isPending}
          />
        )}

        {/* Draft but no current stage (shouldn't happen) */}
        {session.status === 'draft' && !isFinalizing && !currentStage && stages.length > 0 && (
          <div className="text-center py-10">
            <Button onClick={() => finalizeMutation.mutate()} className="gap-2">
              <Send className="w-4 h-4" /> إنهاء وتحليل
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
