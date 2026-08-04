/**
 * NAIP Risk Officer Dashboard — NRME-Focused View
 * ─────────────────────────────────────────────────
 * National Risk Modeling Engine executive view for risk officers.
 * SVG circular gauges, 4-quadrant grid, critical decisions list.
 *
 * MARSAD NAIP · Risk Officer Dashboard
 */
import { apiFetch } from '@/lib/api-fetch';
import React from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  ShieldAlert, AlertTriangle, FileText, ChevronRight,
  Loader2, XCircle, Activity, BarChart3, Target,
  TrendingDown, TrendingUp, Scale, CheckCircle2,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

interface RiskOfficerKpi {
  avgNationalRiskIndex: number | null;
  avgAdministrativeLegitimacyIndex: number | null;
  avgDecisionConfidenceScore: number | null;
  totalDecisions: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  treatmentRate: number | null;
  criticalWithTreatment: number;
  criticalWithoutTreatment: number;
}

interface CriticalDecision {
  id: number;
  decisionId: number;
  caseNumber: string;
  titleAr: string;
  organizationUnit: string | null;
  nationalRiskIndex: number;
  riskLevel: RiskLevel;
}

interface RiskOfficerData {
  kpi: RiskOfficerKpi;
  criticalDecisions: CriticalDecision[];
}

