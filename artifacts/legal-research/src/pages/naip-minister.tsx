/**
 * NAIP Minister Dashboard — Executive Summary
 * ─────────────────────────────────────────────
 * Highest-level overview for the Minister role.
 * Shows 6 KPI tiles, recent decisions, critical warnings, and quick actions.
 *
 * MARSAD NAIP · Minister Executive Dashboard
 */
import { apiFetch } from '@/lib/api-fetch';
import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  ShieldAlert,
  AlertTriangle,
  FileText,
  Scale,
  CheckCircle2,
  Users,
  ChevronRight,
  Loader2,
  XCircle,
  Activity,
  BarChart3,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Gavel } from '@/components/icons/gavel';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
type DecisionStatus = 'draft' | 'active' | 'sealed' | 'archived' | string;

interface MinisterKpi {
  totalDecisions: number;
  criticalRiskCount: number;
  activeConstitutionalWarnings: number;
  avgNationalRiskIndex: number | null;
  avgConstitutionalCompliance: number | null;
  humanOversightQueueCount: number;
  humanOversightUrgent: number;
}

interface RecentDecision {
  id: number;
  caseNumber: string;
  titleAr: string;
  status: DecisionStatus;
  riskLevel: RiskLevel | null;
  organizationUnit: string | null;
}

interface CriticalWarning {
  id: number;
  decisionId: number;
  caseNumber: string;
  titleAr: string;
  warningCode: string;
  severity: 'critical' | 'warning' | 'advisory';
}

interface MinisterData {
  kpi: MinisterKpi;
  recentDecisions: RecentDecision[];
  criticalWarnings: CriticalWarning[];
}

