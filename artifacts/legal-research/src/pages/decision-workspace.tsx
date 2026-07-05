/**
 * Module 1 — Intelligent Administrative Decision Workspace
 * Constitutional administrative decision creation — 11 sequential legal stages.
 * M. Al-Shamsi Framework™ · MARSAD Constitutional Standard v1.0
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Shield, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronDown, ChevronUp,
  Sparkles, Scale, AlertTriangle, Building2, FileText, Loader2, ArrowRight,
  Lock, Check, Fingerprint, Gavel, BookOpen, Users, Link2, HelpCircle,
  Download, Hash, RotateCcw, UserCheck, Activity, Eye, ChevronRight, Play,
} from 'lucide-react';
import DecisionReplay from '@/components/decisions/DecisionReplay';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageKey =
  | 'administrative_request' | 'legal_authority' | 'facts_evidence'
  | 'legal_basis' | 'administrative_objective' | 'discretionary_power'
  | 'proportionality' | 'human_oversight' | 'constitutional_validation'
  | 'decision_drafting' | 'final_review';

interface Decision {
  id: number; caseNumber: string; titleAr: string; titleEn?: string;
  status: string; currentStage: string; stagesCompleted: string[];
  jurisdiction: string; decisionType: string; organizationUnit: string;
  issuingAuthority?: string; createdAt: string;
}

interface DecisionStage {
  id: number; decisionId: number; stageKey: string; stageNumber: number;
  stageData: Record<string, unknown>; aiContribution?: string;
  aiAnalysis: Record<string, unknown>; validationStatus: string;
  validationDetails: Record<string, unknown>; completedAt?: string;
}

interface DciVersion {
  version: number; changedAt: string; changedBy: number; reason: string;
  snapshot: Record<string, unknown>;
}

// ─── JDP Types (matching DB schema) ──────────────────────────────────────────
interface JdpFactualEvent { stageNumber: number; stage: string; stageName: string; date?: string | null; description: string; actor?: string | null; aiContribution?: string | null; }
interface JdpLegalBasisGround { law: string; article?: string | null; relevance: string; }
interface JdpLegalBasis { overview: string; grounds: JdpLegalBasisGround[]; conclusion: string; }
interface JdpLegislationItem { title: string; reference: string; applicableArticles: string[]; relevance: string; }
interface JdpEvidenceItem { type: string; description: string; weight: string; admissibility: string; }
interface JdpEvidence { overview: string; items: JdpEvidenceItem[]; completenessAssessment: string; conclusion: string; }
interface JdpProportionalityTest { result: string; reasoning: string; }
interface JdpProportionality { legitimateAimTest: JdpProportionalityTest; necessityTest: JdpProportionalityTest; strictProportionalityTest: JdpProportionalityTest; overallConclusion: string; }
interface JdpDiscretionary { overview: string; factorsConsidered: string[]; alternativesEvaluated: string; publicInterestBalance: string; conclusion: string; }
interface JdpStageAi { stage: string; stageName: string; contribution: string; humanVerification: string; reviewedBy?: string | null; }
interface JdpAiParticipation { overview: string; totalStagesWithAiAssistance: number; participationLevel: string; stageContributions: JdpStageAi[]; overallAssessment: string; }
interface JdpOversightStep { stage: string; stageName: string; humanAction: string; outcome: string; }
interface JdpHumanOversight { authorizedOfficer: string; position?: string | null; organization?: string | null; oversightLevel: string; verificationSteps: JdpOversightStep[]; conclusion: string; }
interface JdpPrincipleResult { principle: string; passed: boolean; score?: number | null; notes: string; }
interface JdpConstitutionalValidation { overallResult: string; validationDate?: string | null; alShamsiScore?: number | null; principleResults: JdpPrincipleResult[]; conclusion: string; }
interface JdpDciSummary { decisionId: string; decisionType: string; competentAuthority?: string | null; constitutionalValidationStatus: string; alShamsiFrameworkCompliance: string; sealedAt?: string | null; completeAuditHash?: string | null; currentVersion: number; }
interface JdpAuditStage { stageNumber: number; stage: string; stageName: string; auditHash?: string | null; completedAt?: string | null; }
interface JdpAuditChain { overview: string; stages: JdpAuditStage[]; completeHash?: string | null; integrityStatus: string; }
interface JdpVersionHistory { currentVersion: number; isSealed: boolean; sealedAt?: string | null; amendments: DciVersion[]; }
interface JdpJudicialQuestion { category: string; question: string; legalGrounding: string; preparedAnswer: string; relevantEvidence?: string | null; }
interface JdpExplainability { overview: string; decisionRationale: string; alternativesConsidered: string; impactAssessment: string; publicInterestJustification: string; minorityInterestConsiderations?: string | null; conclusion: string; }

interface Jdp {
  id: number; decisionId: number;
  status: 'pending' | 'generating' | 'ready' | 'error';
  generatedAt?: string | null; generatedBy?: number | null;
  generationDurationMs?: number | null; errorMessage?: string | null;
  factualChronology?: JdpFactualEvent[] | null;
  legalBasis?: JdpLegalBasis | null;
  applicableLegislation?: JdpLegislationItem[] | null;
  evidenceSummary?: JdpEvidence | null;
  proportionalityAnalysis?: JdpProportionality | null;
  discretionaryReasoning?: JdpDiscretionary | null;
  aiParticipationExplanation?: JdpAiParticipation | null;
  humanOversightRecord?: JdpHumanOversight | null;
  constitutionalValidationResults?: JdpConstitutionalValidation | null;
  dciSummary?: JdpDciSummary | null;
  auditChain?: JdpAuditChain | null;
  versionHistoryRecord?: JdpVersionHistory | null;
  anticipatedJudicialReviewQuestions?: JdpJudicialQuestion[] | null;
  explainabilityReport?: JdpExplainability | null;
  createdAt: string; updatedAt: string;
}

interface Dci {
  id: number; decisionId: number; decisionType: string;
  competentAuthority: string | null; applicableLegalBasis: string[];
  purposeOfDecision: string | null; humanDecisionOwner: string | null;
  aiParticipationLevel: string; humanOversightLevel: string;
  explainabilityLevel: string; transparencyLevel: string;
  evidenceCompleteness: string; proportionalityStatus: string;
  legalityStatus: string; constitutionalValidationStatus: string;
  alShamsiFrameworkCompliance: string;
  // HII & AI Actual Influence
  humanInfluenceIndex: string; aiActualInfluence: string;
  // QVA & LSI
  lsiStatus: string; qvaVarianceLevel: string;
  qvaRunCount: number; qvaResults: unknown[];
  completeAuditHash: string | null;
  currentVersion: number; versionHistory: DciVersion[];
  isSealed: boolean; sealedAt: string | null; sealedBy: number | null;
  createdAt: string; updatedAt: string;
}

interface Car {
  id: number; decisionId: number; status: string;
  factsReliedUpon: string | null; legalBasisSummary: string | null;
  evidenceConsidered: string[]; alternativesConsidered: string[];
  aiRoleSummary: string | null; humanReviewSummary: string | null;
  reasonsForDecision: string | null; affectedPartyRights: string | null;
  appealInformation: string | null; aiSystemDisclosure: string | null;
  errorMessage: string | null;
  generatedAt: string | null; generatedBy: number | null;
  createdAt: string; updatedAt: string;
}

// ─── DCI Helpers & Panel ─────────────────────────────────────────────────────

const DCI_VALUE_LABELS: Record<string, Record<string, string>> = {
  aiParticipationLevel: {
    pending: 'قيد الإعداد', none: 'لا إسهام', advisory: 'استشاري',
    analytical: 'تحليلي', drafting: 'صياغة', comprehensive: 'شامل — كل المراحل',
  },
  humanOversightLevel: {
    pending: 'قيد الإعداد', full: 'كامل', substantial: 'جوهري', partial: 'جزئي', minimal: 'ضئيل',
  },
  explainabilityLevel: {
    pending: 'قيد الإعداد', high: 'عالية', adequate: 'كافية', partial: 'جزئية', insufficient: 'غير كافية',
  },
  transparencyLevel: {
    pending: 'قيد الإعداد', high: 'عالية', adequate: 'كافية', partial: 'جزئية', insufficient: 'غير كافية',
  },
  evidenceCompleteness: {
    pending: 'قيد الإعداد', complete: 'مكتملة', substantial: 'جوهرية', partial: 'جزئية', insufficient: 'غير كافية',
  },
  proportionalityStatus: {
    pending: 'قيد الإعداد', proportionate: 'متناسب', marginally_proportionate: 'متناسب نسبياً', disproportionate: 'غير متناسب',
  },
  legalityStatus: {
    pending: 'قيد الإعداد', confirmed: 'مؤكدة', questionable: 'قابلة للطعن', violated: 'منتهكة',
  },
  constitutionalValidationStatus: {
    pending: 'قيد التحقق', passed: 'اجتاز التحقق الدستوري', failed: 'لم يجتز التحقق',
  },
  alShamsiFrameworkCompliance: {
    pending: 'قيد الإعداد', full: 'امتثال كامل', substantial: 'امتثال جوهري', partial: 'امتثال جزئي', non_compliant: 'غير ممتثل',
  },
  // ── HII — Human Influence Index ───────────────────────────────────────────
  humanInfluenceIndex: {
    pending: 'قيد الإعداد',
    human_will: 'إرادة بشرية مستقلة',
    ai_recommendation: 'توصية الذكاء الاصطناعي',
    joint_decision: 'قرار مشترك',
  },
  // ── AI Actual Influence ───────────────────────────────────────────────────
  aiActualInfluence: {
    pending: 'قيد الإعداد',
    confirmed_human_direction: 'أكّد التوجه البشري',
    modified_human_direction: 'عدّل التوجه البشري',
    materially_changed_outcome: 'غيّر النتيجة جوهرياً',
  },
  // ── LSI — Legal Stability Index ───────────────────────────────────────────
  lsiStatus: {
    pending: 'لم يُحلَّل بعد',
    stable: 'مستقر',
    variable: 'متذبذب',
    highly_variable: 'عالي التذبذب',
  },
  // ── QVA Variance Level ────────────────────────────────────────────────────
  qvaVarianceLevel: {
    pending: 'لم يُحلَّل بعد',
    low: 'تباين منخفض',
    moderate: 'تباين متوسط',
    high: 'تباين عالٍ',
  },
};

function dciChipClass(value: string): string {
  if (value === 'pending') return 'text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/40 dark:border-slate-700';
  if (['passed', 'confirmed', 'full', 'complete', 'comprehensive', 'human_will', 'stable', 'confirmed_human_direction', 'low'].includes(value))
    return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40';
  if (['substantial', 'adequate', 'proportionate', 'high', 'joint_decision', 'variable', 'moderate', 'modified_human_direction'].includes(value))
    return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800/40';
  if (['partial', 'marginally_proportionate', 'questionable', 'minimal', 'ai_recommendation'].includes(value))
    return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800/40';
  // highly_variable, materially_changed_outcome, non_compliant, failed, violated → red
  return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40';
}

function DciChip({ field, value }: { field: string; value: string | null | undefined }) {
  const v = value ?? 'pending';
  const label = DCI_VALUE_LABELS[field]?.[v] ?? v;
  return (
    <span className={`inline-flex items-center self-start px-2.5 py-0.5 rounded-md border text-xs font-semibold ${dciChipClass(v)}`}>
      {label}
    </span>
  );
}

function DciField({ label, field, value }: { label: string; field: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 leading-none">{label}</p>
      <DciChip field={field} value={value} />
    </div>
  );
}

function DciPanel({ decisionId, decision }: { decisionId: number; decision: Decision }) {
  const [showHistory, setShowHistory] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['dci', decisionId],
    queryFn: () => apiFetch('GET', `/api/decisions/${decisionId}/dci`),
    refetchInterval: 8000,
  });

  const dci: Dci | null = data?.dci ?? null;

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
  // Distinguish server/network errors from genuine absence
  const dataError = (data as { error?: string } | undefined)?.error;
  if (dataError || (!isLoading && !dci)) return (
    <div className="flex items-center justify-center py-24 text-center px-8">
      <div className="space-y-3 max-w-xs">
        <Fingerprint className="w-8 h-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm font-semibold text-foreground">تعذّر تحميل الهوية الدستورية</p>
        <p className="text-xs text-muted-foreground">
          {dataError ?? 'لم يُعثر على الهوية الدستورية لهذا القرار'}
        </p>
      </div>
    </div>
  );

  // dci is guaranteed non-null past this point (all null cases returned above)
  if (!dci) return null;

  const hasHistory = dci.versionHistory?.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-4xl pb-16">

      {/* ── Constitutional Passport Header ─────────────────────── */}
      <div className={`rounded-2xl border-2 p-5 sm:p-6 ${dci.isSealed
        ? 'border-amber-300/70 bg-gradient-to-br from-amber-50/70 to-amber-50/30 dark:border-amber-700/50 dark:from-amber-950/25 dark:to-transparent'
        : 'border-border bg-card'}`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest text-muted-foreground/50 uppercase" dir="ltr">
              {decision.caseNumber} · DCI · v{dci.currentVersion}
            </div>
            <div className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-foreground/60 shrink-0" />
              <h2 className="text-lg font-bold text-foreground">الهوية الدستورية للقرار</h2>
            </div>
            <p className="text-xs text-muted-foreground">الجواز الدستوري · إطار الشامسي™ · MARSAD Constitutional Standard v1.0</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {dci.isSealed ? (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-300/80 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <Lock className="w-3 h-3" /> مُختوم دستورياً
                </div>
                {dci.sealedAt && (
                  <span className="text-[10px] text-muted-foreground/50" dir="ltr">
                    {new Date(dci.sealedAt).toLocaleDateString('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-bold">
                <Clock className="w-3 h-3" /> قيد الإعداد
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Decision Identity ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40 pb-2">هوية القرار</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">معرّف القرار</p>
            <p className="text-sm font-mono font-bold text-foreground" dir="ltr">{decision.caseNumber}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">نوع القرار</p>
            <p className="text-sm font-semibold text-foreground">{dci.decisionType}</p>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">الجهة المختصة بالإصدار</p>
            <p className="text-sm text-foreground">{dci.competentAuthority ?? <span className="text-muted-foreground italic">— قيد الإعداد (مرحلة التحقق من الاختصاص) —</span>}</p>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">الغرض من القرار</p>
            <p className="text-sm text-foreground leading-relaxed">{dci.purposeOfDecision ?? <span className="text-muted-foreground italic">— قيد الإعداد (مرحلة الهدف الإداري) —</span>}</p>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">المالك البشري للقرار</p>
            <p className="text-sm text-foreground">{dci.humanDecisionOwner ?? <span className="text-muted-foreground italic">— قيد الإعداد (مرحلة الرقابة البشرية) —</span>}</p>
          </div>
          {dci.applicableLegalBasis && dci.applicableLegalBasis.length > 0 && (
            <div className="sm:col-span-2 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">السند القانوني المنطبق</p>
              <div className="space-y-1">
                {dci.applicableLegalBasis.map((basis, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground/80 py-1 border-b border-border/20 last:border-0">
                    <span className="text-muted-foreground/40 font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <span>{basis}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!dci.applicableLegalBasis || dci.applicableLegalBasis.length === 0) && (
            <div className="sm:col-span-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">السند القانوني المنطبق</p>
              <p className="text-xs text-muted-foreground italic">— قيد الإعداد (مرحلة السند القانوني) —</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Constitutional Assessment Grid ─────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40 pb-2">التقييم الدستوري الشامل</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <DciField label="إسهام الذكاء الاصطناعي" field="aiParticipationLevel" value={dci.aiParticipationLevel} />
          <DciField label="الرقابة البشرية" field="humanOversightLevel" value={dci.humanOversightLevel} />
          <DciField label="القابلية للتفسير" field="explainabilityLevel" value={dci.explainabilityLevel} />
          <DciField label="الشفافية" field="transparencyLevel" value={dci.transparencyLevel} />
          <DciField label="اكتمال الأدلة" field="evidenceCompleteness" value={dci.evidenceCompleteness} />
          <DciField label="التناسب" field="proportionalityStatus" value={dci.proportionalityStatus} />
          <DciField label="المشروعية" field="legalityStatus" value={dci.legalityStatus} />
          <DciField label="التحقق الدستوري" field="constitutionalValidationStatus" value={dci.constitutionalValidationStatus} />
          <DciField label="امتثال إطار الشامسي" field="alShamsiFrameworkCompliance" value={dci.alShamsiFrameworkCompliance} />
        </div>
      </div>

      {/* ── Human Influence Index (HII) & AI Actual Influence ──── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">مؤشر التأثير البشري — HII & AI Influence</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <DciField label="مؤشر التأثير البشري (HII)" field="humanInfluenceIndex" value={dci.humanInfluenceIndex} />
          <DciField label="التأثير الفعلي للذكاء الاصطناعي" field="aiActualInfluence" value={dci.aiActualInfluence} />
        </div>
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
          يقيس مؤشر التأثير البشري ما إذا كانت إرادة الإنسان هي المُشكِّلة الفعلية للقرار أم توصية الذكاء الاصطناعي.
          التأثير الفعلي يُسجِّل ما إذا كان الذكاء الاصطناعي قد أكّد التوجه البشري أم عدّله أم غيّره.
        </p>
      </div>

      {/* ── QVA & LSI ──────────────────────────────────────────── */}
      <QvaSection decisionId={decisionId} dci={dci} />

      {/* ── Integrity & Hash ───────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40 pb-2">سلامة البيانات والبصمة الرقمية</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">بصمة التحقق الدستورية الشاملة (SHA-256)</p>
            {dci.completeAuditHash ? (
              <p className="text-[11px] font-mono text-foreground/60 break-all leading-relaxed bg-muted/40 rounded-lg px-3 py-2.5 border border-border/40" dir="ltr">
                {dci.completeAuditHash}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">تُحسب تلقائياً عند اجتياز التحقق الدستوري (المرحلة 9)</p>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground/60">الإصدار:</span> {dci.currentVersion}</span>
            <span><span className="font-semibold text-foreground/60">أُنشئ:</span> <span dir="ltr">{new Date(dci.createdAt).toLocaleDateString('ar-AE')}</span></span>
            <span><span className="font-semibold text-foreground/60">آخر تحديث:</span> <span dir="ltr">{new Date(dci.updatedAt).toLocaleDateString('ar-AE')}</span></span>
          </div>
        </div>
      </div>

      {/* ── Version History ────────────────────────────────────── */}
      {hasHistory && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              سجل التعديلات الدستورية ({dci.versionHistory.length})
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showHistory && (
            <div className="px-5 pb-4 space-y-0 border-t border-border/40 divide-y divide-border/30">
              {dci.versionHistory.map((v) => (
                <div key={v.version} className="py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded" dir="ltr">v{v.version}→v{v.version + 1}</span>
                    <span className="text-[10px] text-muted-foreground/50" dir="ltr">{new Date(v.changedAt).toLocaleString('ar-AE')}</span>
                  </div>
                  <p className="text-xs font-medium text-foreground/80">{v.reason}</p>
                  <p className="text-[10px] text-muted-foreground/50">الحقول المُعدَّلة: {Object.keys(v.snapshot).join('، ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-[10px] text-muted-foreground/30 tracking-wide">
          Powered by the M. Al-Shamsi Framework™ · MARSAD Constitutional Standard v1.0
        </p>
      </div>
    </div>
  );
}

// ─── QVA Section Component ────────────────────────────────────────────────────

function QvaSection({ decisionId, dci }: { decisionId: number; dci: Dci }) {
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const qc = useQueryClient();

  const lsiColors: Record<string, string> = {
    stable:          'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40',
    variable:        'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800/40',
    highly_variable: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40',
    pending:         'text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/40 dark:border-slate-700',
  };
  const lsiLabels: Record<string, string> = {
    stable: 'مستقر', variable: 'متذبذب', highly_variable: 'عالي التذبذب', pending: 'لم يُحلَّل',
  };
  const varLabels: Record<string, string> = {
    low: 'تباين منخفض', moderate: 'تباين متوسط', high: 'تباين عالٍ', pending: 'لم يُحلَّل',
  };

  const handleRunQva = async () => {
    setIsRunning(true); setRunError(null);
    try {
      await apiFetch('POST', `/api/decisions/${decisionId}/qva/run`, {});
      qc.invalidateQueries({ queryKey: ['dci', decisionId] });
    } catch (e: unknown) {
      setRunError((e as Error)?.message || 'فشل تشغيل QVA');
    }
    setIsRunning(false);
  };

  const hasRun = dci.qvaRunCount > 0;
  const lsi = dci.lsiStatus ?? 'pending';
  const qva = dci.qvaVarianceLevel ?? 'pending';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">تحليل التباين الكمي QVA · مؤشر الاستقرار القانوني LSI</h3>
        </div>
        {dci.isSealed && (
          <button onClick={handleRunQva} disabled={isRunning}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background text-[10px] font-bold text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 shrink-0">
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            {isRunning ? 'جارٍ التحليل...' : hasRun ? 'إعادة التحليل' : 'تشغيل QVA'}
          </button>
        )}
      </div>

      {!dci.isSealed && (
        <p className="text-xs text-muted-foreground/60 italic">يتوفر QVA بعد اكتمال التحقق الدستوري وختم الهوية الدستورية.</p>
      )}

      {dci.isSealed && !hasRun && !isRunning && (
        <p className="text-xs text-muted-foreground/60 italic">
          يُشغِّل QVA نفس التحليل الدستوري ثلاث مرات مستقلة ويقيس تباين النتائج.
          نتيجة مستقرة تعني اتساق الذكاء الاصطناعي؛ نتيجة متذبذبة تستدعي مراجعة بشرية أعمق.
        </p>
      )}

      {hasRun && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">مؤشر الاستقرار القانوني (LSI)</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold ${lsiColors[lsi] ?? lsiColors.pending}`}>
              {lsiLabels[lsi] ?? lsi}
            </span>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">مستوى التباين</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold ${lsiColors[qva === 'low' ? 'stable' : qva === 'moderate' ? 'variable' : qva === 'high' ? 'highly_variable' : 'pending']}`}>
              {varLabels[qva] ?? qva}
            </span>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">عدد التشغيلات المنجزة</p>
            <p className="text-sm font-mono font-bold text-foreground">{dci.qvaRunCount} / 3</p>
          </div>
        </div>
      )}

      {runError && (
        <p className="text-xs text-red-600 dark:text-red-400 font-mono">{runError}</p>
      )}

      <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
        QVA هو إجراء تقني يُقيّم ثبات نتائج الذكاء الاصطناعي عبر تشغيلات مستقلة.
        LSI هو التصنيف القانوني للاستقرار: مستقر · متذبذب · عالي التذبذب.
      </p>
    </div>
  );
}

// ─── CAR Panel ────────────────────────────────────────────────────────────────

function CarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/30">
        <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function CarPanel({ decisionId, decision }: { decisionId: number; decision: Decision }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['car', decisionId],
    queryFn: () => apiFetch('GET', `/api/decisions/${decisionId}/car`),
    retry: false,
    refetchInterval: (q) => {
      const s = (q.state.data as { car?: { status: string } } | undefined)?.car?.status;
      return s === 'generating' ? 4000 : false;
    },
  });

  const car: Car | null = data?.car ?? null;
  const notFound = !isLoading && (!data || data.error || !car);
  const statusReady = car?.status === 'ready';
  const statusGenerating = car?.status === 'generating' || isGenerating;
  const statusError = car?.status === 'error';

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await apiFetch('POST', `/api/decisions/${decisionId}/car/generate`, {});
      await refetch();
      qc.invalidateQueries({ queryKey: ['car', decisionId] });
    } catch (e: unknown) {
      alert((e as Error)?.message || 'فشل توليد سجل المساءلة الدستورية');
    }
    setIsGenerating(false);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl pb-20">

      {/* ── Status Header ───────────────────────────────────── */}
      <div className={`rounded-2xl border-2 p-5 sm:p-6 ${statusReady ? 'border-blue-300/70 bg-gradient-to-br from-blue-50/60 to-transparent dark:border-blue-700/40 dark:from-blue-950/20' : statusError ? 'border-red-300/60 bg-red-50/30 dark:border-red-800/40' : 'border-border bg-card'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest text-muted-foreground/50 uppercase" dir="ltr">
              {decision.caseNumber} · CAR · سجل المساءلة الدستورية
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-foreground/60 shrink-0" />
              <h2 className="text-lg font-bold text-foreground">سجل المساءلة الدستورية</h2>
            </div>
            <p className="text-xs text-muted-foreground">وثيقة شفافية للأطراف المتأثرة · باللغة العربية السهلة · إطار الشامسي™</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {statusReady ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> جاهز للإفصاح
              </div>
            ) : statusGenerating ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التوليد...
              </div>
            ) : statusError ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 text-xs font-bold">
                <XCircle className="w-3.5 h-3.5" /> فشل التوليد
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-bold">
                <Clock className="w-3 h-3" /> لم يُولَّد بعد
              </div>
            )}
            {!statusGenerating && (
              <button onClick={handleGenerate} disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                {statusError ? <RotateCcw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                {statusReady ? 'إعادة التوليد' : statusError ? 'إعادة المحاولة' : 'توليد السجل'}
              </button>
            )}
          </div>
        </div>

        {statusError && car?.errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
            <p className="text-xs text-red-700 dark:text-red-400 font-mono break-all">{car.errorMessage}</p>
          </div>
        )}

        {(notFound || (!car && !isGenerating)) && (
          <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
            <p className="text-sm text-foreground/80 leading-relaxed">
              سجل المساءلة الدستورية (CAR) وثيقة شفافية تُخصَّص للأطراف المتأثرة بالقرار الإداري.
              تشرح باللغة العربية المبسّطة: لماذا اتُّخذ القرار، وما هي حقوق الطرف المتأثر، وكيف يمكنه التظلم.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {['الوقائع المستند إليها','السند القانوني','الأدلة المُراعاة','البدائل المدروسة','دور الذكاء الاصطناعي','المراجعة البشرية','أسباب القرار','حقوق الطرف المتأثر','معلومات التظلم','إفصاح عن الذكاء الاصطناعي'].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />{s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {statusGenerating && (
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-slate-50/40 dark:bg-slate-900/20 p-10 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-foreground">جارٍ توليد سجل المساءلة الدستورية...</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">يُعدّ MARSAD وثيقة الشفافية المُخصَّصة للأطراف المتأثرة. قد يستغرق ذلك 20–40 ثانية.</p>
        </div>
      )}

      {statusReady && car && (
        <div className="space-y-4">

          {/* AI Disclosure Banner — always first */}
          {car.aiSystemDisclosure && (
            <div className="rounded-xl border border-blue-200/70 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/10 p-4 flex items-start gap-3">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1">إفصاح إلزامي — دور الذكاء الاصطناعي</p>
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed">{car.aiSystemDisclosure}</p>
              </div>
            </div>
          )}

          {car.factsReliedUpon && (
            <CarSection title="01 · الوقائع المستند إليها">
              <p className="text-sm text-foreground/80 leading-relaxed">{car.factsReliedUpon}</p>
            </CarSection>
          )}

          {car.legalBasisSummary && (
            <CarSection title="02 · السند القانوني — بلغة سهلة">
              <p className="text-sm text-foreground/80 leading-relaxed">{car.legalBasisSummary}</p>
            </CarSection>
          )}

          {car.evidenceConsidered.length > 0 && (
            <CarSection title="03 · الأدلة المُراعاة">
              <ul className="space-y-1.5">
                {car.evidenceConsidered.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CarSection>
          )}

          {car.alternativesConsidered.length > 0 && (
            <CarSection title="04 · البدائل التي جرى دراستها">
              <ul className="space-y-1.5">
                {car.alternativesConsidered.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CarSection>
          )}

          {car.aiRoleSummary && (
            <CarSection title="05 · دور الذكاء الاصطناعي في هذا القرار">
              <p className="text-sm text-foreground/80 leading-relaxed">{car.aiRoleSummary}</p>
            </CarSection>
          )}

          {car.humanReviewSummary && (
            <CarSection title="06 · المراجعة البشرية المستقلة">
              <p className="text-sm text-foreground/80 leading-relaxed">{car.humanReviewSummary}</p>
            </CarSection>
          )}

          {car.reasonsForDecision && (
            <CarSection title="07 · أسباب القرار">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{car.reasonsForDecision}</p>
            </CarSection>
          )}

          {car.affectedPartyRights && (
            <div className="rounded-xl border-2 border-emerald-300/70 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/10 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-emerald-200/60 dark:border-emerald-800/30">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 leading-none">08 · حقوقك كطرف متأثر</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-foreground/80 leading-relaxed">{car.affectedPartyRights}</p>
              </div>
            </div>
          )}

          {car.appealInformation && (
            <div className="rounded-xl border-2 border-amber-300/70 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/10 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200/60 dark:border-amber-800/30">
                <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 leading-none">09 · كيفية التظلم والطعن بالقرار</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-foreground/80 leading-relaxed">{car.appealInformation}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center py-2">
            <p className="text-[10px] text-muted-foreground/30 tracking-wide">
              Powered by the M. Al-Shamsi Framework™ · MARSAD Constitutional Transparency Standard v1.0
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JDP Helpers & Panel ──────────────────────────────────────────────────────

function JdpSection({
  title, icon: Icon, children, accent,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3 border-b border-border/40 ${accent ?? 'bg-muted/30'}`}>
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function JdpConclusion({ text }: { text: string }) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/40">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">الخلاصة</p>
      <p className="text-xs text-foreground/80 leading-relaxed">{text}</p>
    </div>
  );
}

function TestChip({ result }: { result: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    passed:   { label: 'اجتاز', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40' },
    marginal: { label: 'هامشي', cls: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800/40' },
    failed:   { label: 'لم يجتز', cls: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40' },
  };
  const { label, cls } = map[result] ?? { label: result, cls: 'text-muted-foreground bg-muted border-border' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${cls}`}>{label}</span>;
}

function JdpPanel({ decisionId, decision }: { decisionId: number; decision: Decision }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jdp', decisionId],
    queryFn: () => apiFetch('GET', `/api/decisions/${decisionId}/jdp`),
    retry: false,
    refetchInterval: (q) => {
      const s = (q.state.data as { jdp?: { status: string } } | undefined)?.jdp?.status;
      return s === 'generating' ? 4000 : false;
    },
  });

  const jdp: Jdp | null = data?.jdp ?? null;
  const notFound = !isLoading && (!data || data.error || !jdp);
  const statusReady = jdp?.status === 'ready';
  const statusGenerating = jdp?.status === 'generating' || isGenerating;
  const statusError = jdp?.status === 'error';

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await apiFetch('POST', `/api/decisions/${decisionId}/jdp/generate`, {});
      await refetch();
      qc.invalidateQueries({ queryKey: ['jdp', decisionId] });
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'فشل توليد حزمة الدفاع القضائي';
      alert(msg);
    }
    setIsGenerating(false);
  };

  const handleExport = () => {
    window.open(`/api/decisions/${decisionId}/jdp/export`, '_blank');
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl pb-20">

      {/* ── Status Header ───────────────────────────────────── */}
      <div className={`rounded-2xl border-2 p-5 sm:p-6 ${statusReady ? 'border-emerald-300/70 bg-gradient-to-br from-emerald-50/60 to-transparent dark:border-emerald-700/40 dark:from-emerald-950/20' : statusError ? 'border-red-300/60 bg-red-50/30 dark:border-red-800/40 dark:bg-red-950/10' : 'border-border bg-card'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest text-muted-foreground/50 uppercase" dir="ltr">
              {decision.caseNumber} · JDP · حزمة الدفاع القضائي
            </div>
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-foreground/60 shrink-0" />
              <h2 className="text-lg font-bold text-foreground">حزمة الدفاع القضائي</h2>
            </div>
            <p className="text-xs text-muted-foreground">أداة دستورية كاملة جاهزة للمحكمة الإدارية · 14 قسماً · إطار الشامسي™</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Status badge */}
            {statusReady ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> جاهزة للمحكمة
              </div>
            ) : statusGenerating ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 text-xs font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التوليد...
              </div>
            ) : statusError ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 text-xs font-bold">
                <XCircle className="w-3.5 h-3.5" /> فشل التوليد
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-bold">
                <Clock className="w-3 h-3" /> لم تُولَّد بعد
              </div>
            )}
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {statusReady && (
                <button onClick={handleExport} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors">
                  <Download className="w-3.5 h-3.5" /> تصدير
                </button>
              )}
              {!statusGenerating && (
                <button onClick={handleGenerate} disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {statusError ? <RotateCcw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {statusReady ? 'إعادة التوليد' : statusError ? 'إعادة المحاولة' : 'توليد الحزمة'}
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Error detail */}
        {statusError && jdp?.errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
            <p className="text-xs text-red-700 dark:text-red-400 font-mono break-all">{jdp.errorMessage}</p>
          </div>
        )}
        {/* Explanation when not yet generated */}
        {(notFound || (!jdp && !isGenerating)) && (
          <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
            <p className="text-sm text-foreground/80 leading-relaxed">
              تُنشأ حزمة الدفاع القضائي تلقائياً بعد ختم الهوية الدستورية للقرار.
              تشتمل الحزمة على 14 قسماً دستورياً يُغطي كل جانب يُحتمل إثارته أمام المحكمة الإدارية.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {['السجل الوقائي التسلسلي','السند القانوني','التشريعات السارية','ملخص الأدلة','تحليل التناسب','الاستنساب الإداري','إسهام الذكاء الاصطناعي','سجل الرقابة البشرية','نتائج التحقق الدستوري','ملخص الهوية الدستورية','سلسلة التدقيق','سجل الإصدارات','الأسئلة القضائية المتوقعة','تقرير قابلية التفسير'].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <CheckCircle2 className="w-3 h-3 text-muted-foreground/30 shrink-0" />{s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Generating spinner ───────────────────────────────── */}
      {statusGenerating && (
        <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/10 p-10 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="text-sm font-semibold text-foreground">جارٍ توليد حزمة الدفاع القضائي...</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            يُحلّل نظام MARSAD كامل مراحل القرار ويُعدّ الحجج القانونية لكل قسم من الأقسام الدستورية الأربعة عشر. قد يستغرق ذلك 30–60 ثانية.
          </p>
        </div>
      )}

      {/* ── 14 Constitutional Sections ──────────────────────── */}
      {statusReady && jdp && (
        <div className="space-y-4">

          {/* 01 — Factual Chronology */}
          {jdp.factualChronology && jdp.factualChronology.length > 0 && (
            <JdpSection title="01 · السجل الوقائي التسلسلي" icon={Clock}>
              <div className="space-y-0">
                {jdp.factualChronology.map((ev, i) => (
                  <div key={i} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center gap-0">
                      <div className="w-6 h-6 rounded-full bg-foreground/8 border border-border flex items-center justify-center text-[9px] font-mono font-bold text-foreground/50 shrink-0">{ev.stageNumber}</div>
                      {i < jdp.factualChronology!.length - 1 && <div className="w-px flex-1 bg-border/40 mt-1 min-h-[12px]" />}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-foreground">{ev.stageName}</span>
                        {ev.date && <span className="text-[10px] text-muted-foreground/60 font-mono" dir="ltr">{ev.date.substring(0, 10)}</span>}
                        {ev.actor && <span className="text-[10px] text-muted-foreground/60">· {ev.actor}</span>}
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{ev.description}</p>
                      {ev.aiContribution && (
                        <p className="text-[10px] text-muted-foreground/55 mt-1.5 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 shrink-0" /> {ev.aiContribution}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </JdpSection>
          )}

          {/* 02 — Legal Basis */}
          {jdp.legalBasis && (
            <JdpSection title="02 · السند القانوني" icon={Scale}>
              <p className="text-xs text-foreground/80 leading-relaxed mb-3">{jdp.legalBasis.overview}</p>
              {jdp.legalBasis.grounds.length > 0 && (
                <div className="space-y-2">
                  {jdp.legalBasis.grounds.map((g, i) => (
                    <div key={i} className="flex gap-2 text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                      <span className="text-muted-foreground/40 font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}.</span>
                      <div>
                        <span className="font-semibold text-foreground">{g.law}</span>
                        {g.article && <span className="text-muted-foreground ml-1 mr-1">·</span>}
                        {g.article && <span className="font-mono text-[10px] text-muted-foreground">{g.article}</span>}
                        <p className="text-foreground/70 mt-0.5">{g.relevance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <JdpConclusion text={jdp.legalBasis.conclusion} />
            </JdpSection>
          )}

          {/* 03 — Applicable Legislation */}
          {jdp.applicableLegislation && jdp.applicableLegislation.length > 0 && (
            <JdpSection title="03 · التشريعات السارية" icon={BookOpen}>
              <div className="space-y-3">
                {jdp.applicableLegislation.map((leg, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">{leg.title}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0" dir="ltr">{leg.reference}</span>
                    </div>
                    {leg.applicableArticles.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {leg.applicableArticles.map((art, j) => (
                          <span key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground/6 border border-border/40 text-foreground/60" dir="ltr">{art}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">{leg.relevance}</p>
                  </div>
                ))}
              </div>
            </JdpSection>
          )}

          {/* 04 — Evidence Summary */}
          {jdp.evidenceSummary && (
            <JdpSection title="04 · ملخص الأدلة" icon={FileText}>
              <p className="text-xs text-foreground/80 leading-relaxed mb-3">{jdp.evidenceSummary.overview}</p>
              {jdp.evidenceSummary.items.length > 0 && (
                <div className="space-y-2">
                  {jdp.evidenceSummary.items.map((item, i) => (
                    <div key={i} className="flex gap-3 text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                      <div className="shrink-0 mt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${item.weight === 'high' ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40' : item.weight === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800/40' : 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/30 dark:border-slate-700'}`}>{item.weight === 'high' ? 'عالي' : item.weight === 'medium' ? 'متوسط' : 'منخفض'}</span>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-foreground">{item.type}</span>
                        <p className="text-foreground/70 mt-0.5">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{item.admissibility}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-xs text-foreground/70 leading-relaxed">
                <span className="font-semibold">تقييم الاكتمال: </span>{jdp.evidenceSummary.completenessAssessment}
              </div>
              <JdpConclusion text={jdp.evidenceSummary.conclusion} />
            </JdpSection>
          )}

          {/* 05 — Proportionality Analysis */}
          {jdp.proportionalityAnalysis && (
            <JdpSection title="05 · تحليل التناسب" icon={Scale}>
              <div className="space-y-3">
                {[
                  { label: 'اختبار المشروعية', test: jdp.proportionalityAnalysis.legitimateAimTest },
                  { label: 'اختبار الضرورة', test: jdp.proportionalityAnalysis.necessityTest },
                  { label: 'اختبار التناسب الصارم', test: jdp.proportionalityAnalysis.strictProportionalityTest },
                ].map(({ label, test }) => (
                  <div key={label} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{label}</span>
                      <TestChip result={test.result} />
                    </div>
                    <p className="text-xs text-foreground/70 leading-relaxed">{test.reasoning}</p>
                  </div>
                ))}
              </div>
              <JdpConclusion text={jdp.proportionalityAnalysis.overallConclusion} />
            </JdpSection>
          )}

          {/* 06 — Discretionary Reasoning */}
          {jdp.discretionaryReasoning && (
            <JdpSection title="06 · الاستنساب الإداري" icon={Scale}>
              <p className="text-xs text-foreground/80 leading-relaxed mb-3">{jdp.discretionaryReasoning.overview}</p>
              {jdp.discretionaryReasoning.factorsConsidered.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1.5">العوامل المُراعاة</p>
                  <div className="space-y-1">
                    {jdp.discretionaryReasoning.factorsConsidered.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                        <span className="text-muted-foreground/40 font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}.</span>{f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-foreground/70 leading-relaxed mb-2">
                <span className="font-semibold">البدائل المُقيَّمة: </span>{jdp.discretionaryReasoning.alternativesEvaluated}
              </div>
              <div className="text-xs text-foreground/70 leading-relaxed">
                <span className="font-semibold">موازنة المصلحة العامة: </span>{jdp.discretionaryReasoning.publicInterestBalance}
              </div>
              <JdpConclusion text={jdp.discretionaryReasoning.conclusion} />
            </JdpSection>
          )}

          {/* 07 — AI Participation Explanation */}
          {jdp.aiParticipationExplanation && (
            <JdpSection title="07 · بيان إسهام الذكاء الاصطناعي" icon={Sparkles}>
              <p className="text-xs text-foreground/80 leading-relaxed mb-3">{jdp.aiParticipationExplanation.overview}</p>
              {jdp.aiParticipationExplanation.stageContributions.length > 0 && (
                <div className="space-y-2">
                  {jdp.aiParticipationExplanation.stageContributions.map((sc, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded" dir="ltr">{sc.stage}</span>
                        <span className="text-xs font-semibold text-foreground">{sc.stageName}</span>
                        {sc.reviewedBy && <span className="text-[10px] text-muted-foreground/50">· {sc.reviewedBy}</span>}
                      </div>
                      <p className="text-xs text-foreground/75"><span className="font-semibold">الإسهام: </span>{sc.contribution}</p>
                      <p className="text-xs text-foreground/60"><span className="font-semibold">التحقق البشري: </span>{sc.humanVerification}</p>
                    </div>
                  ))}
                </div>
              )}
              <JdpConclusion text={jdp.aiParticipationExplanation.overallAssessment} />
            </JdpSection>
          )}

          {/* 08 — Human Oversight Record */}
          {jdp.humanOversightRecord && (
            <JdpSection title="08 · سجل الرقابة البشرية" icon={Users}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div><p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wide mb-0.5">المسؤول المُخوَّل</p><p className="text-xs font-semibold text-foreground">{jdp.humanOversightRecord.authorizedOfficer}</p></div>
                <div><p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wide mb-0.5">المنصب</p><p className="text-xs text-foreground">{jdp.humanOversightRecord.position ?? '—'}</p></div>
                <div><p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wide mb-0.5">الجهة</p><p className="text-xs text-foreground">{jdp.humanOversightRecord.organization ?? '—'}</p></div>
              </div>
              {jdp.humanOversightRecord.verificationSteps.length > 0 && (
                <div className="space-y-2">
                  {jdp.humanOversightRecord.verificationSteps.map((step, i) => (
                    <div key={i} className="flex gap-2 text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                      <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted px-1 py-0.5 rounded shrink-0 mt-0.5" dir="ltr">{step.stage}</span>
                      <div>
                        <span className="font-semibold text-foreground">{step.stageName}: </span>
                        <span className="text-foreground/75">{step.humanAction}</span>
                        {step.outcome && <span className="text-muted-foreground/60"> → {step.outcome}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <JdpConclusion text={jdp.humanOversightRecord.conclusion} />
            </JdpSection>
          )}

          {/* 09 — Constitutional Validation Results */}
          {jdp.constitutionalValidationResults && (
            <JdpSection title="09 · نتائج التحقق الدستوري" icon={Shield}>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <TestChip result={jdp.constitutionalValidationResults.overallResult === 'passed' ? 'passed' : 'failed'} />
                {jdp.constitutionalValidationResults.validationDate && (
                  <span className="text-[10px] text-muted-foreground/50 font-mono" dir="ltr">{jdp.constitutionalValidationResults.validationDate.substring(0, 10)}</span>
                )}
              </div>
              {jdp.constitutionalValidationResults.principleResults.length > 0 && (
                <div className="space-y-2">
                  {jdp.constitutionalValidationResults.principleResults.map((pr, i) => {
                    const gateLabel = pr.passed ? 'مستوفٍ' : 'غير مستوفٍ';
                    return (
                      <div key={i} className="flex items-start gap-3 text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                        <span className={`shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold whitespace-nowrap ${pr.passed ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40' : 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40'}`}>{gateLabel}</span>
                        <div className="flex-1">
                          <span className="font-semibold text-foreground">{pr.principle}</span>
                          <p className="text-foreground/65 mt-0.5">{pr.notes}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <JdpConclusion text={jdp.constitutionalValidationResults.conclusion} />
            </JdpSection>
          )}

          {/* 10 — DCI Summary */}
          {jdp.dciSummary && (
            <JdpSection title="10 · ملخص الهوية الدستورية" icon={Fingerprint}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'معرّف القرار', value: jdp.dciSummary.decisionId, mono: true },
                  { label: 'نوع القرار', value: jdp.dciSummary.decisionType },
                  { label: 'الجهة المختصة', value: jdp.dciSummary.competentAuthority ?? '—' },
                  { label: 'التحقق الدستوري', value: jdp.dciSummary.constitutionalValidationStatus },
                  { label: 'إطار الشامسي', value: jdp.dciSummary.alShamsiFrameworkCompliance },
                  { label: 'الإصدار', value: String(jdp.dciSummary.currentVersion), mono: true },
                ].map(({ label, value, mono }) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-0.5">{label}</p>
                    <p className={`text-xs font-semibold text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
                  </div>
                ))}
                {jdp.dciSummary.completeAuditHash && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">بصمة التحقق الشاملة</p>
                    <p className="text-[10px] font-mono text-foreground/50 break-all bg-muted/40 rounded px-2 py-1 border border-border/30" dir="ltr">{jdp.dciSummary.completeAuditHash}</p>
                  </div>
                )}
              </div>
            </JdpSection>
          )}

          {/* 11 — Audit Chain */}
          {jdp.auditChain && (
            <JdpSection title="11 · سلسلة التدقيق" icon={Link2}>
              <p className="text-xs text-foreground/80 leading-relaxed mb-3">{jdp.auditChain.overview}</p>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${jdp.auditChain.integrityStatus === 'verified' ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40' : 'text-red-700 bg-red-50 border-red-200'}`}>
                  <Hash className="w-2.5 h-2.5 mr-1" />
                  {jdp.auditChain.integrityStatus === 'verified' ? 'سلامة البيانات مُتحقَّق منها' : 'تحذير: مشكلة في سلامة البيانات'}
                </span>
              </div>
              {jdp.auditChain.stages.length > 0 && (
                <div className="space-y-1.5">
                  {jdp.auditChain.stages.map((st, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/20 last:border-0">
                      <span className="font-mono font-bold text-muted-foreground/50 w-5 shrink-0">{st.stageNumber}</span>
                      <span className="font-mono text-muted-foreground/50 shrink-0" dir="ltr">{st.stage}</span>
                      <span className="text-foreground/70 flex-1 min-w-0">{st.stageName}</span>
                      <span className="font-mono text-muted-foreground/40 truncate max-w-[100px] shrink-0" dir="ltr" title={st.auditHash ?? undefined}>{st.auditHash ? st.auditHash.substring(0, 8) + '…' : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </JdpSection>
          )}

          {/* 12 — Version History */}
          {jdp.versionHistoryRecord && (
            <JdpSection title="12 · سجل الإصدارات" icon={CheckCircle2}>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span><span className="font-semibold text-foreground">الإصدار الحالي:</span> {jdp.versionHistoryRecord.currentVersion}</span>
                <span><span className="font-semibold text-foreground">مختوم:</span> {jdp.versionHistoryRecord.isSealed ? 'نعم' : 'لا'}</span>
                {jdp.versionHistoryRecord.sealedAt && <span dir="ltr" className="text-muted-foreground/60">{jdp.versionHistoryRecord.sealedAt.substring(0, 10)}</span>}
              </div>
              {jdp.versionHistoryRecord.amendments.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">لا توجد تعديلات مُسجَّلة — الهوية الدستورية لم تُعدَّل منذ الختم</p>
              ) : (
                <div className="space-y-2">
                  {jdp.versionHistoryRecord.amendments.map((v, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground" dir="ltr">v{v.version}→v{v.version + 1}</span>
                        <span className="text-[10px] text-muted-foreground/50" dir="ltr">{v.changedAt.substring(0, 10)}</span>
                      </div>
                      <p className="text-xs text-foreground/80">{v.reason}</p>
                      <p className="text-[10px] text-muted-foreground/50">الحقول: {Object.keys(v.snapshot).join('، ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </JdpSection>
          )}

          {/* 13 — Anticipated Judicial Review Questions (most prominent section) */}
          {jdp.anticipatedJudicialReviewQuestions && jdp.anticipatedJudicialReviewQuestions.length > 0 && (
            <JdpSection title="13 · الأسئلة القضائية المتوقعة والردود المُعدَّة" icon={HelpCircle} accent="bg-amber-50/50 dark:bg-amber-950/10">
              <p className="text-xs text-muted-foreground/70 mb-4 leading-relaxed">
                الأسئلة التي يُرجَّح أن تطرحها المحكمة الإدارية، مع الردود القانونية المُعدَّة والمستندة إلى سجل القرار.
              </p>
              <div className="space-y-2">
                {jdp.anticipatedJudicialReviewQuestions.map((q, i) => (
                  <div key={i} className="rounded-lg border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-right"
                    >
                      <div className="shrink-0 mt-0.5 flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold text-muted-foreground/40 w-5">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 font-bold shrink-0">{q.category}</span>
                      </div>
                      <p className="flex-1 text-xs font-semibold text-foreground text-right">{q.question}</p>
                      {expandedQ === i ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                    </button>
                    {expandedQ === i && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/30 bg-muted/20">
                        <div className="pt-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">السند القانوني للطعن</p>
                          <p className="text-xs text-foreground/75 leading-relaxed">{q.legalGrounding}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">الرد القانوني المُعدّ</p>
                          <p className="text-xs text-foreground/85 leading-relaxed">{q.preparedAnswer}</p>
                        </div>
                        {q.relevantEvidence && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">الأدلة الداعمة</p>
                            <p className="text-xs text-foreground/70 leading-relaxed">{q.relevantEvidence}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </JdpSection>
          )}

          {/* 14 — Explainability Report */}
          {jdp.explainabilityReport && (
            <JdpSection title="14 · تقرير قابلية التفسير الشامل" icon={BookOpen}>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">نظرة عامة</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{jdp.explainabilityReport.overview}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">مبررات القرار</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{jdp.explainabilityReport.decisionRationale}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">البدائل المُقيَّمة</p>
                  <p className="text-xs text-foreground/75 leading-relaxed">{jdp.explainabilityReport.alternativesConsidered}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">تقييم الأثر</p>
                  <p className="text-xs text-foreground/75 leading-relaxed">{jdp.explainabilityReport.impactAssessment}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">المصلحة العامة</p>
                  <p className="text-xs text-foreground/75 leading-relaxed">{jdp.explainabilityReport.publicInterestJustification}</p>
                </div>
                {jdp.explainabilityReport.minorityInterestConsiderations && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-1">اعتبارات الأطراف المتأثرة</p>
                    <p className="text-xs text-foreground/75 leading-relaxed">{jdp.explainabilityReport.minorityInterestConsiderations}</p>
                  </div>
                )}
                <JdpConclusion text={jdp.explainabilityReport.conclusion} />
              </div>
            </JdpSection>
          )}

          {/* Footer */}
          <div className="text-center py-2">
            <p className="text-[10px] text-muted-foreground/30 tracking-wide">
              Powered by the M. Al-Shamsi Framework™ · MARSAD Judicial Defense Standard v1.0
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Stage Configuration ──────────────────────────────────────────────────────

const STAGE_ORDER: StageKey[] = [
  'administrative_request', 'legal_authority', 'facts_evidence', 'legal_basis',
  'administrative_objective', 'discretionary_power', 'proportionality',
  'human_oversight', 'constitutional_validation', 'decision_drafting', 'final_review',
];

interface StageConfig { nameAr: string; nameEn: string; principleAr: string; isGate?: boolean; }
const STAGE_CONFIG: Record<StageKey, StageConfig> = {
  administrative_request:  { nameAr: 'الطلب الإداري',          nameEn: 'Administrative Request',    principleAr: 'تحديد موضوع القرار وطبيعته وأطرافه' },
  legal_authority:         { nameAr: 'التحقق من الاختصاص',     nameEn: 'Legal Authority',           principleAr: 'الاختصاص الموضوعي والمكاني والزمني والدرجي' },
  facts_evidence:          { nameAr: 'الوقائع والأدلة',         nameEn: 'Facts & Evidence',          principleAr: 'الركن المادي — وجود الوقائع وصحتها واكتمالها' },
  legal_basis:             { nameAr: 'السند القانوني',          nameEn: 'Legal Basis',               principleAr: 'الركن القانوني — المشروعية والتسمية والسبب' },
  administrative_objective:{ nameAr: 'الهدف الإداري',          nameEn: 'Administrative Objective',  principleAr: 'الغاية الإدارية ومبدأ درء انحراف السلطة' },
  discretionary_power:     { nameAr: 'السلطة التقديرية',        nameEn: 'Discretionary Power',       principleAr: 'حدود السلطة التقديرية وضوابط ممارستها' },
  proportionality:         { nameAr: 'مبدأ التناسب',            nameEn: 'Proportionality',           principleAr: 'الملاءمة · الضرورة · التناسب الدقيق' },
  human_oversight:         { nameAr: 'الرقابة البشرية',         nameEn: 'Human Oversight',           principleAr: 'المبدأ الدستوري الرابع — الإنسان يقرر · الذكاء يسند' },
  constitutional_validation:{ nameAr: 'التحقق الدستوري',        nameEn: 'Constitutional Validation', principleAr: 'بوابة المشروعية الدستورية — 10 مبادئ · إطار الشامسي', isGate: true },
  decision_drafting:       { nameAr: 'صياغة القرار',            nameEn: 'Decision Drafting',         principleAr: 'الصياغة الرسمية للقرار الإداري باللغة العربية' },
  final_review:            { nameAr: 'المراجعة النهائية',       nameEn: 'Final Review',              principleAr: 'الاعتماد النهائي وإصدار القرار الموقّع' },
};

const JURISDICTION_LABELS: Record<string, string> = {
  uae: 'الإمارات', sa: 'السعودية', qa: 'قطر', bh: 'البحرين', kw: 'الكويت', om: 'عُمان', fr: 'فرنسا', eu: 'الاتحاد الأوروبي',
};

// ─── API Helper ───────────────────────────────────────────────────────────────

function apiFetch(method: string, path: string, body?: unknown) {
  const role = localStorage.getItem('userRole') || 'owner';
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
    body: body != null ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || r.statusText); }
    return r.json();
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ValidationBadge({ status }: { status: string }) {
  if (status === 'passed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40">
      <Check className="w-3 h-3" /> اجتاز التحقق
    </span>
  );
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40">
      <XCircle className="w-3 h-3" /> لم يجتز التحقق
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-slate-500 bg-slate-50 border-slate-200 dark:border-slate-700">
      <Clock className="w-3 h-3" /> في انتظار التحقق
    </span>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-foreground/80 mb-1.5">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-colors ${className ?? ''}`}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-colors resize-none"
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
    >
      <option value="">— اختر —</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Stage Form Fields ────────────────────────────────────────────────────────

function StageForm({ stageKey, data, onChange }: {
  stageKey: StageKey; data: Record<string, unknown>; onChange: (field: string, value: unknown) => void;
}) {
  const v = (field: string, fallback = '') => (data[field] as string) ?? fallback;
  const b = (field: string) => Boolean(data[field]);

  switch (stageKey) {
    case 'administrative_request': return (
      <div className="space-y-4">
        <div><FieldLabel required>عنوان الطلب</FieldLabel>
          <TextInput value={v('requestTitle')} onChange={(val) => onChange('requestTitle', val)} placeholder="أدخل عنوان الطلب الإداري" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><FieldLabel required>نوع القرار الإداري</FieldLabel>
            <SelectInput value={v('requestType')} onChange={(val) => onChange('requestType', val)} options={[
              { value: 'appointment', label: 'تعيين' }, { value: 'promotion', label: 'ترقية' },
              { value: 'dismissal', label: 'فصل / إنهاء خدمة' }, { value: 'license', label: 'منح ترخيص' },
              { value: 'revocation', label: 'إلغاء ترخيص' }, { value: 'penalty', label: 'فرض عقوبة تأديبية' },
              { value: 'confiscation', label: 'مصادرة' }, { value: 'expropriation', label: 'نزع ملكية' },
              { value: 'suspension', label: 'إيقاف عن العمل' }, { value: 'other', label: 'أخرى' },
            ]} /></div>
          <div><FieldLabel required>درجة الأولوية</FieldLabel>
            <SelectInput value={v('urgencyLevel')} onChange={(val) => onChange('urgencyLevel', val)} options={[
              { value: 'routine', label: 'عادية' }, { value: 'urgent', label: 'مستعجلة' }, { value: 'emergency', label: 'طارئة' },
            ]} /></div>
        </div>
        <div><FieldLabel required>الطرف الطالب / المعني</FieldLabel>
          <TextInput value={v('requestingParty')} onChange={(val) => onChange('requestingParty', val)} placeholder="الاسم الكامل للطرف المعني" /></div>
        <div><FieldLabel required>الجهة الإدارية ذات الصلة</FieldLabel>
          <TextInput value={v('requestingOrganization')} onChange={(val) => onChange('requestingOrganization', val)} placeholder="اسم الجهة الحكومية أو الإدارية" /></div>
        <div><FieldLabel required>وصف الطلب الإداري</FieldLabel>
          <TextArea value={v('requestDescription')} onChange={(val) => onChange('requestDescription', val)} placeholder="صِف الطلب الإداري بتفصيل كافٍ..." rows={5} /></div>
        <div><FieldLabel>الأثر المتوقع للقرار</FieldLabel>
          <TextArea value={v('estimatedImpact')} onChange={(val) => onChange('estimatedImpact', val)} placeholder="ما الأثر المتوقع لهذا القرار على أصحاب المصلحة؟" rows={3} /></div>
      </div>
    );

    case 'legal_authority': return (
      <div className="space-y-4">
        <div><FieldLabel required>اسم الجهة المختصة بإصدار القرار</FieldLabel>
          <TextInput value={v('issuingAuthorityName')} onChange={(val) => onChange('issuingAuthorityName', val)} placeholder="مثال: وزارة الموارد البشرية والتوطين" /></div>
        <div><FieldLabel required>المسمى الوظيفي للمسؤول المُصدِر</FieldLabel>
          <TextInput value={v('authorityPosition')} onChange={(val) => onChange('authorityPosition', val)} placeholder="مثال: وكيل الوزارة، مدير عام الشؤون الإدارية" /></div>
        <div><FieldLabel required>السند القانوني للاختصاص</FieldLabel>
          <TextInput value={v('authorityLegalBasis')} onChange={(val) => onChange('authorityLegalBasis', val)} placeholder="مثال: المادة (10) من القانون الاتحادي رقم (8) لسنة 2011" /></div>
        <div><FieldLabel required>أنواع الاختصاص المتوافرة</FieldLabel>
          <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/20">
            {[
              { key: 'material', label: 'الاختصاص الموضوعي', desc: 'هل للجهة صلاحية موضوعية على هذا النوع من القرارات؟' },
              { key: 'territorial', label: 'الاختصاص المكاني', desc: 'هل صلاحية الجهة تشمل هذا النطاق الجغرافي؟' },
              { key: 'temporal', label: 'الاختصاص الزمني', desc: 'هل الصلاحية سارية المفعول في هذا التوقيت؟' },
              { key: 'hierarchical', label: 'الاختصاص الدرجي', desc: 'هل هذا المستوى الإداري الصحيح في التسلسل الهرمي؟' },
            ].map((comp) => (
              <label key={comp.key} className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={b(`competence_${comp.key}`)} onChange={(e) => onChange(`competence_${comp.key}`, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-foreground" />
                <div>
                  <span className="text-sm font-semibold text-foreground/90">{comp.label}</span>
                  <p className="text-xs text-muted-foreground">{comp.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={b('delegationExists')} onChange={(e) => onChange('delegationExists', e.target.checked)} className="w-4 h-4 rounded border-border accent-foreground" />
            <span className="text-sm font-semibold text-foreground/80">يوجد تفويض في ممارسة الصلاحية</span>
          </label>
          {b('delegationExists') && (
            <div><FieldLabel>تفاصيل التفويض</FieldLabel>
              <TextArea value={v('delegationDetails')} onChange={(val) => onChange('delegationDetails', val)} placeholder="رقم قرار التفويض وتاريخه ونطاقه..." rows={3} /></div>
          )}
        </div>
      </div>
    );

    case 'facts_evidence': return (
      <div className="space-y-4">
        <div><FieldLabel required>الخلفية الواقعية للقرار</FieldLabel>
          <TextArea value={v('factualBackground')} onChange={(val) => onChange('factualBackground', val)} placeholder="اشرح السياق الواقعي الذي دعا إلى إصدار هذا القرار..." rows={5} /></div>
        <div><FieldLabel required>الوقائع الجوهرية</FieldLabel>
          <TextArea value={v('keyFacts')} onChange={(val) => onChange('keyFacts', val)} placeholder="افصل بين كل واقعة بسطر جديد. كن محدداً وموثقاً..." rows={5} /></div>
        <div><FieldLabel required>أنواع الأدلة المتوافرة</FieldLabel>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
            {[
              'وثائق رسمية', 'تقارير إدارية', 'محاضر رسمية', 'شهادات موثقة',
              'تقارير خبراء', 'صور ومستندات مصورة', 'سجلات إلكترونية',
            ].map((type) => {
              const key = `evidenceType_${type}`;
              return (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-md border border-border/40 bg-background hover:border-foreground/20">
                  <input type="checkbox" checked={b(key)} onChange={(e) => onChange(key, e.target.checked)} className="w-3.5 h-3.5 accent-foreground" />
                  <span className="text-xs font-medium text-foreground/80">{type}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div><FieldLabel required>ملخص الأدلة والإثباتات</FieldLabel>
          <TextArea value={v('evidenceSummary')} onChange={(val) => onChange('evidenceSummary', val)} placeholder="لخّص الأدلة المتوفرة وكيف تدعم الوقائع المُدّعاة..." rows={4} /></div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={b('factsDisputed')} onChange={(e) => onChange('factsDisputed', e.target.checked)} className="w-4 h-4 rounded border-border accent-foreground" />
            <span className="text-sm font-semibold text-foreground/80">الوقائع متنازع عليها أو غير مسلّم بها</span>
          </label>
          {b('factsDisputed') && (
            <TextArea value={v('disputeDetails')} onChange={(val) => onChange('disputeDetails', val)} placeholder="اشرح طبيعة النزاع على الوقائع..." rows={3} />
          )}
        </div>
      </div>
    );

    case 'legal_basis': return (
      <div className="space-y-4">
        <div><FieldLabel required>القانون / المرسوم الأساسي</FieldLabel>
          <TextInput value={v('primaryLaw')} onChange={(val) => onChange('primaryLaw', val)} placeholder="مثال: المرسوم بقانون اتحادي رقم (33) لسنة 2021 في شأن تنظيم علاقات العمل" /></div>
        <div><FieldLabel required>المواد القانونية المحددة</FieldLabel>
          <TextInput value={v('specificArticles')} onChange={(val) => onChange('specificArticles', val)} placeholder="مثال: المادة (42)، الفقرة (أ) من المادة (67)" /></div>
        <div><FieldLabel>اللوائح والقرارات التنفيذية المكملة</FieldLabel>
          <TextArea value={v('regulatoryInstruments')} onChange={(val) => onChange('regulatoryInstruments', val)} placeholder="أضف اللوائح والقرارات الوزارية والتعاميم ذات الصلة..." rows={4} /></div>
        <div><FieldLabel>السوابق القضائية والاجتهادات ذات الصلة</FieldLabel>
          <TextArea value={v('jurisprudenceReferences')} onChange={(val) => onChange('jurisprudenceReferences', val)} placeholder="أحكام المحاكم الإدارية ذات الصلة، إن وجدت..." rows={3} /></div>
        <div><FieldLabel required>تقييم كفاية السند القانوني</FieldLabel>
          <SelectInput value={v('legalBasisSufficiency')} onChange={(val) => onChange('legalBasisSufficiency', val)} options={[
            { value: 'strong', label: 'قوي — السند القانوني وافٍ ومحدد' },
            { value: 'adequate', label: 'كافٍ — السند مقبول مع ملاحظات طفيفة' },
            { value: 'needs_strengthening', label: 'يحتاج تقوية — يستحسن إضافة استناد إضافي' },
            { value: 'insufficient', label: 'غير كافٍ — السند القانوني قاصر' },
          ]} /></div>
      </div>
    );

    case 'administrative_objective': return (
      <div className="space-y-4">
        <div><FieldLabel required>الهدف الأساسي للقرار</FieldLabel>
          <TextArea value={v('primaryObjective')} onChange={(val) => onChange('primaryObjective', val)} placeholder="ما الهدف الذي يسعى هذا القرار إلى تحقيقه؟ كن محدداً وواضحاً..." rows={4} /></div>
        <div><FieldLabel required>أساس المصلحة العامة</FieldLabel>
          <TextArea value={v('publicInterestBasis')} onChange={(val) => onChange('publicInterestBasis', val)} placeholder="كيف يخدم هذا القرار المصلحة العامة؟ ما الضرر الذي يدرأ أو المنفعة التي يجلب؟" rows={4} /></div>
        <div><FieldLabel>وصف الأطراف المتضررة</FieldLabel>
          <TextArea value={v('affectedPartiesDescription')} onChange={(val) => onChange('affectedPartiesDescription', val)} placeholder="من سيتأثر بهذا القرار؟ ما طبيعة الأثر؟" rows={3} /></div>
        <div><FieldLabel>البدائل المدروسة لتحقيق الهدف</FieldLabel>
          <TextArea value={v('alternativeObjectives')} onChange={(val) => onChange('alternativeObjectives', val)} placeholder="هل دُرست وسائل بديلة لتحقيق الهدف ذاته؟ لماذا لم يُختر أيٌّ منها؟" rows={3} /></div>
      </div>
    );

    case 'discretionary_power': return (
      <div className="space-y-4">
        <div><FieldLabel required>طبيعة القرار من حيث السلطة التقديرية</FieldLabel>
          <SelectInput value={v('decisionNature')} onChange={(val) => onChange('decisionNature', val)} options={[
            { value: 'fully_bound', label: 'مقيّد تماماً — لا سلطة تقديرية (الشروط القانونية حاكمة)' },
            { value: 'limited_discretion', label: 'تقديري محدود — هامش ضيق من السلطة التقديرية' },
            { value: 'wide_discretion', label: 'تقديري واسع — هامش واسع من السلطة التقديرية' },
          ]} /></div>
        <div><FieldLabel required>العناصر القانونية الملزمة</FieldLabel>
          <TextArea value={v('bindingLegalElements')} onChange={(val) => onChange('bindingLegalElements', val)} placeholder="ما العناصر التي يُلزم القانون باتباعها دون اجتهاد؟ (الشروط، الإجراءات، الآجال)" rows={4} /></div>
        <div><FieldLabel>نطاق السلطة التقديرية المتاح</FieldLabel>
          <TextArea value={v('discretionarySpace')} onChange={(val) => onChange('discretionarySpace', val)} placeholder="في أي جوانب تملك الجهة هامشاً للتقدير والاختيار؟" rows={3} /></div>
        <div><FieldLabel required>مبرر ممارسة السلطة التقديرية في هذه الحالة</FieldLabel>
          <TextArea value={v('discretionJustification')} onChange={(val) => onChange('discretionJustification', val)} placeholder="لماذا اختيرت هذه الوسيلة تحديداً من بين الخيارات المتاحة؟" rows={4} /></div>
        <div><FieldLabel>عوامل خطر الانحراف بالسلطة</FieldLabel>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
            {[
              'تعارض في المصالح', 'عوامل تمييزية محتملة', 'ضغوط خارجية', 'دوافع غير إدارية', 'استعجال مصطنع',
            ].map((factor) => {
              const key = `abuseRisk_${factor}`;
              return (
                <label key={factor} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-md border border-border/40 bg-background hover:border-red-200">
                  <input type="checkbox" checked={b(key)} onChange={(e) => onChange(key, e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
                  <span className="text-xs text-foreground/80">{factor}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );

    case 'proportionality': return (
      <div className="space-y-4">
        <div><FieldLabel required>وصف التدبير / الإجراء المقترح</FieldLabel>
          <TextArea value={v('measureDescription')} onChange={(val) => onChange('measureDescription', val)} placeholder="صِف بالتفصيل التدبير أو الإجراء المُتخَّذ..." rows={4} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><FieldLabel required>وزن / أهمية الهدف</FieldLabel>
            <SelectInput value={v('objectiveWeight')} onChange={(val) => onChange('objectiveWeight', val)} options={[
              { value: 'minor', label: 'طفيف — هدف بسيط' }, { value: 'moderate', label: 'معتدل — هدف ذو أهمية' },
              { value: 'substantial', label: 'جوهري — هدف مهم' }, { value: 'critical', label: 'بالغ الأهمية — هدف حيوي' },
            ]} /></div>
          <div><FieldLabel required>درجة العبء على الأطراف</FieldLabel>
            <SelectInput value={v('burdenOnParties')} onChange={(val) => onChange('burdenOnParties', val)} options={[
              { value: 'minimal', label: 'ضئيل — عبء طفيف' }, { value: 'moderate', label: 'معتدل — عبء مقبول' },
              { value: 'heavy', label: 'ثقيل — عبء كبير' }, { value: 'excessive', label: 'مفرط — عبء غير مبرر' },
            ]} /></div>
        </div>
        <div><FieldLabel required>الوسائل الأقل تقييداً التي دُرست ورُفضت</FieldLabel>
          <TextArea value={v('lessRestrictiveMeansConsidered')} onChange={(val) => onChange('lessRestrictiveMeansConsidered', val)} placeholder="اذكر البدائل الأقل تأثيراً على حقوق الأفراد التي نُظر فيها، وسبب عدم اعتمادها..." rows={4} /></div>
        <div><FieldLabel required>خلاصة تقييم التناسب</FieldLabel>
          <SelectInput value={v('proportionalityConclusion')} onChange={(val) => onChange('proportionalityConclusion', val)} options={[
            { value: 'proportionate', label: 'متناسب — التدبير متناسب تماماً مع الهدف' },
            { value: 'marginally', label: 'متناسب نسبياً — مع بعض التحفظات' },
            { value: 'disproportionate', label: 'غير متناسب — يستلزم مراجعة التدبير' },
          ]} /></div>
      </div>
    );

    case 'human_oversight': return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border-2 border-foreground/15 bg-foreground/[0.02] space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-foreground/60 uppercase">
            <Shield className="w-3.5 h-3.5" /> المبدأ الدستوري الرابع — الرقابة البشرية
          </div>
          <p className="text-sm text-foreground/80">يجب أن يكون كل قرار موقّعاً من إنسان يدرك مسؤوليته القانونية الكاملة. الذكاء الاصطناعي يسند ولا يحلّ محل.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><FieldLabel required>اسم المسؤول الإداري</FieldLabel>
            <TextInput value={v('officialName')} onChange={(val) => onChange('officialName', val)} placeholder="الاسم الثلاثي الكامل" /></div>
          <div><FieldLabel required>المسمى الوظيفي</FieldLabel>
            <TextInput value={v('officialPosition')} onChange={(val) => onChange('officialPosition', val)} placeholder="مثال: وكيل وزارة العدل" /></div>
        </div>
        <div><FieldLabel required>الجهة / الوزارة</FieldLabel>
          <TextInput value={v('officialOrganization')} onChange={(val) => onChange('officialOrganization', val)} placeholder="اسم الجهة الحكومية" /></div>
        <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-muted/20">
          <p className="text-xs font-bold text-foreground/70 uppercase tracking-wide">إقرارات الرقابة البشرية</p>
          {[
            { key: 'reviewedAllStages', label: 'أؤكد أنني راجعت جميع مراحل إعداد هذا القرار وتحققت من مضمونها' },
            { key: 'aiContributionAcknowledgment', label: 'أُقرّ بأن الذكاء الاصطناعي أسهم في تحليل هذا القرار وأن حكمي البشري يعلو على أي توصية آلية' },
            { key: 'legalConsequencesAware', label: 'أُقرّ بأنني أدرك التبعات القانونية الكاملة لهذا القرار وأتحمل مسؤوليتها' },
            { key: 'finalHumanApproval', label: 'أُوافق على إصدار هذا القرار بصفتي المسؤول الإداري المختص' },
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={b(item.key)} onChange={(e) => onChange(item.key, e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border accent-foreground" />
              <span className="text-sm text-foreground/80 leading-relaxed">{item.label}</span>
            </label>
          ))}
        </div>
        <div><FieldLabel>الحكم البشري المستقل المُضاف (ما أضفته من اجتهاد بشري)</FieldLabel>
          <TextArea value={v('humanJudgmentApplied')} onChange={(val) => onChange('humanJudgmentApplied', val)} placeholder="ما الاعتبارات والحكمة الإنسانية التي أضفتها بما لا تستطيع الخوارزمية تقديره؟" rows={4} /></div>
      </div>
    );

    case 'constitutional_validation': return (
      <div className="space-y-4">
        <div className="p-5 rounded-xl border-2 border-foreground/20 bg-foreground/[0.02] space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-foreground/10 border-2 border-foreground/20 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-foreground/70" />
          </div>
          <h3 className="font-bold text-foreground text-lg">بوابة التحقق الدستوري</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            سيقوم الذكاء الاصطناعي بتحليل جميع المراحل السابقة ومقارنتها مع المبادئ الدستورية العشرة لإطار الشامسي. لا يمكن المتابعة إلا بعد اجتياز هذه البوابة.
          </p>
          <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">المبادئ الدستورية العشرة · MARSAD Constitutional Standard v1.0</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            'الذكاء يخدم القانون', 'المشروعية', 'الشفافية', 'الرقابة البشرية',
            'القابلية للتفسير', 'التناسب', 'ضمانات الإجراءات', 'المساءلة', 'قابلية المراجعة', 'المشروعية المستمرة',
          ].map((p, i) => (
            <div key={p} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted/40 border border-border/40">
              <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[10px] font-medium text-foreground/70 leading-tight">{p}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">اضغط على "تحقق دستوري" أدناه لتشغيل التحقق الشامل</p>
      </div>
    );

    case 'decision_drafting': return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <span>سيقوم الذكاء الاصطناعي بصياغة مسودة القرار الرسمي. اضغط "مساعدة الذكاء الاصطناعي" ثم راجع وعدّل النص حسب اجتهادك القانوني.</span>
        </div>
        <div><FieldLabel required>ديباجة القرار</FieldLabel>
          <TextArea value={v('preamble')} onChange={(val) => onChange('preamble', val)} placeholder="نحن / إنّ [الجهة المُصدِرة] ، [المسمى الوظيفي] ، بناءً على ..." rows={4} /></div>
        <div><FieldLabel required>الإشارات والاستناد</FieldLabel>
          <TextArea value={v('recitals')} onChange={(val) => onChange('recitals', val)} placeholder="استناداً إلى / إشارةً إلى / بناءً على / وبعد الاطلاع على ..." rows={5} /></div>
        <div><FieldLabel required>منطوق القرار / المواد التقريرية</FieldLabel>
          <TextArea value={v('operativeClauses')} onChange={(val) => onChange('operativeClauses', val)} placeholder="المادة الأولى: ...&#10;المادة الثانية: ...&#10;المادة الثالثة: على الجهات المعنية تنفيذ هذا القرار ..." rows={6} /></div>
        <div><FieldLabel>أسباب القرار ومبرراته</FieldLabel>
          <TextArea value={v('reasons')} onChange={(val) => onChange('reasons', val)} placeholder="حيث إن ... وحيث إن ... وبناءً على ما تقدم ..." rows={5} /></div>
        <div><FieldLabel required>بيان حق الطعن والتظلم</FieldLabel>
          <TextArea value={v('appealRights')} onChange={(val) => onChange('appealRights', val)} placeholder="يحق لذوي الشأن التظلم من هذا القرار خلال ... ، ويحق لهم الطعن أمام المحكمة الإدارية المختصة وفقاً لأحكام ..." rows={3} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><FieldLabel>تاريخ النفاذ</FieldLabel>
            <input type="date" value={v('effectiveDate')} onChange={(e) => onChange('effectiveDate', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20" /></div>
          <div><FieldLabel>لغة القرار</FieldLabel>
            <SelectInput value={v('decisionLanguage', 'ar')} onChange={(val) => onChange('decisionLanguage', val)} options={[
              { value: 'ar', label: 'عربي فقط' }, { value: 'ar_en', label: 'عربي وإنجليزي' },
            ]} /></div>
        </div>
      </div>
    );

    case 'final_review': return (
      <div className="space-y-4">
        <div><FieldLabel required>اسم المراجع النهائي</FieldLabel>
          <TextInput value={v('reviewerName')} onChange={(val) => onChange('reviewerName', val)} placeholder="اسم المسؤول الذي يُجري المراجعة النهائية" /></div>
        <div><FieldLabel>ملاحظات المراجعة النهائية</FieldLabel>
          <TextArea value={v('reviewNotes')} onChange={(val) => onChange('reviewNotes', val)} placeholder="أي ملاحظات أو تعديلات أجريت في المراجعة النهائية..." rows={4} /></div>
        <div><FieldLabel required>الرقم الرسمي للقرار</FieldLabel>
          <TextInput value={v('decisionNumber')} onChange={(val) => onChange('decisionNumber', val)} placeholder="مثال: قرار رقم (125) لسنة 2026" /></div>
        <div><FieldLabel>تاريخ النفاذ الرسمي</FieldLabel>
          <input type="date" value={v('officialEffectiveDate')} onChange={(e) => onChange('officialEffectiveDate', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20" /></div>
        <div className="p-4 rounded-lg border border-border/60 bg-muted/20 space-y-3">
          {[
            { key: 'allStagesReviewed', label: 'تأكيد: جميع المراحل الدستورية الأحد عشر مكتملة ومُتحقَّق منها' },
            { key: 'constitutionalValidationPassed', label: 'تأكيد: اجتاز القرار بوابة التحقق الدستوري بنجاح' },
            { key: 'finalApprovalDeclaration', label: 'إعلان: أنا المسؤول المختص أُقرّ باعتماد هذا القرار الإداري ونفاذه' },
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={b(item.key)} onChange={(e) => onChange(item.key, e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border accent-foreground" />
              <span className="text-sm font-semibold text-foreground/80">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
}

// ─── AI Analysis Panel ────────────────────────────────────────────────────────

function AIAnalysisPanel({ analysis, stageKey }: { analysis: Record<string, unknown>; stageKey: StageKey }) {
  const [expanded, setExpanded] = useState(true);
  if (!analysis || Object.keys(analysis).length === 0) return null;

  const passed = stageKey === 'constitutional_validation'
    ? Boolean(analysis.overallPassed)
    : Boolean(analysis.passed);

  const issues = (analysis.issues as string[]) ?? (analysis.criticalFailures as string[]) ?? [];
  const recommendations = (analysis.recommendations as string[]) ?? (analysis.remediationRequired as string[]) ?? [];
  const summary = (analysis.stageSummary as string) ?? (analysis.constitutionalSummary as string) ?? '';
  const contribution = analysis.aiContribution as string;

  return (
    <div className={`rounded-xl border ${passed ? 'border-emerald-200 dark:border-emerald-800/40' : 'border-amber-200 dark:border-amber-800/40'} overflow-hidden`}>
      <button onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${passed ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>تحليل الذكاء الاصطناعي — إطار الشامسي</span>
          {passed ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-background">
          {summary && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
              <p className="text-xs font-bold text-muted-foreground mb-1">الملخص</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Constitutional validation principle results — binary gate display, no numerical scores */}
          {stageKey === 'constitutional_validation' && Boolean(analysis.principleResults) && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">بوابات المبادئ الدستورية العشرة</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(analysis.principleResults as Record<string, Record<string, unknown>>).map(([key, result]) => {
                  const pr = result as { passed: boolean; gateStatus?: string; notes?: string };
                  const gateLabel = pr.passed ? 'مستوفٍ' : 'غير مستوفٍ';
                  return (
                    <div key={key} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${pr.passed ? 'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/30' : 'border-red-200/60 bg-red-50/50 dark:border-red-800/30'}`}>
                      <span className={`shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold whitespace-nowrap ${pr.passed ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40' : 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40'}`}>{gateLabel}</span>
                      <div>
                        <span className="font-mono text-muted-foreground/60 text-[10px]">{key}</span>
                        {pr.notes && <p className="text-muted-foreground mt-0.5">{String(pr.notes)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {issues.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5">المشكلات المُحددة</p>
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5">التوصيات</p>
              <ul className="space-y-1">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {contribution && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">إسهام الذكاء الاصطناعي</p>
              <p className="text-xs text-muted-foreground italic leading-relaxed">{contribution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateDecisionDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ titleAr: '', jurisdiction: 'uae', decisionType: '', organizationUnit: '', issuingAuthority: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const f = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreate = async () => {
    if (!form.titleAr || !form.decisionType || !form.organizationUnit) {
      setError('يرجى ملء جميع الحقول الإلزامية'); return;
    }
    setIsCreating(true); setError('');
    try {
      const data = await apiFetch('POST', '/api/decisions', form);
      onCreated(data.decision.id);
    } catch (e: any) { setError(e.message || 'فشل إنشاء القرار'); setIsCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground">
            <Scale className="w-3.5 h-3.5" /> إطار الشامسي · الوحدة الأولى
          </div>
          <h2 className="text-xl font-bold text-foreground">إنشاء قرار إداري جديد</h2>
          <p className="text-sm text-muted-foreground">سيُسجَّل هذا القرار بمرجع دائم وتبدأ دورة حياته القانونية</p>
        </div>

        <div className="space-y-3">
          <div><FieldLabel required>عنوان القرار الإداري</FieldLabel>
            <TextInput value={form.titleAr} onChange={(v) => f('titleAr', v)} placeholder="مثال: قرار تعيين مدير عام دائرة الموارد البشرية" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel required>الاختصاص القانوني</FieldLabel>
              <SelectInput value={form.jurisdiction} onChange={(v) => f('jurisdiction', v)} options={[
                { value: 'uae', label: 'الإمارات العربية المتحدة' }, { value: 'sa', label: 'المملكة العربية السعودية' },
                { value: 'qa', label: 'دولة قطر' }, { value: 'bh', label: 'مملكة البحرين' },
                { value: 'kw', label: 'دولة الكويت' }, { value: 'om', label: 'سلطنة عُمان' },
                { value: 'fr', label: 'الجمهورية الفرنسية' }, { value: 'eu', label: 'الاتحاد الأوروبي' },
              ]} /></div>
            <div><FieldLabel required>نوع القرار</FieldLabel>
              <SelectInput value={form.decisionType} onChange={(v) => f('decisionType', v)} options={[
                { value: 'appointment', label: 'تعيين' }, { value: 'promotion', label: 'ترقية' },
                { value: 'dismissal', label: 'فصل / إنهاء خدمة' }, { value: 'license', label: 'منح ترخيص' },
                { value: 'revocation', label: 'إلغاء ترخيص' }, { value: 'penalty', label: 'عقوبة تأديبية' },
                { value: 'confiscation', label: 'مصادرة' }, { value: 'suspension', label: 'إيقاف عن العمل' },
                { value: 'other', label: 'أخرى' },
              ]} /></div>
          </div>
          <div><FieldLabel required>الجهة الإدارية المُصدِرة</FieldLabel>
            <TextInput value={form.organizationUnit} onChange={(v) => f('organizationUnit', v)} placeholder="مثال: وزارة الموارد البشرية والتوطين" /></div>
          <div><FieldLabel>المسؤول المُصدِر</FieldLabel>
            <TextInput value={form.issuingAuthority} onChange={(v) => f('issuingAuthority', v)} placeholder="مثال: وكيل الوزارة" /></div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleCreate} disabled={isCreating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
            {isCreating ? 'جارٍ الإنشاء...' : 'إنشاء القرار'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Workspace ───────────────────────────────────────────────────────────

export default function DecisionWorkspace() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const decisionId = params.id ? parseInt(params.id) : null;
  const [activeStage, setActiveStage] = useState<StageKey>('administrative_request');
  const [activeView, setActiveView] = useState<'stage' | 'dci' | 'jdp' | 'car' | 'replay'>('stage');
  const [formData, setFormData] = useState<Record<StageKey, Record<string, unknown>>>({} as any);
  const [aiAnalysis, setAiAnalysis] = useState<Record<StageKey, Record<string, unknown>>>({} as any);
  const [validationResults, setValidationResults] = useState<Record<StageKey, { passed: boolean; analysis: Record<string, unknown>; validationStatus: string }>>({} as any);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(!decisionId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load decision
  const { data, isLoading } = useQuery({
    queryKey: ['decision', decisionId],
    queryFn: () => apiFetch('GET', `/api/decisions/${decisionId}`),
    enabled: Boolean(decisionId),
  });

  const decision: Decision | null = data?.decision ?? null;
  const stages: DecisionStage[] = data?.stages ?? [];

  // Sync loaded stage data
  useEffect(() => {
    if (stages.length > 0) {
      const loaded: Record<string, Record<string, unknown>> = {};
      const loadedAI: Record<string, Record<string, unknown>> = {};
      const loadedValidation: Record<string, any> = {};
      for (const s of stages) {
        loaded[s.stageKey] = s.stageData || {};
        if (s.aiAnalysis && Object.keys(s.aiAnalysis).length > 0) loadedAI[s.stageKey] = s.aiAnalysis;
        if (s.validationStatus !== 'pending') {
          loadedValidation[s.stageKey] = { passed: s.validationStatus === 'passed', analysis: s.validationDetails, validationStatus: s.validationStatus };
        }
      }
      setFormData((prev) => ({ ...prev, ...loaded }));
      setAiAnalysis((prev) => ({ ...prev, ...loadedAI }));
      setValidationResults((prev) => ({ ...prev, ...loadedValidation }));
    }
  }, [stages]);

  // Set active stage from decision
  useEffect(() => {
    if (decision?.currentStage) setActiveStage(decision.currentStage as StageKey);
  }, [decision?.currentStage]);

  const completed: string[] = decision?.stagesCompleted ?? [];
  const stageStatus = (key: StageKey): 'completed' | 'active' | 'failed' | 'locked' => {
    if (completed.includes(key)) return 'completed';
    if (key === activeStage) return 'active';
    const keyIdx = STAGE_ORDER.indexOf(key);
    const currentIdx = STAGE_ORDER.indexOf((decision?.currentStage as StageKey) ?? 'administrative_request');
    if (keyIdx > currentIdx) return 'locked';
    return 'active';
  };

  const handleFormChange = useCallback((field: string, value: unknown) => {
    const stage = activeStage;
    setFormData((prev) => ({ ...prev, [stage]: { ...(prev[stage] || {}), [field]: value } }));
    if (decisionId) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const updated = { ...(formData[stage] || {}), [field]: value };
          await apiFetch('PUT', `/api/decisions/${decisionId}/stages/${stage}`, updated);
        } catch (e) { console.error('Auto-save failed', e); }
        setIsSaving(false);
      }, 1200);
    }
  }, [activeStage, decisionId, formData]);

  const handleRequestAI = async () => {
    if (!decisionId) return;
    setIsLoadingAI(true);
    try {
      const stageFormData = formData[activeStage] || {};
      // Save first
      await apiFetch('PUT', `/api/decisions/${decisionId}/stages/${activeStage}`, stageFormData);
      const result = await apiFetch('POST', `/api/decisions/${decisionId}/stages/${activeStage}/ai-assist`, stageFormData);
      setAiAnalysis((prev) => ({ ...prev, [activeStage]: result.analysis }));
      // If AI generated decision text for drafting stage, populate form
      if (activeStage === 'decision_drafting' && result.analysis) {
        const a = result.analysis;
        if (a.preamble) handleFormChange('preamble', a.preamble);
        if (a.recitals) handleFormChange('recitals', a.recitals);
        if (a.operativeClauses) handleFormChange('operativeClauses', a.operativeClauses);
        if (a.reasons) handleFormChange('reasons', a.reasons);
        if (a.appealRights) handleFormChange('appealRights', a.appealRights);
      }
      qc.invalidateQueries({ queryKey: ['decision', decisionId] });
    } catch (e: any) { alert(e.message || 'فشلت مساعدة الذكاء الاصطناعي'); }
    setIsLoadingAI(false);
  };

  const handleValidate = async () => {
    if (!decisionId) return;
    setIsValidating(true);
    try {
      const stageFormData = formData[activeStage] || {};
      await apiFetch('PUT', `/api/decisions/${decisionId}/stages/${activeStage}`, stageFormData);
      const result = await apiFetch('POST', `/api/decisions/${decisionId}/stages/${activeStage}/validate`, stageFormData);
      setValidationResults((prev) => ({ ...prev, [activeStage]: result }));
      setAiAnalysis((prev) => ({ ...prev, [activeStage]: result.analysis }));
      qc.invalidateQueries({ queryKey: ['decision', decisionId] });
    } catch (e: any) { alert(e.message || 'فشل التحقق'); }
    setIsValidating(false);
  };

  const handleComplete = async () => {
    if (!decisionId) return;
    const vr = validationResults[activeStage];
    if (!vr || !vr.passed) { alert('يجب اجتياز التحقق الدستوري أولاً قبل المتابعة'); return; }
    setIsCompleting(true);
    try {
      const result = await apiFetch('POST', `/api/decisions/${decisionId}/stages/${activeStage}/complete`, {});
      if (result.nextStage) {
        setActiveStage(result.nextStage as StageKey);
      }
      qc.invalidateQueries({ queryKey: ['decision', decisionId] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      qc.invalidateQueries({ queryKey: ['dci', decisionId] });
    } catch (e: any) { alert(e.message || 'فشل إتمام المرحلة'); }
    setIsCompleting(false);
  };

  const currentValidation = validationResults[activeStage];
  const currentAI = aiAnalysis[activeStage];
  const config = STAGE_CONFIG[activeStage];
  const stageIdx = STAGE_ORDER.indexOf(activeStage);

  return (
    <AppLayout variant="default">
      <div dir="rtl" className="h-full">

        {showCreate && (
          <CreateDecisionDialog onCreated={(id) => { setShowCreate(false); navigate(`/decisions/${id}`); }} />
        )}

        {decisionId && isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {decisionId && !isLoading && decision && (
          <div className="space-y-0 -m-4 sm:-m-6 lg:-m-8">

            {/* ── Decision Header ───────────────────────────────── */}
            <div className="border-b border-border/60 bg-card px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-muted-foreground/60 tracking-widest" dir="ltr">
                    {decision.caseNumber}
                    <span className="text-border/60">·</span>
                    {JURISDICTION_LABELS[decision.jurisdiction] ?? decision.jurisdiction}
                  </div>
                  <h1 className="font-bold text-foreground text-lg leading-snug">{decision.titleAr}</h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" /> {decision.organizationUnit}
                    </span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-xs text-muted-foreground">
                      {completed.length} / {STAGE_ORDER.length} مراحل
                    </span>
                    {isSaving && <span className="text-xs text-muted-foreground/50 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> يحفظ...</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-32 bg-muted/60 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.round((completed.length / STAGE_ORDER.length) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{Math.round((completed.length / STAGE_ORDER.length) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* ── View Tab Bar ──────────────────────────────────── */}
            <div role="tablist" aria-label="عرض القرار" className="border-b border-border/60 bg-card px-4 sm:px-6 lg:px-8 flex items-center gap-0 overflow-x-auto">
              <button
                role="tab"
                aria-selected={activeView === 'stage'}
                aria-controls="panel-stage"
                id="tab-stage"
                onClick={() => setActiveView('stage')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${activeView === 'stage' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Scale className="w-3.5 h-3.5" /> مراحل القرار
              </button>
              <button
                role="tab"
                aria-selected={activeView === 'dci'}
                aria-controls="panel-dci"
                id="tab-dci"
                onClick={() => setActiveView('dci')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${activeView === 'dci' ? 'border-amber-500 text-amber-700 dark:text-amber-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Fingerprint className="w-3.5 h-3.5" /> الهوية الدستورية DCI
              </button>
              <button
                role="tab"
                aria-selected={activeView === 'jdp'}
                aria-controls="panel-jdp"
                id="tab-jdp"
                onClick={() => setActiveView('jdp')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${activeView === 'jdp' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Gavel className="w-3.5 h-3.5" /> الدفاع القضائي JDP
              </button>
              <button
                role="tab"
                aria-selected={activeView === 'car'}
                aria-controls="panel-car"
                id="tab-car"
                onClick={() => setActiveView('car')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${activeView === 'car' ? 'border-blue-500 text-blue-700 dark:text-blue-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Eye className="w-3.5 h-3.5" /> المساءلة الدستورية CAR
              </button>
              <button
                role="tab"
                aria-selected={activeView === 'replay'}
                aria-controls="panel-replay"
                id="tab-replay"
                onClick={() => setActiveView('replay')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${activeView === 'replay' ? 'border-violet-500 text-violet-700 dark:text-violet-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Play className="w-3.5 h-3.5" /> إعادة التشغيل
              </button>
            </div>

            {/* ── Two-column layout ─────────────────────────────── */}
            <div className="flex" style={{ minHeight: 'calc(100vh - 12rem)' }}>

              {/* Stage Timeline Sidebar */}
              <div className="w-64 shrink-0 border-e border-border/60 bg-muted/10 overflow-y-auto sticky top-0" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                <div className="py-3 px-2 space-y-0.5">
                  {STAGE_ORDER.map((key, idx) => {
                    const st = stageStatus(key);
                    const cfg = STAGE_CONFIG[key];
                    const isActive = key === activeStage;
                    const isLocked = st === 'locked';
                    const isCompleted = st === 'completed';
                    const hasFailed = validationResults[key]?.passed === false;

                    // Constitutional gate visual separator
                    const showGate = idx === 8; // before constitutional_validation

                    return (
                      <React.Fragment key={key}>
                        {showGate && (
                          <div className="mx-2 my-2 flex items-center gap-2">
                            <div className="flex-1 h-px bg-border/60" />
                            <span className="text-[9px] font-bold tracking-widest text-muted-foreground/50 uppercase whitespace-nowrap px-1">البوابة الدستورية</span>
                            <div className="flex-1 h-px bg-border/60" />
                          </div>
                        )}
                        <button
                          onClick={() => !isLocked && setActiveStage(key)}
                          disabled={isLocked}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all duration-150 text-start group ${
                            isActive ? 'bg-foreground/10 border border-foreground/20' :
                            isLocked ? 'opacity-40 cursor-not-allowed' :
                            'hover:bg-foreground/5 cursor-pointer'
                          }`}
                        >
                          {/* Stage number / status icon */}
                          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCompleted ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40' :
                            hasFailed ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40' :
                            isActive ? 'bg-foreground/15 border border-foreground/30 text-foreground' :
                            isLocked ? 'bg-muted border border-border/40 text-muted-foreground/30' :
                            'bg-muted/60 border border-border/40 text-muted-foreground'
                          }`}>
                            {isCompleted ? <Check className="w-3 h-3" /> :
                             hasFailed ? <XCircle className="w-3 h-3" /> :
                             isLocked ? <Lock className="w-3 h-3" /> :
                             String(idx + 1).padStart(2, '0')}
                          </div>

                          {/* Stage name */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate leading-tight ${isActive ? 'text-foreground' : isLocked ? 'text-muted-foreground/30' : 'text-foreground/70'}`}>
                              {cfg.nameAr}
                            </p>
                            {cfg.isGate && (
                              <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">بوابة دستورية</p>
                            )}
                          </div>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Main Stage Content OR DCI Panel */}
              <div className="flex-1 overflow-y-auto">
                {activeView === 'jdp' ? (
                  <div role="tabpanel" id="panel-jdp" aria-labelledby="tab-jdp">
                    <JdpPanel decisionId={decisionId!} decision={decision} />
                  </div>
                ) : activeView === 'dci' ? (
                  <div role="tabpanel" id="panel-dci" aria-labelledby="tab-dci">
                    <DciPanel decisionId={decisionId!} decision={decision} />
                  </div>
                ) : activeView === 'car' ? (
                  <div role="tabpanel" id="panel-car" aria-labelledby="tab-car">
                    <CarPanel decisionId={decisionId!} decision={decision} />
                  </div>
                ) : activeView === 'replay' ? (
                  <div role="tabpanel" id="panel-replay" aria-labelledby="tab-replay">
                    <DecisionReplay decisionId={decisionId!} />
                  </div>
                ) : (
                <div role="tabpanel" id="panel-stage" aria-labelledby="tab-stage" className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">

                  {/* Stage header */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground/50">{String(stageIdx + 1).padStart(2, '0')} / {STAGE_ORDER.length}</span>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">{config.nameEn}</span>
                      {currentValidation && <ValidationBadge status={currentValidation.validationStatus} />}
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{config.nameAr}</h2>
                    <p className="text-sm text-muted-foreground">{config.principleAr}</p>
                  </div>

                  {/* Stage form */}
                  <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                    <StageForm
                      stageKey={activeStage}
                      data={formData[activeStage] || {}}
                      onChange={handleFormChange}
                    />
                  </div>

                  {/* AI Analysis Panel */}
                  {currentAI && Object.keys(currentAI).length > 0 && (
                    <AIAnalysisPanel analysis={currentAI} stageKey={activeStage} />
                  )}

                  {/* Validation result (if failed) */}
                  {currentValidation && !currentValidation.passed && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/60 dark:bg-red-950/20">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">لم يجتز هذا القرار التحقق الدستوري</p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">راجع ملاحظات الذكاء الاصطناعي أعلاه وعالج المشكلات المُحددة، ثم أعد التحقق.</p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 flex-wrap pb-8">
                    {/* AI Assist */}
                    <button
                      onClick={handleRequestAI} disabled={isLoadingAI || isValidating || isCompleting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-background text-sm font-semibold text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-all disabled:opacity-50"
                    >
                      {isLoadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isLoadingAI ? 'يحلل...' : 'مساعدة الذكاء الاصطناعي'}
                    </button>

                    {/* Validate */}
                    <button
                      onClick={handleValidate} disabled={isLoadingAI || isValidating || isCompleting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-background text-sm font-semibold text-foreground/80 hover:border-amber-400/50 hover:text-amber-700 dark:hover:text-amber-400 transition-all disabled:opacity-50"
                    >
                      {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {isValidating ? 'يتحقق...' : 'تحقق دستوري'}
                    </button>

                    {/* Complete & Advance */}
                    {currentValidation?.passed && (
                      <button
                        onClick={handleComplete} disabled={isLoadingAI || isValidating || isCompleting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 ms-auto"
                      >
                        {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        {isCompleting ? 'جارٍ الإتمام...' : activeStage === 'final_review' ? 'اعتماد القرار' : 'إتمام المرحلة والمتابعة'}
                      </button>
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
