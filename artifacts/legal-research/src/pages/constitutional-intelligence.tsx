/**
 * Phase 42 — Constitutional Intelligence Layer (CIL) Dashboard
 * ─────────────────────────────────────────────────────────────
 * The constitutional brain of MARSAD.
 * Displays constitutional compliance scores, risk indices, warnings,
 * and 12-principle analysis across all administrative decisions.
 *
 * Al-Shamsi Constitutional Intelligence Layer™ · MARSAD CIL v42.0
 */
import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Scale, Shield, AlertTriangle, CheckCircle2, XCircle, Clock,
  RefreshCw, ChevronRight, Loader2, Activity, Fingerprint,
  FileText, Target, BarChart3, Eye, Gavel, Users,
  TrendingUp, TrendingDown, ArrowUpRight, BookOpen,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type CilRiskLevel = 'low' | 'moderate' | 'high' | 'critical';
type AssessmentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'not_started';

interface PrincipleResult {
  principleKey: string;
  labelAr: string;
  labelEn: string;
  complianceScore: number;
  status: 'compliant' | 'minor_concern' | 'significant_concern' | 'deficient' | 'not_assessed';
  findingAr: string;
  legalReasoning: string;
  constitutionalReferences: Array<{ article: string; titleAr: string; relevance: string }>;
  uaeLegalReferences: Array<{ law: string; article: string; titleAr: string; relevance: string }>;
  alShamsiDimensions: Array<{ dimension: string; score: number; finding: string }>;
  evidenceReferences: Array<{ sequenceNumber: number; action: string; relevance: string }>;
  replayReferences: Array<{ stageKey: string; stageLabel: string; relevance: string }>;
  remedyAr: string | null;
  isBlockingApproval: boolean;
}

interface CilWarning {
  id: number;
  warningCode: string;
  severity: 'advisory' | 'warning' | 'critical';
  principleKey: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  constitutionalRef: string;
  remedyAr: string;
  isResolved: boolean;
}

interface ConstitutionalAssessment {
  id: number;
  decisionId: number;
  status: AssessmentStatus;
  assessmentVersion: number;
  triggeredBy: string;
  completedAt: string | null;
  constitutionalComplianceScore: number | null;
  constitutionalRiskIndex: number | null;
  equalityIndex: number | null;
  dueProcessIndex: number | null;
  rightsImpactScore: number | null;
  judicialSurvivalProbability: number | null;
  overallRiskLevel: CilRiskLevel | null;
  principleResults: PrincipleResult[] | null;
  warnings: CilWarning[] | null;
  activeWarningCount: number;
  hasCriticalWarning: boolean;
  overallReasoningAr: string | null;
  recommendedActionAr: string | null;
  acknowledged: boolean;
  nrmeIntegration: {
    constitutionalImpactScore: number;
    riskIndexAlignment: number;
    recommendation: string;
  } | null;
  replayIntegration: {
    stagesAnalysed: number;
    criticalStages: string[];
    replayHash: string;
  } | null;
}

interface DecisionRow {
  decisionId: number;
  caseNumber: string;
  titleAr: string;
  organizationUnit: string;
  decisionStatus: string;
  assessmentStatus: AssessmentStatus;
  constitutionalComplianceScore: number | null;
  constitutionalRiskIndex: number | null;
  judicialSurvivalProbability: number | null;
  overallRiskLevel: CilRiskLevel | null;
  hasCriticalWarning: boolean;
  activeWarningCount: number;
  acknowledged: boolean;
}

