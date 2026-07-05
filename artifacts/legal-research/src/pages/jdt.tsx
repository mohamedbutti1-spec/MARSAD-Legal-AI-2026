/**
 * Phase 44 — Judicial Digital Twin (JDT)
 * ────────────────────────────────────────────────────────────────────────────
 * Full pre-submission judicial simulation powered by نظرية الشامسي™.
 * 8 review stages · 16 Shamsi dimensions · cross-module integration.
 *
 * Al-Shamsi Judicial Digital Twin™ · MARSAD JDT v44.0
 */
import { useState } from 'react'
import { useParams, Link } from 'wouter'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/app-layout'
import { useUserContext, useT } from '@/lib/user-context'
import {
  Scale, Shield, ShieldAlert, Gavel, AlertTriangle, CheckCircle2, XCircle,
  AlertCircle, Loader2, RefreshCw, FileText, ChevronDown, ChevronRight,
  ArrowLeft, Star, TrendingUp, TrendingDown, Lightbulb, ClipboardList,
  Target, Minus, Brain,
} from 'lucide-react'

// ─── Local Types ──────────────────────────────────────────────────────────────

type JdtStageOutcome = 'pass' | 'partial' | 'fail' | 'not_assessed'
type JdtRiskLevel = 'low' | 'moderate' | 'high' | 'critical'

type JdtReviewStageResult = {
  stageKey: string
  labelAr: string
  labelEn: string
  score: number
  outcome: JdtStageOutcome
  reasoning: string
  findings: string[]
  uaeLegalReferences: string[]
  remedyAr?: string | null
  isBlockingAnnulment: boolean
}

type JdtShamsiDimensionResult = {
  dimensionKey: string
  labelAr: string
  labelEn: string
  score: number
  outcome: JdtStageOutcome
  reasoning: string
  constitutionalRef?: string
}

type JdtCorrectiveAction = {
  priority: 'critical' | 'high' | 'medium' | 'low'
  action: string
  targetStage: string
  deadline: string
}

