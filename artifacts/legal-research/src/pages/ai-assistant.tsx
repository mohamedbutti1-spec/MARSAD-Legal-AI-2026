import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { useListDocuments } from '@workspace/api-client-react';
import {
  Bot, Plus, Trash2, Send, Loader2, MessageSquare, Sparkles,
  FileText, BookOpen, Copy, Check, ChevronDown, ChevronUp,
  X, Pin, PinOff, Menu, FlaskConical,
  Zap, GraduationCap, Star, Maximize2, Minimize2, Scale, Gavel,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TheoryLensSelector, TheoryLensBadge, type TheoryLensState } from '@/components/research/theory-lens-selector';
import { CourtSessionPanel } from '@/components/research/court-session-panel';
import type { CourtSessionData } from '@/lib/court-types';

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

// ─── Pre-analysis config types ────────────────────────────────────────────────

// Judicial Authority
type UserType =
  | 'judge' | 'prosecutor'
  // Legislative Authority
  | 'legislator' | 'legislative_committee'
  // Executive Authority
  | 'minister' | 'undersecretary' | 'director_general' | 'compliance_officer' | 'risk_officer' | 'government'
  // Legal Professions
  | 'lawyer' | 'legal_consultant' | 'professor' | 'researcher' | 'legal_author' | 'graduate_student'
  // Legal Specialisations (Stage 3)
  | 'admin_law_specialist' | 'constitutional_specialist' | 'criminal_specialist' | 'civil_specialist'
  // Public Users
  | 'citizen' | 'institution'
  // AI & Governance
  | 'ai_engineer' | 'algorithm_reviewer' | 'algorithmic_auditor';

type UserGoal =
  | 'understand' | 'legal_opinion' | 'judicial_judgment' | 'memorandum'
  | 'legislative_draft' | 'academic_research' | 'phd_thesis'
  | 'risk_assessment' | 'compliance_review' | 'ai_decision_analysis';

type ConfigAnswerMode = 'quick' | 'standard' | 'academic' | 'judicial' | 'memorandum' | 'legislative' | 'executive_report' | 'comparative' | 'scientific';
type Jurisdiction    = 'uae' | 'france' | 'saudi' | 'egypt' | 'eu' | 'comparative';
type SourceType      = 'all' | 'legislation' | 'judicial' | 'doctrine' | 'regulations' | 'circulars' | 'international' | 'academic_research';
type CitStyle        = 'harvard' | 'apa' | 'oscola' | 'bluebook' | 'uae';
type ResearchDepth   = 'short' | 'medium' | 'detailed' | 'comprehensive' | 'unlimited';

interface SessionConfig {
  userType: UserType;
  userGoal: UserGoal;
  answerMode: ConfigAnswerMode;
  jurisdiction: Jurisdiction;
  sources: SourceType[];
  citStyle: CitStyle;
  depth: ResearchDepth;
  /** Whether the المعيار المتقدم (Al-Shamsi Theory) is activated for this session */
  applyAdvancedStandard: boolean;
  /** UAE ↔ France comparative law mode */
  comparativeMode: boolean;
}

interface ExpertOptions {
  confidence: boolean;
  reasoning: boolean;
  minority: boolean;
  burden: boolean;
  evidence: boolean;
  appealProb: boolean;
  gaps: boolean;
  latestJudgments: boolean;
  legislativeUpdates: boolean;
  actionPlan: boolean;
}

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  userType: 'lawyer', userGoal: 'legal_opinion', answerMode: 'standard', jurisdiction: 'uae',
  sources: ['all'], citStyle: 'uae', depth: 'detailed',
  applyAdvancedStandard: false, comparativeMode: false,
};

const DEFAULT_EXPERT_OPTIONS: ExpertOptions = {
  confidence: true, reasoning: false, minority: false, burden: false, evidence: false,
  appealProb: false, gaps: false, latestJudgments: false, legislativeUpdates: false, actionPlan: false,
};

const USER_TYPE_CONFIG: Record<UserType, { ar: string; emoji: string }> = {
  // Judicial
  judge:                  { ar: 'قاضٍ',                          emoji: '⚖' },
  prosecutor:             { ar: 'مدعٍ عام',                       emoji: '⚖' },
  // Legislative
  legislator:             { ar: 'مشرّع',                          emoji: '📜' },
  legislative_committee:  { ar: 'لجنة تشريعية',                  emoji: '🏛' },
  // Executive
  minister:               { ar: 'وزير',                           emoji: '🏛' },
  undersecretary:         { ar: 'وكيل وزارة',                    emoji: '🏛' },
  director_general:       { ar: 'مدير عام',                      emoji: '🏢' },
  compliance_officer:     { ar: 'مسؤول الامتثال',                emoji: '✅' },
  risk_officer:           { ar: 'مسؤول المخاطر',                  emoji: '⚠' },
  government:             { ar: 'موظف حكومي',                     emoji: '🏛' },
  // Legal Professions
  lawyer:                 { ar: 'محامٍ',                          emoji: '🧑‍⚖️' },
  legal_consultant:       { ar: 'مستشار قانوني',                  emoji: '🧑‍⚖️' },
  professor:              { ar: 'أستاذ / أكاديمي',                emoji: '🏫' },
  researcher:             { ar: 'باحث قانوني',                    emoji: '🎓' },
  legal_author:           { ar: 'مؤلف قانوني',                    emoji: '✍' },
  graduate_student:       { ar: 'طالب دراسات عليا',              emoji: '🎓' },
  // Legal Specialisations (Stage 3)
  admin_law_specialist:       { ar: 'متخصص قانون إداري',          emoji: '🏛' },
  constitutional_specialist:  { ar: 'متخصص قانون دستوري',         emoji: '📜' },
  criminal_specialist:        { ar: 'متخصص قانون جنائي',          emoji: '🔍' },
  civil_specialist:           { ar: 'متخصص قانون مدني',           emoji: '⚖' },
  // Public Users
  citizen:                { ar: 'مواطن',                          emoji: '👤' },
  institution:            { ar: 'شركة / مؤسسة',                  emoji: '🏢' },
  // AI & Governance
  ai_engineer:            { ar: 'مهندس أنظمة ذكية',              emoji: '🤖' },
  algorithm_reviewer:     { ar: 'مدقق خوارزميات',                emoji: '🔍' },
  algorithmic_auditor:    { ar: 'مدقق الامتثال الخوارزمي',       emoji: '🔬' },
};

// Role groups for grouped rendering in the config panel
const USER_TYPE_GROUPS: { labelAr: string; types: UserType[] }[] = [
  { labelAr: 'السلطة القضائية',               types: ['judge', 'prosecutor'] },
  { labelAr: 'السلطة التشريعية',              types: ['legislator', 'legislative_committee'] },
  { labelAr: 'السلطة التنفيذية',              types: ['minister', 'undersecretary', 'director_general', 'compliance_officer', 'risk_officer', 'government'] },
  { labelAr: 'المهن القانونية',               types: ['lawyer', 'legal_consultant', 'professor', 'researcher', 'legal_author', 'graduate_student'] },
  { labelAr: 'التخصصات القانونية',           types: ['admin_law_specialist', 'constitutional_specialist', 'criminal_specialist', 'civil_specialist'] },
  { labelAr: 'المستخدمون العامون',            types: ['citizen', 'institution'] },
  { labelAr: 'الذكاء الاصطناعي والحوكمة',    types: ['ai_engineer', 'algorithm_reviewer', 'algorithmic_auditor'] },
];