interface DashboardStats {
  totalAssessments: number;
  completedAssessments: number;
  criticalWarnings: number;
  avgComplianceScore: number | null;
  avgSurvivalProbability: number | null;
  byRiskLevel: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHeaders(role: string, userId: number, org: string) {
  return {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-id': String(userId),
    'x-user-org': org,
  };
}

function riskLevelConfig(level: CilRiskLevel | null | undefined) {
  switch (level) {
    case 'critical': return {
      labelAr: 'حرج', labelEn: 'Critical',
      bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800/40', dot: 'bg-red-500',
      ring: 'ring-red-400/30',
    };
    case 'high': return {
      labelAr: 'عالٍ', labelEn: 'High',
      bg: 'bg-gold/15 dark:bg-gold/40', text: 'text-gold dark:text-gold/80',
      border: 'border-gold/25 dark:border-gold/40', dot: 'bg-gold',
      ring: 'ring-gold/30',
    };
    case 'moderate': return {
      labelAr: 'متوسط', labelEn: 'Moderate',
      bg: 'bg-gold/15 dark:bg-gold/40', text: 'text-gold dark:text-gold/80',
      border: 'border-gold/25 dark:border-gold/40', dot: 'bg-gold',
      ring: 'ring-gold/30',
    };
    default: return {
      labelAr: 'منخفض', labelEn: 'Low',
      bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800/40', dot: 'bg-emerald-500',
      ring: 'ring-emerald-400/30',
    };
  }
}

function severityConfig(severity: CilWarning['severity']) {
  switch (severity) {
    case 'critical': return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: <XCircle className="w-4 h-4" /> };
    case 'warning':  return { bg: 'bg-gold/10 dark:bg-gold/30', border: 'border-gold/40 dark:border-gold/75', text: 'text-gold dark:text-gold/80', badge: 'bg-gold/15 text-gold dark:bg-gold/40 dark:text-gold/80', icon: <AlertTriangle className="w-4 h-4" /> };
    default:         return { bg: 'bg-gold/10 dark:bg-gold/30', border: 'border-gold/40 dark:border-gold/75', text: 'text-gold dark:text-gold/80', badge: 'bg-gold/15 text-gold dark:bg-gold/40 dark:text-gold/80', icon: <AlertTriangle className="w-4 h-4" /> };
  }
}

function statusConfig(status: PrincipleResult['status']) {
  switch (status) {
    case 'compliant':            return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'ممتثل' };
    case 'minor_concern':        return { bg: 'bg-gold/80',   text: 'text-gold',   label: 'قلق طفيف' };
    case 'significant_concern':  return { bg: 'bg-gold',  text: 'text-gold',  label: 'قلق جوهري' };
    case 'deficient':            return { bg: 'bg-red-500',     text: 'text-red-700',     label: 'ناقص' };
    default:                     return { bg: 'bg-slate-400',   text: 'text-slate-600',   label: 'لم يُقيَّم' };
  }
}

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({
  labelAr, labelEn, value, description, isInverse = false,
}: {
  labelAr: string; labelEn: string;
  value: number | null | undefined; description: string; isInverse?: boolean;
}) {
  const t = useT();
  const pct = value ?? 0;
  // For inverse metrics (riskIndex), red is high; for others, green is high
  const colorClass = isInverse
    ? pct >= 70 ? 'text-red-500'    : pct >= 40 ? 'text-gold' : 'text-emerald-500'
    : pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-gold' : 'text-red-500';

  const trackColor = isInverse
    ? pct >= 70 ? 'stroke-red-500'    : pct >= 40 ? 'stroke-gold' : 'stroke-emerald-500'
    : pct >= 70 ? 'stroke-emerald-500' : pct >= 40 ? 'stroke-gold' : 'stroke-red-500';

  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = value !== null && value !== undefined ? (pct / 100) * circ : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" className="stroke-border" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          className={trackColor} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className={`-mt-14 text-2xl font-bold tabular-nums ${colorClass}`}>
        {value !== null && value !== undefined ? value : '—'}
      </div>
      <div className="mt-8 text-center">
        <div className="text-sm font-semibold text-foreground">{t(labelAr, labelEn)}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
    </div>
  );
}

// ─── Principle Card ───────────────────────────────────────────────────────────

