import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Bot,
  Sparkles,
  Scale,
  BookOpen,
  FileText,
  BarChart2,
  Shield,
  ScrollText,
  Send,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Gavel } from '@/components/icons/gavel';
import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { StageProgress } from '@/components/jre/stage-progress';
import { JudgmentView } from '@/components/jre/judgment-view';
import { AuthorityHierarchy } from '@/components/jre/authority-hierarchy';
import {
  DISPUTE_TYPE_LABELS, type JreSession, type JudgmentOutput,
  type JreLegislationItem, type JrePrecedentItem, type JrePrinciple,
  type JreProportionality, type JreAiDimensionFinding, type JreStageTheory,
} from '@/types/jre';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  procedural:     'إجرائية',
  substantive:    'موضوعية',
  competence:     'اختصاص',
  form:           'شكل',
  proportionality:'تناسب',
};

const AUTHORITY_BADGE = (cls: string) =>
  cls === 'binding'
    ? <span className="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 font-medium">مُلزِم</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded border bg-gold/10 text-gold border-gold/25 dark:bg-gold/20 dark:text-gold/80 dark:border-gold/75 font-medium">مرجعي</span>;

// ─── Inline Theory Section ────────────────────────────────────────────────────
// Collapsible per-stage theory annotation. UAE binding analysis is always shown
// first; theory lens content is clearly marked [غير مُلزِم].