const USER_GOAL_CFG: Record<UserGoal, { ar: string; emoji: string }> = {
  understand:           { ar: 'فهم الموضوع',                   emoji: '🔎' },
  legal_opinion:        { ar: 'رأي قانوني',                    emoji: '⚖' },
  judicial_judgment:    { ar: 'حكم قضائي',                    emoji: '🏛' },
  memorandum:           { ar: 'مذكرة قانونية',                 emoji: '📝' },
  legislative_draft:    { ar: 'مسودة تشريعية',                emoji: '📜' },
  academic_research:    { ar: 'بحث أكاديمي',                  emoji: '📚' },
  phd_thesis:           { ar: 'أطروحة دكتوراه / ماجستير',     emoji: '🎓' },
  risk_assessment:      { ar: 'تقييم مخاطر',                  emoji: '⚠' },
  compliance_review:    { ar: 'مراجعة امتثال',                emoji: '✅' },
  ai_decision_analysis: { ar: 'تحليل قرار إداري ذكي',         emoji: '🧠' },
};

const CONFIG_ANSWER_MODE_CFG: Record<ConfigAnswerMode, { ar: string; emoji: string }> = {
  quick:            { ar: 'إجابة سريعة',          emoji: '⚡' },
  standard:         { ar: 'تحليل قانوني معياري',  emoji: '📘' },
  academic:         { ar: 'إجابة أكاديمية',        emoji: '🎓' },
  judicial:         { ar: 'حكم قضائي',             emoji: '🏛' },
  memorandum:       { ar: 'مذكرة قانونية',         emoji: '⚖' },
  legislative:      { ar: 'مسودة تشريعية',        emoji: '📜' },
  executive_report: { ar: 'تقرير تنفيذي',         emoji: '📊' },
  comparative:      { ar: 'دراسة مقارنة',          emoji: '🌐' },
  scientific:       { ar: 'بحث علمي',             emoji: '📚' },
};

const JURISDICTION_CFG: Record<Jurisdiction, { ar: string; flag: string }> = {
  uae:         { ar: 'الإمارات العربية المتحدة', flag: '🇦🇪' },
  france:      { ar: 'فرنسا',                    flag: '🇫🇷' },
  saudi:       { ar: 'المملكة العربية السعودية', flag: '🇸🇦' },
  egypt:       { ar: 'مصر',                      flag: '🇪🇬' },
  eu:          { ar: 'الاتحاد الأوروبي',         flag: '🇪🇺' },
  comparative: { ar: 'تحليل مقارن',             flag: '🌐' },
};

const SOURCE_CFG: Record<SourceType, string> = {
  all: 'جميع المصادر', legislation: 'التشريعات', judicial: 'الأحكام القضائية',
  doctrine: 'الفقه القانوني', regulations: 'اللوائح التنفيذية',
  circulars: 'التعاميم الإدارية', international: 'الصكوك الدولية',
  academic_research: 'البحث الأكاديمي',
};

const CIT_STYLE_CFG: Record<CitStyle, string> = {
  harvard: 'Harvard', apa: 'APA', oscola: 'OSCOLA', bluebook: 'Bluebook', uae: 'الاستشهاد الإماراتي',
};

const DEPTH_CFG: Record<ResearchDepth, string> = {
  short: 'مختصر', medium: 'متوسط', detailed: 'تفصيلي', comprehensive: 'شامل', unlimited: 'غير محدود',
};

// ─── Professional Role Intelligence Engines ────────────────────────────────────
// Each role is an independent reasoning engine: its own sequence + output fields.
// Add future engines here without touching existing ones.

interface RoleEngine {
  /** Self-contained Arabic label — engine does not depend on USER_TYPE_CONFIG. */
  nameAr: string;
  reasoningSequenceAr: string[];
  outputsAr: string[];
}

const ROLE_ENGINES: Partial<Record<UserType, RoleEngine>> = {

  // 1 — Judicial Engine
  judge: {
    nameAr: 'القضاء — المحرك القضائي',
    reasoningSequenceAr: [
      'الاختصاص القضائي',
      'قبول الدعوى',
      'الوقائع',
      'الأدلة',
      'القانون الواجب التطبيق',
      'الاستدلال القضائي',
      'التحليل القانوني',
      'الحكم',
      'الإنصاف والتعويض',
      'الرأي القضائي النهائي',
    ],
    outputsAr: [
      'التحليل القضائي',
      'الموقف المتوقع للمحكمة',
      'اليقين القانوني',
      'إمكانية الطعن بالاستئناف',
      'التوصية القضائية الموصى بها',
    ],
  },

  // 2 — Public Prosecution Engine
  prosecutor: {
    nameAr: 'النيابة العامة — محرك الادعاء',
    reasoningSequenceAr: [
      'الوقائع',
      'الأدلة المتاحة',
      'الأدلة الناقصة',
      'عبء الإثبات',
      'المشروعية الإجرائية',
      'التكييف القانوني',
      'المصلحة العامة',
      'موقف النيابة العامة',
    ],
    outputsAr: [
      'تقييم الأدلة',
      'المراجعة الإجرائية',
      'توصية الادعاء',
      'متطلبات التحقيق',
    ],
  },

  // 3 — Legislative Engine (shared for legislator + committee)
  legislator: {
    nameAr: 'التشريع — المحرك التشريعي',
    reasoningSequenceAr: [
      'الغرض التشريعي',
      'رصد الفجوات القانونية',
      'التشريع المقارن',
      'الأثر التنظيمي',
      'التعديل المقترح',
      'مسودة المادة القانونية',
      'المذكرة التفسيرية',
    ],
    outputsAr: [
      'التوصية التشريعية',
      'مسودة التعديل',
      'الأثر المتوقع للتشريع',
    ],
  },

  legislative_committee: {
    nameAr: 'اللجنة التشريعية — المحرك التشريعي',
    reasoningSequenceAr: [
      'الغرض التشريعي',
      'رصد الفجوات القانونية',
      'التشريع المقارن',
      'الأثر التنظيمي',
      'التعديل المقترح',
      'مسودة المادة القانونية',
      'المذكرة التفسيرية',
    ],
    outputsAr: [
      'التوصية التشريعية',
      'مسودة التعديل',
      'الأثر المتوقع للتشريع',
    ],
  },

  // 4 — Research Engine (shared for researcher + graduate student)
  researcher: {
    nameAr: 'البحث القانوني — المحرك البحثي',
    reasoningSequenceAr: [
      'مشكلة البحث',
      'مراجعة الأدبيات',
      'الفجوة البحثية',
      'المنهجية',
      'التحليل المقارن',
      'النتائج',
      'التوصيات',
    ],
    outputsAr: [
      'الهيكل البحثي الأكاديمي',
      'المراجع المقترحة',
      'توجهات البحث المستقبلي',
    ],
  },

  graduate_student: {
    nameAr: 'طالب الدراسات العليا — المحرك البحثي',
    reasoningSequenceAr: [
      'مشكلة البحث',
      'مراجعة الأدبيات',
      'الفجوة البحثية',
      'المنهجية',
      'التحليل المقارن',
      'النتائج',
      'التوصيات',
    ],
    outputsAr: [
      'الهيكل البحثي الأكاديمي',
      'المراجع المقترحة',
      'توجهات البحث المستقبلي',
    ],
  },

  // 5 — Author Engine
  legal_author: {
    nameAr: 'التأليف القانوني — محرك الكتابة الأكاديمية',
    reasoningSequenceAr: [
      'هيكل الفصل',
      'الكتابة الأكاديمية',
      'الحواشي والتهميشات',
      'المراجع',
      'النقاش المقارن',
      'الخاتمة والاستنتاجات',
    ],
    outputsAr: [
      'محتوى جاهز للنشر',
      'أسلوب أكاديمي رصين',
      'تنسيق قابل للنشر',
    ],
  },

  // 6 — Professor Engine
  professor: {
    nameAr: 'الأستاذية — المحرك الأكاديمي التعليمي',
    reasoningSequenceAr: [
      'الشرح الأكاديمي',
      'ملاحظات التدريس',
      'الأمثلة التطبيقية',
      'التحليل النقدي',
      'النقاش الصفي',
      'أسئلة الامتحانات',
    ],
    outputsAr: [
      'ملاحظات المحاضرة',
      'مخرجات التعلم',
      'المادة التعليمية',
    ],
  },

  // 7 — Lawyer Engine
  lawyer: {
    nameAr: 'المحاماة — محرك الدفاع القانوني',
    reasoningSequenceAr: [
      'الوقائع والوقائع المادية',
      'تحديد المسائل القانونية',
      'القانون الواجب التطبيق',
      'التحليل القانوني التطبيقي',
      'الحجج المضادة والدفوع',
      'تقييم قوة الموقف',
      'الاستنتاج والتوصيات',
    ],
    outputsAr: [
      'الرأي القانوني المهني',
      'استراتيجية الدفاع',
      'المخاطر والفرص',
      'خطة الإجراء القانوني',
    ],
  },

  // 8 — Administrative Law Specialist Engine
  admin_law_specialist: {
    nameAr: 'القانون الإداري — محرك التخصص الإداري',
    reasoningSequenceAr: [
      'الوقائع وتحديد المسائل الإدارية',
      'أركان القرار الإداري (الاختصاص · الشكل · السبب · المحل · الغاية)',
      'القانون الواجب التطبيق (تراتبياً: دستوري → تشريعي → لائحي)',
      'تحليل مشروعية القرار الإداري',
      'الحجج المضادة والتفسيرات البديلة',
      'السوابق القضائية للمحاكم الإدارية',
      'الاستنتاج: صحة أو بطلان القرار',
      'التوصيات وسبل الطعن',
    ],
    outputsAr: [
      'حكم مشروعية القرار',
      'ركن الإخلال وأثره',
      'مسار الطعن المناسب',
      'احتمالية الإلغاء',
    ],
  },

  // 9 — Constitutional Law Specialist Engine
  constitutional_specialist: {
    nameAr: 'القانون الدستوري — المحرك الدستوري',
    reasoningSequenceAr: [
      'الوقائع وتحديد المسألة الدستورية',
      'القواعد الدستورية الحاكمة',
      'القانون الواجب التطبيق (الدستور الاتحادي أولاً)',
      'التحليل الدستوري: التوافق أو التعارض',
      'الحجج الدستورية المضادة',
      'الرقابة الدستورية وأثر الإلغاء',
      'الاستنتاج الدستوري',
      'التوصيات والإصلاح التشريعي المقترح',
    ],
    outputsAr: [
      'حكم الدستورية',
      'النص الدستوري الحاكم',
      'أثر اللادستورية',
      'المسار الإصلاحي المقترح',
    ],
  },

  // 10 — Criminal Law Specialist Engine
  criminal_specialist: {
    nameAr: 'القانون الجنائي — محرك التحليل الجنائي',
    reasoningSequenceAr: [
      'الوقائع والوقائع المادية للجريمة',
      'تحديد التكييف الجنائي',
      'القانون الجنائي الواجب التطبيق',
      'أركان الجريمة: الركن المادي + الركن المعنوي',
      'الأدلة وعبء الإثبات',
      'الحجج المضادة ودفوع البراءة',
      'التكييف المرجَّح والعقوبة المقررة',
      'التوصيات الإجرائية والموضوعية',
    ],
    outputsAr: [
      'التكييف الجنائي المرجَّح',
      'العقوبة المحتملة',
      'جدوى الدفاع',
      'استراتيجية المحاكمة',
    ],
  },

  // 11 — Civil Law Specialist Engine
  civil_specialist: {
    nameAr: 'القانون المدني — محرك التحليل المدني',
    reasoningSequenceAr: [
      'الوقائع والعلاقة القانونية المدنية',
      'تحديد المسائل المدنية (عقد · ضمان · مسؤولية · حقوق عينية)',
      'القانون المدني الواجب التطبيق',
      'التحليل: تكوين العقد / الإخلال / أركان المسؤولية',
      'الأضرار والتعويض المطالب به',
      'الحجج المضادة والدفوع المدنية',
      'السوابق القضائية المدنية',
      'الاستنتاج والتوصيات العملية',
    ],
    outputsAr: [
      'قوة الدعوى المدنية',
      'التعويض المقدَّر',
      'فرص التسوية الودية',
      'استراتيجية التقاضي',
    ],
  },

  // ── Future engines (ai_engineer, algorithm_reviewer, etc.) go here ──
};

