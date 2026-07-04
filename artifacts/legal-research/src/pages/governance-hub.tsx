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
  Building2, BookOpen, GitMerge,
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
    pending_review:    { label: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${s.cls}`}>{s.label}</span>;
}

function ComplianceChip({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    full:    { label: 'امتثال كامل', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    partial: { label: 'امتثال جزئي', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <Flag className="w-3 h-3" />مُحالة للمراجعة
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-1 mb-1">{d.titleAr}</p>
        <div className="flex items-center gap-3 flex-wrap">
          {d.dci?.alShamsiFrameworkCompliance && <ComplianceChip value={d.dci.alShamsiFrameworkCompliance} />}
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
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
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
                <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
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
              { label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={decisions[0].dci.alShamsiFrameworkCompliance} /> },
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
                  <div><span className="text-xs text-muted-foreground block mb-1">الامتثال</span><ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /></div>
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
                      { label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /> },
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
                  <div><span className="text-xs text-muted-foreground block mb-1">الامتثال</span><ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /></div>
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
              <ComplianceChip value={d.dci?.alShamsiFrameworkCompliance} />
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
                    { label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /> },
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
                  <div><span className="text-xs text-muted-foreground block mb-1">الامتثال</span><ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /></div>
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
            {d.dci?.alShamsiFrameworkCompliance && <div className="mt-1"><ComplianceChip value={d.dci.alShamsiFrameworkCompliance} /></div>}
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

// ─── 10. Judge Dashboard ──────────────────────────────────────────────────────

function JudgeDashboard() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'stages' | 'jdp' | 'dci' | 'car' | 'audit'>('stages');

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
    { key: 'stages', label: 'المراحل' },
    { key: 'jdp',    label: 'الحزمة الدفاعية' },
    { key: 'dci',    label: 'الهوية الدستورية' },
    { key: 'car',    label: 'سجل المساءلة' },
    { key: 'audit',  label: 'سجل التدقيق' },
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
              <ComplianceChip value={d.dci?.alShamsiFrameworkCompliance} />
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
                      { label: 'الامتثال لإطار الشامسي', value: <ComplianceChip value={dci.alShamsiFrameworkCompliance as string} /> },
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
    legacy:    'bg-amber-50 border-amber-200 text-amber-800',
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
  const { role, lang, canViewGovernanceDashboard } = useUserContext();

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
          {lang === 'ar'
            ? 'طبقة الحوكمة التنفيذية — المرحلة 2 | إطار الشامسي™'
            : 'Executive Governance Layer — Phase 2 | Al-Shamsi Framework™'}
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
          Powered by the M. Al-Shamsi Framework™ — Phase 2 Executive Governance Layer
        </p>
      </div>
    </div>
  );
}