type JdtSimulation = {
  id?: number
  decisionId: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'not_started'
  simulationVersion?: number
  completedAt?: string | null
  reviewStages?: JdtReviewStageResult[] | null
  shamsiDimensions?: JdtShamsiDimensionResult[] | null
  shamsiOverallScore?: number | null
  constitutionalScore?: number | null
  constitutionalOutcome?: JdtStageOutcome | null
  constitutionalReasoning?: string | null
  riskIntegrationScore?: number | null
  riskReasoning?: string | null
  probabilityAnnulment?: number | null
  probabilityDismissal?: number | null
  probabilityCorrection?: number | null
  judicialSuccessProbability?: number | null
  overallRiskLevel?: JdtRiskLevel | null
  judicialReasoning?: string | null
  strengths?: string[] | null
  weaknesses?: string[] | null
  missingEvidence?: string[] | null
  correctiveActions?: JdtCorrectiveAction[] | null
  overallAssessment?: string | null
  errorMessage?: string | null
  replayIntegration?: {
    stagesAnalysed: number
    criticalStageKeys: string[]
  } | null
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function CircleGauge({
  value,
  label,
  size = 96,
}: {
  value: number | null | undefined
  label?: string
  size?: number
}) {
  const r = 38
  const circ = 2 * Math.PI * r
  const pct = value ?? 0
  const dash = value !== null && value !== undefined ? (pct / 100) * circ : 0

  const color =
    value === null || value === undefined
      ? '#94a3b8'
      : pct >= 70
      ? '#22c55e'
      : pct >= 50
      ? '#f59e0b'
      : pct >= 30
      ? '#f97316'
      : '#ef4444'

  const cx = size / 2
  const cy = size / 2
  const scaledR = (r / 96) * size
  const scaledStroke = (6 / 96) * size
  const scaledCirc = 2 * Math.PI * scaledR
  const scaledDash =
    value !== null && value !== undefined ? (pct / 100) * scaledCirc : 0

  const fontSize = size * 0.22
  const labelSize = size * 0.11

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={scaledR}
          fill="none"
          stroke="currentColor"
          strokeWidth={scaledStroke}
          className="text-border"
        />
        <circle
          cx={cx}
          cy={cy}
          r={scaledR}
          fill="none"
          stroke={color}
          strokeWidth={scaledStroke}
          strokeDasharray={`${scaledDash} ${scaledCirc}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div
        className="flex items-center justify-center font-bold tabular-nums"
        style={{
          marginTop: -(size + 4),
          height: size,
          fontSize,
          color,
        }}
      >
        {value !== null && value !== undefined ? Math.round(value) : '—'}
      </div>
      {label && (
        <div
          className="text-muted-foreground text-center mt-1 leading-tight"
          style={{ fontSize: labelSize, marginTop: 4 }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

function OutcomeIcon({ outcome }: { outcome: JdtStageOutcome }) {
  switch (outcome) {
    case 'pass':
      return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
    case 'partial':
      return <Minus className="w-4 h-4 text-amber-500 shrink-0" />
    case 'fail':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
    case 'not_assessed':
    default:
      return <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
  }
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-muted text-muted-foreground">
        —/100
      </span>
    )
  }
  const cls =
    score >= 80
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
      : score >= 60
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${cls}`}>
      {Math.round(score)}/100
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    critical: {
      cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      label: 'حرج',
    },
    high: {
      cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
      label: 'عالٍ',
    },
    medium: {
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
      label: 'متوسط',
    },
    low: {
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
      label: 'منخفض',
    },
  }
  const { cls, label } = cfg[priority] ?? cfg.low
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function ReviewStageCard({
  stage,
  index,
}: {
  stage: JdtReviewStageResult
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  const borderColor =
    stage.outcome === 'pass'
      ? 'border-l-green-500'
      : stage.outcome === 'partial'
      ? 'border-l-amber-500'
      : stage.outcome === 'fail'
      ? 'border-l-red-500'
      : 'border-l-border'

  return (
    <div
      className={`border border-border border-l-4 ${borderColor} rounded-xl overflow-hidden bg-card`}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-start"
      >
        <span className="w-6 h-6 rounded-full bg-muted text-xs font-bold flex items-center justify-center shrink-0 text-muted-foreground">
          {index + 1}
        </span>
        <OutcomeIcon outcome={stage.outcome} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">
              {stage.labelAr}
            </span>
            {stage.isBlockingAnnulment && (
              <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded font-bold shrink-0">
                ⚠ أساس الإلغاء
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{stage.labelEn}</div>
        </div>
        <ScoreBadge score={stage.score} />
        <ChevronRight
          className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/10 text-sm">
          {stage.reasoning && (
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
                التسبيب
              </div>
              <p className="text-foreground/80 leading-relaxed">{stage.reasoning}</p>
            </div>
          )}

          {stage.findings.length > 0 && (
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
                النتائج
              </div>
              <ul className="space-y-1">
                {stage.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground/80">
                    <span className="text-amber-500 mt-0.5 shrink-0">◆</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stage.uaeLegalReferences.length > 0 && (
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
                المراجع القانونية الإماراتية
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stage.uaeLegalReferences.map((ref, i) => (
                  <span
                    key={i}
                    className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded font-mono"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stage.remedyAr && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                العلاج المقترح
              </div>
              <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                {stage.remedyAr}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Priority sort order ──────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// ─── Risk level helpers ───────────────────────────────────────────────────────

function riskLevelLabel(level: JdtRiskLevel | null | undefined): string {
  switch (level) {
    case 'critical':
      return 'خطر حرج — احتمال إلغاء قضائي مرتفع جداً'
    case 'high':
      return 'خطر عالٍ — يستوجب مراجعة قانونية فورية'
    case 'moderate':
      return 'خطر متوسط — يُنصح بمعالجة النقاط المثارة'
    case 'low':
      return 'خطر منخفض — القرار في وضع قضائي جيد'
    default:
      return 'لم يُحدَّد مستوى الخطر بعد'
  }
}

function riskLevelColor(level: JdtRiskLevel | null | undefined): string {
  switch (level) {
    case 'critical':
      return 'text-red-600 dark:text-red-400'
    case 'high':
      return 'text-orange-600 dark:text-orange-400'
    case 'moderate':
      return 'text-amber-600 dark:text-amber-400'
    case 'low':
      return 'text-green-600 dark:text-green-400'
    default:
      return 'text-muted-foreground'
  }
}

function outcomeLabel(outcome: JdtStageOutcome | null | undefined): string {
  switch (outcome) {
    case 'pass':
      return 'مطابق'
    case 'partial':
      return 'جزئي'
    case 'fail':
      return 'مخالف'
    case 'not_assessed':
    default:
      return 'لم يُقيَّم'
  }
}

function outcomeClass(outcome: JdtStageOutcome | null | undefined): string {
  switch (outcome) {
    case 'pass':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
    case 'partial':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
    case 'fail':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function JdtPage() {
  const { id } = useParams<{ id: string }>()
  const decisionId = parseInt(id ?? '0', 10)
  const t = useT()
  const { role, userId, userOrg, canViewJdtSimulation, canRunJdtSimulation } =
    useUserContext()
  const queryClient = useQueryClient()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-id': String(userId),
    'x-user-org': userOrg ?? '',
  }

  const BASE_URL = import.meta.env.BASE_URL

  // ── Fetch simulation ──────────────────────────────────────────────────────

  const {
    data: sim,
    isLoading,
    error: queryError,
  } = useQuery<JdtSimulation>({
    queryKey: ['jdt', decisionId],
    queryFn: async () => {
      const res = await fetch(`/api/jdt/${decisionId}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      return res.json()
    },
    enabled: !!decisionId && canViewJdtSimulation,
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3000 : false,
  })

  // ── Run mutation ──────────────────────────────────────────────────────────

  const runMutation = useMutation<JdtSimulation, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/jdt/simulate/${decisionId}`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jdt', decisionId] })
    },
  })

  // ── Reasoning collapsible ─────────────────────────────────────────────────

  const reasoningIsShort = (sim?.judicialReasoning?.length ?? 0) < 1000
  const [reasoningExpanded, setReasoningExpanded] = useState(reasoningIsShort)

  const status = sim?.status ?? 'not_started'
  const hasResults =
    status === 'completed' && (sim?.reviewStages?.length ?? 0) > 0

  // ── Access denied ─────────────────────────────────────────────────────────

  if (!canViewJdtSimulation) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t('وصول مرفوض', 'Access Denied')}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {t(
                'ليس لديك صلاحية عرض التوأم القضائي الرقمي. يُرجى التواصل مع مسؤول النظام.',
                'You do not have permission to view the Judicial Digital Twin. Please contact your system administrator.'
              )}
            </p>
          </div>
          <Link
            href={`/decisions/${decisionId}`}
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('العودة إلى القرار', 'Back to Decision')}
          </Link>
        </div>
      </AppLayout>
    )
  }

  // ── Run button shared ─────────────────────────────────────────────────────

  const RunButton = ({ className = '' }: { className?: string }) =>
    canRunJdtSimulation ? (
      <div className={`flex flex-col gap-2 ${className}`}>
        <button
          onClick={() => runMutation.mutate()}
          disabled={
            runMutation.isPending ||
            status === 'running' ||
            status === 'pending'
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runMutation.isPending || status === 'running' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {t('تشغيل المحاكاة', 'Run Simulation')}
        </button>
        {runMutation.isError && (
          <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{runMutation.error?.message}</span>
          </div>
        )}
      </div>
    ) : null

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-16" dir="rtl">

        {/* ── SECTION 1 — HEADER ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Back link */}
          <Link
            href={`/decisions/${decisionId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('العودة إلى القرار', 'Back to Decision')}
          </Link>

          {/* Title row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t('التوأم القضائي الرقمي', 'Judicial Digital Twin')}
                </h1>
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold shrink-0">
                  Phase 44
                </span>
              </div>
              <p className="text-sm text-muted-foreground pe-2">
                {t(
                  'محاكاة كاملة للمراجعة القضائية قبل التقديم — نظرية الشامسي™',
                  'Complete pre-submission judicial review simulation — Al-Shamsi Theory™'
                )}
              </p>
            </div>

            {/* Status + Run */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Status badge */}
              {status === 'not_started' && (
                <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                  {t('لم تبدأ', 'Not Started')}
                </span>
              )}
              {status === 'pending' && (
                <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('في الانتظار', 'Pending')}
                </span>
              )}
              {status === 'running' && (
                <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-medium flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('جارٍ التشغيل', 'Running')}
                </span>
              )}
              {status === 'completed' && (
                <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('مكتملة', 'Completed')}
                </span>
              )}
              {status === 'failed' && (
                <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-medium flex items-center gap-1.5">
                  <XCircle className="w-3 h-3" />
                  {t('فشلت', 'Failed')}
                </span>
              )}
              {status !== 'running' && <RunButton />}
            </div>
          </div>
        </div>

        {/* ── SECTION 2 — Loading ──────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {t('جارٍ تحميل بيانات المحاكاة…', 'Loading simulation data…')}
            </p>
          </div>
        )}

        {/* ── SECTION 3 — Not started / no data ───────────────────────── */}
        {!isLoading &&
          (status === 'not_started' || status === 'pending') &&
          !sim?.reviewStages?.length && (
            <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Scale className="w-10 h-10 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  {t(
                    'لم تُجرَ محاكاة قضائية بعد',
                    'No judicial simulation yet'
                  )}
                </h2>
                <p className="text-muted-foreground max-w-md">
                  {t(
                    'ابدأ المحاكاة لتحليل القرار عبر المراحل القضائية الثماني ونظرية الشامسي™',
                    'Run the simulation to analyse the decision across 8 judicial stages and Al-Shamsi Theory™'
                  )}
                </p>
              </div>
              <RunButton />
            </div>
          )}

        {/* ── SECTION 4 — Running ──────────────────────────────────────── */}
        {!isLoading && status === 'running' && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-10 flex flex-col items-center gap-6 text-center">
            <Loader2 className="w-14 h-14 animate-spin text-amber-500" />
            <div>
              <h2 className="text-xl font-bold text-amber-800 dark:text-amber-300 mb-2">
                {t('جارٍ تشغيل المحاكاة القضائية…', 'Running judicial simulation…')}
              </h2>
              <p className="text-amber-700 dark:text-amber-400 text-sm max-w-md">
                {t(
                  'يتم الآن تحليل القرار عبر المراحل الثماني وأبعاد نظرية الشامسي الستة عشر. ستُحدَّث الصفحة تلقائياً.',
                  'Analysing the decision across 8 stages and 16 Al-Shamsi dimensions. The page will refresh automatically.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-xs text-amber-700 dark:text-amber-400">
              {[
                'القبول الشكلي',
                'الاختصاص',
                'الإجراءات',
                'الاختصاص الوظيفي',
                'الشكل',
                'السبب',
                'الغاية',
                'التناسب',
              ].map((stage, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  {stage}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 5 — Failed ───────────────────────────────────────── */}
        {!isLoading && status === 'failed' && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-2xl p-8 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-500 shrink-0" />
              <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
                {t('فشلت عملية المحاكاة', 'Simulation Failed')}
              </h2>
            </div>
            {sim?.errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed bg-red-100 dark:bg-red-900/30 rounded-lg px-4 py-3 font-mono">
                {sim.errorMessage}
              </p>
            )}
            <RunButton />
          </div>
        )}

        {/* ── SECTION 6 — Completed ────────────────────────────────────── */}
        {hasResults && (
          <>
            {/* ── 6A: HERO — Judicial Success Probability ─────────────── */}
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Gauge */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <CircleGauge
                    value={sim?.judicialSuccessProbability}
                    size={160}
                  />
                  <div
                    className={`text-sm font-semibold text-center ${riskLevelColor(sim?.overallRiskLevel)}`}
                  >
                    {riskLevelLabel(sim?.overallRiskLevel)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(
                      'احتمال النجاح القضائي',
                      'Judicial Success Probability'
                    )}
                  </div>
                </div>

                {/* Probability bars */}
                <div className="flex-1 w-full space-y-4">
                  <h3 className="text-base font-bold text-foreground">
                    {t(
                      'توزيع احتمالات النتائج القضائية',
                      'Judicial Outcome Probability Distribution'
                    )}
                  </h3>

                  {/* Annulment */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">
                        {t('احتمال الإلغاء', 'Annulment Probability')}
                      </span>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">
                        {sim?.probabilityAnnulment !== null &&
                        sim?.probabilityAnnulment !== undefined
                          ? `${Math.round(sim.probabilityAnnulment)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all duration-700"
                        style={{
                          width: `${sim?.probabilityAnnulment ?? 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Dismissal */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">
                        {t('احتمال رفض الطعن', 'Dismissal Probability')}
                      </span>
                      <span className="font-mono font-bold text-green-600 dark:text-green-400">
                        {sim?.probabilityDismissal !== null &&
                        sim?.probabilityDismissal !== undefined
                          ? `${Math.round(sim.probabilityDismissal)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-700"
                        style={{
                          width: `${sim?.probabilityDismissal ?? 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Correction */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">
                        {t('احتمال التصحيح', 'Correction Probability')}
                      </span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {sim?.probabilityCorrection !== null &&
                        sim?.probabilityCorrection !== undefined
                          ? `${Math.round(sim.probabilityCorrection)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-700"
                        style={{
                          width: `${sim?.probabilityCorrection ?? 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 6B: 8 Review Stages ─────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Gavel className="w-5 h-5 text-primary shrink-0" />
                <h2 className="text-lg font-bold text-foreground">
                  {t(
                    'مراحل المراجعة القضائية الثماني',
                    '8 Judicial Review Stages'
                  )}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(sim?.reviewStages ?? []).map((stage, i) => (
                  <ReviewStageCard key={stage.stageKey} stage={stage} index={i} />
                ))}
              </div>
            </div>

            {/* ── 6C: Al-Shamsi 16 Dimensions ─────────────────────────── */}
            {(sim?.shamsiDimensions?.length ?? 0) > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-amber-500 shrink-0" />
                    <h2 className="text-lg font-bold text-foreground">
                      {t(
                        'تحليل أبعاد نظرية الشامسي™ الستة عشر',
                        'Al-Shamsi™ 16-Dimension Analysis'
                      )}
                    </h2>
                  </div>
                  {sim?.shamsiOverallScore !== null &&
                    sim?.shamsiOverallScore !== undefined && (
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-3xl font-bold tabular-nums text-amber-500">
                          {Math.round(sim.shamsiOverallScore)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /100 — {t('متوسط الأبعاد', 'Dimension Average')}
                        </span>
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(sim?.shamsiDimensions ?? []).map((dim) => (
                    <div
                      key={dim.dimensionKey}
                      className="bg-card border border-border rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground leading-tight">
                          {dim.labelAr}
                        </span>
                        <OutcomeIcon outcome={dim.outcome} />
                      </div>
                      <ScoreBadge score={dim.score} />
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {dim.reasoning.length > 80
                          ? dim.reasoning.slice(0, 80) + '…'
                          : dim.reasoning}
                      </p>
                      {dim.constitutionalRef && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono">
                          {dim.constitutionalRef}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 6D: Cross-Module Integration ────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary shrink-0" />
                <h2 className="text-lg font-bold text-foreground">
                  {t('تكامل الوحدات', 'Module Integration')}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* CIL Card */}
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-sm text-foreground">
                      {t('التقييم الدستوري CIL', 'Constitutional Assessment CIL')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {sim?.constitutionalScore !== null &&
                      sim?.constitutionalScore !== undefined
                        ? Math.round(sim.constitutionalScore)
                        : '—'}
                    </span>
                    <span className="text-sm text-muted-foreground">/100</span>
                    {sim?.constitutionalOutcome && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${outcomeClass(sim.constitutionalOutcome)}`}
                      >
                        {outcomeLabel(sim.constitutionalOutcome)}
                      </span>
                    )}
                  </div>
                  {sim?.constitutionalReasoning && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {sim.constitutionalReasoning}
                    </p>
                  )}
                </div>

                {/* NRME Card */}
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold text-sm text-foreground">
                      {t('تقييم المخاطر NRME', 'Risk Assessment NRME')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {sim?.riskIntegrationScore !== null &&
                      sim?.riskIntegrationScore !== undefined
                        ? Math.round(sim.riskIntegrationScore)
                        : '—'}
                    </span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  {sim?.riskReasoning && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {sim.riskReasoning}
                    </p>
                  )}
                </div>

                {/* Replay Integration Card */}
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-purple-500" />
                    <span className="font-semibold text-sm text-foreground">
                      {t('تكامل الإعادة', 'Replay Integration')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {sim?.replayIntegration?.stagesAnalysed ?? '—'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t('مراحل محللة', 'stages analysed')}
                    </span>
                  </div>
                  {sim?.replayIntegration?.criticalStageKeys && (
                    <p className="text-xs text-muted-foreground">
                      {t('المراحل الحرجة:', 'Critical stages:')}{' '}
                      <span className="font-semibold text-red-500">
                        {sim.replayIntegration.criticalStageKeys.length}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── 6E: Strengths & Weaknesses ──────────────────────────── */}
            {((sim?.strengths?.length ?? 0) > 0 ||
              (sim?.weaknesses?.length ?? 0) > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <h3 className="font-bold text-foreground">
                      {t('نقاط القوة', 'Strengths')}
                    </h3>
                  </div>
                  {(sim?.strengths?.length ?? 0) > 0 ? (
                    <ul className="space-y-2">
                      {sim!.strengths!.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-foreground/80">{s}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('لا توجد نقاط قوة محددة', 'No strengths identified')}
                    </p>
                  )}
                </div>

                {/* Weaknesses */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <h3 className="font-bold text-foreground">
                      {t('نقاط الضعف', 'Weaknesses')}
                    </h3>
                  </div>
                  {(sim?.weaknesses?.length ?? 0) > 0 ? (
                    <ul className="space-y-2">
                      {sim!.weaknesses!.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span className="text-foreground/80">{w}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('لا توجد نقاط ضعف محددة', 'No weaknesses identified')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── 6F: Missing Evidence ─────────────────────────────────── */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-foreground">
                  {t(
                    'الأدلة والمستندات المفقودة',
                    'Missing Evidence & Documents'
                  )}
                </h3>
              </div>
              {(sim?.missingEvidence?.length ?? 0) === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('لا توجد أدلة مفقودة', 'No missing evidence identified')}
                </div>
              ) : (
                <ul className="space-y-2">
                  {sim!.missingEvidence!.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500 shrink-0 mt-0.5">◆</span>
                      <span className="text-foreground/80">{ev}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── 6G: Corrective Actions ──────────────────────────────── */}
            {(sim?.correctiveActions?.length ?? 0) > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="text-lg font-bold text-foreground">
                    {t(
                      'الإجراءات التصحيحية قبل إصدار القرار',
                      'Corrective Actions Before Decision Issuance'
                    )}
                  </h2>
                </div>
                <div className="space-y-3">
                  {[...(sim!.correctiveActions ?? [])]
                    .sort(
                      (a, b) =>
                        (PRIORITY_ORDER[a.priority] ?? 99) -
                        (PRIORITY_ORDER[b.priority] ?? 99)
                    )
                    .map((action, i) => (
                      <div
                        key={i}
                        className="bg-card border border-border rounded-xl p-4 space-y-2"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <PriorityBadge priority={action.priority} />
                          <span className="text-xs text-muted-foreground">
                            {t('المرحلة:', 'Stage:')} {action.targetStage}
                          </span>
                          <span className="text-xs text-muted-foreground ms-auto">
                            {t('الموعد:', 'Deadline:')} {action.deadline}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {action.action}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── 6H: Full Judicial Reasoning ─────────────────────────── */}
            {sim?.judicialReasoning && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Gavel className="w-5 h-5 text-primary shrink-0" />
                    <h2 className="text-lg font-bold text-foreground">
                      {t(
                        'التسبيب القضائي الكامل',
                        'Full Judicial Reasoning'
                      )}
                    </h2>
                  </div>
                  <button
                    onClick={() => setReasoningExpanded((p) => !p)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    {reasoningExpanded
                      ? t('طيّ', 'Collapse')
                      : t('توسيع', 'Expand')}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        reasoningExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {reasoningExpanded && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5">
                      <p className="text-sm text-foreground/80 leading-loose whitespace-pre-wrap">
                        {sim.judicialReasoning}
                      </p>
                    </div>

                    {sim?.overallAssessment && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                            {t('التقييم الشامل', 'Overall Assessment')}
                          </span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                          {sim.overallAssessment}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <div className="border-t border-border pt-6 text-center space-y-1">
          <div className="text-xs text-muted-foreground">
            {sim?.simulationVersion !== undefined &&
              `${t('الإصدار', 'Version')} ${sim.simulationVersion} · `}
            {sim?.completedAt &&
              `${t('اكتملت في:', 'Completed:')} ${new Date(sim.completedAt).toLocaleString('ar-AE')} · `}
            {t(
              'التوأم القضائي الرقمي — Phase 44 — نظرية الشامسي™',
              'Judicial Digital Twin — Phase 44 — Al-Shamsi Theory™'
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