/** Build the role-specific reasoning block injected into the AI prompt.
 *  Fully self-contained — reads only from engine.nameAr, not USER_TYPE_CONFIG. */
function buildEngineBlock(userType: UserType): string {
  const engine = ROLE_ENGINES[userType];
  if (!engine) return '';
  let block = `\n[محرك الاستدلال المهني — ${engine.nameAr}]\n`;
  block += `تسلسل الاستدلال المطلوب:\n`;
  engine.reasoningSequenceAr.forEach((step, i) => {
    block += `  ${i + 1}. ${step}\n`;
  });
  block += `المخرجات المطلوبة: ${engine.outputsAr.join(' | ')}\n`;
  return block;
}

// Al-Shamsi keyword auto-detection
const SHAMSI_AUTO_RE = /ذكاء اصطناعي|خوارزم|حكومة رقمية|تعلم آلي|قرار آلي|منصة رقمية|بيانات ضخمة|شفافية خوارزم|انحياز خوارزم|قرار ذكي|وكيل ذكي|أتمتة|نظام رقمي|AI\b|artificial intelligence|algorithm|machine learning|digital government|automated decision|big data|agentic|algorithmic/i;
function detectShamsiKeywords(text: string): boolean { return SHAMSI_AUTO_RE.test(text); }

