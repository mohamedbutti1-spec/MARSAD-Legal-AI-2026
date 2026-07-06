/**
 * PGF — Professional Guidance Framework — Session Page
 * Interactive step-by-step workflow + AI assessment output + PME mentor panels
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation }  from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Loader2, AlertCircle, CheckCircle2, ChevronLeft,
  Info, AlertTriangle, Shield, XCircle, ArrowRight, ArrowLeft,
  Send, Star, BarChart3, ChevronRight, FileWarning, BookMarked,
  ChevronDown, ChevronUp, Brain, Zap, X,
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
  InstitutionalMemoryEntry, InstitutionalMemoryCategory,
  ProfessionalWorkflowStep,
  PcsSimStep, PcsStepEvaluation, PcsFinalReport,
  PcsAnswerResponse, PcsStartResponse, PcsSession,
} from '@/types/pgf';
import {
  INSTITUTIONAL_MEMORY_LABELS,
  INSTITUTIONAL_MEMORY_ICONS,
} from '@/types/pgf';

// ─── Stage fetch ──────────────────────────────────────────────────────────────

interface ProfessionDetail {
  stages: PgfWorkflowStage[];
}

interface ExpertActionsResponse {
  stageId:            string;
  stageTitle:         string;
  expertFirstActions: string[];
  mentorPrompt:       string | null;
  whyThisMatters:     string | null;
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

// ─── Mentor Panel ─────────────────────────────────────────────────────────────

interface MentorAccordionProps {
  icon:     string;
  title:    string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  colorClass?: string;
}

function MentorAccordion({ icon, title, children, defaultOpen = false, colorClass = 'border-primary/20 bg-primary/5' }: MentorAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden ${colorClass}`} dir="rtl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm leading-relaxed text-foreground/85 space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

function MentorPanel({ stage }: { stage: PgfWorkflowStage }) {
  const hasMentorContent =
    stage.mentorPrompt || stage.expertReasoning || stage.warningSigns?.length ||
    stage.doNotDo?.length || stage.requiredDocumentsAtStage?.length ||
    stage.escalationTriggers?.length || stage.professionalJudgmentNotes;

  if (!hasMentorContent) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium px-1">📘 إرشادات المرشد المهني</p>

      {/* 🧭 Mentor context + expert reasoning */}
      {(stage.mentorPrompt || stage.expertReasoning) && (
        <MentorAccordion
          icon="🧭"
          title="السياق المهني"
          defaultOpen
          colorClass="border-primary/20 bg-primary/5"
        >
          {stage.mentorPrompt && (
            <p className="italic text-primary/80 border-r-2 border-primary/30 pr-3 mb-2">{stage.mentorPrompt}</p>
          )}
          {stage.expertReasoning && <p>{stage.expertReasoning}</p>}
        </MentorAccordion>
      )}

      {/* ⚠️ Warning signs */}
      {stage.warningSigns && stage.warningSigns.length > 0 && (
        <MentorAccordion icon="⚠️" title="علامات التحذير" colorClass="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10">
          <ul className="space-y-1">
            {stage.warningSigns.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <span className="shrink-0 mt-0.5">•</span>{w}
              </li>
            ))}
          </ul>
        </MentorAccordion>
      )}

      {/* ✅ What to do / description already shown in header — skip to avoid duplication */}

      {/* ❌ Do not do */}
      {stage.doNotDo && stage.doNotDo.length > 0 && (
        <MentorAccordion icon="❌" title="لا تفعل" colorClass="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10">
          <ul className="space-y-1">
            {stage.doNotDo.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-red-700 dark:text-red-400">
                <span className="shrink-0 mt-0.5">✗</span>{d}
              </li>
            ))}
          </ul>
        </MentorAccordion>
      )}

      {/* 📄 Required documents */}
      {stage.requiredDocumentsAtStage && stage.requiredDocumentsAtStage.length > 0 && (
        <MentorAccordion icon="📄" title="المستندات المطلوبة في هذه المرحلة" colorClass="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10">
          <ul className="space-y-1">
            {stage.requiredDocumentsAtStage.map((doc, i) => (
              <li key={i} className="flex items-start gap-2 text-blue-700 dark:text-blue-300">
                <span className="shrink-0 mt-0.5">📋</span>{doc}
              </li>
            ))}
          </ul>
        </MentorAccordion>
      )}

      {/* 📌 Escalation triggers */}
      {stage.escalationTriggers && stage.escalationTriggers.length > 0 && (
        <MentorAccordion icon="📌" title="متى تُصعّد؟" colorClass="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10">
          <ul className="space-y-1">
            {stage.escalationTriggers.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-orange-700 dark:text-orange-300">
                <span className="shrink-0 mt-0.5">↑</span>{t}
              </li>
            ))}
          </ul>
        </MentorAccordion>
      )}

      {/* 🧠 Professional judgment notes */}
      {stage.professionalJudgmentNotes && (
        <MentorAccordion icon="🧠" title="الحكم المهني" colorClass="border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/10">
          <p className="text-violet-700 dark:text-violet-300">{stage.professionalJudgmentNotes}</p>
        </MentorAccordion>
      )}
    </div>
  );
}

