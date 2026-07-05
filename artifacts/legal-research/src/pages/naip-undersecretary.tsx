/**
 * NAIP Undersecretary Dashboard — Decisions Management + Delegation Queue
 * ────────────────────────────────────────────────────────────────────────
 * Full KPI summary, delegation queue, org breakdown, recent activity.
 *
 * MARSAD NAIP · Undersecretary Dashboard
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  ShieldAlert, FileText, ChevronRight, Loader2, XCircle,
  AlertTriangle, CheckCircle2, Users, Activity, BarChart3,
  ArrowUpRight, Scale, Clock, TrendingUp, Plus,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
type DecisionStatus = 'draft' | 'active' | 'sealed' | 'archived' | string;

interface UndersecretaryKpi {
  totalDecisions: number;
  delegatableCount: number;
  criticalRiskCount: number;
  avgNationalRiskIndex: number | null;
  avgConstitutionalCompliance: number | null;
  pendingReviews: number;
  activeWarnings: number;
}

interface DelegationItem {
  id: number;
  caseNumber: string;
  titleAr: string;
  status: DecisionStatus;
  riskLevel: RiskLevel | null;
  organizationUnit: string | null;
  createdAt: string | null;
}

interface OrgBreakdown {
  org: string;
  decisionCount: number;
  criticalCount: number;
  avgRisk: number | null;
  riskLevel: RiskLevel | null;
}

interface ActivityEvent {
  id: number;
  decisionId: number;
  caseNumber: string;
  eventType: string;
  descriptionAr: string;
  createdAt: string;
}

interface UndersecretaryData {
  kpi: UndersecretaryKpi;
  delegationQueue: DelegationItem[];
  orgBreakdown: OrgBreakdown[];
  recentActivity: ActivityEvent[];
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
    case 'draft':    return { label: 'مسودة', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' };
    case 'archived': return { label: 'مؤرشف', bg: 'bg-muted', text: 'text-muted-foreground' };
    default:         return { label: status, bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

function riskConfig(level: RiskLevel | null | undefined) {
  switch (level) {
    case 'critical': return { label: 'حرج', dot: 'bg-red-500', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400' };
    case 'high':     return { label: 'عالٍ', dot: 'bg-orange-500', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400' };
    case 'moderate': return { label: 'متوسط', dot: 'bg-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' };
    case 'low':      return { label: 'منخفض', dot: 'bg-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' };
    default:         return { label: '—', dot: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

function truncate(str: string, max: number) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('ar-AE', { month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function MiniGauge({ value, colorClass, label }: { value: number | null | undefined; colorClass: string; label: string }) {
  const score = value ?? 0;
  const pct = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-border/40" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className={`transition-all duration-700 ${colorClass}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold tabular-nums text-foreground">{value != null ? Math.round(score) : '—'}</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[80px]">{label}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NaipUndersecretary() {
  const t = useT();
  const [, navigate] = useLocation();
  const { role, userId, userOrg } = useUserContext();
  const headers = getHeaders(role, userId, userOrg);

  const isAllowed = role === 'undersecretary' || role === 'owner' || role === 'supervisor';

  const { data, isLoading, isError } = useQuery<UndersecretaryData>({
    queryKey: ['naip-undersecretary', role, userOrg],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/executive-data/undersecretary`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: isAllowed,
    staleTime: 60_000,
  });

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ['naip-overview', role, userOrg],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/overview`, { headers });
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
  const delegationQueue = data?.delegationQueue ?? [];
  const orgBreakdown = data?.orgBreakdown ?? [];
  const recentActivity = data?.recentActivity ?? [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Scale className="w-6 h-6 text-indigo-500" />
              <h1 className="text-xl font-bold text-foreground">
                {t('لوحة وكيل الوزارة', 'Undersecretary Dashboard')}
              </h1>
              <span className="text-[10px] font-bold tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/40">
                وكيل الوزارة
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              {t('إدارة القرارات وطابور التفويض والرقابة المؤسسية', 'Decision management, delegation queue and institutional oversight')}
            </p>
          </div>
          <Link href="/decisions/new">
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" />
              {t('قرار جديد', 'New Decision')}
            </button>
          </Link>
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

        {/* ── KPI Gauges ──────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">{t('المؤشرات التنفيذية', 'Executive KPIs')}</h2>
          </div>
          <div className="flex flex-wrap gap-6 justify-around">
            <MiniGauge value={kpi?.avgNationalRiskIndex} colorClass="text-red-500" label="مؤشر المخاطر الوطني" />
            <MiniGauge value={kpi?.avgConstitutionalCompliance} colorClass="text-emerald-500" label="الامتثال الدستوري" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{kpi?.totalDecisions ?? '—'}</span>
              </div>
              <span className="text-[10px] text-muted-foreground text-center">إجمالي القرارات</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{kpi?.activeWarnings ?? '—'}</span>
              </div>
              <span className="text-[10px] text-muted-foreground text-center">تحذيرات نشطة</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400 tabular-nums">{kpi?.pendingReviews ?? '—'}</span>
              </div>
              <span className="text-[10px] text-muted-foreground text-center">مراجعات معلقة</span>
            </div>
          </div>
        </div>

        {/* ── Delegation Queue ─────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-foreground">{t('طابور التفويض', 'Delegation Queue')}</h2>
              {kpi?.delegatableCount != null && (
                <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5 font-bold">{kpi.delegatableCount}</span>
              )}
            </div>
            <Link href="/decisions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {t('عرض الكل', 'View all')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {delegationQueue.length === 0 && !isLoading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('لا توجد قرارات في طابور التفويض', 'Delegation queue is empty')}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {delegationQueue.slice(0, 8).map((d) => {
                const sc = statusConfig(d.status);
                const rc = riskConfig(d.riskLevel);
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/decisions/${d.id}`)}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0 w-28 truncate">{d.caseNumber}</span>
                    <span className="flex-1 text-sm text-foreground truncate">{truncate(d.titleAr, 35)}</span>
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{truncate(d.organizationUnit ?? '', 20)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${sc.bg} ${sc.text}`}>{sc.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${rc.bg} ${rc.text}`}>{rc.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Org Breakdown ────────────────────────────────────────────────── */}
        {orgBreakdown.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('توزيع الوحدات التنظيمية', 'Org Unit Breakdown')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-right px-5 py-2 text-xs font-bold text-muted-foreground">الوحدة</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">القرارات</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">الحرج</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">متوسط NRI</th>
                    <th className="text-center px-4 py-2 text-xs font-bold text-muted-foreground">المستوى</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {orgBreakdown.map((o, i) => {
                    const rc = riskConfig(o.riskLevel);
                    return (
                      <tr key={i} className="hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-3 text-foreground text-xs max-w-[200px] truncate">{o.org || '—'}</td>
                        <td className="px-4 py-3 text-center font-bold text-foreground tabular-nums">{o.decisionCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-500 tabular-nums">{o.criticalCount}</td>
                        <td className="px-4 py-3 text-center text-foreground tabular-nums">{o.avgRisk != null ? Math.round(o.avgRisk) : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${rc.bg} ${rc.text}`}>{rc.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Recent Activity ──────────────────────────────────────────────── */}
        {recentActivity.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">{t('النشاط الأخير', 'Recent Activity')}</h2>
            </div>
            <div className="divide-y divide-border/40">
              {recentActivity.slice(0, 6).map((e) => (
                <Link key={e.id} href={`/decisions/${e.decisionId}`}>
                  <div className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{e.descriptionAr || e.eventType}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{e.caseNumber} · {formatDate(e.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Access ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/decisions/new', icon: <Plus className="w-5 h-5" />, label: 'قرار جديد', labelEn: 'New Decision', color: 'text-emerald-500' },
            { href: '/governance', icon: <Scale className="w-5 h-5" />, label: 'مركز الحوكمة', labelEn: 'Governance Hub', color: 'text-blue-500' },
            { href: '/risk-engine', icon: <BarChart3 className="w-5 h-5" />, label: 'محرك المخاطر', labelEn: 'Risk Engine', color: 'text-orange-500' },
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
