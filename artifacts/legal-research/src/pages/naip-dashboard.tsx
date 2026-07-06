/**
 * NAIP National Dashboard — لوحة الذكاء الإداري الوطني
 * ──────────────────────────────────────────────────────
 * Executive overview of all NAIP modules and national KPIs.
 * Phase 43 · نظرية الشامسي™ · MARSAD NAIP v1.0
 */
import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Scale, Shield, ShieldAlert, RefreshCw, Sparkles, BookOpen,
  AlertTriangle, ChevronRight, Loader2, Activity, BarChart3,
  TrendingUp, TrendingDown, CheckCircle2, XCircle, ArrowUpRight,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NaipKpi {
  nri: number | null;   // National Risk Index
  ali: number | null;   // Administrative Legitimacy Index
  dcs: number | null;   // Decision Confidence Score
  ccs: number | null;   // Constitutional Compliance Score
  jsp: number | null;   // Judicial Survival Probability
  decisions: {
    total: number;
    byStatus: Record<string, number>;
    last7Days: number;
    last30Days: number;
  };
  risk: {
    byLevel: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
    };
  };
  constitutional: {
    byRiskLevel: Record<string, number>;
    criticalWarnings: number;
    totalWarnings: number;
    avgCcs: number | null;
  };
  modules: {
    decisions: boolean;
    governance: boolean;
    nrme: boolean;
    cil: boolean;
    replay: boolean;
    shamsi: boolean;
    principles: boolean;
  };
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

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—';
  return `${val}${suffix}`;
}

// ─── SVG Gauge ────────────────────────────────────────────────────────────────

function NaipGauge({
  labelAr, labelEn, value, isInverse = false,
}: {
  labelAr: string; labelEn: string;
  value: number | null | undefined; isInverse?: boolean;
}) {
  const t = useT();
  const pct = value ?? 0;

  const colorClass = isInverse
    ? pct >= 70 ? 'text-red-500' : pct >= 40 ? 'text-amber-500' : 'text-emerald-500'
    : pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-red-500';

  const trackColor = isInverse
    ? pct >= 70 ? 'stroke-red-500' : pct >= 40 ? 'stroke-amber-500' : 'stroke-emerald-500'
    : pct >= 70 ? 'stroke-emerald-500' : pct >= 40 ? 'stroke-amber-500' : 'stroke-red-500';

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
        <div className="text-xs font-semibold text-foreground">{t(labelAr, labelEn)}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{labelEn}</div>
      </div>
    </div>
  );
}

// ─── CSS Bar Chart ────────────────────────────────────────────────────────────

function CssBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-24 text-muted-foreground text-end shrink-0 truncate">{label}</div>
      <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-10 text-start tabular-nums font-bold text-foreground">{value}</div>
    </div>
  );
}

// ─── Module Status Card ───────────────────────────────────────────────────────