interface KpiData {
  [key: string]: unknown;
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

function truncate(str: string, max: number) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ─── SVG Circular Gauge ───────────────────────────────────────────────────────

function GaugeCard({
  title, titleEn, value, description, colorClass,
}: {
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

// ─── Quadrant Card ────────────────────────────────────────────────────────────

function QuadrantCard({
  label, count, total, colorClass, bgClass,
}: {
  label: string; count: number; total: number; colorClass: string; bgClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`${bgClass} rounded-xl p-4 flex flex-col gap-2`}>
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={`text-3xl font-bold tabular-nums ${colorClass}`}>{count}</span>
      <span className="text-xs text-muted-foreground">{pct}% {total > 0 ? `من ${total}` : ''}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NaipRiskOfficer() {
  const t = useT();
  const [, navigate] = useLocation();
  const { role, userId, userOrg, canViewRiskDashboard } = useUserContext();
  const headers = getHeaders(role, userId, userOrg);

  // Permission guard: canViewRiskDashboard required
  const isAllowed = canViewRiskDashboard;

  const { data, isLoading, isError } = useQuery<RiskOfficerData>({
    queryKey: ['naip-risk-officer', role, userOrg],
    queryFn: async () => {
      const res = await apiFetch(`${import.meta.env.BASE_URL}api/naip/executive-data/risk_officer`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: isAllowed,
    staleTime: 60_000,
  });

  const { data: kpiData } = useQuery<KpiData>({
    queryKey: ['naip-kpi', role, userOrg],
    queryFn: async () => {
      const res = await apiFetch(`${import.meta.env.BASE_URL}api/naip/kpi`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: isAllowed,
    staleTime: 60_000,
  });

  if (!isAllowed) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground">غير مصرح بالوصول</h2>
          <p className="text-sm text-muted-foreground mt-1">هذه اللوحة مخصصة لدور محدد</p>
        </div>
      </AppLayout>
    );
  }

  const kpi = data?.kpi;
  const criticalDecisions = data?.criticalDecisions ?? [];
  const total = kpi ? (kpi.criticalCount + kpi.highCount + kpi.moderateCount + kpi.lowCount) : 0;

  // NRI color: high NRI = red (risk is bad)
  const nriColor = kpi?.avgNationalRiskIndex == null ? 'text-muted-foreground' :
    kpi.avgNationalRiskIndex >= 75 ? 'text-red-500' :
    kpi.avgNationalRiskIndex >= 50 ? 'text-gold' :
    kpi.avgNationalRiskIndex >= 35 ? 'text-gold' : 'text-emerald-500';

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="w-6 h-6 text-red-500" />
            <h1 className="text-xl font-bold text-foreground">
              {t('لوحة مسؤول المخاطر الوطني', 'National Risk Officer Dashboard')}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground max-w-lg">
            {t('تقييم المخاطر الوطنية والدستورية — 15 مؤشر مخاطر + 3 مؤشرات مجمعة', 'National & constitutional risk assessment — 15 indices + 3 aggregates')}
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />
            {t('تعذر تحميل بيانات المخاطر', 'Failed to load risk data')}
          </div>
        )}

        {/* ── 3 Primary KPI Gauges ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GaugeCard
            title="مؤشر المخاطر الوطني"
            titleEn="National Risk Index"
            value={kpi?.avgNationalRiskIndex}
            description={t('أعلى = أخطر · معدل وطني', 'Higher = riskier · national average')}
            colorClass={nriColor}
          />
          <GaugeCard
            title="مؤشر الشرعية الإدارية"
            titleEn="Administrative Legitimacy Index"
            value={kpi?.avgAdministrativeLegitimacyIndex}
            description={t('أعلى = شرعية أفضل', 'Higher = better legitimacy')}
            colorClass={
              (kpi?.avgAdministrativeLegitimacyIndex ?? 0) >= 70 ? 'text-emerald-500' :
              (kpi?.avgAdministrativeLegitimacyIndex ?? 0) >= 50 ? 'text-gold' : 'text-red-500'
            }
          />
          <GaugeCard
            title="درجة ثقة القرار"
            titleEn="Decision Confidence Score"
            value={kpi?.avgDecisionConfidenceScore}
            description={t('أعلى = ثقة أفضل', 'Higher = better confidence')}
            colorClass={
              (kpi?.avgDecisionConfidenceScore ?? 0) >= 70 ? 'text-blue-500' :
              (kpi?.avgDecisionConfidenceScore ?? 0) >= 50 ? 'text-gold' : 'text-gold'
            }
          />
        </div>

        {/* ── 4-Quadrant Risk Grid ─────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">{t('توزيع المخاطر الوطني', 'National Risk Distribution')}</h2>
            {total > 0 && (
              <span className="text-xs text-muted-foreground">({total} {t('قرار', 'decisions')})</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuadrantCard label="حرج" count={kpi?.criticalCount ?? 0} total={total}
              colorClass="text-red-600 dark:text-red-400" bgClass="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40" />
            <QuadrantCard label="عالٍ" count={kpi?.highCount ?? 0} total={total}
              colorClass="text-gold dark:text-gold/80" bgClass="bg-gold/10 dark:bg-gold/20 border border-gold/25 dark:border-gold/40" />
            <QuadrantCard label="متوسط" count={kpi?.moderateCount ?? 0} total={total}
              colorClass="text-gold dark:text-gold/80" bgClass="bg-gold/10 dark:bg-gold/20 border border-gold/25 dark:border-gold/40" />
            <QuadrantCard label="منخفض" count={kpi?.lowCount ?? 0} total={total}
              colorClass="text-emerald-600 dark:text-emerald-400" bgClass="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40" />
          </div>
        </div>

        {/* ── Treatment Rate ───────────────────────────────────────────────── */}
        {kpi?.criticalCount != null && kpi.criticalCount > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('معدل معالجة المخاطر الحرجة', 'Critical Risk Treatment Rate')}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('تمت المعالجة', 'Treated')}</span>
                  <span className="font-bold text-foreground">
                    {kpi.treatmentRate != null ? `${Math.round(kpi.treatmentRate)}%` : '—'}
                  </span>
                </div>
                <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${kpi.treatmentRate ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-emerald-500 tabular-nums">{kpi.criticalWithTreatment ?? 0}</span>
                  <span className="text-[10px] text-muted-foreground">{t('معالج', 'treated')}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-red-500 tabular-nums">{kpi.criticalWithoutTreatment ?? 0}</span>
                  <span className="text-[10px] text-muted-foreground">{t('غير معالج', 'untreated')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Critical Risk Decisions ──────────────────────────────────────── */}
        {criticalDecisions.length > 0 && (
          <div className="bg-card border border-red-200 dark:border-red-800/40 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-bold text-red-700 dark:text-red-400">
                  {t('القرارات ذات المخاطر الحرجة', 'Critical Risk Decisions')}
                </h2>
                <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-bold">
                  {criticalDecisions.length}
                </span>
              </div>
              <Link href="/risk-engine" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                {t('محرك المخاطر', 'Risk Engine')} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border/40">
              {criticalDecisions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/decisions/${d.decisionId}`)}
                >
                  {/* NRI Score Badge */}
                  <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {Math.round(d.nationalRiskIndex)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{d.titleAr}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{d.caseNumber}</span>
                      {d.organizationUnit && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[180px]">{d.organizationUnit}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Links ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/risk-engine', icon: <Activity className="w-5 h-5" />, label: 'تقييم المخاطر', labelEn: 'Risk Assessment', color: 'text-red-500' },
            { href: '/constitutional-intelligence', icon: <Scale className="w-5 h-5" />, label: 'المراجعة الدستورية', labelEn: 'Constitutional Review', color: 'text-purple-500' },
            { href: '/decisions', icon: <FileText className="w-5 h-5" />, label: 'جميع القرارات', labelEn: 'All Decisions', color: 'text-blue-500' },
          ].map((a) => (
            <Link key={a.href} href={a.href}>
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-foreground/30 hover:bg-muted/30 cursor-pointer transition-colors text-center">
                <span className={a.color}>{a.icon}</span>
                <span className="text-xs font-semibold text-foreground">{t(a.label, a.labelEn)}</span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}
