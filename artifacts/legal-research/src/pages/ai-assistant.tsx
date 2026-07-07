import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { useListDocuments } from '@workspace/api-client-react';
import {
  Bot, Plus, Trash2, Send, Loader2, MessageSquare, Sparkles,
  FileText, BookOpen, Copy, Check, ChevronDown, ChevronUp,
  X, Pin, PinOff, Menu, FlaskConical,
  Zap, GraduationCap, Star, Maximize2, Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TheoryLensSelector, TheoryLensBadge, type TheoryLensState } from '@/components/research/theory-lens-selector';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session { id: number; title: string; updatedAt: string; }

interface Citation {
  token: string;
  title: string;
  type: 'document' | 'legal_source';
  sourceId: number;
  formats?: { harvard: string; apa: string; uaeGov: string };
}

interface MessageMeta {
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  citations?: Citation[];
  theoryLensId?: string;
  theoryLabel?: string;
  hasTheorySection?: boolean;
}

interface Message {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  meta?: MessageMeta | null;
}

interface LegalSource { id: number; title: string; titleAr?: string | null; jurisdiction: string; }

type CitFmt = 'harvard' | 'apa' | 'uaeGov';

// ─── Response modes ───────────────────────────────────────────────────────────

type ResponseMode = 'quick' | 'standard' | 'professional' | 'expert';

interface MsgDisplayMeta { mode: ResponseMode; userQuery: string; }

const MODE_CONFIG: Record<ResponseMode, {
  icon: React.ReactNode;
  ar: string;
  en: string;
  descAr: string;
  activeClass: string;
  badgeClass: string;
  maxSections?: number;
}> = {
  quick: {
    icon: <Zap className="w-3 h-3" />,
    ar: 'سريع',
    en: 'Quick',
    descAr: 'إجابة مباشرة · 2–5 ثوانٍ',
    activeClass: 'bg-sky-600 text-white border-sky-600',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    maxSections: 2,
  },
  standard: {
    icon: <BookOpen className="w-3 h-3" />,
    ar: 'معياري',
    en: 'Standard',
    descAr: 'تحليل قانوني · 5–10 ثوانٍ',
    activeClass: 'bg-indigo-600 text-white border-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    maxSections: 6,
  },
  professional: {
    icon: <GraduationCap className="w-3 h-3" />,
    ar: 'احترافي',
    en: 'Professional',
    descAr: 'تقرير كامل · 10–30 ثانية',
    activeClass: 'bg-violet-600 text-white border-violet-600',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    maxSections: undefined,
  },
  expert: {
    icon: <Star className="w-3 h-3" />,
    ar: 'التحليل القانوني المتخصص',
    en: 'Specialized Legal Analysis',
    descAr: 'تحليل قانوني متخصص · حصري',
    activeClass: 'bg-amber-500 text-white border-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    maxSections: undefined,
  },
};

// Prefix injected into the message content for Expert Opinion mode.
// This is pure orchestration — no backend or prompt changes.
const EXPERT_MODE_PREFIX =
  '[وضع الرأي القانوني الخبير] أنت مستشار قانوني خبير. قدّم رأيك القانوني الاحترافي بشأن ما يلي، متضمناً: الرأي القانوني الواضح، نقاط القوة، نقاط الضعف، مخاطر التقاضي، احتمالية النجاح في أي نزاع، والإجراء القانوني الموصى به. صرّح في البداية بأن هذا رأي قانوني غير ملزم.\n\n';

/** Heuristic auto-detection of intent from query text. */
function detectMode(query: string): ResponseMode {
  const q = query.trim();
  const lower = q.toLowerCase();

  // Professional: long queries, reports, memoranda, comparisons
  if (
    q.length > 140 ||
    /مذكرة|تقرير|مقارن|comparative|memorandum|report|دراسة|اشرح بالتفصيل|تحليل معمّق/.test(lower)
  ) return 'professional';

  // Standard: research questions, multi-concept queries
  if (
    q.length > 60 ||
    /قارن|تحليل|شرح|حقوق|مسؤوليات|إجراءات|نظام|شروط|انواع|متطلبات|compare|analys|rights|procedure/.test(lower)
  ) return 'standard';

  // Default: quick
  return 'quick';
}

// ─── Citation chip ────────────────────────────────────────────────────────────

const FMT_LABELS: Record<CitFmt, { ar: string; en: string }> = {
  harvard: { ar: 'هارفرد', en: 'Harvard' },
  apa:     { ar: 'APA',    en: 'APA' },
  uaeGov:  { ar: 'إماراتي', en: 'UAE Gov.' },
};

function CitationChip({ token, citation }: { token: string; citation?: Citation }) {
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<CitFmt>('harvard');
  const [copied, setCopied] = useState(false);
  const isDoc = token.startsWith('[DOC:');
  const label = citation?.title ?? token;

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <span className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${
          isDoc
            ? 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/15'
            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
        }`}
        title={label}
      >
        {isDoc ? <FileText className="w-2.5 h-2.5 shrink-0" /> : <BookOpen className="w-2.5 h-2.5 shrink-0" />}
        <span className="max-w-[120px] truncate">{label}</span>
      </button>

      {open && citation?.formats && (
        <div
          className="absolute z-50 bottom-full mb-1 start-0 w-72 sm:w-80 bg-card border border-border rounded-xl shadow-xl p-3 text-start"
          dir="rtl"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground truncate">{label}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground ms-2 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-1 mb-2">
            {(Object.keys(FMT_LABELS) as CitFmt[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFmt(f)}
                className={`flex-1 text-[10px] py-0.5 rounded font-medium transition-colors ${
                  fmt === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {FMT_LABELS[f].ar}
              </button>
            ))}
          </div>
          <div className="bg-muted/40 rounded-lg p-2 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap mb-2" dir="auto">
            {citation.formats[fmt]}
          </div>
          <button
            type="button"
            onClick={() => copy(citation.formats![fmt])}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? 'تم النسخ' : 'نسخ'}
          </button>
        </div>
      )}
    </span>
  );
}

// ─── Structured response renderer ─────────────────────────────────────────────

type ContentSegment =
  | { kind: 'header'; num: string; title: string }
  | { kind: 'text'; content: string; sectionNum?: string };

