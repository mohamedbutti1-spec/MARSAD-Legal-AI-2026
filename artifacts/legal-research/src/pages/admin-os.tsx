/**
 * Administrative Decision Operating System — Al-Shamsi Theory
 * Phase 3: Full Frontend Workflow
 *
 * Screens: Role Selection → Decision Type Catalog → 12-Dim Interview → Brief
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import {
  Scale, Building2, Landmark, UserCheck, Users, Gavel, UserCircle,
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, XCircle, Clock, FileText,
  BookOpen, Copy, Check, Loader2, Send, Trash2, RotateCcw,
  Download, MessageSquare, X, Sparkles, Search, Info, Bot,
  ClipboardList, ShieldCheck, ShieldAlert, ArrowRight,
  Timer, ScrollText, ListChecks, AlertCircle, HelpCircle,
  Activity, Zap, Star, Globe, CircleDot, PanelLeft,
  BadgeCheck, TrendingUp, Eye, GitBranch, Cpu, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type DimensionStatus = 'compliant' | 'partial' | 'non-compliant' | 'unknown';
type CanIssue = 'yes' | 'no' | 'conditional';
type Screen = 'roles' | 'catalog' | 'interview' | 'loading' | 'brief';

interface DimensionResult {
  status: DimensionStatus;
  score: number;
  explanationAr: string;
  explanationEn: string;
  missingRequirements: string[];
  applicableLaw: string[];
}

interface AdminBrief {
  jurisdiction: DimensionResult;
  form: DimensionResult;
  cause: DimensionResult;
  subjectMatter: DimensionResult;
  purpose: DimensionResult;
  humanWill: DimensionResult;
  digitalWillFormation: DimensionResult;
  algorithmicWeight: DimensionResult;
  algorithmicBias: DimensionResult;
  explainability: DimensionResult;
  humanOversight: DimensionResult;
  judicialReviewReadiness: DimensionResult;
  canIssueToday: CanIssue;
  canIssueTodayRationale: string;
  legalityScore: number;
  riskScore: number;
  governmentAuthority: {
    nameAr: string; nameEn: string; department: string;
    website: string | null; phone: string | null; competenceBasis: string;
  };
  applicableLegislation: Array<{ token: string | null; articleAr: string; relevanceAr: string }>;
  courtPrecedents: Array<{ caseRef: string; courtAr: string; yearAr: string; principleAr: string }> | null;
  requiredDocuments: Array<{ nameAr: string; descriptionAr: string; mandatory: boolean }>;
  timeline: { steps: Array<{ step: number; titleAr: string; duration: string; actor: string }> };
  appealStrategy: { routes: Array<{ routeAr: string; deadlineAr: string; procedureAr: string }>; recommendationAr: string };
  algorithmExplanation: string;
  humanInterventionPoints: string[];
  citations?: Citation[];
}

interface AdminRole {
  id: number;
  roleKey: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  competenceCeiling: string;
  permittedDomains: string[];
  actionCapabilities: { canIssue: boolean; canReview: boolean; canChallenge: boolean };
  legalBasisAr: string;
  legalBasisEn: string;
}

interface AdminDecisionType {
  id: number;
  jurisdiction: string;
  domain: string;
  decisionTypeAr: string;
  decisionTypeEn: string;
  descriptionAr: string;
  requiredCompetenceLevel: string;
  inherentRiskLevel: string;
  applicableLaws: Array<{ lawAr: string; referenceNumber: string; articles?: string[] }>;
  roleRelationship?: string;
}

interface QuestionNode {
  id: string;
  dimensionTag: string;
  questionAr: string;
  questionEn: string;
  hintAr?: string;
  answerType: 'chips' | 'yes-no' | 'text' | 'number';
  options?: Array<{ value: string; labelAr: string; labelEn: string }>;
  required?: boolean;
  placeholder?: string;
  unit?: string;
}

interface SessionSummary {
  id: number;
  role: string;
  decisionTypeAr: string;
  decisionTypeEn: string;
  legalityScore: number;
  riskScore: number;
  canIssueToday: string;
  createdAt: string;
}

interface Citation {
  token: string;
  title: string;
  type: 'document' | 'legal_source';
  sourceId: number;
  formats?: { harvard: string; apa: string; uaeGov: string };
}

interface FollowupMessage { role: 'user' | 'assistant'; text: string; citations: Citation[]; }

// Phase 4 — Jurisdiction types

interface JurisdictionInfo {
  id: number;
  jurisdictionKey: string;
  nameAr: string;
  nameEn: string;
  legalSystem: string;
  active: boolean;
}

interface ComparisonDimension {
  key: string;
  labelAr: string;
  originalScore: number;
  originalStatus: string;
  targetScore: number;
  targetStatus: string;
  scoreDelta: number;
  differenceAr: string;
}

interface CompareResult {
  originalJurisdiction: string;
  targetJurisdiction: string;
  originalJurisdictionNameAr: string;
  targetJurisdictionNameAr: string;
  originalLegalityScore: number;
  targetLegalityScore: number;
  stricterJurisdiction: string;
  diff: Record<string, ComparisonDimension>;
  overallCompatibilityAr: string;
  keyDifferencesAr: string[];
  commonPrinciplesAr: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_ORDER = [
  'jurisdiction', 'cause', 'form', 'subjectMatter', 'purpose',
  'humanWill', 'digitalWillFormation', 'algorithmicWeight',
  'algorithmicBias', 'explainability', 'humanOversight', 'judicialReviewReadiness',
] as const;

type DimensionKey = typeof DIMENSION_ORDER[number];

const DIMENSION_META: Record<DimensionKey, { ar: string; en: string; weight: number; descriptionAr: string }> = {
  jurisdiction:          { ar: 'الاختصاص',                  en: 'Jurisdiction',          weight: 20, descriptionAr: 'هل الجهة مختصة قانوناً بإصدار هذا القرار؟' },
  cause:                 { ar: 'السبب',                      en: 'Cause',                 weight: 15, descriptionAr: 'هل القرار مبني على أسباب واقعية وقانونية صحيحة؟' },
  form:                  { ar: 'الشكل',                      en: 'Form',                  weight: 10, descriptionAr: 'هل استُوفي الشكل الرسمي والإجراءات المطلوبة قانوناً؟' },
  subjectMatter:         { ar: 'المحل',                      en: 'Subject Matter',        weight: 10, descriptionAr: 'هل محل القرار ممكن وجائز قانوناً ومحدد بدقة؟' },
  purpose:               { ar: 'الغاية',                     en: 'Purpose',               weight: 10, descriptionAr: 'هل الغاية من القرار مشروعة وتخدم المصلحة العامة؟' },
  humanWill:             { ar: 'الإرادة البشرية',            en: 'Human Will',            weight:  8, descriptionAr: 'هل القرار يعكس إرادة بشرية حرة ومسؤولة خالية من العيوب؟' },
  digitalWillFormation:  { ar: 'تكوين الإرادة الرقمية',     en: 'Digital Will Formation', weight: 5, descriptionAr: 'هل اتُّخذ القرار رقمياً وفق ضوابط سليمة وموثوقة؟' },
  algorithmicWeight:     { ar: 'الوزن الخوارزمي',            en: 'Algorithmic Weight',    weight:  5, descriptionAr: 'ما حجم مساهمة الذكاء الاصطناعي في هذا القرار؟' },
  algorithmicBias:       { ar: 'التحيز الخوارزمي',           en: 'Algorithmic Bias',      weight:  5, descriptionAr: 'هل النظام الخوارزمي خضع لاختبارات تحيز وأُثبتت عدالته؟' },
  explainability:        { ar: 'قابلية التفسير',             en: 'Explainability',        weight:  4, descriptionAr: 'هل يمكن تفسير القرار وتبريره بوضوح للمتضررين؟' },
  humanOversight:        { ar: 'الرقابة البشرية',            en: 'Human Oversight',       weight:  4, descriptionAr: 'هل توجد آليات رقابة بشرية فعّالة على عملية إصدار القرار؟' },
  judicialReviewReadiness: { ar: 'الجاهزية للمراجعة القضائية', en: 'Judicial Review Readiness', weight: 4, descriptionAr: 'هل القرار مُعدّ لمواجهة الطعن القضائي إذا ما طُعن فيه؟' },
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  government_official:   <Building2 className="w-6 h-6" />,
  minister:              <Landmark className="w-6 h-6" />,
  director_general:      <UserCheck className="w-6 h-6" />,
  hr:                    <Users className="w-6 h-6" />,
  legal_department:      <Scale className="w-6 h-6" />,
  administrative_court:  <Gavel className="w-6 h-6" />,
  citizen:               <UserCircle className="w-6 h-6" />,
};

const COMPETENCE_LABELS: Record<string, string> = {
  ministerial:      'صلاحية إصدار القرارات الوزارية',
  director_general: 'صلاحية إصدار قرارات المدير العام',
  department_head:  'صلاحية إصدار قرارات رئيس القسم',
  hr_officer:       'صلاحية إصدار قرارات الموارد البشرية',
  review_only:      'صلاحية المراجعة وإبداء الرأي القانوني',
  judicial_review:  'صلاحية المراجعة القضائية للقرارات الإدارية',
  challenge_only:   'حق الطعن والاستئناف في القرارات الإدارية',
};

const DOMAIN_META: Record<string, { ar: string; en: string }> = {
  personnel:   { ar: 'الموارد البشرية',    en: 'Personnel' },
  regulatory:  { ar: 'التنظيم والرقابة',   en: 'Regulatory' },
  procurement: { ar: 'المشتريات والعقود',  en: 'Procurement' },
  appeals:     { ar: 'التظلمات والطعون',   en: 'Appeals' },
  citizen:     { ar: 'الخدمات المواطنية',  en: 'Citizen Services' },
  digital:     { ar: 'القرارات الرقمية',   en: 'Digital Decisions' },
};

const RISK_CONFIG: Record<string, { ar: string; color: string; bg: string }> = {
  low:      { ar: 'خطر منخفض', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  medium:   { ar: 'خطر متوسط', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  high:     { ar: 'خطر مرتفع', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  critical: { ar: 'خطر حرج',   color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
};

const STATUS_CONFIG: Record<string, { ar: string; color: string }> = {
  'compliant':     { ar: 'ممتثل',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'partial':       { ar: 'ممتثل جزئياً', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'non-compliant': { ar: 'غير ممتثل',    color: 'bg-red-50 text-red-700 border-red-200' },
  'unknown':       { ar: 'غير محدد',     color: 'bg-gray-50 text-gray-600 border-gray-200' },
};

const RELATIONSHIP_CONFIG: Record<string, { ar: string; color: string }> = {
  can_issue:     { ar: 'يمكنك الإصدار',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  can_review:    { ar: 'صلاحية المراجعة', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  can_challenge: { ar: 'يمكن الطعن',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  none:          { ar: 'خارج النطاق',    color: 'bg-gray-50 text-gray-500 border-gray-200' },
};

// ─── Utility components ───────────────────────────────────────────────────────

function BriefSection({ title, icon, count, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; count?: number;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden" dir="rtl">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-start">
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

function ScoreRing({ score, label, size = 88 }: { score: number; label: string; size?: number }) {
  const strokeW = 9;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(Math.max(score, 0), 100) / 100) * circ;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  const textColor = score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={strokeW} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={strokeW} fill="none"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-black text-xl leading-none ${textColor}`}>{score}</span>
          <span className="text-[9px] text-muted-foreground font-medium">/100</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-muted-foreground text-center leading-tight max-w-[80px]">{label}</p>
    </div>
  );
}

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
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border
          ${isDoc ? 'bg-primary/10 text-primary border-primary/25' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
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
            {(Object.keys(FMT_LABELS) as CitFmt[]).map(f => (
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

// ─── Role Selection Screen ────────────────────────────────────────────────────

const ALSHAMSI_DIMENSIONS_BRIEF = [
  'الاختصاص', 'السبب', 'الشكل', 'المحل', 'الغاية', 'الإرادة البشرية',
  'تكوين الإرادة الرقمية', 'الوزن الخوارزمي', 'التحيز الخوارزمي',
  'قابلية التفسير', 'الرقابة البشرية', 'الجاهزية القضائية',
];

function RoleSelectionScreen({ roles, loading, onSelect }: {
  roles: AdminRole[]; loading: boolean; onSelect: (r: AdminRole) => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <div className="flex-1 overflow-y-auto" dir="rtl">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Scale className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">نظام القرارات الإدارية</h1>
            <p className="text-base text-muted-foreground font-medium mt-0.5">Al-Shamsi Administrative Decision OS</p>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            تقييم قانوني شامل لأي قرار إداري عبر 12 بُعداً من أبعاد نظرية الشمسي — قبل إصداره أو الطعن فيه.
          </p>
        </div>

        {/* Al-Shamsi info panel */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button type="button" onClick={() => setInfoOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors text-start">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">ما هي نظرية الشمسي؟</span>
            </div>
            {infoOpen ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
          </button>
          {infoOpen && (
            <div className="px-4 py-4 text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                نظرية الشمسي هي إطار قانوني متكامل لتقييم مشروعية القرارات الإدارية في دولة الإمارات العربية المتحدة.
                تُحلّل كل قرار إداري عبر <strong className="text-foreground">12 بُعداً قانونياً</strong> متكاملاً تغطي الجوانب الكلاسيكية للقانون الإداري
                وتُضيف إليها أبعاداً متخصصة في القرارات الرقمية والخوارزمية.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {ALSHAMSI_DIMENSIONS_BRIEF.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2.5 py-1.5">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium text-foreground">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Role grid */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">اختر دورك للبدء</p>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-36 rounded-2xl border border-border bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {roles.map(role => {
                const cap = role.actionCapabilities;
                const capLabel = cap.canIssue ? 'إصدار' : cap.canReview ? 'مراجعة' : 'طعن';
                const capColor = cap.canIssue ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : cap.canReview ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200';
                return (
                  <button key={role.roleKey} type="button" onClick={() => onSelect(role)}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all text-center group">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                      {ROLE_ICONS[role.roleKey] ?? <UserCircle className="w-6 h-6" />}
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-foreground leading-tight">{role.titleAr}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{role.titleEn}</p>
                      <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${capColor}`}>
                        {capLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Decision Type Catalog Screen ─────────────────────────────────────────────

function CatalogScreen({ role, decisionTypes, loading, onSelect, onBack, jurisdiction, availableJurisdictions, onJurisdictionChange }: {
  role: AdminRole;
  decisionTypes: AdminDecisionType[];
  loading: boolean;
  onSelect: (dt: AdminDecisionType) => void;
  onBack: () => void;
  jurisdiction: string;
  availableJurisdictions: JurisdictionInfo[];
  onJurisdictionChange: (key: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [activeDomain, setActiveDomain] = useState<string>('all');

  // Reset domain filter when jurisdiction changes
  React.useEffect(() => { setActiveDomain('all'); }, [jurisdiction]);

  const domains = ['all', ...Array.from(new Set(decisionTypes.map(dt => dt.domain)))];

  const filtered = decisionTypes.filter(dt => {
    const matchesDomain = activeDomain === 'all' || dt.domain === activeDomain;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q
      || dt.decisionTypeAr.includes(q)
      || dt.decisionTypeEn.toLowerCase().includes(q)
      || dt.descriptionAr.includes(q);
    return matchesDomain && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
      {/* Top controls */}
      <div className="px-3 sm:px-4 py-3 border-b border-border bg-muted/20 shrink-0 space-y-3">
        {/* Role context */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            {ROLE_ICONS[role.roleKey] ?? <UserCircle className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-foreground">{role.titleAr}</p>
            <p className="text-[11px] text-muted-foreground truncate">{COMPETENCE_LABELS[role.competenceCeiling] ?? role.competenceCeiling}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{filtered.length} قرار</span>
        </div>

        {/* Jurisdiction selector — shown when more than one active jurisdiction */}
        {availableJurisdictions.length > 1 && (
          <div className="flex gap-1.5">
            {availableJurisdictions.map(j => (
              <button key={j.jurisdictionKey} type="button"
                onClick={() => onJurisdictionChange(j.jurisdictionKey)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${
                  jurisdiction === j.jurisdictionKey
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}>
                <Globe className="w-3 h-3" />
                {j.jurisdictionKey === 'uae' ? 'الإمارات 🇦🇪' : j.jurisdictionKey === 'france' ? 'فرنسا 🇫🇷' : j.nameAr}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث في أنواع القرارات..."
            className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Domain tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {domains.map(d => (
            <button key={d} type="button" onClick={() => setActiveDomain(d)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                activeDomain === d
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}>
              {d === 'all' ? 'الكل' : DOMAIN_META[d]?.ar ?? d}
            </button>
          ))}
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-border bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">لا توجد نتائج مطابقة</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(dt => {
              const risk = RISK_CONFIG[dt.inherentRiskLevel] ?? RISK_CONFIG.medium;
              const rel = dt.roleRelationship ? RELATIONSHIP_CONFIG[dt.roleRelationship] : null;
              const domainLabel = DOMAIN_META[dt.domain]?.ar ?? dt.domain;
              return (
                <button key={dt.id} type="button" onClick={() => onSelect(dt)}
                  className="w-full text-start flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 hover:shadow-sm transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-tight">{dt.decisionTypeAr}</p>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${risk.bg} ${risk.color}`}>
                          {risk.ar}
                        </span>
                        {rel && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${rel.color}`}>
                            {rel.ar}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mb-1.5">{dt.decisionTypeEn}</p>
                    {dt.descriptionAr && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{dt.descriptionAr}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">{domainLabel}</span>
                      {dt.applicableLaws?.[0] && (
                        <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                          {dt.applicableLaws[0].referenceNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 12-Dimension Interview Screen ────────────────────────────────────────────

function InterviewScreen({ role, decisionType, questions, answers, onAnswer, onAssess, assessing, questionsLoading }: {
  role: AdminRole;
  decisionType: AdminDecisionType;
  questions: QuestionNode[];
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  onAssess: () => void;
  assessing: boolean;
  questionsLoading: boolean;
}) {
  // Group questions by dimensionTag following DIMENSION_ORDER
  const groups = DIMENSION_ORDER
    .map(tag => ({ tag, meta: DIMENSION_META[tag], qs: questions.filter(q => q.dimensionTag === tag) }))
    .filter(g => g.qs.length > 0);

  const [dimIdx, setDimIdx] = useState(0);
  const currentGroup = groups[dimIdx];

  // Check if all required questions in a group are answered
  function isGroupComplete(g: typeof groups[0]): boolean {
    return g.qs.every(q => !q.required || !!answers[q.id]);
  }

  const allRequiredAnswered = groups.every(g =>
    g.qs.every(q => !q.required || !!answers[q.id])
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  function goNext() {
    if (dimIdx < groups.length - 1) {
      setDimIdx(i => i + 1);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goPrev() {
    if (dimIdx > 0) {
      setDimIdx(i => i - 1);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const completedCount = groups.filter(g => isGroupComplete(g)).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">

      {/* Dimension stepper */}
      <div className="px-3 py-3 border-b border-border bg-muted/10 shrink-0">
        {/* Progress summary */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-bold text-foreground">{decisionType.decisionTypeAr}</p>
            <p className="text-[10px] text-muted-foreground">{role.titleAr}</p>
          </div>
          <div className="text-start">
            <p className="text-[10px] text-muted-foreground">الأبعاد المكتملة</p>
            <p className="text-xs font-bold text-foreground">{completedCount}/{groups.length}</p>
          </div>
        </div>

        {/* Stepper dots — scrollable row */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {groups.map((g, i) => {
            const done = isGroupComplete(g);
            const active = i === dimIdx;
            return (
              <button key={g.tag} type="button" onClick={() => { setDimIdx(i); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                title={g.meta.ar}
                className={`flex flex-col items-center gap-0.5 min-w-[3.5rem] px-1 py-1.5 rounded-lg transition-all border ${
                  active ? 'border-primary bg-primary/10' :
                  done   ? 'border-emerald-200 bg-emerald-50/60' :
                           'border-border bg-muted/30 hover:border-border/80'
                }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                  active ? 'bg-primary text-primary-foreground' :
                  done   ? 'bg-emerald-500 text-white' :
                           'bg-muted-foreground/20 text-muted-foreground'
                }`}>
                  {done && !active ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight line-clamp-2 ${
                  active ? 'text-primary' : done ? 'text-emerald-700' : 'text-muted-foreground'
                }`} style={{ maxWidth: '3rem' }}>
                  {g.meta.ar}
                </span>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((dimIdx + 1) / groups.length) * 100}%` }} />
        </div>
      </div>

      {/* Questions area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4" ref={scrollRef}>

        {/* Dimension header */}
        {currentGroup && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <span className="text-sm font-black">{dimIdx + 1}</span>
              </div>
              <div>
                <p className="font-black text-base text-foreground">{currentGroup.meta.ar}</p>
                <p className="text-xs text-primary/80 font-medium">{currentGroup.meta.en} · وزن {currentGroup.meta.weight}%</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{currentGroup.meta.descriptionAr}</p>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {currentGroup?.qs.map(q => (
          <QuestionCard key={q.id} q={q} value={answers[q.id] ?? ''} onChange={v => onAnswer(q.id, v)} dimMeta={currentGroup.meta} />
        ))}
      </div>

      {/* Navigation footer */}
      <div className="px-3 sm:px-4 py-3 border-t border-border bg-background shrink-0 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={dimIdx === 0} className="gap-1.5">
          <ChevronRight className="w-4 h-4" />
          السابق
        </Button>

        <div className="flex-1" />

        {dimIdx < groups.length - 1 ? (
          <Button size="sm" onClick={goNext} disabled={!isGroupComplete(currentGroup!)} className="gap-1.5">
            التالي
            <ChevronLeft className="w-4 h-4" />
          </Button>
        ) : null}

        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          disabled={!allRequiredAnswered || assessing || questionsLoading}
          onClick={onAssess}
        >
          {assessing ? <Loader2 className="w-4 h-4 animate-spin" /> : questionsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {assessing ? 'جارٍ التقييم...' : questionsLoading ? 'جارٍ التحميل...' : 'تقييم القرار'}
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({ q, value, onChange, dimMeta }: {
  q: QuestionNode;
  value: string;
  onChange: (v: string) => void;
  dimMeta: typeof DIMENSION_META[DimensionKey];
}) {
  const [textVal, setTextVal] = useState(value);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  useEffect(() => { setTextVal(value); }, [value]);

  return (
    <div className={`bg-card border rounded-xl p-4 transition-all ${value ? 'border-primary/30' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-relaxed">
            {q.questionAr}
            {q.required && <span className="text-red-500 ms-1 text-xs">*</span>}
          </p>
          {q.hintAr && <p className="text-xs text-muted-foreground mt-0.5">{q.hintAr}</p>}
        </div>
        {/* Why is this asked? tooltip */}
        <div className="relative shrink-0">
          <button type="button" onClick={() => setTooltipOpen(o => !o)}
            className="text-muted-foreground/50 hover:text-primary transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
          {tooltipOpen && (
            <div className="absolute z-30 top-full mt-1 end-0 w-56 bg-card border border-border rounded-xl shadow-lg p-3 text-xs leading-relaxed text-muted-foreground" dir="rtl">
              <p className="font-bold text-foreground mb-1">{dimMeta.ar}</p>
              <p>{dimMeta.descriptionAr}</p>
              <button type="button" onClick={() => setTooltipOpen(false)} className="mt-1.5 text-primary hover:underline text-[10px]">إغلاق</button>
            </div>
          )}
        </div>
      </div>

      {q.answerType === 'yes-no' && (
        <div className="flex gap-2">
          {['yes', 'no'].map(v => (
            <button key={v} type="button" onClick={() => onChange(v)}
              className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                value === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/20 text-foreground hover:border-primary/50'
              }`}>
              {v === 'yes' ? '✓ نعم' : '✗ لا'}
            </button>
          ))}
        </div>
      )}

      {q.answerType === 'chips' && q.options && (
        <div className="flex flex-wrap gap-2">
          {q.options.map(opt => (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
              className={`px-3 py-2 rounded-xl border-2 font-medium text-sm transition-all text-start ${
                value === opt.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50'
              }`}>
              {opt.labelAr}
            </button>
          ))}
        </div>
      )}

      {q.answerType === 'text' && (
        <textarea value={textVal} rows={3} placeholder={q.placeholder ?? 'اكتب إجابتك هنا...'}
          onChange={e => setTextVal(e.target.value)}
          onBlur={() => onChange(textVal)}
          className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
      )}

      {q.answerType === 'number' && (
        <div className="flex items-center gap-2">
          <input type="number" value={textVal} placeholder={q.placeholder ?? '0'}
            onChange={e => setTextVal(e.target.value)}
            onBlur={() => onChange(textVal)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          {q.unit && <span className="text-sm text-muted-foreground shrink-0">{q.unit}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen({ activeDims }: { activeDims: string[] }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 pt-8 pb-4 overflow-y-auto" dir="rtl">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Scale className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-foreground">جارٍ تقييم القرار الإداري</h2>
          <p className="text-sm text-muted-foreground">يحلّل النظام قرارك عبر 12 بُعداً من أبعاد نظرية الشمسي</p>
        </div>

        {/* Dimension animation list */}
        <div className="space-y-2">
          {DIMENSION_ORDER.map((key, i) => {
            const meta = DIMENSION_META[key];
            const isActive = activeDims.includes(key);
            const isProcessing = !isActive && i === activeDims.length;
            return (
              <div key={key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-500 ${
                isActive ? 'border-emerald-200 bg-emerald-50' :
                isProcessing ? 'border-primary/40 bg-primary/5' :
                'border-border/50 bg-muted/10 opacity-50'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  isActive ? 'bg-emerald-500 text-white' :
                  isProcessing ? 'bg-primary/20 text-primary' :
                  'bg-muted/50 text-muted-foreground'
                }`}>
                  {isActive ? <Check className="w-4 h-4" /> :
                   isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   <span className="text-[10px] font-black">{i + 1}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-emerald-800' : isProcessing ? 'text-primary' : 'text-muted-foreground'}`}>
                    {meta.ar}
                  </p>
                  <p className={`text-[10px] leading-tight ${isActive ? 'text-emerald-600' : 'text-muted-foreground/60'}`}>
                    {meta.en}
                  </p>
                </div>
                <span className={`text-[10px] font-bold shrink-0 ${isActive ? 'text-emerald-600' : isProcessing ? 'text-primary' : 'text-muted-foreground/40'}`}>
                  {isActive ? 'اكتمل ✓' : isProcessing ? 'جارٍ...' : `${meta.weight}%`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground">
          عادةً ما يستغرق التقييم الشامل 15–20 ثانية
        </p>
      </div>
    </div>
  );
}

// ─── 12-Dimension Card ────────────────────────────────────────────────────────

function DimensionCard({ dimKey, result, dimIndex }: {
  dimKey: string; result: DimensionResult; dimIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = DIMENSION_META[dimKey as DimensionKey];
  const st = STATUS_CONFIG[result.status] ?? STATUS_CONFIG['unknown'];
  const scoreColor = result.score >= 80 ? 'text-emerald-700' : result.score >= 60 ? 'text-amber-700' : 'text-red-700';
  const cardBg = result.status === 'compliant' ? 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40'
    : result.status === 'partial' ? 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40'
    : result.status === 'non-compliant' ? 'border-red-200 bg-red-50/20 hover:bg-red-50/40'
    : 'border-border bg-muted/10 hover:bg-muted/20';

  return (
    <div className={`rounded-xl border transition-all ${cardBg}`}>
      <button type="button" onClick={() => setExpanded(o => !o)}
        className="w-full text-start px-3 py-3 flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
          result.status === 'compliant' ? 'bg-emerald-100 text-emerald-700' :
          result.status === 'partial' ? 'bg-amber-100 text-amber-700' :
          result.status === 'non-compliant' ? 'bg-red-100 text-red-700' :
          'bg-muted text-muted-foreground'
        }`}>{dimIndex + 1}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-sm text-foreground">{meta?.ar ?? dimKey}</p>
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${st.color}`}>
              {st.ar}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">{meta?.en ?? dimKey}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xl font-black ${scoreColor}`}>{result.score}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/40 mt-0 pt-3">
          <p className="text-sm text-foreground leading-relaxed">{result.explanationAr}</p>
          {result.missingRequirements?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-700 mb-1.5 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> المتطلبات الناقصة
              </p>
              <ul className="space-y-1">
                {result.missingRequirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-red-700/90">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0" />{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.applicableLaw?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> المراجع القانونية
              </p>
              <ul className="space-y-1">
                {result.applicableLaw.map((law, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CircleDot className="w-3 h-3 mt-0.5 shrink-0 text-primary/50" />{law}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.explanationEn && (
            <p className="text-xs text-muted-foreground/70 italic leading-relaxed border-t border-border/40 pt-2">{result.explanationEn}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Verdict Banner ───────────────────────────────────────────────────────────

function VerdictBanner({ canIssue, rationale }: { canIssue: CanIssue; rationale: string }) {
  const configs: Record<CanIssue, { icon: React.ReactNode; label: string; bg: string; text: string }> = {
    yes: {
      icon: <CheckCircle2 className="w-8 h-8 shrink-0" />,
      label: 'يمكن إصدار هذا القرار اليوم',
      bg: 'bg-gradient-to-r from-emerald-600 to-emerald-500 border-emerald-700',
      text: 'text-white',
    },
    no: {
      icon: <XCircle className="w-8 h-8 shrink-0" />,
      label: 'لا يمكن إصدار هذا القرار اليوم',
      bg: 'bg-gradient-to-r from-red-700 to-red-600 border-red-800',
      text: 'text-white',
    },
    conditional: {
      icon: <AlertTriangle className="w-8 h-8 shrink-0" />,
      label: 'يمكن الإصدار بشروط',
      bg: 'bg-gradient-to-r from-amber-600 to-amber-500 border-amber-700',
      text: 'text-white',
    },
  };
  const c = configs[canIssue] ?? configs.conditional;
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${c.bg}`} dir="rtl">
      <div className="flex items-start gap-3">
        <div className={c.text}>{c.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`font-black text-xl sm:text-2xl leading-tight ${c.text}`}>{c.label}</p>
          {rationale && (
            <p className={`mt-2 text-sm leading-relaxed ${c.text} opacity-90`}>{rationale}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Administrative Decision Brief Screen ─────────────────────────────────────

function BriefScreen({ brief, role, decisionType, sessionId, citations, onReset, t, jurisdiction, onCompare, comparing, compareResult, canUseAi }: {
  brief: AdminBrief;
  role: AdminRole;
  decisionType: AdminDecisionType;
  sessionId: number | null;
  citations: Citation[];
  onReset: () => void;
  t: (ar: string, en: string) => string;
  jurisdiction: string;
  onCompare: () => void;
  comparing: boolean;
  compareResult: CompareResult | null;
  canUseAi: boolean;
}) {
  const [followups, setFollowups] = useState<FollowupMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [followups]);

  async function sendFollowup() {
    const text = input.trim();
    if (!text || !sessionId || sending) return;
    setInput('');
    setSending(true);
    setFollowups(prev => [...prev, { role: 'user', text, citations: [] }]);
    try {
      const r = await apiFetch('/api/admin-os/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (r.ok) {
        const data = await r.json();
        setFollowups(prev => [...prev, { role: 'assistant', text: data.text, citations: data.citations ?? [] }]);
      } else {
        toast({ title: 'فشل الإرسال', variant: 'destructive' });
        setFollowups(prev => prev.slice(0, -1));
      }
    } finally { setSending(false); }
  }

  const showAppealStrategy = role.roleKey === 'citizen' || role.roleKey === 'legal_department';

  function parseLegText(text: string) {
    if (!citations.length) return text;
    const pattern = /\[(DOC|SRC):\d+\]/g;
    const parts: React.ReactNode[] = [];
    let last = 0; let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const cit = citations.find(c => c.token === m![0]);
      parts.push(<MiniCitationChip key={m.index} token={m[0]} citation={cit} />);
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
  }

  return (
    <div className="flex-1 overflow-y-auto" dir="rtl">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-4">

        {/* Header toolbar */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{role.titleAr} · {decisionType.decisionTypeAr}</p>
            <h1 className="text-xl font-black text-foreground">التقرير القانوني الإداري</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm"
              onClick={() => { setExporting(true); toast({ title: 'تصدير PDF', description: 'سيتوفر هذا في المرحلة الخامسة من نظام القرارات الإدارية.' }); setTimeout(() => setExporting(false), 1500); }}
              disabled={exporting} className="gap-1.5 text-xs">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {t('تصدير PDF', 'Export PDF')}
            </Button>
            <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" />
              {t('تقييم جديد', 'New Assessment')}
            </Button>
          </div>
        </div>

        {/* Verdict banner */}
        <VerdictBanner canIssue={brief.canIssueToday} rationale={brief.canIssueTodayRationale} />

        {/* Score rings */}
        <div className="flex items-center justify-around sm:justify-start sm:gap-12 bg-card border border-border rounded-xl px-4 py-5">
          <ScoreRing score={brief.legalityScore ?? 0} label="درجة المشروعية القانونية" />
          <div className="w-px h-16 bg-border" />
          <ScoreRing score={brief.riskScore ?? 0} label="درجة الخطورة القانونية" />
          {canUseAi && (jurisdiction === 'uae' || jurisdiction === 'france') && (
            <div className="hidden sm:flex flex-col justify-center me-auto pe-4 border-r border-border/0 items-end gap-1 flex-1">
              <Button onClick={onCompare} disabled={comparing} variant="outline" size="sm" className="gap-2 text-xs shrink-0 ms-auto">
                {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5 text-primary" />}
                {jurisdiction === 'uae' ? 'مقارنة مع القانون الفرنسي 🇫🇷' : 'مقارنة مع القانون الإماراتي 🇦🇪'}
              </Button>
            </div>
          )}
          <div className="hidden sm:flex flex-1 flex-col gap-1 text-xs text-muted-foreground ps-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span>80–100 ممتاز</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span>60–79 مقبول بتحفظ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <span>أقل من 60 مخاطر مرتفعة</span>
            </div>
          </div>
        </div>

        {/* Mobile compare button */}
        {canUseAi && (jurisdiction === 'uae' || jurisdiction === 'france') && (
          <div className="sm:hidden">
            <Button onClick={onCompare} disabled={comparing} variant="outline" size="sm" className="w-full gap-2 text-xs">
              {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5 text-primary" />}
              {jurisdiction === 'uae' ? 'مقارنة مع القانون الفرنسي 🇫🇷' : 'مقارنة مع القانون الإماراتي 🇦🇪'}
            </Button>
          </div>
        )}

        {/* Comparison panel — Phase 4 */}
        {compareResult && <ComparisonPanel result={compareResult} />}

        {/* ═══ 12-Dimension Grid ═══ */}
        <BriefSection title="التحليل الشامل — 12 أبعاد نظرية الشمسي" icon={<Activity className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DIMENSION_ORDER.map((key, i) => {
              const result = brief[key as keyof AdminBrief] as DimensionResult | undefined;
              if (!result || typeof result !== 'object' || !('status' in result)) return null;
              return <DimensionCard key={key} dimKey={key} result={result} dimIndex={i} />;
            })}
          </div>
        </BriefSection>

        {/* Applicable legislation */}
        {brief.applicableLegislation?.length > 0 && (
          <BriefSection title="التشريعات الإماراتية المنطبقة" icon={<ScrollText className="w-4 h-4" />} count={brief.applicableLegislation.length}>
            <div className="space-y-3">
              {brief.applicableLegislation.map((item, i) => (
                <div key={i} className="border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-foreground flex-1">
                      {item.token && <MiniCitationChip token={item.token} citation={citations.find(c => c.token === item.token)} />}
                      {' '}{item.articleAr}
                    </p>
                  </div>
                  {item.relevanceAr && <p className="text-xs text-muted-foreground mt-0.5 ms-5 leading-relaxed">{item.relevanceAr}</p>}
                </div>
              ))}
            </div>
          </BriefSection>
        )}

        {/* Court precedents */}
        {brief.courtPrecedents && brief.courtPrecedents.length > 0 && (
          <BriefSection title="السوابق القضائية الإدارية" icon={<Gavel className="w-4 h-4" />} count={brief.courtPrecedents.length}>
            <div className="space-y-3">
              {brief.courtPrecedents.map((p, i) => (
                <div key={i} className="bg-muted/20 rounded-xl p-3 border border-border/50">
                  <div className="flex items-start gap-2 mb-1">
                    <BadgeCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-foreground">{p.caseRef} — {p.courtAr}</p>
                      {p.yearAr && <p className="text-[10px] text-muted-foreground">{p.yearAr}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ms-6 leading-relaxed">{p.principleAr}</p>
                </div>
              ))}
            </div>
          </BriefSection>
        )}

        {/* Required documents */}
        {brief.requiredDocuments?.length > 0 && (
          <BriefSection title="الوثائق والمستندات المطلوبة" icon={<ClipboardList className="w-4 h-4" />} count={brief.requiredDocuments.length}>
            <div className="space-y-2.5">
              {brief.requiredDocuments.map((doc, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${doc.mandatory ? 'border-red-200 bg-red-50/30' : 'border-border bg-muted/10'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${doc.mandatory ? 'border-red-400 bg-white' : 'border-border bg-white'}`}>
                    {doc.mandatory && <span className="text-red-500 text-[8px] font-black">!</span>}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${doc.mandatory ? 'text-red-800' : 'text-foreground'}`}>{doc.nameAr}</p>
                    {doc.descriptionAr && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{doc.descriptionAr}</p>}
                    {doc.mandatory && <p className="text-[10px] text-red-600 font-bold mt-1">إلزامي</p>}
                  </div>
                </div>
              ))}
            </div>
          </BriefSection>
        )}

        {/* Government authority */}
        {brief.governmentAuthority?.nameAr && (
          <BriefSection title="الجهة الحكومية المختصة وسلسلة التفويض" icon={<Building2 className="w-4 h-4" />}>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="font-black text-blue-900 text-base">{brief.governmentAuthority.nameAr}</p>
              {brief.governmentAuthority.nameEn && <p className="text-xs text-blue-700">{brief.governmentAuthority.nameEn}</p>}
              {brief.governmentAuthority.department && <p className="text-sm text-blue-800">📋 {brief.governmentAuthority.department}</p>}
              {brief.governmentAuthority.competenceBasis && (
                <div className="pt-2 border-t border-blue-200">
                  <p className="text-xs font-bold text-blue-800 mb-0.5">أساس الاختصاص القانوني:</p>
                  <p className="text-xs text-blue-700 leading-relaxed">{brief.governmentAuthority.competenceBasis}</p>
                </div>
              )}
              {brief.governmentAuthority.website && (
                <a href={brief.governmentAuthority.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-700 hover:underline">
                  <Globe className="w-3 h-3" />{brief.governmentAuthority.website}
                </a>
              )}
            </div>
          </BriefSection>
        )}

        {/* Timeline */}
        {brief.timeline?.steps?.length > 0 && (
          <BriefSection title="الجدول الزمني القانوني والمواعيد النظامية" icon={<Timer className="w-4 h-4" />} count={brief.timeline.steps.length}>
            <div className="space-y-0">
              {brief.timeline.steps.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shrink-0">
                      {step.step}
                    </div>
                    {i < brief.timeline.steps.length - 1 && (
                      <div className="w-0.5 bg-border flex-1 mt-1 mb-1 min-h-[1.5rem]" />
                    )}
                  </div>
                  <div className={`flex-1 ${i === brief.timeline.steps.length - 1 ? 'pb-0' : 'pb-4'}`}>
                    <p className="text-sm font-semibold text-foreground">{step.titleAr}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {step.duration && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />{step.duration}
                        </span>
                      )}
                      {step.actor && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{step.actor}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </BriefSection>
        )}

        {/* Appeal strategy — citizen + legal_department only */}
        {showAppealStrategy && brief.appealStrategy?.routes?.length > 0 && (
          <BriefSection title="مسارات الطعن والاستئناف" icon={<GitBranch className="w-4 h-4" />} count={brief.appealStrategy.routes.length} defaultOpen={role.roleKey === 'citizen'}>
            <div className="space-y-3">
              {brief.appealStrategy.recommendationAr && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-medium leading-relaxed">
                  {brief.appealStrategy.recommendationAr}
                </div>
              )}
              <div className="space-y-2.5">
                {brief.appealStrategy.routes.map((route, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/10">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{route.routeAr}</p>
                      {route.deadlineAr && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />{route.deadlineAr}
                        </p>
                      )}
                      {route.procedureAr && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{route.procedureAr}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BriefSection>
        )}

        {/* Algorithm explanation */}
        {brief.algorithmExplanation && (
          <BriefSection title="كيف تمّ التقييم — الشفافية الخوارزمية" icon={<Cpu className="w-4 h-4" />} defaultOpen={false}>
            <p className="text-sm text-muted-foreground leading-relaxed">{brief.algorithmExplanation}</p>
          </BriefSection>
        )}

        {/* Human intervention points */}
        {brief.humanInterventionPoints?.length > 0 && (
          <BriefSection title="نقاط التدخل البشري الإلزامية" icon={<Eye className="w-4 h-4" />} count={brief.humanInterventionPoints.length} defaultOpen={false}>
            <div className="space-y-2">
              {brief.humanInterventionPoints.map((pt, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900 leading-relaxed">{pt}</p>
                </div>
              ))}
            </div>
          </BriefSection>
        )}

        {/* Follow-up chat */}
        <div className="border border-border rounded-xl overflow-hidden" dir="rtl">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">استفسارات متابعة قانونية</span>
          </div>
          {followups.length > 0 && (
            <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
              {followups.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-muted border border-border' : 'bg-primary text-primary-foreground'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-end">
                  <div className="bg-primary/10 rounded-xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
          <div className="p-3 border-t border-border/50 flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendFollowup(); }}
              placeholder="اسأل سؤالاً قانونياً متابعاً..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
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

// ─── History Sidebar (desktop) ────────────────────────────────────────────────

const VERDICT_ICONS: Record<string, React.ReactNode> = {
  yes:         <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />,
  no:          <XCircle className="w-3 h-3 text-red-500 shrink-0" />,
  conditional: <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />,
};

function HistorySidebar({ sessions, onSelect, onDelete, currentId, t }: {
  sessions: SessionSummary[]; onSelect: (s: SessionSummary) => void;
  onDelete: (id: number) => void; currentId: number | null;
  t: (ar: string, en: string) => string;
}) {
  return (
    <div className="hidden md:flex flex-col w-60 border-s border-border shrink-0 bg-muted/10" dir="rtl">
      <div className="px-3 py-3 border-b border-border/50 shrink-0">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('التقييمات السابقة', 'Past Assessments')}</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">لا توجد تقييمات</p>
        ) : sessions.map(s => (
          <div key={s.id}
            className={`flex items-center rounded-lg border text-xs group ${currentId === s.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-muted/30'}`}>
            <button type="button" onClick={() => onSelect(s)}
              className={`flex-1 text-start px-2.5 py-2 min-w-0 ${currentId === s.id ? 'text-foreground' : 'text-muted-foreground'}`}>
              <div className="flex items-center gap-1.5">
                {VERDICT_ICONS[s.canIssueToday] ?? VERDICT_ICONS.conditional}
                <span className="truncate font-medium">{s.decisionTypeAr}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {new Date(s.createdAt).toLocaleDateString('ar-AE')} · {s.legalityScore}/100
              </p>
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

function HistoryDrawer({ open, sessions, onSelect, onDelete, onClose, t }: {
  open: boolean; sessions: SessionSummary[];
  onSelect: (s: SessionSummary) => void; onDelete: (id: number) => void;
  onClose: () => void; t: (ar: string, en: string) => string;
}) {
  return (
    <>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={onClose} />}
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
          ) : sessions.map(s => (
            <div key={s.id} className="flex items-center rounded-xl border border-transparent hover:border-border hover:bg-muted/20 group">
              <button type="button" onClick={() => { onSelect(s); onClose(); }}
                className="flex-1 text-start px-3 py-2.5 min-w-0">
                <div className="flex items-center gap-2">
                  {VERDICT_ICONS[s.canIssueToday] ?? VERDICT_ICONS.conditional}
                  <span className="text-xs font-medium text-foreground truncate">{s.decisionTypeAr}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString('ar-AE')} · مشروعية {s.legalityScore}/100
                </p>
              </button>
              <button type="button" onClick={() => onDelete(s.id)}
                className="shrink-0 pe-2 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-0.5">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Phase 4: Cross-Jurisdiction Comparison Panel ─────────────────────────────

const STATUS_CHIP: Record<string, { bg: string; icon: React.ReactNode }> = {
  compliant:     { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  partial:       { bg: 'bg-amber-50 text-amber-700 border-amber-200',      icon: <AlertTriangle className="w-3 h-3" /> },
  'non-compliant': { bg: 'bg-red-50 text-red-700 border-red-200',          icon: <XCircle className="w-3 h-3" /> },
  unknown:       { bg: 'bg-muted text-muted-foreground border-border',      icon: <HelpCircle className="w-3 h-3" /> },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CHIP[status] ?? STATUS_CHIP.unknown;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.bg}`}>
      {cfg.icon}
    </span>
  );
}

function ComparisonPanel({ result }: { result: CompareResult }) {
  const [expanded, setExpanded] = useState(false);
  const DIMENSION_ORDER_COMPARE = [
    'jurisdiction', 'cause', 'form', 'subjectMatter', 'purpose',
    'humanWill', 'digitalWillFormation', 'algorithmicWeight',
    'algorithmicBias', 'explainability', 'humanOversight', 'judicialReviewReadiness',
  ];

  const overallDelta = result.targetLegalityScore - result.originalLegalityScore;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-primary/20 flex items-center gap-3">
        <GitBranch className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">التحليل القانوني المقارن</p>
          <p className="text-[11px] text-muted-foreground">
            {result.originalJurisdictionNameAr} ↔ {result.targetJurisdictionNameAr}
          </p>
        </div>
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline shrink-0">
          {expanded ? 'إخفاء' : 'عرض التفاصيل'}
        </button>
      </div>

      {/* Score summary */}
      <div className="px-4 py-3 flex items-center gap-4">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{result.originalJurisdictionNameAr}</p>
          <p className={`text-xl font-black ${result.originalLegalityScore >= 80 ? 'text-emerald-600' : result.originalLegalityScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {result.originalLegalityScore}
          </p>
          <p className="text-[9px] text-muted-foreground">/100 مشروعية</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${overallDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {overallDelta >= 0 ? '+' : ''}{overallDelta}
          </span>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">{result.targetJurisdictionNameAr}</p>
          <p className={`text-xl font-black ${result.targetLegalityScore >= 80 ? 'text-emerald-600' : result.targetLegalityScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {result.targetLegalityScore}
          </p>
          <p className="text-[9px] text-muted-foreground">/100 مشروعية</p>
        </div>
      </div>

      {/* Overall compatibility */}
      <div className="px-4 pb-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{result.overallCompatibilityAr}</p>
      </div>

      {/* Detailed dimension table */}
      {expanded && (
        <div className="border-t border-primary/20">
          {/* Dimension rows */}
          <div className="divide-y divide-border/50">
            {DIMENSION_ORDER_COMPARE.map(key => {
              const dim = result.diff[key];
              if (!dim) return null;
              const delta = dim.scoreDelta;
              return (
                <div key={key} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                  <p className="w-28 sm:w-36 shrink-0 text-foreground font-medium truncate">{dim.labelAr}</p>
                  <div className="flex items-center gap-1.5">
                    <StatusChip status={dim.originalStatus} />
                    <span className="text-muted-foreground font-mono">{dim.originalScore}</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-1.5">
                    <StatusChip status={dim.targetStatus} />
                    <span className="text-muted-foreground font-mono">{dim.targetScore}</span>
                  </div>
                  <span className={`ms-auto shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    delta >= 5 ? 'bg-emerald-50 text-emerald-700' : delta <= -5 ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground'
                  }`}>
                    {delta >= 0 ? '+' : ''}{delta}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Key differences */}
          {result.keyDifferencesAr.length > 0 && (
            <div className="px-4 py-3 border-t border-primary/20">
              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                أبرز الفجوات القانونية
              </p>
              <ul className="space-y-1">
                {result.keyDifferencesAr.map((d, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-amber-500 shrink-0">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Common principles */}
          {result.commonPrinciplesAr.length > 0 && (
            <div className="px-4 py-3 border-t border-primary/20">
              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                مبادئ مشتركة في كلا النظامين
              </p>
              <ul className="space-y-1">
                {result.commonPrinciplesAr.map((p, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-emerald-500 shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function AdminOs() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const { toast } = useToast();

  const [screen, setScreen] = useState<Screen>('roles');
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [decisionTypes, setDecisionTypes] = useState<AdminDecisionType[]>([]);
  const [dtLoading, setDtLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionNode[]>([]);
  const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null);
  const [selectedType, setSelectedType] = useState<AdminDecisionType | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessResult, setAssessResult] = useState<{
    brief: AdminBrief; citations: Citation[]; sessionId: number;
  } | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [activeDims, setActiveDims] = useState<string[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Phase 4: jurisdiction selection + comparison
  const [jurisdiction, setJurisdiction] = useState<string>('uae');
  const [availableJurisdictions, setAvailableJurisdictions] = useState<JurisdictionInfo[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparing, setComparing] = useState(false);

  // Load roles on mount
  useEffect(() => {
    apiFetch('/api/admin-os/roles')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.roles) setRoles(d.roles); })
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  }, []);

  // Load history
  const fetchHistory = useCallback(async () => {
    const r = await apiFetch('/api/admin-os/sessions');
    if (r.ok) { const d = await r.json(); setHistory(d.sessions ?? []); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Load available jurisdictions
  useEffect(() => {
    apiFetch('/api/admin-os/jurisdictions')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.jurisdictions) setAvailableJurisdictions(d.jurisdictions); })
      .catch(() => {});
  }, []);

  // Loading animation — dims light up one by one
  useEffect(() => {
    if (screen !== 'loading') { setActiveDims([]); return; }
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      setActiveDims(DIMENSION_ORDER.slice(0, idx) as unknown as string[]);
      if (idx >= DIMENSION_ORDER.length) clearInterval(timer);
    }, 1200);
    return () => clearInterval(timer);
  }, [screen]);

  // When both animation is complete AND assessment result is ready → show brief
  useEffect(() => {
    if (screen === 'loading' && activeDims.length >= DIMENSION_ORDER.length && assessResult) {
      setAssessing(false);
      setScreen('brief');
    }
  }, [screen, activeDims.length, assessResult]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function selectRole(role: AdminRole) {
    setSelectedRole(role);
    setDtLoading(true);
    setScreen('catalog');
    try {
      const r = await apiFetch(`/api/admin-os/decision-types?jurisdiction=${jurisdiction}&role=${role.roleKey}`);
      if (r.ok) {
        const d = await r.json();
        setDecisionTypes(d.decisionTypes ?? []);
      }
    } catch { /* ignore */ } finally { setDtLoading(false); }
  }

  async function selectDecisionType(dt: AdminDecisionType) {
    setSelectedType(dt);
    setAnswers({});
    setQuestions([]);          // clear stale questions immediately
    setQuestionsLoading(true);
    setScreen('interview');
    // Fetch role-merged interview template
    try {
      const roleParam = selectedRole ? `?role=${selectedRole.roleKey}` : '';
      const r = await apiFetch(`/api/admin-os/interview-template/${dt.id}${roleParam}`);
      if (r.ok) {
        const d = await r.json();
        setQuestions(d.questions ?? []);
      }
    } catch {
      toast({ title: 'تعذّر تحميل الأسئلة', variant: 'destructive' });
    } finally {
      setQuestionsLoading(false);
    }
  }

  function handleAnswer(id: string, value: string) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  async function runAssessment() {
    if (!selectedRole || !selectedType || !canUseAi) return;
    setAssessing(true);
    setAssessResult(null);
    setScreen('loading');

    try {
      const r = await apiFetch('/api/admin-os/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole.roleKey,
          decisionTypeId: selectedType.id,
          jurisdiction,
          answers,
        }),
      });

      if (r.ok) {
        const data = await r.json();
        setCurrentSessionId(data.session?.id ?? null);
        setAssessResult({
          brief: { ...data.brief, legalityScore: data.brief.legalityScore ?? data.session?.legalityScore ?? 0, riskScore: data.brief.riskScore ?? data.session?.riskScore ?? 0 },
          citations: data.citations ?? [],
          sessionId: data.session?.id ?? 0,
        });
        fetchHistory();
        // Screen transition happens in useEffect when animation + result are both ready
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'فشل التقييم', description: (err as { error?: string }).error, variant: 'destructive' });
        setAssessing(false);
        setScreen('interview');
      }
    } catch {
      toast({ title: 'خطأ في الاتصال', description: 'تحقق من الاتصال وأعد المحاولة.', variant: 'destructive' });
      setAssessing(false);
      setScreen('interview');
    }
  }

  async function loadHistorySession(s: SessionSummary) {
    try {
      const r = await apiFetch(`/api/admin-os/sessions/${s.id}`);
      if (!r.ok) { toast({ title: 'تعذّر تحميل التقييم', variant: 'destructive' }); return; }
      const data = await r.json();
      const session = data.session;

      // Restore role and decision type stubs for display
      const role = roles.find(ro => ro.roleKey === session.role) ?? {
        id: 0, roleKey: session.role, titleAr: session.role,
        titleEn: session.role, descriptionAr: '', descriptionEn: '',
        competenceCeiling: '', permittedDomains: [],
        actionCapabilities: { canIssue: false, canReview: false, canChallenge: false },
        legalBasisAr: '', legalBasisEn: '',
      } as AdminRole;

      setSelectedRole(role);
      setSelectedType({
        id: session.decisionTypeId ?? 0, jurisdiction: session.jurisdiction ?? 'uae',
        domain: '', decisionTypeAr: session.decisionTypeAr, decisionTypeEn: session.decisionTypeEn,
        descriptionAr: '', requiredCompetenceLevel: '', inherentRiskLevel: 'medium', applicableLaws: [],
      });

      const brief = session.brief as AdminBrief;
      setAssessResult({
        brief: { ...brief, legalityScore: session.legalityScore, riskScore: session.riskScore },
        citations: (brief?.citations as Citation[]) ?? [],
        sessionId: session.id,
      });
      setCurrentSessionId(session.id);
      setJurisdiction(session.jurisdiction ?? 'uae');
      setCompareResult(null);
      setComparing(false);
      setScreen('brief');
    } catch {
      toast({ title: 'تعذّر تحميل التقييم', variant: 'destructive' });
    }
  }

  async function deleteSession(id: number) {
    await apiFetch(`/api/admin-os/sessions/${id}`, { method: 'DELETE' });
    setHistory(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) { resetAll(); }
  }

  async function handleJurisdictionChange(key: string) {
    setJurisdiction(key);
    setCompareResult(null);
    if (selectedRole && screen === 'catalog') {
      setDtLoading(true);
      setDecisionTypes([]);
      try {
        const r = await apiFetch(`/api/admin-os/decision-types?jurisdiction=${key}&role=${selectedRole.roleKey}`);
        if (r.ok) { const d = await r.json(); setDecisionTypes(d.decisionTypes ?? []); }
      } catch { /* ignore */ } finally { setDtLoading(false); }
    }
  }

  async function runComparison() {
    if (!assessResult?.sessionId || !canUseAi) return;
    const targetJurisdiction = jurisdiction === 'uae' ? 'france' : 'uae';
    setComparing(true);
    setCompareResult(null);
    try {
      const r = await apiFetch('/api/admin-os/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: assessResult.sessionId, targetJurisdiction }),
      });
      if (r.ok) { setCompareResult(await r.json()); }
      else { toast({ title: 'فشل التحليل المقارن', description: 'تحقق من الاتصال وأعد المحاولة.', variant: 'destructive' }); }
    } catch { toast({ title: 'خطأ في الاتصال', variant: 'destructive' }); }
    finally { setComparing(false); }
  }

  function resetAll() {
    setScreen('roles');
    setSelectedRole(null);
    setSelectedType(null);
    setAnswers({});
    setQuestions([]);
    setAssessResult(null);
    setActiveDims([]);
    setCurrentSessionId(null);
    setAssessing(false);
    setQuestionsLoading(false);
    setCompareResult(null);
    setComparing(false);
  }

  function handleBack() {
    if (screen === 'catalog') { setScreen('roles'); }
    else if (screen === 'interview') { setScreen('catalog'); }
    else if (screen === 'brief') { resetAll(); }
  }

  // Top-bar title
  const pageTitle =
    screen === 'roles'     ? t('نظام القرارات الإدارية', 'Admin Decision OS') :
    screen === 'catalog'   ? (selectedRole?.titleAr ?? t('اختيار نوع القرار', 'Select Decision Type')) :
    screen === 'interview' ? (selectedType?.decisionTypeAr ?? t('استبيان القرار', 'Decision Interview')) :
    screen === 'loading'   ? t('جارٍ التقييم', 'Assessing…') :
    t('التقرير القانوني', 'Legal Brief');

  return (
    <AppLayout variant="chat">
      <div className="flex h-[100dvh] w-full overflow-hidden flex-col md:flex-row" dir="rtl">

        {/* Desktop history sidebar */}
        {history.length > 0 && (
          <HistorySidebar sessions={history} onSelect={loadHistorySession}
            onDelete={deleteSession} currentId={currentSessionId} t={t} />
        )}

        {/* Main content column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              {screen !== 'roles' && screen !== 'loading' && (
                <button type="button" onClick={handleBack}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <Scale className="w-4 h-4 text-primary shrink-0" />
              <span className="font-bold text-sm text-foreground truncate max-w-[180px] sm:max-w-none">{pageTitle}</span>
            </div>
            <button type="button" onClick={() => setShowHistoryDrawer(true)}
              className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              {t('السابق', 'History')}
            </button>
          </div>

          {/* Screen content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {screen === 'roles' && (
              <RoleSelectionScreen roles={roles} loading={rolesLoading} onSelect={selectRole} />
            )}
            {screen === 'catalog' && selectedRole && (
              <CatalogScreen role={selectedRole} decisionTypes={decisionTypes} loading={dtLoading}
                onSelect={selectDecisionType} onBack={handleBack}
                jurisdiction={jurisdiction}
                availableJurisdictions={availableJurisdictions}
                onJurisdictionChange={handleJurisdictionChange} />
            )}
            {screen === 'interview' && selectedRole && selectedType && (
              <InterviewScreen
                role={selectedRole}
                decisionType={selectedType}
                questions={questions}
                answers={answers}
                onAnswer={handleAnswer}
                onAssess={runAssessment}
                assessing={assessing}
                questionsLoading={questionsLoading}
              />
            )}
            {screen === 'loading' && <LoadingScreen activeDims={activeDims} />}
            {screen === 'brief' && assessResult && selectedRole && selectedType && (
              <BriefScreen
                brief={assessResult.brief}
                role={selectedRole}
                decisionType={selectedType}
                sessionId={assessResult.sessionId}
                citations={assessResult.citations}
                onReset={resetAll}
                t={t}
                jurisdiction={jurisdiction}
                onCompare={runComparison}
                comparing={comparing}
                compareResult={compareResult}
                canUseAi={canUseAi}
              />
            )}
          </div>
        </div>

        {/* Mobile history drawer */}
        <HistoryDrawer open={showHistoryDrawer} sessions={history}
          onSelect={loadHistorySession} onDelete={deleteSession}
          onClose={() => setShowHistoryDrawer(false)} t={t} />
      </div>
    </AppLayout>
  );
}
