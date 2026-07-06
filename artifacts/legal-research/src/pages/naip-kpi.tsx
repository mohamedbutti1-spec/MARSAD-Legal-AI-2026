/**
 * NAIP KPI Center — مركز المؤشرات الوطنية الرئيسية
 * ───────────────────────────────────────────────────
 * Analytics nerve center: UAE-wide, by Ministry, by Emirate, by Organization.
 * Phase 43 · نظرية الشامسي™ · MARSAD NAIP v1.0
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Scale, Shield, ShieldAlert, BarChart3, ChevronRight, Loader2,
  AlertTriangle, TrendingUp, TrendingDown, ArrowUpDown, Search,
  CheckCircle2,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'uae' | 'ministry' | 'emirate' | 'org';

interface UaeStats {
  nri: number | null;
  ali: number | null;
  dcs: number | null;
  ccs: number | null;
  jsp: number | null;
  totalDecisions: number;
  last7Days: number;
  last30Days: number;
  byStatus: Record<string, number>;
  risk: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  constitutional: {
    criticalWarnings: number;
    totalWarnings: number;
    avgCcs: number | null;
  };
}

interface GroupedRow {
  name: string;
  decisions: number;
  avgNri: number | null;
  avgCcs: number | null;
  criticalWarnings: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical' | null;
}

interface GroupedData {
  rows: GroupedRow[];
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

function riskLevelConfig(level: GroupedRow['riskLevel']) {
  switch (level) {
    case 'critical': return { label: 'حرج', labelEn: 'Critical', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800/40' };
    case 'high':     return { label: 'عالٍ',  labelEn: 'High',     bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/40' };
    case 'moderate': return { label: 'متوسط', labelEn: 'Moderate', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/40' };
    default:         return { label: 'منخفض', labelEn: 'Low',      bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/40' };
  }
}

// ─── SVG Gauge ────────────────────────────────────────────────────────────────

function KpiGauge({ labelAr, labelEn, value, isInverse = false }: {
  labelAr: string; labelEn: string; value: number | null | undefined; isInverse?: boolean;
}) {
  const t = useT();
  const pct = value ?? 0;

  const trackColor = isInverse
    ? pct >= 70 ? 'stroke-red-500' : pct >= 40 ? 'stroke-amber-500' : 'stroke-emerald-500'
    : pct >= 70 ? 'stroke-emerald-500' : pct >= 40 ? 'stroke-amber-500' : 'stroke-red-500';

  const textColor = isInverse
    ? pct >= 70 ? 'text-red-500' : pct >= 40 ? 'text-amber-500' : 'text-emerald-500'
    : pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-red-500';

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
      <div className={`-mt-14 text-2xl font-bold tabular-nums ${textColor}`}>
        {value !== null && value !== undefined ? value : '—'}
      </div>
      <div className="mt-8 text-center">
        <div className="text-xs font-semibold text-foreground">{t(labelAr, labelEn)}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{labelEn}</div>
      </div>
    </div>
  );
}

// ─── CSS Bar ──────────────────────────────────────────────────────────────────

function CssBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-28 text-muted-foreground text-end shrink-0 truncate">{label}</div>
      <div className="flex-1 h-4 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-start tabular-nums font-bold text-foreground">{value}</div>
    </div>
  );
}

// ─── UAE-Wide Tab ─────────────────────────────────────────────────────────────

function UaeWideTab({ headers }: { headers: Record<string, string> }) {
  const t = useT();
  const { data, isLoading } = useQuery<UaeStats>({
    queryKey: ['naip-stats-uae'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/stats/uae`, { headers });
      if (!res.ok) throw new Error('Failed to load UAE stats');
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!data) return (
    <div className="text-center py-12 text-muted-foreground text-sm">{t('لا توجد بيانات', 'No data available')}</div>
  );

  const riskColors: Record<string, string> = {
    critical: 'bg-red-500', high: 'bg-orange-500', moderate: 'bg-amber-500', low: 'bg-emerald-500',
  };
  const riskLabels: Record<string, string> = {
    critical: 'حرج', high: 'عالٍ', moderate: 'متوسط', low: 'منخفض',
  };
  const safeRisk = data.risk ?? { critical: 0, high: 0, moderate: 0, low: 0 };
  const totalRisk = Object.values(safeRisk).reduce((a, b) => a + b, 0);

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-400', in_progress: 'bg-blue-500', completed: 'bg-emerald-500',
    approved: 'bg-green-600', rejected: 'bg-red-500', pending_review: 'bg-amber-500',
  };
  const statusLabels: Record<string, string> = {
    draft: 'مسودة', in_progress: 'قيد المعالجة', completed: 'مكتمل',
    approved: 'معتمد', rejected: 'مرفوض', pending_review: 'في انتظار المراجعة',
  };
  const safeByStatus = data.byStatus ?? {};
  const totalByStatus = Object.values(safeByStatus).reduce((a, b) => a + b, 0);
  const safeConstitutional = data.constitutional ?? { criticalWarnings: 0, totalWarnings: 0, avgCcs: null };

  return (
    <div className="space-y-6">
      {/* 5 KPI Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiGauge labelAr="مؤشر المخاطر" labelEn="National Risk Index" value={data.nri} isInverse />
        <KpiGauge labelAr="الشرعية الإدارية" labelEn="Admin Legitimacy" value={data.ali} />
        <KpiGauge labelAr="ثقة القرار" labelEn="Decision Confidence" value={data.dcs} />
        <KpiGauge labelAr="الامتثال الدستوري" labelEn="Constitutional Compliance" value={data.ccs} />
        <KpiGauge labelAr="الصمود القضائي" labelEn="Judicial Survival" value={data.jsp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Decision counts */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">{t('إحصاءات القرارات', 'Decision Statistics')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('الإجمالي', 'Total')}</span>
              <span className="font-bold tabular-nums">{data.totalDecisions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('آخر 7 أيام', 'Last 7 days')}</span>
              <span className="font-bold tabular-nums text-blue-600">{data.last7Days}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('آخر 30 يوماً', 'Last 30 days')}</span>
              <span className="font-bold tabular-nums text-emerald-600">{data.last30Days}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border space-y-2">
            {Object.entries(safeByStatus).map(([s, v]) => (
              <CssBar key={s} label={statusLabels[s] ?? s} value={v} total={totalByStatus} color={statusColors[s] ?? 'bg-slate-400'} />
            ))}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">{t('توزيع المخاطر', 'Risk Distribution')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {(['critical', 'high', 'moderate', 'low'] as const).map((lvl) => {
              const count = safeRisk[lvl] ?? 0;
              const pct = totalRisk > 0 ? Math.round((count / totalRisk) * 100) : 0;
              const conf = riskLevelConfig(lvl);
              return (
                <div key={lvl} className={`rounded-xl border p-4 text-center ${conf.bg} ${conf.border}`}>
                  <div className={`text-2xl font-bold tabular-nums ${conf.text}`}>{count}</div>
                  <div className={`text-xs font-medium mt-1 ${conf.text}`}>{riskLabels[lvl]}</div>
                  <div className="text-xs text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Constitutional Summary */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">{t('الملخص الدستوري', 'Constitutional Summary')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('متوسط الامتثال', 'Avg Compliance')}</span>
              <span className="font-bold tabular-nums text-emerald-600">{fmt(safeConstitutional.avgCcs, '%')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('تحذيرات حرجة', 'Critical Warnings')}</span>
              <span className={`font-bold tabular-nums ${(safeConstitutional.criticalWarnings ?? 0) > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {safeConstitutional.criticalWarnings ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('إجمالي التحذيرات', 'Total Warnings')}</span>
              <span className="font-bold tabular-nums text-amber-600">{safeConstitutional.totalWarnings ?? 0}</span>
            </div>
          </div>
          <Link href="/constitutional-intelligence">
            <button className="w-full mt-2 text-xs border border-border hover:border-border/60 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
              <Scale className="w-3.5 h-3.5" />
              {t('عرض المراجعة الدستورية', 'View Constitutional Review')}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Grouped Table Tab ────────────────────────────────────────────────────────

type SortKey = 'name' | 'decisions' | 'avgNri' | 'avgCcs' | 'criticalWarnings';

function GroupedTableTab({
  endpoint, nameLabel, nameLabelEn, headers,
}: {
  endpoint: string; nameLabel: string; nameLabelEn: string;
  headers: Record<string, string>;
}) {
  const t = useT();
  const [sortKey, setSortKey] = useState<SortKey>('decisions');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery<GroupedData>({
    queryKey: ['naip-stats', endpoint],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/stats/${endpoint}`, { headers });
      if (!res.ok) throw new Error(`Failed to load ${endpoint} stats`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    let list = data?.rows ?? [];
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'name' ? '' : -Infinity);
      const bv = b[sortKey] ?? (sortKey === 'name' ? '' : -Infinity);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [data, sortKey, sortDir, filter]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-4 py-3 text-xs font-bold text-muted-foreground text-start cursor-pointer hover:text-foreground transition-colors select-none"
        onClick={() => handleSort(col)}
      >
        <div className="flex items-center gap-1">
          {label}
          <ArrowUpDown className={`w-3 h-3 ${sortKey === col ? 'text-foreground' : 'text-muted-foreground/40'}`} />
        </div>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search / filter */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t(`ابحث عن ${nameLabel}…`, `Search ${nameLabelEn}…`)}
          className="w-full bg-card border border-border rounded-xl ps-9 pe-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" />
          {t('لا توجد نتائج', 'No results found')}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <SortHeader col="name" label={t(nameLabel, nameLabelEn)} />
                  <SortHeader col="decisions" label={t('القرارات', 'Decisions')} />
                  <SortHeader col="avgNri" label={t('متوسط NRI', 'Avg NRI')} />
                  <SortHeader col="avgCcs" label={t('متوسط CCS', 'Avg CCS')} />
                  <SortHeader col="criticalWarnings" label={t('تحذيرات حرجة', 'Critical Warnings')} />
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground text-start">{t('مستوى الخطر', 'Risk Level')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => {
                  const rc = riskLevelConfig(row.riskLevel);
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground max-w-xs truncate">{row.name}</td>
                      <td className="px-4 py-3 text-sm tabular-nums text-foreground font-bold">{row.decisions}</td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        <span className={row.avgNri !== null && row.avgNri >= 70 ? 'text-red-600' : row.avgNri !== null && row.avgNri >= 40 ? 'text-amber-600' : 'text-emerald-600'}>
                          {fmt(row.avgNri, '%')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        <span className={row.avgCcs !== null && row.avgCcs >= 70 ? 'text-emerald-600' : row.avgCcs !== null && row.avgCcs >= 40 ? 'text-amber-600' : 'text-red-600'}>
                          {fmt(row.avgCcs, '%')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {row.criticalWarnings > 0 ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {row.criticalWarnings}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.riskLevel ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rc.bg} ${rc.text} border ${rc.border}`}>
                            {t(rc.label, rc.labelEn)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
            {rows.length} {t('نتيجة', 'results')}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main KPI Page ────────────────────────────────────────────────────────────

export default function NaipKpi() {
  const { role, userId, userOrg, canViewNaipDashboard, canViewGovernanceDashboard } = useUserContext() as any;
  const t = useT();
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-id': String(userId),
    'x-user-org': userOrg,
  };

  const hasAccess = canViewNaipDashboard ?? canViewGovernanceDashboard;

  const [activeTab, setActiveTab] = useState<Tab>('uae');

  const tabs: { key: Tab; label: string; labelEn: string }[] = [
    { key: 'uae',      label: 'الإمارات الكلية',   labelEn: 'UAE-Wide' },
    { key: 'ministry', label: 'حسب الوزارة',       labelEn: 'By Ministry' },
    { key: 'emirate',  label: 'حسب الإمارة',       labelEn: 'By Emirate' },
    { key: 'org',      label: 'حسب الجهة',         labelEn: 'By Organization' },
  ];

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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Link href="/naip"><span className="hover:text-foreground cursor-pointer transition-colors">NAIP</span></Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/naip/dashboard"><span className="hover:text-foreground cursor-pointer transition-colors">{t('لوحة التحكم', 'Dashboard')}</span></Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{t('المؤشرات', 'KPI')}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {t('مركز المؤشرات الوطنية الرئيسية', 'National KPI Center')}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('المركز التحليلي الشامل لمؤشرات NAIP', 'Comprehensive analytics hub for NAIP indicators')}
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-gold/20 text-gold border border-gold/30 px-2 py-1 rounded font-bold tracking-wider shrink-0">
              KPI
            </span>
          </div>
        </div>

        {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-xs font-medium px-3 py-2 rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(tab.label, tab.labelEn)}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────────── */}
        {activeTab === 'uae' && <UaeWideTab headers={headers} />}
        {activeTab === 'ministry' && (
          <GroupedTableTab
            endpoint="ministry"
            nameLabel="الوزارة"
            nameLabelEn="Ministry"
            headers={headers}
          />
        )}
        {activeTab === 'emirate' && (
          <GroupedTableTab
            endpoint="emirate"
            nameLabel="الإمارة"
            nameLabelEn="Emirate"
            headers={headers}
          />
        )}
        {activeTab === 'org' && (
          <GroupedTableTab
            endpoint="org"
            nameLabel="الجهة"
            nameLabelEn="Organization"
            headers={headers}
          />
        )}

      </div>
    </AppLayout>
  );
}
