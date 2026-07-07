/**
 * Stage 5 — Smart Administrative Court Simulation
 * CourtSessionPanel — renders the full courtroom session UI
 */

import React, { useState } from 'react';
import { Scale, Gavel, Shield, Users, FileText, Brain, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, Minus, Star, RotateCcw } from 'lucide-react';
import type {
  CourtSessionData, CourtDefense, CourtShamsiPrinciple, CourtScores,
} from '@/lib/court-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Section sub-renderers ────────────────────────────────────────────────────

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

function ShamsiGrid({ items }: { items: CourtShamsiPrinciple[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <div key={p.id} className="border border-border/60 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors"
          >
            <div className="flex-1 min-w-0 text-start">
              <span className="text-sm font-medium">{p.nameAr}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${p.score >= 70 ? 'bg-emerald-500' : p.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${p.score}%` }}
                />
              </div>
              <span className={`text-[11px] font-bold w-8 text-end ${p.score >= 70 ? 'text-emerald-600' : p.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {p.score}%
              </span>
              {expanded === p.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </button>
          {expanded === p.id && (
            <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2 text-sm">
              <p className="text-muted-foreground leading-relaxed"><span className="font-medium text-foreground">السبب: </span>{p.reason}</p>
              <p className="text-red-600 text-xs"><span className="font-medium">المخاطر القانونية: </span>{p.legalRisk}</p>
              <p className="text-emerald-600 text-xs"><span className="font-medium">التوصية: </span>{p.recommendation}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScoresDashboard({ scores }: { scores: CourtScores }) {
  const items: Array<{ label: string; value: number; inverse?: boolean }> = [
    { label: 'درجة المشروعية',           value: scores.legality },
    { label: 'درجة الشفافية',            value: scores.transparency },
    { label: 'درجة التفسير الخوارزمي',   value: scores.algorithmicExplainability },
    { label: 'درجة الرقابة البشرية',     value: scores.humanOversight },
    { label: 'درجة المخاطر القضائية',    value: scores.judicialRisk,          inverse: true },
    { label: 'احتمال الإلغاء القضائي',   value: scores.annulmentProbability,  inverse: true },
    { label: 'مؤشر نظرية الشامسي',       value: scores.shamsiIndex },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item) => {
        const displayValue = item.inverse ? item.value : item.value;
        const color = item.inverse
          ? item.value >= 70 ? 'text-red-600' : item.value >= 40 ? 'text-amber-600' : 'text-emerald-600'
          : item.value >= 70 ? 'text-emerald-600' : item.value >= 40 ? 'text-amber-600' : 'text-red-600';
        return (
          <ScoreBar key={item.label} label={item.label} value={displayValue} color={color} />
        );
      })}
    </div>
  );
}

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

// ─── Main component ───────────────────────────────────────────────────────────

interface CourtSessionPanelProps {
  session: CourtSessionData;
  onSupremeReview: () => void;
  onReset: () => void;
  loading: boolean;
}

export function CourtSessionPanel({ session, onSupremeReview, onReset, loading }: CourtSessionPanelProps) {
  const allSections: Array<{ id: string; titleAr: string; titleEn: string; icon: React.ReactNode }> = [
    { id: 'facts',        titleAr: 'عرض الوقائع',            titleEn: 'Facts',            icon: <FileText className="w-4 h-4" /> },
    { id: 'issues',       titleAr: 'المسائل القانونية',       titleEn: 'Legal Issues',     icon: <Scale className="w-4 h-4" /> },
    { id: 'claimant',     titleAr: 'دفوع المدعي',             titleEn: 'Claimant',         icon: <Users className="w-4 h-4" /> },
    { id: 'admin',        titleAr: 'دفوع الإدارة',            titleEn: 'Administration',   icon: <Shield className="w-4 h-4" /> },
    { id: 'commissioner', titleAr: 'رأي المفوض / المقرر',    titleEn: 'Commissioner',     icon: <Star className="w-4 h-4" /> },
    { id: 'shamsi',       titleAr: 'تطبيق نظرية الشامسي',    titleEn: 'Shamsi Theory',    icon: <Brain className="w-4 h-4" /> },
    { id: 'judgment',     titleAr: 'الحكم القضائي',           titleEn: 'Judgment',         icon: <Gavel className="w-4 h-4" /> },
    { id: 'operative',    titleAr: 'منطوق الحكم',             titleEn: 'Operative Part',   icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'appeal',       titleAr: 'قابلية الطعن',            titleEn: 'Appeal',           icon: <TrendingUp className="w-4 h-4" /> },
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
              جارٍ المحاكمة ({completedCount}/9)
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
            style={{ width: `${Math.round((completedCount / (allSections.length + 1)) * 100)}%` }}
          />
        </div>
      )}

      {/* Case summary */}
      <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/40 line-clamp-2">
        <span className="font-medium text-foreground">القضية: </span>
        {session.caseText.slice(0, 200)}{session.caseText.length > 200 ? '...' : ''}
      </div>

      {/* Sections */}
      {allSections.map((s) => {
        const done = sectionDone(s.id);
        const isCurrentlyLoading = loading && !done;

        if (!done && isCurrentlyLoading) {
          // Check if previous is done (first undone during loading)
          const prevIdx = allSections.indexOf(s) - 1;
          const prevDone = prevIdx < 0 || sectionDone(allSections[prevIdx].id);
          if (!prevDone) return null; // not yet reached
          return <LoadingCard key={s.id} titleAr={s.titleAr} titleEn={s.titleEn} icon={s.icon} />;
        }
        if (!done) return null;

        // Render completed section
        return (
          <SectionCard key={s.id} icon={s.icon} titleAr={s.titleAr} titleEn={s.titleEn}>
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
                      c.recommendation === 'رفض' ? 'text-red-600' : 'text-amber-600'
                    }`}>{c.recommendation}</span>
                  </div>
                </div>
              );
            })()}

            {s.id === 'shamsi' && session.shamsiAnalysis && (
              <ShamsiGrid items={session.shamsiAnalysis} />
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
          { key: 'firstInstance',  labelAr: 'حكم أول درجة',                icon: '⚖️' },
          { key: 'appeal',         labelAr: 'حكم الاستئناف',               icon: '📋' },
          { key: 'cassation',      labelAr: 'حكم التمييز / النقض',          icon: '🏛️' },
          { key: 'frenchCouncil',  labelAr: 'مجلس الدولة الفرنسي',         icon: '🇫🇷' },
          { key: 'europeanCourt',  labelAr: 'المحكمة الأوروبية',            icon: '🇪🇺' },
          { key: 'shamsiEval',     labelAr: 'تقييم نظرية الشامسي',          icon: '🧠' },
          { key: 'finalComparison',labelAr: 'النتيجة النهائية المقارنة',    icon: '📊' },
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
