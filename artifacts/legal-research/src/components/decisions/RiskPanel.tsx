/**
 * NRME — Risk Assessment Panel (embedded in Decision Workspace)
 * ──────────────────────────────────────────────────────────────
 * Shows: 3 aggregate gauges, 15 index grid, risk scenarios, treatments.
 * Mounted as the "risk" tab inside DecisionWorkspace.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, RefreshCw, Loader2, XCircle, AlertTriangle, CheckCircle2,
  Plus, Trash2, ShieldAlert, Scale, Target, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useUserContext } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

interface RiskIndexScore {
  score: number;
  reason: string;
  alShamsiDrivers: string[];
  legalCitations: string[];
  delta: number | null;
}

interface RiskIndices {
  likelihood: RiskIndexScore; impact: RiskIndexScore;
  velocity: RiskIndexScore; detectability: RiskIndexScore;
  controllability: RiskIndexScore; nationalSecurityImpact: RiskIndexScore;
  constitutionalImpact: RiskIndexScore; financialImpact: RiskIndexScore;
  reputationImpact: RiskIndexScore; publicTrustImpact: RiskIndexScore;
  humanRightsImpact: RiskIndexScore; aiBiasRisk: RiskIndexScore;
  digitalSovereigntyRisk: RiskIndexScore; operationalContinuity: RiskIndexScore;
  judicialChallengeProbability: RiskIndexScore;
}

interface RiskAssessment {
  id: number; decisionId: number; status: string;
  assessmentVersion: number; calculatedAt: string | null;
  nationalRiskIndex: number | null;
  riskLevel: RiskLevel | null;
  administrativeLegitimacyIndex: number | null;
  decisionConfidenceScore: number | null;
  indices: RiskIndices | null;
  alShamsiMapping: Array<{ dimension: string; riskScore: number; status: string; finding: string; drivesIndices: string[] }> | null;
  executiveSummaryAr: string | null;
  topRiskDrivers: string[] | null;
  immediateRecommendations: string[] | null;
}

interface RiskScenario {
  id: number; titleAr: string; scenarioType: string;
  probability: number | null; severity: string | null;
  descriptionAr: string | null; legalImplication: string | null;
  preventiveActionAr: string | null; primaryDimension: string | null;
}

interface RiskTreatment {
  id: number; titleAr: string; treatmentType: string;
  descriptionAr: string | null; responsibleParty: string | null;
  status: string; expectedReduction: number | null;
  createdBy: string | null;
}

interface RiskData {
  assessment: RiskAssessment | null;
  scenarios: RiskScenario[];
  treatments: RiskTreatment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INDEX_LABELS: Record<string, string> = {
  likelihood: 'الاحتمالية', impact: 'الأثر', velocity: 'السرعة',
  detectability: 'قابلية الاكتشاف', controllability: 'قابلية السيطرة',
  nationalSecurityImpact: 'الأمن الوطني', constitutionalImpact: 'الأثر الدستوري',
  financialImpact: 'الأثر المالي', reputationImpact: 'أثر السمعة',
  publicTrustImpact: 'الثقة العامة', humanRightsImpact: 'حقوق الإنسان',
  aiBiasRisk: 'تحيز الذكاء الاصطناعي', digitalSovereigntyRisk: 'السيادة الرقمية',
  operationalContinuity: 'استمرارية العمليات', judicialChallengeProbability: 'الطعن القضائي',
};

function scoreColor(score: number): string {
  if (score >= 75) return 'text-destructive';
  if (score >= 55) return 'text-gold/80';
  if (score >= 35) return 'text-gold/80';
  return 'text-heading';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-destructive';
  if (score >= 55) return 'bg-gold';
  if (score >= 35) return 'bg-gold';
  return 'bg-heading';
}

function riskLevelBadge(level: RiskLevel | null | undefined) {
  switch (level) {
    case 'critical': return 'bg-destructive/15 dark:bg-destructive/40 text-destructive border-destructive/30 dark:border-destructive/40';
    case 'high':     return 'bg-gold/15 dark:bg-gold/40 text-gold/80 border-gold/25 dark:border-gold/40';
    case 'moderate': return 'bg-gold/15 dark:bg-gold/40 text-gold/80 border-gold/25 dark:border-gold/40';
    default:         return 'bg-heading/10 dark:bg-heading/40 text-heading border-heading/30 dark:border-heading/40';
  }
}

function riskLevelLabel(level: RiskLevel | null | undefined): string {
  const map: Record<string, string> = { critical: 'حرج', high: 'عالٍ', moderate: 'متوسط', low: 'منخفض' };
  return map[level ?? 'low'] ?? 'غير محدد';
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function ScoreGauge({ label, value, inverted = false }: { label: string; value: number | null; inverted?: boolean }) {
  const score = value ?? 0;
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (score / 100) * circumference;
  const colorClass = inverted
    ? (score >= 70 ? 'text-heading' : score >= 50 ? 'text-gold' : 'text-destructive')
    : (score >= 75 ? 'text-destructive' : score >= 55 ? 'text-gold' : score >= 35 ? 'text-gold' : 'text-heading');
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-card border border-border/60 rounded-xl">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="7" className="text-border/40" />
          <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="7"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className={`transition-all duration-700 ${colorClass}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums text-foreground">{value != null ? Math.round(score) : '—'}</span>
          <span className="text-[9px] text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-center text-foreground leading-tight">{label}</p>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function RiskPanel({ decisionId }: { decisionId: number }) {
  const qc = useQueryClient();
  const { role, userId, userOrg, canWriteRiskTreatment, canRecalculateRisk, canUseShamsiFramework } = useUserContext();

  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-id': String(userId),
    'x-user-org': userOrg,
  };

  const { data, isLoading, isError, refetch } = useQuery<RiskData>({
    queryKey: ['risk-assessment', decisionId],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/risk/assessment/${decisionId}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: (query) => {
      const status = (query.state.data as RiskData | undefined)?.assessment?.status;
      return (status === 'pending' || status === 'calculating') ? 3000 : false;
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/risk/assessment/${decisionId}/recalculate`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk-assessment', decisionId] });
    },
  });

  const deleteTreatmentMutation = useMutation({
    mutationFn: async (treatmentId: number) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/risk/treatment/${treatmentId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk-assessment', decisionId] });
    },
  });

  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({ titleAr: '', treatmentType: 'reduce', descriptionAr: '', responsibleParty: '' });
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  const addTreatmentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/risk/treatment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decisionId, ...treatmentForm }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk-assessment', decisionId] });
      setShowAddTreatment(false);
      setTreatmentForm({ titleAr: '', treatmentType: 'reduce', descriptionAr: '', responsibleParty: '' });
    },
  });

  const assessment = data?.assessment;
  const scenarios  = data?.scenarios ?? [];
  const treatments = data?.treatments ?? [];
  const status     = assessment?.status;
  const isPending  = status === 'pending' || status === 'calculating';

  const indices = assessment?.indices;
  const indexEntries = indices
    ? (Object.entries(indices) as [string, RiskIndexScore][]).sort((a, b) => b[1].score - a[1].score)
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gold" />
            <h2 className="text-base font-bold text-foreground">تقييم المخاطر</h2>
            {assessment && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskLevelBadge(assessment.riskLevel)}`}>
                {riskLevelLabel(assessment.riskLevel)}
              </span>
            )}
          </div>
          {assessment?.calculatedAt && (
            <p className="text-xs text-muted-foreground">
              آخر احتساب: {new Date(assessment.calculatedAt).toLocaleString('ar-AE')}
              {assessment.assessmentVersion > 0 && <span className="mr-2 font-mono text-[10px]">v{assessment.assessmentVersion}</span>}
            </p>
          )}
        </div>
        {canRecalculateRisk && (
          <button
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending || isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/25 dark:border-gold/40 bg-gold/10 dark:bg-gold/20 text-gold/80 text-xs font-semibold hover:bg-gold/15 dark:hover:bg-gold/40 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(recalcMutation.isPending || isPending) ? 'animate-spin' : ''}`} />
            إعادة الاحتساب
          </button>
        )}
      </div>

      {/* Status states */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 dark:border-destructive/40 bg-destructive/10 dark:bg-destructive/20 text-sm text-destructive">
          <XCircle className="w-4 h-4 shrink-0" />
          تعذر تحميل بيانات تقييم المخاطر
        </div>
      )}
      {isPending && !isLoading && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-gold/25 dark:border-gold/40 bg-gold/10 dark:bg-gold/20 text-sm text-gold/80">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          جارٍ احتساب مؤشرات المخاطر الوطنية...
        </div>
      )}

      {assessment && !isPending && (
        <>
          {/* 3 Aggregate Gauges */}
          <div className="grid grid-cols-3 gap-3">
            <ScoreGauge label="مؤشر المخاطر الوطني NRI" value={assessment.nationalRiskIndex} />
            <ScoreGauge label="مؤشر الشرعية الإدارية ALI" value={assessment.administrativeLegitimacyIndex} inverted />
            <ScoreGauge label="درجة ثقة القرار DCS" value={assessment.decisionConfidenceScore} inverted />
          </div>

          {/* Executive Summary */}
          {assessment.executiveSummaryAr && (
            <div className="bg-gold/10 dark:bg-gold/20 border border-gold/25 dark:border-gold/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-gold/80" />
                <p className="text-xs font-bold text-gold/80">ملخص تنفيذي — تقييم المخاطر الدستورية</p>
              </div>
              <p className="text-xs text-gold/80 leading-relaxed">{assessment.executiveSummaryAr}</p>
            </div>
          )}

          {/* 15 Risk Indices Grid */}
          {indexEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">مؤشرات المخاطر الـ15</h3>
              <div className="space-y-1.5">
                {indexEntries.map(([key, val]) => (
                  <div key={key} className="bg-card border border-border/60 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedIndex(expandedIndex === key ? null : key)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-right"
                    >
                      {/* Score bar */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">{INDEX_LABELS[key] ?? key}</span>
                          <span className={`text-sm font-bold tabular-nums ${scoreColor(val.score)}`}>{Math.round(val.score)}</span>
                        </div>
                        <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${scoreBg(val.score)}`}
                            style={{ width: `${val.score}%` }}
                          />
                        </div>
                      </div>
                      {expandedIndex === key
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      }
                    </button>
                    {expandedIndex === key && (
                      <div className="px-4 pb-3 pt-1 border-t border-border/40 space-y-2 bg-muted/10">
                        <p className="text-xs text-muted-foreground leading-relaxed">{val.reason}</p>
                        {val.legalCitations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {val.legalCitations.map((c) => (
                              <span key={c} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-heading/10 dark:bg-heading/30 text-heading border border-heading/30 dark:border-heading/40">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        {canUseShamsiFramework && val.alShamsiDrivers.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">أبعاد الشامسي:</span>
                            {val.alShamsiDrivers.map((d) => (
                              <span key={d} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gold/10 dark:bg-gold/30 text-gold/80 border border-gold/25 dark:border-gold/40">
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Immediate Recommendations */}
          {assessment.immediateRecommendations && assessment.immediateRecommendations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">التوصيات الفورية</h3>
              <ul className="space-y-1.5">
                {assessment.immediateRecommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Scenarios */}
          {scenarios.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">سيناريوهات المخاطر</h3>
              <div className="space-y-2">
                {scenarios.map((s) => (
                  <div key={s.id} className="bg-card border border-border/60 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{s.titleAr}</p>
                      {s.severity && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          s.severity === 'critical' ? 'bg-destructive/10 dark:bg-destructive/30 text-destructive border-destructive/30 dark:border-destructive/40' :
                          s.severity === 'high' ? 'bg-gold/10 dark:bg-gold/30 text-gold/80 border-gold/25 dark:border-gold/40' :
                          'bg-gold/10 dark:bg-gold/30 text-gold/80 border-gold/25 dark:border-gold/40'
                        }`}>
                          {s.probability != null ? `${Math.round(s.probability)}% ` : ''}{s.severity}
                        </span>
                      )}
                    </div>
                    {s.descriptionAr && <p className="text-xs text-muted-foreground">{s.descriptionAr}</p>}
                    {s.preventiveActionAr && (
                      <div className="flex items-start gap-1.5 text-xs text-heading">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {s.preventiveActionAr}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Treatments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                إجراءات المعالجة ({treatments.length})
              </h3>
              {canWriteRiskTreatment && (
                <button
                  onClick={() => setShowAddTreatment(!showAddTreatment)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold/80 hover:text-gold dark:hover:text-gold/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة إجراء
                </button>
              )}
            </div>

            {/* Add Treatment Form */}
            {showAddTreatment && (
              <div className="bg-card border border-gold/25 dark:border-gold/40 rounded-lg p-4 space-y-3">
                <input
                  value={treatmentForm.titleAr}
                  onChange={(e) => setTreatmentForm((f) => ({ ...f, titleAr: e.target.value }))}
                  placeholder="عنوان الإجراء (بالعربي)"
                  className="w-full text-xs rounded-lg border border-border/60 bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/80"
                />
                <select
                  value={treatmentForm.treatmentType}
                  onChange={(e) => setTreatmentForm((f) => ({ ...f, treatmentType: e.target.value }))}
                  className="w-full text-xs rounded-lg border border-border/60 bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gold/80"
                >
                  <option value="avoid">تجنب</option>
                  <option value="reduce">تقليل</option>
                  <option value="transfer">نقل</option>
                  <option value="accept">قبول</option>
                  <option value="monitor">مراقبة</option>
                </select>
                <input
                  value={treatmentForm.responsibleParty}
                  onChange={(e) => setTreatmentForm((f) => ({ ...f, responsibleParty: e.target.value }))}
                  placeholder="الجهة المسؤولة"
                  className="w-full text-xs rounded-lg border border-border/60 bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/80"
                />
                <textarea
                  value={treatmentForm.descriptionAr}
                  onChange={(e) => setTreatmentForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                  placeholder="وصف الإجراء"
                  rows={2}
                  className="w-full text-xs rounded-lg border border-border/60 bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/80 resize-none"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setShowAddTreatment(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={() => addTreatmentMutation.mutate()}
                    disabled={!treatmentForm.titleAr || addTreatmentMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold transition-colors disabled:opacity-60"
                  >
                    {addTreatmentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    حفظ
                  </button>
                </div>
              </div>
            )}

            {/* Treatment List */}
            {treatments.length === 0 && !showAddTreatment && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                لا توجد إجراءات معالجة بعد
              </p>
            )}
            {treatments.map((t) => (
              <div key={t.id} className="flex items-start gap-3 bg-card border border-border/60 rounded-lg px-4 py-3">
                <Target className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-foreground">{t.titleAr}</p>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 border border-border/40">
                      {t.treatmentType}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      t.status === 'completed' ? 'bg-heading/10 dark:bg-heading/30 text-heading border-heading/30 dark:border-heading/40' :
                      t.status === 'in_progress' ? 'bg-heading/10 dark:bg-heading/30 text-heading border-heading/30 dark:border-heading/40' :
                      'bg-muted/50 text-muted-foreground border-border/40'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  {t.descriptionAr && <p className="text-xs text-muted-foreground mt-1">{t.descriptionAr}</p>}
                  {t.responsibleParty && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">المسؤول: {t.responsibleParty}</p>
                  )}
                </div>
                {canWriteRiskTreatment && (
                  <button
                    onClick={() => deleteTreatmentMutation.mutate(t.id)}
                    disabled={deleteTreatmentMutation.isPending}
                    className="shrink-0 p-1 rounded hover:bg-destructive/10 dark:hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