function buildConfigPrefix(config: SessionConfig, expertMode: boolean, opts: ExpertOptions): string {
  const extras: string[] = [];
  if (expertMode) {
    if (opts.confidence)         extras.push('درجة الثقة في كل استنتاج');
    if (opts.reasoning)          extras.push('مسار الاستدلال القانوني');
    if (opts.minority)           extras.push('الرأي الفقهي الأقلي');
    if (opts.burden)             extras.push('عبء الإثبات');
    if (opts.evidence)           extras.push('الأدلة المطلوبة');
    if (opts.appealProb)         extras.push('احتمالية نجاح الطعن');
    if (opts.gaps)               extras.push('ثغرات البحث القانوني');
    if (opts.latestJudgments)    extras.push('أحدث الأحكام القضائية');
    if (opts.legislativeUpdates) extras.push('التعديلات التشريعية الأخيرة');
    if (opts.actionPlan)         extras.push('خطة الإجراء القانوني الموصى بها');
  }
  const sources = config.sources.includes('all') ? SOURCE_CFG['all'] : config.sources.map((s) => SOURCE_CFG[s]).join('، ');
  let p = `[تكوين جلسة MLOS — Marsad Legal Operating System · نرصد · نحلل · نحكم]\n`;
  p += `المستخدم: ${USER_TYPE_CONFIG[config.userType].ar} | الهدف: ${USER_GOAL_CFG[config.userGoal].ar} | الأسلوب: ${CONFIG_ANSWER_MODE_CFG[config.answerMode].ar}\n`;
  p += `الاختصاص: ${JURISDICTION_CFG[config.jurisdiction].ar} | العمق: ${DEPTH_CFG[config.depth]} | الاستشهاد: ${CIT_STYLE_CFG[config.citStyle]} | المصادر: ${sources}\n`;
  // Role Intelligence Engine — injects role-specific reasoning sequence + outputs.
  // Falls back to generic sequence for roles that don't yet have a dedicated engine.
  const engineBlock = buildEngineBlock(config.userType);
  if (engineBlock) {
    p += engineBlock;
  } else {
    p += `ترتيب الاستجابة المطلوب: ١. التحليل القانوني → ٢. التحليل القضائي → ٣. الفقه القانوني → ٤. القانون المقارن\n`;
  }
  // Comparative Law mode — UAE ↔ France native layer
  if (config.comparativeMode) {
    p += `\n[وضع القانون المقارن — الإمارات ↔ فرنسا]\n`;
    p += `هذه الجلسة في وضع المقارنة التشريعية المباشرة بين القانون الإماراتي والقانون الفرنسي.\n`;
    p += `المطلوب في كل إجابة:\n`;
    p += `  أ. الموقف الإماراتي: النص الإماراتي الصريح + سابقة قضائية إماراتية إن وجدت\n`;
    p += `  ب. الموقف الفرنسي: النص الفرنسي المقابل + سابقة قضائية فرنسية إن وجدت\n`;
    p += `  ج. أوجه التشابه والاختلاف الجوهرية\n`;
    p += `  د. التوجه المرجَّح للقانون الإماراتي بناءً على أصوله الفرنسية\n`;
    p += `  هـ. حكم القانون المقارن: سلطة مقنعة — غير ملزمة في الدولة الإماراتية\n`;
    p += `استخدم تنسيق جدول مقارن حيثما أمكن.\n`;
  }
  // Advanced Standard — ADDITIVE second layer; never replaces the engine above.
  if (config.applyAdvancedStandard) {
    p += `\n[المعيار المتقدم — نظرية الشامسي (طبقة تحليلية ثانية مستقلة)]\n`;
    p += `أضف هذا التحليل بعد محرك الاستدلال الأساسي، ولا تستبدله:\n`;
    p += `  ١. الإرادة الإدارية الرقمية: هل الإرادة المُعبَّر عنها بشرية أم رقمية؟\n`;
    p += `  ٢. الوزن القانوني الخوارزمي: ما الترتيب الأدلاتي للمخرجات الخوارزمية؟\n`;
    p += `  ٣. الانحياز الخوارزمي المشروع: هل التمييز في البيانات قانوني؟\n`;
    p += `  ٤. قابلية التفسير الخوارزمي: هل يمكن للمتأثر فهم آلية القرار؟\n`;
    p += `  ٥. الشفافية الإجرائية: هل أُبلغ المتأثر مسبقاً بالأتمتة؟\n`;
    p += `  ٦. الرقابة البشرية: ما آليات التدقيق البشري الفاعل؟\n`;
    p += `  ٧. الامتثال المتدرج: ما مراحل الامتثال التنظيمي المطلوبة؟\n`;
    p += `  ٨. الطعن الإداري السابق: ما مسارات التظلم قبل اللجوء للقضاء؟\n`;
    p += `  ٩. المراجعة القضائية: ما حدود رقابة القاضي على القرار الخوارزمي؟\n`;
    p += `  ١٠. المسؤولية الإدارية بدون خطأ خوارزمي: هل تقوم المسؤولية الموضوعية؟\n`;
    p += `  ١١. الحوكمة الرقمية: الإطار التنظيمي الإماراتي للذكاء الاصطناعي\n`;
    p += `اختتم هذا القسم بـ: مؤشر امتثال الشامسي (نسبة مئوية مع تفسير تفصيلي لكل بُعد).\n`;
  }
  if (extras.length > 0) p += `الخيارات الخبيرة: يرجى تضمين: ${extras.join('، ')}\n`;
  return p + '\n';
}

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
  text, citations, prefix, maxSections, collapsible = false, streamingCursor,
}: {
  text: string;
  citations: Citation[];
  prefix: string;
  maxSections?: number;
  collapsible?: boolean;
  streamingCursor?: React.ReactNode;
}) {
  const segments = segmentResponse(text);
  const isStructured = segments.some((s) => s.kind === 'header');

  if (!isStructured) {
    return (
      <p className="whitespace-pre-wrap break-words leading-7 text-sm">
        {parseCitationTokens(text, citations, `${prefix}-plain`)}
        {streamingCursor}
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
  content, citations, mode, isExpanded, streamingCursor,
}: {
  content: string;
  citations: Citation[];
  mode: ResponseMode;
  isExpanded: boolean;
  streamingCursor?: React.ReactNode;
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
        streamingCursor={streamingCursor}
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
      {(mode === 'professional' || mode === 'expert') && !streamingCursor && (
        <AnswerStrengthIndicator text={displayBinding} citations={citations} />
      )}
    </div>
  );
}

// ─── Config chip ─────────────────────────────────────────────────────────────

function ConfigChip<T extends string>({
  value, selected, label, onSelect,
}: { value: T; selected: T; label: string; onSelect: (v: T) => void }) {
  const active = value === selected;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
        active ? 'bg-primary text-primary-foreground border-primary'
               : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function CfgSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-3">
      <p className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </p>
      {children}
    </div>
  );
}

// ─── Pre-analysis panel ───────────────────────────────────────────────────────

