/**
 * Stage 5 — Smart Administrative Court Simulation
 *
 * Projects A, B, C implemented:
 *   A — Al-Shamsi Explainability Protocol (ASEP) panel
 *   B — Al-Shamsi Matrix (interactive 11-principle evaluation cards)
 *   C — Digital Will Engine (10-stage pipeline visualization)
 */

import React, { useState } from 'react';
import {
  Scale, Gavel, Shield, Users, FileText, Brain,
  AlertTriangle, ChevronDown, ChevronUp, Loader2,
  CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Star, RotateCcw, Activity, Eye, ArrowDown,
  ClipboardCheck, Cpu, Lock, Search, Zap,
} from 'lucide-react';
import type {
  CourtSessionData, CourtDefense, CourtShamsiPrinciple,
  CourtScores, ASEPReport,
} from '@/lib/court-types';

// ─── Primitives ───────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground" dir="rtl">{label}</span>
        <span className={`font-bold ${color}`}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function StrengthBadge({ strength }: { strength: string }) {
  const cfg =
    strength === 'قوي'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    strength === 'متوسط' ? 'bg-amber-50  text-amber-700  border-amber-200'   :
                           'bg-red-50    text-red-700    border-red-200';
  return (
    <span className={`text-[10px] border rounded-full px-2 py-0.5 font-medium ${cfg}`}>
      {strength}
    </span>
  );
}

function SectionCard({
  icon, titleAr, titleEn, children, loading = false, badge,
}: {
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  children: React.ReactNode;
  loading?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <span className="font-semibold text-sm">{titleAr}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">/ {titleEn}</span>
          {badge && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {!loading && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && <div className="px-4 py-3" dir="rtl">{children}</div>}
    </div>
  );
}

function LoadingCard({ titleAr, titleEn, icon }: { titleAr: string; titleEn: string; icon: React.ReactNode }) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
      <div className="flex items-center gap-2 px-4 py-3" dir="rtl">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm text-muted-foreground">{titleAr}</span>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">/ {titleEn}</span>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ms-auto" />
      </div>
    </div>
  );
}

// ─── Defense List ─────────────────────────────────────────────────────────────