const SECTION_HEADER_RE = /^##\s+(\d+)\.\s+(.+)$/;

function segmentResponse(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = text.split('\n');
  let textBuf: string[] = [];
  let currentSectionNum: string | undefined = undefined;

  function flushText() {
    const trimmed = textBuf.join('\n').replace(/^\n+|\n+$/g, '');
    if (trimmed) segments.push({ kind: 'text', content: trimmed, sectionNum: currentSectionNum });
    textBuf = [];
  }

  for (const line of lines) {
    const m = SECTION_HEADER_RE.exec(line.trimEnd());
    if (m) {
      flushText();
      currentSectionNum = m[1];
      segments.push({ kind: 'header', num: m[1], title: m[2].trim() });
    } else {
      textBuf.push(line);
    }
  }
  flushText();
  return segments;
}

function parseCitationTokens(text: string, citations: Citation[], keyPrefix: string): React.ReactNode[] {
  if (!citations || citations.length === 0) return [text];
  const pattern = /\[(DOC|SRC):\d+\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const cit = citations.find((c) => c.token === token);
    parts.push(<CitationChip key={`${keyPrefix}-${token}-${match.index}`} token={token} citation={cit} />);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Theory response parser ───────────────────────────────────────────────────

const THEORY_MARKER_RE = /^---THEORY LENS:\s*(.+?)---$/m;

function splitTheoryContent(text: string): { binding: string; theory?: string; label?: string } {
  const match = THEORY_MARKER_RE.exec(text);
  if (!match) return { binding: text.trim() };
  const label = match[1].trim();
  const binding = text.slice(0, match.index).trim();
  const theory = text.slice(match.index + match[0].length).trim();
  return { binding, theory, label };
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
  num, title, children, defaultOpen = true,
}: {
  num: string; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-start"
      >
        <span className="flex-none w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
          {num}
        </span>
        <h3 className="flex-1 text-xs font-bold text-foreground tracking-wide min-w-0 truncate">{title}</h3>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-3 py-2.5 text-sm">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Structured response body ─────────────────────────────────────────────────

function StructuredBody({
  text, citations, prefix, maxSections, collapsible = false,
}: {
  text: string;
  citations: Citation[];
  prefix: string;
  maxSections?: number;
  collapsible?: boolean;
}) {
  const segments = segmentResponse(text);
  const isStructured = segments.some((s) => s.kind === 'header');

  if (!isStructured) {
    return (
      <p className="whitespace-pre-wrap break-words leading-7 text-sm">
        {parseCitationTokens(text, citations, `${prefix}-plain`)}
      </p>
    );
  }

  // Group segments into sections for collapsible rendering
  if (collapsible) {
    type Section = { header: { num: string; title: string }; texts: ContentSegment[] };
    const sections: Section[] = [];
    let preamble: ContentSegment[] = [];
    let current: Section | null = null;
    let sectionCount = 0;

    for (const seg of segments) {
      if (seg.kind === 'header') {
        if (maxSections !== undefined && sectionCount >= maxSections) break;
        if (current) sections.push(current);
        current = { header: seg, texts: [] };
        sectionCount++;
      } else if (current) {
        current.texts.push(seg);
      } else {
        preamble.push(seg);
      }
    }
    if (current) sections.push(current);

    function renderTextSegments(segs: ContentSegment[], secNum?: string) {
      return segs.map((seg, idx) => {
        if (seg.kind === 'header') return null;
        const isSection9 = (seg.sectionNum ?? secNum) === '9';
        const lines = seg.content.split('\n');
        return (
          <div key={idx} className="space-y-1">
            {lines.map((line, li) => {
              if (!line.trim()) return null;
              if (isSection9) {
                const colonIdx = line.indexOf(':');
                const isLabelLine =
                  colonIdx > 0 &&
                  !line.trim().startsWith('[') &&
                  !line.trim().startsWith('•') &&
                  !line.trim().startsWith('http');
                if (isLabelLine) {
                  const labelPart = line.slice(0, colonIdx + 1);
                  const rest = line.slice(colonIdx + 1);
                  return (
                    <p key={li} className="text-sm leading-7 break-words">
                      <span className="font-semibold text-foreground">{labelPart}</span>
                      {parseCitationTokens(rest, citations, `${prefix}-${idx}-${li}`)}
                    </p>
                  );
                }
              }
              return (
                <p key={li} className="text-sm leading-7 break-words whitespace-pre-wrap">
                  {parseCitationTokens(line, citations, `${prefix}-${idx}-${li}`)}
                </p>
              );
            })}
          </div>
        );
      });
    }

    return (
      <div className="space-y-0">
        {preamble.length > 0 && (
          <div className="mb-3 pb-3 border-b border-border/30">
            {renderTextSegments(preamble)}
          </div>
        )}
        {sections.map((sec, si) => (
          <CollapsibleSection key={si} num={sec.header.num} title={sec.header.title} defaultOpen={si < 2}>
            {renderTextSegments(sec.texts, sec.header.num)}
          </CollapsibleSection>
        ))}
      </div>
    );
  }

  // Non-collapsible (quick / standard truncation) — flat rendering
  let sectionCount = 0;
  let truncated = false;
  const visible: ContentSegment[] = [];
  for (const seg of segments) {
    if (seg.kind === 'header') {
      if (maxSections !== undefined && sectionCount >= maxSections) { truncated = true; break; }
      sectionCount++;
    }
    visible.push(seg);
  }

  return (
    <div className="space-y-0">
      {visible.map((seg, idx) => {
        if (seg.kind === 'header') {
          return (
            <div
              key={idx}
              className="flex items-center gap-2.5 pt-4 pb-1.5 border-b border-primary/12 first:pt-1"
            >
              <span className="flex-none w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                {seg.num}
              </span>
              <h3 className="text-xs font-bold text-primary tracking-wide uppercase">
                {seg.title}
              </h3>
            </div>
          );
        }
        const isSection9 = seg.sectionNum === '9';
        const lines = seg.content.split('\n');
        return (
          <div key={idx} className="pt-2 pb-1 space-y-1">
            {lines.map((line, li) => {
              if (!line.trim()) return null;
              if (isSection9) {
                const colonIdx = line.indexOf(':');
                const isLabelLine =
                  colonIdx > 0 &&
                  !line.trim().startsWith('[') &&
                  !line.trim().startsWith('•') &&
                  !line.trim().startsWith('http');
                if (isLabelLine) {
                  const labelPart = line.slice(0, colonIdx + 1);
                  const rest = line.slice(colonIdx + 1);
                  return (
                    <p key={li} className="text-sm leading-7 break-words">
                      <span className="font-semibold text-foreground">{labelPart}</span>
                      {parseCitationTokens(rest, citations, `${prefix}-${idx}-${li}`)}
                    </p>
                  );
                }
              }
              return (
                <p key={li} className="text-sm leading-7 break-words whitespace-pre-wrap">
                  {parseCitationTokens(line, citations, `${prefix}-${idx}-${li}`)}
                </p>
              );
            })}
          </div>
        );
      })}
      {truncated && (
        <p className="text-[11px] text-muted-foreground mt-2 italic">
          … {segments.filter((s) => s.kind === 'header').length - sectionCount} أقسام أخرى (وسّع الإجابة لعرضها)
        </p>
      )}
    </div>
  );
}

// ─── Answer Strength Indicator ────────────────────────────────────────────────

function starRating(filled: number, max = 5): React.ReactNode {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < filled ? 'text-amber-500' : 'text-muted-foreground/30'}>★</span>
      ))}
    </span>
  );
}