// ─── Institutional Memory Section ────────────────────────────────────────────

const CATEGORY_COLOR: Record<InstitutionalMemoryCategory, string> = {
  expert_practice:      'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/10',
  frequent_mistake:     'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10',
  lesson_learned:       'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10',
  recommended_sequence: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10',
  practical_tip:        'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10',
  success_indicator:    'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10',
  failure_indicator:    'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10',
};

const CATEGORY_TEXT: Record<InstitutionalMemoryCategory, string> = {
  expert_practice:      'text-violet-700 dark:text-violet-300',
  frequent_mistake:     'text-red-700 dark:text-red-300',
  lesson_learned:       'text-blue-700 dark:text-blue-300',
  recommended_sequence: 'text-emerald-700 dark:text-emerald-300',
  practical_tip:        'text-amber-700 dark:text-amber-300',
  success_indicator:    'text-green-700 dark:text-green-300',
  failure_indicator:    'text-orange-700 dark:text-orange-300',
};

function InstitutionalMemoryCard({ entry }: { entry: InstitutionalMemoryEntry }) {
  const cat   = entry.category as InstitutionalMemoryCategory;
  const label = INSTITUTIONAL_MEMORY_LABELS[cat] ?? cat;
  const icon  = INSTITUTIONAL_MEMORY_ICONS[cat] ?? '📝';
  const color = CATEGORY_COLOR[cat] ?? 'border-border bg-card';
  const text  = CATEGORY_TEXT[cat]  ?? 'text-foreground';

  return (
    <div className={`p-3 rounded-xl border ${color}`} dir="rtl">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{icon}</span>
        <span className={`text-xs font-semibold ${text}`}>{label}</span>
        {/* Confidence bar */}
        <div className="mr-auto flex items-center gap-1">
          <div className="h-1.5 w-12 bg-white/40 dark:bg-black/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-current opacity-60"
              style={{ width: `${entry.confidence}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{entry.confidence}%</span>
        </div>
      </div>
      <p className={`text-sm font-semibold mb-1 ${text}`}>{entry.title}</p>
      <p className="text-xs text-foreground/75 leading-relaxed">{entry.content}</p>
    </div>
  );
}

function InstitutionalMemorySection({
  sectorId, professionId, stageId,
}: {
  sectorId:     string;
  professionId: string;
  stageId:      string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ entries: InstitutionalMemoryEntry[] }>({
    queryKey: ['pgf-im', sectorId, professionId, stageId],
    queryFn:  async () => {
      const res = await apiFetch(`/api/pgf/memory/${sectorId}/${professionId}/${stageId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const entries = data?.entries ?? [];

  // Hide section entirely if there are no entries (and not loading)
  if (!isLoading && entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-dashed border-primary/30 overflow-hidden" dir="rtl">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground hover:bg-muted/20 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-base">🏛️</span>
          <span>الخبرة المؤسسية</span>
          {!isLoading && entries.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({entries.length} {entries.length === 1 ? 'سجل' : 'سجلات'})
            </span>
          )}
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </span>
        {open
          ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-dashed border-primary/20 pt-4">
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          {entries.map((entry) => (
            <InstitutionalMemoryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Professional Workflow Engine (PWE) Section ───────────────────────────────

interface WorkflowBlockProps {
  icon:     string;
  label:    string;
  children: React.ReactNode;
  accent?:  string;
}
function WorkflowBlock({ icon, label, children, accent = "bg-muted/30" }: WorkflowBlockProps) {
  return (
    <div className={`rounded-xl p-3.5 ${accent}`} dir="rtl">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
        <span>{icon}</span>{label}
      </p>
      {children}
    </div>
  );
}

function WorkflowStep({ step }: { step: ProfessionalWorkflowStep }) {
  return (
    <div className="space-y-3" dir="rtl">
      {/* Title + duration badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-foreground leading-snug">{step.title}</p>
        <span className="shrink-0 text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
          ⏱️ {step.estimatedDuration}
        </span>
      </div>

      {/* Objective */}
      <WorkflowBlock icon="🎯" label="الهدف" accent="bg-blue-50 dark:bg-blue-900/10">
        <p className="text-sm text-foreground/80 leading-relaxed">{step.objective}</p>
      </WorkflowBlock>

      {/* Next action */}
      <WorkflowBlock icon="⚡" label="الإجراء التالي الفوري" accent="bg-amber-50 dark:bg-amber-900/10">
        <p className="text-sm text-foreground/80 leading-relaxed">{step.nextAction}</p>
      </WorkflowBlock>

      {/* Required documents */}
      {step.requiredDocuments.length > 0 && (
        <WorkflowBlock icon="📄" label="المستندات المطلوبة" accent="bg-violet-50 dark:bg-violet-900/10">
          <ul className="space-y-1">
            {step.requiredDocuments.map((d, i) => (
              <li key={i} className="text-xs text-foreground/75 flex items-start gap-1.5">
                <span className="text-violet-500 mt-0.5 shrink-0">•</span>{d}
              </li>
            ))}
          </ul>
        </WorkflowBlock>
      )}

      {/* Approvals */}
      {step.approvals.length > 0 && (
        <WorkflowBlock icon="✅" label="الموافقات المطلوبة" accent="bg-emerald-50 dark:bg-emerald-900/10">
          <ul className="space-y-1">
            {step.approvals.map((a, i) => (
              <li key={i} className="text-xs text-foreground/75 flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{a}
              </li>
            ))}
          </ul>
        </WorkflowBlock>
      )}

      {/* Checkpoints */}
      {step.checkpoints.length > 0 && (
        <WorkflowBlock icon="🔍" label="نقاط التحقق" accent="bg-sky-50 dark:bg-sky-900/10">
          <ul className="space-y-1">
            {step.checkpoints.map((c, i) => (
              <li key={i} className="text-xs text-foreground/75 flex items-start gap-1.5">
                <span className="text-sky-500 mt-0.5 shrink-0">◇</span>{c}
              </li>
            ))}
          </ul>
        </WorkflowBlock>
      )}

      {/* Branch rules */}
      {step.branchRules.length > 0 && (
        <WorkflowBlock icon="🔀" label="المسارات الممكنة" accent="bg-indigo-50 dark:bg-indigo-900/10">
          <div className="space-y-2">
            {step.branchRules.map((b, i) => (
              <div key={i} className="text-xs">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">إذا: </span>
                <span className="text-foreground/70">{b.condition}</span>
                <br />
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">→ </span>
                <span className="text-foreground/80">{b.outcome}</span>
              </div>
            ))}
          </div>
        </WorkflowBlock>
      )}

      {/* Escalation rules */}
      {step.escalationRules.length > 0 && (
        <WorkflowBlock icon="📌" label="شروط التصعيد" accent="bg-red-50 dark:bg-red-900/10">
          <div className="space-y-2">
            {step.escalationRules.map((e, i) => (
              <div key={i} className="text-xs">
                <span className="font-semibold text-red-700 dark:text-red-300">عند: </span>
                <span className="text-foreground/70">{e.condition}</span>
                <br />
                <span className="font-semibold text-red-700 dark:text-red-300">→ </span>
                <span className="text-foreground/80">{e.action}</span>
              </div>
            ))}
          </div>
        </WorkflowBlock>
      )}

      {/* Expected output */}
      <WorkflowBlock icon="📤" label="المخرج المتوقع" accent="bg-green-50 dark:bg-green-900/10">
        <p className="text-sm text-foreground/80 leading-relaxed">{step.expectedOutput}</p>
      </WorkflowBlock>
    </div>
  );
}

function WorkflowSection({
  sectorId, professionId, stageId,
}: {
  sectorId:     string;
  professionId: string;
  stageId:      string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ steps: ProfessionalWorkflowStep[] }>({
    queryKey: ['pgf-workflow', sectorId, professionId, stageId],
    queryFn:  async () => {
      const res = await apiFetch(`/api/pgf/workflow/${sectorId}/${professionId}/${stageId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const steps = data?.steps ?? [];

  // Hide entirely when no workflow exists for this stage
  if (!isLoading && steps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-dashed border-emerald-400/40 overflow-hidden" dir="rtl">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground hover:bg-muted/20 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-base">⚙️</span>
          <span>مسار العمل التنفيذي</span>
          {!isLoading && steps.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({steps.length} {steps.length === 1 ? 'خطوة' : 'خطوات'})
            </span>
          )}
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </span>
        {open
          ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 border-t border-dashed border-emerald-400/20 pt-4 space-y-6">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          {steps.map((step) => (
            <WorkflowStep key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Professional Case Simulator (PCS) Section ───────────────────────────────

type SimPhase = 'idle' | 'loading' | 'active' | 'evaluating' | 'showing_eval' | 'completed';

interface StepHistoryItem {
  step:       PcsSimStep;
  answer:     string;
  evaluation: PcsStepEvaluation;
}

function ScoreBadge({ score, critical }: { score: number; critical: boolean }) {
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : score >= 60 ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-red-100 text-red-800 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${color}`} dir="ltr">
      {score}/100
      {critical && score < 50 && <span className="text-red-600">⚠</span>}
    </span>
  );
}

function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const colors: Record<string, string> = {
    A: 'bg-emerald-500 text-white', B: 'bg-blue-500 text-white',
    C: 'bg-amber-500 text-white',   D: 'bg-orange-500 text-white',
    F: 'bg-red-600 text-white',
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shadow ${colors[grade] ?? 'bg-muted'}`}>
        {grade}
      </div>
      <span className="text-sm font-semibold text-foreground">{score}/100</span>
    </div>
  );
}

function SimFinalReportView({ report, scenarioTitle }: { report: PcsFinalReport; scenarioTitle: string }) {
  return (
    <div className="space-y-5 py-1" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-l from-primary/5 to-transparent border border-primary/10">
        <GradeBadge grade={report.grade} score={report.totalScore} />
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">نتيجة المحاكاة</p>
          <p className="text-base font-bold text-foreground">{scenarioTitle}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {report.timeline.length} خطوات مكتملة
            {report.mistakes.length > 0 && ` • ${report.mistakes.length} ملاحظات`}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">المسار الزمني</p>
        <div className="space-y-2">
          {report.timeline.map((t) => (
            <div key={t.stepIdx} className="flex items-center gap-2.5 text-xs" dir="rtl">
              <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                {t.stepIdx + 1}
              </span>
              <span className="flex-1 text-foreground/80 line-clamp-1">{t.question}</span>
              <ScoreBadge score={t.score} critical={t.criticalError} />
            </div>
          ))}
        </div>
      </div>

      {/* Mistakes */}
      {report.mistakes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">الملاحظات والأخطاء</p>
          <div className="space-y-2">
            {report.mistakes.map((m, i) => (
              <div key={i} className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-xs">
                <p className="font-semibold text-red-800 dark:text-red-300 mb-1">{m.question}</p>
                <p className="text-foreground/70">{m.evaluation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missed docs & approvals */}
      {(report.missedDocuments.length > 0 || report.missedApprovals.length > 0) && (
        <div className="grid grid-cols-1 gap-3">
          {report.missedDocuments.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">📄 مستندات لم تُذكر</p>
              <ul className="space-y-0.5">
                {report.missedDocuments.map((d, i) => (
                  <li key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                    <span className="text-amber-500 shrink-0">•</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.missedApprovals.length > 0 && (
            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800">
              <p className="text-xs font-semibold text-violet-800 dark:text-violet-300 mb-1.5">✅ موافقات لم تُذكر</p>
              <ul className="space-y-0.5">
                {report.missedApprovals.map((a, i) => (
                  <li key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                    <span className="text-violet-500 shrink-0">•</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5">💪 نقاط القوة</p>
          <ul className="space-y-0.5">
            {report.strengths.map((s, i) => (
              <li key={i} className="text-xs text-foreground/70">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1.5">📌 توصيات التطوير</p>
          <ul className="space-y-1">
            {report.recommendations.slice(0, 5).map((r, i) => (
              <li key={i} className="text-xs text-foreground/70">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepEvalView({ evaluation, stepIdx, totalSteps }: { evaluation: PcsStepEvaluation; stepIdx: number; totalSteps: number }) {
  return (
    <div className="space-y-3 py-2" dir="rtl">
      {/* Score header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          الخطوة {stepIdx + 1} من {totalSteps}
        </span>
        <ScoreBadge score={evaluation.score} critical={evaluation.criticalError} />
      </div>

      {/* Evaluation */}
      <div className={`p-3 rounded-xl text-xs leading-relaxed border ${
        evaluation.criticalError
          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-foreground'
          : evaluation.score >= 80
            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-foreground'
            : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-foreground'
      }`}>
        {evaluation.criticalError && (
          <p className="font-bold text-red-700 dark:text-red-400 mb-1">⚠️ خطأ في خطوة حرجة</p>
        )}
        {evaluation.evaluation}
      </div>

      {/* Missed items */}
      {(evaluation.missedDocuments.length > 0 || evaluation.missedApprovals.length > 0) && (
        <div className="space-y-1.5">
          {evaluation.missedDocuments.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <span className="font-semibold">📄 مستندات لم تُذكر: </span>
              {evaluation.missedDocuments.join("، ")}
            </div>
          )}
          {evaluation.missedApprovals.length > 0 && (
            <div className="text-xs text-violet-700 dark:text-violet-400">
              <span className="font-semibold">✅ موافقات لم تُذكر: </span>
              {evaluation.missedApprovals.join("، ")}
            </div>
          )}
        </div>
      )}

      {/* Recommendation */}
      <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
        <span className="font-semibold">التوجيه: </span>{evaluation.recommendation}
      </div>
    </div>
  );
}

function SimulatorSection({
  sectorId, professionId,
}: {
  sectorId:     string;
  professionId: string;
}) {
  const [open,         setOpen]         = useState(false);
  const [phase,        setPhase]        = useState<SimPhase>('idle');
  const [sessionId,    setSessionId]    = useState<number | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [scenarioContext, setScenarioContext] = useState('');
  const [currentStep,  setCurrentStep]  = useState<PcsSimStep | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [history,      setHistory]      = useState<StepHistoryItem[]>([]);
  const [lastEval,     setLastEval]     = useState<PcsStepEvaluation | null>(null);
  const [finalReport,  setFinalReport]  = useState<PcsFinalReport | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // Check if a scenario exists for this profession
  const { data: scenarioMeta, isLoading: scenarioLoading } = useQuery<{ scenarioId: string; scenarioTitle: string }>({
    queryKey: ['pcs-scenario-check', sectorId, professionId],
    queryFn:  async () => {
      const res = await apiFetch(`/api/pcs/scenarios/${sectorId}/${professionId}`);
      if (!res.ok) throw new Error('No scenario');
      return res.json();
    },
    retry: false,
  });

  // Hide entirely if no scenario available for this profession
  if (!scenarioLoading && !scenarioMeta) return null;

  async function startSimulation() {
    setPhase('loading');
    setError(null);
    setHistory([]);
    setLastEval(null);
    setFinalReport(null);
    setCurrentAnswer('');
    try {
      const res = await apiFetch('/api/pcs/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectorId, professionId }),
      });
      if (!res.ok) throw new Error('Failed to start simulation');
      const data: PcsStartResponse = await res.json();
      setSessionId(data.session.id);
      setScenarioTitle(data.scenarioTitle);
      setScenarioContext(data.scenarioContext);
      setCurrentStep(data.currentStep);
      setPhase('active');
    } catch {
      setError('تعذّر بدء المحاكاة. يُرجى المحاولة مجدداً.');
      setPhase('idle');
    }
  }

  async function submitAnswer() {
    if (!sessionId || !currentStep || currentAnswer.trim().length < 5) return;
    setPhase('evaluating');
    setError(null);
    try {
      const res = await apiFetch(`/api/pcs/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: currentAnswer.trim() }),
      });
      if (!res.ok) throw new Error('Failed to submit answer');
      const data: PcsAnswerResponse = await res.json();

      // Save this step to history
      setHistory((prev) => [...prev, { step: currentStep, answer: currentAnswer.trim(), evaluation: data.evaluation }]);
      setLastEval(data.evaluation);
      setCurrentAnswer('');

      if (data.isLastStep && data.report) {
        setFinalReport(data.report);
        setPhase('completed');
      } else {
        setCurrentStep(data.nextStep ?? null);
        setPhase('showing_eval');
      }
    } catch {
      setError('تعذّر إرسال الإجابة. يُرجى المحاولة مجدداً.');
      setPhase('active');
    }
  }

  function continueToNext() {
    setLastEval(null);
    setPhase('active');
  }

  function reset() {
    setPhase('idle');
    setSessionId(null);
    setCurrentStep(null);
    setHistory([]);
    setLastEval(null);
    setFinalReport(null);
    setCurrentAnswer('');
    setError(null);
  }

  return (
    <div className="rounded-2xl border border-dashed border-sky-400/40 overflow-hidden" dir="rtl">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground hover:bg-muted/20 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-base">🎭</span>
          <span>محاكاة الواقعة</span>
          {!scenarioLoading && scenarioMeta && (
            <span className="text-xs font-normal text-muted-foreground">
              {scenarioMeta.scenarioTitle}
            </span>
          )}
          {scenarioLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {phase === 'completed' && finalReport && (
            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
              {finalReport.grade} — {finalReport.totalScore}/100
            </span>
          )}
        </span>
        {open
          ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="border-t border-dashed border-sky-400/20">

          {/* ── IDLE ── */}
          {phase === 'idle' && (
            <div className="px-5 py-5 space-y-4">
              {scenarioMeta && (
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{scenarioMeta.scenarioTitle}</span>
                  <span> — محاكاة تفاعلية خطوة بخطوة لمهاراتك المهنية مع تقييم بالذكاء الاصطناعي.</span>
                </div>
              )}
              {error && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">{error}</p>
              )}
              <Button onClick={startSimulation} className="gap-2 w-full" variant="outline">
                <Zap className="w-4 h-4" />
                بدء المحاكاة
              </Button>
            </div>
          )}

          {/* ── LOADING ── */}
          {phase === 'loading' && (
            <div className="flex items-center justify-center py-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">جارٍ تحضير المحاكاة…</p>
              </div>
            </div>
          )}

          {/* ── ACTIVE — answering current step ── */}
          {(phase === 'active') && currentStep && (
            <div className="px-5 py-5 space-y-4">
              {/* Scenario context — shown only on step 0 */}
              {currentStep.stepIdx === 0 && (
                <div className="p-4 rounded-xl bg-muted/30 border text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
                  <p className="font-bold text-foreground mb-2">📋 وقائع القضية</p>
                  {scenarioContext}
                </div>
              )}

              {/* History (collapsed previous steps) */}
              {history.length > 0 && (
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/20 border border-border/50 text-xs" dir="rtl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-foreground/70">الخطوة {i + 1}</span>
                        <ScoreBadge score={h.evaluation.score} critical={h.evaluation.criticalError} />
                      </div>
                      <p className="text-foreground/60 line-clamp-1">{h.step.question}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${((currentStep.stepIdx) / currentStep.totalSteps) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {currentStep.stepIdx + 1} / {currentStep.totalSteps}
                </span>
              </div>

              {/* Question */}
              <div className="space-y-1">
                {currentStep.critical && (
                  <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> خطوة حرجة
                  </span>
                )}
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {currentStep.question}
                </p>
              </div>

              {/* Required items hint */}
              {(currentStep.requiredDocuments.length > 0 || currentStep.requiredApprovals.length > 0) && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {currentStep.requiredDocuments.length > 0 && (
                    <p>📄 مستندات متوقعة: {currentStep.requiredDocuments.join("، ")}</p>
                  )}
                  {currentStep.requiredApprovals.length > 0 && (
                    <p>✅ موافقات متوقعة: {currentStep.requiredApprovals.join("، ")}</p>
                  )}
                </div>
              )}

              {/* Answer textarea */}
              <Textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="اكتب إجابتك هنا بالتفصيل…"
                className="min-h-[110px] text-sm resize-none"
                dir="rtl"
              />

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">{error}</p>
              )}

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={reset}
                >
                  <X className="w-3 h-3 ml-1" /> إعادة البدء
                </Button>
                <Button
                  onClick={submitAnswer}
                  disabled={currentAnswer.trim().length < 5}
                  className="gap-2"
                  size="sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  إرسال الإجابة
                </Button>
              </div>
            </div>
          )}

          {/* ── EVALUATING ── */}
          {phase === 'evaluating' && (
            <div className="flex items-center justify-center py-10">
              <div className="flex flex-col items-center gap-2">
                <Brain className="w-7 h-7 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">جارٍ تقييم إجابتك…</p>
              </div>
            </div>
          )}

          {/* ── SHOWING EVALUATION (before next step) ── */}
          {phase === 'showing_eval' && lastEval && currentStep && (
            <div className="px-5 py-5 space-y-4">
              <StepEvalView
                evaluation={lastEval}
                stepIdx={history.length - 1}
                totalSteps={currentStep.totalSteps}
              />
              <Button onClick={continueToNext} className="w-full gap-2" size="sm">
                <ArrowLeft className="w-3.5 h-3.5" />
                الخطوة التالية
              </Button>
            </div>
          )}

          {/* ── COMPLETED — final report ── */}
          {phase === 'completed' && finalReport && (
            <div className="px-5 py-5 space-y-4">
              {lastEval && history.length > 0 && (
                <StepEvalView
                  evaluation={lastEval}
                  stepIdx={history.length - 1}
                  totalSteps={history.length}
                />
              )}
              <div className="border-t border-dashed border-sky-400/20 pt-4">
                <SimFinalReportView report={finalReport} scenarioTitle={scenarioTitle} />
              </div>
              <Button variant="outline" onClick={reset} className="w-full gap-2" size="sm">
                <Zap className="w-3.5 h-3.5" />
                محاكاة جديدة
              </Button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Expert Actions Slide-in ──────────────────────────────────────────────────

function ExpertActionsPanel({
  sectorId, professionId, stage, onClose,
}: {
  sectorId:     string;
  professionId: string;
  stage:        PgfWorkflowStage;
  onClose:      () => void;
}) {
  const { data, isLoading } = useQuery<ExpertActionsResponse>({
    queryKey: ['pgf-expert-actions', sectorId, professionId, stage.id],
    queryFn:  async () => {
      const res = await apiFetch(`/api/pgf/professions/${sectorId}/${professionId}/stages/${stage.id}/expert-actions`);
      if (!res.ok) throw new Error('Not found');
      return res.json();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* Panel — slides in from the right (RTL: right side = start) */}
      <div className="w-full max-w-sm bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">ماذا سيفعل الخبير؟</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-800/40">
            <X className="w-4 h-4 text-amber-600" />
          </button>
        </div>

        {/* Stage title */}
        <div className="px-4 py-3 border-b">
          <p className="text-xs text-muted-foreground">المرحلة الحالية</p>
          <p className="text-sm font-semibold">{stage.icon} {stage.title}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {data && (
            <>
              {/* Why this matters */}
              {data.whyThisMatters && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">لماذا هذا يهمّ؟</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{data.whyThisMatters}</p>
                </div>
              )}

              {/* Mentor prompt quote */}
              {data.mentorPrompt && (
                <blockquote className="border-r-4 border-primary/40 pr-3 py-1 italic text-sm text-muted-foreground">
                  {data.mentorPrompt}
                </blockquote>
              )}

              {/* Expert first actions */}
              {data.expertFirstActions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">الإجراءات الأولى للخبير:</p>
                  <ol className="space-y-2">
                    {data.expertFirstActions.slice(0, 5).map((action, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                          {i + 1}
                        </span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Stage form ───────────────────────────────────────────────────────────────

function StageForm({
  stage, completedStages, totalStages, stageIndex,
  sectorId, professionId,
  onSubmit, isSubmitting,
}: {
  stage:           PgfWorkflowStage;
  completedStages: string[];
  totalStages:     number;
  stageIndex:      number;
  sectorId:        string;
  professionId:    string;
  onSubmit:        (answers: Record<string, string | string[] | boolean>) => void;
  isSubmitting:    boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});
  const [showExpert, setShowExpert] = useState(false);

  const allValid = stage.questions
    .filter((q) => q.required)
    .every((q) => isAnswerValid(q, answers[q.id]));

  return (
    <div className="space-y-4">
      {/* Expert actions slide-in */}
      {showExpert && (
        <ExpertActionsPanel
          sectorId={sectorId}
          professionId={professionId}
          stage={stage}
          onClose={() => setShowExpert(false)}
        />
      )}

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
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 mb-1">
              {stage.icon && <span className="text-xl">{stage.icon}</span>}
              <h2 className="text-lg font-bold text-foreground">{stage.title}</h2>
            </div>
            {/* Expert actions button — only show if data exists */}
            {(stage.expertFirstActions?.length || stage.mentorPrompt) && (
              <button
                onClick={() => setShowExpert(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                ماذا سيفعل الخبير؟
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground" dir="rtl">{stage.description}</p>
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

      {/* Mentor panel — below the stage card */}
      <MentorPanel stage={stage} />

      {/* Institutional Memory — below mentor panel, hidden when empty */}
      <InstitutionalMemorySection
        sectorId={sectorId}
        professionId={professionId}
        stageId={stage.id}
      />

      {/* PWE — Executable workflow, hidden when no data exists for this stage */}
      <WorkflowSection
        sectorId={sectorId}
        professionId={professionId}
        stageId={stage.id}
      />

      {/* PCS — Professional Case Simulator, shown once on the first stage only */}
      {stageIndex === 0 && (
        <SimulatorSection
          sectorId={sectorId}
          professionId={professionId}
        />
      )}
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

      {/* Expert reasoning (PME field) */}
      {output.expertReasoning && (
        <section className="p-4 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl">
          <SectionTitle icon={<Brain className="w-4.5 h-4.5 text-violet-500" />}>
            تفكير الخبير
          </SectionTitle>
          <p className="text-sm leading-loose text-violet-900 dark:text-violet-200 whitespace-pre-wrap">{output.expertReasoning}</p>
        </section>
      )}

      {/* Verification status (PME field) */}
      {output.verificationStatus && (
        <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium ${
          output.verificationStatus === 'verified'
            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            : output.verificationStatus === 'needs_review'
            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {output.verificationStatus === 'verified'   && <><CheckCircle2 className="w-4 h-4 shrink-0" /> مُتحقَّق منه</>}
          {output.verificationStatus === 'needs_review' && <><AlertTriangle className="w-4 h-4 shrink-0" /> يحتاج مراجعة</>}
          {output.verificationStatus === 'flagged'    && <><AlertCircle className="w-4 h-4 shrink-0" /> مُشار إليه للمتابعة</>}
        </div>
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
            sectorId={session.sectorId}
            professionId={session.professionId}
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