function PreAnalysisPanel({
  config, onChange, onStart, expertMode, onToggleExpert,
}: {
  config: SessionConfig;
  onChange: (c: SessionConfig) => void;
  onStart: () => void;
  expertMode: boolean;
  onToggleExpert: () => void;
}) {
  function toggleSource(s: SourceType) {
    if (s === 'all') { onChange({ ...config, sources: ['all'] }); return; }
    const without = config.sources.filter((x) => x !== 'all' && x !== s);
    const adding  = !config.sources.includes(s);
    const next    = adding ? [...without, s] : without;
    onChange({ ...config, sources: next.length === 0 ? ['all'] : next });
  }
  function isActive(s: SourceType) {
    return s === 'all' ? config.sources.includes('all') : config.sources.includes(s) && !config.sources.includes('all');
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* MLOS identity header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-primary/60 uppercase">MLOS</span>
            <span className="text-border select-none">·</span>
            <span className="text-[10px] text-muted-foreground">Marsad Legal Operating System</span>
          </div>
          <h2 className="text-base font-bold text-foreground">كيف تريد تحليل هذه المسألة؟</h2>
          <p className="text-xs text-muted-foreground mt-1">نرصد · نحلل · نحكم</p>
        </div>

        <div className="space-y-3">
          {/* User Role — grouped */}
          <CfgSection title="الصفة المهنية" icon="👤">
            <div className="space-y-2">
              {USER_TYPE_GROUPS.map(({ labelAr, types }) => (
                <div key={labelAr}>
                  <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide mb-1">{labelAr}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((k) => {
                      const v = USER_TYPE_CONFIG[k];
                      return (
                        <ConfigChip key={k} value={k} selected={config.userType}
                          label={`${v.emoji} ${v.ar}`} onSelect={(val) => onChange({ ...config, userType: val })} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CfgSection>

          {/* User Goal */}
          <CfgSection title="الهدف من الاستعلام" icon="🎯">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(USER_GOAL_CFG) as [UserGoal, { ar: string; emoji: string }][]).map(([k, v]) => (
                <ConfigChip key={k} value={k} selected={config.userGoal}
                  label={`${v.emoji} ${v.ar}`} onSelect={(val) => onChange({ ...config, userGoal: val })} />
              ))}
            </div>
          </CfgSection>

          <CfgSection title="أسلوب الإجابة" icon="📋">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(CONFIG_ANSWER_MODE_CFG) as [ConfigAnswerMode, { ar: string; emoji: string }][]).map(([k, v]) => (
                <ConfigChip key={k} value={k} selected={config.answerMode}
                  label={`${v.emoji} ${v.ar}`} onSelect={(val) => onChange({ ...config, answerMode: val })} />
              ))}
            </div>
          </CfgSection>

          <CfgSection title="الاختصاص القضائي" icon="🌐">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(JURISDICTION_CFG) as [Jurisdiction, { ar: string; flag: string }][]).map(([k, v]) => (
                <ConfigChip key={k} value={k} selected={config.jurisdiction}
                  label={`${v.flag} ${v.ar}`} onSelect={(val) => onChange({ ...config, jurisdiction: val })} />
              ))}
            </div>
          </CfgSection>

          <CfgSection title="المصادر" icon="📚">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SOURCE_CFG) as SourceType[]).map((s) => (
                <button key={s} type="button" onClick={() => toggleSource(s)}
                  className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                    isActive(s) ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {SOURCE_CFG[s]}
                </button>
              ))}
            </div>
          </CfgSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CfgSection title="أسلوب الاستشهاد" icon="📎">
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(CIT_STYLE_CFG) as [CitStyle, string][]).map(([k, v]) => (
                  <ConfigChip key={k} value={k} selected={config.citStyle}
                    label={v} onSelect={(val) => onChange({ ...config, citStyle: val })} />
                ))}
              </div>
            </CfgSection>
            <CfgSection title="عمق البحث" icon="🔍">
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(DEPTH_CFG) as [ResearchDepth, string][]).map(([k, v]) => (
                  <ConfigChip key={k} value={k} selected={config.depth}
                    label={v} onSelect={(val) => onChange({ ...config, depth: val })} />
                ))}
              </div>
            </CfgSection>
          </div>

          {/* Comparative Law Mode — UAE ↔ France */}
          <label htmlFor="comparativeMode" className="flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer bg-indigo-50 border border-indigo-200">
            <input
              type="checkbox"
              id="comparativeMode"
              checked={config.comparativeMode}
              onChange={() => onChange({ ...config, comparativeMode: !config.comparativeMode })}
              className="w-4 h-4 mt-0.5 shrink-0 accent-indigo-700"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold leading-tight text-indigo-800">🇦🇪↔🇫🇷 القانون المقارن: الإمارات ↔ فرنسا</p>
              <p className="text-[10px] font-medium text-indigo-600">Comparative Law Mode</p>
              <p className="text-[9px] leading-relaxed mt-1 text-indigo-500">
                مقارنة منهجية بين الموقف الإماراتي والموقف الفرنسي في كل إجابة، مع جدول مقارن وتحديد وجه الاستئناس.
              </p>
            </div>
          </label>

          {/* Advanced Standard (Al-Shamsi Theory) checkbox */}
          <label htmlFor="applyAdvancedStandard" className="flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer"
            style={{ background: '#EAF2FF', border: '1px solid #a8c4f0' }}
          >
            <input
              type="checkbox"
              id="applyAdvancedStandard"
              checked={config.applyAdvancedStandard}
              onChange={() => onChange({ ...config, applyAdvancedStandard: !config.applyAdvancedStandard })}
              className="w-4 h-4 mt-0.5 shrink-0 accent-[#2B5F9E]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold leading-tight" style={{ color: '#1a3a6e' }}>🧠 تطبيق المعيار المتقدم</p>
              <p className="text-[10px] font-medium" style={{ color: '#2B5F9E' }}>(نظرية الشامسي — طبقة نظرية الذكاء الاصطناعي)</p>
              <p className="text-[9px] leading-relaxed mt-1" style={{ color: '#3a6fa8' }}>
                تحليل إضافي للمسائل المرتبطة بالذكاء الاصطناعي والقرارات الإدارية الذكية والخوارزميات وفق المبادئ الأحد عشر.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-xs font-bold text-amber-800">وضع الخبير</p>
              <p className="text-[10px] text-amber-700">خيارات التحليل المتقدمة للتحليل الاحترافي العميق</p>
            </div>
            <button type="button" onClick={onToggleExpert}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${expertMode ? 'bg-amber-500' : 'bg-muted border border-border'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${expertMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <button type="button" onClick={onStart}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            ابدأ التحليل القانوني
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Session config bar (compact summary) ─────────────────────────────────────

function SessionConfigBar({ config, expertMode, onEdit }: {
  config: SessionConfig; expertMode: boolean; onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2 flex-wrap" dir="rtl">
      <button type="button" onClick={onEdit}
        className="text-[9px] font-bold px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground shrink-0"
      >تعديل</button>
      <span className="text-[10px] bg-primary/8 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
        {USER_TYPE_CONFIG[config.userType].emoji} {USER_TYPE_CONFIG[config.userType].ar}
      </span>
      <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
        {USER_GOAL_CFG[config.userGoal].emoji} {USER_GOAL_CFG[config.userGoal].ar}
      </span>
      <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
        {CONFIG_ANSWER_MODE_CFG[config.answerMode].emoji} {CONFIG_ANSWER_MODE_CFG[config.answerMode].ar}
      </span>
      <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
        {JURISDICTION_CFG[config.jurisdiction].flag} {JURISDICTION_CFG[config.jurisdiction].ar}
      </span>
      <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
        🔍 {DEPTH_CFG[config.depth]}
      </span>
      {config.comparativeMode && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          🇦🇪↔🇫🇷 مقارنة إماراتي–فرنسي
        </span>
      )}
      {config.applyAdvancedStandard && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: '#EAF2FF', color: '#1a3a6e', border: '1px solid #a8c4f0' }}
        >
          🧠 المعيار المتقدم
        </span>
      )}
      {expertMode && (
        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
          ⭐ وضع الخبير
        </span>
      )}
    </div>
  );
}

// ─── Expert options panel ─────────────────────────────────────────────────────

const EXPERT_OPT_LABELS: { key: keyof ExpertOptions; ar: string }[] = [
  { key: 'confidence',         ar: 'درجة الثقة' },
  { key: 'reasoning',          ar: 'مسار الاستدلال' },
  { key: 'minority',           ar: 'الرأي الأقلي' },
  { key: 'burden',             ar: 'عبء الإثبات' },
  { key: 'evidence',           ar: 'الأدلة المطلوبة' },
  { key: 'appealProb',         ar: 'احتمال الطعن' },
  { key: 'gaps',               ar: 'ثغرات البحث' },
  { key: 'latestJudgments',    ar: 'أحدث الأحكام' },
  { key: 'legislativeUpdates', ar: 'التعديلات التشريعية' },
  { key: 'actionPlan',         ar: 'خطة الإجراء' },
];