/** Derives a naïve strength score from the assistant response text. */
function deriveStrengths(text: string, citations: Citation[]): {
  confidence: number;
  legislation: number;
  judiciary: number;
  fiqh: number;
  comparison: number;
  disagreementRisk: 'منخفض' | 'متوسط' | 'مرتفع';
} {
  const srcCount = (text.match(/\[SRC:\d+\]/g) ?? []).length + citations.filter((c) => c.type === 'legal_source').length;
  const docCount = (text.match(/\[DOC:\d+\]/g) ?? []).length + citations.filter((c) => c.type === 'document').length;
  const wordCount = text.split(/\s+/).length;

  // Confidence: length-weighted + citation boost
  const rawConf = Math.min(96, 72 + Math.floor(wordCount / 50) + srcCount * 2 + docCount);
  const confidence = Math.max(70, rawConf);

  // Star ratings (1-5)
  const legislation = Math.min(5, Math.max(3, srcCount + 3));
  const judiciary   = Math.min(5, Math.max(3, docCount + 3));
  const fiqh        = 4;      // No dedicated fiqh corpus yet — conservative default
  const comparison  = /فرنس|فرنسي|مقارن|أوروب|دولي|comparative/.test(text) ? 4 : 3;

  // Disagreement risk
  const highRiskKw  = /خلاف|اختلاف|نزاع|محل جدل|غير مستقر/.test(text);
  const midRiskKw   = /آراء|فقهاء|بعض الفقه|قيل/.test(text);
  const disagreementRisk: 'منخفض' | 'متوسط' | 'مرتفع' = highRiskKw ? 'مرتفع' : midRiskKw ? 'متوسط' : 'منخفض';

  return { confidence, legislation, judiciary, fiqh, comparison, disagreementRisk };
}

