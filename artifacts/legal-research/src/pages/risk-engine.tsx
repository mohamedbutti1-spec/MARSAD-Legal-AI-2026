/**
 * NRME — National Risk Modeling Engine Executive Dashboard
 * ─────────────────────────────────────────────────────────
 * Role-based executive view of national risk across all administrative decisions.
 * Accessible to roles with canViewRiskDashboard = true.
 * M. Al-Shamsi Constitutional Framework™ · MARSAD NRME v1.0
 */
import { apiFetch } from '@/lib/api-fetch';
import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  ShieldAlert, TrendingUp, TrendingDown, BarChart3, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, ChevronRight, Activity, Scale,
  Loader2, XCircle, ArrowUpRight, Fingerprint, Target, FileText,
} from 'lucide-react';
import { useUserContext } from '@/lib/user-context';
import { useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

interface DashboardSummary {
  totalDecisions: number;
  readyAssessments: number;
  avgNationalRiskIndex: number | null;
  avgAdministrativeLegitimacyIndex: number | null;
  avgDecisionConfidenceScore: number | null;
  pendingTreatments: number;
  overdueReviews: number;
}

interface RiskDistribution {
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

interface TopRiskDecision {
  decisionId: number;
  caseNumber: string;
  titleAr: string;
  organizationUnit: string;
  nationalRiskIndex: number;
  riskLevel: RiskLevel;
  topRiskDrivers: string[];
}

interface DashboardData {
  summary: DashboardSummary;
  distribution: RiskDistribution;
  topRisk: TopRiskDecision[];
  role: string;
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

function riskLevelConfig(level: RiskLevel | null | undefined) {
  switch (level) {
    case 'critical': return { label: 'حرج', labelEn: 'Critical', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800/40', dot: 'bg-red-500' };
    case 'high':     return { label: 'عالٍ', labelEn: 'High', bg: 'bg-gold/15 dark:bg-gold/40', text: 'text-gold dark:text-gold/80', border: 'border-gold/25 dark:border-gold/40', dot: 'bg-gold' };
    case 'moderate': return { label: 'متوسط', labelEn: 'Moderate', bg: 'bg-gold/15 dark:bg-gold/40', text: 'text-gold dark:text-gold/80', border: 'border-gold/25 dark:border-gold/40', dot: 'bg-gold' };
    default:         return { label: 'منخفض', labelEn: 'Low', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/40', dot: 'bg-emerald-500' };
  }
}

function indexLabel(key: string): string {
  const map: Record<string, string> = {
    likelihood: 'الاحتمالية', impact: 'الأثر', velocity: 'السرعة',
    detectability: 'قابلية الاكتشاف', controllability: 'قابلية السيطرة',
    nationalSecurityImpact: 'الأثر على الأمن الوطني',
    constitutionalImpact: 'الأثر الدستوري',
    financialImpact: 'الأثر المالي', reputationImpact: 'أثر السمعة',
    publicTrustImpact: 'أثر الثقة العامة', humanRightsImpact: 'أثر حقوق الإنسان',
    aiBiasRisk: 'مخاطر تحيز الذكاء الاصطناعي',
    digitalSovereigntyRisk: 'مخاطر السيادة الرقمية',
    operationalContinuity: 'استمرارية العمليات',
    judicialChallengeProbability: 'احتمالية الطعن القضائي',
  };
  return map[key] ?? key;
}

// ─── Gauge Component ──────────────────────────────────────────────────────────

function GaugeCard({ title, titleEn, value, description, colorClass }: {
  title: string; titleEn: string; value: number | null | undefined;
  description: string; colorClass: string;
}) {
  const t = useT();
  const score = value ?? 0;
  const pct = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="bg-card border border-border/60 rounded-xl p-5 flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
            className="text-border/40" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-700 ${colorClass}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {value != null ? Math.round(score) : '—'}
          </span>
          <span className="text-[9px] text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <div className="text-center space-y-0.5">
        <p className="text-sm font-bold text-foreground">{t(title, titleEn)}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ─── Distribution Bar ─────────────────────────────────────────────────────────

function DistributionBar({ distribution, total }: { distribution: RiskDistribution; total: number }) {
  const t = useT();
  if (total === 0) return null;
  const levels: { key: keyof RiskDistribution; label: string; labelEn: string; color: string }[] = [
    { key: 'critical', label: 'حرج', labelEn: 'Critical', color: 'bg-red-500' },
    { key: 'high',     label: 'عالٍ', labelEn: 'High',    color: 'bg-gold' },
    { key: 'moderate', label: 'متوسط', labelEn: 'Moderate', color: 'bg-gold' },
    { key: 'low',      label: 'منخفض', labelEn: 'Low',    color: 'bg-emerald-500' },
  ];
  return (
    <div className="space-y-3">
      <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
        {levels.map((l) => {
          const pct = (distribution[l.key] / total) * 100;
          if (pct === 0) return null;
          return (
            <div key={l.key} className={`${l.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {levels.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            <span>{t(l.label, l.labelEn)}</span>
            <span className="font-bold text-foreground">{distribution[l.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RiskEngine() {
  const t = useT();
  const { role, userId, userOrg, canViewRiskDashboard, canCreateDecision } = useUserContext();
  const headers = getHeaders(role, userId, userOrg);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['risk-dashboard', role, userOrg],
    queryFn: async () => {
      const res = await apiFetch(`${import.meta.env.BASE_URL}api/risk/dashboard`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: canViewRiskDashboard,
    staleTime: 60_000,
  });

  if (!canViewRiskDashboard) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t('لا تملك صلاحية الوصول إلى لوحة تحكم المخاطر', 'You do not have access to the risk dashboard')}
          </p>
        </div>
      </AppLayout>
    );
  }

  const summary = data?.summary;
  const distribution = data?.distribution;
  const topRisk = data?.topRisk ?? [];

  const avgNri = summary?.avgNationalRiskIndex;
  const nriRiskLevel: RiskLevel =
    avgNri == null ? 'low' :
    avgNri >= 75 ? 'critical' :
    avgNri >= 55 ? 'high' :
    avgNri >= 35 ? 'moderate' : 'low';
  const nriConfig = riskLevelConfig(nriRiskLevel);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-gold" />
              <h1 className="text-xl font-bold text-foreground">
                {t('تقييم المخاطر', 'Risk Assessment')}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              {t(
                'نظام تقييم المخاطر الدستورية والإدارية في الوقت الفعلي — 15 مؤشر مخاطر + 3 مؤشرات مجمعة',
                'Real-time constitutional & administrative risk assessment — 15 risk indices + 3 aggregate scores',
              )}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {t('تحديث', 'Refresh')}
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />
            {t('تعذر تحميل بيانات لوحة التحكم', 'Failed to load dashboard data')}
          </div>
        )}

        {data && (
          <>
            {/* ── 3 Aggregate Score Gauges ─────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <GaugeCard
                title="مؤشر المخاطر الوطني"
                titleEn="National Risk Index"
                value={summary?.avgNationalRiskIndex}
                description={t('متوسط عبر كل القرارات (أعلى = أخطر)', 'Average across all decisions (higher = riskier)')}
                colorClass={
                  nriRiskLevel === 'critical' ? 'text-red-500' :
                  nriRiskLevel === 'high' ? 'text-gold' :
                  nriRiskLevel === 'moderate' ? 'text-gold' : 'text-emerald-500'
                }
              />
              <GaugeCard
                title="مؤشر الشرعية الإدارية"
                titleEn="Administrative Legitimacy Index"
                value={summary?.avgAdministrativeLegitimacyIndex}
                description={t('درجة الامتثال الدستوري والشرعية (أعلى = أفضل)', 'Constitutional compliance score (higher = better)')}
                colorClass={
                  (summary?.avgAdministrativeLegitimacyIndex ?? 0) >= 70 ? 'text-emerald-500' :
                  (summary?.avgAdministrativeLegitimacyIndex ?? 0) >= 50 ? 'text-gold' : 'text-red-500'
                }
              />
              <GaugeCard
                title="درجة ثقة القرار"
                titleEn="Decision Confidence Score"
                value={summary?.avgDecisionConfidenceScore}
                description={t('مستوى الثقة في جودة القرار (أعلى = أفضل)', 'Decision quality confidence (higher = better)')}
                colorClass={
                  (summary?.avgDecisionConfidenceScore ?? 0) >= 70 ? 'text-emerald-500' :
                  (summary?.avgDecisionConfidenceScore ?? 0) >= 50 ? 'text-blue-500' : 'text-gold'
                }
              />
            </div>

            {/* ── Summary Stats Row ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'إجمالي القرارات', labelEn: 'Total Decisions', value: summary?.totalDecisions ?? 0, icon: <FileText className="w-4 h-4" />, color: 'text-blue-500' },
                { label: 'تقييمات جاهزة', labelEn: 'Ready Assessments', value: summary?.readyAssessments ?? 0, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-500' },
                { label: 'معالجات معلقة', labelEn: 'Pending Treatments', value: summary?.pendingTreatments ?? 0, icon: <Target className="w-4 h-4" />, color: 'text-gold' },
                { label: 'مراجعات متأخرة', labelEn: 'Overdue Reviews', value: summary?.overdueReviews ?? 0, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-500' },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border/60 rounded-xl p-4 space-y-2">
                  <div className={`flex items-center gap-2 ${s.color}`}>
                    {s.icon}
                    <span className="text-xs font-medium text-muted-foreground">{t(s.label, s.labelEn)}</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            {/* ── Risk Distribution ─────────────────────────────────────── */}
            {distribution && summary && summary.readyAssessments > 0 && (
              <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground">
                    {t('توزيع مستويات المخاطر', 'Risk Level Distribution')}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    ({summary.readyAssessments} {t('قرار مقيَّم', 'assessed decisions')})
                  </span>
                </div>
                <DistributionBar distribution={distribution} total={summary.readyAssessments} />
              </div>
            )}

            {/* ── Top Risk Decisions ────────────────────────────────────── */}
            {topRisk.length > 0 && (
              <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-gold" />
                    <h2 className="text-sm font-bold text-foreground">
                      {t('القرارات الأعلى خطورة', 'Highest Risk Decisions')}
                    </h2>
                  </div>
                  <Link
                    href="/decisions"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {t('عرض الكل', 'View all')} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-border/40">
                  {topRisk.map((d) => {
                    const cfg = riskLevelConfig(d.riskLevel);
                    return (
                      <Link key={d.decisionId} href={`/decisions/${d.decisionId}`}>
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
                          {/* Risk badge */}
                          <div className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {Math.round(d.nationalRiskIndex)}
                          </div>

                          {/* Decision info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{d.titleAr}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span className="font-mono">{d.caseNumber}</span>
                              <span>·</span>
                              <span className="truncate max-w-[200px]">{d.organizationUnit}</span>
                            </div>
                          </div>

                          {/* Top drivers */}
                          {d.topRiskDrivers && d.topRiskDrivers.length > 0 && (
                            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                              {d.topRiskDrivers.slice(0, 2).map((driver) => (
                                <span key={driver} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                                  {indexLabel(driver)}
                                </span>
                              ))}
                            </div>
                          )}

                          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Al-Shamsi Framework Note ──────────────────────────────── */}
            <div className="bg-gold/10 dark:bg-gold/20 border border-gold/25 dark:border-gold/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-gold dark:text-gold/80" />
                <p className="text-xs font-bold text-gold dark:text-gold/80">
                  {t('إطار الشامسي الدستوري', 'Al-Shamsi Constitutional Framework')}
                </p>
              </div>
              <p className="text-xs text-gold/80 dark:text-gold/80 leading-relaxed">
                {t(
                  'يستند المحرك الوطني للمخاطر إلى 16 بعداً دستورياً وفق نظرية الشامسي، وتُحسب المؤشرات الـ15 استناداً إلى مدى امتثال القرار للمعايير الدستورية الإماراتية ومبادئ الشريعة الإدارية — المادة 25 وما يليها من الدستور الاتحادي، وقانون اتحادي رقم 11 لسنة 2008 في شأن القرارات الإدارية.',
                  'Risk assessment computes 15 risk indices based on 16 Al-Shamsi constitutional dimensions, grounded in UAE Constitution Articles 25+ and Federal Law No. 11 of 2008 on Administrative Decisions.',
                )}
              </p>
            </div>
          </>
        )}

        {/* Empty state */}
        {!isLoading && !isError && data && summary?.totalDecisions === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <ShieldAlert className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {t('لا توجد قرارات لتقييمها بعد', 'No decisions to assess yet')}
            </p>
            {canCreateDecision && (
              <Link href="/decisions/new">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">
                  <FileText className="w-4 h-4" />
                  {t('إنشاء قرار جديد', 'Create new decision')}
                </button>
              </Link>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