function ExpertOptionsPanel({ options, onChange }: {
  options: ExpertOptions; onChange: (o: ExpertOptions) => void;
}) {
  return (
    <div className="mb-2 bg-amber-50/60 border border-amber-200/70 rounded-xl px-3 py-2" dir="rtl">
      <p className="text-[10px] font-bold text-amber-800 mb-1.5 uppercase tracking-wide">خيارات الخبير</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {EXPERT_OPT_LABELS.map(({ key, ar }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={options[key]}
              onChange={(e) => onChange({ ...options, [key]: e.target.checked })}
              className="w-3 h-3 rounded accent-amber-600"
            />
            <span className="text-[10px] text-amber-800 font-medium">{ar}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── المعيار المتقدم (Al-Shamsi Theory) ──────────────────────────────────────

const SHAMSI_DIMENSIONS: { ar: string; en: string }[] = [
  { ar: 'الإرادة الإدارية الرقمية',    en: 'Digital Administrative Will' },
  { ar: 'الوزن القانوني الخوارزمي',    en: 'Algorithmic Legal Weight' },
  { ar: 'التحيز الخوارزمي المشروع',   en: 'Legitimate Algorithmic Bias' },
  { ar: 'قابلية التفسير',              en: 'Explainability' },
  { ar: 'الشفافية',                    en: 'Transparency' },
  { ar: 'الرقابة البشرية',             en: 'Human Oversight' },
  { ar: 'الامتثال المتدرج',            en: 'Graduated Compliance' },
  { ar: 'الطعن الإداري المسبق',        en: 'Prior Administrative Challenge' },
  { ar: 'الرقابة القضائية',            en: 'Judicial Review' },
  { ar: 'المسؤولية الإدارية',          en: 'Administrative Liability' },
  { ar: 'الحوكمة الرقمية',             en: 'Digital Governance' },
];

function ShamsiTheoryCard({ onActivate, disabled }: { onActivate: () => void; disabled: boolean }) {
  return (
    <div className="mt-3 rounded-xl border-2 overflow-hidden"
      style={{ background: '#EAF2FF', borderColor: '#2B5F9E' }}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2 border-b" style={{ borderColor: '#c8dcf8' }}>
        <span className="text-lg shrink-0">🧠</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-extrabold leading-none" style={{ color: '#1a3a6e' }}>
            المعيار المتقدم
          </p>
          <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#2B5F9E' }}>
            يعتمد على نظرية الشامسي
          </p>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: '#d4e5fc', color: '#1a3a6e', border: '1px solid #a8c4f0' }}
        >
          قيد التقييم
        </span>
      </div>

      {/* Compliance score bar */}
      <div className="mx-3.5 mt-2.5 mb-2 rounded-lg px-2.5 py-2"
        style={{ background: '#d4e5fc', border: '1px solid #a8c4f0' }}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold" style={{ color: '#1a3a6e' }}>مؤشر الامتثال النهائي</span>
          <span className="text-[10px] font-bold" style={{ color: '#2B5F9E' }}>— / 100</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: '#a8c4f0' }}>
          <div className="h-full rounded-full" style={{ width: '0%', background: '#2B5F9E' }} />
        </div>
        <p className="text-[9px] mt-1" style={{ color: '#3a6fa8' }}>
          اضغط «عرض التقرير الكامل» لتشغيل التحليل الكامل وفق المعيار المتقدم
        </p>
      </div>

      {/* Dimensions grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 px-3.5 pb-3">
        {SHAMSI_DIMENSIONS.map(({ ar }) => (
          <div key={ar} className="flex items-center gap-1" style={{ color: '#2B5F9E' }}>
            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#5b8fce' }} />
            <span className="text-[9px] font-medium leading-tight">{ar}</span>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <div className="px-3.5 pb-3.5">
        <button type="button" disabled={disabled} onClick={onActivate}
          className="w-full text-[11px] font-bold py-2 rounded-lg text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
          style={{ background: '#2B5F9E' }}
        >
          📘 عرض التقرير الكامل
        </button>
      </div>
    </div>
  );
}

// ─── Recommended legal actions ────────────────────────────────────────────────

const RECOMMENDED_LEGAL_ACTIONS = [
  { emoji: '📝', ar: 'تقديم تظلم إداري' },
  { emoji: '🗂',  ar: 'جمع الأدلة والمستندات' },
  { emoji: '⚖',  ar: 'رفع دعوى قضائية' },
  { emoji: '⏸',  ar: 'طلب وقف التنفيذ' },
  { emoji: '📋', ar: 'الطعن بالاستئناف' },
];

function RecommendedActionsBlock({ onAction }: { onAction: (a: string) => void }) {
  return (
    <div className="mt-3 pt-3 border-t border-border/30" dir="rtl">
      <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wide">الإجراء القانوني الموصى به</p>
      <div className="flex flex-wrap gap-1.5">
        {RECOMMENDED_LEGAL_ACTIONS.map(({ emoji, ar }) => (
          <button key={ar} type="button" onClick={() => onAction(ar)}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
          >
            <span>{emoji}</span>{ar}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Reliability block ────────────────────────────────────────────────────────

function ReliabilityRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-semibold ${warn ? 'text-amber-600' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function ReliabilityBlock({ citations, text }: { citations: Citation[]; text: string }) {
  const srcCount = citations.filter((c) => c.type === 'legal_source').length + (text.match(/\[SRC:\d+\]/g) ?? []).length;
  const docCount = citations.filter((c) => c.type === 'document').length   + (text.match(/\[DOC:\d+\]/g) ?? []).length;
  const total    = srcCount + docCount;

  // Degree of legal certainty — based on source count + conflict absence
  const conflictKw  = /تعارض|تناقض|في المقابل|بينما قرر|بينما أشار/.test(text);
  const certainty   = total >= 4 && !conflictKw ? 'عالية' : total >= 2 ? 'متوسطة' : 'منخفضة';
  const certaintyWarn = certainty === 'منخفضة';

  // Authority level
  const authority   = srcCount >= 3 ? 'تشريعية عليا' : srcCount >= 1 ? 'قانونية مقبولة' : 'توجيهية';

  // Citation integrity — flag if citations exist in text but not in resolved list
  const tokensInText = (text.match(/\[(DOC|SRC):\d+\]/g) ?? []).length;
  const resolved     = citations.length;
  const integrityOk  = resolved >= tokensInText;

  // Latest judgment heuristic — check for year mentions in text
  const yearMatch = text.match(/20(?:2[0-9]|1[5-9])/g);
  const latestYear = yearMatch ? Math.max(...yearMatch.map(Number)) : null;

  return (
    <div className="mt-2 rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 text-[11px] space-y-1.5" dir="rtl">
      <p className="font-bold text-foreground text-[11px] mb-1">تقرير الموثوقية القانونية</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <ReliabilityRow label="درجة اليقين القانوني" value={certainty} warn={certaintyWarn} />
        <ReliabilityRow label="مستوى السلطة"          value={authority} />
        <ReliabilityRow label="عدد المصادر"            value={`${total} مصدر`} />
        <ReliabilityRow label="أحدث تشريع"            value={`${new Date().getFullYear()}`} />
        <ReliabilityRow label="أحدث حكم مرصود"        value={latestYear ? `${latestYear}` : '—'} />
        <ReliabilityRow label="سلامة الاستشهاد"        value={integrityOk ? 'سليمة' : 'تحقق جزئي'} warn={!integrityOk && tokensInText > 0} />
      </div>
      <div className="pt-1.5 border-t border-border/30">
        <ReliabilityRow label="التعارضات المرصودة"
          value={conflictKw ? 'تم رصد تعارض محتمل' : 'لا تعارض مرصود'} warn={conflictKw} />
      </div>
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

function StreamingCursor() {
  return (
    <span
      className="inline-block w-0.5 h-3.5 bg-primary/70 ms-0.5 align-middle animate-pulse rounded-sm"
      aria-label="جاري الكتابة"
    />
  );
}

function MessageBubble({
  msg, displayMeta, onAction, actionDisabled, expertMode, applyAdvancedStandard, onDirectSend, isStreaming,
}: {
  msg: Message;
  displayMeta?: MsgDisplayMeta;
  onAction: (id: number, key: ActionKey, userQuery: string) => void;
  actionDisabled: boolean;
  expertMode: boolean;
  applyAdvancedStandard: boolean;
  onDirectSend: (text: string) => void;
  isStreaming?: boolean;
}) {
  const isUser = msg.role === 'user';
  const citations = (msg.meta?.citations ?? []) as Citation[];
  const [showSources, setShowSources] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const mode = displayMeta?.mode ?? 'professional';
  const userQuery = displayMeta?.userQuery ?? msg.content;
  const showShamsi = !isUser && !!displayMeta && (expertMode || applyAdvancedStandard || detectShamsiKeywords(userQuery));

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
              {isStreaming && !msg.content ? (
                /* Empty streaming message — show minimal typing indicator */
                <div className="flex items-center gap-1.5 py-1">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              ) : (
                <AssistantContent
                  content={msg.content}
                  citations={citations}
                  mode={mode}
                  isExpanded={isExpanded}
                  streamingCursor={isStreaming ? <StreamingCursor /> : undefined}
                />
              )}
              {/* Recommended actions + reliability — every complete assistant response */}
              {displayMeta && !isStreaming && (
                <>
                  <RecommendedActionsBlock
                    onAction={(a) => onDirectSend(`${a} بشأن: ${userQuery}`)}
                  />
                  <ReliabilityBlock citations={citations} text={msg.content} />
                </>
              )}
              {/* Action buttons */}
              {displayMeta && !isStreaming && (
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
              {/* Al-Shamsi Theory card — auto when keywords detected OR Expert Mode active */}
              {showShamsi && !isStreaming && (
                <ShamsiTheoryCard
                  onActivate={() => onAction(msg.id, 'shamsi', userQuery)}
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
  /** ID of the placeholder message currently being streamed in real-time */
  const [streamingMsgId, setStreamingMsgId] = useState<number | null>(null);
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

  // ── Pre-analysis config state ──────────────────────────────────────────────
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);
  const [expertMode, setExpertMode] = useState(false);
  const [expertOptions, setExpertOptions] = useState<ExpertOptions>(DEFAULT_EXPERT_OPTIONS);
  /** True once user dismisses the pre-analysis panel for the current session. */
  const [configCommitted, setConfigCommitted] = useState(false);

  // ── Stage 5 — Smart Administrative Court Mode ─────────────────────────────
  const [courtMode, setCourtMode] = useState(false);
  const [supremeCourtMode, setSupremeCourtMode] = useState(false);
  const [courtSession, setCourtSession] = useState<CourtSessionData | null>(null);
  const [courtLoading, setCourtLoading] = useState(false);

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
      setConfigCommitted(false); // show pre-analysis panel for new session
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

    const tempUserMsgId = Date.now();
    const userMsg: Message = {
      id: tempUserMsgId, sessionId: activeSession.id, role: 'user',
      content: text, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Build API content — config prefix + optional expert-mode instruction
    const configPfx = buildConfigPrefix(sessionConfig, expertMode, expertOptions);
    const content = configPfx + (mode === 'expert' ? EXPERT_MODE_PREFIX + text : text);

    const body = JSON.stringify({
      content,
      documentIds: pinnedDocs.length > 0 ? pinnedDocs : undefined,
      legalSourceIds: pinnedSrcs.length > 0 ? pinnedSrcs : undefined,
      theoryLensId: theoryLens.lensId !== 'uae_only' ? theoryLens.lensId : undefined,
      customTheoryText: theoryLens.lensId === 'custom' ? theoryLens.customText : undefined,
    });

    // ── Streaming path (NDJSON) ──────────────────────────────────────────────
    try {
      const streamR = await apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/x-ndjson' },
        body,
      });

      if (streamR.ok && streamR.headers.get('content-type')?.includes('ndjson') && streamR.body) {
        // Insert streaming placeholder
        const streamTempId = Date.now() + 1;
        setStreamingMsgId(streamTempId);
        const streamPlaceholder: Message = {
          id: streamTempId, sessionId: activeSession.id, role: 'assistant',
          content: '', createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, streamPlaceholder]);

        const reader = streamR.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = '';
        let fullContent = '';
        let receivedDone = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lineBuffer += decoder.decode(value, { stream: true });
            let newlineIdx: number;
            while ((newlineIdx = lineBuffer.indexOf('\n')) !== -1) {
              const line = lineBuffer.slice(0, newlineIdx).trim();
              lineBuffer = lineBuffer.slice(newlineIdx + 1);
              if (!line) continue;
              try {
                const parsed = JSON.parse(line) as Record<string, unknown>;
                if (typeof parsed.delta === 'string') {
                  fullContent += parsed.delta;
                  setMessages((prev) =>
                    prev.map((m) => m.id === streamTempId ? { ...m, content: fullContent } : m)
                  );
                } else if (parsed.done && parsed.message) {
                  receivedDone = true;
                  const finalMsg = parsed.message as Message;
                  const finalCitations = (parsed.citations ?? []) as Citation[];
                  const msgWithMeta: Message = {
                    ...finalMsg,
                    meta: { ...(finalMsg.meta ?? {}), citations: finalCitations },
                  };
                  setMsgDisplayMetaMap((prev) => ({
                    ...prev,
                    [finalMsg.id]: { mode, userQuery: text },
                  }));
                  setMessages((prev) =>
                    prev.map((m) => m.id === streamTempId ? msgWithMeta : m)
                  );
                  fetchSessions();
                } else if (parsed.error) {
                  toast({
                    title: t('خطأ في الإرسال', 'Send failed'),
                    description: String(parsed.error),
                    variant: 'destructive',
                  });
                  // Remove the streaming placeholder on server-emitted error
                  setMessages((prev) => prev.filter((m) => m.id !== streamTempId));
                }
              } catch { /* malformed NDJSON line — skip */ }
            }
          }
          // EOF without a `done` line — treat as a post-processing error on the server
          if (!receivedDone) {
            toast({
              title: t('انقطع الاتصال', 'Stream interrupted'),
              description: t('انتهى البث قبل اكتمال الرد', 'Stream ended before response completed'),
              variant: 'destructive',
            });
            // If we have partial content leave the bubble, otherwise remove it
            if (!fullContent) {
              setMessages((prev) => prev.filter((m) => m.id !== streamTempId));
            }
          }
        } catch (readerErr) {
          // Network / reader failure — remove placeholder, keep user message
          toast({
            title: t('خطأ في البث', 'Streaming error'),
            description: t('انقطع البث بشكل غير متوقع', 'Stream was interrupted unexpectedly'),
            variant: 'destructive',
          });
          setMessages((prev) => prev.filter((m) => m.id !== streamTempId));
        } finally {
          // Always release reader lock and clear streaming state
          try { reader.releaseLock(); } catch { /* already released */ }
          setStreamingMsgId(null);
        }
        return;
      }

      // ── Non-streaming fallback ─────────────────────────────────────────────
      if (streamR.ok) {
        const data = await streamR.json();
        setMsgDisplayMetaMap((prev) => ({
          ...prev,
          [data.message.id]: { mode, userQuery: text },
        }));
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsgId), userMsg, data.message]);
        fetchSessions();
      } else {
        const errData = await streamR.json().catch(() => ({}));
        toast({
          title: t('خطأ في الإرسال', 'Send failed'),
          description: (errData as { error?: string }).error,
          variant: 'destructive',
        });
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
      }
    } catch (fetchErr) {
      toast({
        title: t('خطأ في الاتصال', 'Connection error'),
        description: t('تعذّر الاتصال بالخادم', 'Could not reach the server'),
        variant: 'destructive',
      });
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  // ── Stage 5 — Court simulation streaming ─────────────────────────────────

  async function runCourtSession(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || !activeSession || sending || courtLoading) return;
    setInput('');
    setCourtLoading(true);
    setCourtSession({ caseText: text });

    try {
      const r = await apiFetch('/api/court/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/x-ndjson' },
        body: JSON.stringify({ caseText: text }),
      });

      if (!r.ok || !r.body) {
        const err = await r.json().catch(() => ({ error: 'Court simulation failed' }));
        toast({ title: t('خطأ في المحاكمة', 'Court error'), description: (err as { error?: string }).error, variant: 'destructive' });
        setCourtLoading(false);
        return;
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = lineBuffer.indexOf('\n')) !== -1) {
            const line = lineBuffer.slice(0, idx).trim();
            lineBuffer = lineBuffer.slice(idx + 1);
            if (!line) continue;
            try {
              const parsed = JSON.parse(line) as Record<string, unknown>;
              if (parsed.type === 'section') {
                const id = parsed.id as string;
                const data = parsed.data;
                setCourtSession((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev };
                  const isObj = (v: unknown): v is Record<string, unknown> =>
                    !!v && typeof v === 'object' && !Array.isArray(v);
                  if (id === 'facts'        && isObj(data))          next.facts              = data as unknown as CourtSessionData['facts'];
                  if (id === 'issues'       && isObj(data))          next.issues             = data as unknown as CourtSessionData['issues'];
                  if (id === 'claimant'     && Array.isArray(data))  next.claimantDefenses   = data as unknown as CourtSessionData['claimantDefenses'];
                  if (id === 'admin'        && Array.isArray(data))  next.adminDefenses      = data as unknown as CourtSessionData['adminDefenses'];
                  if (id === 'commissioner' && isObj(data))          next.commissionerReport = data as unknown as CourtSessionData['commissionerReport'];
                  if (id === 'shamsi'       && Array.isArray(data))  next.shamsiAnalysis     = data as unknown as CourtSessionData['shamsiAnalysis'];
                  if (id === 'judgment'     && isObj(data))          next.judgment           = data as unknown as CourtSessionData['judgment'];
                  if (id === 'operative'    && isObj(data))          next.operative          = data as unknown as CourtSessionData['operative'];
                  if (id === 'appeal'       && isObj(data))          next.appeal             = data as unknown as CourtSessionData['appeal'];
                  if (id === 'scores'       && isObj(data))          next.scores             = data as unknown as CourtSessionData['scores'];
                  // Project A — ASEP (normalize before storing to prevent runtime crashes)
                  if (id === 'asep' && isObj(data)) {
                    const raw = data as Record<string, unknown>;
                    const normalizedAnswers = Array.isArray(raw.answers)
                      ? (raw.answers as unknown[]).map((a: unknown) => {
                          const aa = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
                          return {
                            question:   String(aa.question   ?? ''),
                            answer:     String(aa.answer     ?? ''),
                            confidence: Math.min(100, Math.max(0, Number(aa.confidence ?? 0))),
                            flagged:    Boolean(aa.flagged),
                          };
                        })
                      : [];
                    next.asep = {
                      answers: normalizedAnswers,
                      overallExplainability: Math.min(100, Math.max(0, Number(raw.overallExplainability ?? 0))),
                      conclusion: String(raw.conclusion ?? ''),
                    };
                  }
                  return next;
                });
              } else if (parsed.type === 'component_failed') {
                // ARCHITECTURAL LOCK: record which mandatory component failed
                const component = String(parsed.component ?? '');
                if (component) {
                  setCourtSession((prev) => {
                    if (!prev) return prev;
                    const existing = prev.failedComponents ?? [];
                    if (existing.includes(component)) return prev;
                    return { ...prev, failedComponents: [...existing, component] };
                  });
                }
              } else if (parsed.type === 'done') {
                // ARCHITECTURAL LOCK: sessionComplete comes from server-authoritative done event
                const complete = parsed.complete === true;
                const failed   = Array.isArray(parsed.failedComponents)
                  ? (parsed.failedComponents as unknown[]).map(String)
                  : [];
                setCourtSession((prev) => prev
                  ? { ...prev, model: String(parsed.model ?? ''), sessionComplete: complete, failedComponents: failed }
                  : prev
                );
              } else if (parsed.type === 'error') {
                toast({ title: t('خطأ في المحاكمة', 'Court error'), description: String(parsed.message), variant: 'destructive' });
              }
            } catch { /* malformed line — skip */ }
          }
        }
      } finally {
        try { reader.releaseLock(); } catch { /* already released */ }
        setCourtLoading(false);
        // Auto-trigger supreme review if toggle is on
        if (supremeCourtMode) {
          // Use a microtask tick so courtLoading state has settled before runSupremeReview reads it
          setTimeout(() => runSupremeReview(text), 0);
        }
      }
    } catch (err) {
      toast({ title: t('خطأ في الاتصال', 'Connection error'), description: (err as Error).message, variant: 'destructive' });
      setCourtLoading(false);
    }
  }

  async function runSupremeReview(overrideCaseText?: string) {
    const reviewText = overrideCaseText ?? courtSession?.caseText;
    if (!reviewText) return;
    setCourtSession((prev) => prev ? { ...prev, supremeLoading: true } : prev);
    try {
      const r = await apiFetch('/api/court/supreme-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseText: reviewText }),
      });
      if (r.ok) {
        const data = await r.json();
        setCourtSession((prev) => prev ? { ...prev, supremeReview: data.result, supremeLoading: false } : prev);
      } else {
        toast({ title: t('خطأ', 'Error'), description: t('فشل اختبار المحكمة العليا', 'Supreme court review failed'), variant: 'destructive' });
        setCourtSession((prev) => prev ? { ...prev, supremeLoading: false } : prev);
      }
    } catch (err) {
      toast({ title: t('خطأ في الاتصال', 'Connection error'), description: (err as Error).message, variant: 'destructive' });
      setCourtSession((prev) => prev ? { ...prev, supremeLoading: false } : prev);
    }
  }

  /** Handle action button clicks from MessageBubble. */
  function handleAction(_msgId: number, key: ActionKey, userQuery: string) {
    if (key === 'expand' || key === 'collapse') return; // handled locally in ActionButtons
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (courtMode) runCourtSession(); else sendMessage();
    }
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
            {/* Expert Mode toggle */}
            <button
              type="button"
              onClick={() => setExpertMode((v) => !v)}
              className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors shrink-0 ${
                expertMode
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-border text-muted-foreground hover:bg-muted/30'
              }`}
              title={t('وضع الخبير', 'Expert Mode')}
            >
              ⭐ {expertMode ? t('مفعّل', 'Active') : t('وضع الخبير', 'Expert Mode')}
            </button>
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
            ) : courtMode && (courtLoading || courtSession) ? (
              <div className="overflow-y-auto flex-1 px-3 sm:px-4 py-3">
                <CourtSessionPanel
                  session={courtSession ?? { caseText: '' }}
                  loading={courtLoading}
                  onReset={() => { setCourtSession(null); }}
                  onSupremeReview={runSupremeReview}
                />
              </div>
            ) : messages.length === 0 ? (
              !configCommitted ? (
                <PreAnalysisPanel
                  config={sessionConfig}
                  onChange={setSessionConfig}
                  onStart={() => setConfigCommitted(true)}
                  expertMode={expertMode}
                  onToggleExpert={() => setExpertMode((v) => !v)}
                />
              ) : (
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
              )
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    displayMeta={msg.role === 'assistant' ? msgDisplayMetaMap[msg.id] : undefined}
                    onAction={handleAction}
                    actionDisabled={sending}
                    expertMode={expertMode}
                    applyAdvancedStandard={sessionConfig.applyAdvancedStandard}
                    onDirectSend={(text) => sendMessage(text, 'professional')}
                    isStreaming={streamingMsgId !== null && msg.id === streamingMsgId}
                  />
                ))}
                {/* Generic "waiting for response" indicator — only when NOT streaming (stream has its own cursor) */}
                {sending && streamingMsgId === null && (
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

            {/* Session config compact bar */}
            {activeSession && configCommitted && (
              <SessionConfigBar
                config={sessionConfig}
                expertMode={expertMode}
                onEdit={() => setConfigCommitted(false)}
              />
            )}

            {/* Expert options panel */}
            {activeSession && expertMode && configCommitted && (
              <ExpertOptionsPanel options={expertOptions} onChange={setExpertOptions} />
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
            {activeSession && !courtMode && (
              <div className="mb-2">
                <TheoryLensSelector
                  value={theoryLens}
                  onChange={setTheoryLens}
                  arabic={true}
                  disabled={sending || !canUseAi}
                />
              </div>
            )}

            {/* Stage 5 — Court mode toggles */}
            {activeSession && canUseAi && (
              <div className="mb-2 flex flex-wrap gap-2" dir="rtl">
                <button
                  type="button"
                  onClick={() => {
                    const next = !courtMode;
                    setCourtMode(next);
                    if (!next) { setSupremeCourtMode(false); setCourtSession(null); }
                  }}
                  disabled={sending || courtLoading}
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                    courtMode
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:border-amber-400 hover:text-amber-700'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  {courtMode ? '⚖️ جلسة محاكمة — فعّال' : '⚖️ جلسة محاكمة كاملة'}
                </button>

                {courtMode && (
                  <button
                    type="button"
                    onClick={() => setSupremeCourtMode((v) => !v)}
                    disabled={courtLoading}
                    className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                      supremeCourtMode
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-background text-muted-foreground border-border hover:border-purple-400 hover:text-purple-700'
                    }`}
                  >
                    🔬 {supremeCourtMode ? 'المحكمة العليا — فعّال' : 'اختبار المحكمة العليا'}
                  </button>
                )}
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
                className={`shrink-0 h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl ${courtMode ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' : ''}`}
                onClick={() => courtMode ? runCourtSession() : sendMessage()}
                disabled={!input.trim() || !activeSession || sending || courtLoading || !canUseAi}
                aria-label={courtMode ? t('محاكمة', 'Simulate') : t('إرسال', 'Send')}
                title={courtMode ? t('تشغيل جلسة المحاكمة', 'Run court session') : undefined}
              >
                {courtMode ? <Gavel className="w-4 h-4" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
