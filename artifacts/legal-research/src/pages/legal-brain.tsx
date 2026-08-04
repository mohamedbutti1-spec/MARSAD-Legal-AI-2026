/**
 * Legal Intelligence Brain — Stage 4
 * 6-engine hub: Judicial Reasoning · Admin Legality · Shamsi Theory ·
 * Comparative Analysis · Memorandum Generator · Risk Assessment
 */

import React, { useState, useRef } from 'react';
import {
  Brain,
  Scale,
  FlaskConical,
  GitCompareArrows,
  FileText,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCheck,
  Loader2,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Sparkles,
} from 'lucide-react';
import { Gavel } from '@/components/icons/gavel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator }  from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';
import { useToast }  from '@/hooks/use-toast';
import { useUserContext } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Explainability {
  why: string;
  whyNot: string;
  legalBasis: string;
  counterArguments: string[];
  alternativeViews: string[];
}
interface Citation {
  type: string;
  ref: string;
  textAr: string;
  system?: string;
}
interface JudicialStage {
  id: string; nameAr: string; analysis: string; finding: string; legalBasis: string[];
}
interface JudicialResult {
  jurisdiction: string; stages: JudicialStage[]; ruling: string; rulingType: string;
  confidence: number; legalRisk: string; explainability: Explainability;
  citations: Citation[]; appealProbability: number; recommendations: string[];
}
interface LegalityCriterion {
  id: string; nameAr: string; status: string; score: number;
  analysis: string; legalBasis: string; gap: string | null;
}
interface AdminLegalityResult {
  criteria: LegalityCriterion[]; overallValidity: string; legalityScore: number;
  annulmentGrounds: string[]; recommendations: string[]; confidence: number;
  explainability: Explainability; citations: Citation[];
}
interface ShamsiPrinciple {
  id: string; nameAr: string; score: number; status: string;
  analysis: string; gaps: string[]; recommendations: string[];
}
interface ShamsiResult {
  principles: ShamsiPrinciple[]; overallScore: number; complianceLevel: string;
  criticalGaps: string[]; recommendations: string[]; confidence: number;
  explainability: Explainability;
}
interface ComparisonRow {
  aspect: string; uae: string; france: string; eu: string | null;
  similarity: string; notes: string;
}
interface ComparativeResult {
  topic: string; rows: ComparisonRow[]; keyDifferences: string[];
  convergenceAreas: string[]; uaeLegalOrigins: string; practicalImplications: string;
  recommendedApproach: string; confidence: number; citations: Citation[];
}
interface MemoSection { heading: string; content: string; }
interface MemoResult {
  docType: string; docTypeAr: string; title: string; date: string;
  sections: MemoSection[]; conclusion: string; legalBases: string[];
  citations: Citation[]; confidence: number; strengthAssessment: string; risks: string[];
}
interface RiskDimension {
  level: string; score: number; factors: string[]; mitigations: string[];
}
interface RiskResult {
  legalRisk: RiskDimension; proceduralRisk: RiskDimension;
  constitutionalRisk: RiskDimension; aiRisk: RiskDimension;
  overallRisk: string; overallScore: number; confidence: number;
  urgentActions: string[]; explainability: Explainability; citations: Citation[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function t(ar: string, en: string) {
  return ar; // Arabic-first platform
}

const RISK_COLOR: Record<string, string> = {
  'حرج':    'text-red-700 bg-red-50 border-red-200',
  'مرتفع':  'text-gold bg-gold/10 border-gold/25',
  'متوسط':  'text-gold bg-gold/10 border-gold/25',
  'منخفض':  'text-emerald-700 bg-emerald-50 border-emerald-200',
};
const RISK_BAR_COLOR: Record<string, string> = {
  'حرج':    'bg-red-500',
  'مرتفع':  'bg-gold',
  'متوسط':  'bg-gold',
  'منخفض':  'bg-emerald-500',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  'سليم':        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
  'ممتثل':       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
  'معيب':        <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0" />,
  'ممتثل جزئياً': <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0" />,
  'باطل':        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
  'غير ممتثل':   <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
};
const SIMILARITY_COLOR: Record<string, string> = {
  'تطابق':          'text-emerald-700 bg-emerald-50',
  'تقارب':          'text-blue-700 bg-blue-50',
  'اختلاف جوهري':  'text-gold bg-gold/10',
  'تعارض':          'text-red-700 bg-red-50',
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function ConfidenceBar({ value, label = 'الثقة' }: { value: number; label?: string }) {
  const color = value >= 85 ? 'text-emerald-700' : value >= 70 ? 'text-gold' : 'text-red-700';
  const barColor = value >= 85 ? '[&>div]:bg-emerald-500' : value >= 70 ? '[&>div]:bg-gold' : '[&>div]:bg-red-500';
  return (
    <div className="flex items-center gap-3" dir="rtl">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <Progress value={value} className={`h-1.5 flex-1 ${barColor}`} />
      <span className={`text-[11px] font-bold shrink-0 ${color}`}>{value}%</span>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_COLOR[level] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
      {level}
    </span>
  );
}

function ExplainabilityCard({ data }: { data: Explainability }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border border-violet-200 rounded-xl overflow-hidden" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-violet-50 hover:bg-violet-100 transition-colors text-[11px] font-bold text-violet-800"
      >
        <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />طبقة التفسيرية — لماذا هذا الحكم؟</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="p-3 space-y-2.5 bg-white text-sm">
          <div><span className="font-semibold text-emerald-700 text-[11px]">✅ لماذا هذا الحكم:</span><p className="text-muted-foreground mt-0.5 text-[12px]">{data.why}</p></div>
          <Separator />
          <div><span className="font-semibold text-red-700 text-[11px]">❌ لماذا ليس حكماً آخر:</span><p className="text-muted-foreground mt-0.5 text-[12px]">{data.whyNot}</p></div>
          <Separator />
          <div><span className="font-semibold text-primary text-[11px]">⚖️ الأساس القانوني:</span><p className="text-muted-foreground mt-0.5 text-[12px]">{data.legalBasis}</p></div>
          {data.counterArguments?.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="font-semibold text-gold text-[11px]">🔁 الحجج المضادة:</span>
                <ul className="mt-1 space-y-0.5">{data.counterArguments.map((a, i) => <li key={i} className="text-[12px] text-muted-foreground">• {a}</li>)}</ul>
              </div>
            </>
          )}
          {data.alternativeViews?.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="font-semibold text-blue-700 text-[11px]">💡 آراء بديلة:</span>
                <ul className="mt-1 space-y-0.5">{data.alternativeViews.map((v, i) => <li key={i} className="text-[12px] text-muted-foreground">• {v}</li>)}</ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CitationsList({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-3" dir="rtl">
      <p className="text-[10px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">المراجع والمصادر</p>
      <div className="space-y-1">
        {citations.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <BookOpen className="w-3 h-3 shrink-0 mt-0.5 text-primary/50" />
            <span><span className="font-medium text-foreground">{c.ref}</span> — {c.textAr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelBadge({ model }: { model?: string }) {
  if (!model) return null;
  return <span className="text-[9px] text-muted-foreground/60 font-mono">{model}</span>;
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm" dir="rtl">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={doCopy}
      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 hover:bg-muted/30 transition-colors"
    >
      {copied ? <CheckCheck className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'تم النسخ' : 'نسخ'}
    </button>
  );
}

// ─── 1. Judicial Reasoning Tab ────────────────────────────────────────────────

function JudicialReasoningTab() {
  const { toast } = useToast();
  const [facts, setFacts]               = useState('');
  const [disputeType, setDisputeType]   = useState('');
  const [jurisdiction, setJurisdiction] = useState('الإمارات العربية المتحدة');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<JudicialResult | null>(null);
  const [model, setModel]               = useState('');
  const [error, setError]               = useState('');

  async function run() {
    if (!facts.trim()) { toast({ title: 'الوقائع مطلوبة', variant: 'destructive' }); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiFetch('/api/legal-brain/judicial-reasoning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts, disputeType, jurisdiction }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'حدث خطأ'); return; }
      setResult(d.result as JudicialResult);
      setModel(d.model ?? '');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally { setLoading(false); }
  }

  const RULING_COLOR: Record<string, string> = {
    'قبول': 'border-emerald-500 bg-emerald-50 text-emerald-800',
    'رفض':  'border-red-500 bg-red-50 text-red-800',
    'قبول جزئي': 'border-gold bg-gold/10 text-gold/75',
  };
  const rulingClass = result ? (RULING_COLOR[result.rulingType] ?? 'border-primary bg-primary/5 text-primary') : '';

  return (
    <div className="space-y-4" dir="rtl">
      {/* Input */}
      <SectionCard>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Gavel className="w-4 h-4 text-primary" />محرك الاستدلال القضائي</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-[11px]">نوع النزاع</Label>
            <Input value={disputeType} onChange={(e) => setDisputeType(e.target.value)} placeholder="إداري · مدني · جنائي · دستوري" className="mt-1 text-sm" dir="rtl" />
          </div>
          <div>
            <Label className="text-[11px]">الولاية القضائية</Label>
            <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="الإمارات — المحكمة الاتحادية" className="mt-1 text-sm" dir="rtl" />
          </div>
        </div>
        <Label className="text-[11px]">الوقائع والمعطيات القانونية</Label>
        <Textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={6} placeholder="اكتب وقائع النزاع بالتفصيل — الأطراف والإجراءات والمسائل المثارة..." className="mt-1 text-sm" dir="rtl" />
        <Button onClick={run} disabled={loading} className="mt-3 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
          {loading ? 'جارٍ التحليل القضائي...' : 'تشغيل المحرك القضائي'}
        </Button>
      </SectionCard>

      {error && <ErrorCard message={error} />}

      {/* Output */}
      {result && (
        <div className="space-y-3">
          {/* Ruling banner */}
          <div className={`rounded-xl border-2 p-4 ${rulingClass}`} dir="rtl">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">الحكم القضائي المقترح</p>
                <p className="font-bold text-base leading-relaxed">{result.ruling}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge variant="outline" className="text-[10px]">{result.rulingType}</Badge>
                <span className="text-[10px] opacity-70">📍 {result.jurisdiction}</span>
                <RiskBadge level={result.legalRisk} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
              <ConfidenceBar value={result.confidence} label="ثقة الحكم" />
              <ConfidenceBar value={result.appealProbability ?? 0} label="احتمال الاستئناف" />
            </div>
          </div>

          {/* Reasoning stages */}
          <SectionCard>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">مراحل الاستدلال القضائي</p>
            <Accordion type="multiple" className="space-y-1">
              {result.stages?.map((stage, i) => (
                <AccordionItem key={stage.id} value={stage.id} className="border border-border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                    <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>{stage.nameAr}</span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 space-y-2 text-sm">
                    <p className="text-muted-foreground leading-relaxed">{stage.analysis}</p>
                    <div className="bg-muted/40 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-foreground mb-1">الخلاصة:</p>
                      <p className="text-[12px]">{stage.finding}</p>
                    </div>
                    {stage.legalBasis?.length > 0 && (
                      <div className="space-y-0.5">
                        {stage.legalBasis.map((b, j) => <p key={j} className="text-[11px] text-primary">📌 {b}</p>)}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SectionCard>

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <SectionCard>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">التوصيات</p>
              <ul className="space-y-1">{result.recommendations.map((r, i) => <li key={i} className="text-sm text-foreground flex gap-2"><span className="text-primary">→</span>{r}</li>)}</ul>
            </SectionCard>
          )}

          {result.explainability && <ExplainabilityCard data={result.explainability} />}
          {result.citations?.length > 0 && <SectionCard><CitationsList citations={result.citations} /></SectionCard>}
          <ModelBadge model={model} />
        </div>
      )}
    </div>
  );
}

// ─── 2. Administrative Legality Analyzer ─────────────────────────────────────

function AdminLegalityTab() {
  const { toast } = useToast();
  const [decisionText, setDecisionText]         = useState('');
  const [decisionType, setDecisionType]         = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [decisionDate, setDecisionDate]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<AdminLegalityResult | null>(null);
  const [model, setModel]       = useState('');
  const [error, setError]       = useState('');

  async function run() {
    if (!decisionText.trim()) { toast({ title: 'نص القرار مطلوب', variant: 'destructive' }); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiFetch('/api/legal-brain/admin-legality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionText, decisionType, issuingAuthority, decisionDate }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'حدث خطأ'); return; }
      setResult(d.result as AdminLegalityResult); setModel(d.model ?? '');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally { setLoading(false); }
  }

  const VALIDITY_STYLE: Record<string, string> = {
    'صحيح':           'border-emerald-500 bg-emerald-50 text-emerald-800',
    'قابل للإبطال':   'border-gold bg-gold/10 text-gold/75',
    'باطل':           'border-red-500 bg-red-50 text-red-800',
  };
  const STATUS_BG: Record<string, string> = {
    'سليم': 'bg-emerald-50 border-emerald-200',
    'معيب': 'bg-gold/10 border-gold/25',
    'باطل': 'bg-red-50 border-red-200',
  };

  return (
    <div className="space-y-4" dir="rtl">
      <SectionCard>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Scale className="w-4 h-4 text-primary" />محلّل مشروعية القرار الإداري — الأركان التسعة</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-[11px]">نوع القرار</Label>
            <Input value={decisionType} onChange={(e) => setDecisionType(e.target.value)} placeholder="تعيين · فصل · ترقية · تراخيص..." className="mt-1 text-sm" dir="rtl" />
          </div>
          <div>
            <Label className="text-[11px]">الجهة المصدِرة</Label>
            <Input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} placeholder="اسم الجهة الحكومية" className="mt-1 text-sm" dir="rtl" />
          </div>
          <div>
            <Label className="text-[11px]">تاريخ القرار</Label>
            <Input value={decisionDate} onChange={(e) => setDecisionDate(e.target.value)} placeholder="YYYY-MM-DD" className="mt-1 text-sm" dir="ltr" />
          </div>
        </div>
        <Label className="text-[11px]">نص القرار أو وقائعه</Label>
        <Textarea value={decisionText} onChange={(e) => setDecisionText(e.target.value)} rows={6} placeholder="انسخ نص القرار الإداري أو صِف وقائعه بالتفصيل..." className="mt-1 text-sm" dir="rtl" />
        <Button onClick={run} disabled={loading} className="mt-3 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
          {loading ? 'جارٍ التحليل...' : 'تحليل المشروعية'}
        </Button>
      </SectionCard>

      {error && <ErrorCard message={error} />}

      {result && (
        <div className="space-y-3">
          {/* Verdict */}
          <div className={`rounded-xl border-2 p-4 ${VALIDITY_STYLE[result.overallValidity] ?? 'border-gray-300 bg-gray-50 text-gray-800'}`} dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">الحكم الكلي على مشروعية القرار</p>
                <p className="font-black text-2xl mt-0.5">{result.overallValidity}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] opacity-70 mb-1">درجة المشروعية</p>
                <p className="font-black text-3xl">{result.legalityScore}<span className="text-base font-normal opacity-70">%</span></p>
              </div>
            </div>
            <ConfidenceBar value={result.confidence} label="الثقة" />
          </div>

          {/* 9 criteria grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.criteria?.map((c) => (
              <div key={c.id} className={`rounded-xl border p-3 ${STATUS_BG[c.status] ?? 'bg-muted/30 border-border'}`} dir="rtl">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">{STATUS_ICON[c.status]}<span className="text-[11px] font-bold">{c.nameAr}</span></div>
                  <span className="text-[11px] font-bold">{c.score}%</span>
                </div>
                <Progress value={c.score} className="h-1 mb-2" />
                <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{c.analysis}</p>
                {c.gap && <p className="text-[10px] text-red-600 mt-1">⚠ {c.gap}</p>}
                {c.legalBasis && <p className="text-[10px] text-primary mt-1">📌 {c.legalBasis}</p>}
              </div>
            ))}
          </div>

          {/* Annulment grounds & recommendations */}
          {result.annulmentGrounds?.length > 0 && (
            <SectionCard>
              <p className="text-[11px] font-bold text-red-700 mb-2">أسباب الإبطال / أوجه الطعن</p>
              <ul className="space-y-1">{result.annulmentGrounds.map((g, i) => <li key={i} className="text-sm text-foreground flex gap-2"><XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />{g}</li>)}</ul>
            </SectionCard>
          )}
          {result.recommendations?.length > 0 && (
            <SectionCard>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">التوصيات</p>
              <ul className="space-y-1">{result.recommendations.map((r, i) => <li key={i} className="text-sm text-foreground flex gap-2"><span className="text-primary">→</span>{r}</li>)}</ul>
            </SectionCard>
          )}

          {result.explainability && <ExplainabilityCard data={result.explainability} />}
          {result.citations?.length > 0 && <SectionCard><CitationsList citations={result.citations} /></SectionCard>}
          <ModelBadge model={model} />
        </div>
      )}
    </div>
  );
}

// ─── 3. Native Shamsi Theory Engine ──────────────────────────────────────────

function ShamsiTheoryTab() {
  const { toast } = useToast();
  const [scenarioText, setScenarioText] = useState('');
  const [systemType, setSystemType]     = useState('');
  const [decisionDomain, setDecisionDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ShamsiResult | null>(null);
  const [model, setModel]     = useState('');
  const [error, setError]     = useState('');

  async function run() {
    if (!scenarioText.trim()) { toast({ title: 'السيناريو مطلوب', variant: 'destructive' }); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiFetch('/api/legal-brain/shamsi-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioText, systemType, decisionDomain }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'حدث خطأ'); return; }
      setResult(d.result as ShamsiResult); setModel(d.model ?? '');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally { setLoading(false); }
  }

  const COMPLIANCE_COLOR: Record<string, string> = {
    'عالٍ':  'border-emerald-500 bg-emerald-50 text-emerald-800',
    'متوسط': 'border-gold bg-gold/10 text-gold/75',
    'منخفض': 'border-gold bg-gold/10 text-gold/75',
    'حرج':   'border-red-500 bg-red-50 text-red-800',
  };
  const STATUS_BG_SHAMSI: Record<string, string> = {
    'ممتثل':         'bg-emerald-50 border-emerald-200',
    'ممتثل جزئياً': 'bg-gold/10 border-gold/25',
    'غير ممتثل':    'bg-red-50 border-red-200',
  };

  return (
    <div className="space-y-4" dir="rtl">
      <SectionCard>
        <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: '#2B5F9E' }} />
          <span style={{ color: '#1a3a6e' }}>محرك نظرية الشامسي — المبادئ الأحد عشر</span>
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">يقيّم كل مبدأ من مبادئ القانون الإداري الخوارزمي كوحدة تحليلية مستقلة بنسبة امتثال دقيقة</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-[11px]">نوع النظام</Label>
            <Input value={systemType} onChange={(e) => setSystemType(e.target.value)} placeholder="نظام ذكاء اصطناعي · خوارزمية · منصة رقمية..." className="mt-1 text-sm" dir="rtl" />
          </div>
          <div>
            <Label className="text-[11px]">مجال القرار</Label>
            <Input value={decisionDomain} onChange={(e) => setDecisionDomain(e.target.value)} placeholder="تعيينات · تراخيص · مخالفات · مدفوعات..." className="mt-1 text-sm" dir="rtl" />
          </div>
        </div>
        <Label className="text-[11px]">وصف السيناريو</Label>
        <Textarea value={scenarioText} onChange={(e) => setScenarioText(e.target.value)} rows={6} placeholder="صِف النظام أو الخوارزمية أو القرار الإداري الآلي المراد تقييمه..." className="mt-1 text-sm" dir="rtl" />
        <Button onClick={run} disabled={loading} className="mt-3 gap-2" style={{ background: '#1a3a6e' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
          {loading ? 'جارٍ تطبيق النظرية...' : 'تشغيل نظرية الشامسي'}
        </Button>
      </SectionCard>

      {error && <ErrorCard message={error} />}

      {result && (
        <div className="space-y-3">
          {/* Overall score */}
          <div className={`rounded-xl border-2 p-4 ${COMPLIANCE_COLOR[result.complianceLevel] ?? 'border-primary bg-primary/5 text-primary'}`} dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">مؤشر امتثال الشامسي</p>
                <p className="font-black text-3xl mt-0.5">{result.overallScore}<span className="text-base font-normal opacity-70">%</span></p>
                <p className="font-bold text-sm mt-0.5">مستوى الامتثال: {result.complianceLevel}</p>
              </div>
              <div className="text-right">
                <ConfidenceBar value={result.confidence} label="الثقة" />
              </div>
            </div>
          </div>

          {/* 11 Principles grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.principles?.map((p, i) => (
              <div key={p.id} className={`rounded-xl border p-3 ${STATUS_BG_SHAMSI[p.status] ?? 'bg-muted/30 border-border'}`} dir="rtl">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0" style={{ background: '#1a3a6e', color: 'white' }}>{i + 1}</span>
                    <span className="text-[11px] font-bold truncate">{p.nameAr}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {STATUS_ICON[p.status]}
                    <span className="text-[12px] font-black">{p.score}%</span>
                  </div>
                </div>
                <Progress value={p.score} className="h-1.5 mb-2" />
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{p.analysis}</p>
                {p.gaps?.length > 0 && <p className="text-[10px] text-red-600 mt-1">⚠ {p.gaps[0]}</p>}
              </div>
            ))}
          </div>

          {/* Critical gaps + recommendations */}
          {result.criticalGaps?.length > 0 && (
            <SectionCard>
              <p className="text-[11px] font-bold text-red-700 mb-2">الثغرات الحرجة</p>
              <ul className="space-y-1">{result.criticalGaps.map((g, i) => <li key={i} className="text-sm text-foreground flex gap-2"><XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />{g}</li>)}</ul>
            </SectionCard>
          )}
          {result.recommendations?.length > 0 && (
            <SectionCard>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">التوصيات</p>
              <ul className="space-y-1">{result.recommendations.map((r, i) => <li key={i} className="text-sm text-foreground flex gap-2"><span style={{ color: '#2B5F9E' }}>→</span>{r}</li>)}</ul>
            </SectionCard>
          )}

          {result.explainability && <ExplainabilityCard data={result.explainability} />}
          <ModelBadge model={model} />
        </div>
      )}
    </div>
  );
}

// ─── 4. Comparative Analysis Engine ──────────────────────────────────────────

function ComparativeAnalysisTab() {
  const { toast } = useToast();
  const [topic, setTopic]           = useState('');
  const [context, setContext]       = useState('');
  const [includeEu, setIncludeEu]   = useState(true);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<ComparativeResult | null>(null);
  const [model, setModel]           = useState('');
  const [error, setError]           = useState('');

  async function run() {
    if (!topic.trim()) { toast({ title: 'الموضوع مطلوب', variant: 'destructive' }); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiFetch('/api/legal-brain/comparative-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context, includeEuAiAct: includeEu }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'حدث خطأ'); return; }
      setResult(d.result as ComparativeResult); setModel(d.model ?? '');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <SectionCard>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><GitCompareArrows className="w-4 h-4 text-indigo-600" />محرك القانون المقارن — 🇦🇪 الإمارات ↔ 🇫🇷 فرنسا{includeEu ? ' ↔ 🇪🇺 الاتحاد الأوروبي' : ''}</h3>
        <div className="mb-3">
          <Label className="text-[11px]">الموضوع القانوني</Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: القرارات الإدارية الخوارزمية · حق الطعن · مبدأ التناسب..." className="mt-1 text-sm" dir="rtl" />
        </div>
        <div className="mb-3">
          <Label className="text-[11px]">سياق إضافي (اختياري)</Label>
          <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} placeholder="أي معلومات إضافية تساعد في توجيه المقارنة..." className="mt-1 text-sm" dir="rtl" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input type="checkbox" checked={includeEu} onChange={(e) => setIncludeEu(e.target.checked)} className="accent-indigo-600" />
          <span className="text-[11px] font-medium text-indigo-700">تضمين قانون الذكاء الاصطناعي الأوروبي (EU AI Act 2024/1689)</span>
        </label>
        <Button onClick={run} disabled={loading} className="gap-2 bg-indigo-700 hover:bg-indigo-800">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
          {loading ? 'جارٍ المقارنة...' : 'تشغيل المقارنة القانونية'}
        </Button>
      </SectionCard>

      {error && <ErrorCard message={error} />}

      {result && (
        <div className="space-y-3">
          <SectionCard>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <p className="font-bold text-sm">{result.topic}</p>
                <ConfidenceBar value={result.confidence} label="الثقة" />
              </div>
              <ModelBadge model={model} />
            </div>

            {/* Comparison table */}
            <ScrollArea className="w-full rounded-lg border">
              <table className="w-full text-[11px] min-w-[600px]" dir="rtl">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right p-2.5 font-bold w-[22%]">وجه المقارنة</th>
                    <th className="text-right p-2.5 font-bold text-emerald-700 w-[25%]">🇦🇪 الإمارات</th>
                    <th className="text-right p-2.5 font-bold text-blue-700 w-[25%]">🇫🇷 فرنسا</th>
                    {includeEu && <th className="text-right p-2.5 font-bold text-indigo-700 w-[20%]">🇪🇺 الاتحاد الأوروبي</th>}
                    <th className="text-right p-2.5 font-bold w-[8%]">التقارب</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows?.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                      <td className="p-2.5 font-semibold align-top">{row.aspect}</td>
                      <td className="p-2.5 text-muted-foreground align-top leading-relaxed">{row.uae}</td>
                      <td className="p-2.5 text-muted-foreground align-top leading-relaxed">{row.france}</td>
                      {includeEu && <td className="p-2.5 text-muted-foreground align-top leading-relaxed">{row.eu ?? '—'}</td>}
                      <td className="p-2.5 align-top">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${SIMILARITY_COLOR[row.similarity] ?? 'text-gray-600 bg-gray-50'}`}>
                          {row.similarity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </SectionCard>

          {/* Key differences + convergence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.keyDifferences?.length > 0 && (
              <SectionCard>
                <p className="text-[11px] font-bold text-gold mb-2">الفوارق الجوهرية</p>
                <ul className="space-y-1">{result.keyDifferences.map((d, i) => <li key={i} className="text-[12px] text-foreground flex gap-2"><span className="text-gold">▲</span>{d}</li>)}</ul>
              </SectionCard>
            )}
            {result.convergenceAreas?.length > 0 && (
              <SectionCard>
                <p className="text-[11px] font-bold text-emerald-700 mb-2">نقاط التقارب</p>
                <ul className="space-y-1">{result.convergenceAreas.map((c, i) => <li key={i} className="text-[12px] text-foreground flex gap-2"><span className="text-emerald-500">✓</span>{c}</li>)}</ul>
              </SectionCard>
            )}
          </div>

          {result.practicalImplications && (
            <SectionCard><p className="text-[11px] font-bold text-muted-foreground mb-1">التداعيات العملية</p><p className="text-sm text-foreground">{result.practicalImplications}</p></SectionCard>
          )}
          {result.recommendedApproach && (
            <SectionCard><p className="text-[11px] font-bold text-primary mb-1">الموقف الموصى به</p><p className="text-sm text-foreground">{result.recommendedApproach}</p></SectionCard>
          )}
          {result.citations?.length > 0 && <SectionCard><CitationsList citations={result.citations} /></SectionCard>}
        </div>
      )}
    </div>
  );
}

// ─── 5. Memorandum Generator ──────────────────────────────────────────────────

function MemorandumTab() {
  const { toast } = useToast();
  const [docType, setDocType]           = useState('legal_opinion');
  const [briefText, setBriefText]       = useState('');
  const [partyName, setPartyName]       = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<MemoResult | null>(null);
  const [model, setModel]         = useState('');
  const [error, setError]         = useState('');

  const DOC_TYPES = [
    { value: 'legal_opinion',      label: 'رأي قانوني' },
    { value: 'court_memorandum',   label: 'مذكرة استئناف قضائية' },
    { value: 'admin_appeal',       label: 'تظلم إداري' },
    { value: 'defence_memorandum', label: 'مذكرة دفاع' },
    { value: 'draft_judgment',     label: 'مسودة حكم قضائي' },
    { value: 'draft_legislation',  label: 'مسودة تشريع' },
  ];

  async function run() {
    if (!briefText.trim()) { toast({ title: 'المعطيات مطلوبة', variant: 'destructive' }); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiFetch('/api/legal-brain/memorandum', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, briefText, partyName, opposingParty, caseReference }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'حدث خطأ'); return; }
      setResult(d.result as MemoResult); setModel(d.model ?? '');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally { setLoading(false); }
  }

  const memoText = result ? [
    result.title,
    result.date ? `التاريخ: ${result.date}` : '',
    partyName ? `الطرف الأول: ${partyName}` : '',
    opposingParty ? `الطرف المقابل: ${opposingParty}` : '',
    caseReference ? `المرجع: ${caseReference}` : '',
    '',
    ...(result.sections ?? []).flatMap((s) => [`\n${s.heading}\n${'─'.repeat(30)}`, s.content]),
    '',
    `الخلاصة والطلبات:\n${result.conclusion ?? ''}`,
  ].filter(Boolean).join('\n') : '';

  return (
    <div className="space-y-4" dir="rtl">
      <SectionCard>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />مولّد المذكرات والوثائق القانونية</h3>
        <div className="mb-3">
          <Label className="text-[11px]">نوع الوثيقة</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="mt-1 text-sm" dir="rtl"><SelectValue /></SelectTrigger>
            <SelectContent dir="rtl">
              {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-[11px]">الطرف الأول (اختياري)</Label>
            <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="اسم الطرف / الموكّل" className="mt-1 text-sm" dir="rtl" />
          </div>
          <div>
            <Label className="text-[11px]">الطرف المقابل (اختياري)</Label>
            <Input value={opposingParty} onChange={(e) => setOpposingParty(e.target.value)} placeholder="الجهة المدّعى عليها" className="mt-1 text-sm" dir="rtl" />
          </div>
          <div>
            <Label className="text-[11px]">رقم القضية / المرجع</Label>
            <Input value={caseReference} onChange={(e) => setCaseReference(e.target.value)} placeholder="رقم أو مرجع القضية" className="mt-1 text-sm" dir="rtl" />
          </div>
        </div>
        <Label className="text-[11px]">الوقائع والمعطيات</Label>
        <Textarea value={briefText} onChange={(e) => setBriefText(e.target.value)} rows={6} placeholder="اشرح الوقائع والمسائل القانونية المراد تناولها في الوثيقة..." className="mt-1 text-sm" dir="rtl" />
        <Button onClick={run} disabled={loading} className="mt-3 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {loading ? 'جارٍ إعداد الوثيقة...' : 'إنشاء الوثيقة القانونية'}
        </Button>
      </SectionCard>

      {error && <ErrorCard message={error} />}

      {result && (
        <div className="space-y-3">
          {/* Document header */}
          <SectionCard>
            <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
              <div>
                <Badge className="mb-2 text-[10px]">{result.docTypeAr}</Badge>
                <h3 className="font-black text-base">{result.title}</h3>
                {result.date && <p className="text-[11px] text-muted-foreground mt-0.5">{result.date}</p>}
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={memoText} />
                <ModelBadge model={model} />
              </div>
            </div>
            <ConfidenceBar value={result.confidence} label="ثقة" />
            {result.strengthAssessment && (
              <p className="text-[11px] text-primary mt-2">⚖ {result.strengthAssessment}</p>
            )}
          </SectionCard>

          {/* Document sections */}
          <SectionCard className="prose-like">
            <div className="space-y-4" dir="rtl">
              {result.sections?.map((s, i) => (
                <div key={i}>
                  <h4 className="font-bold text-sm border-b border-border pb-1 mb-2">{s.heading}</h4>
                  <p className="text-sm text-foreground leading-8 whitespace-pre-wrap">{s.content}</p>
                </div>
              ))}
              {result.conclusion && (
                <div>
                  <h4 className="font-bold text-sm border-b border-primary/30 pb-1 mb-2 text-primary">الخلاصة والطلبات</h4>
                  <p className="text-sm text-foreground leading-8 whitespace-pre-wrap">{result.conclusion}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Legal bases + risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.legalBases?.length > 0 && (
              <SectionCard>
                <p className="text-[11px] font-bold text-primary mb-2">الأسس القانونية</p>
                <ul className="space-y-1">{result.legalBases.map((b, i) => <li key={i} className="text-[12px] text-foreground flex gap-2"><span className="text-primary">📌</span>{b}</li>)}</ul>
              </SectionCard>
            )}
            {result.risks?.length > 0 && (
              <SectionCard>
                <p className="text-[11px] font-bold text-gold mb-2">المخاطر القانونية المحتملة</p>
                <ul className="space-y-1">{result.risks.map((r, i) => <li key={i} className="text-[12px] text-foreground flex gap-2"><AlertTriangle className="w-3 h-3 text-gold shrink-0 mt-0.5" />{r}</li>)}</ul>
              </SectionCard>
            )}
          </div>
          {result.citations?.length > 0 && <SectionCard><CitationsList citations={result.citations} /></SectionCard>}
        </div>
      )}
    </div>
  );
}

// ─── 6. Risk Assessment Tab ───────────────────────────────────────────────────

function RiskAssessmentTab() {
  const { toast } = useToast();
  const [scenarioText, setScenarioText] = useState('');
  const [systemType, setSystemType]     = useState('');
  const [decisionType, setDecisionType] = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<RiskResult | null>(null);
  const [model, setModel]         = useState('');
  const [error, setError]         = useState('');

  async function run() {
    if (!scenarioText.trim()) { toast({ title: 'السيناريو مطلوب', variant: 'destructive' }); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiFetch('/api/legal-brain/risk-assessment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioText, systemType, decisionType }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'حدث خطأ'); return; }
      setResult(d.result as RiskResult); setModel(d.model ?? '');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally { setLoading(false); }
  }

  const RISK_DIMS = result ? [
    { key: 'legalRisk',         nameAr: 'المخاطر القانونية',      dim: result.legalRisk,          icon: <Scale className="w-4 h-4" /> },
    { key: 'proceduralRisk',    nameAr: 'المخاطر الإجرائية',      dim: result.proceduralRisk,      icon: <Gavel className="w-4 h-4" /> },
    { key: 'constitutionalRisk',nameAr: 'المخاطر الدستورية',      dim: result.constitutionalRisk,  icon: <ShieldAlert className="w-4 h-4" /> },
    { key: 'aiRisk',            nameAr: 'مخاطر الذكاء الاصطناعي', dim: result.aiRisk,              icon: <Brain className="w-4 h-4" /> },
  ] : [];

  return (
    <div className="space-y-4" dir="rtl">
      <SectionCard>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-gold" />محرك تقييم المخاطر القانونية — الأبعاد الأربعة</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-[11px]">نوع النظام / الإجراء</Label>
            <Input value={systemType} onChange={(e) => setSystemType(e.target.value)} placeholder="نظام آلي · خوارزمية · قرار إداري..." className="mt-1 text-sm" dir="rtl" />
          </div>
          <div>
            <Label className="text-[11px]">نوع القرار</Label>
            <Input value={decisionType} onChange={(e) => setDecisionType(e.target.value)} placeholder="تعيين · فصل · ترخيص · مخالفة..." className="mt-1 text-sm" dir="rtl" />
          </div>
        </div>
        <Label className="text-[11px]">وصف السيناريو</Label>
        <Textarea value={scenarioText} onChange={(e) => setScenarioText(e.target.value)} rows={6} placeholder="صِف الوضع أو الإجراء أو القرار المراد تقييم مخاطره..." className="mt-1 text-sm" dir="rtl" />
        <Button onClick={run} disabled={loading} className="mt-3 gap-2 bg-gold hover:bg-gold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
          {loading ? 'جارٍ تقييم المخاطر...' : 'تشغيل محرك المخاطر'}
        </Button>
      </SectionCard>

      {error && <ErrorCard message={error} />}

      {result && (
        <div className="space-y-3">
          {/* Overall risk banner */}
          <div className={`rounded-xl border-2 p-4 ${RISK_COLOR[result.overallRisk] ? `border-current ${RISK_COLOR[result.overallRisk]}` : 'border-gray-300 bg-gray-50'}`} dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">المخاطرة الإجمالية</p>
                <p className="font-black text-2xl mt-0.5 flex items-center gap-2">
                  <RiskBadge level={result.overallRisk} />
                  <span>{result.overallScore}<span className="text-base font-normal opacity-70">/100</span></span>
                </p>
              </div>
              <div><ConfidenceBar value={result.confidence} label="الثقة" /></div>
            </div>
            {/* Urgent actions */}
            {result.urgentActions?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-current/20">
                <p className="text-[10px] font-bold mb-1.5">⚡ إجراءات عاجلة (خلال 48 ساعة)</p>
                <ul className="space-y-0.5">{result.urgentActions.map((a, i) => <li key={i} className="text-[12px] flex gap-2"><span className="font-bold">{i + 1}.</span>{a}</li>)}</ul>
              </div>
            )}
          </div>

          {/* 4 risk dimensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RISK_DIMS.map(({ key, nameAr, dim, icon }) => (
              <SectionCard key={key}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-bold">{icon}{nameAr}</div>
                  <RiskBadge level={dim.level} />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-2 rounded-full flex-1 bg-muted overflow-hidden`}>
                    <div className={`h-full rounded-full transition-all ${RISK_BAR_COLOR[dim.level] ?? 'bg-gray-400'}`} style={{ width: `${dim.score}%` }} />
                  </div>
                  <span className="text-[12px] font-bold shrink-0">{dim.score}%</span>
                </div>
                {dim.factors?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">عوامل الخطر:</p>
                    <ul className="space-y-0.5">{dim.factors.map((f, i) => <li key={i} className="text-[11px] text-foreground flex gap-1.5"><AlertTriangle className="w-2.5 h-2.5 text-gold shrink-0 mt-0.5" />{f}</li>)}</ul>
                  </div>
                )}
                {dim.mitigations?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 mb-1">إجراءات التخفيف:</p>
                    <ul className="space-y-0.5">{dim.mitigations.map((m, i) => <li key={i} className="text-[11px] text-foreground flex gap-1.5"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0 mt-0.5" />{m}</li>)}</ul>
                  </div>
                )}
              </SectionCard>
            ))}
          </div>

          {result.explainability && <ExplainabilityCard data={result.explainability} />}
          {result.citations?.length > 0 && <SectionCard><CitationsList citations={result.citations} /></SectionCard>}
          <ModelBadge model={model} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const BASE_TABS = [
  { id: 'judicial',    labelAr: 'الاستدلال القضائي',    icon: <Gavel className="w-3.5 h-3.5" /> },
  { id: 'legality',    labelAr: 'مشروعية القرار الإداري',icon: <Scale className="w-3.5 h-3.5" /> },
  { id: 'comparative', labelAr: 'القانون المقارن',        icon: <GitCompareArrows className="w-3.5 h-3.5" /> },
  { id: 'memorandum',  labelAr: 'المذكرات القانونية',    icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'risk',        labelAr: 'تقييم المخاطر',         icon: <ShieldAlert className="w-3.5 h-3.5" /> },
];
const SHAMSI_TAB = { id: 'shamsi', labelAr: 'نظرية الشامسي', icon: <FlaskConical className="w-3.5 h-3.5" /> };

export default function LegalBrain() {
  const { canUseAi, canUseShamsiFramework } = useUserContext();
  // Al-Shamsi Theory tab is owner-only — must not appear at all for other roles.
  const TABS = canUseShamsiFramework ? [...BASE_TABS, SHAMSI_TAB] : BASE_TABS;

  if (!canUseAi) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" dir="rtl">
        <div className="text-center space-y-2">
          <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">لا تملك صلاحية الوصول إلى الدماغ القانوني</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2B5F9E)' }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-xl text-foreground">الدماغ القانوني الذكي</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                منصة الاستدلال القانوني المتقدم — 6 محركات تحليل متكاملة · الإمارات · فرنسا · الاتحاد الأوروبي
              </p>
            </div>
            <div className="mr-auto flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className="text-[9px] border-gold/40 text-gold bg-gold/10">Stage 4</Badge>
              <Badge variant="outline" className="text-[9px]"><Sparkles className="w-2.5 h-2.5 me-0.5" />AI Powered</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <Tabs defaultValue="judicial" dir="rtl">
          {/* Tab bar */}
          <ScrollArea className="w-full mb-5">
            <TabsList className="flex w-max gap-1 bg-muted/50 p-1 rounded-xl h-auto">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {tab.icon}
                  {tab.labelAr}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value="judicial">    <JudicialReasoningTab /> </TabsContent>
          <TabsContent value="legality">   <AdminLegalityTab />     </TabsContent>
          {canUseShamsiFramework && <TabsContent value="shamsi"><ShamsiTheoryTab /></TabsContent>}
          <TabsContent value="comparative"><ComparativeAnalysisTab /></TabsContent>
          <TabsContent value="memorandum"> <MemorandumTab />         </TabsContent>
          <TabsContent value="risk">       <RiskAssessmentTab />    </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
