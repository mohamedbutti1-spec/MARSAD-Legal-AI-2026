/**
 * Module 1 — Intelligent Administrative Decision
 * Decision case list — institutional-grade, Arabic-first.
 */
import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import {
  Plus, FileText, Clock, CheckCircle2, XCircle, AlertTriangle,
  ChevronLeft, Scale, CalendarDays, Building2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Decision {
  id: number;
  caseNumber: string;
  titleAr: string;
  titleEn?: string;
  status: string;
  currentStage: string;
  stagesCompleted: string[];
  jurisdiction: string;
  decisionType: string;
  organizationUnit: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  administrative_request: 'الطلب الإداري',
  legal_authority: 'التحقق من الاختصاص',
  facts_evidence: 'الوقائع والأدلة',
  legal_basis: 'السند القانوني',
  administrative_objective: 'الهدف الإداري',
  discretionary_power: 'السلطة التقديرية',
  proportionality: 'مبدأ التناسب',
  human_oversight: 'الرقابة البشرية',
  constitutional_validation: 'التحقق الدستوري',
  decision_drafting: 'صياغة القرار',
  final_review: 'المراجعة النهائية',
};

const TOTAL_STAGES = 11;

const JURISDICTION_LABELS: Record<string, string> = {
  uae: 'الإمارات العربية المتحدة',
  sa: 'المملكة العربية السعودية',
  qa: 'دولة قطر',
  bh: 'مملكة البحرين',
  kw: 'دولة الكويت',
  om: 'سلطنة عُمان',
  fr: 'الجمهورية الفرنسية',
  eu: 'الاتحاد الأوروبي',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  in_progress: {
    label: 'قيد الإنجاز',
    icon: <Clock className="w-3.5 h-3.5" />,
    className: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800/40',
  },
  validation_failed: {
    label: 'فشل التحقق',
    icon: <XCircle className="w-3.5 h-3.5" />,
    className: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40',
  },
  complete: {
    label: 'مكتمل',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40',
  },
  signed: {
    label: 'موقّع',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800/40',
  },
  draft: {
    label: 'مسودة',
    icon: <FileText className="w-3.5 h-3.5" />,
    className: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800/30 dark:border-slate-700/40',
  },
};

// ─── API ──────────────────────────────────────────────────────────────────────

function apiFetch(path: string) {
  const role = localStorage.getItem('userRole') || 'owner';
  return fetch(path, { headers: { 'X-User-Role': role } }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DecisionsPage() {
  const { lang } = useUserContext();
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['decisions'],
    queryFn: () => apiFetch('/api/decisions'),
  });

  const decisions: Decision[] = data?.decisions ?? [];

  const filtered = filter === 'all'
    ? decisions
    : decisions.filter((d) => d.status === filter);

  const completionPercent = (d: Decision) => {
    const completed = Array.isArray(d.stagesCompleted) ? d.stagesCompleted.length : 0;
    return Math.round((completed / TOTAL_STAGES) * 100);
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));

  return (
    <AppLayout>
      <div dir="rtl" className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground">
              <Scale className="w-3.5 h-3.5" />
              <span>الوحدة الأولى · إطار الشامسي</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">القرار الإداري الذكي</h1>
            <p className="text-sm text-muted-foreground">
              إنشاء القرارات الإدارية وفق المنهج الدستوري لإطار الشامسي — {TOTAL_STAGES} مرحلة
            </p>
          </div>

          <Link href="/decisions/new">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" />
              <span>قرار جديد</span>
            </button>
          </Link>
        </div>

        {/* ── Stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي القرارات', value: decisions.length, sub: 'جميع الحالات' },
            { label: 'قيد الإنجاز', value: decisions.filter((d) => d.status === 'in_progress').length, sub: 'مراحل نشطة' },
            { label: 'مكتملة', value: decisions.filter((d) => d.status === 'complete' || d.status === 'signed').length, sub: 'استوفت التحقق' },
            { label: 'فشل التحقق', value: decisions.filter((d) => d.status === 'validation_failed').length, sub: 'تحتاج مراجعة' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <div className="text-2xl font-bold text-foreground tabular-nums">{s.value}</div>
              <div className="text-xs font-semibold text-foreground/80">{s.label}</div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Filter ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'in_progress', label: 'قيد الإنجاز' },
            { key: 'complete', label: 'مكتمل' },
            { key: 'validation_failed', label: 'فشل التحقق' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                filter === f.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border/60 hover:border-foreground/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── List ────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl border border-border/60 bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>تعذّر تحميل القرارات. يرجى إعادة المحاولة.</span>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/60 flex items-center justify-center">
              <Scale className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground">لا توجد قرارات بعد</p>
              <p className="text-sm text-muted-foreground mt-1">
                ابدأ بإنشاء قرارك الإداري الأول وفق المنهج الدستوري
              </p>
            </div>
            <Link href="/decisions/new">
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" />
                إنشاء قرار جديد
              </button>
            </Link>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((decision) => {
              const statusConf = STATUS_CONFIG[decision.status] ?? STATUS_CONFIG.draft;
              const pct = completionPercent(decision);
              const currentStageLabel = STAGE_LABELS[decision.currentStage] ?? decision.currentStage;
              const jurisdictionLabel = JURISDICTION_LABELS[decision.jurisdiction] ?? decision.jurisdiction;

              return (
                <Link key={decision.id} href={`/decisions/${decision.id}`}>
                  <article className="block rounded-xl border border-border/60 bg-card hover:border-foreground/20 hover:shadow-sm transition-all duration-150 cursor-pointer">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="shrink-0 w-10 h-10 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center mt-0.5">
                          <Scale className="w-5 h-5 text-muted-foreground" />
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono font-bold text-muted-foreground/60" dir="ltr">
                                  {decision.caseNumber}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusConf.className}`}>
                                  {statusConf.icon}
                                  {statusConf.label}
                                </span>
                              </div>
                              <h2 className="font-bold text-foreground leading-snug">
                                {decision.titleAr}
                              </h2>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="w-3 h-3" />
                              {decision.organizationUnit}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Scale className="w-3 h-3" />
                              {jurisdictionLabel}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarDays className="w-3 h-3" />
                              {formatDate(decision.createdAt)}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>المرحلة الحالية: <strong className="text-foreground/80">{currentStageLabel}</strong></span>
                              <span>{pct}% مكتمل</span>
                            </div>
                            <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  decision.status === 'validation_failed'
                                    ? 'bg-red-500'
                                    : decision.status === 'complete' || decision.status === 'signed'
                                      ? 'bg-emerald-500'
                                      : 'bg-amber-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
