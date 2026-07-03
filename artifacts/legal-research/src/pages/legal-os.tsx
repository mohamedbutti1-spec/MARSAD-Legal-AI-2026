import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import {
  Scale, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, XCircle, Clock, FileText,
  Building2, BookOpen, Copy, Check, Loader2, Send, Trash2,
  RotateCcw, Download, MessageSquare, Plus, X, Sparkles,
  UserCircle, Briefcase, Users, ScrollText, Landmark,
  UserCheck, ArrowRight, ClipboardList, ShieldAlert,
  ListChecks, MapPin, Timer, PenLine, Gavel, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { exportBriefToPdf } from '@/lib/export-brief-pdf';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnswerCategory = 'mandatory' | 'opinion' | 'best_practice' | 'optional';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type CanIssue = 'yes' | 'no' | 'conditional';
type ActorType = 'user' | 'lawyer' | 'court' | 'authority';

interface QuestionOption { value: string; labelAr: string; labelEn: string; }
interface QuestionNode {
  id: string; questionAr: string; questionEn: string; hintAr?: string;
  answerType: 'chips' | 'yes-no' | 'text' | 'number';
  options?: QuestionOption[]; placeholder?: string; unit?: string;
}
interface Scenario {
  id: string; titleAr: string; titleEn: string; descriptionAr: string;
  jurisdictions: string[]; estimatedMinutes: number; questions: QuestionNode[];
}
interface Role {
  id: string; titleAr: string; titleEn: string; descriptionAr: string;
  icon: string; scenarios: Scenario[];
}
interface AnswerItem { textAr: string; category: AnswerCategory; }
interface TimelineStep { step: number; titleAr: string; duration: string; actor: ActorType; }
interface Citation {
  token: string; title: string; type: 'document' | 'legal_source';
  sourceId: number; formats?: { harvard: string; apa: string; uaeGov: string };
}
interface DecisionBrief {
  riskLevel: RiskLevel;
  riskRationale: string;
  canIssueToday: CanIssue;
  canIssueTodayExplanation: string;
  canIssueTodayConditions: string[];
  finalRecommendation: AnswerItem[];
  missingRequirements: AnswerItem[];
  requiredDocuments: Array<{ nameAr: string; descriptionAr: string; where: string; processingTime: string }>;
  governmentAuthority: { nameAr: string; nameEn: string; department: string; website?: string | null; phone?: string | null; whatToBring: string };
  legalTimeline: TimelineStep[];
  draftLetter: { subjectAr: string; bodyAr: string };
  applicableLegislation: Array<{ token: string | null; articleAr: string; relevanceAr: string }>;
  courtPrecedents: Array<{ titleAr: string; ruling: string; year?: number | null }> | null;
  practicalNextSteps: Array<{ step: number; actionAr: string; actor: string; timeframe: string; category: AnswerCategory }>;
  citations?: Citation[];
}
interface FollowupMessage { role: 'user' | 'assistant'; text: string; citations: Citation[]; }
interface SavedSession {
  id: number; role: string; scenarioId: string;
  scenarioTitleAr?: string; scenarioTitleEn?: string;
  report?: DecisionBrief; createdAt: string;
}
type Screen = 'roles' | 'scenarios' | 'interview' | 'loading' | 'brief';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<string, React.ReactNode> = {
  citizen:    <UserCircle className="w-7 h-7" />,
  lawyer:     <Briefcase className="w-7 h-7" />,
  manager:    <Users className="w-7 h-7" />,
  heir:       <FileText className="w-7 h-7" />,
  employer:   <Building2 className="w-7 h-7" />,
  employee:   <UserCheck className="w-7 h-7" />,
  legislator: <ScrollText className="w-7 h-7" />,
  government: <Landmark className="w-7 h-7" />,
};

// ─── Category pill ────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<AnswerCategory, { label: string; color: string; dot: string }> = {
  mandatory:     { label: 'إلزامي',       color: 'bg-red-50 text-red-700 border-red-200',         dot: '🔴' },
  opinion:       { label: 'رأي قانوني',   color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: '🟡' },
  best_practice: { label: 'ممارسة مثلى', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '🟢' },
  optional:      { label: 'اختياري',      color: 'bg-slate-50 text-slate-600 border-slate-200',    dot: '⚪' },
};

function CategoryPill({ category }: { category: AnswerCategory }) {
  const c = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.optional;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${c.color} shrink-0`}>
      <span>{c.dot}</span>
      {c.label}
    </span>
  );
}

// ─── Risk badge ───────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  low:      { label: 'منخفض',    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" /> },
  medium:   { label: 'متوسط',    color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: <AlertTriangle className="w-5 h-5 text-amber-600" /> },
  high:     { label: 'مرتفع',    color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   icon: <AlertTriangle className="w-5 h-5 text-orange-600" /> },
  critical: { label: 'حرج جداً', color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         icon: <XCircle className="w-5 h-5 text-red-600" /> },
};

function RiskBadge({ level }: { level: RiskLevel }) {
  const c = RISK_CONFIG[level] ?? RISK_CONFIG.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold text-sm ${c.bg} ${c.color}`}>
      {c.icon}
      مستوى الخطر: {c.label}
    </span>
  );
}

