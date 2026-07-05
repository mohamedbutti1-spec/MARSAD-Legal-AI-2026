/**
 * NAIP Judge Dashboard — Judicial Review Focus
 * ──────────────────────────────────────────────
 * Sealed decisions priority, JSP gauge, CIL assessments,
 * constitutional warnings relevant to judicial review.
 *
 * MARSAD NAIP · Judge Dashboard
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  ShieldAlert, FileText, ChevronRight, Loader2, XCircle,
  AlertTriangle, CheckCircle2, Gavel, Scale, Activity,
  BarChart3, BookOpen, ArrowUpRight,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
type DecisionStatus = 'draft' | 'active' | 'sealed' | 'archived' | string;

interface JudgeKpi {
  sealedCount: number;
  avgJudicialSurvivalProbability: number | null;
  completedCilCount: number;
  criticalWarningCount: number;
  avgConstitutionalComplianceScore: number | null;
}

interface SealedDecision {
  id: number;
  caseNumber: string;
  titleAr: string;
  organizationUnit: string | null;
  status: DecisionStatus;
  judicialSurvivalProbability: number | null;
  constitutionalComplianceScore: number | null;
  riskLevel: RiskLevel | null;
}

interface CilAssessment {
  id: number;
  decisionId: number;
  caseNumber: string;
  titleAr: string;
  constitutionalComplianceScore: number | null;
  judicialSurvivalProbability: number | null;
  overallRiskLevel: RiskLevel | null;
  hasCriticalWarning: boolean;
}

interface JudgeCilWarning {
  id: number;
  decisionId: number;
  caseNumber: string;
  warningCode: string;
  titleAr: string;
  severity: 'critical' | 'warning' | 'advisory';
  constitutionalRef: string | null;
}

interface JudgeData {
  kpi: JudgeKpi;
  sealedDecisions: SealedDecision[];
  cilAssessments: CilAssessment[];
  criticalWarnings: JudgeCilWarning[];
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

function statusConfig(status: DecisionStatus) {
  switch (status) {
    case 'sealed':   return { label: 'مختوم', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' };
    case 'active':   return { label: 'نشط', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' };
    case 'draft':    return { label: 'مسودة', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' };
    case 'archived': return { label: 'مؤرشف', bg: 'bg-muted', text: 'text-muted-foreground' };
    default:         return { label: status, bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

function riskConfig(level: RiskLevel | null | undefined) {
  switch (level) {
    case 'critical': return { label: 'حرج', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400' };
    case 'high':     return { label: 'عالٍ', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400' };
    case 'moderate': return { label: 'متوسط', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' };
    case 'low':      return { label: 'منخفض', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' };
    default:         return { label: '—', bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

function truncate(str: string, max: number) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function jspColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function jspGaugeColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 70) return 'text-emerald-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function ccsColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ─── JSP Gauge ────────────────────────────────────────────────────────────────

function JspGauge({ value }: { value: number | null | undefined }) {
  const t = useT();
  const score = value ?? 0;
  const pct = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (pct / 100) * circumference;
  const colorClass = jspGaugeColor(value ?? null);

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <Gavel className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-bold text-foreground">{t('احتمالية النجاة القضائية', 'Judicial Survival Probability')}</h2>
      </div>
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
            className="text-border/40" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-700 ${colorClass}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold tabular-nums ${jspColor(value ?? null)}`}>
            {value != null ? Math.round(score) : '—'}
          </span>
          <span className="text-xs text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className={`text-sm font-bold ${jspColor(value ?? null)}`}>
          {value == null ? '—' :
           score >= 70 ? t('احتمالية نجاة عالية', 'High Survival Probability') :
           score >= 40 ? t('احتمالية نجاة متوسطة', 'Moderate Survival Probability') :
           t('احتمالية نجاة منخفضة', 'Low Survival Probability')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('متوسط عبر القرارات المختومة', 'Average across sealed decisions')}
        </p>
      </div>
    </div>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({ labelAr, labelEn, value, colorClass, icon }: {
  labelAr: string; labelEn: string; value: number | string | null | undefined;
  colorClass?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className={colorClass ?? 'text-muted-foreground'}>{icon}</span>}
        <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">{labelAr}</div>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${colorClass ?? 'text-foreground'}`}>{value ?? '—'}</div>
      <div className="text-xs text-muted-foreground mt-1">{labelEn}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NaipJudge() {
  const t = useT();
  const [, navigate] = useLocation();
  const { role, userId, userOrg } = useUserContext();
  const headers = getHeaders(role, userId, userOrg);

  const isAllowed = role === 'judge' || role === 'owner' || role === 'supervisor';

  const { data, isLoading, isError } = useQuery<JudgeData>({
    queryKey: ['naip-judge', role, userOrg],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/executive-data/judge`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: isAllowed,
    staleTime: 60_000,
  });

  const { data: kpiData } = useQuery<KpiData>({
    queryKey: ['naip-kpi', role, userOrg],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/kpi`, { headers });
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
  const sealedDecisions = data?.sealedDecisions ?? [];
  const cilAssessments = data?.cilAssessments ?? [];
  const criticalWarnings = data?.criticalWarnings ?? [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Gavel className="w-6 h-6 text-violet-500" />
            <h1 className="text-xl font-bold text-foreground">
              {t('لوحة القاضي', 'Judge Dashboard')}
            </h1>
            <span className="text-[10px] font-bold tracking-widest text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800/40">
              قضائي
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-lg">
            {t('مراجعة القرارات المختومة والتقييم الدستوري القضائي — إطار الشامسي', 'Sealed decision review and judicial constitutional assessment — Al-Shamsi Framework')}
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
            {t('تعذر تحميل البيانات القضائية', 'Failed to load judicial data')}
          </div>
        )}

        {/* ── Top Row: JSP Gauge + Sealed Summary ─────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <JspGauge value={kpi?.avgJudicialSurvivalProbability} />

          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-4">
            <StatTile
              labelAr="القرارات المختومة"
              labelEn="Sealed Decisions"
              value={kpi?.sealedCount}
              colorClass="text-blue-600 dark:text-blue-400"
              icon={<FileText className="w-4 h-4" />}
            />
            <StatTile
              labelAr="تقييمات CIL مكتملة"
              labelEn="Completed CIL Assessments"
              value={kpi?.completedCilCount}
              colorClass="text-emerald-600 dark:text-emerald-400"
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
            <StatTile
              labelAr="متوسط الامتثال الدستوري"
              labelEn="Avg Constitutional Compliance"
              value={kpi?.avgConstitutionalComplianceScore != null ? Math.round(kpi.avgConstitutionalComplianceScore) : null}
              colorClass="text-violet-600 dark:text-violet-400"
              icon={<Scale className="w-4 h-4" />}
            />
            <StatTile
              labelAr="تحذيرات حرجة"
              labelEn="Critical Warnings"
              value={kpi?.criticalWarningCount}
              colorClass="text-red-600 dark:text-red-400"
              icon={<AlertTriangle className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* ── CIL Constitutional Assessments ──────────────────────────────── */}
        {cilAssessments.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-bold text-foreground">{t('التقييمات الدستورية المكتملة', 'Completed Constitutional Assessments')}</h2>
              </div>
              <Link href="/constitutional-intelligence" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                {t('CIL', 'CIL Dashboard')} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border/40">
              {cilAssessments.slice(0, 8).map((a) => {
                const rc = riskConfig(a.overallRiskLevel);
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/decisions/${a.decisionId}`)}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0 w-28 truncate">{a.caseNumber}</span>
                    <span className="flex-1 text-sm text-foreground truncate">{truncate(a.titleAr, 35)}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">CCS:</span>
                      <span className={`text-xs font-bold tabular-nums ${ccsColor(a.constitutionalComplianceScore)}`}>
                        {a.constitutionalComplianceScore != null ? Math.round(a.constitutionalComplianceScore) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">JSP:</span>
                      <span className={`text-xs font-bold tabular-nums ${jspColor(a.judicialSurvivalProbability)}`}>
                        {a.judicialSurvivalProbability != null ? Math.round(a.judicialSurvivalProbability) : '—'}
                      </span>
                    </div>
                    {a.hasCriticalWarning && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${rc.bg} ${rc.text}`}>{rc.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Sealed Decisions List ────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('القرارات المختومة', 'Sealed Decisions')}</h2>
            </div>
            <Link href="/decisions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {t('عرض الكل', 'View all')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {sealedDecisions.length === 0 && !isLoading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('لا توجد قرارات مختومة', 'No sealed decisions found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-right px-5 py-2 text-xs font-bold text-muted-foreground">رقم القضية</th>
                    <th className="text-right px-4 py-2 text-xs font-bold text-muted-foreground">العنوان</th>
                    <th className="text-right px-4 py-2 text-xs font-bold text-muted-foreground hidden sm:table-cell">المؤسسة</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">الحالة</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">JSP</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">CCS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sealedDecisions.map((d) => {
                    const sc = statusConfig(d.status);
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => navigate(`/decisions/${d.id}`)}
                      >
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{d.caseNumber}</td>
                        <td className="px-4 py-3 text-foreground max-w-[160px] truncate">{truncate(d.titleAr, 30)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate hidden sm:table-cell">
                          {truncate(d.organizationUnit ?? '', 25)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${sc.bg} ${sc.text}`}>{sc.label}</span>
                        </td>
                        <td className={`px-4 py-3 text-center font-bold tabular-nums ${jspColor(d.judicialSurvivalProbability)}`}>
                          {d.judicialSurvivalProbability != null ? Math.round(d.judicialSurvivalProbability) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-center font-bold tabular-nums ${ccsColor(d.constitutionalComplianceScore)}`}>
                          {d.constitutionalComplianceScore != null ? Math.round(d.constitutionalComplianceScore) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── CIL Warnings for Judicial Review ────────────────────────────── */}
        {criticalWarnings.length > 0 && (
          <div className="bg-card border border-red-200 dark:border-red-800/40 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-red-700 dark:text-red-400">
                {t('تحذيرات دستورية تؤثر على المراجعة القضائية', 'Constitutional Warnings Affecting Judicial Review')}
              </h2>
              <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-bold ml-auto">
                {criticalWarnings.length}
              </span>
            </div>
            <div className="divide-y divide-border/40">
              {criticalWarnings.map((w) => (
                <Link key={w.id} href={`/decisions/${w.decisionId}`}>
                  <div className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors">
                    <span className="text-[10px] font-mono text-red-500 font-bold shrink-0 mt-0.5">{w.warningCode}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{w.titleAr}</p>
                      {w.constitutionalRef && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{w.constitutionalRef}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{w.caseNumber}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Links ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/constitutional-intelligence', icon: <Scale className="w-5 h-5" />, label: 'الذكاء الدستوري', labelEn: 'Constitutional Intelligence', color: 'text-violet-500' },
            { href: '/decisions', icon: <FileText className="w-5 h-5" />, label: 'جميع القرارات', labelEn: 'All Decisions', color: 'text-blue-500' },
            { href: '/governance', icon: <BarChart3 className="w-5 h-5" />, label: 'مركز الحوكمة', labelEn: 'Governance Hub', color: 'text-emerald-500' },
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