function PrincipleCard({
  principle, expanded, onToggle,
}: {
  principle: PrincipleResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sc = statusConfig(principle.status);
  const score = principle.complianceScore;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      principle.isBlockingApproval
        ? 'border-red-300 dark:border-red-800'
        : 'border-border'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-start"
      >
        {/* Score bar */}
        <div className="relative w-12 h-12 shrink-0">
          <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
            <circle cx="24" cy="24" r="18" fill="none" className="stroke-border" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="18" fill="none"
              className={score >= 70 ? 'stroke-emerald-500' : score >= 40 ? 'stroke-gold' : 'stroke-red-500'}
              strokeWidth="4"
              strokeDasharray={`${(score / 100) * (2 * Math.PI * 18)} ${2 * Math.PI * 18}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">
            {score}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{principle.labelAr}</span>
            {principle.isBlockingApproval && (
              <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded font-bold">
                يعيق الإقرار
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{principle.labelEn}</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.text} ${sc.bg.replace('bg-', 'bg-opacity-20 bg-')}`}>
            {sc.label}
          </span>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/10">
          {/* Finding */}
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">النتيجة القانونية</div>
            <p className="text-sm text-foreground leading-relaxed">{principle.findingAr}</p>
          </div>
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Legal Reasoning</div>
            <p className="text-sm text-foreground/80 leading-relaxed">{principle.legalReasoning}</p>
          </div>

          {/* Constitutional References */}
          {(principle.constitutionalReferences?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">المراجع الدستورية</div>
              <div className="space-y-1.5">
                {(principle.constitutionalReferences ?? []).map((ref, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono shrink-0">{ref.article}</span>
                    <span className="text-foreground/80">{ref.titleAr} — {ref.relevance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UAE Legal References */}
          {(principle.uaeLegalReferences?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">المراجع القانونية الإماراتية</div>
              <div className="space-y-1.5">
                {(principle.uaeLegalReferences ?? []).map((ref, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded shrink-0">{ref.law}</span>
                    <span className="text-foreground/80">{ref.article}: {ref.titleAr}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Al-Shamsi Dimensions */}
          {(principle.alShamsiDimensions?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">أبعاد نظرية الشامسي</div>
              <div className="grid grid-cols-2 gap-2">
                {(principle.alShamsiDimensions ?? []).map((dim, i) => (
                  <div key={i} className="bg-gold/5 border border-gold/20 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gold">{dim.dimension}</span>
                      <span className="text-xs font-bold tabular-nums">{dim.score}</span>
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${dim.score}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dim.finding}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remedy */}
          {principle.remedyAr && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">التوصية العلاجية</div>
              <p className="text-sm text-blue-700 dark:text-blue-300">{principle.remedyAr}</p>
            </div>
          )}

          {/* Replay References */}
          {(principle.replayReferences?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">مراحل إعادة التشغيل المرجعية</div>
              <div className="flex flex-wrap gap-1.5">
                {(principle.replayReferences ?? []).map((ref, i) => (
                  <span key={i} className="text-xs bg-muted border border-border rounded px-2 py-0.5">
                    {ref.stageLabel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Decision Assessment Panel ────────────────────────────────────────────────

function DecisionAssessmentView({
  decisionId, role, userId, org, canRun, canAcknowledge,
}: {
  decisionId: number; role: string; userId: number; org: string;
  canRun: boolean; canAcknowledge: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [expandedPrinciple, setExpandedPrinciple] = useState<string | null>(null);
  const headers = getHeaders(role, userId, org);

  const { data: assessData, isLoading } = useQuery({
    queryKey: ['cil-assessment', decisionId],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/cil/assess/${decisionId}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch assessment');
      return res.json() as Promise<{ assessment: ConstitutionalAssessment | null; status: string }>;
    },
    refetchInterval: (d) => (d.state.data?.status === 'running' ? 3000 : false),
  });

  const { data: warningsData } = useQuery({
    queryKey: ['cil-warnings', decisionId],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/cil/warnings/${decisionId}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch warnings');
      return res.json();
    },
    enabled: assessData?.assessment?.status === 'completed',
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/cil/assess/${decisionId}`, {
        method: 'POST', headers,
      });
      if (!res.ok) throw new Error('Failed to trigger assessment');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cil-assessment', decisionId] }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/cil/assess/${decisionId}/acknowledge`, {
        method: 'POST', headers,
      });
      if (!res.ok) throw new Error('Failed to acknowledge');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cil-assessment', decisionId] }),
  });

  const assessment = assessData?.assessment;
  const status = assessData?.status ?? 'not_started';
  const warnings: CilWarning[] = warningsData?.warnings ?? [];

  if (isLoading) return (
    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">جارٍ التحميل…</span>
    </div>
  );

  const rlc = riskLevelConfig(assessment?.overallRiskLevel);

  return (
    <div className="space-y-6">
      {/* Status + Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {status === 'running' && (
            <span className="flex items-center gap-1.5 text-gold text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('جارٍ التقييم الدستوري…', 'Running constitutional assessment…')}
            </span>
          )}
          {status === 'completed' && assessment && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${rlc.bg} ${rlc.text} ${rlc.border}`}>
              <span className={`w-2 h-2 rounded-full ${rlc.dot}`} />
              {t(rlc.labelAr, rlc.labelEn)} · v{assessment.assessmentVersion}
            </div>
          )}
          {(status === 'not_started' || status === 'failed') && (
            <span className="text-sm text-muted-foreground">
              {t('لم يتم التقييم بعد', 'No assessment yet')}
            </span>
          )}
          {status === 'failed' && (
            <span className="text-xs text-red-600">{t('فشل التقييم', 'Assessment failed')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canRun && (
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending || status === 'running'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {triggerMutation.isPending || status === 'running'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              {t('تشغيل التقييم', 'Run Assessment')}
            </button>
          )}
          {canAcknowledge && assessment?.status === 'completed' && !assessment.acknowledged && (
            <button
              onClick={() => acknowledgeMutation.mutate()}
              disabled={acknowledgeMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {t('إقرار', 'Acknowledge')}
            </button>
          )}
          {assessment?.acknowledged && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t('تم الإقرار', 'Acknowledged')}
            </span>
          )}
        </div>
      </div>

      {assessment?.status === 'completed' && (
        <>
          {/* 6 Scores Grid */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">
              {t('المؤشرات الدستورية الستة', 'Six Constitutional Scores')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <ScoreGauge
                labelAr="الامتثال الدستوري"
                labelEn="Constitutional Compliance"
                value={assessment.constitutionalComplianceScore}
                description={t('نسبة الامتثال', 'Compliance score')}
              />
              <ScoreGauge
                labelAr="مؤشر المخاطر"
                labelEn="Risk Index"
                value={assessment.constitutionalRiskIndex}
                description={t('المخاطر الدستورية', 'Constitutional risk')}
                isInverse
              />
              <ScoreGauge
                labelAr="مؤشر المساواة"
                labelEn="Equality Index"
                value={assessment.equalityIndex}
                description={t('معاملة متساوية', 'Equal treatment')}
              />
              <ScoreGauge
                labelAr="ضمانات التقاضي"
                labelEn="Due Process Index"
                value={assessment.dueProcessIndex}
                description={t('الضمانات الإجرائية', 'Procedural guarantees')}
              />
              <ScoreGauge
                labelAr="أثر الحقوق"
                labelEn="Rights Impact"
                value={assessment.rightsImpactScore}
                description={t('أثر على الحقوق', 'Rights protection')}
              />
              <ScoreGauge
                labelAr="احتمالية الصمود"
                labelEn="Judicial Survival"
                value={assessment.judicialSurvivalProbability}
                description={t('أمام القضاء', 'Before courts')}
              />
            </div>
          </div>

          {/* Constitutional Warnings */}
          {warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gold" />
                {t('التحذيرات الدستورية', 'Constitutional Warnings')}
                <span className="text-xs bg-gold/15 text-gold dark:bg-gold/30 dark:text-gold/80 px-1.5 py-0.5 rounded font-bold">
                  {warnings.filter((w) => !w.isResolved).length}
                </span>
              </h3>
              <div className="space-y-3">
                {warnings.map((w) => {
                  const sc = severityConfig(w.severity);
                  return (
                    <div key={w.id} className={`flex items-start gap-3 p-4 rounded-xl border ${sc.bg} ${sc.border} ${w.isResolved ? 'opacity-60' : ''}`}>
                      <div className={`shrink-0 mt-0.5 ${sc.text}`}>{sc.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-bold ${sc.text}`}>{w.titleAr}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${sc.badge}`}>
                            {w.severity === 'critical' ? 'حرج' : w.severity === 'warning' ? 'تحذير' : 'استشاري'}
                          </span>
                          {w.isResolved && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                              ✓ محلول
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground/80 mb-1.5">{w.descriptionAr}</p>
                        {w.constitutionalRef && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">{t('المرجع الدستوري:', 'Ref:')}</span> {w.constitutionalRef}
                          </div>
                        )}
                        {w.remedyAr && !w.isResolved && (
                          <div className="mt-1.5 text-xs text-blue-700 dark:text-blue-400">
                            <span className="font-medium">التوصية:</span> {w.remedyAr}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overall Reasoning */}
          {assessment.overallReasoningAr && (
            <div className="bg-muted/30 border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gold" />
                {t('التحليل الدستوري الشامل', 'Overall Constitutional Analysis')}
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{assessment.overallReasoningAr}</p>
              {assessment.recommendedActionAr && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs font-bold text-muted-foreground uppercase mb-1">الإجراء الموصى به</div>
                  <p className="text-sm text-foreground leading-relaxed">{assessment.recommendedActionAr}</p>
                </div>
              )}
            </div>
          )}

          {/* 12-Principle Grid */}
          {assessment.principleResults && assessment.principleResults.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">
                {t('تحليل المبادئ الدستورية الاثني عشر', '12 Constitutional Principles Analysis')}
              </h3>
              <div className="space-y-2">
                {assessment.principleResults.map((p) => (
                  <PrincipleCard
                    key={p.principleKey}
                    principle={p}
                    expanded={expandedPrinciple === p.principleKey}
                    onToggle={() => setExpandedPrinciple(
                      expandedPrinciple === p.principleKey ? null : p.principleKey
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cross-module Integration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assessment.nrmeIntegration && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-bold">{t('تكامل تقييم المخاطر', 'Risk Assessment Integration')}</span>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{t('الأثر الدستوري على المخاطر', 'Constitutional risk impact')}</span>
                    <span className="font-bold tabular-nums text-foreground">{assessment.nrmeIntegration.constitutionalImpactScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>توافق مؤشرات المخاطر</span>
                    <span className="font-bold tabular-nums text-foreground">{assessment.nrmeIntegration.riskIndexAlignment}%</span>
                  </div>
                  <p className="text-xs pt-1 text-foreground/70">{assessment.nrmeIntegration.recommendation}</p>
                </div>
              </div>
            )}
            {assessment.replayIntegration && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-bold">{t('تكامل محرك التشغيل', 'Replay Integration')}</span>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>المراحل المحللة</span>
                    <span className="font-bold tabular-nums text-foreground">{assessment.replayIntegration.stagesAnalysed}</span>
                  </div>
                  {assessment.replayIntegration.criticalStages.length > 0 && (
                    <div>
                      <span className="block mb-1">المراحل الحرجة:</span>
                      <div className="flex flex-wrap gap-1">
                        {assessment.replayIntegration.criticalStages.map((s) => (
                          <span key={s} className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {(status === 'not_started' || status === 'failed') && !canRun && (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t('لم يتم إجراء تقييم دستوري بعد لهذا القرار', 'No constitutional assessment has been run for this decision yet')}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ConstitutionalIntelligence() {
  const { role, userId, userOrg, lang, canViewCilDashboard: canViewCilDashboardPermission, canRunCilAssessment, canAcknowledgeCilWarnings } = useUserContext();
  const t = useT();
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(null);
  const headers = getHeaders(role, userId, userOrg);
  // Judicial Command Center rebuild: this dashboard is owner-only regardless
  // of the broader CIL permission set.
  const canViewCilDashboard = role === 'owner' && canViewCilDashboardPermission;

  const { data: dashStats, isLoading: statsLoading } = useQuery({
    queryKey: ['cil-dashboard'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/cil/dashboard`, { headers });
      if (!res.ok) throw new Error('Failed to load CIL dashboard');
      return res.json() as Promise<DashboardStats>;
    },
    enabled: canViewCilDashboard,
    staleTime: 30_000,
  });

  const { data: decisionsData, isLoading: decisionsLoading } = useQuery({
    queryKey: ['cil-decisions'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/cil/decisions`, { headers });
      if (!res.ok) throw new Error('Failed to load decisions');
      return res.json() as Promise<{ decisions: DecisionRow[]; total: number }>;
    },
    enabled: canViewCilDashboard,
    staleTime: 30_000,
  });

  if (!canViewCilDashboard) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 text-muted-foreground gap-3">
          <Shield className="w-12 h-12 opacity-20" />
          <p className="text-sm font-medium">{t('ليس لديك صلاحية الوصول.', 'You do not have access.')}</p>
        </div>
      </AppLayout>
    );
  }

  const decisions = decisionsData?.decisions ?? [];
  const totalDecisions = decisionsData?.total ?? 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                <Scale className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {t('المراجعة الدستورية', 'Constitutional Review')}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t('نظرية الشامسي™ · 12 مبدأً دستورياً', 'Al-Shamsi Theory™ · 12 Constitutional Principles')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Dashboard Stats ── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : dashStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="text-2xl font-bold tabular-nums text-foreground">{dashStats.totalAssessments}</div>
              <div className="text-xs text-muted-foreground mt-1">{t('إجمالي التقييمات', 'Total Assessments')}</div>
              <div className="text-xs text-muted-foreground">{dashStats.completedAssessments} {t('مكتمل', 'completed')}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="text-2xl font-bold tabular-nums text-emerald-600">
                {dashStats.avgComplianceScore !== null ? `${dashStats.avgComplianceScore}%` : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t('متوسط الامتثال', 'Avg Compliance Score')}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className={`text-2xl font-bold tabular-nums ${dashStats.criticalWarnings > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {dashStats.criticalWarnings}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t('تحذيرات حرجة', 'Critical Warnings')}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="text-2xl font-bold tabular-nums text-blue-600">
                {dashStats.avgSurvivalProbability !== null ? `${dashStats.avgSurvivalProbability}%` : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t('متوسط احتمالية الصمود', 'Avg Judicial Survival')}</div>
            </div>
          </div>
        ) : null}

        {/* Risk Distribution */}
        {dashStats && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              {t('توزيع مستوى المخاطر', 'Risk Level Distribution')}
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {(['critical', 'high', 'moderate', 'low'] as CilRiskLevel[]).map((level) => {
                const rc = riskLevelConfig(level);
                const count = dashStats.byRiskLevel?.[level] ?? 0;
                const total = Object.values(dashStats.byRiskLevel ?? {}).reduce((a: number, b: number) => a + b, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={level} className={`rounded-xl border p-4 text-center ${rc.bg} ${rc.border}`}>
                    <div className={`text-2xl font-bold tabular-nums ${rc.text}`}>{count}</div>
                    <div className={`text-xs font-medium mt-1 ${rc.text}`}>{t(rc.labelAr, rc.labelEn)}</div>
                    <div className="text-xs text-muted-foreground">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Two-column layout: Decisions list + Detail pane ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Decisions List */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              {t('القرارات', 'Decisions')}
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold">{totalDecisions}</span>
            </h2>

            {decisionsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}
              </div>
            ) : decisions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <Scale className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">{t('لا توجد قرارات', 'No decisions found')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {decisions.map((d) => {
                  const rlc = riskLevelConfig(d.overallRiskLevel);
                  const isSelected = selectedDecisionId === d.decisionId;
                  return (
                    <button
                      key={d.decisionId}
                      onClick={() => setSelectedDecisionId(isSelected ? null : d.decisionId)}
                      className={`w-full text-start rounded-xl border p-4 transition-all ${
                        isSelected
                          ? 'border-gold/50 bg-gold/5 ring-1 ring-gold/20'
                          : 'border-border hover:border-border/80 hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">{d.caseNumber}</span>
                            {d.hasCriticalWarning && (
                              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-sm font-medium text-foreground line-clamp-1">{d.titleAr}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{d.organizationUnit}</div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          {d.assessmentStatus === 'completed' ? (
                            <>
                              <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${rlc.bg} ${rlc.text} border ${rlc.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${rlc.dot}`} />
                                {t(rlc.labelAr, rlc.labelEn)}
                              </div>
                              {d.constitutionalComplianceScore !== null && (
                                <span className="text-xs font-bold tabular-nums text-foreground">
                                  {d.constitutionalComplianceScore}%
                                </span>
                              )}
                            </>
                          ) : d.assessmentStatus === 'running' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gold" />
                          ) : d.assessmentStatus === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Warnings preview */}
                      {d.activeWarningCount > 0 && d.assessmentStatus === 'completed' && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gold">
                          <AlertTriangle className="w-3 h-3" />
                          {d.activeWarningCount} {t('تحذير', d.activeWarningCount === 1 ? 'warning' : 'warnings')}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assessment Detail Panel */}
          <div className="lg:col-span-3">
            {selectedDecisionId ? (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 border-b border-border px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gold" />
                    <span className="text-sm font-bold text-foreground">
                      {t('التقييم الدستوري', 'Constitutional Assessment')} #{selectedDecisionId}
                    </span>
                  </div>
                  <button onClick={() => setSelectedDecisionId(null)} className="text-muted-foreground hover:text-foreground transition-colors text-xs">
                    ✕
                  </button>
                </div>
                <div className="p-5">
                  <DecisionAssessmentView
                    decisionId={selectedDecisionId}
                    role={role}
                    userId={userId}
                    org={userOrg}
                    canRun={canRunCilAssessment}
                    canAcknowledge={canAcknowledgeCilWarnings}
                  />
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center h-96 text-muted-foreground gap-3">
                <Scale className="w-12 h-12 opacity-15" />
                <p className="text-sm font-medium">{t('اختر قراراً لعرض تقييمه الدستوري', 'Select a decision to view its constitutional assessment')}</p>
                <p className="text-xs opacity-60">{t('ينتج التقييم 6 مؤشرات و12 مبدأً دستورياً', 'Assessment produces 6 scores and 12 principle analyses')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