// ─── Can Issue Banner ─────────────────────────────────────────────────────────

function CanIssueBanner({ decision, explanation, conditions }: {
  decision: CanIssue; explanation: string; conditions: string[];
}) {
  const configs = {
    yes:         { icon: <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />, label: 'يمكن اتخاذ القرار اليوم', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800' },
    no:          { icon: <XCircle className="w-7 h-7 text-red-600 shrink-0" />,          label: 'لا يمكن اتخاذ القرار اليوم', bg: 'bg-red-50 border-red-300',         text: 'text-red-800' },
    conditional: { icon: <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" />, label: 'يمكن اتخاذ القرار بشروط',   bg: 'bg-amber-50 border-amber-300',       text: 'text-amber-800' },
  };
  const c = configs[decision] ?? configs.conditional;
  return (
    <div className={`rounded-2xl border-2 p-4 sm:p-5 ${c.bg}`} dir="rtl">
      <div className="flex items-start gap-3">
        {c.icon}
        <div className="flex-1 min-w-0">
          <p className={`font-black text-lg sm:text-xl leading-tight ${c.text}`}>{c.label}</p>
          <p className={`mt-1.5 text-sm leading-relaxed ${c.text} opacity-90`}>{explanation}</p>
          {conditions && conditions.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {conditions.map((cond, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${c.text}`}>
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {cond}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function BriefSection({ title, icon, count, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; count?: number;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-start"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-primary">{icon}</span>
          <span className="font-bold text-sm text-foreground">{title}</span>
          {count !== undefined && (
            <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ─── Minimal citation chip ────────────────────────────────────────────────────

type CitFmt = 'harvard' | 'apa' | 'uaeGov';
const FMT_LABELS: Record<CitFmt, string> = { harvard: 'هارفرد', apa: 'APA', uaeGov: 'إماراتي' };

function MiniCitationChip({ token, citation }: { token: string; citation?: Citation }) {
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<CitFmt>('harvard');
  const [copied, setCopied] = useState(false);
  const isDoc = token.startsWith('[DOC:');
  const label = citation?.title ?? token;

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }

  return (
    <span className="relative inline-block align-baseline">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border ${isDoc ? 'bg-primary/10 text-primary border-primary/25' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
        {isDoc ? <FileText className="w-2.5 h-2.5" /> : <BookOpen className="w-2.5 h-2.5" />}
        <span className="max-w-[100px] truncate">{label}</span>
      </button>
      {open && citation?.formats && (
        <div className="absolute z-50 bottom-full mb-1 start-0 w-72 bg-card border rounded-xl shadow-xl p-3 text-start" dir="rtl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold truncate">{label}</p>
            <button type="button" onClick={() => setOpen(false)}><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-1 mb-2">
            {(Object.keys(FMT_LABELS) as CitFmt[]).map((f) => (
              <button key={f} type="button" onClick={() => setFmt(f)}
                className={`flex-1 text-[10px] py-0.5 rounded font-medium ${fmt === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {FMT_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="bg-muted/40 rounded p-2 text-[11px] leading-relaxed whitespace-pre-wrap mb-2">{citation.formats[fmt]}</div>
          <button type="button" onClick={() => copy(citation.formats![fmt])}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? 'تم النسخ' : 'نسخ'}
          </button>
        </div>
      )}
    </span>
  );
}

// ─── Actor label ──────────────────────────────────────────────────────────────

const ACTOR_LABELS: Record<ActorType, { label: string; color: string }> = {
  user:      { label: 'المستخدم',          color: 'bg-primary/10 text-primary' },
  lawyer:    { label: 'المحامي',            color: 'bg-purple-100 text-purple-700' },
  court:     { label: 'المحكمة',            color: 'bg-red-100 text-red-700' },
  authority: { label: 'الجهة الحكومية',    color: 'bg-blue-100 text-blue-700' },
};

function ActorBadge({ actor }: { actor: ActorType | string }) {
  const cfg = ACTOR_LABELS[actor as ActorType] ?? { label: actor, color: 'bg-muted text-muted-foreground' };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>;
}

// ─── Decision Brief renderer ──────────────────────────────────────────────────

function DecisionBriefView({ brief, scenario, role, sessionId, citations, isStreaming, onReset, t }: {
  brief: Partial<DecisionBrief>; scenario: Scenario; role: Role;
  sessionId: number | null; citations: Citation[];
  isStreaming?: boolean;
  onReset: () => void; t: (ar: string, en: string) => string;
}) {
  const [followups, setFollowups] = useState<FollowupMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);
    setExportMsg('جارٍ تحضير مستند PDF...');
    try {
      await exportBriefToPdf(
        brief as DecisionBrief,
        scenario.titleAr,
        role.titleAr,
        (msg) => setExportMsg(msg),
      );
    } catch (err) {
      toast({ title: 'فشل تصدير PDF', description: String(err), variant: 'destructive' });
    } finally {
      setTimeout(() => { setExporting(false); setExportMsg(''); }, 1500);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [followups]);

  async function sendFollowup() {
    const text = input.trim();
    if (!text || !sessionId || sending || isStreaming) return;
    setInput('');
    setSending(true);
    setFollowups((prev) => [...prev, { role: 'user', text, citations: [] }]);

    try {
      const r = await apiFetch('/api/legal-os/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (r.ok) {
        const data = await r.json();
        setFollowups((prev) => [...prev, { role: 'assistant', text: data.text, citations: data.citations ?? [] }]);
      } else {
        toast({ title: 'فشل الإرسال', variant: 'destructive' });
        setFollowups((prev) => prev.slice(0, -1));
      }
    } finally {
      setSending(false);
    }
  }

  function copyDraft() {
    const letter = brief.draftLetter;
    if (!letter) return;
    navigator.clipboard.writeText(`${letter.subjectAr}\n\n${letter.bodyAr}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function downloadDraft() {
    const letter = brief.draftLetter;
    if (!letter) return;
    const blob = new Blob([`${letter.subjectAr}\n\n${letter.bodyAr}`], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `مسودة-${scenario.titleAr}.txt`;
    a.click();
  }

  const parseLegislationText = (text: string, cits: Citation[]) => {
    if (!cits.length) return text;
    const pattern = /\[(DOC|SRC):\d+\]/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const cit = cits.find((c) => c.token === m![0]);
      parts.push(<MiniCitationChip key={m.index} token={m[0]} citation={cit} />);
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" dir="rtl">
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-4 py-4 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {role.titleAr} · {scenario.titleAr}
            </p>
            <h1 className="text-xl font-black text-foreground">
              التقييم القانوني
              {isStreaming && (
                <span className="inline-flex items-center gap-1.5 ms-2 text-sm font-medium text-primary align-middle">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جارٍ البناء...
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting || isStreaming}
              className="gap-1.5"
              title={isStreaming ? 'انتظر اكتمال التقييم' : 'تصدير كـ PDF'}
            >
              {exporting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />}
              {exporting ? (exportMsg || 'جارٍ التصدير...') : t('تصدير PDF', 'Export PDF')}
            </Button>
            <Button variant="outline" size="sm" onClick={onReset} disabled={isStreaming} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              {t('تقييم جديد', 'New Assessment')}
            </Button>
          </div>
        </div>

        {/* Risk + Can Issue */}
        {brief.riskLevel ? (
          <div className="flex flex-wrap gap-2 items-center">
            <RiskBadge level={brief.riskLevel} />
            {brief.riskRationale && (
              <p className="text-xs text-muted-foreground flex-1 min-w-0">{brief.riskRationale}</p>
            )}
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-7 w-32 bg-muted rounded-full" />
            <div className="h-3 flex-1 bg-muted/60 rounded" />
          </div>
        ) : null}

        {brief.canIssueToday ? (
          <CanIssueBanner
            decision={brief.canIssueToday}
            explanation={brief.canIssueTodayExplanation ?? ''}
            conditions={brief.canIssueTodayConditions ?? []}
          />
        ) : isStreaming ? (
          <div className="h-20 rounded-2xl border-2 border-muted bg-muted/20 animate-pulse" />
        ) : null}

        {/* 1. Final Recommendation */}
        {brief.finalRecommendation && brief.finalRecommendation.length > 0 ? (
          <BriefSection title="التوصية القانونية النهائية" icon={<Star className="w-4 h-4" />} count={brief.finalRecommendation.length}>
            <ul className="space-y-3">
              {brief.finalRecommendation.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CategoryPill category={item.category} />
                  <p className="text-sm text-foreground leading-relaxed flex-1">{item.textAr}</p>
                </li>
              ))}
            </ul>
          </BriefSection>
        ) : isStreaming && brief.riskLevel ? <SectionSkeleton lines={4} /> : null}

        {/* 2. Missing Requirements */}
        {brief.missingRequirements && brief.missingRequirements.length > 0 ? (
          <BriefSection title="المتطلبات الناقصة" icon={<ShieldAlert className="w-4 h-4" />} count={brief.missingRequirements.length}>
            <ul className="space-y-3">
              {brief.missingRequirements.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CategoryPill category={item.category} />
                  <p className="text-sm text-foreground leading-relaxed flex-1">{item.textAr}</p>
                </li>
              ))}
            </ul>
          </BriefSection>
        ) : isStreaming && brief.finalRecommendation ? <SectionSkeleton lines={3} /> : null}

        {/* 3. Required Documents */}
        {brief.requiredDocuments && brief.requiredDocuments.length > 0 ? (
          <BriefSection title="الوثائق المطلوبة" icon={<FileText className="w-4 h-4" />} count={brief.requiredDocuments.length}>
            <div className="space-y-3">
              {brief.requiredDocuments.map((doc, i) => (
                <div key={i} className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <p className="font-semibold text-sm text-foreground">{doc.nameAr}</p>
                  {doc.descriptionAr && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{doc.descriptionAr}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {doc.where && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />{doc.where}
                      </span>
                    )}
                    {doc.processingTime && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="w-3 h-3 shrink-0" />{doc.processingTime}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </BriefSection>
        ) : isStreaming && brief.missingRequirements !== undefined ? <SectionSkeleton lines={3} /> : null}

        {/* 4. Government Authority */}
        {brief.governmentAuthority?.nameAr ? (
          <BriefSection title="الجهة الحكومية المختصة" icon={<Building2 className="w-4 h-4" />}>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="font-bold text-blue-900 text-base">{brief.governmentAuthority.nameAr}</p>
              {brief.governmentAuthority.nameEn && (
                <p className="text-xs text-blue-700 mt-0.5">{brief.governmentAuthority.nameEn}</p>
              )}
              {brief.governmentAuthority.department && (
                <p className="text-sm text-blue-800 mt-1.5">📋 {brief.governmentAuthority.department}</p>
              )}
              {brief.governmentAuthority.website && (
                <a href={brief.governmentAuthority.website} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline mt-1.5">
                  🌐 {brief.governmentAuthority.website}
                </a>
              )}
              {brief.governmentAuthority.whatToBring && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs font-bold text-blue-800 mb-1">ما تحتاج إحضاره:</p>
                  <p className="text-xs text-blue-700 leading-relaxed">{brief.governmentAuthority.whatToBring}</p>
                </div>
              )}
            </div>
          </BriefSection>
        ) : isStreaming && brief.requiredDocuments !== undefined ? <SectionSkeleton lines={4} /> : null}

        {/* 5. Legal Timeline */}
        {brief.legalTimeline && brief.legalTimeline.length > 0 ? (
          <BriefSection title="الجدول الزمني القانوني" icon={<Timer className="w-4 h-4" />} count={brief.legalTimeline.length}>
            <div className="space-y-0">
              {brief.legalTimeline.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                      {step.step}
                    </div>
                    {i < (brief.legalTimeline?.length ?? 0) - 1 && (
                      <div className="w-0.5 bg-border flex-1 mt-1 mb-1 min-h-[1.5rem]" />
                    )}
                  </div>
                  <div className={`flex-1 pb-4 ${i === (brief.legalTimeline?.length ?? 0) - 1 ? 'pb-0' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground">{step.titleAr}</p>
                      <ActorBadge actor={step.actor} />
                    </div>
                    {step.duration && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{step.duration}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </BriefSection>
        ) : isStreaming && brief.governmentAuthority !== undefined ? <SectionSkeleton lines={5} /> : null}

        {/* 6. Draft Letter */}
        {brief.draftLetter?.bodyAr ? (
          <BriefSection title="مسودة الخطاب / الطلب / الشكوى" icon={<PenLine className="w-4 h-4" />}>
            {brief.draftLetter.subjectAr && (
              <p className="font-bold text-sm text-foreground mb-3">الموضوع: {brief.draftLetter.subjectAr}</p>
            )}
            <div className="bg-muted/30 rounded-xl border border-border p-4 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap mb-3 max-h-64 overflow-y-auto">
              {brief.draftLetter.bodyAr}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyDraft} className="gap-1.5 text-xs">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'تم النسخ' : 'نسخ النص'}
              </Button>
              <Button size="sm" variant="outline" onClick={downloadDraft} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" />
                تحميل
              </Button>
            </div>
          </BriefSection>
        ) : isStreaming && brief.legalTimeline !== undefined ? <SectionSkeleton lines={6} /> : null}

        {/* 7. Applicable Legislation */}
        {brief.applicableLegislation && brief.applicableLegislation.length > 0 ? (
          <BriefSection title="التشريعات المنطبقة" icon={<BookOpen className="w-4 h-4" />} count={brief.applicableLegislation.length}>
            <div className="space-y-4">
              {brief.applicableLegislation.map((item, i) => (
                <div key={i} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-foreground flex-1">
                      {item.token && citations.find((c) => c.token === item.token)
                        ? <MiniCitationChip token={item.token} citation={citations.find((c) => c.token === item.token)} />
                        : null
                      }
                      {' '}{item.articleAr}
                    </p>
                  </div>
                  {item.relevanceAr && (
                    <p className="text-xs text-muted-foreground leading-relaxed ms-5">{item.relevanceAr}</p>
                  )}
                </div>
              ))}
            </div>
          </BriefSection>
        ) : isStreaming && brief.draftLetter !== undefined ? <SectionSkeleton lines={4} /> : null}

        {/* 8. Court Precedents */}
        {brief.courtPrecedents && brief.courtPrecedents.length > 0 && (
          <BriefSection title="السوابق القضائية" icon={<Gavel className="w-4 h-4" />} count={brief.courtPrecedents.length}>
            <div className="space-y-3">
              {brief.courtPrecedents.map((p, i) => (
                <div key={i} className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <p className="font-semibold text-sm text-foreground">{p.titleAr} {p.year ? `(${p.year})` : ''}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.ruling}</p>
                </div>
              ))}
            </div>
          </BriefSection>
        )}

        {/* 9. Practical Next Steps */}
        {brief.practicalNextSteps && brief.practicalNextSteps.length > 0 ? (
          <BriefSection title="الخطوات العملية الفورية" icon={<ListChecks className="w-4 h-4" />} count={brief.practicalNextSteps.length}>
            <div className="space-y-3">
              {brief.practicalNextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <CategoryPill category={step.category} />
                      <span className="text-xs text-muted-foreground">{step.actor}</span>
                      {step.timeframe && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />{step.timeframe}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{step.actionAr}</p>
                  </div>
                </div>
              ))}
            </div>
          </BriefSection>
        ) : isStreaming && brief.applicableLegislation !== undefined ? <SectionSkeleton lines={4} /> : null}

        {/* Follow-up chat */}
        <div className="border border-border rounded-xl overflow-hidden" dir="rtl">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">استفسارات متابعة</span>
          </div>

          {followups.length > 0 && (
            <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
              {followups.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-muted border border-border'
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-end">
                  <div className="bg-primary/10 rounded-xl px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          <div className="p-3 border-t border-border/50 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendFollowup(); }}
              placeholder="اسأل سؤالاً متابعاً..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" onClick={sendFollowup} disabled={!input.trim() || sending || !sessionId}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="pb-8" />
      </div>
    </div>
  );
}

// ─── Roles screen ─────────────────────────────────────────────────────────────

function RolesScreen({ roles, onSelect }: { roles: Role[]; onSelect: (r: Role) => void }) {
  return (
    <div className="flex-1 overflow-y-auto" dir="rtl">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">المكتب القانوني الذكي</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-md mx-auto">
            تقييم قانوني شامل بـ 11 محوراً قبل اتخاذ أي قرار — اختر دورك لبدء التقييم
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelect(role)}
              className="flex flex-col items-center gap-3 p-4 sm:p-5 rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                {ROLE_ICONS[role.id] ?? <UserCircle className="w-7 h-7" />}
              </div>
              <div>
                <p className="font-bold text-sm text-foreground leading-tight">{role.titleAr}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{role.titleEn}</p>
              </div>
            </button>
          ))}
        </div>
        {/* Legend */}
        <div className="mt-8 p-4 bg-muted/30 rounded-xl border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-2.5">تصنيف كل إجابة:</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(CATEGORY_CONFIG) as [AnswerCategory, typeof CATEGORY_CONFIG[AnswerCategory]][]).map(([key, cfg]) => (
              <span key={key} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${cfg.color}`}>
                {cfg.dot} {cfg.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scenarios screen ─────────────────────────────────────────────────────────

function ScenariosScreen({ role, onSelect, onBack }: {
  role: Role; onSelect: (s: Scenario) => void; onBack: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto" dir="rtl">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronRight className="w-4 h-4" /> العودة لاختيار الدور
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            {ROLE_ICONS[role.id] ?? <UserCircle className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="font-black text-lg text-foreground">{role.titleAr}</h2>
            <p className="text-xs text-muted-foreground">{role.descriptionAr}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {role.scenarios.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => onSelect(sc)}
              className="w-full text-start flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{sc.titleAr}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sc.descriptionAr}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sc.jurisdictions.map((j) => (
                    <span key={j} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">{j}</span>
                  ))}
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                    ~{sc.estimatedMinutes} د
                  </span>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Interview screen ─────────────────────────────────────────────────────────

function InterviewScreen({ scenario, answers, currentIndex, onAnswer, onBack, onAssess, assessing }: {
  scenario: Scenario; answers: Record<string, string>;
  currentIndex: number; onAnswer: (id: string, value: string) => void;
  onBack: () => void; onAssess: () => void; assessing: boolean;
}) {
  const questions = scenario.questions;
  const q = questions[currentIndex];
  const current = answers[q.id] ?? '';
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isLast = currentIndex === questions.length - 1;
  const isTextBased = q.answerType === 'text' || q.answerType === 'number';
  const [textVal, setTextVal] = useState(current);

  useEffect(() => { setTextVal(answers[q.id] ?? ''); }, [q.id, answers]);

  // For text/number, use the live input value so buttons activate immediately without requiring blur
  const effectiveCurrent = isTextBased ? textVal : current;

  return (
    <div className="flex-1 overflow-y-auto" dir="rtl">
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-5">

        {/* Back */}
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronRight className="w-4 h-4" />
          {currentIndex === 0 ? 'العودة للسيناريوهات' : 'السؤال السابق'}
        </button>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{scenario.titleAr}</span>
            <span>السؤال {currentIndex + 1} من {questions.length}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 mb-5">
          <p className="text-lg sm:text-xl font-bold text-foreground leading-relaxed mb-1">{q.questionAr}</p>
          {q.hintAr && <p className="text-xs text-muted-foreground">{q.hintAr}</p>}

          <div className="mt-5">
            {q.answerType === 'yes-no' && (
              <div className="flex gap-3">
                {(['yes', 'no'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onAnswer(q.id, v)}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                      current === v
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {v === 'yes' ? 'نعم ✓' : 'لا ✗'}
                  </button>
                ))}
              </div>
            )}

            {q.answerType === 'chips' && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onAnswer(q.id, opt.value)}
                    className={`px-3 py-2 rounded-xl border-2 font-medium text-sm transition-all text-start ${
                      current === opt.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {opt.labelAr}
                  </button>
                ))}
              </div>
            )}

            {q.answerType === 'text' && (
              <textarea
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                placeholder={q.placeholder ?? 'اكتب إجابتك هنا...'}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            )}

            {q.answerType === 'number' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                  placeholder={q.placeholder ?? '0'}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {q.unit && <span className="text-sm text-muted-foreground shrink-0">{q.unit}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!isLast && (
            <Button
              className="flex-1 gap-2"
              disabled={!effectiveCurrent}
              onClick={() => onAnswer(q.id, effectiveCurrent)}
            >
              السؤال التالي
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          {isLast && (
            <Button
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={!effectiveCurrent || assessing}
              onClick={() => { if (isTextBased) onAnswer(q.id, effectiveCurrent); onAssess(); }}
            >
              {assessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {assessing ? 'جارٍ التقييم...' : 'تقييم الآن'}
            </Button>
          )}
          {!isLast && (
            <Button variant="outline" className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              disabled={assessing} onClick={() => { if (isTextBased) onAnswer(q.id, effectiveCurrent); onAssess(); }}>
              {assessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {assessing ? 'جارٍ...' : 'تقييم الآن'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section skeleton (shown while streaming) ─────────────────────────────────

function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden animate-pulse" dir="rtl">
      <div className="px-4 py-3 bg-muted/30 h-11 flex items-center gap-2.5">
        <div className="w-4 h-4 bg-muted/60 rounded shrink-0" />
        <div className="h-3.5 bg-muted/60 rounded w-36" />
      </div>
      <div className="p-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`h-3 bg-muted/50 rounded ${i === lines - 1 ? 'w-3/5' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Loading screen (fallback when streaming not supported) ───────────────────

const LOADING_MSGS = [
  'جارٍ تحليل السياق القانوني...',
  'جارٍ البحث في المصادر التشريعية...',
  'جارٍ تقييم المخاطر القانونية...',
  'جارٍ إعداد مسودة الخطاب...',
  'جارٍ تحديد الجدول الزمني...',
  'جارٍ مراجعة المتطلبات الناقصة...',
  'جارٍ استخلاص التوصية النهائية...',
];

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % LOADING_MSGS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4" dir="rtl">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Scale className="w-10 h-10 text-primary animate-pulse" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black text-foreground mb-2">التقييم القانوني جارٍ</h2>
        <p className="text-sm text-muted-foreground max-w-xs transition-all duration-700">{LOADING_MSGS[msgIdx]}</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

// ─── History drawer ───────────────────────────────────────────────────────────

function HistoryDrawer({ open, sessions, onSelect, onDelete, onClose, t }: {
  open: boolean; sessions: SavedSession[]; onSelect: (s: SavedSession) => void;
  onDelete: (id: number) => void; onClose: () => void;
  t: (ar: string, en: string) => string;
}) {
  const RISK_COLORS: Record<string, string> = {
    low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-orange-600', critical: 'text-red-600',
  };
  return (
    <>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />}
      <div className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-2xl transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '70dvh' }} dir="rtl">
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border/50">
          <h3 className="font-semibold text-sm">{t('التقييمات السابقة', 'Past Assessments')}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto px-3 py-2 space-y-1.5" style={{ maxHeight: 'calc(70dvh - 5rem)' }}>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">لا توجد تقييمات سابقة</p>
          ) : sessions.map((s) => (
            <div key={s.id} className="flex items-center rounded-xl border border-transparent hover:border-border hover:bg-muted/20 group">
              <button type="button" onClick={() => { onSelect(s); onClose(); }}
                className="flex-1 text-start px-3 py-2.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{s.scenarioTitleAr ?? s.scenarioId}</span>
                  {s.report?.riskLevel && (
                    <AlertTriangle className={`w-3 h-3 shrink-0 ${RISK_COLORS[s.report.riskLevel] ?? ''}`} />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.createdAt).toLocaleDateString('ar-AE')}</p>
              </button>
              <button type="button" onClick={() => onDelete(s.id)}
                className="shrink-0 pe-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive p-0.5">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Desktop history sidebar ──────────────────────────────────────────────────

function HistorySidebar({ sessions, onSelect, onDelete, currentId, t }: {
  sessions: SavedSession[]; onSelect: (s: SavedSession) => void;
  onDelete: (id: number) => void; currentId: number | null;
  t: (ar: string, en: string) => string;
}) {
  const RISK_COLORS: Record<string, string> = {
    low: 'text-emerald-500', medium: 'text-amber-500', high: 'text-orange-500', critical: 'text-red-500',
  };
  return (
    <div className="hidden md:flex flex-col w-60 border-s border-border shrink-0 bg-muted/10" dir="rtl">
      <div className="px-3 py-3 border-b border-border/50 shrink-0">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('التقييمات السابقة', 'Past Assessments')}</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">لا توجد تقييمات</p>
        ) : sessions.map((s) => (
          <div key={s.id}
            className={`flex items-center rounded-lg border text-xs group ${
              currentId === s.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-muted/30'
            }`}>
            <button type="button" onClick={() => onSelect(s)}
              className={`flex-1 text-start px-2.5 py-2 min-w-0 ${currentId === s.id ? 'text-foreground' : 'text-muted-foreground'}`}>
              <div className="flex items-center gap-1.5">
                {s.report?.riskLevel && <AlertTriangle className={`w-3 h-3 shrink-0 ${RISK_COLORS[s.report.riskLevel] ?? ''}`} />}
                <span className="truncate font-medium">{s.scenarioTitleAr ?? s.scenarioId}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{new Date(s.createdAt).toLocaleDateString('ar-AE')}</p>
            </button>
            <button type="button" onClick={() => onDelete(s.id)}
              className="shrink-0 pe-1.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-0.5">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LegalOs() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const { toast } = useToast();

  const [roles, setRoles] = useState<Role[]>([]);
  const [screen, setScreen] = useState<Screen>('roles');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessing, setAssessing] = useState(false);
  const [brief, setBrief] = useState<Partial<DecisionBrief> | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [briefCitations, setBriefCitations] = useState<Citation[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Load scenarios
  useEffect(() => {
    apiFetch('/api/legal-os/scenarios')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.roles) setRoles(d.roles); })
      .catch(() => {});
  }, []);

  // Load history
  const fetchHistory = useCallback(async () => {
    const r = await apiFetch('/api/legal-os/sessions');
    if (r.ok) { const d = await r.json(); setHistory(d.sessions ?? []); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  function selectRole(role: Role) {
    setSelectedRole(role);
    setScreen('scenarios');
  }

  function selectScenario(sc: Scenario) {
    setSelectedScenario(sc);
    setCurrentQ(0);
    setAnswers({});
    setScreen('interview');
  }

  function handleAnswer(id: string, value: string) {
    const newAnswers = { ...answers, [id]: value };
    setAnswers(newAnswers);
    const questions = selectedScenario?.questions ?? [];
    if (currentQ < questions.length - 1) {
      setCurrentQ((i) => i + 1);
    }
  }

  function handleBack() {
    if (screen === 'scenarios') { setScreen('roles'); setSelectedRole(null); }
    else if (screen === 'interview') {
      if (currentQ === 0) { setScreen('scenarios'); }
      else { setCurrentQ((i) => i - 1); }
    }
    else if (screen === 'brief' && !isStreaming) {
      setScreen('roles'); setBrief(null); setSelectedRole(null); setSelectedScenario(null);
    }
  }

  async function runAssessment() {
    if (!selectedRole || !selectedScenario || !canUseAi) return;

    setAssessing(true);
    setIsStreaming(true);
    setBrief({});
    setBriefCitations([]);
    setSessionId(null);
    setScreen('brief');

    try {
      const r = await apiFetch('/api/legal-os/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/x-ndjson',
        },
        body: JSON.stringify({
          roleId: selectedRole.id,
          scenarioId: selectedScenario.id,
          answers,
        }),
      });

      // ── Streaming path ────────────────────────────────────────────────────
      if (r.ok && r.body && r.headers.get('content-type')?.includes('ndjson')) {
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const event = JSON.parse(trimmed) as { section: string; data: unknown };
                if (event.section === 'error') {
                  toast({ title: 'فشل التقييم', description: String(event.data), variant: 'destructive' });
                  setScreen('interview');
                  setBrief(null);
                  return;
                } else if (event.section === 'done') {
                  const { sessionId: sid } = event.data as { sessionId: number };
                  setSessionId(sid);
                  fetchHistory();
                } else if (event.section === 'citations') {
                  setBriefCitations(event.data as Citation[]);
                } else {
                  setBrief((prev) => ({ ...prev, [event.section]: event.data }));
                }
              } catch {
                // malformed line — skip
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        return;
      }

      // ── Non-streaming fallback ────────────────────────────────────────────
      if (r.ok) {
        const data = await r.json();
        setBrief(data.report);
        setBriefCitations(data.citations ?? []);
        setSessionId(data.session?.id ?? null);
        fetchHistory();
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'فشل التقييم', description: (err as { error?: string }).error, variant: 'destructive' });
        setScreen('interview');
        setBrief(null);
      }
    } catch (err) {
      toast({ title: 'فشل التقييم', description: String(err), variant: 'destructive' });
      setScreen('interview');
      setBrief(null);
    } finally {
      setIsStreaming(false);
      setAssessing(false);
    }
  }

  function loadSession(s: SavedSession) {
    if (!s.report) return;
    const role = roles.find((r) => r.id === s.role);
    const scenario = role?.scenarios.find((sc) => sc.id === s.scenarioId) ?? {
      id: s.scenarioId, titleAr: s.scenarioTitleAr ?? s.scenarioId,
      titleEn: s.scenarioTitleEn ?? s.scenarioId,
      descriptionAr: '', jurisdictions: [], estimatedMinutes: 0, questions: [],
    };
    setSelectedRole(role ?? null);
    setSelectedScenario(scenario as Scenario);
    setBrief(s.report as Partial<DecisionBrief>);
    setBriefCitations((s.report as DecisionBrief & { citations?: Citation[] }).citations ?? []);
    setSessionId(s.id);
    setIsStreaming(false);
    setScreen('brief');
  }

  async function deleteSession(id: number) {
    await apiFetch(`/api/legal-os/sessions/${id}`, { method: 'DELETE' });
    setHistory((prev) => prev.filter((s) => s.id !== id));
    if (sessionId === id) { setBrief(null); setScreen('roles'); }
  }

  function resetAll() {
    if (isStreaming) return; // prevent reset during active stream
    setScreen('roles');
    setSelectedRole(null);
    setSelectedScenario(null);
    setAnswers({});
    setBrief(null);
    setIsStreaming(false);
    setBriefCitations([]);
    setSessionId(null);
    setCurrentQ(0);
  }

  return (
    <AppLayout variant="chat">
      <div className="flex h-[100dvh] w-full overflow-hidden flex-col md:flex-row" dir="rtl">

        {/* Desktop sidebar */}
        {(screen === 'brief' || history.length > 0) && (
          <HistorySidebar
            sessions={history}
            onSelect={loadSession}
            onDelete={deleteSession}
            currentId={sessionId}
            t={t}
          />
        )}

        {/* Main content column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              {screen !== 'roles' && (
                <button type="button" onClick={handleBack}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <Scale className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm text-foreground">
                {t('المكتب القانوني الذكي', 'AI Legal OS')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(true)}
              className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              {t('السابق', 'History')}
            </button>
          </div>

          {/* Screen content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {screen === 'roles'     && <RolesScreen roles={roles} onSelect={selectRole} />}
            {screen === 'scenarios' && selectedRole && (
              <ScenariosScreen role={selectedRole} onSelect={selectScenario} onBack={handleBack} />
            )}
            {screen === 'interview' && selectedScenario && (
              <InterviewScreen
                scenario={selectedScenario}
                answers={answers}
                currentIndex={currentQ}
                onAnswer={handleAnswer}
                onBack={handleBack}
                onAssess={runAssessment}
                assessing={assessing}
              />
            )}
            {screen === 'loading' && <LoadingScreen />}
            {screen === 'brief' && brief !== null && selectedRole && selectedScenario && (
              <DecisionBriefView
                brief={brief}
                scenario={selectedScenario}
                role={selectedRole}
                sessionId={sessionId}
                citations={briefCitations}
                isStreaming={isStreaming}
                onReset={resetAll}
                t={t}
              />
            )}
          </div>
        </div>

        {/* Mobile history drawer */}
        <HistoryDrawer
          open={showHistoryDrawer}
          sessions={history}
          onSelect={loadSession}
          onDelete={deleteSession}
          onClose={() => setShowHistoryDrawer(false)}
          t={t}
        />
      </div>
    </AppLayout>
  );
}
