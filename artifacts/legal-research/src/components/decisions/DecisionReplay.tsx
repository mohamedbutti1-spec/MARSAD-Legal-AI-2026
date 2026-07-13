/**
 * Decision Replay Engine — UI Component
 * 14-stage immutable audit trail replay viewer.
 * M. Al-Shamsi Framework™ · MARSAD Constitutional Standard v1.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Play, ChevronUp, ChevronDown, Check, Clock, AlertTriangle,
  Shield, FileText, Users, Scale, Sparkles, Hash, Link2,
  ArrowUp, ArrowDown, X, Activity, Loader2, Info, Lock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayStage {
  replayStageKey: string;
  stageNumber: number;
  labelAr: string;
  labelEn: string;
  status: 'complete' | 'skipped' | 'pending';
  timestamp: string | null;
  actor: string | null;
  actorRole: string | null;
  confidenceScore: number | null;
  // Detail fields
  inputs: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  evidenceUsed: unknown[] | null;
  legalArticles: string[];
  caselaw: string[];
  constitutionalReferences: string[];
  adminLawReferences: string[];
  reasoningNarrative: string | null;
  appliedLegalWeight: number | null;
  alShamsiDimensions: Record<string, unknown> | null;
  riskIndicators: string[];
  humanInterventionRecord: Record<string, unknown> | null;
  auditLogEntries: unknown[];
  aiModelName: string | null;
  promptHash: string | null;
  auditHash: string | null;
  immutableLogId: number | null;
}

interface ReplayTimeline {
  decisionId: number;
  caseNumber: string;
  stages: ReplayStage[];
  generatedAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

function apiFetch(path: string) {
  const role = localStorage.getItem('userRole') || 'owner';
  return fetch(path, {
    headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
  }).then(async (r) => {
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error((e as { error?: string }).error || r.statusText);
    }
    return r.json();
  });
}

// ─── Stage Status Ring ────────────────────────────────────────────────────────

function StatusRing({ status }: { status: 'complete' | 'skipped' | 'pending' }) {
  if (status === 'complete') return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/50 border-2 border-emerald-400 dark:border-emerald-600 shrink-0">
      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
    </div>
  );
  if (status === 'skipped') return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gold/10 dark:bg-gold/30 border-2 border-gold/40 dark:border-gold shrink-0">
      <AlertTriangle className="w-3.5 h-3.5 text-gold" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted border-2 border-border/60 shrink-0">
      <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
    </div>
  );
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 80
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40'
    : pct >= 60
      ? 'text-gold bg-gold/10 border-gold/25 dark:text-gold/80 dark:bg-gold/30 dark:border-gold/40'
      : 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${color}`}>
      <Activity className="w-2.5 h-2.5" /> {pct}%
    </span>
  );
}

// ─── Section helpers ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
      {children}
    </h4>
  );
}

function NotRecorded() {
  return <span className="text-xs text-muted-foreground/50 italic">لم يُسجَّل</span>;
}

function ReferenceList({ items, emptyText }: { items: string[]; emptyText?: string }) {
  if (!items || items.length === 0) return <NotRecorded />;
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
          <span className="text-muted-foreground/40 font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}.</span>
          <span className="leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stage Detail Panel ───────────────────────────────────────────────────────

function StageDetailPanel({ stage }: { stage: ReplayStage }) {
  const hasInputs = stage.inputs && Object.keys(stage.inputs).length > 0;
  const hasOutputs = stage.outputs && Object.keys(stage.outputs).length > 0;

  return (
    <div className="border-t border-border/40 bg-muted/20 divide-y divide-border/30">

      {/* Inputs / Outputs */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <SectionHeading>المُدخلات</SectionHeading>
          {hasInputs ? (
            <div className="space-y-1.5">
              {Object.entries(stage.inputs!).slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-[11px]">
                  <span className="font-mono text-muted-foreground/50 shrink-0 mt-px">{k}:</span>
                  <span className="text-foreground/70 leading-snug break-all">
                    {typeof v === 'boolean' ? (v ? 'نعم' : 'لا') :
                     typeof v === 'string' ? v.substring(0, 120) :
                     JSON.stringify(v).substring(0, 80)}
                  </span>
                </div>
              ))}
            </div>
          ) : <NotRecorded />}
        </div>
        <div>
          <SectionHeading>المُخرجات</SectionHeading>
          {hasOutputs ? (
            <div className="space-y-1.5">
              {Object.entries(stage.outputs!).slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-[11px]">
                  <span className="font-mono text-muted-foreground/50 shrink-0 mt-px">{k}:</span>
                  <span className="text-foreground/70 leading-snug break-all">
                    {typeof v === 'boolean' ? (v ? 'نعم ✓' : 'لا ✗') :
                     typeof v === 'string' ? v.substring(0, 120) :
                     Array.isArray(v) ? `[${(v as unknown[]).length} عناصر]` :
                     JSON.stringify(v).substring(0, 80)}
                  </span>
                </div>
              ))}
            </div>
          ) : <NotRecorded />}
        </div>
      </div>

      {/* Reasoning Narrative */}
      <div className="p-4">
        <SectionHeading>السرد الاستدلالي</SectionHeading>
        {stage.reasoningNarrative
          ? <p className="text-xs text-foreground/80 leading-relaxed">{stage.reasoningNarrative}</p>
          : <NotRecorded />}
      </div>

      {/* Legal References */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <SectionHeading>المواد القانونية</SectionHeading>
          <ReferenceList items={stage.legalArticles} />
        </div>
        <div>
          <SectionHeading>المراجع الدستورية</SectionHeading>
          <ReferenceList items={stage.constitutionalReferences} />
        </div>
        <div>
          <SectionHeading>مراجع القانون الإداري</SectionHeading>
          <ReferenceList items={stage.adminLawReferences} />
        </div>
      </div>

      {/* Al-Shamsi Dimensions */}
      {stage.alShamsiDimensions && Object.keys(stage.alShamsiDimensions).length > 0 && (
        <div className="p-4">
          <SectionHeading>أبعاد الشامسي المُطبَّقة</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(stage.alShamsiDimensions).slice(0, 12).map(([dim, val]) => {
              const passed = typeof val === 'object' && val !== null && 'passed' in val
                ? (val as { passed: boolean }).passed
                : null;
              return (
                <div key={dim} className="flex items-center gap-1.5 text-[10px]">
                  {passed === true && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                  {passed === false && <X className="w-3 h-3 text-red-500 shrink-0" />}
                  {passed === null && <Info className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                  <span className="text-foreground/70 font-mono">{dim}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legal Weight + Risk Indicators */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <SectionHeading>الثقل القانوني المُطبَّق</SectionHeading>
          {stage.appliedLegalWeight !== null
            ? <span className="text-sm font-bold text-foreground">{(stage.appliedLegalWeight * 100).toFixed(0)}%</span>
            : <NotRecorded />}
        </div>
        <div>
          <SectionHeading>مؤشرات المخاطر</SectionHeading>
          {stage.riskIndicators && stage.riskIndicators.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {stage.riskIndicators.map((r, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 dark:bg-gold/30 border border-gold/25 dark:border-gold/40 text-gold dark:text-gold/80">
                  {r}
                </span>
              ))}
            </div>
          ) : <span className="text-xs text-emerald-600 dark:text-emerald-400 text-sm">لا مخاطر مُسجَّلة</span>}
        </div>
      </div>

      {/* Human Intervention */}
      <div className="p-4">
        <SectionHeading>سجل التدخل البشري</SectionHeading>
        {stage.humanInterventionRecord && Object.keys(stage.humanInterventionRecord).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(stage.humanInterventionRecord).slice(0, 6).map(([k, v]) => (
              <div key={k} className="text-[11px]">
                <span className="font-bold text-muted-foreground/60">{k}: </span>
                <span className="text-foreground/80">
                  {typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v).substring(0, 60)}
                </span>
              </div>
            ))}
          </div>
        ) : <NotRecorded />}
      </div>

      {/* Evidence Used */}
      <div className="p-4">
        <SectionHeading>الأدلة المُستخدَمة ({stage.evidenceUsed?.length ?? 0} إدخالاً)</SectionHeading>
        {stage.evidenceUsed && stage.evidenceUsed.length > 0 ? (
          <div className="space-y-1">
            {(stage.evidenceUsed as Record<string, unknown>[]).slice(0, 5).map((ev, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-border/20 last:border-0">
                <span className="font-mono text-muted-foreground/40 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-muted-foreground/60 font-mono shrink-0">{String(ev.action ?? '')}</span>
                <span className="text-foreground/60 flex-1 truncate">{String(ev.evidenceSummaryAr ?? ev.action ?? '')}</span>
              </div>
            ))}
          </div>
        ) : <NotRecorded />}
      </div>

      {/* Audit Trail */}
      <div className="p-4">
        <SectionHeading>سجل التدقيق</SectionHeading>
        {stage.auditLogEntries && stage.auditLogEntries.length > 0 ? (
          <div className="space-y-1">
            {(stage.auditLogEntries as Record<string, unknown>[]).slice(0, 5).map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
                <span className="font-mono text-muted-foreground/40">{String(log.action ?? '')}</span>
                {log.createdAt != null && <span className="text-muted-foreground/40 font-mono" dir="ltr">{String(log.createdAt).substring(0, 10)}</span>}
              </div>
            ))}
          </div>
        ) : <NotRecorded />}
      </div>

      {/* Integrity Footer */}
      <div className="p-4 bg-muted/30">
        <SectionHeading>سلامة السجل الثابت</SectionHeading>
        <div className="space-y-1.5">
          {stage.aiModelName && (
            <div className="flex items-center gap-2 text-[10px]">
              <Sparkles className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground/60">نموذج الذكاء الاصطناعي:</span>
              <span className="font-mono text-foreground/70">{stage.aiModelName}</span>
            </div>
          )}
          {stage.promptHash && (
            <div className="flex items-center gap-2 text-[10px]">
              <Hash className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground/60">بصمة الطلب:</span>
              <span className="font-mono text-foreground/50 break-all" dir="ltr">{stage.promptHash.substring(0, 32)}…</span>
            </div>
          )}
          {stage.auditHash && (
            <div className="flex items-center gap-2 text-[10px]">
              <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground/60">بصمة التدقيق:</span>
              <span className="font-mono text-foreground/50 break-all" dir="ltr">{stage.auditHash.substring(0, 32)}…</span>
            </div>
          )}
          {stage.immutableLogId && (
            <div className="flex items-center gap-2 text-[10px]">
              <Link2 className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground/60">معرف السجل الثابت:</span>
              <span className="font-mono text-foreground/70"># {stage.immutableLogId}</span>
            </div>
          )}
          {!stage.aiModelName && !stage.promptHash && !stage.auditHash && <NotRecorded />}
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Node ────────────────────────────────────────────────────────────

function TimelineNode({
  stage,
  isSelected,
  isLast,
  onClick,
}: {
  stage: ReplayStage;
  isSelected: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  const formatTimestamp = (ts: string | null) => {
    if (!ts) return null;
    try {
      return new Intl.DateTimeFormat('ar-AE', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(ts));
    } catch {
      return ts;
    }
  };

  return (
    <div className="flex gap-0">
      {/* Vertical connector line */}
      <div className="flex flex-col items-center w-8 shrink-0">
        <div className="mt-1">
          <StatusRing status={stage.status} />
        </div>
        {!isLast && <div className={`w-0.5 flex-1 mt-1 ${stage.status === 'complete' ? 'bg-emerald-200 dark:bg-emerald-800/40' : 'bg-border/40'}`} />}
      </div>

      {/* Node content */}
      <div className={`flex-1 mb-1 ms-3 rounded-xl border transition-all duration-150 overflow-hidden ${
        isSelected
          ? 'border-foreground/30 bg-card shadow-sm'
          : 'border-border/50 bg-background/50 hover:border-foreground/20 hover:bg-card/80'
      }`}>
        <button
          onClick={onClick}
          className="w-full text-start p-3 sm:p-4"
          aria-expanded={isSelected}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 flex-1 min-w-0">
              {/* Stage number + key */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-muted-foreground/50">
                  {String(stage.stageNumber).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/40 truncate" dir="ltr">
                  {stage.replayStageKey.replace('replay_', '').replace(/_/g, '.')}
                </span>
                {stage.confidenceScore !== null && <ConfidenceBadge score={stage.confidenceScore} />}
              </div>
              {/* Stage name */}
              <h3 className="text-sm font-bold text-foreground leading-snug">{stage.labelAr}</h3>
              {/* Meta */}
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {stage.timestamp && (
                  <span className="text-[10px] text-muted-foreground/50" dir="ltr">
                    {formatTimestamp(stage.timestamp)}
                  </span>
                )}
                {stage.actor && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {stage.actorRole && `${stage.actorRole} · `}{stage.actor}
                  </span>
                )}
                {stage.status === 'pending' && (
                  <span className="text-[10px] text-muted-foreground/40 italic">لم يُنفَّذ بعد</span>
                )}
                {stage.status === 'skipped' && (
                  <span className="text-[10px] text-gold dark:text-gold/80 italic">مُشتَق من بيانات ذات صلة</span>
                )}
              </div>
            </div>
            {isSelected
              ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
          </div>
        </button>

        {/* Expandable detail panel */}
        {isSelected && <StageDetailPanel stage={stage} />}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DecisionReplay({ decisionId }: { decisionId: number }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['replay', decisionId],
    queryFn: () => apiFetch(`/api/decisions/${decisionId}/replay`),
    staleTime: 60_000,
  });

  const timeline: ReplayTimeline | null = data?.timeline ?? null;
  const stages: ReplayStage[] = timeline?.stages ?? [];

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (stages.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev === null ? 0 : Math.min(prev + 1, stages.length - 1);
        return next;
      });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev === null ? stages.length - 1 : Math.max(prev - 1, 0);
        return next;
      });
    } else if (e.key === 'Escape') {
      setSelectedIndex(null);
    }
  }, [stages.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !timeline) {
    const errMsg = (error as Error)?.message ?? 'تعذّر تحميل سجل إعادة التشغيل';
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border/60 flex items-center justify-center">
          <Play className="w-6 h-6 text-muted-foreground/30" />
        </div>
        <div className="space-y-1 max-w-xs">
          <p className="text-sm font-semibold text-foreground">لا يوجد سجل إعادة تشغيل</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{errMsg}</p>
        </div>
        <p className="text-[10px] text-muted-foreground/40 max-w-xs leading-relaxed">
          تُكتب أحداث إعادة التشغيل عند اكتمال كل مرحلة. أكمل مرحلة واحدة على الأقل لتفعيل هذه الميزة.
        </p>
      </div>
    );
  }

  const completedCount = stages.filter((s) => s.status === 'complete').length;

  return (
    <div dir="rtl" className="p-4 sm:p-6 lg:p-8 max-w-3xl pb-16">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">
              <Play className="w-3 h-3" />
              <span>محرك إعادة التشغيل · Replay Engine</span>
            </div>
            <h2 className="text-lg font-bold text-foreground">إعادة تشغيل دورة حياة القرار</h2>
            <p className="text-xs text-muted-foreground">
              {completedCount} من 14 مرحلة مكتملة · سجل ثابت غير قابل للتعديل
            </p>
          </div>
          {/* Keyboard hint */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 bg-muted/40 border border-border/40 rounded-lg px-2.5 py-1.5 shrink-0">
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
            <span>التنقل بالأسهم · Esc للإغلاق</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
            <span>تقدم دورة الحياة</span>
            <span>{Math.round((completedCount / 14) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 14) * 100}%` }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border-2 border-emerald-400 dark:border-emerald-600 flex items-center justify-center">
              <Check className="w-2 h-2 text-emerald-600" />
            </div>
            <span>مكتملة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-gold/10 dark:bg-gold/30 border-2 border-gold/40 dark:border-gold flex items-center justify-center">
              <AlertTriangle className="w-2 h-2 text-gold" />
            </div>
            <span>مُشتَقة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-muted border-2 border-border/60" />
            <span>في انتظار التنفيذ</span>
          </div>
          <span className="text-muted-foreground/30">·</span>
          <span>انقر على مرحلة لعرض تفاصيلها الكاملة</span>
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────── */}
      <div className="space-y-0">
        {stages.map((stage, idx) => (
          <TimelineNode
            key={stage.replayStageKey}
            stage={stage}
            isSelected={selectedIndex === idx}
            isLast={idx === stages.length - 1}
            onClick={() => setSelectedIndex(selectedIndex === idx ? null : idx)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-[10px] text-muted-foreground/30 tracking-wide">
          Powered by the M. Al-Shamsi Framework™ · MARSAD Replay Engine v1.0 · سجل ثابت وغير قابل للتعديل
        </p>
      </div>
    </div>
  );
}