function InlineTheorySection({ theory, lensName }: { theory: JreStageTheory; lensName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 pt-3 border-t border-dashed border-gold/25 dark:border-gold/60" dir="rtl">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs w-full text-right text-gold dark:text-gold/80 hover:text-gold dark:hover:text-gold/40 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium">{lensName}</span>
        <span className="text-muted-foreground">[غير مُلزِم]</span>
        <span className="mr-auto">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {/* UAE binding — always first */}
          <div className="border-r-2 border-emerald-500 pr-3 py-0.5">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">القانون الإماراتي الملزم</p>
            <p className="leading-relaxed">{theory.uaeBindingAnalysis}</p>
          </div>

          {/* Theory lens */}
          {theory.theoryLensAnalysis && (
            <div className="border-r-2 border-gold/80 pr-3 py-0.5">
              <p className="text-xs font-semibold text-gold dark:text-gold/80 mb-1">
                {lensName} <span className="font-normal text-muted-foreground">[غير مُلزِم]</span>
              </p>
              <p className="leading-relaxed">{theory.theoryLensAnalysis}</p>
            </div>
          )}

          {/* French comparative (optional) */}
          {theory.frenchComparative && (
            <div className="border-r-2 border-blue-400 pr-3 py-0.5">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                القانون الفرنسي المقارن <span className="font-normal text-muted-foreground">[غير مُلزِم]</span>
              </p>
              <p className="leading-relaxed">{theory.frenchComparative}</p>
            </div>
          )}

          {/* Agreement / Difference / Added value */}
          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/40 rounded-lg p-2">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">توافق</p>
              <p className="text-foreground/80">{theory.agreement}</p>
            </div>
            <div className="bg-gold/10 dark:bg-gold/10 border border-gold/15 dark:border-gold/40 rounded-lg p-2">
              <p className="font-semibold text-gold dark:text-gold/80 mb-1">اختلاف</p>
              <p className="text-foreground/80">{theory.difference}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/40 rounded-lg p-2">
              <p className="font-semibold text-indigo-700 dark:text-indigo-400 mb-1">قيمة مضافة</p>
              <p className="text-foreground/80">{theory.addedValue}</p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/70 italic">{theory.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab IDs ──────────────────────────────────────────────────────────────────

type TabId = 'facts' | 'issues' | 'legislation' | 'precedents' | 'principles' | 'proportionality' | 'ai-review' | 'theory' | 'judgment';

const TABS: { id: TabId; labelAr: string; icon: React.ReactNode }[] = [
  { id: 'facts',           labelAr: 'الوقائع',             icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'issues',          labelAr: 'المسائل القانونية',   icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'legislation',     labelAr: 'التشريعات',           icon: <ScrollText className="w-3.5 h-3.5" /> },
  { id: 'precedents',      labelAr: 'السوابق القضائية',    icon: <Gavel className="w-3.5 h-3.5" /> },
  { id: 'principles',      labelAr: 'المبادئ',             icon: <Scale className="w-3.5 h-3.5" /> },
  { id: 'proportionality', labelAr: 'التناسب',             icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: 'ai-review',       labelAr: 'القرار الرقمي',       icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'theory',          labelAr: 'التحليل النظري',      icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'judgment',        labelAr: 'الحكم',               icon: <Shield className="w-3.5 h-3.5" /> },
];

// ─── Tab panels ───────────────────────────────────────────────────────────────

function FactsTab({ judgment }: { judgment: JudgmentOutput }) {
  const { facts } = judgment;
  return (
    <div className="space-y-5" dir="rtl">
      <div className="bg-muted/30 rounded-lg p-4 border">
        <h4 className="text-sm font-semibold mb-2">ملخص الوقائع</h4>
        <p className="text-sm leading-relaxed">{facts.summary}</p>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-3">الوقائع الجوهرية</h4>
        <div className="space-y-2">
          {facts.keyFacts.map((f, i) => (
            <div key={i} className="flex gap-3 p-3 border rounded-lg bg-card">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">{i + 1}</span>
              <div>
                <div className="text-sm">{f.factAr}</div>
                {f.significance && <div className="text-xs text-muted-foreground mt-0.5">{f.significance}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-card border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">المدعي</div>
          <div className="font-medium text-sm">{facts.applicantAr || facts.applicant}</div>
          {facts.applicantAr && facts.applicant && facts.applicantAr !== facts.applicant && (
            <div className="text-xs text-muted-foreground" dir="ltr">{facts.applicant}</div>
          )}
        </div>
        <div className="p-3 bg-card border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">المدعى عليه</div>
          <div className="font-medium text-sm">{facts.respondentAr || facts.respondent}</div>
          {facts.respondentAr && facts.respondent && facts.respondentAr !== facts.respondent && (
            <div className="text-xs text-muted-foreground" dir="ltr">{facts.respondent}</div>
          )}
        </div>
      </div>
      {facts.hasAiSystemInvolved && (
        <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-lg text-sm text-violet-700 dark:text-violet-400">
          <Bot className="w-4 h-4 shrink-0" />
          القرار المطعون فيه يتضمن نظاماً رقمياً أو خوارزمياً — تمَّ تفعيل المراجعة الرقمية
        </div>
      )}
    </div>
  );
}

function IssuesTab({ judgment }: { judgment: JudgmentOutput }) {
  return (
    <div className="space-y-3" dir="rtl">
      {judgment.legalIssues.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">لم تُحدَّد مسائل قانونية</div>
      ) : (
        judgment.legalIssues.map((issue, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{issue.issueAr}</div>
                {issue.issueEn && <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{issue.issueEn}</div>}
                <Badge variant="outline" className="mt-2 text-xs">
                  {CLASSIFICATION_LABELS[issue.classification] ?? issue.classification}
                </Badge>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LegislationTab({ legislation, stageTheory, lensName }: { legislation: JreLegislationItem[]; stageTheory?: JreStageTheory; lensName?: string }) {
  return (
    <div className="space-y-3" dir="rtl">
      {legislation.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">لا توجد تشريعات مُحدَّدة</div>
      ) : (
        legislation.map((leg, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm">{leg.titleAr}</div>
              <div className="flex items-center gap-1.5 shrink-0">
                {leg.isAmended && <Badge variant="outline" className="text-xs text-gold border-gold/40">مُعدَّل</Badge>}
                {AUTHORITY_BADGE(leg.authorityClass)}
              </div>
            </div>
            {(leg.documentNumber || leg.year) && (
              <div className="text-xs text-muted-foreground">
                {leg.documentNumber && `رقم ${leg.documentNumber}`}{leg.documentNumber && leg.year ? '، ' : ''}{leg.year && `سنة ${leg.year}`}
                {' | '}المستوى الهرمي: {leg.hierarchyLevel}
              </div>
            )}
            {leg.amendedBy && (
              <div className="text-xs text-gold dark:text-gold/80">معدَّل بواسطة: {leg.amendedBy}</div>
            )}
            {leg.relevantArticles.length > 0 && (
              <div className="space-y-1">
                {leg.relevantArticles.map((art, j) => (
                  <div key={j} className="text-xs text-muted-foreground p-2 bg-muted/40 rounded">{art}</div>
                ))}
              </div>
            )}
            {leg.ragTag && <div className="text-[10px] font-mono text-muted-foreground/60">{leg.ragTag}</div>}
          </div>
        ))
      )}
      {stageTheory && <InlineTheorySection theory={stageTheory} lensName={lensName ?? 'التحليل النظري'} />}
    </div>
  );
}

function PrecedentsTab({ precedents, stageTheory, lensName }: { precedents: JrePrecedentItem[]; stageTheory?: JreStageTheory; lensName?: string }) {
  return (
    <div className="space-y-3" dir="rtl">
      {precedents.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">لا توجد سوابق قضائية مُحدَّدة</div>
      ) : (
        precedents.map((p, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{p.court}</div>
                <div className="text-xs text-muted-foreground">{p.caseRef} — {p.year}</div>
              </div>
              {AUTHORITY_BADGE(p.authorityClass)}
            </div>
            <div className="text-sm text-right leading-relaxed border-r-2 border-primary/30 pr-3">{p.principleAr}</div>
            {p.relevance && <div className="text-xs text-muted-foreground">{p.relevance}</div>}
            {p.ragTag && <div className="text-[10px] font-mono text-muted-foreground/60">{p.ragTag}</div>}
          </div>
        ))
      )}
      {stageTheory && <InlineTheorySection theory={stageTheory} lensName={lensName ?? 'التحليل النظري'} />}
    </div>
  );
}

function PrinciplesTab({ principles, stageTheory, lensName }: { principles: JrePrinciple[]; stageTheory?: JreStageTheory; lensName?: string }) {
  return (
    <div className="space-y-3" dir="rtl">
      {principles.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">لا توجد مبادئ قانونية محددة</div>
      ) : (
        principles.map((p, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">{p.nameAr}</div>
                {p.nameEn && <div className="text-xs text-muted-foreground" dir="ltr">{p.nameEn}</div>}
              </div>
              {AUTHORITY_BADGE(p.authorityClass)}
            </div>
            <p className="text-sm leading-relaxed">{p.applicationAr}</p>
            <div className="text-xs text-muted-foreground">الأساس القانوني: {p.legalBasis}</div>
          </div>
        ))
      )}
      {stageTheory && <InlineTheorySection theory={stageTheory} lensName={lensName ?? 'التحليل النظري'} />}
    </div>
  );
}

function ProportionalityTab({ prop, stageTheory, lensName }: { prop: JreProportionality; stageTheory?: JreStageTheory; lensName?: string }) {
  if (!prop.applicable) {
    return (
      <div className="text-center text-muted-foreground py-12">
        مراجعة التناسب لا تنطبق على هذا النزاع
      </div>
    );
  }
  const result = prop.overallFinding;
  return (
    <div className="space-y-4" dir="rtl">
      {/* Overall */}
      <div className={`p-4 rounded-lg border-2 ${
        result === 'proportionate' ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/10 dark:border-emerald-700'
        : result === 'disproportionate' ? 'bg-red-50 border-red-300 dark:bg-red-900/10 dark:border-red-700'
        : 'bg-gray-50 border-gray-200 dark:bg-gray-900/10 dark:border-gray-700'
      }`}>
        <div className="font-semibold text-sm mb-1">النتيجة الإجمالية</div>
        <div className={`text-sm font-bold ${
          result === 'proportionate' ? 'text-emerald-700 dark:text-emerald-400'
          : result === 'disproportionate' ? 'text-red-700 dark:text-red-400'
          : 'text-gray-600 dark:text-gray-400'
        }`}>
          {result === 'proportionate' ? 'القرار مُتناسِب' : result === 'disproportionate' ? 'القرار غير مُتناسِب' : 'لا ينطبق'}
        </div>
      </div>

      {prop.legitimateAim && (
        <div className="p-3 bg-card border rounded-lg">
          <div className="text-xs font-semibold text-muted-foreground mb-1">الهدف المشروع</div>
          <div className="text-sm">{prop.legitimateAim}</div>
        </div>
      )}

      {[
        { label: 'الضرورة (Necessity)', data: prop.necessity },
        { label: 'التناسب بالمعنى الدقيق (Proportionality SS)', data: prop.proportionalitySS },
      ].map(({ label, data }) => data && (
        <div key={label} className={`p-3 border rounded-lg ${data.compliant ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : 'bg-red-50/50 dark:bg-red-900/5'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            {data.compliant
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              : <XCircle className="w-3.5 h-3.5 text-red-600" />}
          </div>
          <div className="text-sm">{data.finding}</div>
        </div>
      ))}
      {stageTheory && <InlineTheorySection theory={stageTheory} lensName={lensName ?? 'التحليل النظري'} />}
    </div>
  );
}

function AiReviewTab({ review, visible, stageTheory, lensName }: { review: JudgmentOutput['aiDecisionReview']; visible: boolean; stageTheory?: JreStageTheory; lensName?: string }) {
  if (!visible || !review.applicable) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-2">
        <Bot className="w-8 h-8 mx-auto opacity-30" />
        <p>لا ينطبق — القرار لا يتضمن نظاماً رقمياً أو خوارزمياً</p>
      </div>
    );
  }
  return (
    <div className="space-y-3" dir="rtl">
      {review.overallNote && (
        <div className="p-3 bg-muted/30 border rounded-lg text-sm">{review.overallNote}</div>
      )}
      {(review.dimensions ?? []).map((d, i) => (
        <div key={i} className={`p-3 border rounded-lg ${d.compliant ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : 'bg-red-50/50 dark:bg-red-900/5'}`}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <span className="text-sm font-semibold">{d.dimensionAr}</span>
              <span className="text-xs text-muted-foreground ml-2 font-mono">({d.dimension})</span>
            </div>
            {d.compliant
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
          </div>
          <p className="text-sm">{d.finding}</p>
          {d.basis && <p className="text-xs text-muted-foreground mt-1 border-t pt-1">{d.basis}</p>}
        </div>
      ))}
      {stageTheory && <InlineTheorySection theory={stageTheory} lensName={lensName ?? 'التحليل النظري'} />}
    </div>
  );
}

function TheoryTab({ theory, stageTheory }: { theory: JudgmentOutput['theoryAnalysis']; stageTheory: JudgmentOutput['stageTheory'] }) {
  // When per-stage theory is available, show a guide and per-stage summary.
  // Falls back to the legacy single-block view for older sessions.
  if (stageTheory && stageTheory.length > 0) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex items-start gap-2 p-3 bg-gold/10 dark:bg-gold/10 border border-gold/25 dark:border-gold/75 rounded-lg">
          <Info className="w-4 h-4 text-gold dark:text-gold/80 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-gold/75 dark:text-gold/40 font-medium mb-1">
              التحليل النظري مُدمَج الآن داخل كل قسم
            </p>
            <p className="text-xs text-gold dark:text-gold/80">
              انقر على "▾ {theory.lensName} [غير مُلزِم]" أسفل أي قسم (التشريعات، السوابق، المبادئ، التناسب، القرار الرقمي) لعرض التحليل المقارن. هذا التحليل غير مُلزِم ولا يُعدِّل الحكم القانوني.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">ملخص المراحل المحلَّلة نظرياً</h4>
          {stageTheory.map((s) => (
            <div key={s.stageId} className="p-4 bg-card border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />
                <span className="font-medium text-sm">{s.stageNameAr}</span>
                <Badge variant="outline" className="text-xs text-muted-foreground">غير مُلزِم</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {s.theoryLensAnalysis ?? s.uaeBindingAnalysis}
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded p-1.5">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">توافق: </span>{s.agreement}
                </div>
                <div className="bg-gold/10 dark:bg-gold/10 rounded p-1.5">
                  <span className="font-medium text-gold dark:text-gold/80">اختلاف: </span>{s.difference}
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded p-1.5">
                  <span className="font-medium text-indigo-700 dark:text-indigo-400">قيمة: </span>{s.addedValue}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Backward compat: legacy single-block view
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-start gap-2 p-3 bg-gold/10 dark:bg-gold/10 border border-gold/25 dark:border-gold/75 rounded-lg">
        <Info className="w-4 h-4 text-gold dark:text-gold/80 mt-0.5 shrink-0" />
        <p className="text-sm text-gold/75 dark:text-gold/40">
          {theory.disclaimer || 'هذا التحليل النظري غير مُلزِم قانونياً ولا يُشكِّل سلطة قضائية ملزمة. الأحكام القانونية الإماراتية الواردة في أسباب الحكم تسود دائماً عند التعارض.'}
        </p>
      </div>
      {theory.applied && theory.analysisAr ? (
        <div className="p-4 bg-card border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="font-semibold text-sm">{theory.lensName}</span>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{theory.analysisAr}</div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8">
          لم يُفعَّل التحليل النظري في هذه الجلسة
        </div>
      )}
    </div>
  );
}

// ─── Follow-up chat ───────────────────────────────────────────────────────────

function FollowUpChat({ sessionId }: { sessionId: number }) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [replies, setReplies]   = useState<Array<{ q: string; a: string }>>([]);

  const mutation = useMutation({
    mutationFn: (msg: string) =>
      apiFetch(`/api/jre/sessions/${sessionId}/follow-up`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed');
        return d as { reply: string };
      }),
    onSuccess: (data) => {
      setReplies((prev) => [...prev, { q: message.trim(), a: data.reply }]);
      setMessage('');
    },
    onError: (err: Error) => {
      toast({ title: 'تعذَّر الرد', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="border-t mt-8 pt-6 space-y-4" dir="rtl">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Send className="w-3.5 h-3.5" />
        أسئلة متابعة حول الحكم
      </h4>
      {replies.map((r, i) => (
        <div key={i} className="space-y-2">
          <div className="bg-primary/10 text-primary rounded-lg px-4 py-2.5 text-sm max-w-prose mr-auto text-right">{r.q}</div>
          <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-sm leading-relaxed max-w-prose text-right">{r.a}</div>
        </div>
      ))}
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اطرح سؤالاً حول الحكم أو اطلب توضيحاً لجزء منه…"
          rows={2}
          dir="rtl"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
              e.preventDefault();
              mutation.mutate(message.trim());
            }
          }}
        />
        <Button
          onClick={() => message.trim() && mutation.mutate(message.trim())}
          disabled={mutation.isPending || !message.trim()}
          size="icon"
          className="h-auto"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JreSessionPage() {
  const params              = useParams<{ id: string }>();
  const [, navigate]        = useLocation();
  const [activeTab, setTab] = useState<TabId>('facts');

  const { data, isLoading, error } = useQuery({
    queryKey: ['jre-session', params.id],
    queryFn:  () => apiFetch(`/api/jre/sessions/${params.id}`).then((r) => r.json()) as Promise<{ session: JreSession }>,
    refetchInterval: (d) => d.state.data?.session?.status === 'analyzing' ? 3000 : false,
  });

  const session  = data?.session;
  const judgment = session?.judgment as JudgmentOutput | null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>جارٍ التحميل…</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-6 flex items-center gap-2 text-red-600">
        <AlertCircle className="w-5 h-5" />
        تعذَّر تحميل الجلسة
      </div>
    );
  }

  const dtConf = DISPUTE_TYPE_LABELS[session.disputeType] ?? DISPUTE_TYPE_LABELS.other;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5" dir="rtl">
      {/* ── Back + header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/jre')} className="gap-1 text-muted-foreground">
          <ArrowRight className="w-4 h-4" />
          العودة
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary shrink-0" />
            {session.title}
          </h1>
          <div className="flex flex-wrap gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dtConf.color}`}>{dtConf.ar}</span>
            {session.hasAiDecision === 'true' && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <Bot className="w-3 h-3" /> قرار رقمي
              </span>
            )}
            {session.theoryLensId && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold dark:bg-gold/30 dark:text-gold/80">
                <Sparkles className="w-3 h-3" /> {session.theoryLensName}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{formatDate(session.createdAt)}</div>
      </div>

      {/* ── Stage progress ─────────────────────────────────────────────── */}
      <StageProgress status={session.status} />

      {/* ── Status banners ─────────────────────────────────────────────── */}
      {session.status === 'analyzing' && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          جارٍ تنفيذ التحليل القضائي… يرجى الانتظار (قد يستغرق 1-2 دقيقة)
        </div>
      )}
      {session.status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          تعذَّر إكمال التحليل — يرجى إنشاء جلسة جديدة
        </div>
      )}

      {/* ── Tabs (only when complete) ──────────────────────────────────── */}
      {session.status === 'complete' && judgment && (
        <>
          {/* Tab bar */}
          <div className="border-b overflow-x-auto">
            <div className="flex gap-0 min-w-max">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.labelAr}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="min-h-[300px]">
            {activeTab === 'facts'           && <FactsTab judgment={judgment} />}
            {activeTab === 'issues'          && <IssuesTab judgment={judgment} />}
            {activeTab === 'legislation'     && <LegislationTab legislation={judgment.legislation} stageTheory={judgment.stageTheory?.find(s => s.stageId === 'legislation')} lensName={session.theoryLensName ?? undefined} />}
            {activeTab === 'precedents'      && <PrecedentsTab precedents={judgment.precedents} stageTheory={judgment.stageTheory?.find(s => s.stageId === 'precedents')} lensName={session.theoryLensName ?? undefined} />}
            {activeTab === 'principles'      && <PrinciplesTab principles={judgment.principles} stageTheory={judgment.stageTheory?.find(s => s.stageId === 'principles')} lensName={session.theoryLensName ?? undefined} />}
            {activeTab === 'proportionality' && <ProportionalityTab prop={judgment.proportionality} stageTheory={judgment.stageTheory?.find(s => s.stageId === 'proportionality')} lensName={session.theoryLensName ?? undefined} />}
            {activeTab === 'ai-review'       && <AiReviewTab review={judgment.aiDecisionReview} visible={session.hasAiDecision === 'true' || judgment.aiDecisionReview.applicable} stageTheory={judgment.stageTheory?.find(s => s.stageId === 'ai_review')} lensName={session.theoryLensName ?? undefined} />}
            {activeTab === 'theory'          && <TheoryTab theory={judgment.theoryAnalysis} stageTheory={judgment.stageTheory ?? []} />}
            {activeTab === 'judgment'        && (
              <>
                <JudgmentView judgment={judgment} />
                <FollowUpChat sessionId={session.id} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