function DefenseList({ items }: { items: CourtDefense[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-border/60 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <StrengthBadge strength={item.strength} />
              <span className="text-sm font-medium">{item.ground}</span>
            </div>
            {expanded === i ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </button>
          {expanded === i && (
            <div className="px-3 pb-3 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-2">
              {item.argument}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Project B — Al-Shamsi Matrix ─────────────────────────────────────────────

/** Canonical status resolver — uses explicit status if valid, falls back to score band */
function resolveShamsiStatus(p: CourtShamsiPrinciple): 'مُستوفى' | 'جزئي' | 'مخفق' {
  if (p.status === 'مُستوفى' || p.status === 'جزئي' || p.status === 'مخفق') return p.status;
  const s = Number(p.score);
  return s >= 70 ? 'مُستوفى' : s >= 40 ? 'جزئي' : 'مخفق';
}

function ShamsiStatusIcon({ status }: { status: 'مُستوفى' | 'جزئي' | 'مخفق' }) {
  if (status === 'مُستوفى') return <span className="text-emerald-600 font-bold text-base">✓</span>;
  if (status === 'جزئي')   return <span className="text-amber-500  font-bold text-base">△</span>;
  return                          <span className="text-red-600    font-bold text-base">✗</span>;
}

function ShamsiMatrix({ items }: { items: CourtShamsiPrinciple[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((p, idx) => {
        const status = resolveShamsiStatus(p);
        const score  = Math.min(100, Math.max(0, Number(p.score ?? 0)));
        const statusBg =
          status === 'مُستوفى' ? 'border-emerald-200 bg-emerald-50/40' :
          status === 'جزئي'   ? 'border-amber-200  bg-amber-50/40'   :
                                 'border-red-200    bg-red-50/40';
        const scoreColor =
          score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
        const barColor =
          score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
        const key = p.id || String(idx);

        return (
          <div key={key} className={`border rounded-lg overflow-hidden ${statusBg}`}>
            <button
              type="button"
              onClick={() => setExpanded(expanded === key ? null : key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-black/5 transition-colors"
              dir="rtl"
            >
              <div className="w-6 shrink-0 text-center">
                <ShamsiStatusIcon status={status} />
              </div>
              <div className="flex-1 min-w-0 text-start">
                <span className="text-sm font-medium">{p.nameAr ?? p.id}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
                </div>
                <span className={`text-[11px] font-bold w-8 text-end ${scoreColor}`}>{score}%</span>
                {expanded === key
                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </button>

            {expanded === key && (
              <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-3 text-sm" dir="rtl">
                {/* 1 — Legal reasoning (always) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">التحليل القانوني</p>
                  <p className="text-foreground leading-relaxed">{p.reason || '—'}</p>
                </div>
                {/* 2 — Evidence (always, with placeholder) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 mb-0.5 flex items-center gap-1">
                    <Search className="w-3 h-3" /> الأدلة المستند إليها
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {p.evidence || 'لا توجد أدلة محددة في التقرير'}
                  </p>
                </div>
                {/* 3 — Human oversight (always, with placeholder) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-purple-600 mb-0.5 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> الرقابة البشرية
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {p.humanOversightNote || 'لم يُحدَّد دور الرقابة البشرية في هذا المبدأ'}
                  </p>
                </div>
                {/* 4 — Legal risk (always) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-0.5">المخاطر القانونية</p>
                  <p className="text-red-700 text-xs leading-relaxed">{p.legalRisk || '—'}</p>
                </div>
                {/* 5 — Recommendation (always) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-0.5">التوصية</p>
                  <p className="text-emerald-700 text-xs leading-relaxed">{p.recommendation || '—'}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Matrix summary bar */}
      {(() => {
        const satisfied = items.filter(p => resolveShamsiStatus(p) === 'مُستوفى').length;
        const partial   = items.filter(p => resolveShamsiStatus(p) === 'جزئي').length;
        const failed    = items.filter(p => resolveShamsiStatus(p) === 'مخفق').length;
        return (
          <div className="mt-3 flex items-center justify-center gap-4 border border-border/50 rounded-lg py-2 bg-muted/20 text-[11px]" dir="rtl">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">✓ مُستوفى: {satisfied}</span>
            <span className="text-muted-foreground/40">|</span>
            <span className="flex items-center gap-1 text-amber-600 font-semibold">△ جزئي: {partial}</span>
            <span className="text-muted-foreground/40">|</span>
            <span className="flex items-center gap-1 text-red-600 font-semibold">✗ مخفق: {failed}</span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Project C — Digital Will Engine ─────────────────────────────────────────

interface DWStage {
  icon: React.ReactNode;
  nameAr: string;
  nameEn: string;
  done: boolean;
  excerpt?: string;
}

function DigitalWillEngine({ session, loading }: { session: CourtSessionData; loading: boolean }) {
  const [open, setOpen] = useState(true);

  const stages: DWStage[] = [
    {
      icon: <FileText className="w-3.5 h-3.5" />,
      nameAr: 'البيانات المدخلة',
      nameEn: 'Input Data',
      done: !!session.caseText,
      excerpt: session.caseText.slice(0, 60) + (session.caseText.length > 60 ? '...' : ''),
    },
    {
      icon: <Search className="w-3.5 h-3.5" />,
      nameAr: 'التحقق من الأدلة',
      nameEn: 'Evidence Validation',
      done: !!session.facts,
      excerpt: session.facts?.summary?.slice(0, 60),
    },
    {
      icon: <Zap className="w-3.5 h-3.5" />,
      nameAr: 'تحديد الأوزان القانونية',
      nameEn: 'Legal Weight Assignment',
      done: !!session.issues,
      excerpt: session.issues?.cause?.slice(0, 60),
    },
    {
      icon: <Cpu className="w-3.5 h-3.5" />,
      nameAr: 'كشف التحيز الخوارزمي',
      nameEn: 'Bias Detection',
      done: !!session.shamsiAnalysis,
      excerpt: session.shamsiAnalysis
        ? `${session.shamsiAnalysis.filter(p => (p.status ?? (p.score < 40 ? 'مخفق' : p.score < 70 ? 'جزئي' : 'مُستوفى')) === 'مخفق').length} مبدأ مخفق من 11`
        : undefined,
    },
    {
      icon: <Lock className="w-3.5 h-3.5" />,
      nameAr: 'التحقق من المشروعية',
      nameEn: 'Legitimacy Verification',
      done: !!session.commissionerReport,
      excerpt: session.commissionerReport?.recommendation
        ? `توصية المفوض: ${session.commissionerReport.recommendation}`
        : undefined,
    },
    {
      icon: <Eye className="w-3.5 h-3.5" />,
      nameAr: 'الرقابة البشرية',
      nameEn: 'Human Oversight',
      done: !!session.shamsiAnalysis,
      excerpt: session.shamsiAnalysis?.find(p => p.id === 'human_supervision')
        ? `${session.shamsiAnalysis.find(p => p.id === 'human_supervision')!.score}% — الرقابة البشرية الفاعلة`
        : undefined,
    },
    {
      icon: <Brain className="w-3.5 h-3.5" />,
      nameAr: 'تكوين الإرادة الرقمية',
      nameEn: 'Digital Will Formation',
      done: !!session.judgment,
      excerpt: session.judgment?.ruling?.slice(0, 60),
    },
    {
      icon: <ClipboardCheck className="w-3.5 h-3.5" />,
      nameAr: 'القرار الإداري',
      nameEn: 'Administrative Decision',
      done: !!session.operative,
      excerpt: session.operative
        ? `${session.operative.decision} — ${session.operative.cancellation}`
        : undefined,
    },
    {
      icon: <Scale className="w-3.5 h-3.5" />,
      nameAr: 'المراجعة القضائية',
      nameEn: 'Judicial Review',
      done: !!session.appeal,
      excerpt: session.appeal
        ? `فرص الطعن: ${session.appeal.successChance}%`
        : undefined,
    },
    {
      icon: <Gavel className="w-3.5 h-3.5" />,
      nameAr: 'الحكم النهائي',
      nameEn: 'Final Judgment',
      done: !!session.asep || (!!session.scores && !!session.judgment),
      excerpt: session.asep
        ? `قابلية التفسير: ${session.asep.overallExplainability}%`
        : session.scores
        ? `مؤشر الشامسي: ${session.scores.shamsiIndex}%`
        : undefined,
    },
  ];

  const doneCount  = stages.filter(s => s.done).length;
  const activeIdx  = stages.findIndex(s => !s.done);

  return (
    <div className="border-2 border-primary/20 rounded-xl overflow-hidden bg-gradient-to-b from-primary/3 to-transparent">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm text-primary">محرك الإرادة الرقمية</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">/ Digital Will Engine</span>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
            Project C
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{doneCount}/{stages.length}</span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4" dir="rtl">
          <div className="flex flex-col items-center gap-0">
            {stages.map((stage, idx) => {
              const isActive = loading && idx === activeIdx;
              const statusColor = stage.done
                ? 'text-emerald-600 border-emerald-400 bg-emerald-50'
                : isActive
                ? 'text-amber-600 border-amber-400 bg-amber-50 animate-pulse'
                : 'text-muted-foreground border-border bg-muted/30';
              return (
                <React.Fragment key={idx}>
                  <div className={`w-full flex items-start gap-3 p-2.5 rounded-lg border transition-all ${statusColor}`}>
                    {/* Step indicator */}
                    <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 mt-0.5 ${
                      stage.done
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : isActive
                        ? 'bg-amber-400 text-white border-amber-400'
                        : 'bg-muted text-muted-foreground border-border/60'
                    }`}>
                      {stage.done ? '✓' : isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : idx + 1}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="opacity-70">{stage.icon}</span>
                        <span className="text-xs font-semibold">{stage.nameAr}</span>
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">/ {stage.nameEn}</span>
                      </div>
                      {stage.excerpt && stage.done && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                          {stage.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                  {idx < stages.length - 1 && (
                    <div className="flex flex-col items-center w-6 shrink-0">
                      <div className={`w-0.5 h-3 ${stage.done ? 'bg-emerald-400' : 'bg-border'}`} />
                      <ArrowDown className={`w-3 h-3 ${stage.done ? 'text-emerald-400' : 'text-border'}`} />
                      <div className={`w-0.5 h-1 ${stages[idx + 1]?.done ? 'bg-emerald-400' : 'bg-border'}`} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project A — ASEP Panel ───────────────────────────────────────────────────

function ASEPPanel({ report }: { report: ASEPReport }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const confColor = (c: number) =>
    c >= 70 ? 'text-emerald-600' : c >= 40 ? 'text-amber-600' : 'text-red-600';

  // Defensive: ensure answers is always an array and each entry has required fields
  const safeAnswers = Array.isArray(report.answers)
    ? report.answers.map((a) => ({
        question:   String(a?.question   ?? ''),
        answer:     String(a?.answer     ?? ''),
        confidence: Math.min(100, Math.max(0, Number(a?.confidence ?? 0))),
        flagged:    Boolean(a?.flagged),
      }))
    : [];
  const safeExplainability = Math.min(100, Math.max(0, Number(report.overallExplainability ?? 0)));

  if (safeAnswers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        لا توجد بيانات قابلية التفسير
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Overall explainability score */}
      <div className="flex items-center gap-3 border border-border/50 rounded-lg px-3 py-2.5 bg-muted/20">
        <div className="flex-1">
          <p className="text-[11px] font-bold text-muted-foreground mb-1">مؤشر قابلية التفسير الكلية</p>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                safeExplainability >= 70 ? 'bg-emerald-500'
                : safeExplainability >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${safeExplainability}%` }}
            />
          </div>
        </div>
        <span className={`text-2xl font-bold shrink-0 ${confColor(safeExplainability)}`}>
          {safeExplainability}%
        </span>
      </div>

      {/* 10 Q&A cards */}
      {safeAnswers.map((qa, i) => (
        <div
          key={i}
          className={`border rounded-lg overflow-hidden ${
            qa.flagged ? 'border-amber-300 bg-amber-50/30' : 'border-border/60 bg-card'
          }`}
        >
          <button
            type="button"
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-black/5 transition-colors text-start"
            dir="rtl"
          >
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5 border ${
              qa.flagged
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-primary/10 text-primary border-primary/20'
            }`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-snug">{qa.question}</p>
              {qa.flagged && (
                <span className="text-[10px] text-amber-600 font-medium">⚠ يستوجب الانتباه</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[11px] font-bold ${confColor(qa.confidence)}`}>
                {qa.confidence}%
              </span>
              {expanded === i
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </button>

          {expanded === i && (
            <div className="px-4 pb-3 pt-1 border-t border-border/30" dir="rtl">
              <p className="text-sm text-foreground leading-relaxed mb-2">{qa.answer}</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">مستوى الثقة:</span>
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      qa.confidence >= 70 ? 'bg-emerald-500' : qa.confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${qa.confidence}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold ${confColor(qa.confidence)}`}>{qa.confidence}%</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Conclusion */}
      {report.conclusion && (
        <div className="border-r-4 border-primary pr-3 py-1">
          <p className="text-[11px] font-bold text-primary mb-0.5">خلاصة قابلية التفسير</p>
          <p className="text-sm text-foreground leading-relaxed">{report.conclusion}</p>
        </div>
      )}
    </div>
  );
}

// ─── Judgment Text ────────────────────────────────────────────────────────────

function JudgmentText({ data }: { data: NonNullable<CourtSessionData['judgment']> }) {
  const clauses = [
    { ar: 'باسم العدالة',              text: data.preamble },
    { ar: 'وقائع القضية',              text: data.facts },
    { ar: 'وحيث إن المحكمة ترى',      text: data.courtView },
    { ar: 'وحيث إن الثابت',           text: data.established },
    { ar: 'وحيث إن القرار محل الطعن', text: data.challenged },
    { ar: 'منطوق الحكم',              text: data.ruling },
  ];
  return (
    <div className="space-y-3">
      {clauses.map((c, i) => (
        <div key={i} className="border-r-2 border-primary/40 pr-3">
          <p className="text-[11px] font-bold text-primary mb-0.5">{c.ar}</p>
          <p className="text-sm text-foreground leading-relaxed">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Scores Dashboard ─────────────────────────────────────────────────────────

function ScoresDashboard({ scores }: { scores: CourtScores }) {
  const items: Array<{ label: string; value: number; inverse?: boolean }> = [
    { label: 'درجة المشروعية',           value: scores.legality },
    { label: 'درجة الشفافية',            value: scores.transparency },
    { label: 'درجة التفسير الخوارزمي',   value: scores.algorithmicExplainability },
    { label: 'درجة الرقابة البشرية',     value: scores.humanOversight },
    { label: 'درجة المخاطر القضائية',    value: scores.judicialRisk,         inverse: true },
    { label: 'احتمال الإلغاء القضائي',   value: scores.annulmentProbability, inverse: true },
    { label: 'مؤشر نظرية الشامسي',       value: scores.shamsiIndex },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item) => {
        const color = item.inverse
          ? item.value >= 70 ? 'text-red-600' : item.value >= 40 ? 'text-amber-600' : 'text-emerald-600'
          : item.value >= 70 ? 'text-emerald-600' : item.value >= 40 ? 'text-amber-600' : 'text-red-600';
        return <ScoreBar key={item.label} label={item.label} value={item.value} color={color} />;
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface CourtSessionPanelProps {
  session: CourtSessionData;
  onSupremeReview: () => void;
  onReset: () => void;
  loading: boolean;
}

export function CourtSessionPanel({ session, onSupremeReview, onReset, loading }: CourtSessionPanelProps) {
  const allSections: Array<{ id: string; titleAr: string; titleEn: string; icon: React.ReactNode }> = [
    { id: 'facts',        titleAr: 'عرض الوقائع',            titleEn: 'Facts',                icon: <FileText className="w-4 h-4" /> },
    { id: 'issues',       titleAr: 'المسائل القانونية',       titleEn: 'Legal Issues',         icon: <Scale className="w-4 h-4" /> },
    { id: 'claimant',     titleAr: 'دفوع المدعي',             titleEn: 'Claimant',             icon: <Users className="w-4 h-4" /> },
    { id: 'admin',        titleAr: 'دفوع الإدارة',            titleEn: 'Administration',       icon: <Shield className="w-4 h-4" /> },
    { id: 'commissioner', titleAr: 'رأي المفوض / المقرر',    titleEn: 'Commissioner',         icon: <Star className="w-4 h-4" /> },
    { id: 'shamsi',       titleAr: 'مصفوفة نظرية الشامسي',   titleEn: 'Al-Shamsi Matrix',     icon: <Brain className="w-4 h-4" /> },
    { id: 'judgment',     titleAr: 'الحكم القضائي',           titleEn: 'Judgment',             icon: <Gavel className="w-4 h-4" /> },
    { id: 'operative',    titleAr: 'منطوق الحكم',             titleEn: 'Operative Part',       icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'appeal',       titleAr: 'قابلية الطعن',            titleEn: 'Appeal',               icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'asep',         titleAr: 'بروتوكول قابلية التفسير', titleEn: 'ASEP',                 icon: <ClipboardCheck className="w-4 h-4" /> },
  ];

  const sectionDone = (id: string) => {
    if (id === 'facts')        return !!session.facts;
    if (id === 'issues')       return !!session.issues;
    if (id === 'claimant')     return !!session.claimantDefenses;
    if (id === 'admin')        return !!session.adminDefenses;
    if (id === 'commissioner') return !!session.commissionerReport;
    if (id === 'shamsi')       return !!session.shamsiAnalysis;
    if (id === 'judgment')     return !!session.judgment;
    if (id === 'operative')    return !!session.operative;
    if (id === 'appeal')       return !!session.appeal;
    if (id === 'asep')         return !!session.asep;
    return false;
  };

  const completedCount = allSections.filter(s => sectionDone(s.id)).length;
  const isComplete = completedCount === allSections.length && !!session.scores;

  return (
    <div className="space-y-3 py-2" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-foreground">جلسة محاكمة كاملة</h2>
          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
            Stage 5
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              جارٍ المحاكمة ({completedCount}/{allSections.length})
            </span>
          )}
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> إعادة تعيين
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {loading && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-500"
            style={{ width: `${Math.round((completedCount / allSections.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Case summary */}
      <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/40 line-clamp-2">
        <span className="font-medium text-foreground">القضية: </span>
        {session.caseText.slice(0, 200)}{session.caseText.length > 200 ? '...' : ''}
      </div>

      {/* Project C — Digital Will Engine */}
      {(loading || completedCount > 0) && (
        <DigitalWillEngine session={session} loading={loading} />
      )}

      {/* 10 content sections */}
      {allSections.map((s) => {
        const done = sectionDone(s.id);
        const isCurrentlyLoading = loading && !done;

        if (!done && isCurrentlyLoading) {
          const prevIdx = allSections.indexOf(s) - 1;
          const prevDone = prevIdx < 0 || sectionDone(allSections[prevIdx].id);
          if (!prevDone) return null;
          return <LoadingCard key={s.id} titleAr={s.titleAr} titleEn={s.titleEn} icon={s.icon} />;
        }
        if (!done) return null;

        const badgeFn: Record<string, string | undefined> = {
          shamsi: 'Project B',
          asep: 'Project A',
        };

        return (
          <SectionCard key={s.id} icon={s.icon} titleAr={s.titleAr} titleEn={s.titleEn} badge={badgeFn[s.id]}>
            {s.id === 'facts' && session.facts && (
              <div className="space-y-3">
                <p className="text-sm text-foreground leading-relaxed">{session.facts.summary}</p>
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground mb-1">القرار محل النزاع</p>
                  <p className="text-sm">{session.facts.disputedDecision}</p>
                </div>
                {session.facts.parties.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground mb-1">أطراف الخصومة</p>
                    <div className="flex flex-wrap gap-2">
                      {session.facts.parties.map((p, i) => (
                        <span key={i} className="text-xs bg-primary/8 border border-primary/20 text-primary rounded-full px-2 py-0.5">
                          {p.role}: {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {session.facts.requests.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground mb-1">الطلبات</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {session.facts.requests.map((r, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {s.id === 'issues' && session.issues && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(session.issues)
                  .filter(([, v]) => v)
                  .map(([k, v]) => {
                    const labels: Record<string, string> = {
                      jurisdiction: 'الاختصاص', form: 'الشكل والإجراءات', cause: 'السبب',
                      subject: 'المحل', purpose: 'الغاية', proportionality: 'التناسب',
                      transparency: 'الشفافية', humanOversight: 'الرقابة البشرية',
                      algorithmicEffect: 'أثر الخوارزمية',
                    };
                    return (
                      <div key={k} className="border border-border/50 rounded-lg p-2.5">
                        <p className="text-[11px] font-bold text-primary mb-1">{labels[k] ?? k}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{String(v)}</p>
                      </div>
                    );
                  })}
              </div>
            )}

            {s.id === 'claimant' && session.claimantDefenses && (
              <DefenseList items={session.claimantDefenses} />
            )}

            {s.id === 'admin' && session.adminDefenses && (
              <DefenseList items={session.adminDefenses} />
            )}

            {s.id === 'commissioner' && session.commissionerReport && (() => {
              const c = session.commissionerReport;
              return (
                <div className="space-y-3">
                  {[
                    { label: 'الوقائع', text: c.facts },
                    { label: 'القانون الواجب التطبيق', text: c.applicableLaw },
                    { label: 'تحليل الدفوع', text: c.defenseAnalysis },
                    { label: 'الرأي القانوني', text: c.legalOpinion },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-[11px] font-bold text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold text-muted-foreground">التوصية:</span>
                    <span className={`text-sm font-bold ${
                      c.recommendation === 'قبول' ? 'text-emerald-600' :
                      c.recommendation === 'رفض'  ? 'text-red-600'     : 'text-amber-600'
                    }`}>{c.recommendation}</span>
                  </div>
                </div>
              );
            })()}

            {/* Project B — Al-Shamsi Matrix */}
            {s.id === 'shamsi' && session.shamsiAnalysis && (
              <ShamsiMatrix items={session.shamsiAnalysis} />
            )}

            {s.id === 'judgment' && session.judgment && (
              <JudgmentText data={session.judgment} />
            )}

            {s.id === 'operative' && session.operative && (() => {
              const o = session.operative;
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-sm font-bold px-3 py-1 rounded-full border ${
                      o.decision.includes('قبول') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>{o.decision}</span>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full border ${
                      o.cancellation.includes('إلغاء') ? 'bg-red-50 text-red-700 border-red-200' :
                      o.cancellation.includes('تعديل') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>{o.cancellation}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground mb-0.5">أثر الحكم</p>
                    <p className="text-sm">{o.effect}</p>
                  </div>
                  {o.adminObligation && (
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground mb-0.5">إلزام الجهة الإدارية</p>
                      <p className="text-sm text-amber-700">{o.adminObligation}</p>
                    </div>
                  )}
                  {o.reformRecommendations.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground mb-1">التوصيات الإصلاحية</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {o.reformRecommendations.map((r, i) => (
                          <li key={i} className="text-sm text-muted-foreground">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            {s.id === 'appeal' && session.appeal && (() => {
              const a = session.appeal;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground">قابل للاستئناف:</span>
                    {a.isAppealable
                      ? <span className="text-emerald-600 font-bold text-sm flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> نعم</span>
                      : <span className="text-red-600 font-bold text-sm flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> لا</span>
                    }
                    <span className="text-[11px] text-muted-foreground me-auto">
                      فرص النجاح: <span className="font-bold">{a.successChance}%</span>
                    </span>
                  </div>
                  {a.strongestGrounds.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> أقوى أسباب الطعن
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {a.strongestGrounds.map((g, i) => <li key={i} className="text-sm text-muted-foreground">{g}</li>)}
                      </ul>
                    </div>
                  )}
                  {a.weakestPoints.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-red-600 mb-1 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> أضعف نقاط الحكم
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {a.weakestPoints.map((p, i) => <li key={i} className="text-sm text-muted-foreground">{p}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Project A — ASEP */}
            {s.id === 'asep' && session.asep && (
              <ASEPPanel report={session.asep} />
            )}
          </SectionCard>
        );
      })}

      {/* Score dashboard */}
      {session.scores && (
        <SectionCard icon={<AlertTriangle className="w-4 h-4" />} titleAr="لوحة الدرجات القضائية" titleEn="Scoring Dashboard">
          <ScoresDashboard scores={session.scores} />
        </SectionCard>
      )}

      {/* Final summary card */}
      {isComplete && session.scores && session.operative && (
        <div className="border-2 border-amber-300 rounded-xl p-4 bg-amber-50/50" dir="rtl">
          <h3 className="font-bold text-sm text-amber-800 mb-3 flex items-center gap-2">
            <Gavel className="w-4 h-4" /> الحكم النهائي
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { label: 'المشروعية',      value: `${session.scores.legality}%` },
              { label: 'درجة القوة',     value: `${Math.round((session.scores.legality + session.scores.transparency + session.scores.humanOversight) / 3)}%` },
              { label: 'درجة الطعن',     value: `${session.appeal?.successChance ?? 0}%` },
              { label: 'احتمال الإلغاء', value: `${session.scores.annulmentProbability}%` },
              { label: 'درجة المخاطر',  value: `${session.scores.judicialRisk}%` },
              { label: 'مؤشر الشامسي',  value: `${session.scores.shamsiIndex}%` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between border-b border-amber-200/60 pb-1">
                <span className="text-amber-800 font-medium">{label}:</span>
                <span className="font-bold text-amber-900">{value}</span>
              </div>
            ))}
            <div className="col-span-2 pt-1">
              <span className="text-amber-800 font-medium">التوصية النهائية: </span>
              <span className="font-bold text-amber-900">{session.operative.decision} — {session.operative.cancellation}</span>
            </div>
          </div>

          {/* Supreme court button */}
          {!session.supremeReview && !session.supremeLoading && (
            <button
              type="button"
              onClick={onSupremeReview}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              🔬 اختبار المحكمة العليا
            </button>
          )}
          {session.supremeLoading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحليل متعدد الدرجات...
            </div>
          )}
        </div>
      )}

      {/* Supreme court review panel */}
      {session.supremeReview && (() => {
        const sr = session.supremeReview!;
        const layers: Array<{ key: keyof typeof sr; labelAr: string; icon: string }> = [
          { key: 'firstInstance',   labelAr: 'حكم أول درجة',                icon: '⚖️' },
          { key: 'appeal',          labelAr: 'حكم الاستئناف',               icon: '📋' },
          { key: 'cassation',       labelAr: 'حكم التمييز / النقض',          icon: '🏛️' },
          { key: 'frenchCouncil',   labelAr: 'مجلس الدولة الفرنسي',         icon: '🇫🇷' },
          { key: 'europeanCourt',   labelAr: 'المحكمة الأوروبية',            icon: '🇪🇺' },
          { key: 'shamsiEval',      labelAr: 'تقييم نظرية الشامسي',          icon: '🧠' },
          { key: 'finalComparison', labelAr: 'النتيجة النهائية المقارنة',    icon: '📊' },
        ];
        return (
          <SectionCard
            icon={<span className="text-base">🔬</span>}
            titleAr="اختبار المحكمة العليا"
            titleEn="Supreme Court Review"
            badge="متعدد الدرجات"
          >
            <div className="space-y-3">
              {layers.map(({ key, labelAr, icon }) => {
                const val = sr[key];
                if (!val) return null;
                return (
                  <div key={key} className="border-r-2 border-purple-300 pr-3">
                    <p className="text-[11px] font-bold text-purple-700 mb-0.5">{icon} {labelAr}</p>
                    <p className="text-sm text-foreground leading-relaxed">{String(val)}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })()}
    </div>
  );
}