function ModuleStatus({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-2 text-xs font-medium transition-colors ${
      active
        ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
        : 'border-border bg-muted/20 text-muted-foreground'
    }`}>
      <span className={active ? 'text-emerald-500' : 'text-muted-foreground/50'}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {active
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
      }
    </div>
  );
}

// ─── Risk Distribution Block ──────────────────────────────────────────────────

function RiskBlock({ level, count, total }: { level: string; count: number; total: number }) {
  const configs: Record<string, { bg: string; text: string; border: string; label: string }> = {
    critical: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800', label: 'حرج' },
    high:     { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', label: 'عالٍ' },
    moderate: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', label: 'متوسط' },
    low:      { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', label: 'منخفض' },
  };
  const c = configs[level] ?? configs.low;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`rounded-xl border p-4 text-center ${c.bg} ${c.border}`}>
      <div className={`text-2xl font-bold tabular-nums ${c.text}`}>{count}</div>
      <div className={`text-xs font-medium mt-1 ${c.text}`}>{c.label}</div>
      <div className="text-xs text-muted-foreground">{pct}%</div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function NaipDashboard() {
  const { role, userId, userOrg, canViewNaipDashboard, canViewGovernanceDashboard } = useUserContext() as any;
  const t = useT();
  const headers = getHeaders(role, userId, userOrg);

  const hasAccess = canViewNaipDashboard ?? canViewGovernanceDashboard;

  const { data: kpi, isLoading } = useQuery<NaipKpi>({
    queryKey: ['naip-kpi'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/kpi`, { headers });
      if (!res.ok) throw new Error('Failed to load NAIP KPI');
      return res.json();
    },
    enabled: hasAccess,
    staleTime: 60_000,
  });

  // ── Permission gate ──────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-muted-foreground">
          <Shield className="w-14 h-14 opacity-20" />
          <p className="text-sm font-medium">{t('غير مصرح بالوصول', 'Access not authorised')}</p>
        </div>
      </AppLayout>
    );
  }

  const decisions = kpi?.decisions;
  const risk = kpi?.risk;
  const constitutional = kpi?.constitutional;
  const modules = kpi?.modules;

  const totalRisk = risk?.byLevel ? Object.values(risk.byLevel).reduce((a, b) => a + b, 0) : 0;
  const totalDecisionsByStatus = decisions?.byStatus
    ? Object.values(decisions.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-400',
    in_progress: 'bg-blue-500',
    completed: 'bg-emerald-500',
    approved: 'bg-green-600',
    rejected: 'bg-red-500',
    pending_review: 'bg-amber-500',
  };

  const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    in_progress: 'قيد المعالجة',
    completed: 'مكتمل',
    approved: 'معتمد',
    rejected: 'مرفوض',
    pending_review: 'في انتظار المراجعة',
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header + Breadcrumb ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Link href="/naip"><span className="hover:text-foreground cursor-pointer transition-colors">NAIP</span></Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{t('لوحة التحكم', 'Dashboard')}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {t('لوحة الذكاء الإداري الوطني', 'National Administrative Intelligence Dashboard')}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('نظرة شاملة على مؤشرات NAIP الوطنية', 'Comprehensive view of national NAIP indicators')}
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-gold/20 text-gold border border-gold/30 px-2 py-1 rounded font-bold tracking-wider shrink-0">
              NAIP v43
            </span>
          </div>
        </div>

        {/* ── 5 KPI Gauges ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-44 bg-muted/30 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <NaipGauge labelAr="مؤشر المخاطر الوطني" labelEn="National Risk Index" value={kpi?.nri} isInverse />
            <NaipGauge labelAr="مؤشر الشرعية الإدارية" labelEn="Admin Legitimacy Index" value={kpi?.ali} />
            <NaipGauge labelAr="درجة ثقة القرار" labelEn="Decision Confidence Score" value={kpi?.dcs} />
            <NaipGauge labelAr="درجة الامتثال الدستوري" labelEn="Constitutional Compliance" value={kpi?.ccs} />
            <NaipGauge labelAr="احتمالية الصمود القضائي" labelEn="Judicial Survival Probability" value={kpi?.jsp} />
          </div>
        )}

        {/* ── Module Status Row ───────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            {t('حالة الوحدات', 'Module Status')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <ModuleStatus icon={<Scale className="w-3.5 h-3.5" />} label={t('القرار الذكي', 'Decisions')} active={modules?.decisions ?? false} />
            <ModuleStatus icon={<Shield className="w-3.5 h-3.5" />} label={t('الحوكمة', 'Governance')} active={modules?.governance ?? false} />
            <ModuleStatus icon={<ShieldAlert className="w-3.5 h-3.5" />} label={t('المخاطر', 'Risk')} active={modules?.nrme ?? false} />
            <ModuleStatus icon={<Scale className="w-3.5 h-3.5" />} label={t('دستوري', 'Review')} active={modules?.cil ?? false} />
            <ModuleStatus icon={<RefreshCw className="w-3.5 h-3.5" />} label={t('إعادة التشغيل', 'Replay')} active={modules?.replay ?? false} />
            <ModuleStatus icon={<Sparkles className="w-3.5 h-3.5" />} label={t('نظرية الشامسي', 'Al-Shamsi')} active={modules?.shamsi ?? false} />
            <ModuleStatus icon={<BookOpen className="w-3.5 h-3.5" />} label={t('المبادئ', 'Principles')} active={modules?.principles ?? false} />
          </div>
        </div>

        {/* ── Two-col: Decisions Panel + Risk Distribution ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Decisions by Status */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Scale className="w-4 h-4 text-muted-foreground" />
                {t('القرارات حسب الحالة', 'Decisions by Status')}
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums font-bold">{decisions?.total ?? '—'}</span>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-5 bg-muted/30 rounded animate-pulse" />)}</div>
            ) : decisions?.byStatus ? (
              <div className="space-y-2.5">
                {Object.entries(decisions.byStatus).map(([status, count]) => (
                  <CssBar
                    key={status}
                    label={statusLabels[status] ?? status}
                    value={count}
                    total={totalDecisionsByStatus}
                    color={statusColors[status] ?? 'bg-slate-400'}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">{t('لا توجد بيانات', 'No data available')}</p>
            )}

            {/* Activity trend */}
            {decisions && (
              <div className="flex items-center gap-6 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t('آخر 7 أيام', 'Last 7 days')}:</span>
                  <span className="font-bold text-foreground tabular-nums">{decisions.last7Days}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  <span>{t('آخر 30 يوماً', 'Last 30 days')}:</span>
                  <span className="font-bold text-foreground tabular-nums">{decisions.last30Days}</span>
                </div>
              </div>
            )}
          </div>

          {/* Risk Distribution */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-muted-foreground" />
              {t('توزيع مستوى المخاطر', 'Risk Level Distribution')}
            </h2>
            {isLoading ? (
              <div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />)}</div>
            ) : risk ? (
              <div className="grid grid-cols-4 gap-3">
                {(['critical', 'high', 'moderate', 'low'] as const).map((level) => (
                  <RiskBlock key={level} level={level} count={risk.byLevel[level] ?? 0} total={totalRisk} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">{t('لا توجد بيانات', 'No data available')}</p>
            )}
          </div>
        </div>

        {/* ── Constitutional Panel ────────────────────────────────────────────── */}
        {constitutional && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              {t('اللوحة الدستورية', 'Constitutional Panel')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="text-2xl font-bold tabular-nums text-foreground">{fmt(constitutional.avgCcs, '%')}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('متوسط الامتثال', 'Avg Compliance Score')}</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4">
                <div className={`text-2xl font-bold tabular-nums ${constitutional.criticalWarnings > 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {constitutional.criticalWarnings}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('تحذيرات حرجة', 'Critical Warnings')}</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="text-2xl font-bold tabular-nums text-foreground">{constitutional.totalWarnings}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('إجمالي التحذيرات', 'Total Warnings')}</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {Object.values(constitutional.byRiskLevel ?? {}).reduce((a: number, b: number) => a + b, 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('التقييمات الكلية', 'Total Assessments')}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom Links ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/naip/kpi">
            <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 rounded-lg px-3 py-2 transition-colors cursor-pointer">
              <BarChart3 className="w-3.5 h-3.5" />
              {t('مركز المؤشرات الوطنية', 'National KPI Center')}
              <ArrowUpRight className="w-3 h-3" />
            </div>
          </Link>
          <Link href="/naip/search">
            <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 rounded-lg px-3 py-2 transition-colors cursor-pointer">
              <Activity className="w-3.5 h-3.5" />
              {t('البحث الوطني الموحد', 'Global Search')}
              <ArrowUpRight className="w-3 h-3" />
            </div>
          </Link>
        </div>

      </div>
    </AppLayout>
  );
}