interface OverviewData {
  totalDecisions: number;
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
    case 'draft':    return { label: 'مسودة', bg: 'bg-gold/15 dark:bg-gold/40', text: 'text-gold dark:text-gold/80' };
    case 'archived': return { label: 'مؤرشف', bg: 'bg-muted', text: 'text-muted-foreground' };
    default:         return { label: status, bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

function riskConfig(level: RiskLevel | null | undefined) {
  switch (level) {
    case 'critical': return { label: 'حرج', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400' };
    case 'high':     return { label: 'عالٍ', bg: 'bg-gold/15 dark:bg-gold/40', text: 'text-gold dark:text-gold/80' };
    case 'moderate': return { label: 'متوسط', bg: 'bg-gold/15 dark:bg-gold/40', text: 'text-gold dark:text-gold/80' };
    case 'low':      return { label: 'منخفض', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' };
    default:         return { label: '—', bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

function truncate(str: string, max: number) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  labelAr, labelEn, value, colorClass, icon,
}: {
  labelAr: string; labelEn: string; value: number | string | null | undefined;
  colorClass?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className={colorClass ?? 'text-muted-foreground'}>{icon}</span>}
        <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">{labelAr}</div>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${colorClass ?? 'text-foreground'}`}>
        {value ?? '—'}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{labelEn}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NaipMinister() {
  const t = useT();
  const { role, userId, userOrg } = useUserContext();
  const headers = getHeaders(role, userId, userOrg);

  // Permission guard: minister, owner, or supervisor
  const isAllowed = role === 'minister' || role === 'owner' || role === 'supervisor';

  const { data, isLoading, isError } = useQuery<MinisterData>({
    queryKey: ['naip-minister', role, userOrg],
    queryFn: async () => {
      const res = await apiFetch(`${import.meta.env.BASE_URL}api/naip/executive-data/minister`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: isAllowed,
    staleTime: 60_000,
  });

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ['naip-overview', role, userOrg],
    queryFn: async () => {
      const res = await apiFetch(`${import.meta.env.BASE_URL}api/naip/overview`, { headers });
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
  const recentDecisions = data?.recentDecisions ?? [];
  const criticalWarnings = data?.criticalWarnings ?? [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Scale className="w-6 h-6 text-blue-500" />
              <h1 className="text-xl font-bold text-foreground">
                {t('مرحباً بمعالي الوزير', 'Welcome, Minister')}
              </h1>
              <span className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/40">
                وزير
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              {t('الملخص التنفيذي للقرارات الإدارية والمخاطر الدستورية الوطنية', 'Executive summary of administrative decisions and national constitutional risks')}
            </p>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {isError && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />
            {t('تعذر تحميل البيانات التنفيذية', 'Failed to load executive data')}
          </div>
        )}

        {/* ── 6 KPI Tiles ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatTile
            labelAr="إجمالي القرارات"
            labelEn="Total Decisions"
            value={kpi?.totalDecisions ?? overview?.totalDecisions}
            colorClass="text-blue-600 dark:text-blue-400"
            icon={<FileText className="w-4 h-4" />}
          />
          <StatTile
            labelAr="القرارات الحرجة"
            labelEn="Critical Risk"
            value={kpi?.criticalRiskCount}
            colorClass="text-red-600 dark:text-red-400"
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <StatTile
            labelAr="تحذيرات دستورية نشطة"
            labelEn="Active Constitutional Warnings"
            value={kpi?.activeConstitutionalWarnings}
            colorClass="text-gold dark:text-gold/80"
            icon={<ShieldAlert className="w-4 h-4" />}
          />
          <StatTile
            labelAr="متوسط مؤشر المخاطر الوطني"
            labelEn="Avg National Risk Index (NRI)"
            value={kpi?.avgNationalRiskIndex != null ? Math.round(kpi.avgNationalRiskIndex) : null}
            colorClass={
              kpi?.avgNationalRiskIndex == null ? 'text-foreground' :
              kpi.avgNationalRiskIndex >= 75 ? 'text-red-600 dark:text-red-400' :
              kpi.avgNationalRiskIndex >= 50 ? 'text-gold dark:text-gold/80' :
              'text-emerald-600 dark:text-emerald-400'
            }
            icon={<Activity className="w-4 h-4" />}
          />
          <StatTile
            labelAr="متوسط الامتثال الدستوري"
            labelEn="Avg Constitutional Compliance"
            value={kpi?.avgConstitutionalCompliance != null ? Math.round(kpi.avgConstitutionalCompliance) : null}
            colorClass="text-emerald-600 dark:text-emerald-400"
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-600 dark:text-purple-400"><Users className="w-4 h-4" /></span>
              <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">طابور الرقابة البشرية</div>
            </div>
            <div className="text-3xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
              {kpi?.humanOversightQueueCount ?? '—'}
            </div>
            {kpi?.humanOversightUrgent != null && kpi.humanOversightUrgent > 0 && (
              <div className="text-xs text-red-500 font-semibold mt-1">
                {kpi.humanOversightUrgent} {t('عاجل', 'urgent')}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">Human Oversight Queue</div>
          </div>
        </div>

        {/* ── Recent Decisions ────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('أحدث القرارات', 'Recent Decisions')}</h2>
            </div>
            <Link href="/decisions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {t('عرض الكل', 'View all')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentDecisions.length === 0 && !isLoading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('لا توجد قرارات حديثة', 'No recent decisions')}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentDecisions.slice(0, 8).map((d) => {
                const sc = statusConfig(d.status);
                const rc = riskConfig(d.riskLevel);
                return (
                  <Link key={d.id} href={`/decisions/${d.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors">
                      <span className="font-mono text-xs text-muted-foreground shrink-0 w-28 truncate">{d.caseNumber}</span>
                      <span className="flex-1 text-sm text-foreground truncate">{truncate(d.titleAr, 30)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${sc.bg} ${sc.text}`}>{sc.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${rc.bg} ${rc.text}`}>{rc.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Critical Warnings ───────────────────────────────────────────── */}
        {criticalWarnings.length > 0 && (
          <div className="bg-card border border-red-200 dark:border-red-800/40 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-red-700 dark:text-red-400">
                {t('التحذيرات الدستورية الحرجة', 'Critical Constitutional Warnings')}
              </h2>
              <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-bold ml-auto">
                {criticalWarnings.length}
              </span>
            </div>
            <div className="divide-y divide-border/40">
              {criticalWarnings.map((w) => (
                <Link key={w.id} href={`/decisions/${w.decisionId}`}>
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{w.warningCode}</span>
                    <span className="flex-1 text-sm text-foreground truncate">{w.titleAr}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{w.caseNumber}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Actions ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/governance', icon: <Scale className="w-5 h-5" />, label: 'مركز الحوكمة', labelEn: 'Governance Hub', color: 'text-blue-500' },
            { href: '/risk-engine', icon: <BarChart3 className="w-5 h-5" />, label: 'محرك المخاطر', labelEn: 'Risk Engine', color: 'text-gold' },
            { href: '/constitutional-intelligence', icon: <ShieldAlert className="w-5 h-5" />, label: 'المراجعة الدستورية', labelEn: 'Constitutional Review', color: 'text-purple-500' },
            { href: '/decisions', icon: <FileText className="w-5 h-5" />, label: 'القرارات', labelEn: 'All Decisions', color: 'text-emerald-500' },
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
