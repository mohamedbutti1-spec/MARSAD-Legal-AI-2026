/**
 * NAIP Director General Dashboard — Org-Scoped View
 * ──────────────────────────────────────────────────
 * Org-scoped KPIs, decisions table, risk distribution, CIL summary.
 *
 * MARSAD NAIP · Director General Dashboard
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  ShieldAlert, FileText, ChevronRight, Loader2, XCircle,
  AlertTriangle, CheckCircle2, Activity, BarChart3,
  Scale, Building2, Target,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
type DecisionStatus = 'draft' | 'active' | 'sealed' | 'archived' | string;

interface DgKpi {
  orgDecisionCount: number;
  avgNriOrg: number | null;
  avgCcsOrg: number | null;
  criticalWarningsOrg: number;
  highRiskCount: number;
  sealedCount: number;
}

interface OrgDecision {
  id: number;
  caseNumber: string;
  titleAr: string;
  status: DecisionStatus;
  riskLevel: RiskLevel | null;
  constitutionalComplianceScore: number | null;
  organizationUnit: string | null;
}

interface RiskDistribution {
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

interface CilDistribution {
  compliant: number;
  minorConcern: number;
  significantConcern: number;
  deficient: number;
}

interface DgData {
  kpi: DgKpi;
  decisions: OrgDecision[];
  riskDistribution: RiskDistribution;
  cilDistribution: CilDistribution;
}

interface OrgStatsData {
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
    case 'critical': return { label: 'حرج', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', bar: 'bg-red-500' };
    case 'high':     return { label: 'عالٍ', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', bar: 'bg-orange-500' };
    case 'moderate': return { label: 'متوسط', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' };
    case 'low':      return { label: 'منخفض', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' };
    default:         return { label: '—', bg: 'bg-muted', text: 'text-muted-foreground', bar: 'bg-muted-foreground' };
  }
}

function truncate(str: string, max: number) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function ccsColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
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

export default function NaipDirectorGeneral() {
  const t = useT();
  const [, navigate] = useLocation();
  const { role, userId, userOrg } = useUserContext();
  const headers = getHeaders(role, userId, userOrg);

  const isAllowed = role === 'director_general' || role === 'owner' || role === 'supervisor';

  const orgName = userOrg || t('المؤسسة', 'Organization');

  const { data, isLoading, isError } = useQuery<DgData>({
    queryKey: ['naip-director-general', role, userOrg],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/executive-data/director_general`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: isAllowed,
    staleTime: 60_000,
  });

  const { data: orgStats } = useQuery<OrgStatsData>({
    queryKey: ['naip-org-stats', role, userOrg],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/stats/org`, { headers });
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
  const decisions = data?.decisions ?? [];
  const riskDist = data?.riskDistribution;
  const cilDist = data?.cilDistribution;
  const totalRisk = riskDist ? (riskDist.critical + riskDist.high + riskDist.moderate + riskDist.low) : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-6 h-6 text-teal-500" />
            <h1 className="text-xl font-bold text-foreground">
              {t('لوحة مدير عام', 'Director General Dashboard')}
            </h1>
            <span className="text-[10px] font-bold tracking-widest text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/40 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800/40">
              مدير عام
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl truncate">
            {truncate(orgName, 80)}
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
            {t('تعذر تحميل البيانات', 'Failed to load data')}
          </div>
        )}

        {/* ── Org KPI Tiles ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile
            labelAr="قرارات المؤسسة"
            labelEn="Org Decisions"
            value={kpi?.orgDecisionCount}
            colorClass="text-blue-600 dark:text-blue-400"
            icon={<FileText className="w-4 h-4" />}
          />
          <StatTile
            labelAr="متوسط NRI"
            labelEn="Avg NRI (Org)"
            value={kpi?.avgNriOrg != null ? Math.round(kpi.avgNriOrg) : null}
            colorClass={
              kpi?.avgNriOrg == null ? 'text-foreground' :
              kpi.avgNriOrg >= 75 ? 'text-red-600 dark:text-red-400' :
              kpi.avgNriOrg >= 50 ? 'text-amber-600 dark:text-amber-400' :
              'text-emerald-600 dark:text-emerald-400'
            }
            icon={<Activity className="w-4 h-4" />}
          />
          <StatTile
            labelAr="متوسط الامتثال الدستوري"
            labelEn="Avg CCS (Org)"
            value={kpi?.avgCcsOrg != null ? Math.round(kpi.avgCcsOrg) : null}
            colorClass="text-emerald-600 dark:text-emerald-400"
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <StatTile
            labelAr="تحذيرات دستورية"
            labelEn="Constitutional Warnings"
            value={kpi?.criticalWarningsOrg}
            colorClass="text-amber-600 dark:text-amber-400"
            icon={<AlertTriangle className="w-4 h-4" />}
          />
        </div>

        {/* ── Decisions Table ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('قرارات المؤسسة', 'Organization Decisions')}</h2>
            </div>
            <Link href="/decisions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {t('عرض الكل', 'View all')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {decisions.length === 0 && !isLoading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('لا توجد قرارات في هذه المؤسسة', 'No decisions for this organization')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-right px-5 py-2 text-xs font-bold text-muted-foreground">رقم القضية</th>
                    <th className="text-right px-4 py-2 text-xs font-bold text-muted-foreground">العنوان</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">الحالة</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">المخاطر</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">CCS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {decisions.map((d) => {
                    const sc = statusConfig(d.status);
                    const rc = riskConfig(d.riskLevel);
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => navigate(`/decisions/${d.id}`)}
                      >
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{d.caseNumber}</td>
                        <td className="px-4 py-3 text-foreground max-w-[200px] truncate">{truncate(d.titleAr, 35)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${sc.bg} ${sc.text}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${rc.bg} ${rc.text}`}>{rc.label}</span>
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

        {/* ── Risk & CIL Distribution ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Risk Distribution */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('توزيع المخاطر', 'Risk Distribution')}</h2>
            </div>
            {riskDist && totalRisk > 0 ? (
              <div className="space-y-2">
                {([
                  { key: 'critical' as const, label: 'حرج', color: 'bg-red-500' },
                  { key: 'high' as const, label: 'عالٍ', color: 'bg-orange-500' },
                  { key: 'moderate' as const, label: 'متوسط', color: 'bg-amber-500' },
                  { key: 'low' as const, label: 'منخفض', color: 'bg-emerald-500' },
                ]).map((l) => {
                  const count = riskDist[l.key];
                  const pct = totalRisk > 0 ? Math.round((count / totalRisk) * 100) : 0;
                  return (
                    <div key={l.key} className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{l.label}</span>
                        <span className="font-bold text-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                        <div className={`h-full ${l.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('لا توجد بيانات', 'No data available')}</p>
            )}
          </div>

          {/* CIL Distribution */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('توزيع الامتثال الدستوري', 'Constitutional Compliance Distribution')}</h2>
            </div>
            {cilDist ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'compliant' as const, label: 'ممتثل', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/40' },
                  { key: 'minorConcern' as const, label: 'قلق بسيط', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/40' },
                  { key: 'significantConcern' as const, label: 'قلق كبير', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-950/40' },
                  { key: 'deficient' as const, label: 'قاصر', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/40' },
                ].map((l) => (
                  <div key={l.key} className={`${l.bg} rounded-lg p-3 text-center`}>
                    <div className={`text-2xl font-bold tabular-nums ${l.color}`}>{cilDist[l.key]}</div>
                    <div className="text-xs text-muted-foreground mt-1">{l.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('لا توجد بيانات', 'No data available')}</p>
            )}
          </div>
        </div>

        {/* ── Action Buttons ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/decisions', icon: <FileText className="w-5 h-5" />, label: 'القرارات', labelEn: 'Decisions', color: 'text-blue-500' },
            { href: '/risk-engine', icon: <Target className="w-5 h-5" />, label: 'محرك المخاطر', labelEn: 'Risk Engine', color: 'text-orange-500' },
            { href: '/constitutional-intelligence', icon: <ShieldAlert className="w-5 h-5" />, label: 'المراجعة الدستورية', labelEn: 'Constitutional Review', color: 'text-purple-500' },
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
