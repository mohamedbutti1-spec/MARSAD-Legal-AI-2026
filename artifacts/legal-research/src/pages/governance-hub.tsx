/**
 * Governance Hub — Phase 2 Executive Governance Layer
 *
 * Routes each of the 11 governance roles to their specific dashboard.
 * All data comes from /api/governance/* endpoints which enforce RBAC server-side.
 * Nothing here overrides or touches Module 1 decision logic.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  BarChart3, Shield, AlertTriangle, CheckCircle2, Clock, XCircle,
  FileText, Hash, Eye, Scale, ChevronRight, ChevronDown, Search,
  Flag, Gavel, Lock, UnlockKeyhole, RefreshCw, ArrowRight, Users,
  Building2, BookOpen, GitMerge, Archive, BookMarked, GitBranch,
  DownloadCloud, ShieldCheck, ShieldAlert, Link2, Database, Fingerprint,
  Activity, Brain, Target, Zap, CircleDot, TrendingUp, Info,
} from 'lucide-react';
import { useUserContext, ROLE_META } from '@/lib/user-context';
import { getPermissions } from '@/lib/permissions';

// ─── API helper ───────────────────────────────────────────────────────────────

function apiFetch(method: string, path: string, body?: unknown) {
  const role    = localStorage.getItem('userRole') || 'viewer';
  const userId  = localStorage.getItem('userId')   || '1';
  const userOrg = localStorage.getItem('userOrg')  || '';
  const base = (import.meta.env.BASE_URL ?? '').replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': role,
      'X-User-Id':   userId,
      'X-User-Org':  userOrg,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data as { error?: string }).error || r.statusText);
    return data as Record<string, unknown>;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DciSummary {
  isSealed?: boolean;
  sealedAt?: string;
  alShamsiFrameworkCompliance?: string;
  constitutionalValidationStatus?: string;
  lsiStatus?: string;        // canonical column name from DB (lsi_status)
  humanDecisionOwner?: string;
  humanInfluenceIndex?: string;
  aiActualInfluence?: string;
  completeAuditHash?: string;
  qvaVarianceLevel?: string;
  qvaRunCount?: number;
}

interface GovDecision {
  id: number;
  caseNumber: string;
  titleAr: string;
  status: string;
  currentStage: string;
  stagesCompleted: string[];
  organizationUnit?: string;
  issuingAuthority?: string;
  createdAt: string;
  delegatedForReview?: boolean;
  dci?: DciSummary;
}

interface DashboardStats {
  totalDecisions: number;
  totalThisMonth: number;
  sealedCount: number;
  constitutionalPassRate: number;
  avgDaysToSeal: number;
  byStatus: Record<string, number>;
  hiiDistribution?: Record<string, number>;
  complianceDistribution: Record<string, number>;
  attentionDecisions: GovDecision[];
}

// ─── Shared atom components ───────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    complete:          { label: 'مكتمل', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    in_progress:       { label: 'جارٍ', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    draft:             { label: 'مسودة', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
    validation_failed: { label: 'فشل التحقق', cls: 'bg-red-50 text-red-700 border-red-200' },
    pending_review:    { label: 'قيد المراجعة', cls: 'bg-gold/10 text-gold border-gold/25' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${s.cls}`}>{s.label}</span>;
}

function ComplianceChip({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    full:    { label: 'امتثال كامل', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    partial: { label: 'امتثال جزئي', cls: 'bg-gold/10 text-gold border-gold/25' },
    none:    { label: 'عدم امتثال', cls: 'bg-red-50 text-red-700 border-red-200' },
    pending: { label: 'قيد التقييم', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  };
  const s = map[value] ?? { label: value, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${s.cls}`}>{s.label}</span>;
}

function HiiChip({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    human_will:      { label: 'الإرادة البشرية', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    ai_recommendation: { label: 'توصية الذكاء', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    joint_decision:  { label: 'قرار مشترك', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    pending:         { label: 'معلّق', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  };
  const s = map[value] ?? { label: value, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${s.cls}`}>{s.label}</span>;
}

function SealChip({ isSealed }: { isSealed?: boolean }) {
  return isSealed
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><Lock className="w-3 h-3" />مختوم</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-50 text-slate-500 border border-slate-200"><UnlockKeyhole className="w-3 h-3" />غير مختوم</span>;
}

function KpiCard({ label, value, sub, icon, cls = '' }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; cls?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-border p-5 flex items-start gap-4 shadow-xs ${cls}`}>
      {icon && <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">{icon}</div>}
      <div>
        <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
        <div className="text-sm font-medium text-foreground mt-1">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {icon && <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">{icon}</div>}
      <div>
        <h2 className="text-lg font-bold text-foreground leading-tight">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function LoadingSpinner({ label = 'جارٍ التحميل...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <RefreshCw className="w-6 h-6 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-1">
        {icon ?? <FileText className="w-5 h-5" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {sub && <p className="text-xs text-muted-foreground max-w-xs">{sub}</p>}
    </div>
  );
}

// Compact decision list row
function DecisionRow({
  d,
  selected,
  onClick,
  showHii,
  showDelegate,
  onDelegate,
  delegating,
}: {
  d: GovDecision;
  selected?: boolean;
  onClick?: () => void;
  showHii?: boolean;
  showDelegate?: boolean;
  onDelegate?: () => void;
  delegating?: boolean;
}) {
  const { canUseShamsiFramework } = useUserContext();
  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
        selected ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border hover:border-primary/20 hover:bg-muted/30'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-mono text-muted-foreground">{d.caseNumber}</span>
          <StatusChip status={d.status} />
          {d.dci?.isSealed !== undefined && <SealChip isSealed={d.dci.isSealed} />}
          {d.delegatedForReview && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-gold/10 text-gold border border-gold/25">
              <Flag className="w-3 h-3" />مُحالة للمراجعة
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-1 mb-1">{d.titleAr}</p>
        <div className="flex items-center gap-3 flex-wrap">
          {canUseShamsiFramework && d.dci?.alShamsiFrameworkCompliance && <ComplianceChip value={d.dci.alShamsiFrameworkCompliance} />}
          {showHii && d.dci?.humanInfluenceIndex && <HiiChip value={d.dci.humanInfluenceIndex} />}
          {d.organizationUnit && <span className="text-[11px] text-muted-foreground">{d.organizationUnit}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {showDelegate && onDelegate && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelegate(); }}
            disabled={delegating}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
              d.delegatedForReview
                ? 'border-gold/25 bg-gold/10 text-gold hover:bg-gold/15'
                : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            {d.delegatedForReview ? 'إلغاء الإحالة' : 'إحالة للمراجعة'}
          </button>
        )}
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selected ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
      </div>
    </div>
  );
}

// ─── 1. Minister Dashboard ────────────────────────────────────────────────────

function MinisterDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const { data, isLoading, error } = useQuery({
    queryKey: ['gov-dashboard-minister'],
    queryFn: () => apiFetch('GET', '/api/governance/dashboard'),
  });

  const stats = (data?.stats as DashboardStats) ?? null;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorCard message={String(error)} />;
  if (!stats) return <EmptyState title="لا توجد بيانات" />;

  const byStatus = stats.byStatus ?? {};
  const hii = stats.hiiDistribution ?? {};
  const total = Math.max(stats.totalDecisions, 1);

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="إجمالي القرارات" value={stats.totalDecisions} icon={<Scale className="w-5 h-5" />} />
        <KpiCard label="قرارات هذا الشهر" value={stats.totalThisMonth} icon={<Clock className="w-5 h-5" />} />
        <KpiCard label="معدل الاجتياز الدستوري" value={`${stats.constitutionalPassRate}%`} icon={<Shield className="w-5 h-5" />} sub="قرارات اجتازت التحقق" />
        <KpiCard label="متوسط أيام الختم" value={stats.avgDaysToSeal === 0 ? '—' : `${stats.avgDaysToSeal} يوم`} icon={<Lock className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
          <SectionHeader icon={<BarChart3 className="w-4 h-4" />} title="توزيع القرارات حسب الحالة" />
          <div className="space-y-3">
            {[
              { key: 'complete',          label: 'مكتملة',      color: 'bg-emerald-500' },
              { key: 'in_progress',       label: 'جارية',       color: 'bg-sky-500' },
              { key: 'draft',             label: 'مسودات',      color: 'bg-slate-400' },
              { key: 'validation_failed', label: 'فشل التحقق', color: 'bg-red-500' },
            ].map(({ key, label, color }) => {
              const count = byStatus[key] ?? 0;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* HII distribution */}
        {Object.keys(hii).length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
            <SectionHeader icon={<Users className="w-4 h-4" />} title="مؤشر تأثير الإنسان (HII)" sub="كيف يُتخذ القرار" />
            <div className="space-y-3">
              {[
                { key: 'human_will',       label: 'الإرادة البشرية',   color: 'bg-blue-500' },
                { key: 'joint_decision',   label: 'قرار مشترك',        color: 'bg-teal-500' },
                { key: 'ai_recommendation', label: 'توصية الذكاء الاصطناعي', color: 'bg-violet-500' },
                { key: 'pending',          label: 'معلّق',            color: 'bg-slate-400' },
              ].map(({ key, label, color }) => {
                const count = hii[key] ?? 0;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attention decisions */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
          <SectionHeader icon={<AlertTriangle className="w-4 h-4" />} title="قرارات تحتاج انتباهاً" sub="فشل التحقق أو متأخرة" />
          {stats.attentionDecisions.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} title="لا توجد قرارات معلّقة" sub="جميع القرارات ضمن المعايير" />
          ) : (
            <div className="space-y-2">
              {stats.attentionDecisions.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gold/50 border border-gold/15">
                  <div>
                    <p className="text-xs font-medium text-foreground line-clamp-1">{d.titleAr}</p>
                    <p className="text-[11px] text-muted-foreground">{d.caseNumber}</p>
                  </div>
                  <StatusChip status={d.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 rounded-lg bg-muted/40 border border-border">
        <p className="text-xs text-muted-foreground text-center">
          🔒 الوزير — عرض ملخص تنفيذي فقط. بيانات الذكاء الاصطناعي والمراحل التفصيلية غير متاحة لهذا الدور.
        </p>
      </div>
    </div>
  );
}

// ─── 2. Undersecretary Dashboard ─────────────────────────────────────────────

function UndersecretaryDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const queryClient = useQueryClient();
  const [delegating, setDelegating] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['gov-decisions-undersecretary'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });

  const decisions: GovDecision[] = (data?.decisions as GovDecision[]) ?? [];

  const handleDelegate = async (d: GovDecision) => {
    setDelegating(d.id);
    try {
      const endpoint = d.delegatedForReview
        ? `/api/governance/decisions/${d.id}/undelegate`
        : `/api/governance/decisions/${d.id}/delegate`;
      await apiFetch('POST', endpoint, {});
      await queryClient.invalidateQueries({ queryKey: ['gov-decisions-undersecretary'] });
    } catch (e) {
      console.error(e);
    } finally {
      setDelegating(null);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorCard message={String(error)} />;

  const delegatedCount = decisions.filter((d) => d.delegatedForReview).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="إجمالي القرارات" value={decisions.length} icon={<Scale className="w-5 h-5" />} />
        <KpiCard label="قرارات مختومة" value={decisions.filter((d) => d.dci?.isSealed).length} icon={<Lock className="w-5 h-5" />} />
        <KpiCard label="محالة للمراجعة" value={delegatedCount} icon={<Flag className="w-5 h-5" />} />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-xs">
        <div className="px-5 py-4 border-b border-border">
          <SectionHeader icon={<Scale className="w-4 h-4" />} title="قرارات الوزارة" sub="انقر على قرار لإحالته للمراجعة أو إلغاء الإحالة" />
        </div>
        <div className="p-4 space-y-2">
          {decisions.length === 0 ? (
            <EmptyState title="لا توجد قرارات" />
          ) : (
            decisions.map((d) => (
              <DecisionRow
                key={d.id}
                d={d}
                showHii
                showDelegate
                onDelegate={() => handleDelegate(d)}
                delegating={delegating === d.id}
              />
            ))
          )}
        </div>
      </div>

      {/* DCI Summary for first decision */}
      {decisions.length > 0 && decisions[0].dci && (
        <div className="bg-white rounded-xl border border-border shadow-xs p-5">
          <SectionHeader icon={<Shield className="w-4 h-4" />} title="ملخص الهوية الدستورية (DCI) — آخر قرار" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {[
              ...(canUseShamsiFramework ? [{ label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={decisions[0].dci.alShamsiFrameworkCompliance} /> }] : []),
              { label: 'الحالة الدستورية', value: decisions[0].dci.constitutionalValidationStatus ?? '—' },
              { label: 'حالة الختم', value: <SealChip isSealed={decisions[0].dci.isSealed} /> },
              { label: 'مؤشر تأثير الإنسان', value: <HiiChip value={decisions[0].dci.humanInfluenceIndex} /> },
              { label: 'مسؤول القرار البشري', value: decisions[0].dci.humanDecisionOwner ?? '—' },
              { label: 'الحالة القانونية', value: decisions[0].dci.lsiStatus ?? '—' },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center p-3 bg-muted/40 rounded-lg border border-border">
        🔑 وكيل الوزارة — صلاحية الإحالة الإلزامية للمراجعة. لا تتوفر صلاحية الاطلاع على سجل المراجعة أو تفاصيل المراحل.
      </p>
    </div>
  );
}

// ─── 3. Assistant Undersecretary Dashboard ────────────────────────────────────

function AssistantUndersecretaryDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['gov-decisions-asst-usec'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = (listQuery.data?.decisions as GovDecision[]) ?? [];

  const detailQuery = useQuery({
    queryKey: ['gov-detail-asst-usec', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });

  if (listQuery.isLoading) return <LoadingSpinner />;
  if (listQuery.error) return <ErrorCard message={String(listQuery.error)} />;

  const detail = detailQuery.data;
  const stages: Record<string, unknown>[] = (detail?.stages as Record<string, unknown>[]) ?? [];
  const jdp = detail?.jdp as Record<string, unknown> | null;
  const dci = detail?.dci as Record<string, unknown> | null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: decision list */}
      <div className="lg:col-span-2 space-y-3">
        <SectionHeader icon={<Scale className="w-4 h-4" />} title="القرارات" sub="اختر قراراً لعرض التفاصيل" />
        {decisions.length === 0 ? <EmptyState title="لا توجد قرارات" /> : (
          <div className="space-y-2">
            {decisions.map((d) => (
              <DecisionRow key={d.id} d={d} selected={selectedId === d.id} onClick={() => setSelectedId(d.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      <div className="lg:col-span-3">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
            <EmptyState icon={<ArrowRight className="w-5 h-5" />} title="اختر قراراً من القائمة" sub="ستظهر هنا المراحل والتحليل القانوني والحزمة الدفاعية" />
          </div>
        ) : detailQuery.isLoading ? <LoadingSpinner /> : (
          <div className="space-y-5">
            {/* Stages */}
            <div className="bg-white rounded-xl border border-border shadow-xs p-5">
              <SectionHeader icon={<GitMerge className="w-4 h-4" />} title="مراحل القرار" sub={`${stages.filter((s) => s.status === 'complete').length} / ${stages.length} مرحلة مكتملة`} />
              <div className="space-y-2">
                {stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.status === 'complete' ? 'bg-emerald-100 text-emerald-700' : s.status === 'active' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                      {(s.stageNumber as number) + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{(s.titleAr as string) || (s.stageKey as string)}</p>
                      {s.aiAnalysis ? <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{s.aiAnalysis as string}</p> : null}
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.status === 'complete' ? 'bg-emerald-50 text-emerald-700' : s.status === 'active' ? 'bg-sky-50 text-sky-700' : 'bg-slate-50 text-slate-500'}`}>
                      {s.status === 'complete' ? 'مكتمل' : s.status === 'active' ? 'جارٍ' : 'معلّق'}
                    </span>
                  </div>
                ))}
                {stages.length === 0 && <EmptyState title="لا توجد مراحل محفوظة" />}
              </div>
            </div>

            {/* JDP */}
            {jdp && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<BookOpen className="w-4 h-4" />} title="الحزمة الدفاعية القضائية (JDP)" />
                <div className="grid grid-cols-1 gap-3">
                  {jdp.executiveSummary ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">الملخص التنفيذي</p>
                      <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">{jdp.executiveSummary as string}</p>
                    </div>
                  ) : null}
                  {jdp.legalBasisValidation ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">التحقق من الأساس القانوني</p>
                      <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">{jdp.legalBasisValidation as string}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* DCI summary */}
            {dci && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<Shield className="w-4 h-4" />} title="الهوية الدستورية (DCI)" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {canUseShamsiFramework && <div><span className="text-xs text-muted-foreground block mb-1">الامتثال</span><ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /></div>}
                  <div><span className="text-xs text-muted-foreground block mb-1">الحالة الدستورية</span><span className="font-medium">{(dci.constitutionalValidationStatus as string) ?? '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground block mb-1">بوابات المرحلة 9</span><span className="font-medium">{(dci.lsiStatus as string) ?? '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground block mb-1">ختم DCI</span><SealChip isSealed={dci.isSealed as boolean} /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 4. Director General Dashboard ───────────────────────────────────────────

function DirectorGeneralDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['gov-decisions-dg'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = (listQuery.data?.decisions as GovDecision[]) ?? [];

  const detailQuery = useQuery({
    queryKey: ['gov-detail-dg', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });

  const detail = detailQuery.data;
  const stages: Record<string, unknown>[] = (detail?.stages as Record<string, unknown>[]) ?? [];
  const dci = detail?.dci as Record<string, unknown> | null;

  if (listQuery.isLoading) return <LoadingSpinner />;
  if (listQuery.error) return <ErrorCard message={String(listQuery.error)} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <SectionHeader icon={<Building2 className="w-4 h-4" />} title="قرارات المديرية" sub="مرشّحة حسب الجهة المُصدِرة" />
          {decisions.map((d) => (
            <DecisionRow key={d.id} d={d} selected={selectedId === d.id} onClick={() => setSelectedId(d.id)} />
          ))}
          {decisions.length === 0 && <EmptyState title="لا توجد قرارات لمديريتك" />}
        </div>

        <div className="lg:col-span-3">
          {!selectedId ? (
            <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
              <EmptyState icon={<Building2 className="w-5 h-5" />} title="اختر قراراً لعرض تفاصيله" sub="المراحل والامتثال الدستوري" />
            </div>
          ) : detailQuery.isLoading ? <LoadingSpinner /> : (
            <div className="space-y-5">
              {/* Constitutional gates */}
              {dci && (
                <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                  <SectionHeader icon={<Shield className="w-4 h-4" />} title="التحقق الدستوري" />
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ...(canUseShamsiFramework ? [{ label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /> }] : []),
                      { label: 'حالة التحقق الدستوري', value: (dci.constitutionalValidationStatus as string) ?? '—' },
                      { label: 'حالة مبدأ الشرعية (LSI)', value: (dci.lsiStatus as string) ?? '—' },
                      { label: 'ختم DCI', value: <SealChip isSealed={dci.isSealed as boolean} /> },
                    ].map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <div className="text-sm font-medium">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stages (without AI analysis) */}
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<GitMerge className="w-4 h-4" />} title="حالة المراحل" />
                <div className="grid grid-cols-2 gap-2">
                  {stages.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.status === 'complete' ? 'bg-emerald-100' : s.status === 'active' ? 'bg-sky-100' : 'bg-slate-100'}`}>
                        {s.status === 'complete' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : s.status === 'active' ? <Clock className="w-3 h-3 text-sky-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                      </div>
                      <span className="text-xs font-medium truncate">{(s.titleAr as string) || `مرحلة ${(s.stageNumber as number) + 1}`}</span>
                    </div>
                  ))}
                  {stages.length === 0 && <EmptyState title="لا توجد مراحل" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 5. Department Director Dashboard ────────────────────────────────────────

function DepartmentDirectorDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['gov-decisions-dept-dir'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = (listQuery.data?.decisions as GovDecision[]) ?? [];
  const detailQuery = useQuery({
    queryKey: ['gov-detail-dept-dir', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });
  const stages: Record<string, unknown>[] = (detailQuery.data?.stages as Record<string, unknown>[]) ?? [];

  if (listQuery.isLoading) return <LoadingSpinner />;
  if (listQuery.error) return <ErrorCard message={String(listQuery.error)} />;

  const completedStages = stages.filter((s) => s.status === 'complete').length;
  const totalStages = stages.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <SectionHeader icon={<Building2 className="w-4 h-4" />} title="قرارات الإدارة" sub="عرض حالة المراحل فقط" />
        {decisions.map((d) => (
          <DecisionRow key={d.id} d={d} selected={selectedId === d.id} onClick={() => setSelectedId(d.id)} />
        ))}
        {decisions.length === 0 && <EmptyState title="لا توجد قرارات" />}
      </div>

      <div className="lg:col-span-3">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
            <EmptyState icon={<Scale className="w-5 h-5" />} title="اختر قراراً لعرض تقدم مراحله" />
          </div>
        ) : detailQuery.isLoading ? <LoadingSpinner /> : (
          <div className="bg-white rounded-xl border border-border shadow-xs p-5">
            <SectionHeader icon={<GitMerge className="w-4 h-4" />} title="تقدم المراحل" sub={`${completedStages} / ${totalStages} مرحلة مكتملة`} />
            {totalStages > 0 && (
              <div className="mb-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round((completedStages / totalStages) * 100)}%` }} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              {stages.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${s.status === 'complete' ? 'bg-emerald-50/60 border border-emerald-100' : s.status === 'active' ? 'bg-sky-50/60 border border-sky-100' : 'bg-muted/30 border border-transparent'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.status === 'complete' ? 'bg-emerald-100 text-emerald-700' : s.status === 'active' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                    {(s.stageNumber as number) + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{(s.titleAr as string) || `مرحلة ${(s.stageNumber as number) + 1}`}</p>
                    {s.completedAt ? <p className="text-[11px] text-muted-foreground">{new Date(s.completedAt as string).toLocaleDateString('ar-AE')}</p> : null}
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.status === 'complete' ? 'bg-emerald-100 text-emerald-700' : s.status === 'active' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.status === 'complete' ? '✓ مكتمل' : s.status === 'active' ? 'جارٍ' : 'معلّق'}
                  </span>
                </div>
              ))}
              {stages.length === 0 && <EmptyState title="لا توجد مراحل محفوظة" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 6. Legal Department Dashboard ───────────────────────────────────────────

function LegalDepartmentDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['gov-decisions-legal'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = (listQuery.data?.decisions as GovDecision[]) ?? [];
  const detailQuery = useQuery({
    queryKey: ['gov-detail-legal', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });

  const detail = detailQuery.data;
  const jdp = detail?.jdp as Record<string, unknown> | null;
  const dci = detail?.dci as Record<string, unknown> | null;

  if (listQuery.isLoading) return <LoadingSpinner />;
  if (listQuery.error) return <ErrorCard message={String(listQuery.error)} />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <SectionHeader icon={<BookOpen className="w-4 h-4" />} title="القرارات والأساس القانوني" sub="اختر قراراً لعرض JDP والتحليل القانوني" />
        {decisions.map((d) => (
          <DecisionRow key={d.id} d={d} selected={selectedId === d.id} onClick={() => setSelectedId(d.id)} />
        ))}
        {decisions.length === 0 && <EmptyState title="لا توجد قرارات" />}
      </div>

      <div className="lg:col-span-3">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
            <EmptyState icon={<BookOpen className="w-5 h-5" />} title="اختر قراراً لعرض التحليل القانوني والحزمة الدفاعية" />
          </div>
        ) : detailQuery.isLoading ? <LoadingSpinner /> : (
          <div className="space-y-4">
            {jdp ? (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5 space-y-4">
                <SectionHeader icon={<Gavel className="w-4 h-4" />} title="الحزمة الدفاعية القضائية (JDP)" />
                {[
                  { key: 'executiveSummary',       label: 'الملخص التنفيذي' },
                  { key: 'legalBasisValidation',   label: 'التحقق من الأساس القانوني' },
                  { key: 'constitutionalCompliance', label: 'الامتثال الدستوري' },
                  { key: 'proceduralDefense',      label: 'الدفع الإجرائي' },
                  { key: 'aiTransparencyStatement', label: 'بيان شفافية الذكاء الاصطناعي' },
                ].map(({ key, label }) => (
                  jdp[key] ? (
                    <div key={key}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                      <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">{jdp[key] as string}</p>
                    </div>
                  ) : null
                ))}
              </div>
            ) : (
              <EmptyState icon={<BookOpen className="w-5 h-5" />} title="لا توجد حزمة دفاعية قضائية لهذا القرار" sub="يجب اكتمال القرار أولاً" />
            )}

            {dci && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<Shield className="w-4 h-4" />} title="الهوية الدستورية" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {canUseShamsiFramework && <div><span className="text-xs text-muted-foreground block mb-1">الامتثال</span><ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /></div>}
                  <div><span className="text-xs text-muted-foreground block mb-1">بوابات LSI</span><span>{(dci.lsiStatus as string) ?? '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground block mb-1">الحالة الدستورية</span><span>{(dci.constitutionalValidationStatus as string) ?? '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground block mb-1">ختم DCI</span><SealChip isSealed={dci.isSealed as boolean} /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 7. Constitutional Reviewer Dashboard ─────────────────────────────────────

function ConstitutionalReviewerDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['gov-decisions-constrev'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = (listQuery.data?.decisions as GovDecision[]) ?? [];
  const detailQuery = useQuery({
    queryKey: ['gov-detail-constrev', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });

  const dci = detailQuery.data?.dci as Record<string, unknown> | null;
  const stages: Record<string, unknown>[] = (detailQuery.data?.stages as Record<string, unknown>[]) ?? [];

  if (listQuery.isLoading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <SectionHeader icon={<Shield className="w-4 h-4" />} title="مراجعة الامتثال الدستوري" sub="الوضع الدستوري لكل قرار" />
        {decisions.map((d) => (
          <div key={d.id} onClick={() => setSelectedId(d.id)} className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedId === d.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20 hover:bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{d.caseNumber}</span>
              {canUseShamsiFramework && <ComplianceChip value={d.dci?.alShamsiFrameworkCompliance} />}
            </div>
            <p className="text-sm font-medium line-clamp-1">{d.titleAr}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {d.dci?.constitutionalValidationStatus && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${d.dci.constitutionalValidationStatus === 'passed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : d.dci.constitutionalValidationStatus === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {d.dci.constitutionalValidationStatus === 'passed' ? '✓ اجتاز' : d.dci.constitutionalValidationStatus === 'failed' ? '✗ فشل' : '— معلّق'}
                </span>
              )}
              {d.dci?.lsiStatus && <span className="text-[11px] text-muted-foreground">LSI: {d.dci.lsiStatus}</span>}
            </div>
          </div>
        ))}
        {decisions.length === 0 && <EmptyState title="لا توجد قرارات" />}
      </div>

      <div className="lg:col-span-3">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
            <EmptyState icon={<Shield className="w-5 h-5" />} title="اختر قراراً لعرض التفاصيل الدستورية" />
          </div>
        ) : detailQuery.isLoading ? <LoadingSpinner /> : (
          <div className="space-y-4">
            {dci && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<Shield className="w-4 h-4" />} title="الهوية الدستورية الكاملة (DCI)" />
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ...(canUseShamsiFramework ? [{ label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /> }] : []),
                    { label: 'حالة التحقق الدستوري', value: <span className={`text-sm font-semibold ${dci.constitutionalValidationStatus === 'passed' ? 'text-emerald-600' : dci.constitutionalValidationStatus === 'failed' ? 'text-red-600' : 'text-slate-500'}`}>{(dci.constitutionalValidationStatus as string) ?? '—'}</span> },
                    { label: 'مبدأ الشرعية (LSI)', value: (dci.lsiStatus as string) ?? '—' },
                    { label: 'مستوى تباين QVA', value: (dci.qvaVarianceLevel as string) ?? '—' },
                    { label: 'عدد جولات QVA', value: String(dci.qvaRunCount ?? '—') },
                    { label: 'مؤشر تأثير الإنسان (HII)', value: <HiiChip value={dci.humanInfluenceIndex as string} /> },
                    { label: 'تأثير الذكاء الاصطناعي الفعلي', value: (dci.aiActualInfluence as string) ?? '—' },
                    { label: 'ختم DCI', value: <SealChip isSealed={dci.isSealed as boolean} /> },
                    { label: 'الحالة القانونية', value: (dci.lsiStatus as string) ?? '—' },
                    { label: 'مسؤول القرار البشري', value: (dci.humanDecisionOwner as string) ?? '—' },
                  ].map((item, i) => (
                    <div key={i} className="space-y-1">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <div className="text-sm font-medium">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Constitutional gates per stage */}
            {stages.length > 0 && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<GitMerge className="w-4 h-4" />} title="بوابات الامتثال الدستوري لكل مرحلة" />
                <div className="space-y-2">
                  {stages.map((s, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${s.status === 'complete' ? 'border-emerald-100 bg-emerald-50/40' : 'border-border bg-muted/20'}`}>
                      <span className="text-xs font-bold text-muted-foreground w-6 text-center">{(s.stageNumber as number) + 1}</span>
                      <span className="text-sm font-medium flex-1">{(s.titleAr as string) || `مرحلة ${(s.stageNumber as number) + 1}`}</span>
                      <span className={`text-[11px] font-semibold ${s.status === 'complete' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {s.status === 'complete' ? '✓ اجتازت البوابة' : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 8. Internal Auditor Dashboard ───────────────────────────────────────────

function InternalAuditorDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['gov-decisions-intaudit'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = (listQuery.data?.decisions as GovDecision[]) ?? [];

  const detailQuery = useQuery({
    queryKey: ['gov-detail-intaudit', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });

  const detail = detailQuery.data;
  const stageHashes: Record<string, unknown>[] = (detail?.stageHashes as Record<string, unknown>[]) ?? [];
  const auditLog: Record<string, unknown>[] = (detail?.auditLog as Record<string, unknown>[]) ?? [];
  const stages: Record<string, unknown>[] = (detail?.stages as Record<string, unknown>[]) ?? [];
  const dci = detail?.dci as Record<string, unknown> | null;

  if (listQuery.isLoading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <SectionHeader icon={<Eye className="w-4 h-4" />} title="جميع القرارات" sub="اختر قراراً لعرض سجل التدقيق" />
        {decisions.map((d) => (
          <DecisionRow key={d.id} d={d} selected={selectedId === d.id} onClick={() => setSelectedId(d.id)} showHii />
        ))}
        {decisions.length === 0 && <EmptyState title="لا توجد قرارات" />}
      </div>

      <div className="lg:col-span-3">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
            <EmptyState icon={<Eye className="w-5 h-5" />} title="اختر قراراً لعرض سجل التدقيق والهاشات" />
          </div>
        ) : detailQuery.isLoading ? <LoadingSpinner /> : (
          <div className="space-y-4">
            {/* HII + DCI */}
            {dci && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<Shield className="w-4 h-4" />} title="ملخص DCI" />
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-xs text-muted-foreground block mb-1">مؤشر تأثير الإنسان</span><HiiChip value={dci.humanInfluenceIndex as string} /></div>
                  <div><span className="text-xs text-muted-foreground block mb-1">تأثير الذكاء الاصطناعي الفعلي</span><span className="text-sm font-medium">{(dci.aiActualInfluence as string) ?? '—'}</span></div>
                  {canUseShamsiFramework && <div><span className="text-xs text-muted-foreground block mb-1">الامتثال</span><ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /></div>}
                  <div><span className="text-xs text-muted-foreground block mb-1">الختم</span><SealChip isSealed={dci.isSealed as boolean} /></div>
                </div>
              </div>
            )}

            {/* Stage hashes */}
            {stageHashes.length > 0 && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<Hash className="w-4 h-4" />} title="هاشات مراحل التدقيق" />
                <div className="space-y-2">
                  {stageHashes.map((sh, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30">
                      <span className="text-xs font-bold text-muted-foreground w-5 mt-0.5">{(sh.stageNumber as number) + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium mb-0.5">{sh.stageKey as string}</p>
                        {sh.auditHash
                          ? <code className="text-[10px] font-mono text-muted-foreground break-all">{(sh.auditHash as string).substring(0, 32)}…</code>
                          : <span className="text-[11px] text-red-500">هاش مفقود</span>}
                      </div>
                      {sh.auditHash
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI vs Human per stage */}
            {stages.length > 0 && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<GitMerge className="w-4 h-4" />} title="مساهمة الذكاء الاصطناعي مقابل الإنسان" />
                <div className="space-y-2">
                  {stages.map((s, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{(s.titleAr as string) || `مرحلة ${(s.stageNumber as number) + 1}`}</span>
                        {s.aiContribution ? <span className="text-[11px] text-violet-600 font-semibold">AI: {s.aiContribution as string}</span> : null}
                      </div>
                      {s.aiAnalysis ? <p className="text-[11px] text-muted-foreground line-clamp-2">{s.aiAnalysis as string}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit log */}
            {auditLog.length > 0 && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<FileText className="w-4 h-4" />} title={`سجل التدقيق (${auditLog.length} إدخال)`} />
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {auditLog.map((log, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                      <span className="text-[11px] text-muted-foreground mt-0.5 shrink-0 font-mono">
                        {new Date(log.createdAt as string).toLocaleString('ar-AE', { hour12: false })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-foreground">{log.action as string}</span>
                        {log.details ? <span className="text-[11px] text-muted-foreground ms-2">{log.details as string}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 9. External Auditor Dashboard ───────────────────────────────────────────

function ExternalAuditorDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['gov-decisions-extaudit'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = ((listQuery.data?.decisions as GovDecision[]) ?? []).filter((d) => d.dci?.isSealed);

  const detailQuery = useQuery({
    queryKey: ['gov-detail-extaudit', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });

  const dci = detailQuery.data?.dci as Record<string, unknown> | null;
  const stageHashes: Record<string, unknown>[] = (detailQuery.data?.stageHashes as Record<string, unknown>[]) ?? [];

  const handleVerify = async () => {
    if (!selectedId) return;
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const result = await apiFetch('GET', `/api/governance/decisions/${selectedId}/hash-verify`);
      setVerifyResult(result);
    } catch (e) {
      setVerifyError(String(e));
    } finally {
      setVerifying(false);
    }
  };

  if (listQuery.isLoading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <SectionHeader icon={<Lock className="w-4 h-4" />} title="القرارات المختومة فقط" sub="المدقق الخارجي يصل فقط للقرارات المختومة بالكامل" />
        {decisions.map((d) => (
          <div key={d.id} onClick={() => { setSelectedId(d.id); setVerifyResult(null); setVerifyError(null); }}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedId === d.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20 hover:bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">{d.caseNumber}</span>
              <SealChip isSealed />
            </div>
            <p className="text-sm font-medium line-clamp-1">{d.titleAr}</p>
            {canUseShamsiFramework && d.dci?.alShamsiFrameworkCompliance && <div className="mt-1"><ComplianceChip value={d.dci.alShamsiFrameworkCompliance} /></div>}
          </div>
        ))}
        {decisions.length === 0 && (
          <EmptyState icon={<Lock className="w-5 h-5" />} title="لا توجد قرارات مختومة" sub="يجب أن تكتمل القرارات وتُختم أولاً" />
        )}
      </div>

      <div className="lg:col-span-3">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
            <EmptyState icon={<Hash className="w-5 h-5" />} title="اختر قراراً للتحقق من سلامة الهاشات" sub="يُعيد النظام حساب بصمة SHA-256 ويقارنها بالمخزّنة" />
          </div>
        ) : detailQuery.isLoading ? <LoadingSpinner /> : (
          <div className="space-y-4">
            {/* DCI hash panel */}
            {dci && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<Shield className="w-4 h-4" />} title="بصمة الهوية الدستورية" />
                {dci.completeAuditHash ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">الهاش المخزّن (completeAuditHash)</p>
                    <code className="block text-xs font-mono bg-muted/60 rounded-lg p-3 break-all leading-relaxed">{dci.completeAuditHash as string}</code>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">هاش التدقيق غير متوفر لهذا القرار.</p>
                )}
                {dci.isSealed && dci.sealedAt ? (
                  <p className="text-xs text-muted-foreground mt-2">تاريخ الختم: {new Date(dci.sealedAt as string).toLocaleDateString('ar-AE')}</p>
                ) : null}
              </div>
            )}

            {/* Stage hashes */}
            {stageHashes.length > 0 && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <SectionHeader icon={<Hash className="w-4 h-4" />} title="هاشات المراحل" sub="SHA-256 لكل مرحلة على حدة" />
                <div className="space-y-1.5">
                  {stageHashes.map((sh, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <span className="text-xs font-bold text-muted-foreground w-6 text-center">{(sh.stageNumber as number) + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium mb-0.5">{sh.stageKey as string}</p>
                        <code className="text-[10px] font-mono text-muted-foreground">{sh.auditHash ? `${(sh.auditHash as string).substring(0, 20)}…` : '(مفقود)'}</code>
                      </div>
                      {sh.auditHash ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hash verify button */}
            <div className="bg-white rounded-xl border border-border shadow-xs p-5">
              <SectionHeader icon={<RefreshCw className="w-4 h-4" />} title="التحقق من سلامة السلسلة" sub="يُعيد حساب SHA-256 من هاشات المراحل ويقارنها بالمخزّن في DCI" />
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                {verifying ? 'جارٍ التحقق...' : 'تشغيل التحقق من الهاش'}
              </button>

              {verifyError && (
                <div className="mt-3"><ErrorCard message={verifyError} /></div>
              )}

              {verifyResult && (
                <div className={`mt-4 p-4 rounded-xl border-2 ${verifyResult.verified ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {verifyResult.verified
                      ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      : <XCircle className="w-6 h-6 text-red-600" />}
                    <div>
                      <p className={`font-bold ${verifyResult.verified ? 'text-emerald-700' : 'text-red-700'}`}>
                        {verifyResult.verified ? '✓ السلسلة سليمة — الهاشات متطابقة' : '✗ تحذير: الهاشات غير متطابقة'}
                      </p>
                      <p className="text-xs text-muted-foreground">{verifyResult.stagesChecked as number} مرحلة تم فحصها</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div>
                      <p className="text-muted-foreground mb-0.5">الهاش المحسوب:</p>
                      <code className="block break-all bg-white/70 p-2 rounded border">{verifyResult.computedHash as string}</code>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">الهاش المخزّن:</p>
                      <code className="block break-all bg-white/70 p-2 rounded border">{verifyResult.storedHash as string}</code>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">وقت التحقق: {verifyResult.verifiedAt as string}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 3: Custody Timeline Component ──────────────────────────────────────

interface CustodyRecord {
  id: number;
  sequenceNumber: number;
  action: string;
  actionCategory: string;
  timestamp: string;
  userId: number | null;
  userRole: string | null;
  organization: string | null;
  deviceInfo: { userAgent?: string } | null;
  ipAddress: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  legalJustification: string | null;
  aiRecommendation: string | null;
  humanModification: string | null;
  digitalSignature: string;
  previousRecordHash: string | null;
  currentRecordHash: string;
  chainHash: string;
}

const ACTION_CATEGORY_COLORS: Record<string, string> = {
  decision:   'bg-blue-100 text-blue-800 ring-blue-200',
  stage:      'bg-purple-100 text-purple-800 ring-purple-200',
  dci:        'bg-gold/15 text-gold/75 ring-gold/25',
  qva:        'bg-indigo-100 text-indigo-800 ring-indigo-200',
  car:        'bg-emerald-100 text-emerald-800 ring-emerald-200',
  jdp:        'bg-teal-100 text-teal-800 ring-teal-200',
  governance: 'bg-rose-100 text-rose-800 ring-rose-200',
};

const ACTION_LABELS: Record<string, string> = {
  'decision.created':       'إنشاء القرار',
  'decision.delegated':     'تفويض للمراجعة',
  'decision.undelegated':   'إلغاء التفويض',
  'dci.amended':            'تعديل الهوية الدستورية',
  'qva.run':                'تشغيل تحليل التباين',
  'car.generated':          'إنشاء سجل المساءلة',
  'jdp.generated':          'إنشاء الحزمة الدفاعية',
};

// ─── Constitutional Memory Tab ────────────────────────────────────────────────

const MEMORY_EVENT_LABELS: Record<string, string> = {
  'decision.created':  'إنشاء القرار',
  'stage.completed':   'استكمال مرحلة',
  'dci.generated':     'تعديل الهوية الدستورية',
  'car.generated':     'إنشاء سجل المساءلة',
  'jdp.generated':     'إنشاء الحزمة الدفاعية',
  'human.review':      'مراجعة بشرية',
  'amendment':         'تعديل',
  'appeal.filed':      'تقديم طعن',
  'court.decision':    'حكم قضائي',
  'correction':        'تصحيح',
  'closure':           'إغلاق',
  'archive':           'أرشفة',
  'memory.sealed':     'ختم الذاكرة',
  'memory.verified':   'التحقق من السلامة',
  'custody.event':     'حدث الحيازة',
};

const EVENT_ICON: Record<string, React.ReactNode> = {
  'decision.created':  <FileText className="w-3.5 h-3.5" />,
  'stage.completed':   <CheckCircle2 className="w-3.5 h-3.5" />,
  'dci.generated':     <Shield className="w-3.5 h-3.5" />,
  'car.generated':     <BookOpen className="w-3.5 h-3.5" />,
  'jdp.generated':     <Scale className="w-3.5 h-3.5" />,
  'human.review':      <Eye className="w-3.5 h-3.5" />,
  'amendment':         <GitMerge className="w-3.5 h-3.5" />,
  'appeal.filed':      <AlertTriangle className="w-3.5 h-3.5" />,
  'court.decision':    <Gavel className="w-3.5 h-3.5" />,
  'correction':        <RefreshCw className="w-3.5 h-3.5" />,
  'closure':           <Lock className="w-3.5 h-3.5" />,
  'archive':           <Archive className="w-3.5 h-3.5" />,
  'memory.sealed':     <Lock className="w-3.5 h-3.5" />,
  'memory.verified':   <ShieldCheck className="w-3.5 h-3.5" />,
  'custody.event':     <Link2 className="w-3.5 h-3.5" />,
};

interface MemoryVersion {
  memoryId: string;
  decisionVersion: number;
  constitutionalNumber: string;
  decisionHash: string;
  completeAuditHash: string;
  createdAt: string;
  decisionStatus: string | null;
  constitutionalStatus: string | null;
  complianceStatus: string | null;
  appealStatus: string | null;
  sealed: boolean;
  archiveStatus: string;
  governmentEntity: string | null;
  issuerRole: string | null;
  qva: number | null;
  lsi: number | null;
  humanInfluenceIndex: number | null;
}

interface MemoryEvent {
  id: number;
  sequenceNumber: number;
  eventType: string;
  eventSummaryAr: string | null;
  eventHash: string;
  chainHash: string;
  recordedAt: string;
  actorRole: string | null;
}

interface MemoryIntegrity {
  valid: boolean;
  versionsChecked: number;
  timelineChecked: number;
  latestChainHash: string | null;
  errors: { location: string; type: string; detail: string }[];
}

function ConstitutionalMemoryTab({ decisionId }: { decisionId: number }) {
  const [showHashes, setShowHashes] = useState(false);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  const memoryQuery = useQuery({
    queryKey: ['cm-memory', decisionId],
    queryFn: () => apiFetch('GET', `/api/memory/${decisionId}`),
  });

  const data = memoryQuery.data as {
    constitutionalNumber?: string;
    currentVersion?: number;
    totalVersions?: number;
    timelineEvents?: number;
    integrity?: MemoryIntegrity;
    current?: MemoryVersion;
    versions?: MemoryVersion[];
    timeline?: MemoryEvent[];
  } | undefined;

  if (memoryQuery.isLoading) return <LoadingSpinner />;

  if (memoryQuery.isError || !data?.current) {
    return (
      <div className="text-center py-10 space-y-2">
        <BookMarked className="w-8 h-8 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">لا توجد ذاكرة دستورية لهذا القرار بعد.</p>
        <p className="text-xs text-muted-foreground/60">ستُنشأ تلقائياً عند تسجيل أول حدث دستوري.</p>
      </div>
    );
  }

  const { current, versions = [], timeline = [], integrity } = data;
  const selectedVer = activeVersion !== null
    ? versions.find(v => v.decisionVersion === activeVersion) ?? current
    : current;

  const statusColor = (s: string | null) => {
    if (!s) return 'bg-slate-100 text-slate-500';
    if (['compliant', 'valid', 'issued', 'none'].includes(s)) return 'bg-emerald-100 text-emerald-700';
    if (['pending', 'draft', 'challenged'].includes(s)) return 'bg-gold/15 text-gold';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Header card */}
      <div className="rounded-xl border border-[#00563F]/20 bg-[#00563F]/5 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <BookMarked className="w-5 h-5 text-[#00563F] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1A1A2E]">الذاكرة الدستورية للقرار الإداري الذكي</p>
            <p className="text-xs text-[#5C5C7A] font-mono">{data.constitutionalNumber}</p>
          </div>
          {current.sealed && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" />مختوم
            </span>
          )}
          {integrity && (
            integrity.valid
              ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3" />سلسلة سليمة</span>
              : <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><ShieldAlert className="w-3 h-3" />تحذير: عُبث كُشف</span>
          )}
        </div>

        {/* Scores row */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[
            { label: 'الإصدار', value: `v${current.decisionVersion}` },
            { label: 'الأحداث', value: String(data.timelineEvents ?? 0) },
            { label: 'النسخ', value: String(data.totalVersions ?? 1) },
            { label: 'سجلات موثّقة', value: String(integrity?.versionsChecked ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/70 rounded-lg p-2 border border-[#00563F]/10">
              <p className="text-[11px] text-[#5C5C7A]">{label}</p>
              <p className="text-sm font-bold text-[#1A1A2E]">{value}</p>
            </div>
          ))}
        </div>

        {/* Status badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { label: 'حالة القرار',      val: current.decisionStatus },
            { label: 'الامتثال',          val: current.complianceStatus },
            { label: 'الوضع الدستوري',    val: current.constitutionalStatus },
            { label: 'حالة الطعن',        val: current.appealStatus },
            { label: 'الأرشيف',           val: current.archiveStatus },
          ].map(({ label, val }) => val ? (
            <span key={label} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(val)}`}>
              {label}: {val}
            </span>
          ) : null)}
        </div>
      </div>

      {/* Version tree */}
      {versions.length > 1 && (
        <div className="rounded-xl border border-border p-3 bg-white">
          <div className="flex items-center gap-1.5 mb-2">
            <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-bold text-[#1A1A2E]">شجرة الإصدارات</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {versions.map((v) => (
              <button key={v.decisionVersion}
                onClick={() => setActiveVersion(activeVersion === v.decisionVersion ? null : v.decisionVersion)}
                className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
                  (activeVersion ?? current.decisionVersion) === v.decisionVersion
                    ? 'border-[#00563F] bg-[#00563F]/10 text-[#00563F]'
                    : 'border-border text-muted-foreground hover:border-[#00563F]/40'
                }`}>
                v{v.decisionVersion}
              </button>
            ))}
          </div>
          {selectedVer && (
            <div className="mt-2 text-[11px] text-[#5C5C7A] space-y-0.5">
              <p>الهاش: <span className="font-mono">{selectedVer.decisionHash.slice(0, 24)}…</span></p>
              <p>التدقيق: <span className="font-mono">{selectedVer.completeAuditHash.slice(0, 24)}…</span></p>
              <p>التاريخ: <span className="font-mono">{new Date(selectedVer.createdAt).toLocaleString('ar-AE')}</span></p>
            </div>
          )}
        </div>
      )}

      {/* Integrity report */}
      {integrity && (
        <div className={`rounded-xl border p-3 ${integrity.valid ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            {integrity.valid ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
            <p className="text-xs font-bold text-[#1A1A2E]">تقرير سلامة الذاكرة الدستورية</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div><p className="text-muted-foreground">النسخ المفحوصة</p><p className="font-bold">{integrity.versionsChecked}</p></div>
            <div><p className="text-muted-foreground">الأحداث المفحوصة</p><p className="font-bold">{integrity.timelineChecked}</p></div>
            <div><p className="text-muted-foreground">الأخطاء</p><p className={`font-bold ${integrity.errors.length ? 'text-red-600' : 'text-emerald-600'}`}>{integrity.errors.length}</p></div>
          </div>
          {integrity.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {integrity.errors.map((e, i) => (
                <p key={i} className="text-[10px] text-red-600 bg-red-100 px-2 py-1 rounded font-mono">[{e.location}] {e.type}: {e.detail}</p>
              ))}
            </div>
          )}
          {integrity.latestChainHash && (
            <div className="mt-2 flex items-center gap-1">
              <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
              <button onClick={() => setShowHashes(!showHashes)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {showHashes ? 'إخفاء هاش السلسلة' : 'عرض هاش السلسلة'}
              </button>
              {showHashes && (
                <span className="text-[10px] font-mono text-[#3D3D5C] break-all mr-1">{integrity.latestChainHash}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-white p-3">
        <div className="flex items-center gap-1.5 mb-3">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-bold text-[#1A1A2E]">الجدول الزمني الدستوري</p>
          <span className="mr-auto text-[10px] text-muted-foreground">{timeline.length} حدث</span>
        </div>
        {timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">لا توجد أحداث مسجّلة بعد</p>
        ) : (
          <div className="space-y-0">
            {timeline.map((ev, idx) => (
              <div key={ev.id} className="relative flex gap-3">
                {/* Connector line */}
                {idx < timeline.length - 1 && (
                  <div className="absolute right-[17px] top-7 bottom-0 w-px bg-border" />
                )}
                {/* Icon */}
                <div className="shrink-0 w-8 h-8 rounded-full border-2 border-border bg-white flex items-center justify-center text-[#00563F] z-10">
                  {EVENT_ICON[ev.eventType] ?? <FileText className="w-3.5 h-3.5" />}
                </div>
                {/* Content */}
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-[#1A1A2E]">
                      {MEMORY_EVENT_LABELS[ev.eventType] ?? ev.eventType}
                    </span>
                    {ev.actorRole && (
                      <span className="text-[10px] font-semibold bg-[#F5F5FA] text-[#5C5C7A] px-1.5 py-0.5 rounded-full">
                        {ev.actorRole}
                      </span>
                    )}
                    <span className="mr-auto text-[10px] text-muted-foreground font-mono">
                      #{ev.sequenceNumber}
                    </span>
                  </div>
                  {ev.eventSummaryAr && (
                    <p className="text-[11px] text-[#5C5C7A] mt-0.5">{ev.eventSummaryAr}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {new Date(ev.recordedAt).toLocaleString('ar-AE')}
                  </p>
                  {showHashes && (
                    <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 break-all">
                      {ev.eventHash.slice(0, 32)}…
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export + AI info footer */}
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="grid grid-cols-2 gap-3 text-[11px] text-[#5C5C7A]">
          <div>
            <p className="font-bold text-[#1A1A2E] mb-1">الذكاء الاصطناعي</p>
            <p>{current.archiveStatus === 'archived' ? '📦 مؤرشف' : '🟢 نشط'}</p>
            {current.qva != null && <p>QVA: <span className="font-bold">{current.qva.toFixed(1)}</span></p>}
            {current.lsi != null && <p>LSI: <span className="font-bold">{current.lsi.toFixed(1)}</span></p>}
            {current.humanInfluenceIndex != null && <p>HII: <span className="font-bold">{current.humanInfluenceIndex.toFixed(1)}</span></p>}
          </div>
          <div>
            <p className="font-bold text-[#1A1A2E] mb-1">الإطار القانوني</p>
            <p>MARSAD-CM-v3.0</p>
            <p>UAE-Admin-Law-2026</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5">
          <DownloadCloud className="w-3 h-3 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">الذاكرة الدستورية — ملحق فقط · لا حذف · لا تعديل · دليل دستوري دائم</p>
        </div>
      </div>
    </div>
  );
}

function CustodyTimeline({ decisionId }: { decisionId: number }) {
  const [showHashes, setShowHashes] = useState(false);

  const chainQuery = useQuery({
    queryKey: ['custody-chain', decisionId],
    queryFn: () => apiFetch('GET', `/api/custody/${decisionId}`),
  });

  const verifyQuery = useQuery({
    queryKey: ['custody-verify', decisionId],
    queryFn: () => apiFetch('GET', `/api/custody/${decisionId}/verify`),
  });

  if (chainQuery.isLoading) return <LoadingSpinner label="جارٍ تحميل سلسلة الحيازة…" />;
  if (chainQuery.isError) return (
    <ErrorCard message="تعذّر تحميل سلسلة الحيازة. قد لا تملك صلاحية الوصول." />
  );

  const records = ((chainQuery.data?.chain ?? []) as CustodyRecord[]);
  const verifyData = verifyQuery.data;
  // null = still loading, true = verified OK, false = tamper detected
  const isValid: boolean | null = verifyData ? (verifyData.valid as boolean) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeader icon={<Hash className="w-4 h-4" />} title="سلسلة الحيازة القانونية" sub={`${records.length} سجل · مُلحق فقط — لا حذف ولا تعديل`} />
        <div className="flex items-center gap-2 flex-wrap">
          {isValid === null ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              جارٍ التحقق من سلامة السلسلة…
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${isValid ? 'bg-heading/15 text-heading/75' : 'bg-red-100 text-red-800'}`}>
              {isValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {isValid ? 'سلسلة سليمة' : `عُبث كُشف — موضع #${String((verifyData as {firstTamperedSequence?: number}).firstTamperedSequence ?? '?')}`}
            </div>
          )}
          <button onClick={() => setShowHashes((x) => !x)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
            {showHashes ? 'إخفاء الهاشات' : 'إظهار الهاشات'}
          </button>
        </div>
      </div>

      {/* Latest chain hash */}
      {chainQuery.data?.latestChainHash ? (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 font-mono text-[10px] text-muted-foreground break-all">
          <span className="text-[10px] font-semibold text-foreground font-sans block mb-0.5">هاش السلسلة الأخير (SHA-256):</span>
          {showHashes ? String(chainQuery.data.latestChainHash) : `${String(chainQuery.data.latestChainHash).slice(0, 24)}…${String(chainQuery.data.latestChainHash).slice(-8)}`}
        </div>
      ) : null}

      {/* Timeline */}
      <div className="space-y-0">
        {records.map((r, idx) => {
          const isLast = idx === records.length - 1;
          const cat = r.actionCategory ?? 'decision';
          const catColor = ACTION_CATEGORY_COLORS[cat] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
          const actionLabel = (() => {
            const base = r.action.startsWith('stage.completed.') ? `استكمال المرحلة: ${r.action.replace('stage.completed.', '')}` : (ACTION_LABELS[r.action] ?? r.action);
            return base;
          })();
          const ts = new Date(r.timestamp);

          return (
            <div key={r.id} className="flex gap-3">
              {/* Track */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ring-2 ring-white ${catColor}`}>
                  {r.sequenceNumber}
                </div>
                {!isLast && <div className="w-0.5 bg-border flex-1 my-1 min-h-[12px]" />}
              </div>

              {/* Card */}
              <div className={`flex-1 rounded-lg border p-3 mb-3 text-sm ${idx === 0 ? 'bg-gold/60 border-gold/25' : 'bg-white border-border'}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground text-[13px]">{actionLabel}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${catColor}`}>{cat}</span>
                    {idx === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gold/15 text-gold/75">سجل التأسيس</span>}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                    {ts.toISOString().replace('T', ' ').slice(0, 19)} UTC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                  {r.userRole && <span>الدور: <span className="text-foreground font-medium">{r.userRole}</span></span>}
                  {r.ipAddress && <span>IP: <span className="font-mono">{r.ipAddress}</span></span>}
                  {r.organization && <span className="col-span-2 truncate">الجهة: <span className="text-foreground">{r.organization}</span></span>}
                  {r.deviceInfo?.userAgent && <span className="col-span-2 truncate">المتصفح: <span className="text-foreground">{r.deviceInfo.userAgent.slice(0, 60)}…</span></span>}
                </div>

                {(r.legalJustification || r.aiRecommendation || r.humanModification) && (
                  <div className="mt-2 pt-1.5 border-t border-border space-y-0.5 text-[11px]">
                    {r.legalJustification && <p><span className="font-semibold text-foreground">التبرير القانوني: </span>{r.legalJustification}</p>}
                    {r.aiRecommendation && <p><span className="font-semibold text-violet-700">توصية الذكاء الاصطناعي: </span>{r.aiRecommendation}</p>}
                    {r.humanModification && <p><span className="font-semibold text-blue-700">التعديل البشري: </span>{r.humanModification}</p>}
                  </div>
                )}

                {showHashes && (
                  <div className="mt-2 pt-1.5 border-t border-dashed border-border space-y-1">
                    <p className="font-mono text-[9px] break-all text-muted-foreground"><span className="font-semibold text-[10px] font-sans text-foreground">هاش السجل: </span>{r.currentRecordHash}</p>
                    {r.previousRecordHash && <p className="font-mono text-[9px] break-all text-muted-foreground"><span className="font-semibold text-[10px] font-sans text-foreground">هاش السابق: </span>{r.previousRecordHash}</p>}
                    <p className="font-mono text-[9px] break-all text-muted-foreground"><span className="font-semibold text-[10px] font-sans text-foreground">هاش السلسلة: </span>{r.chainHash}</p>
                    {r.digitalSignature !== '[redacted]' && (
                      <p className="font-mono text-[9px] break-all text-muted-foreground"><span className="font-semibold text-[10px] font-sans text-foreground">التوقيع الرقمي (HMAC): </span>{r.digitalSignature}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {records.length === 0 && <EmptyState title="لا توجد سجلات حيازة بعد" sub="سيُسجَّل كل إجراء تلقائياً بمجرد تنفيذه" />}
      </div>

      {/* Verification summary */}
      {verifyData && (
        <div className={`rounded-lg border p-3 text-xs ${isValid ? 'border-heading/25 bg-heading/10' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isValid ? <Shield className="w-4 h-4 text-heading" /> : <AlertTriangle className="w-4 h-4 text-red-700" />}
            <span className={`font-bold ${isValid ? 'text-heading/75' : 'text-red-800'}`}>
              {isValid ? 'التحقق الكامل: سلسلة الحيازة سليمة — لم يُعبث بها' : `تحذير: كُشف تلاعب في السجل رقم ${String(verifyData.firstTamperedSequence ?? '?')}`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <span><span className="text-muted-foreground">السجلات المتحقق منها: </span><span className="font-mono font-bold">{String(verifyData.recordsChecked ?? 0)}</span></span>
            <span><span className="text-muted-foreground">الهاش التأسيسي: </span><span className="font-mono">{verifyData.genesisHash ? `${String(verifyData.genesisHash).slice(0, 10)}…` : '—'}</span></span>
            <span><span className="text-muted-foreground">الهاش الأخير: </span><span className="font-mono">{verifyData.latestChainHash ? `${String(verifyData.latestChainHash).slice(0, 10)}…` : '—'}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 9b. Evidence Ledger Tab (Phase 4) ───────────────────────────────────────

interface EvidenceEvent {
  id: number;
  sequenceNumber: number;
  actor: string | null;
  actorRole: string | null;
  actorOrg: string | null;
  timestamp: string;
  action: string;
  eventCategory: string;
  evidenceSummaryAr: string | null;
  evidenceSummaryEn: string | null;
  affectedObject: string | null;
  affectedObjectType: string | null;
  previousHash: string | null;
  currentHash: string;
  chainHash: string;
  digitalSignaturePlaceholder: string | null;
  metadata: Record<string, unknown> | null;
}

interface EvidenceVerification {
  valid: boolean;
  integrityScore: number;
  eventsChecked: number;
  brokenLinks: number;
  hashErrors: number;
  genesisHash: string | null;
  latestChainHash: string | null;
  errors: Array<{ sequence: number; type: string; detail: string }>;
}

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  creation:       'bg-sky-100 text-sky-700 border-sky-200',
  stage:          'bg-violet-100 text-violet-700 border-violet-200',
  identity:       'bg-gold/15 text-gold border-gold/25',
  governance:     'bg-teal-100 text-teal-700 border-teal-200',
  validation:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  accountability: 'bg-rose-100 text-rose-700 border-rose-200',
  judicial:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  archive:        'bg-slate-100 text-slate-600 border-slate-200',
  default:        'bg-muted text-muted-foreground border-border',
};

function IntegrityScoreBadge({ score, valid }: { score: number; valid: boolean }) {
  const color = valid
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 60
      ? 'bg-gold/10 text-gold border-gold/25'
      : 'bg-red-50 text-red-700 border-red-200';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${color}`}>
      {valid ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
      <span className="font-bold text-sm">{score}/100</span>
      <span className="text-xs opacity-70">{valid ? 'السلسلة سليمة' : 'تحذير: خلل في السلسلة'}</span>
    </div>
  );
}

function HashViewer({ label, hash }: { label: string; hash: string | null }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!hash) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Hash className="w-3 h-3" />
        <span>{label}:</span>
        <code className="font-mono">{expanded ? hash : `${hash.slice(0, 12)}…${hash.slice(-6)}`}</code>
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </div>
  );
}

function EvidenceEventCard({ ev, expanded, onToggle }: {
  ev: EvidenceEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const catColor = EVENT_CATEGORY_COLORS[ev.eventCategory] ?? EVENT_CATEGORY_COLORS.default;
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${expanded ? 'border-primary/30 shadow-sm' : 'border-border'}`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Sequence badge */}
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
          {ev.sequenceNumber}
        </span>
        {/* Category chip */}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${catColor}`}>
          {ev.eventCategory}
        </span>
        {/* Action + summary */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{ev.action}</p>
          {ev.evidenceSummaryAr && (
            <p className="text-[11px] text-muted-foreground truncate">{ev.evidenceSummaryAr}</p>
          )}
        </div>
        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
          {new Date(ev.timestamp).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
        {/* Hash valid indicator */}
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded inspector */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {ev.actor     && <div><span className="text-muted-foreground">الجهة: </span><span>{ev.actor}</span></div>}
            {ev.actorRole && <div><span className="text-muted-foreground">الدور: </span><span>{ev.actorRole}</span></div>}
            {ev.actorOrg  && <div><span className="text-muted-foreground">المنظمة: </span><span>{ev.actorOrg}</span></div>}
            {ev.affectedObject && (
              <div>
                <span className="text-muted-foreground">الكائن المتأثر: </span>
                <code className="font-mono text-[10px]">{ev.affectedObject}</code>
              </div>
            )}
            <div><span className="text-muted-foreground">التوقيت UTC: </span><span className="font-mono text-[10px]">{new Date(ev.timestamp).toISOString()}</span></div>
          </div>

          {/* Hash chain viewer */}
          <div className="pt-1 border-t border-border/50 space-y-0.5">
            <HashViewer label="التوقيع الرقمي" hash={ev.digitalSignaturePlaceholder} />
            <HashViewer label="الهاش الحالي" hash={ev.currentHash} />
            <HashViewer label="الهاش التراكمي" hash={ev.chainHash} />
            {ev.previousHash && <HashViewer label="الهاش السابق" hash={ev.previousHash} />}
          </div>

          {/* Link to next (visual chain node) */}
          {ev.previousHash && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-0.5">
              <Link2 className="w-3 h-3" />
              <span>مرتبط بالحدث السابق — السلسلة مستمرة</span>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            </div>
          )}

          {/* Raw metadata */}
          {ev.metadata && (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">البيانات التفصيلية</summary>
              <pre className="mt-1 p-2 bg-muted/60 rounded font-mono overflow-x-auto text-[10px] leading-relaxed">
                {JSON.stringify(ev.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceLedgerTab({ decisionId }: { decisionId: number }) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyResult, setVerifyResult] = React.useState<EvidenceVerification | null>(null);

  const query = useQuery({
    queryKey: ['evidence', decisionId],
    queryFn: () => apiFetch('GET', `/api/evidence/${decisionId}`),
    retry: false,
  });

  const data = query.data as {
    totalEvents: number;
    verification: EvidenceVerification;
    chain: EvidenceEvent[];
  } | undefined;

  const verification: EvidenceVerification | null = verifyResult ?? data?.verification ?? null;
  const chain: EvidenceEvent[] = data?.chain ?? [];

  async function handleVerify() {
    setVerifying(true);
    try {
      const result = await apiFetch('GET', `/api/evidence/${decisionId}/verify`);
      setVerifyResult(result as unknown as EvidenceVerification);
    } finally {
      setVerifying(false);
    }
  }

  async function handleExport() {
    const result = await apiFetch('GET', `/api/evidence/${decisionId}/export`);
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-package-decision-${decisionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (query.isLoading) return <LoadingSpinner />;

  if (!data || chain.length === 0) {
    return (
      <EmptyState
        icon={<Database className="w-5 h-5" />}
        title="لا توجد أدلة مسجّلة بعد"
        sub="سيتم إنشاء سجل الأدلة تلقائياً عند تنفيذ إجراءات القرار"
      />
    );
  }

  // Group events by date
  const byDate: Record<string, EvidenceEvent[]> = {};
  for (const ev of chain) {
    const d = new Date(ev.timestamp).toLocaleDateString('ar-AE');
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(ev);
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header: integrity + controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">سجل الأدلة الدستورية</span>
          <span className="text-xs text-muted-foreground">({chain.length} حدث)</span>
        </div>
        <div className="flex-1" />

        {verification && (
          <IntegrityScoreBadge score={verification.integrityScore} valid={verification.valid} />
        )}

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
        >
          {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          تحقق من السلسلة
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          تصدير قضائي
        </button>
      </div>

      {/* Integrity detail panel */}
      {verification && (
        <div className={`p-3 rounded-xl border text-xs space-y-1 ${verification.valid ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/60 border-red-200'}`}>
          <div className="flex gap-4 flex-wrap">
            <span><span className="text-muted-foreground">الأحداث المفحوصة: </span><strong>{verification.eventsChecked}</strong></span>
            <span><span className="text-muted-foreground">أخطاء الهاش: </span><strong className={verification.hashErrors ? 'text-red-600' : 'text-emerald-600'}>{verification.hashErrors}</strong></span>
            <span><span className="text-muted-foreground">كسور الروابط: </span><strong className={verification.brokenLinks ? 'text-red-600' : 'text-emerald-600'}>{verification.brokenLinks}</strong></span>
          </div>
          {verification.genesisHash && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Fingerprint className="w-3 h-3" />
              <span>هاش البداية: </span>
              <code className="font-mono">{verification.genesisHash.slice(0, 24)}…</code>
            </div>
          )}
          {verification.latestChainHash && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span>الهاش الأخير: </span>
              <code className="font-mono">{verification.latestChainHash.slice(0, 24)}…</code>
            </div>
          )}
          {verification.errors.length > 0 && (
            <div className="mt-1 pt-1 border-t border-red-200 space-y-0.5">
              {verification.errors.map((e, i) => (
                <div key={i} className="flex gap-2 text-[10px] text-red-700">
                  <XCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>[{e.sequence}] {e.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chain graph — visual linking nodes */}
      <div className="relative px-2">
        <div className="absolute right-[1.125rem] top-4 bottom-4 w-px bg-border" />
        <div className="space-y-1">
          {chain.map((ev) => (
            <div key={ev.id} className="relative flex items-start gap-3">
              {/* Node dot */}
              <div className="relative z-10 mt-3.5">
                <div className={`w-3 h-3 rounded-full border-2 border-white ring-1 ${
                  (EVENT_CATEGORY_COLORS[ev.eventCategory] ?? '').includes('sky')       ? 'bg-sky-400 ring-sky-300' :
                  (EVENT_CATEGORY_COLORS[ev.eventCategory] ?? '').includes('violet')    ? 'bg-violet-400 ring-violet-300' :
                  (EVENT_CATEGORY_COLORS[ev.eventCategory] ?? '').includes('amber')     ? 'bg-gold/80 ring-gold/40' :
                  (EVENT_CATEGORY_COLORS[ev.eventCategory] ?? '').includes('teal')      ? 'bg-teal-400 ring-teal-300' :
                  (EVENT_CATEGORY_COLORS[ev.eventCategory] ?? '').includes('indigo')    ? 'bg-indigo-400 ring-indigo-300' :
                  (EVENT_CATEGORY_COLORS[ev.eventCategory] ?? '').includes('rose')      ? 'bg-rose-400 ring-rose-300' :
                  (EVENT_CATEGORY_COLORS[ev.eventCategory] ?? '').includes('emerald')   ? 'bg-emerald-400 ring-emerald-300' :
                  'bg-slate-400 ring-slate-300'
                }`} />
              </div>
              {/* Card */}
              <div className="flex-1 pb-1">
                <EvidenceEventCard
                  ev={ev}
                  expanded={expandedId === ev.id}
                  onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chain anchors */}
      <div className="pt-2 border-t border-border/60">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          سجل الأدلة مقيّد بالإضافة فقط — لا حذف، لا تعديل. الأرشفة تتم بإضافة حدث جديد.
        </p>
      </div>
    </div>
  );
}

// ─── 9c. Judicial Intelligence Tab (Phase 5) ─────────────────────────────────

type JudicialDimensionStatus = 'compliant' | 'minor_concern' | 'significant_concern' | 'deficient' | 'not_assessed';

interface JudicialDimension {
  dimension: string;
  labelAr: string;
  labelEn: string;
  status: JudicialDimensionStatus;
  riskScore: number;
  finding: string;
  legalReference?: string | null;
}

interface ConstitutionalDefect {
  defectType: string;
  severity: 'critical' | 'major' | 'minor' | 'advisory';
  titleAr: string;
  titleEn: string;
  description: string;
  affectedDimension: string | null;
  remedyHint: string;
}

interface JudicialReviewData {
  decisionId: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'not_run';
  reviewVersion?: number;
  generatedAt?: string | null;
  constitutionalRiskScore?: number | null;
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical' | null;
  dimensions?: JudicialDimension[] | null;
  detectedDefects?: ConstitutionalDefect[] | null;
  findingsOfFact?: string[] | null;
  findingsOfLaw?: string[] | null;
  constitutionalObservations?: string[] | null;
  aiObservations?: string[] | null;
  humanOversightObservations?: string[] | null;
  suggestedJudicialReasoning?: string | null;
  outcomePrediction?: {
    outcome: string;
    confidencePercentage: number;
    reasoning: string;
    primaryRisk: string | null;
  } | null;
  remedyRecommendation?: {
    remedy: string;
    urgency: 'immediate' | 'standard' | 'advisory';
    explanation: string;
    conditions: string[];
  } | null;
  errorMessage?: string | null;
  message?: string;
}

// Circular SVG risk gauge
function RiskGauge({ score, level }: { score: number; level: string }) {
  const radius  = 42;
  const circ    = 2 * Math.PI * radius;
  const fill    = circ * (score / 100);
  const gap     = circ - fill;
  const color   = level === 'critical' ? '#ef4444' : level === 'high' ? '#f97316' : level === 'moderate' ? '#eab308' : '#22c55e';

  return (
    <div className="relative flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${fill} ${gap}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">/100</span>
      </div>
      <span className="text-[11px] font-semibold mt-1 uppercase tracking-wide" style={{ color }}>
        {level === 'critical' ? 'حرج' : level === 'high' ? 'مرتفع' : level === 'moderate' ? 'متوسط' : 'منخفض'}
      </span>
    </div>
  );
}

const DIMENSION_LABELS_AR: Record<string, string> = {
  jurisdiction:           'الاختصاص',
  procedure:              'الإجراءات',
  form:                   'الشكل',
  cause:                  'السبب',
  subject:                'المحل',
  purpose:                'الغاية',
  human_influence:        'تأثير الإنسان',
  ai_influence:           'تأثير الذكاء الاصطناعي',
  constitutional_compliance: 'الالتزام الدستوري',
  transparency:           'الشفافية',
  explainability:         'قابلية التفسير',
  proportionality:        'التناسب',
  algorithmic_bias:       'التحيز الخوارزمي',
  due_process:            'الإجراءات القانونية الواجبة',
  equality:               'المساواة',
  fundamental_rights:     'الحقوق الأساسية',
};

const DIMENSION_STATUS_COLORS: Record<JudicialDimensionStatus, string> = {
  compliant:             'bg-emerald-100 text-emerald-700 border-emerald-200',
  minor_concern:         'bg-gold/15 text-gold border-gold/25',
  significant_concern:   'bg-gold/15 text-gold border-gold/25',
  deficient:             'bg-red-100 text-red-700 border-red-200',
  not_assessed:          'bg-slate-100 text-slate-500 border-slate-200',
};

const DIMENSION_STATUS_LABELS: Record<JudicialDimensionStatus, string> = {
  compliant:             'مطابق',
  minor_concern:         'قلق بسيط',
  significant_concern:   'قلق مهم',
  deficient:             'قاصر',
  not_assessed:          'غير مقيّم',
};

const DEFECT_SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  major:    'bg-gold/10 border-gold/40 text-gold/75',
  minor:    'bg-gold/10 border-gold/40 text-gold/75',
  advisory: 'bg-sky-50 border-sky-300 text-sky-800',
};

const OUTCOME_CONFIG: Record<string, { ar: string; color: string; icon: React.ReactNode }> = {
  likely_lawful:             { ar: 'على الأرجح مشروع',          color: 'bg-emerald-50 border-emerald-300 text-emerald-800', icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" /> },
  likely_partially_unlawful: { ar: 'على الأرجح مشروع جزئياً',  color: 'bg-gold/10 border-gold/40 text-gold/75',   icon: <AlertTriangle className="w-5 h-5 text-gold" /> },
  likely_void:               { ar: 'على الأرجح باطل',           color: 'bg-red-50 border-red-300 text-red-800',            icon: <XCircle className="w-5 h-5 text-red-600" /> },
  requires_further_review:   { ar: 'يستلزم مراجعة إضافية',     color: 'bg-violet-50 border-violet-300 text-violet-800',   icon: <Eye className="w-5 h-5 text-violet-600" /> },
};

const REMEDY_CONFIG: Record<string, { ar: string; color: string }> = {
  uphold:                    { ar: 'تأييد القرار',                    color: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
  annul:                     { ar: 'إلغاء القرار',                    color: 'bg-red-50 border-red-300 text-red-800' },
  partial_annulment:         { ar: 'إلغاء جزئي',                     color: 'bg-gold/10 border-gold/40 text-gold/75' },
  remit_for_reconsideration: { ar: 'إعادة للنظر',                   color: 'bg-gold/10 border-gold/40 text-gold/75' },
  request_further_evidence:  { ar: 'طلب مزيد من الأدلة',           color: 'bg-sky-50 border-sky-300 text-sky-800' },
};

function DimensionCard({ dim, expanded, onToggle }: {
  dim: JudicialDimension;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusColor = DIMENSION_STATUS_COLORS[dim.status] ?? DIMENSION_STATUS_COLORS.not_assessed;
  const statusLabel = DIMENSION_STATUS_LABELS[dim.status] ?? dim.status;
  const riskBarColor =
    dim.riskScore >= 75 ? 'bg-red-500' :
    dim.riskScore >= 50 ? 'bg-gold/80' :
    dim.riskScore >= 25 ? 'bg-gold/80' : 'bg-emerald-400';

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${expanded ? 'border-primary/30 shadow-sm' : 'border-border'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">{dim.riskScore}</span>
        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
          <div className={`h-full rounded-full ${riskBarColor}`} style={{ width: `${dim.riskScore}%` }} />
        </div>
        <span className="text-xs font-semibold flex-1 text-right">
          {dim.labelAr || DIMENSION_LABELS_AR[dim.dimension] || dim.dimension}
        </span>
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${statusColor}`}>
          {statusLabel}
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 p-3 space-y-1.5 text-xs">
          <p className="text-foreground leading-relaxed">{dim.finding}</p>
          {dim.legalReference && (
            <p className="text-muted-foreground flex items-center gap-1">
              <BookOpen className="w-3 h-3 shrink-0" />
              <span>{dim.legalReference}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function JudicialIntelligenceTab({ decisionId }: { decisionId: number }) {
  const [running, setRunning]       = React.useState(false);
  const [runError, setRunError]     = React.useState<string | null>(null);
  const [expandedDim, setExpandedDim] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<'dimensions' | 'defects' | 'findings' | 'reasoning' | 'outcome'>('dimensions');

  const query = useQuery({
    queryKey:    ['judicial-review', decisionId],
    queryFn:     () => apiFetch('GET', `/api/judicial-review/${decisionId}`),
    retry:       false,
    refetchInterval: running ? 5000 : false,
  });

  const review = query.data as JudicialReviewData | undefined;
  const notRun  = !review || review.status === 'not_run';
  const isRunning = review?.status === 'running' || running;
  const completed  = review?.status === 'completed';
  const failed     = review?.status === 'failed';

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    try {
      await apiFetch('POST', `/api/judicial-review/${decisionId}/run`);
      await query.refetch();
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : 'فشل التشغيل');
    } finally {
      setRunning(false);
    }
  }

  async function handleExport() {
    const result = await apiFetch('GET', `/api/judicial-review/${decisionId}/report`);
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `judicial-intelligence-report-decision-${decisionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (query.isLoading) return <LoadingSpinner label="جارٍ تحميل بيانات الذكاء القضائي..." />;

  // ── Not-run state ──────────────────────────────────────────────────────────
  if (notRun || failed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Brain className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-sm mb-1">محرك المراجعة الدستورية القضائية</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            يحلل الذكاء الاصطناعي هذا القرار عبر 16 بُعداً دستورياً تماماً كما يفعل القاضي الإداري.
          </p>
          {failed && review?.errorMessage && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-1.5">
              خطأ سابق: {review.errorMessage}
            </p>
          )}
          {runError && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-1.5">{runError}</p>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isRunning
            ? <><RefreshCw className="w-4 h-4 animate-spin" />جارٍ التحليل الدستوري...</>
            : <><Brain className="w-4 h-4" />{failed ? 'إعادة تشغيل التحليل' : 'تشغيل التحليل الدستوري'}</>}
        </button>
        <p className="text-[10px] text-muted-foreground">يستغرق التحليل 20-40 ثانية</p>
      </div>
    );
  }

  // ── Running state ──────────────────────────────────────────────────────────
  if (isRunning) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <Brain className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm font-semibold">المحرك القضائي يحلل القرار...</p>
        <p className="text-xs text-muted-foreground">يتم تقييم 16 بُعداً دستورياً</p>
        <LoadingSpinner />
      </div>
    );
  }

  if (!completed || !review) return null;

  const riskScore = review.constitutionalRiskScore ?? 0;
  const riskLevel = review.riskLevel ?? 'low';
  const dims      = review.dimensions ?? [];
  const defects   = review.detectedDefects ?? [];
  const outcome   = review.outcomePrediction;
  const remedy    = review.remedyRecommendation;

  const SECTIONS = [
    { key: 'dimensions' as const, label: `الأبعاد (${dims.length})` },
    { key: 'defects'   as const, label: `العيوب (${defects.length})` },
    { key: 'findings'  as const, label: 'المستنتجات' },
    { key: 'reasoning' as const, label: 'التسبيب القضائي' },
    { key: 'outcome'   as const, label: 'النتيجة والعلاج' },
  ] as const;

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Header: risk gauge + controls ── */}
      <div className="flex items-start gap-4 flex-wrap">
        {/* Risk gauge */}
        <div className="flex flex-col items-center gap-1">
          <RiskGauge score={riskScore} level={riskLevel} />
          <span className="text-[10px] text-muted-foreground">المخاطر الدستورية</span>
        </div>

        {/* Quick stats */}
        <div className="flex-1 grid grid-cols-2 gap-2 min-w-[200px]">
          {outcome && (
            <div className={`px-3 py-2 rounded-xl border text-xs ${OUTCOME_CONFIG[outcome.outcome]?.color ?? 'bg-muted border-border'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                {OUTCOME_CONFIG[outcome.outcome]?.icon}
                <span className="font-bold text-[11px]">{OUTCOME_CONFIG[outcome.outcome]?.ar ?? outcome.outcome}</span>
              </div>
              <span className="text-[10px] opacity-70">ثقة: {outcome.confidencePercentage}%</span>
            </div>
          )}
          {remedy && (
            <div className={`px-3 py-2 rounded-xl border text-xs ${REMEDY_CONFIG[remedy.remedy]?.color ?? 'bg-muted border-border'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Gavel className="w-4 h-4" />
                <span className="font-bold text-[11px]">{REMEDY_CONFIG[remedy.remedy]?.ar ?? remedy.remedy}</span>
              </div>
              <span className="text-[10px] opacity-70">
                {remedy.urgency === 'immediate' ? '🔴 فوري' : remedy.urgency === 'standard' ? '🟡 عادي' : '🟢 استشاري'}
              </span>
            </div>
          )}
          <div className="px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs">
            <p className="font-bold text-[11px] text-foreground">{defects.filter((d) => d.severity === 'critical').length} حرج / {defects.length} عيب</p>
            <p className="text-[10px] text-muted-foreground">العيوب الدستورية</p>
          </div>
          <div className="px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs">
            <p className="font-bold text-[11px] text-foreground">{dims.filter((d) => d.status === 'compliant').length}/{dims.length}</p>
            <p className="text-[10px] text-muted-foreground">أبعاد مطابقة</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            إعادة التحليل
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            تقرير قضائي
          </button>
        </div>
      </div>

      {/* Version + timestamp */}
      {review.generatedAt && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          نُوِّلد في: {new Date(review.generatedAt).toLocaleString('ar-AE', { hour12: false })}
          {review.reviewVersion && <span className="ms-2">• الإصدار {review.reviewVersion}</span>}
        </p>
      )}

      {/* ── Section tabs ── */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeSection === s.key ? 'bg-primary text-white' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Dimensions ── */}
      {activeSection === 'dimensions' && (
        <div className="space-y-1.5">
          {dims.length === 0 ? (
            <EmptyState title="لا توجد أبعاد محللة" />
          ) : (
            dims.map((dim) => (
              <DimensionCard
                key={dim.dimension}
                dim={dim}
                expanded={expandedDim === dim.dimension}
                onToggle={() => setExpandedDim(expandedDim === dim.dimension ? null : dim.dimension)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Defects ── */}
      {activeSection === 'defects' && (
        <div className="space-y-2">
          {defects.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-700">لا توجد عيوب دستورية مكتشفة</p>
              <p className="text-xs text-muted-foreground">اجتاز القرار فحص العيوب الدستورية</p>
            </div>
          ) : (
            defects.map((d, i) => (
              <div key={i} className={`p-3 rounded-xl border ${DEFECT_SEVERITY_COLORS[d.severity] ?? 'bg-muted border-border'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-xs">{d.titleAr}</span>
                  <span className="text-[9px] uppercase tracking-wide opacity-60 ms-auto">{d.severity}</span>
                </div>
                <p className="text-[11px] leading-relaxed mb-1.5">{d.description}</p>
                {d.remedyHint && (
                  <div className="flex items-start gap-1 text-[10px] opacity-80">
                    <Zap className="w-3 h-3 shrink-0 mt-0.5" />
                    <span><strong>الإجراء المقترح:</strong> {d.remedyHint}</span>
                  </div>
                )}
                {d.affectedDimension && (
                  <p className="text-[10px] opacity-60 mt-1">البُعد المتأثر: {DIMENSION_LABELS_AR[d.affectedDimension] ?? d.affectedDimension}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Findings ── */}
      {activeSection === 'findings' && (
        <div className="space-y-4">
          {/* Findings of Fact */}
          {(review.findingsOfFact ?? []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />مستنتجات الوقائع
              </p>
              <ol className="space-y-1.5">
                {(review.findingsOfFact ?? []).map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="text-foreground leading-relaxed">{f}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {/* Findings of Law */}
          {(review.findingsOfLaw ?? []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />مستنتجات القانون
              </p>
              <ol className="space-y-1.5">
                {(review.findingsOfLaw ?? []).map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="text-foreground leading-relaxed">{f}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {/* Constitutional observations */}
          {(review.constitutionalObservations ?? []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />الملاحظات الدستورية
              </p>
              <ul className="space-y-1">
                {(review.constitutionalObservations ?? []).map((o, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-foreground">
                    <CircleDot className="w-3 h-3 shrink-0 text-primary mt-0.5" />{o}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* AI observations */}
          {(review.aiObservations ?? []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />ملاحظات الذكاء الاصطناعي
              </p>
              <ul className="space-y-1">
                {(review.aiObservations ?? []).map((o, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-foreground">
                    <CircleDot className="w-3 h-3 shrink-0 text-sky-500 mt-0.5" />{o}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Human oversight observations */}
          {(review.humanOversightObservations ?? []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />ملاحظات الرقابة البشرية
              </p>
              <ul className="space-y-1">
                {(review.humanOversightObservations ?? []).map((o, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-foreground">
                    <CircleDot className="w-3 h-3 shrink-0 text-teal-500 mt-0.5" />{o}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Suggested Judicial Reasoning ── */}
      {activeSection === 'reasoning' && (
        <div className="bg-muted/30 rounded-xl border border-border p-4">
          <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5" />
            التسبيب القضائي المقترح
          </p>
          {review.suggestedJudicialReasoning ? (
            <p className="text-sm text-foreground leading-loose font-serif whitespace-pre-wrap">
              {review.suggestedJudicialReasoning}
            </p>
          ) : (
            <EmptyState title="لا يوجد تسبيب قضائي" />
          )}
          <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border flex items-center gap-1">
            <Info className="w-3 h-3" />
            هذا التسبيب مقترح من محرك الذكاء الاصطناعي وليس حكماً قضائياً. يجب مراجعته من قاضٍ مختص.
          </p>
        </div>
      )}

      {/* ── Outcome + Remedy ── */}
      {activeSection === 'outcome' && (
        <div className="space-y-3">
          {/* Outcome prediction */}
          {outcome && (
            <div className={`p-4 rounded-xl border ${OUTCOME_CONFIG[outcome.outcome]?.color ?? 'bg-muted border-border'}`}>
              <div className="flex items-center gap-2 mb-2">
                {OUTCOME_CONFIG[outcome.outcome]?.icon}
                <span className="font-bold text-sm">{OUTCOME_CONFIG[outcome.outcome]?.ar ?? outcome.outcome}</span>
                <span className="ms-auto">
                  <span className="text-xs font-bold">{outcome.confidencePercentage}%</span>
                  <span className="text-[10px] opacity-70"> ثقة</span>
                </span>
              </div>
              {/* Confidence bar */}
              <div className="w-full h-1.5 bg-white/50 rounded-full mb-3">
                <div
                  className="h-full rounded-full bg-current opacity-60"
                  style={{ width: `${outcome.confidencePercentage}%` }}
                />
              </div>
              <p className="text-xs leading-relaxed mb-2">{outcome.reasoning}</p>
              {outcome.primaryRisk && (
                <div className="flex items-start gap-1.5 text-[11px] opacity-80">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>المخاطر الرئيسية:</strong> {outcome.primaryRisk}</span>
                </div>
              )}
            </div>
          )}

          {/* Remedy */}
          {remedy && (
            <div className={`p-4 rounded-xl border ${REMEDY_CONFIG[remedy.remedy]?.color ?? 'bg-muted border-border'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Gavel className="w-4 h-4" />
                <span className="font-bold text-sm">{REMEDY_CONFIG[remedy.remedy]?.ar ?? remedy.remedy}</span>
                <span className={`ms-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  remedy.urgency === 'immediate' ? 'bg-red-200 text-red-800' :
                  remedy.urgency === 'standard'  ? 'bg-gold/25 text-gold/75' :
                  'bg-heading/25 text-heading/75'
                }`}>
                  {remedy.urgency === 'immediate' ? 'فوري' : remedy.urgency === 'standard' ? 'عادي' : 'استشاري'}
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-2">{remedy.explanation}</p>
              {remedy.conditions.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold mb-1">الشروط الواجب توافرها:</p>
                  <ul className="space-y-0.5">
                    {remedy.conditions.map((c, i) => (
                      <li key={i} className="flex gap-1.5 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
            <Info className="w-3 h-3" />
            هذه توقعات وتوصيات مولّدة بالذكاء الاصطناعي لإرشاد القاضي. لا تُشكّل حكماً قانونياً ملزماً.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── 10. Judge Dashboard ──────────────────────────────────────────────────────

function JudgeDashboard() {
  const { canUseShamsiFramework } = useUserContext();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'stages' | 'jdp' | 'dci' | 'car' | 'audit' | 'custody' | 'memory' | 'evidence' | 'judicial'>('stages');

  const listQuery = useQuery({
    queryKey: ['gov-decisions-judge'],
    queryFn: () => apiFetch('GET', '/api/governance/decisions'),
  });
  const decisions: GovDecision[] = (listQuery.data?.decisions as GovDecision[]) ?? [];

  const detailQuery = useQuery({
    queryKey: ['gov-detail-judge', selectedId],
    queryFn: () => apiFetch('GET', `/api/governance/decisions/${selectedId}/permitted`),
    enabled: selectedId !== null,
  });

  const detail = detailQuery.data;
  const stages: Record<string, unknown>[] = (detail?.stages as Record<string, unknown>[]) ?? [];
  const jdp = detail?.jdp as Record<string, unknown> | null;
  const dci = detail?.dci as Record<string, unknown> | null;
  const car = detail?.car as Record<string, unknown> | null;
  const auditLog: Record<string, unknown>[] = (detail?.auditLog as Record<string, unknown>[]) ?? [];
  const stageHashes: Record<string, unknown>[] = (detail?.stageHashes as Record<string, unknown>[]) ?? [];

  if (listQuery.isLoading) return <LoadingSpinner />;

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'stages',   label: 'المراحل' },
    { key: 'jdp',      label: 'الحزمة الدفاعية' },
    { key: 'dci',      label: 'الهوية الدستورية' },
    { key: 'car',      label: 'سجل المساءلة' },
    { key: 'audit',    label: 'سجل التدقيق' },
    { key: 'custody',  label: '⛓ الحيازة' },
    { key: 'memory',   label: '📜 الذاكرة الدستورية' },
    { key: 'evidence', label: '🔐 سجل الأدلة' },
    { key: 'judicial', label: '⚖️ الذكاء القضائي' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <SectionHeader icon={<Gavel className="w-4 h-4" />} title="سجلات القضايا" sub="اختر قضية للاطلاع على السجل الكامل" />
        {decisions.map((d) => (
          <div key={d.id} onClick={() => { setSelectedId(d.id); setTab('stages'); }}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedId === d.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20 hover:bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{d.caseNumber}</span>
              <StatusChip status={d.status} />
              <SealChip isSealed={d.dci?.isSealed} />
            </div>
            <p className="text-sm font-medium line-clamp-1">{d.titleAr}</p>
            <div className="mt-1 flex gap-2">
              {canUseShamsiFramework && <ComplianceChip value={d.dci?.alShamsiFrameworkCompliance} />}
            </div>
          </div>
        ))}
        {decisions.length === 0 && <EmptyState title="لا توجد قرارات" />}
      </div>

      <div className="lg:col-span-3">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
            <EmptyState icon={<Gavel className="w-5 h-5" />} title="اختر قضية لعرض السجل القانوني الكامل" sub="القاضي يصل للمراحل والحزمة الدفاعية والهوية الدستورية وسجل المساءلة وسجل التدقيق" />
          </div>
        ) : detailQuery.isLoading ? <LoadingSpinner /> : (
          <div>
            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-muted/40 p-1 rounded-xl">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 text-xs py-2 px-1 rounded-lg font-semibold transition-colors ${tab === t.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === 'stages' && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5 space-y-2">
                {stages.map((s, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${s.status === 'complete' ? 'border-emerald-100 bg-emerald-50/40' : 'border-border bg-muted/20'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">{(s.stageNumber as number) + 1}.</span>
                      <span className="text-sm font-medium flex-1">{(s.titleAr as string) || (s.stageKey as string)}</span>
                      <span className={`text-[11px] font-semibold ${s.status === 'complete' ? 'text-emerald-600' : s.status === 'active' ? 'text-sky-600' : 'text-slate-400'}`}>
                        {s.status === 'complete' ? '✓' : s.status === 'active' ? '⋯' : '○'}
                      </span>
                    </div>
                    {s.aiAnalysis ? <p className="text-xs text-muted-foreground line-clamp-3">{s.aiAnalysis as string}</p> : null}
                  </div>
                ))}
                {stages.length === 0 && <EmptyState title="لا توجد مراحل" />}
              </div>
            )}

            {tab === 'jdp' && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5 space-y-4">
                {jdp ? (
                  [
                    { key: 'executiveSummary',       label: 'الملخص التنفيذي' },
                    { key: 'legalBasisValidation',   label: 'التحقق من الأساس القانوني' },
                    { key: 'constitutionalCompliance', label: 'الامتثال الدستوري' },
                    { key: 'proceduralDefense',      label: 'الدفع الإجرائي' },
                    { key: 'aiTransparencyStatement', label: 'بيان شفافية الذكاء الاصطناعي' },
                    { key: 'counterArgumentResponse', label: 'الرد على الحجج المضادة' },
                  ].map(({ key, label }) => (
                    jdp[key] ? (
                      <div key={key}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                        <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">{jdp[key] as string}</p>
                      </div>
                    ) : null
                  ))
                ) : <EmptyState title="لا توجد حزمة دفاعية لهذا القرار" />}
              </div>
            )}

            {tab === 'dci' && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                {dci ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ...(canUseShamsiFramework ? [{ label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /> }] : []),
                      { label: 'حالة التحقق الدستوري', value: (dci.constitutionalValidationStatus as string) ?? '—' },
                      { label: 'مؤشر تأثير الإنسان', value: <HiiChip value={dci.humanInfluenceIndex as string} /> },
                      { label: 'تأثير الذكاء الاصطناعي الفعلي', value: (dci.aiActualInfluence as string) ?? '—' },
                      { label: 'مبدأ الشرعية (LSI)', value: (dci.lsiStatus as string) ?? '—' },
                      { label: 'مستوى تباين QVA', value: (dci.qvaVarianceLevel as string) ?? '—' },
                      { label: 'الحالة القانونية', value: (dci.lsiStatus as string) ?? '—' },
                      { label: 'مسؤول القرار البشري', value: (dci.humanDecisionOwner as string) ?? '—' },
                      { label: 'ختم DCI', value: <SealChip isSealed={dci.isSealed as boolean} /> },
                    ].map((item, i) => (
                      <div key={i} className="space-y-1">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <div className="text-sm font-medium">{item.value}</div>
                      </div>
                    ))}
                    {dci.completeAuditHash ? (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">بصمة التدقيق الكاملة</p>
                        <code className="block text-[10px] font-mono bg-muted/60 p-2 rounded break-all">{dci.completeAuditHash as string}</code>
                      </div>
                    ) : null}
                    {/* Stage hashes */}
                    {stageHashes.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">هاشات المراحل</p>
                        <div className="space-y-1.5">
                          {stageHashes.map((sh, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                              <span className="w-4 text-muted-foreground">{(sh.stageNumber as number) + 1}</span>
                              <span className="text-muted-foreground">{sh.stageKey as string}</span>
                              <span className="flex-1 truncate">{sh.auditHash ? `${(sh.auditHash as string).substring(0, 24)}…` : '(مفقود)'}</span>
                              {sh.auditHash ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-400" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : <EmptyState title="لا توجد هوية دستورية لهذا القرار" />}
              </div>
            )}

            {tab === 'car' && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5 space-y-4">
                {car ? (
                  [
                    { key: 'decisionSummary',       label: 'ملخص القرار' },
                    { key: 'rightsAffected',         label: 'الحقوق المتأثرة' },
                    { key: 'legalJustification',     label: 'المبرر القانوني' },
                    { key: 'constitutionalBasis',    label: 'الأساس الدستوري' },
                    { key: 'proceduresFollowed',     label: 'الإجراءات المتبعة' },
                    { key: 'aiRoleDisclosure',       label: 'دور الذكاء الاصطناعي' },
                    { key: 'appealInformation',      label: 'معلومات الطعن' },
                    { key: 'contactInformation',     label: 'معلومات التواصل' },
                  ].map(({ key, label }) => (
                    (car as Record<string, unknown>)[key] ? (
                      <div key={key}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                        <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">{(car as Record<string, unknown>)[key] as string}</p>
                      </div>
                    ) : null
                  ))
                ) : <EmptyState title="لا يوجد سجل مساءلة دستورية لهذا القرار" sub="يجب اكتمال القرار أولاً" />}
              </div>
            )}

            {tab === 'audit' && (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                {auditLog.length > 0 ? (
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {auditLog.map((log, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                        <span className="text-[11px] text-muted-foreground mt-0.5 shrink-0 font-mono">
                          {new Date(log.createdAt as string).toLocaleString('ar-AE', { hour12: false })}
                        </span>
                        <div>
                          <span className="text-[11px] font-semibold">{log.action as string}</span>
                          {log.details ? <span className="text-[11px] text-muted-foreground ms-2">{log.details as string}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState title="لا توجد سجلات تدقيق" />}
              </div>
            )}

            {tab === 'custody' && selectedId ? (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <CustodyTimeline decisionId={selectedId} />
              </div>
            ) : null}

            {tab === 'memory' && selectedId ? (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <ConstitutionalMemoryTab decisionId={selectedId} />
              </div>
            ) : null}

            {tab === 'evidence' && selectedId ? (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <EvidenceLedgerTab decisionId={selectedId} />
              </div>
            ) : null}

            {tab === 'judicial' && selectedId ? (
              <div className="bg-white rounded-xl border border-border shadow-xs p-5">
                <JudicialIntelligenceTab decisionId={selectedId} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Legacy role fallback (owner / supervisor / viewer) ───────────────────────

function LegacyGovernanceView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-6 shadow-xs">
          <SectionHeader icon={<Scale className="w-4 h-4" />} title="مركز الحوكمة التنفيذية — المرحلة 2" sub="بوابة الحوكمة المتعددة الأدوار" />
          <p className="text-sm text-muted-foreground mb-4">
            أنت حالياً تستخدم دور منصة تقليدي. لعرض لوحة الحوكمة الخاصة بدور معين، استخدم محدد الأدوار في الرأس لتبديل إلى أحد الأدوار التنفيذية.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { role: 'minister',    label: 'وزير', desc: 'ملخص تنفيذي' },
              { role: 'undersecretary', label: 'وكيل وزارة', desc: 'قائمة القرارات + إحالة' },
              { role: 'constitutional_reviewer', label: 'مراجع دستوري', desc: 'التحقق الدستوري' },
              { role: 'judge', label: 'قاضٍ', desc: 'السجل القانوني الكامل' },
              { role: 'external_auditor', label: 'مدقق خارجي', desc: 'التحقق من الهاشات' },
              { role: 'citizen', label: 'مواطن', desc: 'بحث بسجل المساءلة' },
            ].map((item) => (
              <div key={item.role} className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
          <SectionHeader icon={<Shield className="w-4 h-4" />} title="قم بتبديل الدور" />
          <p className="text-sm text-muted-foreground">استخدم القائمة المنسدلة في أعلى الصفحة لتجربة أي من الأدوار الـ 11 الجديدة.</p>
          <div className="mt-4 p-3 rounded-lg bg-sky-50 border border-sky-200">
            <p className="text-xs text-sky-700 font-semibold">المرحلة 2 — طبقة الحوكمة التنفيذية</p>
            <p className="text-xs text-sky-600 mt-1">كل دور يرى فقط البيانات المصرّح له بها قانونياً.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Role banner ──────────────────────────────────────────────────────────────

function RoleBanner({ role }: { role: string }) {
  const meta = ROLE_META[role as keyof typeof ROLE_META];
  if (!meta) return null;
  const tierColors: Record<string, string> = {
    legacy:    'bg-gold/10 border-gold/25 text-gold/75',
    executive: 'bg-sky-50 border-sky-200 text-sky-800',
    oversight: 'bg-violet-50 border-violet-200 text-violet-800',
    judicial:  'bg-emerald-50 border-emerald-200 text-emerald-800',
    public:    'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border mb-6 ${tierColors[meta.tier] ?? 'bg-muted/40 border-border text-muted-foreground'}`}>
      <Shield className="w-4 h-4 shrink-0" />
      <div>
        <span className="font-bold text-sm">{meta.ar}</span>
        <span className="text-xs ms-2 opacity-70">— {meta.en}</span>
      </div>
      <div className="flex-1" />
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
        {meta.tier === 'executive' ? 'الإدارة التنفيذية' : meta.tier === 'oversight' ? 'الرقابة والمراجعة' : meta.tier === 'judicial' ? 'القضاء' : meta.tier === 'public' ? 'المواطن' : 'أدوار المنصة'}
      </span>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function GovernanceHub() {
  const { role, lang, canViewGovernanceDashboard, canUseShamsiFramework } = useUserContext();

  // Citizen goes to /citizen portal
  if (role === 'citizen') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold mb-2">بوابة المواطن</h1>
          <p className="text-muted-foreground text-sm mb-6">يمكنك البحث عن قرار إداري باستخدام رقم القضية والاطلاع على سجل المساءلة الدستورية.</p>
          <Link href="/citizen">
            <button className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
              انتقل إلى بوابة المواطن
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!canViewGovernanceDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">غير مصرّح بالوصول</h2>
          <p className="text-sm text-muted-foreground">دورك الحالي لا يملك صلاحية الوصول إلى مركز الحوكمة.</p>
        </div>
      </div>
    );
  }

  const titleMap: Record<string, string> = {
    minister:                 'لوحة قيادة الوزير',
    undersecretary:           'لوحة وكيل الوزارة',
    assistant_undersecretary: 'لوحة وكيل الوزارة المساعد',
    director_general:         'لوحة المدير العام',
    department_director:      'لوحة مدير الإدارة',
    legal_department:         'الإدارة القانونية',
    constitutional_reviewer:  'المراجع الدستوري',
    internal_auditor:         'المدقق الداخلي',
    external_auditor:         'المدقق الخارجي',
    judge:                    'السجل القضائي الكامل',
    owner:                    'مركز الحوكمة التنفيذية',
    supervisor:               'مركز الحوكمة التنفيذية',
    viewer:                   'مركز الحوكمة التنفيذية',
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-2">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          {titleMap[role] ?? 'مركز الحوكمة التنفيذية'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {canUseShamsiFramework
            ? (lang === 'ar'
                ? 'طبقة الحوكمة التنفيذية — المرحلة 2 | إطار الشامسي™'
                : 'Executive Governance Layer — Phase 2 | Al-Shamsi Framework™')
            : (lang === 'ar'
                ? 'طبقة الحوكمة التنفيذية — المرحلة 2'
                : 'Executive Governance Layer — Phase 2')}
        </p>
      </div>

      <RoleBanner role={role} />

      {/* Route to role-specific dashboard */}
      {role === 'minister'                 && <MinisterDashboard />}
      {role === 'undersecretary'           && <UndersecretaryDashboard />}
      {role === 'assistant_undersecretary' && <AssistantUndersecretaryDashboard />}
      {role === 'director_general'         && <DirectorGeneralDashboard />}
      {role === 'department_director'      && <DepartmentDirectorDashboard />}
      {role === 'legal_department'         && <LegalDepartmentDashboard />}
      {role === 'constitutional_reviewer'  && <ConstitutionalReviewerDashboard />}
      {role === 'internal_auditor'         && <InternalAuditorDashboard />}
      {role === 'external_auditor'         && <ExternalAuditorDashboard />}
      {role === 'judge'                    && <JudgeDashboard />}
      {(role === 'owner' || role === 'supervisor' || role === 'viewer') && <LegacyGovernanceView />}

      {/* Footer */}
      <div className="pt-8 border-t border-border">
        <p className="text-center text-xs text-muted-foreground">
          {canUseShamsiFramework
            ? 'مرصد (MARSAD) Alpha 1.0 · منصة القرارات الإدارية الذكية · إطار الشامسي الدستوري™'
            : 'مرصد (MARSAD) Alpha 1.0 · منصة القرارات الإدارية الذكية'}
        </p>
      </div>
    </div>
  );
}