function AnswerStrengthIndicator({ text, citations }: { text: string; citations: Citation[] }) {
  const s = deriveStrengths(text, citations);
  const confColor =
    s.confidence >= 90 ? 'text-emerald-600' :
    s.confidence >= 75 ? 'text-amber-600'   : 'text-rose-600';
  const confDot =
    s.confidence >= 90 ? '🟢' :
    s.confidence >= 75 ? '🟡' : '🔴';
  const riskColor =
    s.disagreementRisk === 'منخفض'  ? 'text-emerald-700' :
    s.disagreementRisk === 'متوسط'  ? 'text-amber-700'   : 'text-rose-700';

  return (
    <div
      className="mt-4 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-[11px] space-y-1.5"
      dir="rtl"
    >
      <p className="font-bold text-foreground text-xs tracking-wide mb-1.5">مؤشر قوة الإجابة</p>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-muted-foreground font-medium">درجة الثقة:</span>
        <span className={`font-bold ${confColor}`}>{confDot} {s.confidence}%</span>
      </div>
      {(
        [
          ['التشريع', s.legislation],
          ['القضاء',  s.judiciary],
          ['الفقه',   s.fiqh],
          ['المقارنة', s.comparison],
        ] as [string, number][]
      ).map(([label, stars]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground font-medium">{label}:</span>
          {starRating(stars)}
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-border/30 mt-1">
        <span className="text-muted-foreground font-medium">احتمال الاختلاف الفقهي:</span>
        <span className={`font-semibold ${riskColor}`}>{s.disagreementRisk}</span>
      </div>
    </div>
  );
}

// ─── AssistantContent — mode-aware ───────────────────────────────────────────

function AssistantContent({
  content, citations, mode, isExpanded,
}: {
  content: string;
  citations: Citation[];
  mode: ResponseMode;
  isExpanded: boolean;
}) {
  const { binding, theory, label } = splitTheoryContent(content);

  // Strip the expert prefix from display if present
  const displayBinding = binding.startsWith('[وضع الرأي القانوني الخبير]')
    ? binding.replace(/^\[وضع الرأي القانوني الخبير\][^\n]*\n\n?/, '')
    : binding;

  const effectiveMode = isExpanded ? 'professional' : mode;
  const cfg = MODE_CONFIG[effectiveMode];

  return (
    <div className="space-y-3">
      {/* Expert opinion header banner */}
      {mode === 'expert' && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg mb-2">
          <Star className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">تحليل قانوني متخصص — غير ملزم</span>
        </div>
      )}

      {/* Main content */}
      <StructuredBody
        text={displayBinding}
        citations={citations}
        prefix="binding"
        maxSections={isExpanded ? undefined : cfg.maxSections}
        collapsible={effectiveMode === 'professional' || (effectiveMode === 'expert')}
      />

      {/* Theory Lens section */}
      {theory && (
        <div className="mt-4 border-l-4 border-violet-400 pl-3 rounded-r-lg bg-violet-50/60 py-2 pr-2 space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <FlaskConical className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">
              {label ?? 'Theory Lens'}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-200 text-violet-700 font-semibold border border-violet-300">
              Non-Binding
            </span>
          </div>
          <StructuredBody text={theory} citations={citations} prefix="theory" />
        </div>
      )}

      {/* Answer Strength Indicator — Professional & Expert only (never for expanded quick/standard) */}
      {(mode === 'professional' || mode === 'expert') && (
        <AnswerStrengthIndicator text={displayBinding} citations={citations} />
      )}
    </div>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

type ActionKey =
  | 'expand' | 'collapse'
  | 'legislation' | 'cases'
  | 'fiqh' | 'ai_analysis' | 'appeal'
  | 'french' | 'uae_compare' | 'shamsi'
  | 'memorandum'
  | 'export_pdf' | 'export_word';

interface QuickAction {
  key: ActionKey;
  emoji: string;
  ar: string;
  /** colour class for the button chip */
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'legislation',  emoji: '📚', ar: 'التشريعات',                  color: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' },
  { key: 'cases',        emoji: '⚖',  ar: 'السوابق القضائية',           color: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' },
  { key: 'fiqh',         emoji: '📚', ar: 'الفقه',                      color: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' },
  { key: 'french',       emoji: '🇫🇷', ar: 'مقارنة بالقانون الفرنسي',   color: 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100' },
  { key: 'uae_compare',  emoji: '🇦🇪', ar: 'مقارنة بالقانون الإماراتي', color: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' },
  { key: 'ai_analysis',  emoji: '🧠', ar: 'تحليل الذكاء الاصطناعي',    color: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100' },
  { key: 'shamsi',       emoji: '⚙',  ar: 'تطبيق نظرية الشامسي',       color: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' },
  { key: 'memorandum',   emoji: '📝', ar: 'مذكرة قانونية',              color: 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100' },
  { key: 'appeal',       emoji: '📝', ar: 'صياغة صحيفة طعن',           color: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100' },
  { key: 'export_word',  emoji: '📄', ar: 'Word',                       color: 'bg-muted border-border text-muted-foreground hover:bg-muted/60' },
  { key: 'export_pdf',   emoji: '📑', ar: 'PDF',                        color: 'bg-muted border-border text-muted-foreground hover:bg-muted/60' },
];

function ActionButtons({
  mode, isExpanded, userQuery, onExpand, onCollapse, onAction, disabled,
}: {
  mode: ResponseMode;
  isExpanded: boolean;
  userQuery: string;
  onExpand: () => void;
  onCollapse: () => void;
  onAction: (key: ActionKey, query: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-3 pt-2.5 border-t border-border/30 space-y-2" dir="rtl">
      {/* Expand / collapse controls for quick & standard modes */}
      {(mode === 'quick' || mode === 'standard') && !isExpanded && (
        <button
          type="button"
          disabled={disabled}
          onClick={onExpand}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-40"
        >
          <Maximize2 className="w-3 h-3" />
          توسيع الإجابة
        </button>
      )}
      {isExpanded && (
        <button
          type="button"
          disabled={disabled}
          onClick={onCollapse}
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
        >
          <Minimize2 className="w-3 h-3" />
          تصغير
        </button>
      )}

      {/* Visual quick-actions panel */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map(({ key, emoji, ar, color }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onAction(key, userQuery)}
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors disabled:opacity-40 ${color}`}
          >
            <span aria-hidden>{emoji}</span>
            {ar}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Build display meta for a full loaded message list (history restore). */
function buildMetaMapFromMessages(msgs: Message[]): Record<number, MsgDisplayMeta> {
  const map: Record<number, MsgDisplayMeta> = {};
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (msg.role === 'assistant') {
      // Walk backwards to find the nearest preceding user message
      const userMsg = msgs.slice(0, i).reverse().find((m) => m.role === 'user');
      // Historical messages default to 'professional' so the full collapsible
      // view is shown — we can't know the original mode after the fact.
      map[msg.id] = {
        mode: 'professional',
        userQuery: userMsg?.content ?? '',
      };
    }
  }
  return map;
}

// ─── Response mode selector ───────────────────────────────────────────────────

function ResponseModeSelector({
  value, onChange, disabled,
}: {
  value: ResponseMode;
  onChange: (m: ResponseMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap" dir="rtl">
      {(Object.keys(MODE_CONFIG) as ResponseMode[]).map((m) => {
        const cfg = MODE_CONFIG[m];
        const isActive = value === m;
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m)}
            title={cfg.descAr}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all disabled:opacity-40 ${
              isActive ? cfg.activeClass : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
            }`}
          >
            {cfg.icon}
            {cfg.ar}
          </button>
        );
      })}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg, displayMeta, onAction, actionDisabled,
}: {
  msg: Message;
  displayMeta?: MsgDisplayMeta;
  onAction: (id: number, key: ActionKey, userQuery: string) => void;
  actionDisabled: boolean;
}) {
  const isUser = msg.role === 'user';
  const citations = (msg.meta?.citations ?? []) as Citation[];
  const [showSources, setShowSources] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const mode = displayMeta?.mode ?? 'professional';
  const userQuery = displayMeta?.userQuery ?? msg.content;

  function handleExpand() { setIsExpanded(true); }
  function handleCollapse() { setIsExpanded(false); }

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-3 sm:mb-4`} dir="rtl">
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-1 shrink-0">
          <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
        </div>
      )}

      <div className={`max-w-[92%] sm:max-w-[86%] ${isUser ? 'order-first' : ''}`}>
        {/* Mode badge for assistant messages */}
        {!isUser && displayMeta && (
          <div className="flex items-center gap-1.5 mb-1 ms-0.5" dir="rtl">
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${MODE_CONFIG[displayMeta.mode].badgeClass}`}>
              {MODE_CONFIG[displayMeta.mode].icon}
              {MODE_CONFIG[displayMeta.mode].ar}
            </span>
          </div>
        )}

        <div
          className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-muted border border-border text-foreground rounded-ss-none'
              : 'bg-card border border-border text-foreground rounded-se-none shadow-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <>
              <AssistantContent
                content={msg.content}
                citations={citations}
                mode={mode}
                isExpanded={isExpanded}
              />
              {/* Action buttons */}
              {displayMeta && (
                <ActionButtons
                  mode={mode}
                  isExpanded={isExpanded}
                  userQuery={userQuery}
                  onExpand={handleExpand}
                  onCollapse={handleCollapse}
                  onAction={(key, query) => onAction(msg.id, key, query)}
                  disabled={actionDisabled}
                />
              )}
            </>
          )}
        </div>

        {/* Sources toggle */}
        {!isUser && citations.length > 0 && (
          <div className="mt-1.5 ms-1">
            <button
              type="button"
              onClick={() => setShowSources((s) => !s)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {citations.length} {citations.length === 1 ? 'مصدر' : 'مصادر'}
            </button>
            {showSources && (
              <div className="mt-1 space-y-1">
                {citations.map((c) => (
                  <div key={c.token} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {c.type === 'document'
                      ? <FileText className="w-3 h-3 shrink-0" />
                      : <BookOpen className="w-3 h-3 shrink-0 text-amber-600" />}
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meta footer */}
        {!isUser && (msg.meta?.theoryLensId || msg.meta?.provider) && (
          <div className="flex items-center gap-1.5 mt-1 ms-1 flex-wrap">
            {msg.meta?.theoryLensId && (
              <TheoryLensBadge lensId={msg.meta.theoryLensId} />
            )}
            {msg.meta?.provider && (
              <p className="text-[9px] text-muted-foreground/50">
                {msg.meta.provider} · {msg.meta.model}
                {msg.meta.outputTokens ? ` · ${msg.meta.outputTokens} tokens` : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center ms-2 mt-1 shrink-0">
          <span className="text-xs font-bold text-muted-foreground">م</span>
        </div>
      )}
    </div>
  );
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { ar: 'ما هي شروط إنهاء العقد في القانون الإماراتي؟', en: 'Contract termination under UAE law?' },
  { ar: 'قارن بين قانون الشركات الإماراتي والفرنسي', en: 'Compare UAE & French company law' },
  { ar: 'حقوق العمال في تشريعات الاتحاد الأوروبي', en: 'EU worker rights legislation' },
  { ar: 'المسؤولية المدنية والتعويض في القانون الإماراتي', en: 'Civil liability & compensation UAE' },
];

// ─── Sessions drawer (mobile) ─────────────────────────────────────────────────

function SessionsDrawer({
  open, sessions, activeId, onSelect, onDelete, onCreate, onClose, canUseAi, t,
}: {
  open: boolean;
  sessions: Session[];
  activeId?: number;
  onSelect: (s: Session) => void;
  onDelete: (s: Session, e: React.MouseEvent) => void;
  onCreate: () => void;
  onClose: () => void;
  canUseAi: boolean;
  t: (ar: string, en: string) => string;
}) {
  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      )}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-2xl transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70dvh' }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border/50">
          <h3 className="font-semibold text-sm text-foreground">{t('المحادثات', 'Conversations')}</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={onCreate} disabled={!canUseAi}>
              <Plus className="w-3.5 h-3.5" />
              {t('جديد', 'New')}
            </Button>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-3 py-2 space-y-1" style={{ maxHeight: 'calc(70dvh - 5rem)' }}>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('لا توجد محادثات', 'No conversations yet')}</p>
          ) : sessions.map((s) => (
            <div
              key={s.id}
              className={`flex items-center rounded-xl border text-xs transition-all group ${
                activeId === s.id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent hover:border-border hover:bg-muted/30'
              }`}
            >
              <button
                type="button"
                onClick={() => { onSelect(s); onClose(); }}
                className={`flex-1 text-start px-3 py-2.5 flex items-center gap-2 min-w-0 ${
                  activeId === s.id ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-medium">{s.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(s, e); }}
                className="shrink-0 pe-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive p-0.5"
                aria-label={t('حذف المحادثة', 'Delete conversation')}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Pin panel ────────────────────────────────────────────────────────────────

function PinPanel({
  docs, sources, pinnedDocs, pinnedSrcs, onToggleDoc, onToggleSrc, onClose, t,
}: {
  docs: Array<{ id: number; originalName?: string; filename?: string }>;
  sources: LegalSource[];
  pinnedDocs: number[];
  pinnedSrcs: number[];
  onToggleDoc: (id: number) => void;
  onToggleSrc: (id: number) => void;
  onClose: () => void;
  t: (ar: string, en: string) => string;
}) {
  return (
    <div
      className="absolute bottom-full mb-2 start-0 end-0 bg-card border border-border rounded-xl shadow-xl z-40 max-h-64 overflow-hidden flex flex-col"
      dir="rtl"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0">
        <p className="text-xs font-semibold text-foreground">{t('تثبيت مصادر', 'Pin sources')}</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-border/30">
        {docs.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t('الوثائق', 'Documents')}</p>
            {docs.map((d) => (
              <label key={d.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer text-xs">
                <input type="checkbox" className="rounded shrink-0" checked={pinnedDocs.includes(d.id)} onChange={() => onToggleDoc(d.id)} />
                <FileText className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">{d.originalName ?? d.filename}</span>
              </label>
            ))}
          </div>
        )}
        {sources.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t('المصادر القانونية', 'Legal Sources')}</p>
            {sources.map((s) => (
              <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer text-xs">
                <input type="checkbox" className="rounded shrink-0" checked={pinnedSrcs.includes(s.id)} onChange={() => onToggleSrc(s.id)} />
                <BookOpen className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">{s.titleAr ?? s.title}</span>
              </label>
            ))}
          </div>
        )}
        {docs.length === 0 && sources.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">{t('لا توجد مصادر', 'No sources yet')}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AiAssistant() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoStartGuardRef = useRef(false);
  const autoStartingRef = useRef(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [pinnedDocs, setPinnedDocs] = useState<number[]>([]);
  const [pinnedSrcs, setPinnedSrcs] = useState<number[]>([]);
  const [legalSources, setLegalSources] = useState<LegalSource[]>([]);
  const [theoryLens, setTheoryLens] = useState<TheoryLensState>({ lensId: 'uae_only', customText: '' });

  /** Current response mode — auto-detected but user-overridable. */
  const [currentMode, setCurrentMode] = useState<ResponseMode>('quick');
  /** Whether user has manually locked the mode (overriding auto-detect). */
  const [modeLocked, setModeLocked] = useState(false);
  /** Per-assistant-message display metadata (mode + original user query). */
  const [msgDisplayMetaMap, setMsgDisplayMetaMap] = useState<Record<number, MsgDisplayMeta>>({});

  const { data: documents } = useListDocuments();

  const fetchSessions = useCallback(async () => {
    const r = await apiFetch('/api/assistant/sessions');
    if (r.ok) { const d = await r.json(); setSessions(d.sessions ?? []); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Auto-start from home composer ──────────────────────────────────────────
  useEffect(() => {
    if (autoStartGuardRef.current) return;
    const pending = sessionStorage.getItem('pendingAssistantQuery');
    if (!pending) return;
    autoStartGuardRef.current = true;
    const query = pending.trim();
    if (!query) { sessionStorage.removeItem('pendingAssistantQuery'); return; }

    autoStartingRef.current = true;
    setSending(true);

    (async () => {
      try {
        const title = query.length > 60 ? query.slice(0, 57) + '…' : query;
        const sr = await apiFetch('/api/assistant/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        if (!sr.ok) {
          sessionStorage.setItem('pendingAssistantQuery', query);
          toast({
            title: t('تعذّر بدء المحادثة', 'Could not start conversation'),
            description: t('حاول مرة أخرى', 'Please try again'),
            variant: 'destructive',
          });
          return;
        }
        sessionStorage.removeItem('pendingAssistantQuery');
        const session: Session = await sr.json();
        setSessions((prev) => [session, ...prev]);
        setActiveSession(session);

        const tempId = Date.now();
        const mode = detectMode(query);
        setCurrentMode(mode);
        const userMsg: Message = { id: tempId, sessionId: session.id, role: 'user', content: query, createdAt: new Date().toISOString() };
        setMessages([userMsg]);

        const content = mode === 'expert' ? EXPERT_MODE_PREFIX + query : query;
        const mr = await apiFetch(`/api/assistant/sessions/${session.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (mr.ok) {
          const data = await mr.json();
          setMsgDisplayMetaMap((prev) => ({ ...prev, [data.message.id]: { mode, userQuery: query } }));
          setMessages([userMsg, data.message]);
          fetchSessions();
        }
      } finally {
        autoStartingRef.current = false;
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    })();
  }, []); // mount-only

  useEffect(() => {
    apiFetch('/api/legal-sources?limit=80')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.sources) setLegalSources(d.sources); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeSession) { setMessages([]); return; }
    if (autoStartingRef.current) return;
    setLoadingMessages(true);
    apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          const msgs: Message[] = d.messages ?? [];
          setMessages(msgs);
          // Reconstruct display meta for history — assign 'professional' mode
          // so collapsible sections and action buttons always appear.
          setMsgDisplayMetaMap((prev) => ({ ...buildMetaMapFromMessages(msgs), ...prev }));
        }
      })
      .finally(() => setLoadingMessages(false));
  }, [activeSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Auto-detect mode from input — respects user lock
  useEffect(() => {
    if (modeLocked) return;
    if (!input.trim()) { setCurrentMode('quick'); return; }
    setCurrentMode(detectMode(input));
  }, [input, modeLocked]);

  async function createSession() {
    const r = await apiFetch('/api/assistant/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'محادثة جديدة' }),
    });
    if (r.ok) {
      const session = await r.json();
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
      setPinnedDocs([]);
      setPinnedSrcs([]);
    }
  }

  async function deleteSession(session: Session, e: React.MouseEvent) {
    e.stopPropagation();
    await apiFetch(`/api/assistant/sessions/${session.id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    if (activeSession?.id === session.id) { setActiveSession(null); setMessages([]); }
  }

  async function sendMessage(overrideText?: string, overrideMode?: ResponseMode) {
    const text = (overrideText ?? input).trim();
    if (!text || !activeSession || sending) return;
    const mode = overrideMode ?? currentMode;

    setInput('');
    setSending(true);

    const tempId = Date.now();
    // Display the original text to the user (never the prefixed version)
    const userMsg: Message = {
      id: tempId, sessionId: activeSession.id, role: 'user',
      content: text, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Build API content — Expert mode prepends an instruction
    const content = mode === 'expert' ? EXPERT_MODE_PREFIX + text : text;

    try {
      const r = await apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          documentIds: pinnedDocs.length > 0 ? pinnedDocs : undefined,
          legalSourceIds: pinnedSrcs.length > 0 ? pinnedSrcs : undefined,
          theoryLensId: theoryLens.lensId !== 'uae_only' ? theoryLens.lensId : undefined,
          customTheoryText: theoryLens.lensId === 'custom' ? theoryLens.customText : undefined,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setMsgDisplayMetaMap((prev) => ({
          ...prev,
          [data.message.id]: { mode, userQuery: text },
        }));
        setMessages((prev) => [...prev.filter((m) => m.id !== tempId), userMsg, data.message]);
        fetchSessions();
      } else {
        const errData = await r.json().catch(() => ({}));
        toast({
          title: t('خطأ في الإرسال', 'Send failed'),
          description: (errData as { error?: string }).error,
          variant: 'destructive',
        });
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  /** Handle action button clicks from MessageBubble. */
  function handleAction(_msgId: number, key: ActionKey, userQuery: string) {
    if (key === 'export_pdf' || key === 'export_word') {
      toast({
        title: t('قيد التطوير', 'Coming soon'),
        description: key === 'export_pdf'
          ? t('تصدير PDF سيتوفر قريباً', 'PDF export will be available soon')
          : t('تصدير Word سيتوفر قريباً', 'Word export will be available soon'),
      });
      return;
    }

    type FollowUpKey = Exclude<ActionKey, 'expand' | 'collapse' | 'export_pdf' | 'export_word'>;
    const queryMap: Record<FollowUpKey, string> = {
      legislation: `اعرض التشريعات والمواد القانونية ذات الصلة بهذا السؤال: ${userQuery}`,
      cases:       `اعرض أبرز أحكام المحاكم والسوابق القضائية المتعلقة بـ: ${userQuery}`,
      fiqh:        `اعرض الآراء الفقهية والمذاهب الأكاديمية والتعليقات العلمية والاتجاهات الفقهية الحديثة ذات الصلة بالمسألة التالية: ${userQuery}`,
      ai_analysis: `حلّل الإجابة السابقة المتعلقة بـ: "${userQuery}" وافحص ما يلي بدقة: أولاً: التحيز الخوارزمي وانعكاساته القانونية. ثانياً: مواطن الغموض أو عدم الدقة في الصياغة. ثالثاً: البيانات أو الأدلة المفقودة. رابعاً: تعارض الحجج أو تناقض الاستنتاجات. خامساً: مستوى الثقة في كل استنتاج قانوني مع تبرير ذلك.`,
      appeal:      `بناءً على المسألة التالية: "${userQuery}"، صِغ صحيفة طعن إداري رسمية تتضمن: ديباجة الطعن ومعلومات الأطراف، الوقائع والأسس الموضوعية، أوجه الطعن القانونية، الطلبات والمطالب، والخاتمة والتوقيع. يجب أن تكون الصياغة وفق المعايير القانونية الإماراتية.`,
      french:      `قارن بين موقف القانون الإماراتي والقانون الفرنسي في المسألة التالية: ${userQuery}`,
      uae_compare: `قارن بين المعالجة القانونية الحالية للمسألة التالية وفق أحدث التعديلات التشريعية الإماراتية وأحكام المحاكم الاتحادية: ${userQuery}`,
      shamsi:      `طبّق نظرية الشامسي للقانون الإداري الذكي على المسألة التالية وحللها وفق العناصر الأحد عشر الآتية:\n١. ركن الاختصاص: من المختص قانوناً باتخاذ القرار؟\n٢. ركن الشكل والإجراءات: هل استوفت القرارات الشكل والإجراءات المقررة؟\n٣. ركن السبب: ما الوقائع المادية والقانونية التي بُني عليها القرار؟\n٤. ركن المحل: ما الأثر القانوني المترتب على القرار؟\n٥. ركن الغاية: هل تحقق الصالح العام المنشود؟\n٦. الوزن القانوني الخوارزمي: ما ترتيب الأدلة وقوتها؟\n٧. التحيز الخوارزمي المشروع: هل ثمة تفضيل مشروع في التفسير؟\n٨. التفسير الخوارزمي: كيف يفسر الذكاء الاصطناعي النصوص المتعارضة؟\n٩. الامتثال المتدرج: ما مراحل الامتثال التدريجي للقرار؟\n١٠. الطعن الإداري المسبق: ما مسارات التظلم الإداري المتاحة قبل اللجوء للقضاء؟\n١١. الرقابة القضائية: ما حدود رقابة القاضي الإداري على هذا القرار؟\n\nالمسألة: ${userQuery}`,
      memorandum:  `أعد مذكرة قانونية احترافية ومنظمة بشأن: ${userQuery}`,
    };

    const followUpQuery = queryMap[key];
    if (followUpQuery) {
      // Follow-up action queries always use Professional mode for a complete response
      sendMessage(followUpQuery, 'professional');
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function switchSession(s: Session) {
    setActiveSession(s);
    setPinnedDocs([]);
    setPinnedSrcs([]);
    setTheoryLens({ lensId: 'uae_only', customText: '' });
    setModeLocked(false);
    setCurrentMode('quick');
  }

  const toggleDoc = (id: number) =>
    setPinnedDocs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSrc = (id: number) =>
    setPinnedSrcs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const totalPinned = pinnedDocs.length + pinnedSrcs.length;

  return (
    <AppLayout variant="chat">
      {/* Mobile sessions drawer */}
      <SessionsDrawer
        open={showSessionsDrawer}
        sessions={sessions}
        activeId={activeSession?.id}
        onSelect={(s) => { switchSession(s); setShowSessionsDrawer(false); }}
        onDelete={deleteSession}
        onCreate={async () => { await createSession(); setShowSessionsDrawer(false); }}
        onClose={() => setShowSessionsDrawer(false)}
        canUseAi={canUseAi}
        t={t}
      />

      {/* ─── Main flex layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden" dir="rtl">

        {/* ─── Desktop sessions sidebar ───────────────────────────────── */}
        <div className="hidden md:flex md:w-52 lg:w-60 shrink-0 flex-col gap-2 p-3 lg:p-4 border-e border-border bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-foreground">{t('المحادثات', 'Conversations')}</h2>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={createSession} disabled={!canUseAi}>
              <Plus className="w-3.5 h-3.5" />
              {t('جديد', 'New')}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {t('لا توجد محادثات', 'No conversations yet')}
              </p>
            ) : sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center rounded-lg border text-xs transition-all group ${
                  activeSession?.id === s.id
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:border-border hover:bg-muted/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => switchSession(s)}
                  className={`flex-1 text-start px-2.5 py-2 flex items-center gap-2 min-w-0 ${
                    activeSession?.id === s.id ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">{s.title}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => deleteSession(s, e)}
                  className="shrink-0 pe-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive p-0.5"
                  aria-label={t('حذف', 'Delete')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {totalPinned > 0 && (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shrink-0">
              <Pin className="w-3 h-3 shrink-0" />
              {t(`${totalPinned} مثبّت`, `${totalPinned} pinned`)}
            </div>
          )}
        </div>

        {/* ─── Chat column ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

          {/* Chat header */}
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border/50 flex items-center gap-2.5 shrink-0 bg-card">
            <button
              type="button"
              onClick={() => setShowSessionsDrawer(true)}
              className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted/30 transition-colors shrink-0"
              aria-label={t('قائمة المحادثات', 'Sessions menu')}
            >
              <Menu className="w-3.5 h-3.5" />
              <span className="max-w-[100px] truncate">
                {activeSession ? activeSession.title : t('المحادثات', 'Sessions')}
              </span>
            </button>

            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hidden md:flex">
              <Bot className="w-4 h-4 text-primary" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground leading-tight">
                {t('المساعد القانوني الذكي', 'AI Legal Assistant')}
              </h2>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                {t('القانون الإماراتي · الفرنسي · الأوروبي', 'UAE · French · EU law')}
              </p>
            </div>
            {activeSession && (
              <button
                type="button"
                onClick={createSession}
                className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors shrink-0"
                aria-label={t('محادثة جديدة', 'New conversation')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4">
            {!activeSession ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 sm:gap-6 text-center" dir="rtl">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary/70" aria-hidden />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1 text-base sm:text-lg">
                    {t('ابدأ محادثة قانونية', 'Start a legal conversation')}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm px-4">
                    {t(
                      'المساعد يبحث في مكتبتك والمصادر القانونية ويستشهد بكل مصدر.',
                      'Searches your library and legal sources, citing every reference.',
                    )}
                  </p>
                </div>
                {canUseAi && (
                  <>
                    <Button className="gap-1.5 text-sm" onClick={createSession}>
                      <Plus className="w-4 h-4" />
                      {t('محادثة جديدة', 'New conversation')}
                    </Button>
                    <div className="w-full max-w-md px-2">
                      <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden" style={{ scrollbarWidth: 'none' }}>
                        {SUGGESTIONS.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => createSession()}
                            className="flex-none text-start text-xs px-3 py-2.5 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground whitespace-nowrap"
                          >
                            {t(s.ar, s.en)}
                          </button>
                        ))}
                      </div>
                      <div className="hidden sm:grid grid-cols-2 gap-2">
                        {SUGGESTIONS.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => createSession()}
                            className="text-start text-xs p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                          >
                            {t(s.ar, s.en)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center" dir="rtl">
                <Bot className="w-10 h-10 text-muted-foreground/30" aria-hidden />
                <p className="text-sm text-muted-foreground px-4">
                  {t('اطرح سؤالاً قانونياً للبدء', 'Ask a legal question to begin')}
                </p>
                <div className="w-full max-w-md px-2">
                  <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden" style={{ scrollbarWidth: 'none' }}>
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendMessage(t(s.ar, s.en))}
                        className="flex-none text-start text-xs px-3 py-2.5 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground whitespace-nowrap"
                      >
                        {t(s.ar, s.en)}
                      </button>
                    ))}
                  </div>
                  <div className="hidden sm:grid grid-cols-2 gap-2">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendMessage(t(s.ar, s.en))}
                        className="text-start text-xs p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                      >
                        {t(s.ar, s.en)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    displayMeta={msg.role === 'assistant' ? msgDisplayMetaMap[msg.id] : undefined}
                    onAction={handleAction}
                    actionDisabled={sending}
                  />
                ))}
                {sending && (
                  <div className="flex justify-end mb-3" dir="rtl">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-1 shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-se-none px-4 py-3 flex items-center gap-2 shadow-sm">
                      <span className="text-[11px] text-muted-foreground me-1">
                        {MODE_CONFIG[currentMode].ar}
                      </span>
                      <div className="flex gap-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* ─── Composer / input bar ──────────────────────────────── */}
          <div className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border/50 bg-card relative" dir="rtl">
            {/* Pin panel popup */}
            {showPinPanel && (
              <PinPanel
                docs={(documents ?? []) as Array<{ id: number; originalName?: string; filename?: string }>}
                sources={legalSources}
                pinnedDocs={pinnedDocs}
                pinnedSrcs={pinnedSrcs}
                onToggleDoc={toggleDoc}
                onToggleSrc={toggleSrc}
                onClose={() => setShowPinPanel(false)}
                t={t}
              />
            )}

            {/* Response mode selector */}
            {activeSession && (
              <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                <ResponseModeSelector
                  value={currentMode}
                  onChange={(m) => { setCurrentMode(m); setModeLocked(true); }}
                  disabled={sending || !canUseAi}
                />
                {modeLocked && (
                  <button
                    type="button"
                    onClick={() => { setModeLocked(false); if (input.trim()) setCurrentMode(detectMode(input)); else setCurrentMode('quick'); }}
                    className="text-[9px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {t('كشف تلقائي', 'Auto-detect')}
                  </button>
                )}
              </div>
            )}

            {/* Theory Lens Selector */}
            {activeSession && (
              <div className="mb-2">
                <TheoryLensSelector
                  value={theoryLens}
                  onChange={setTheoryLens}
                  arabic={true}
                  disabled={sending || !canUseAi}
                />
              </div>
            )}

            {/* Pinned badges */}
            {totalPinned > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pinnedDocs.map((id) => {
                  const d = documents?.find((x) => x.id === id);
                  return d ? (
                    <span key={id} className="flex items-center gap-1 bg-primary/8 border border-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full">
                      <FileText className="w-2.5 h-2.5 shrink-0" />
                      <span className="max-w-[80px] sm:max-w-[120px] truncate">{d.originalName ?? d.filename}</span>
                      <button type="button" onClick={() => toggleDoc(id)} className="shrink-0"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ) : null;
                })}
                {pinnedSrcs.map((id) => {
                  const s = legalSources.find((x) => x.id === id);
                  return s ? (
                    <span key={id} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2 py-0.5 rounded-full">
                      <BookOpen className="w-2.5 h-2.5 shrink-0" />
                      <span className="max-w-[80px] sm:max-w-[120px] truncate">{s.titleAr ?? s.title}</span>
                      <button type="button" onClick={() => toggleSrc(id)} className="shrink-0"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2">
              {/* Pin button */}
              <button
                type="button"
                onClick={() => setShowPinPanel((s) => !s)}
                disabled={!activeSession}
                className={`shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40 ${
                  totalPinned > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
                title={t('تثبيت مصادر', 'Pin sources')}
              >
                {totalPinned > 0 ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>

              <label className="sr-only" htmlFor="assistant-input">{t('رسالتك', 'Your message')}</label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                className="flex-1 resize-none border border-border rounded-xl px-3 py-2 sm:py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground min-w-0"
                placeholder={
                  !activeSession
                    ? t('أنشئ محادثة أولاً', 'Create a conversation first')
                    : totalPinned > 0
                    ? t('اكتب سؤالك...', 'Type your question...')
                    : t('اكتب سؤالك القانوني…', 'Type your legal question…')
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={!activeSession || !canUseAi}
                style={{ minHeight: '2.25rem', maxHeight: '7rem' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
                }}
              />
              <Button
                size="sm"
                className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl"
                onClick={() => sendMessage()}
                disabled={!input.trim() || !activeSession || sending || !canUseAi}
                aria-label={t('إرسال', 'Send')}
              >
                <Send className="w-4 h-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
