import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'wouter';
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
import type { GuidedAssistantConfig } from '@/lib/guided-assistant-config';

// ─── Judicial Command Center rebuild ───────────────────────────────────────────
// The assistant page is visually reduced to: conversation, input, legal-context
// selector, role selector and answer-mode selector only. All other panels below
// (sessions list/drawer, expert mode, pin panel, court toggles, lifecycle
// tracker, scenario inputs, extra config toggles) are kept fully functional in
// code — only their UI is hidden — so no module/route/logic is deleted.
const SHOW_LEGACY_CHAT_UI = false;

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
  // Judiciary
  | 'judge' | 'prosecutor'
  | 'judicial_trainee' | 'judge_first_instance' | 'judge_appeal' | 'judge_cassation'
  | 'judge_admin' | 'judge_criminal' | 'judge_civil' | 'judge_personal_status'
  // Prosecution
  | 'prosecution_member' | 'prosecution_deputy' | 'prosecution_first_deputy'
  | 'prosecution_chief' | 'public_attorney'
  // Legislative Authority
  | 'legislator' | 'legislative_committee'
  // Executive Authority
  | 'minister' | 'undersecretary' | 'director_general' | 'compliance_officer' | 'risk_officer' | 'government'
  // Legal Professions
  | 'lawyer' | 'legal_consultant' | 'professor' | 'researcher' | 'legal_author' | 'graduate_student'
  // Legal Specialisations (Stage 3)
  | 'admin_law_specialist' | 'constitutional_specialist' | 'criminal_specialist' | 'civil_specialist'
  // Academic & Training
  | 'law_student' | 'academic_researcher' | 'legal_intern'
  // Public Users
  | 'citizen' | 'institution'
  // General Public
  | 'general_user' | 'individual' | 'company_rep' | 'government_entity'
  // Law Enforcement — V3 (kept for backward compat)
  | 'police_officer_new' | 'evidence_officer' | 'investigation_officer'
  // Law Enforcement — V4.0 (9 specialized engines)
  | 'police_recruit_officer' | 'police_station_officer'
  | 'evidence_collection_officer' | 'criminal_investigation_officer'
  | 'forensic_laboratory_officer' | 'cybercrime_officer'
  | 'community_policing_officer' | 'child_protection_officer' | 'juvenile_affairs_officer'
  // Police Trainee (training group)
  | 'police_trainee'
  // Judicial intern (training group)
  | 'judicial_intern'
  // Enforcement / Execution Judge
  | 'enforcement_judge'
  // Legal professions expansion
  | 'arbitrator' | 'legislative_researcher'
  // Regulatory
  | 'regulatory_authority'
  // AI & Governance
  | 'ai_engineer' | 'algorithm_reviewer' | 'algorithmic_auditor'
  // Fallback
  | 'other' | 'unspecified';

type UserGoal =
  | 'understand' | 'legal_opinion' | 'judicial_judgment' | 'memorandum'
  | 'legislative_draft' | 'academic_research' | 'phd_thesis'
  | 'risk_assessment' | 'compliance_review' | 'ai_decision_analysis';

type ConfigAnswerMode = 'quick' | 'standard' | 'academic' | 'judicial' | 'memorandum' | 'legislative' | 'executive_report' | 'comparative' | 'scientific';
type Jurisdiction    = 'uae' | 'france' | 'saudi' | 'egypt' | 'eu' | 'gcc' | 'comparative' | 'other';

// ─── MLOS Hierarchical Legal Taxonomy ──────────────────────────────────────────
// "التصنيف القانوني الرئيسي" — exactly 4 top-level options.
type LegalDomain = 'public_law' | 'private_law' | 'criminal_law' | 'mixed_regulatory_law';
// "فرع القانون …" and "التخصص الدقيق" are plain string ids resolved at runtime
// against LEGAL_TAXONOMY (too many branch/specialization combinations for a
// union type to stay maintainable) — never indexed without going through
// getLegalBranchDef/getLegalSpecializationDef below.
// مصدر القانون — exactly 5 options (Al-Shamsi Theory and "other" removed).
type LawSource = 'uae_law' | 'french_law' | 'egyptian_law' | 'saudi_law' | 'comparative_law';
// شكل الإجابة — exactly 2 options.
type AnswerFormat = 'urgent_brief_answer' | 'specialized_legal_analysis';
// سيناريوهات التدريب والمراجعة القضائية الافتراضية — exactly 6 output types.
type TrainingOutputType =
  | 'legal_memorandum' | 'judicial_judgment' | 'legislative_draft'
  | 'executive_report' | 'comparative_study' | 'mini_academic_research';
// V5.0 — Professional Maturity levels (4 per profession group)
type MaturityLevel   = 'trainee' | 'junior' | 'mid' | 'expert';
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
  /** V5.0 — Professional Maturity Engine */
  maturityLevel: MaturityLevel;
  // ── MLOS Hierarchical Legal Taxonomy ────────────────────────────────────
  /** التصنيف القانوني الرئيسي — '' until the user picks one. */
  legalDomain: LegalDomain | '';
  /** فرع القانون [العام/الخاص/الجزائي/التنظيمي] — '' until applicable/chosen; cleared whenever legalDomain changes. */
  legalBranch: string;
  /** التخصص الدقيق — '' until applicable/chosen; cleared whenever legalBranch changes. */
  legalSpecialization: string;
  /** مصدر القانون — '' until the user picks one. */
  lawSource: LawSource | '';
  /** شكل الإجابة — '' until the user picks one. */
  answerFormat: AnswerFormat | '';
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
  userType: 'unspecified', userGoal: 'legal_opinion', answerMode: 'standard', jurisdiction: 'uae',
  sources: ['all'], citStyle: 'uae', depth: 'detailed',
  applyAdvancedStandard: false, comparativeMode: false,
  maturityLevel: 'mid',
  legalDomain: '', legalBranch: '', legalSpecialization: '', lawSource: '', answerFormat: '',
};

// ─── MLOS Hierarchical Legal Taxonomy — التصنيف القانوني الرئيسي → الفرع → التخصص الدقيق ──
interface LegalSpecializationDef { id: string; ar: string; }
interface LegalBranchDef { id: string; ar: string; specializations: LegalSpecializationDef[]; }
interface LegalDomainDef { ar: string; branches: LegalBranchDef[]; }

const LEGAL_TAXONOMY: Record<LegalDomain, LegalDomainDef> = {
  public_law: {
    ar: 'القانون العام',
    branches: [
      { id: 'constitutional_law', ar: 'القانون الدستوري', specializations: [
        { id: 'constitutional_review', ar: 'الرقابة الدستورية' },
        { id: 'rights_freedoms', ar: 'الحقوق والحريات' },
        { id: 'public_authorities', ar: 'السلطات العامة' },
        { id: 'constitutional_system', ar: 'النظام الدستوري' },
        { id: 'separation_of_powers', ar: 'الفصل بين السلطات' },
      ] },
      { id: 'administrative_law', ar: 'القانون الإداري', specializations: [
        { id: 'administrative_decision', ar: 'القرار الإداري' },
        { id: 'administrative_contracts', ar: 'العقود الإدارية' },
        { id: 'public_function', ar: 'الوظيفة العامة' },
        { id: 'administrative_control', ar: 'الضبط الإداري' },
        { id: 'public_facilities', ar: 'المرافق العامة' },
        { id: 'administrative_liability', ar: 'المسؤولية الإدارية' },
        { id: 'administrative_judiciary', ar: 'القضاء الإداري' },
      ] },
      { id: 'financial_tax_law', ar: 'القانون المالي والضريبي', specializations: [
        { id: 'public_budget', ar: 'الميزانية العامة' },
        { id: 'taxes', ar: 'الضرائب' },
        { id: 'fees', ar: 'الرسوم' },
        { id: 'public_expenditure', ar: 'الإنفاق العام' },
        { id: 'financial_control', ar: 'الرقابة المالية' },
      ] },
      { id: 'public_international_law', ar: 'القانون الدولي العام', specializations: [] },
      { id: 'human_rights_law', ar: 'حقوق الإنسان والحريات العامة', specializations: [] },
      { id: 'public_function_admin_org', ar: 'الوظيفة العامة والتنظيم الإداري', specializations: [] },
      { id: 'environmental_law', ar: 'القانون البيئي', specializations: [] },
    ],
  },
  private_law: {
    ar: 'القانون الخاص',
    branches: [
      { id: 'civil_law', ar: 'القانون المدني', specializations: [
        { id: 'contracts', ar: 'العقود' },
        { id: 'civil_liability', ar: 'المسؤولية المدنية' },
        { id: 'ownership', ar: 'الملكية' },
        { id: 'possession', ar: 'الحيازة' },
        { id: 'obligations', ar: 'الالتزامات' },
        { id: 'evidence', ar: 'الإثبات' },
      ] },
      { id: 'commercial_law', ar: 'القانون التجاري', specializations: [
        { id: 'commercial_papers', ar: 'الأوراق التجارية' },
        { id: 'bankruptcy', ar: 'الإفلاس' },
        { id: 'commercial_companies', ar: 'الشركات التجارية' },
        { id: 'commercial_business', ar: 'الأعمال التجارية' },
      ] },
      { id: 'companies_law', ar: 'قانون الشركات', specializations: [] },
      { id: 'labor_law', ar: 'قانون العمل', specializations: [
        { id: 'employment_contracts', ar: 'عقود العمل' },
        { id: 'termination_of_service', ar: 'إنهاء الخدمة' },
        { id: 'wages', ar: 'الأجور' },
        { id: 'work_injuries', ar: 'إصابات العمل' },
        { id: 'labor_disputes', ar: 'المنازعات العمالية' },
      ] },
      { id: 'personal_status_law', ar: 'الأحوال الشخصية', specializations: [] },
      { id: 'private_international_law', ar: 'القانون الدولي الخاص', specializations: [] },
      { id: 'intellectual_property_law', ar: 'الملكية الفكرية', specializations: [] },
      { id: 'insurance_law', ar: 'التأمين', specializations: [] },
      { id: 'maritime_law', ar: 'القانون البحري', specializations: [] },
      { id: 'aviation_law', ar: 'القانون الجوي', specializations: [] },
      { id: 'banking_law', ar: 'القانون المصرفي', specializations: [] },
    ],
  },
  criminal_law: {
    ar: 'القانون الجزائي / الجنائي',
    branches: [
      { id: 'penal_code', ar: 'قانون العقوبات', specializations: [
        { id: 'felonies', ar: 'الجنايات' },
        { id: 'misdemeanors', ar: 'الجنح' },
        { id: 'violations', ar: 'المخالفات' },
        { id: 'attempt', ar: 'الشروع' },
        { id: 'criminal_participation', ar: 'المساهمة الجنائية' },
      ] },
      { id: 'criminal_procedure', ar: 'الإجراءات الجزائية', specializations: [
        { id: 'gathering_evidence', ar: 'جمع الاستدلالات' },
        { id: 'preliminary_investigation', ar: 'التحقيق الابتدائي' },
        { id: 'search', ar: 'التفتيش' },
        { id: 'arrest', ar: 'القبض' },
        { id: 'interrogation', ar: 'الاستجواب' },
        { id: 'pretrial_detention', ar: 'الحبس الاحتياطي' },
        { id: 'referral_to_court', ar: 'الإحالة للمحكمة' },
      ] },
      { id: 'cybercrime', ar: 'الجرائم الإلكترونية', specializations: [
        { id: 'hacking', ar: 'الاختراق' },
        { id: 'electronic_fraud', ar: 'الاحتيال الإلكتروني' },
        { id: 'electronic_extortion', ar: 'الابتزاز الإلكتروني' },
        { id: 'technology_misuse', ar: 'إساءة استخدام التقنية' },
      ] },
      { id: 'economic_crimes', ar: 'الجرائم الاقتصادية', specializations: [] },
      { id: 'money_laundering', ar: 'غسل الأموال', specializations: [] },
      { id: 'drug_crimes', ar: 'المخدرات', specializations: [] },
      { id: 'international_crimes', ar: 'الجرائم الدولية', specializations: [] },
    ],
  },
  mixed_regulatory_law: {
    ar: 'القانون المختلط والتنظيمي',
    branches: [
      { id: 'ai_law', ar: 'قانون الذكاء الاصطناعي', specializations: [
        { id: 'algorithmic_liability', ar: 'المسؤولية الخوارزمية' },
        { id: 'algorithmic_transparency', ar: 'الشفافية الخوارزمية' },
        { id: 'algorithmic_bias', ar: 'التحيز الخوارزمي' },
        { id: 'digital_governance', ar: 'الحوكمة الرقمية' },
        { id: 'smart_administrative_decisions', ar: 'القرارات الإدارية الذكية' },
      ] },
      { id: 'data_protection_law', ar: 'حماية البيانات الشخصية', specializations: [] },
      { id: 'competition_law', ar: 'قانون المنافسة', specializations: [] },
      { id: 'investment_law', ar: 'قانون الاستثمار', specializations: [] },
      { id: 'financial_markets_law', ar: 'الأسواق المالية', specializations: [] },
      { id: 'government_procurement_law', ar: 'المشتريات الحكومية', specializations: [] },
      { id: 'energy_law', ar: 'الطاقة', specializations: [] },
      { id: 'telecom_law', ar: 'الاتصالات', specializations: [] },
    ],
  },
};

function getLegalBranchDef(domain: LegalDomain | '', branchId: string): LegalBranchDef | undefined {
  if (!domain || !branchId) return undefined;
  return LEGAL_TAXONOMY[domain].branches.find((b) => b.id === branchId);
}
function getLegalSpecializationDef(domain: LegalDomain | '', branchId: string, specId: string): LegalSpecializationDef | undefined {
  if (!specId) return undefined;
  return getLegalBranchDef(domain, branchId)?.specializations.find((s) => s.id === specId);
}

// ─── مصدر القانون ───────────────────────────────────────────────────────────
const LAW_SOURCE_CFG: Record<LawSource, { ar: string; jurisdiction: Jurisdiction; comparativeMode: boolean }> = {
  uae_law:         { ar: 'القانون الإماراتي', jurisdiction: 'uae',         comparativeMode: false },
  french_law:      { ar: 'القانون الفرنسي',   jurisdiction: 'france',      comparativeMode: false },
  egyptian_law:    { ar: 'القانون المصري',    jurisdiction: 'egypt',       comparativeMode: false },
  saudi_law:       { ar: 'القانون السعودي',   jurisdiction: 'saudi',       comparativeMode: false },
  comparative_law: { ar: 'القانون المقارن',   jurisdiction: 'comparative', comparativeMode: true },
};

// ─── شكل الإجابة ─────────────────────────────────────────────────────────────
const ANSWER_FORMAT_CFG: Record<AnswerFormat, { ar: string; instructions: string }> = {
  urgent_brief_answer: {
    ar: 'سريعة عاجلة ملخصة',
    instructions:
      '[شكل الإجابة: سريعة عاجلة ملخصة]\n' +
      'قدّم إجابة مباشرة في نقاط مختصرة، بنتيجة واضحة دون توسع طويل، مع بيان الأساس القانوني الأساسي فقط.\n',
  },
  specialized_legal_analysis: {
    ar: 'تحليل قانوني متخصص',
    instructions:
      '[شكل الإجابة: تحليل قانوني متخصص]\n' +
      'قدّم تحليلاً منظماً يشمل: تحديد الوقائع، تحديد المسائل القانونية، بيان القواعد القانونية، التطبيق القانوني، ثم النتيجة، ' +
      'مع الإشارة إلى المخاطر أو أوجه الاختلاف عند الحاجة.\n',
  },
};

// ─── سيناريوهات التدريب والمراجعة القضائية الافتراضية ───────────────────────
const TRAINING_OUTPUT_CFG: Record<TrainingOutputType, { ar: string; fields: string[] }> = {
  legal_memorandum: {
    ar: 'مذكرة قانونية',
    fields: ['العنوان', 'الوقائع', 'المسائل القانونية', 'القواعد الواجبة التطبيق', 'التحليل', 'الرأي القانوني', 'التوصيات'],
  },
  judicial_judgment: {
    ar: 'حكم قضائي',
    fields: ['المحكمة الافتراضية', 'الوقائع', 'الطلبات أو الاتهام', 'الأسباب', 'النصوص القانونية', 'المنطوق'],
  },
  legislative_draft: {
    ar: 'مسودة تشريعية',
    fields: ['عنوان التشريع', 'الديباجة', 'مواد مرقمة', 'أحكام تنفيذية', 'مذكرة إيضاحية مختصرة'],
  },
  executive_report: {
    ar: 'تقرير تنفيذي',
    fields: ['ملخص تنفيذي', 'المشكلة', 'التحليل', 'المخاطر', 'الخيارات', 'التوصية النهائية'],
  },
  comparative_study: {
    ar: 'دراسة مقارنة',
    fields: ['النظام الأول', 'النظام الثاني', 'أوجه الاتفاق', 'أوجه الاختلاف', 'التقييم', 'الخلاصة'],
  },
  mini_academic_research: {
    ar: 'بحث علمي مصغر',
    fields: ['عنوان', 'مقدمة', 'إشكالية', 'منهج مختصر', 'مباحث أو محاور', 'خاتمة', 'نتائج', 'مراجع مقترحة'],
  },
};

/** Builds the التصنيف القانوني الرئيسي → الفرع → التخصص الدقيق + مصدر القانون context line, sent with every request. */
function buildDomainAndSourceLine(config: SessionConfig): string {
  let line = '';
  if (config.legalDomain) {
    line += `التصنيف القانوني الرئيسي: ${LEGAL_TAXONOMY[config.legalDomain].ar}`;
    const branch = getLegalBranchDef(config.legalDomain, config.legalBranch);
    if (branch) {
      line += ` | فرع القانون: ${branch.ar}`;
      const spec = getLegalSpecializationDef(config.legalDomain, config.legalBranch, config.legalSpecialization);
      if (spec) line += ` | التخصص الدقيق: ${spec.ar}`;
    }
    line += '\n';
  }
  if (config.lawSource) {
    line += `مصدر القانون المعتمد: ${LAW_SOURCE_CFG[config.lawSource].ar}\n`;
  }
  return line;
}

/** Builds the الإجابة المباشرة (general question) request body, per المسار الأول. */
function buildGeneralRequestContent(config: SessionConfig, question: string): string {
  const fmt = config.answerFormat ? ANSWER_FORMAT_CFG[config.answerFormat].instructions : '';
  return buildDomainAndSourceLine(config) + fmt + '\n' + question;
}

/** Builds the سيناريوهات التدريب والمراجعة القضائية الافتراضية request body, per المسار الثاني. */
function buildTrainingRequestContent(config: SessionConfig, outputType: TrainingOutputType, scenarioText: string): string {
  const out = TRAINING_OUTPUT_CFG[outputType];
  const fmt = config.answerFormat ? ANSWER_FORMAT_CFG[config.answerFormat].instructions : '';
  const fieldsList = out.fields.map((f, i) => `${i + 1}) ${f}`).join('\n');
  return (
    buildDomainAndSourceLine(config) +
    `[سيناريوهات التدريب والمراجعة القضائية الافتراضية — نوع المخرج: ${out.ar}]\n` +
    `أَخرِج إجابتك حصراً وفق هذا الهيكل الإلزامي (${out.ar}):\n${fieldsList}\n` +
    fmt +
    `\nنص السيناريو التدريبي:\n${scenarioText}`
  );
}

const DEFAULT_EXPERT_OPTIONS: ExpertOptions = {
  confidence: true, reasoning: false, minority: false, burden: false, evidence: false,
  appealProb: false, gaps: false, latestJudgments: false, legislativeUpdates: false, actionPlan: false,
};

const USER_TYPE_CONFIG: Record<UserType, { ar: string; emoji: string }> = {
  // Judicial
  judge:                      { ar: 'قاضٍ',                          emoji: '⚖' },
  prosecutor:                 { ar: 'مدعٍ عام',                       emoji: '⚖' },
  judicial_trainee:           { ar: 'ملازم قضائي',                   emoji: '🎓' },
  judge_first_instance:       { ar: 'قاضٍ ابتدائي',                  emoji: '⚖' },
  judge_appeal:               { ar: 'قاضٍ استئناف',                  emoji: '⚖' },
  judge_cassation:            { ar: 'قاضٍ تمييز',                    emoji: '⚖' },
  judge_admin:                { ar: 'قاضٍ إداري',                    emoji: '🏛' },
  judge_criminal:             { ar: 'قاضٍ جزائي',                    emoji: '🔍' },
  judge_civil:                { ar: 'قاضٍ مدني',                     emoji: '⚖' },
  judge_personal_status:      { ar: 'قاضٍ أحوال شخصية',              emoji: '👨‍👩‍👧' },
  // Prosecution
  prosecution_member:         { ar: 'عضو نيابة',                     emoji: '⚖' },
  prosecution_deputy:         { ar: 'وكيل نيابة',                    emoji: '⚖' },
  prosecution_first_deputy:   { ar: 'وكيل نيابة أول',               emoji: '⚖' },
  prosecution_chief:          { ar: 'رئيس نيابة',                    emoji: '⚖' },
  public_attorney:            { ar: 'محامٍ عام',                     emoji: '⚖' },
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
  // Academic & Training
  law_student:            { ar: 'طالب قانون',                     emoji: '📖' },
  academic_researcher:    { ar: 'باحث أكاديمي',                   emoji: '🔬' },
  legal_intern:           { ar: 'متدرب قانوني',                   emoji: '📋' },
  // Public Users
  citizen:                { ar: 'مستخدم',                         emoji: '👤' },
  institution:            { ar: 'شركة / مؤسسة',                  emoji: '🏢' },
  // General Public
  general_user:           { ar: 'مستخدم عام',                     emoji: '👥' },
  individual:             { ar: 'فرد',                            emoji: '👤' },
  company_rep:            { ar: 'ممثل شركة',                      emoji: '🏢' },
  government_entity:      { ar: 'جهة حكومية',                     emoji: '🏛' },
  // Law Enforcement — V3 legacy
  police_officer_new:              { ar: 'ضابط شرطة جديد',               emoji: '👮' },
  evidence_officer:                { ar: 'ضابط جمع الأدلة',              emoji: '🔎' },
  investigation_officer:           { ar: 'ضابط التحقيق الجنائي',         emoji: '🕵️' },
  // Law Enforcement — V4.0
  police_recruit_officer:          { ar: 'ضابط حديث التعيين',            emoji: '👮' },
  police_station_officer:          { ar: 'ضابط مركز شرطة',               emoji: '🚔' },
  evidence_collection_officer:     { ar: 'ضابط جمع الاستدلالات',         emoji: '🔎' },
  criminal_investigation_officer:  { ar: 'ضابط التحقيق الجنائي',         emoji: '🕵️' },
  forensic_laboratory_officer:     { ar: 'ضابط الأدلة الجنائية',         emoji: '🧬' },
  cybercrime_officer:              { ar: 'ضابط الجرائم الإلكترونية',     emoji: '💻' },
  community_policing_officer:      { ar: 'ضابط الشرطة المجتمعية',        emoji: '🤝' },
  child_protection_officer:        { ar: 'ضابط حماية الطفل',             emoji: '🛡️' },
  juvenile_affairs_officer:        { ar: 'ضابط الأحداث',                 emoji: '👦' },
  // Training roles
  police_trainee:                  { ar: 'متدرب شرطي',                   emoji: '📋' },
  judicial_intern:                 { ar: 'متدرب قضائي',                  emoji: '📋' },
  // Judicial expansion
  enforcement_judge:               { ar: 'قاضي تنفيذ',                   emoji: '⚖️' },
  // Legal professions expansion
  arbitrator:                      { ar: 'محكم',                         emoji: '🤝' },
  legislative_researcher:          { ar: 'باحث تشريعي',                  emoji: '📜' },
  // Regulatory
  regulatory_authority:   { ar: 'ممثل جهة تنظيمية',              emoji: '🏦' },
  // AI & Governance
  ai_engineer:            { ar: 'مهندس أنظمة ذكية',              emoji: '🤖' },
  algorithm_reviewer:     { ar: 'مدقق خوارزميات',                emoji: '🔍' },
  algorithmic_auditor:    { ar: 'مدقق الامتثال الخوارزمي',       emoji: '🔬' },
  // Fallback
  other:                  { ar: 'أخرى',                           emoji: '•' },
  unspecified:            { ar: 'غير محدد',                       emoji: '–' },
};

// ─── V4.0 Professional Identities — 35 entries, 8 groups (1+4+9+4+8+3+2+4) ───
const PRIMARY_IDENTITIES: { value: UserType; labelAr: string; groupAr: string; emoji: string }[] = [
  // ■ العموم
  { value: 'citizen',                       labelAr: 'مستخدم',                       groupAr: 'العموم',                            emoji: '👤' },
  // ■ التعليم والتدريب
  { value: 'law_student',                   labelAr: 'طالب قانون',                  groupAr: 'التعليم والتدريب',                  emoji: '📖' },
  { value: 'academic_researcher',           labelAr: 'باحث أكاديمي',                groupAr: 'التعليم والتدريب',                  emoji: '🔬' },
  { value: 'judicial_intern',               labelAr: 'متدرب قضائي',                 groupAr: 'التعليم والتدريب',                  emoji: '📋' },
  { value: 'police_trainee',                labelAr: 'متدرب شرطي',                  groupAr: 'التعليم والتدريب',                  emoji: '📋' },
  // ■ الشرطة والتحقيق
  { value: 'police_recruit_officer',        labelAr: 'ضابط حديث التعيين',           groupAr: 'الشرطة والتحقيق',                   emoji: '👮' },
  { value: 'police_station_officer',        labelAr: 'ضابط مركز شرطة',              groupAr: 'الشرطة والتحقيق',                   emoji: '🚔' },
  { value: 'evidence_collection_officer',   labelAr: 'ضابط جمع الاستدلالات',        groupAr: 'الشرطة والتحقيق',                   emoji: '🔎' },
  { value: 'criminal_investigation_officer',labelAr: 'ضابط التحقيق الجنائي',        groupAr: 'الشرطة والتحقيق',                   emoji: '🕵️' },
  { value: 'forensic_laboratory_officer',   labelAr: 'ضابط الأدلة الجنائية',        groupAr: 'الشرطة والتحقيق',                   emoji: '🧬' },
  { value: 'cybercrime_officer',            labelAr: 'ضابط الجرائم الإلكترونية',    groupAr: 'الشرطة والتحقيق',                   emoji: '💻' },
  { value: 'community_policing_officer',    labelAr: 'ضابط الشرطة المجتمعية',       groupAr: 'الشرطة والتحقيق',                   emoji: '🤝' },
  { value: 'child_protection_officer',      labelAr: 'ضابط حماية الطفل',            groupAr: 'الشرطة والتحقيق',                   emoji: '🛡️' },
  { value: 'juvenile_affairs_officer',      labelAr: 'ضابط الأحداث',                groupAr: 'الشرطة والتحقيق',                   emoji: '👦' },
  // ■ النيابة العامة
  { value: 'prosecution_member',            labelAr: 'وكيل نيابة جديد',             groupAr: 'النيابة العامة',                    emoji: '⚖️' },
  { value: 'prosecution_deputy',            labelAr: 'وكيل نيابة',                  groupAr: 'النيابة العامة',                    emoji: '⚖️' },
  { value: 'prosecution_chief',             labelAr: 'رئيس نيابة',                  groupAr: 'النيابة العامة',                    emoji: '⚖️' },
  { value: 'public_attorney',               labelAr: 'محامٍ عام',                   groupAr: 'النيابة العامة',                    emoji: '⚖️' },
  // ■ القضاء
  { value: 'judicial_trainee',              labelAr: 'ملازم قضائي',                 groupAr: 'القضاء',                            emoji: '🎓' },
  { value: 'judge_first_instance',          labelAr: 'قاضٍ ابتدائي',               groupAr: 'القضاء',                            emoji: '⚖️' },
  { value: 'judge_criminal',                labelAr: 'قاضٍ جزائي',                  groupAr: 'القضاء',                            emoji: '⚖️' },
  { value: 'judge_admin',                   labelAr: 'قاضٍ إداري',                  groupAr: 'القضاء',                            emoji: '🏛️' },
  { value: 'enforcement_judge',             labelAr: 'قاضي تنفيذ',                  groupAr: 'القضاء',                            emoji: '⚖️' },
  { value: 'judge_personal_status',         labelAr: 'قاضي أحوال شخصية',           groupAr: 'القضاء',                            emoji: '👨‍👩‍👧' },
  { value: 'judge_appeal',                  labelAr: 'قاضي استئناف',                groupAr: 'القضاء',                            emoji: '⚖️' },
  { value: 'judge_cassation',               labelAr: 'قاضي تمييز',                  groupAr: 'القضاء',                            emoji: '⚖️' },
  // ■ المحاماة والاستشارات
  { value: 'lawyer',                        labelAr: 'محامٍ',                        groupAr: 'المحاماة والاستشارات',               emoji: '🧑‍⚖️' },
  { value: 'legal_consultant',              labelAr: 'مستشار قانوني',               groupAr: 'المحاماة والاستشارات',               emoji: '🧑‍⚖️' },
  { value: 'arbitrator',                    labelAr: 'محكم',                         groupAr: 'المحاماة والاستشارات',               emoji: '🤝' },
  // ■ السلطة التشريعية
  { value: 'legislator',                    labelAr: 'مشرّع',                        groupAr: 'السلطة التشريعية',                  emoji: '📜' },
  { value: 'legislative_researcher',        labelAr: 'باحث تشريعي',                  groupAr: 'السلطة التشريعية',                  emoji: '📜' },
  // ■ الجهات الحكومية والتنظيمية
  { value: 'minister',                      labelAr: 'صانع سياسات',                 groupAr: 'الجهات الحكومية والتنظيمية',        emoji: '🏛️' },
  { value: 'government',                    labelAr: 'ممثل جهة حكومية',             groupAr: 'الجهات الحكومية والتنظيمية',        emoji: '🏛️' },
  { value: 'regulatory_authority',          labelAr: 'ممثل جهة تنظيمية',            groupAr: 'الجهات الحكومية والتنظيمية',        emoji: '🏦' },
  { value: 'compliance_officer',            labelAr: 'مسؤول امتثال',                groupAr: 'الجهات الحكومية والتنظيمية',        emoji: '✅' },
];

// Role groups — used internally (not directly by the new dropdown, but kept for search/future use)
const USER_TYPE_GROUPS: { labelAr: string; icon: string; types: UserType[] }[] = [
  { labelAr: 'العموم',                             icon: '👤',  types: ['citizen', 'general_user', 'individual', 'other', 'unspecified'] },
  { labelAr: 'التعليم والتدريب',                   icon: '🎓',  types: ['law_student', 'academic_researcher', 'judicial_intern', 'police_trainee', 'legal_intern', 'graduate_student'] },
  { labelAr: 'الشرطة والتحقيق',                   icon: '👮',  types: ['police_recruit_officer', 'police_station_officer', 'evidence_collection_officer', 'criminal_investigation_officer', 'forensic_laboratory_officer', 'cybercrime_officer', 'community_policing_officer', 'child_protection_officer', 'juvenile_affairs_officer'] },
  { labelAr: 'النيابة العامة',                     icon: '⚖️',  types: ['prosecution_member', 'prosecution_deputy', 'prosecution_chief', 'public_attorney', 'prosecutor', 'prosecution_first_deputy'] },
  { labelAr: 'القضاء',                             icon: '⚖️',  types: ['judicial_trainee', 'judge_first_instance', 'judge_criminal', 'judge_admin', 'enforcement_judge', 'judge_personal_status', 'judge_appeal', 'judge_cassation', 'judge_civil', 'judge'] },
  { labelAr: 'المحاماة والاستشارات',               icon: '🧑‍⚖️', types: ['lawyer', 'legal_consultant', 'arbitrator', 'researcher'] },
  { labelAr: 'السلطة التشريعية',                   icon: '📜',  types: ['legislator', 'legislative_researcher', 'legislative_committee'] },
  { labelAr: 'الجهات الحكومية والتنظيمية',         icon: '🏛️', types: ['minister', 'government', 'regulatory_authority', 'compliance_officer', 'undersecretary', 'director_general', 'government_entity', 'risk_officer'] },
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
  quick:            { ar: 'سريع',                  emoji: '⚡' },
  standard:         { ar: 'إجابة مفصلة',           emoji: '📘' },
  academic:         { ar: 'تحليل قانوني متخصص',    emoji: '🎓' },
  memorandum:       { ar: 'مذكرة قانونية',         emoji: '⚖' },
  judicial:         { ar: 'حكم قضائي',             emoji: '🏛' },
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
  gcc:         { ar: 'دول مجلس التعاون',        flag: '🌙' },
  comparative: { ar: 'قانون مقارن',              flag: '🌐' },
  other:       { ar: 'أخرى',                     flag: '🌐' },
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
  /** Fallback step-by-step reasoning path (used when outputStructureAr is absent). */
  reasoningSequenceAr: string[];
  /** Summary output labels. */
  outputsAr: string[];
  /** Professional Persona Engine — response behaviour rules per the PPE spec. */
  characteristicsAr?: string[];
  /** Professional Persona Engine — binding numbered output sections per the PPE spec. */
  outputStructureAr?: string[];
}

const ROLE_ENGINES: Partial<Record<UserType, RoleEngine>> = {

  // ══ PPE Mode 3 (First Instance Judge) ══
  // Shared by: judge, judge_criminal, judge_civil, judge_personal_status, judge_admin
  judge: {
    nameAr: 'قاضٍ — محرك التحليل القضائي الابتدائي',
    reasoningSequenceAr: ['الوقائع الثابتة','التكييف القانوني','تحليل الأدلة','الاستدلال القضائي','الحكم المقترح'],
    outputsAr: ['التحليل القضائي','الحكم المقترح','إمكانية الطعن'],
    characteristicsAr: [
      'التركيز على تقييم الأدلة وقيمتها الإثباتية',
      'تقدير مشروعية الإجراءات المتخذة',
      'تحليل عبء الإثبات وتوزيعه',
      'بناء الاستدلال القضائي المُعلَّل',
      'إعداد مسودة النتائج القضائية',
      'تقييم العيوب الإجرائية وسُبل معالجتها',
    ],
    outputStructureAr: [
      'الوقائع الثابتة — ما أثبتته الأدلة بشكل قاطع',
      'التكييف القانوني — وصف الواقعة قانونياً وتحديد النص المنطبق',
      'تحليل الأدلة — قيمة كل دليل ومدى كفايته للإثبات',
      'الاستدلال القضائي — مسار التفكير من الوقائع إلى الحكم',
      'الحكم المقترح — المنطوق المُعلَّل مع الإشارة إلى سُبل الطعن',
    ],
  },

  // ══ PPE Mode 5 (Prosecution) ══
  // Shared by: prosecutor, prosecution_member, prosecution_deputy, prosecution_first_deputy, prosecution_chief, public_attorney
  prosecutor: {
    nameAr: 'عضو النيابة العامة — محرك التحقيق والادعاء',
    reasoningSequenceAr: ['السلوك المُدَّعى به','الأركان القانونية','الأدلة المطلوبة','الإجراءات التحقيقية','التوصية'],
    outputsAr: ['تقييم الأدلة','الإجراءات التحقيقية','توصية الإحالة أو الحفظ'],
    characteristicsAr: [
      'تحديد أركان الجريمة المُدَّعى بها',
      'تحديد الأدلة المطلوبة لإثبات كل ركن',
      'إبراز خطوات التحقيق الضرورية',
      'تقييم مدى كفاية الأدلة المتوفرة',
      'اقتراح الإجراءات الإجرائية المناسبة',
    ],
    outputStructureAr: [
      'السلوك المُدَّعى به — وصف الوقائع وتحديد طبيعتها الجنائية',
      'الأركان القانونية — عناصر الجريمة الواجب إثباتها',
      'الأدلة المطلوبة — ما يجب تأمينه وطرق الحصول عليه',
      'الإجراءات التحقيقية — الخطوات الواجب اتخاذها فوراً',
      'التوصية — الإحالة للمحاكمة أو الحفظ مع التعليل',
    ],
  },

  // ══ PPE Mode 7 (Legislator) ══
  // Shared by: legislator, legislative_committee
  legislator: {
    nameAr: 'المشرِّع — محرك التحليل التشريعي والإصلاح',
    reasoningSequenceAr: ['الإطار القانوني القائم','الفجوات التشريعية','المقاربات المقارنة','مقترحات الإصلاح','النص التشريعي المقترح'],
    outputsAr: ['التوصية التشريعية','مسودة التعديل','الأثر المتوقع'],
    characteristicsAr: [
      'رصد الفجوات التشريعية وتحديدها بدقة',
      'تحليل الأثر السياساتي للتشريع المقترح',
      'اقتراح الإصلاحات التشريعية المناسبة',
      'المقارنة مع التجارب الدولية ذات الصلة',
      'صياغة مقترحات تشريعية محددة',
    ],
    outputStructureAr: [
      'الإطار القانوني القائم — النصوص النافذة والسند القانوني الحالي',
      'الفجوات التشريعية — ما يغيب عن التشريع أو يُسبِّب خللاً',
      'المقاربات المقارنة — كيف عالجت تشريعات أخرى المسألة ذاتها',
      'مقترحات الإصلاح — التعديلات الموصى بها مع مبرراتها',
      'النص التشريعي المقترح — صياغة مادة أو تعديل جاهز للنقاش',
    ],
  },

  legislative_committee: {
    nameAr: 'اللجنة التشريعية — محرك مراجعة التشريع',
    reasoningSequenceAr: ['الإطار القانوني القائم','الفجوات التشريعية','المقاربات المقارنة','مقترحات الإصلاح','النص التشريعي المقترح'],
    outputsAr: ['التوصية التشريعية','مسودة التعديل','الأثر المتوقع'],
    characteristicsAr: [
      'رصد الفجوات التشريعية وتحديدها بدقة',
      'تحليل الأثر السياساتي للتشريع المقترح',
      'اقتراح الإصلاحات التشريعية المناسبة',
      'المقارنة مع التجارب الدولية ذات الصلة',
      'صياغة مقترحات تشريعية محددة',
    ],
    outputStructureAr: [
      'الإطار القانوني القائم — النصوص النافذة والسند القانوني الحالي',
      'الفجوات التشريعية — ما يغيب عن التشريع أو يُسبِّب خللاً',
      'المقاربات المقارنة — كيف عالجت تشريعات أخرى المسألة ذاتها',
      'مقترحات الإصلاح — التعديلات الموصى بها مع مبرراتها',
      'النص التشريعي المقترح — صياغة مادة أو تعديل جاهز للنقاش',
    ],
  },

  // ══ PPE Mode 8 (Researcher) ══
  // Shared by: researcher, graduate_student, professor, academic_researcher
  researcher: {
    nameAr: 'الباحث القانوني — محرك التحليل الأكاديمي',
    reasoningSequenceAr: ['مشكلة البحث','التحليل الفقهي','التحليل المقارن','الجدل الأكاديمي','خاتمة البحث'],
    outputsAr: ['الهيكل البحثي الأكاديمي','المراجع الجوهرية','الإسهام المعرفي'],
    characteristicsAr: [
      'تطبيق التحليل الفقهي الدقيق',
      'عرض مقاربات القانون المقارن',
      'رصد الجدل الفقهي والخلافات العلمية',
      'إبراز التوجهات القضائية والفقهية',
      'توثيق المراجع وتوضيح المنهجية',
    ],
    outputStructureAr: [
      'مشكلة البحث — تحديد الإشكالية القانونية وفرضياتها',
      'التحليل الفقهي — الموقف العلمي من النص والحكم',
      'التحليل المقارن — كيف تعاملت الأنظمة القانونية الأخرى مع المسألة',
      'الجدل الأكاديمي — آراء الفقهاء المتباينة ومسوّغات كل رأي',
      'خاتمة البحث — الاستنتاج العلمي والإسهام في المعرفة القانونية',
    ],
  },

  graduate_student: {
    nameAr: 'طالب الدراسات العليا — محرك البحث الأكاديمي',
    reasoningSequenceAr: ['مشكلة البحث','التحليل الفقهي','التحليل المقارن','الجدل الأكاديمي','خاتمة البحث'],
    outputsAr: ['الهيكل البحثي الأكاديمي','المراجع المقترحة','توجهات البحث المستقبلي'],
    characteristicsAr: [
      'تطبيق التحليل الفقهي الدقيق',
      'عرض مقاربات القانون المقارن',
      'رصد الجدل الفقهي والخلافات العلمية',
      'إبراز التوجهات القضائية والفقهية',
      'توثيق المراجع وتوضيح المنهجية',
    ],
    outputStructureAr: [
      'مشكلة البحث — تحديد الإشكالية القانونية وفرضياتها',
      'التحليل الفقهي — الموقف العلمي من النص والحكم',
      'التحليل المقارن — كيف تعاملت الأنظمة القانونية الأخرى مع المسألة',
      'الجدل الأكاديمي — آراء الفقهاء المتباينة ومسوّغات كل رأي',
      'خاتمة البحث — الاستنتاج العلمي والإسهام في المعرفة القانونية',
    ],
  },

  // ══ PPE Mode 1 (Student) ══
  // Shared by: law_student, legal_intern
  law_student: {
    nameAr: 'طالب القانون — المحرك التعليمي',
    reasoningSequenceAr: ['التعريف القانوني','المبدأ القانوني','النص التشريعي','مثال تطبيقي','الخلاصة'],
    outputsAr: ['شرح مبسط للدراسة','النصوص القانونية المرجعية','أمثلة تطبيقية'],
    characteristicsAr: [
      'شرح المفاهيم القانونية بلغة واضحة ومبسطة',
      'تعريف المصطلحات القانونية قبل استخدامها',
      'شرح المبادئ القانونية قبل تطبيقها',
      'ذكر أمثلة توضيحية من الواقع العملي',
      'تقديم شرح تعليمي منهجي',
      'تحديد الفقه القانوني ذي الصلة',
      'اقتراح مراجع ومصادر قراءة إضافية',
      'التركيز على الفهم والاستيعاب لا على الممارسة العملية',
    ],
    outputStructureAr: [
      'التعريف القانوني — تعريف المفهوم القانوني بلغة واضحة مع شرح المصطلحات',
      'المبدأ القانوني — القاعدة القانونية التي تحكم المسألة وسندها الفقهي',
      'النص التشريعي — المواد القانونية المنطبقة مع شرح تبسيطي لمضمونها',
      'مثال تطبيقي — حالة عملية توضح تطبيق القاعدة على واقعة ملموسة',
      'الخلاصة — التلخيص التعليمي مع اقتراح مراجع للتعمق في الموضوع',
    ],
  },

  // General Public — plain-language guidance
  general_user: {
    nameAr: 'المستخدم العام — الإرشاد القانوني بلغة واضحة',
    reasoningSequenceAr: [
      'فهم المشكلة بمصطلحات يومية',
      'الحقوق والالتزامات الأساسية',
      'الخيارات المتاحة',
      'الخطوات العملية الموصى بها',
      'متى يجب استشارة محامٍ',
    ],
    outputsAr: [
      'إجابة واضحة بلغة بسيطة',
      'الخطوات العملية',
      'تنبيهات مهمة',
    ],
  },

  individual: {
    nameAr: 'الفرد — الإرشاد القانوني الشخصي',
    reasoningSequenceAr: [
      'فهم الوضع الشخصي',
      'الحقوق القانونية للفرد',
      'الخيارات المتاحة',
      'المسار الأنسب للحل',
      'متى يجب استشارة محامٍ',
    ],
    outputsAr: [
      'الحقوق المتاحة',
      'الخطوات العملية',
      'المخاطر والتنبيهات',
    ],
  },

  company_rep: {
    nameAr: 'ممثل الشركة — الإرشاد التجاري والقانوني',
    reasoningSequenceAr: [
      'تحديد المسألة التجارية والقانونية',
      'الإطار التنظيمي المنطبق على الشركات',
      'التزامات الامتثال',
      'المخاطر القانونية',
      'الخيارات والحلول المتاحة',
      'التوصيات العملية للإدارة',
    ],
    outputsAr: [
      'ملخص المخاطر القانونية',
      'متطلبات الامتثال',
      'التوصيات العملية',
    ],
  },

  // Fallback engines
  unspecified: {
    nameAr: 'المستخدم — التحليل القانوني العام',
    reasoningSequenceAr: [
      'تحديد المسألة القانونية',
      'النصوص القانونية ذات الصلة',
      'التحليل القانوني',
      'الاستنتاج والتوصيات',
    ],
    outputsAr: [
      'التحليل القانوني',
      'التوصيات',
    ],
  },

  other: {
    nameAr: 'مستخدم آخر — التحليل القانوني العام',
    reasoningSequenceAr: [
      'تحديد المسألة القانونية',
      'النصوص القانونية ذات الصلة',
      'التحليل القانوني',
      'الاستنتاج والتوصيات',
    ],
    outputsAr: [
      'التحليل القانوني',
      'التوصيات',
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

  // ══ PPE Mode 8 (Researcher) — shared by professor ══
  professor: {
    nameAr: 'الأستاذ / الأكاديمي — محرك التحليل الأكاديمي',
    reasoningSequenceAr: ['مشكلة البحث','التحليل الفقهي','التحليل المقارن','الجدل الأكاديمي','خاتمة البحث'],
    outputsAr: ['ملاحظات المحاضرة','مخرجات التعلم','الإسهام المعرفي'],
    characteristicsAr: [
      'تطبيق التحليل الفقهي الدقيق',
      'عرض مقاربات القانون المقارن',
      'رصد الجدل الفقهي والخلافات العلمية',
      'إبراز التوجهات القضائية والفقهية',
      'توثيق المراجع وتوضيح المنهجية',
    ],
    outputStructureAr: [
      'مشكلة البحث — تحديد الإشكالية القانونية وفرضياتها',
      'التحليل الفقهي — الموقف العلمي من النص والحكم',
      'التحليل المقارن — كيف تعاملت الأنظمة القانونية الأخرى مع المسألة',
      'الجدل الأكاديمي — آراء الفقهاء المتباينة ومسوّغات كل رأي',
      'خاتمة البحث — الاستنتاج العلمي والإسهام في المعرفة القانونية',
    ],
  },

  // ══ PPE Mode 6 (Lawyer) ══
  // Shared by: lawyer, legal_consultant
  lawyer: {
    nameAr: 'المحامي — محرك الدفاع والتمثيل القانوني',
    reasoningSequenceAr: ['موقف الموكل','الحجج القانونية','الدفوع الإجرائية','الخيارات الاستراتيجية','المقاربة الموصى بها'],
    outputsAr: ['الرأي القانوني المهني','استراتيجية الدفاع','المخاطر والفرص','خطة الإجراء القانوني'],
    characteristicsAr: [
      'تحديد الحجج القانونية لصالح الموكل',
      'رصد الدفوع الإجرائية المتاحة',
      'اقتراح الخيارات الاستراتيجية البديلة',
      'تقييم نقاط القوة والضعف في الموقف',
      'إعداد استراتيجية التقاضي',
    ],
    outputStructureAr: [
      'موقف الموكل — تحديد مصلحة الموكل والحقوق المطالَب بها أو المدافَع عنها',
      'الحجج القانونية — أقوى الحجج الموضوعية لصالح الموكل مع سندها القانوني',
      'الدفوع الإجرائية — العيوب الإجرائية والبطلانات التي يمكن التمسك بها',
      'الخيارات الاستراتيجية — بدائل المسار (المفاوضة / التسوية / التقاضي / الطعن)',
      'المقاربة الموصى بها — أفضل استراتيجية مع تقييم الخطر والعائد المتوقع',
    ],
  },

  legal_consultant: {
    nameAr: 'المستشار القانوني — محرك الاستشارة القانونية',
    reasoningSequenceAr: ['موقف الموكل','الحجج القانونية','الدفوع الإجرائية','الخيارات الاستراتيجية','المقاربة الموصى بها'],
    outputsAr: ['الرأي القانوني المهني','الخيارات الاستراتيجية','تقييم المخاطر'],
    characteristicsAr: [
      'تحديد الحجج القانونية لصالح الموكل',
      'رصد الدفوع الإجرائية المتاحة',
      'اقتراح الخيارات الاستراتيجية البديلة',
      'تقييم نقاط القوة والضعف في الموقف',
      'إعداد استراتيجية التقاضي',
    ],
    outputStructureAr: [
      'موقف الموكل — تحديد مصلحة الموكل والحقوق المطالَب بها أو المدافَع عنها',
      'الحجج القانونية — أقوى الحجج الموضوعية لصالح الموكل مع سندها القانوني',
      'الدفوع الإجرائية — العيوب الإجرائية والبطلانات التي يمكن التمسك بها',
      'الخيارات الاستراتيجية — بدائل المسار (المفاوضة / التسوية / التقاضي / الطعن)',
      'المقاربة الموصى بها — أفضل استراتيجية مع تقييم الخطر والعائد المتوقع',
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

  // ── PPE Mode 2 (Judicial Trainee) ──

  judicial_trainee: {
    nameAr: 'الملازم القضائي — المحرك التعليمي القضائي',
    reasoningSequenceAr: ['الوقائع ذات الصلة','المسائل القانونية','القانون المنطبق','الاستدلال القضائي','توجه الحكم'],
    outputsAr: ['شرح تعليمي مرحلي','مسار التفكير القضائي','تنبيهات إجرائية'],
    characteristicsAr: [
      'تحديد الوقائع ذات الأثر القانوني والتمييز بينها وبين الوقائع غير الجوهرية',
      'التمييز بين الوقائع المادية والوقائع الجانبية',
      'رصد الإشكاليات الإجرائية التي قد تؤثر على سير الدعوى',
      'إبراز متطلبات الإثبات لكل عنصر من عناصر الدعوى',
      'شرح منهجية الاستدلال القضائي خطوة بخطوة',
      'إيضاح المسار من الوقائع إلى القانون إلى الحكم',
    ],
    outputStructureAr: [
      'الوقائع ذات الصلة — تحديد الوقائع المؤثرة قانوناً وتمييزها عن غيرها',
      'المسائل القانونية — تحديد الأسئلة القانونية الجوهرية التي يجب الفصل فيها',
      'القانون المنطبق — النصوص التشريعية والسوابق القضائية الحاكمة',
      'الاستدلال القضائي — مسار التفكير من الوقائع إلى القانون مع شرح تعليمي',
      'توجه الحكم — مسودة الاتجاه القضائي المُوجَّه مع بيان أسبابه',
    ],
  },

  // ── PPE Mode 3 (First Instance Judge) ——

  judge_first_instance: {
    nameAr: 'القاضٍ الابتدائي — محرك التحليل القضائي الابتدائي',
    reasoningSequenceAr: ['الوقائع الثابتة','التكييف القانوني','تحليل الأدلة','الاستدلال القضائي','الحكم المقترح'],
    outputsAr: ['الحكم المقترح مع التعليل','نقاط الطعن المحتملة','الإشكاليات الإجرائية'],
    characteristicsAr: [
      'التركيز على تقييم الأدلة وقيمتها الإثباتية',
      'تقدير مشروعية الإجراءات المتخذة',
      'تحليل عبء الإثبات وتوزيعه',
      'بناء الاستدلال القضائي المُعلَّل',
      'إعداد مسودة النتائج القضائية',
      'تقييم العيوب الإجرائية وسُبل معالجتها',
    ],
    outputStructureAr: [
      'الوقائع الثابتة — ما أثبتته الأدلة بشكل قاطع',
      'التكييف القانوني — وصف الواقعة قانوناً وتحديد النص المنطبق',
      'تحليل الأدلة — قيمة كل دليل ومدى كفايته للإثبات',
      'الاستدلال القضائي — مسار التفكير من الوقائع إلى الحكم',
      'الحكم المقترح — المنطوق المُعلَّل مع الإشارة إلى سُبل الطعن',
    ],
  },

  judge_admin: {
    nameAr: 'القاضٍ الإداري — محرك التحليل القضائي الإداري',
    reasoningSequenceAr: ['الوقائع الثابتة','التكييف القانوني','تحليل الأدلة','الاستدلال القضائي','الحكم المقترح'],
    outputsAr: ['الحكم بالإلغاء أو الرفض','التعويض المقترح','المبدأ الإداري المُرسَّخ'],
    characteristicsAr: [
      'التركيز على مشروعية القرار الإداري (السبب · المحل · الإجراء · الشكل · الغاية)',
      'تقدير التناسب بين القرار والهدف المشروع منه',
      'تحليل عبء الإثبات في القضاء الإداري',
      'بناء الاستدلال القضائي الإداري المُعلَّل',
    ],
    outputStructureAr: [
      'الوقائع الثابتة — الوقائع المؤثرة في مشروعية القرار الإداري',
      'التكييف القانوني — تحديد نوع القرار الإداري والنص المنطبق',
      'تحليل الأدلة — مدى إثبات عيب من عيوب المشروعية',
      'الاستدلال القضائي — مسار التفكير من العيب المثبت إلى الحكم',
      'الحكم المقترح — الإلغاء أو الرفض أو التعويض مع التعليل',
    ],
  },

  judge_criminal: {
    nameAr: 'القاضٍ الجزائي — محرك التحليل الجنائي القضائي',
    reasoningSequenceAr: ['الوقائع الثابتة','التكييف القانوني','تحليل الأدلة','الاستدلال القضائي','الحكم المقترح'],
    outputsAr: ['التكييف الجنائي','العقوبة المقررة','جدوى الطعن'],
    characteristicsAr: [
      'التركيز على تقييم الأدلة وكفايتها لإثبات أركان الجريمة',
      'تحليل عبء الإثبات وافتراض البراءة',
      'بناء الاستدلال القضائي الجنائي المُعلَّل',
    ],
    outputStructureAr: [
      'الوقائع الثابتة — الأفعال المادية المثبتة بالأدلة',
      'التكييف القانوني — الجريمة المنطبقة وأركانها المثبتة',
      'تحليل الأدلة — قيمة كل دليل ودرجة اليقين الإثباتي',
      'الاستدلال القضائي — مسار التفكير من الوقائع إلى الإدانة أو البراءة',
      'الحكم المقترح — المنطوق مع تحديد العقوبة وسُبل الطعن',
    ],
  },

  judge_civil: {
    nameAr: 'القاضٍ المدني — محرك التحليل المدني القضائي',
    reasoningSequenceAr: ['الوقائع الثابتة','التكييف القانوني','تحليل الأدلة','الاستدلال القضائي','الحكم المقترح'],
    outputsAr: ['الحكم المدني','التعويض المقدَّر','قوة الدعوى'],
    characteristicsAr: [
      'التركيز على تقييم الأدلة في المسائل المدنية',
      'تحليل عبء الإثبات وتوزيعه بين الأطراف',
      'بناء الاستدلال القضائي المدني',
    ],
    outputStructureAr: [
      'الوقائع الثابتة — الوقائع المؤثرة في العلاقة المدنية',
      'التكييف القانوني — تحديد طبيعة الالتزام والنص المنطبق',
      'تحليل الأدلة — كفاية الإثبات على الإخلال والضرر',
      'الاستدلال القضائي — مسار التفكير من الإخلال إلى المسؤولية',
      'الحكم المقترح — الإلزام أو الرفض مع تحديد التعويض المقدَّر',
    ],
  },

  judge_personal_status: {
    nameAr: 'قاضٍ الأحوال الشخصية — محرك التحليل القضائي الشرعي',
    reasoningSequenceAr: ['الوقائع الثابتة','التكييف القانوني','تحليل الأدلة','الاستدلال القضائي','الحكم المقترح'],
    outputsAr: ['الحكم الشرعي والقانوني','حقوق الأطراف','التوصيات الحمائية'],
    characteristicsAr: [
      'التركيز على تقييم الأدلة في قضايا الأحوال الشخصية',
      'مراعاة المصالح الفضلى للأطراف الضعفاء (الأطفال والمرأة)',
      'تطبيق أحكام الشريعة الإسلامية والقانون الشخصي',
    ],
    outputStructureAr: [
      'الوقائع الثابتة — الوقائع المؤثرة في العلاقة الأسرية',
      'التكييف القانوني — تحديد الحكم الشرعي والقانون الواجب التطبيق',
      'تحليل الأدلة — مدى إثبات الوقائع المؤثرة في الحقوق والالتزامات',
      'الاستدلال القضائي — مسار التفكير مع مراعاة المصالح الحمائية',
      'الحكم المقترح — القرار مع تحديد حقوق كل طرف والتوصيات الحمائية',
    ],
  },

  // ── PPE Mode 4 (Appeal Judge) ──

  judge_appeal: {
    nameAr: 'القاضٍ الاستئنافي — محرك مراجعة الحكم الابتدائي',
    reasoningSequenceAr: ['أوجه الطعن','المراجعة القانونية','الأخطاء المُحددة','الاستدلال الاستئنافي','النتيجة المقترحة'],
    outputsAr: ['توجه محكمة الاستئناف','جوانب التعديل المحتملة','احتمالية النقض'],
    characteristicsAr: [
      'التركيز على أخطاء القانون في الحكم المطعون فيه',
      'مراجعة العيوب الإجرائية',
      'فحص جودة الاستدلال القضائي في الحكم الابتدائي',
      'تقييم التناسب ومدى المشروعية',
      'تحديد أسباب التأييد أو النقض',
    ],
    outputStructureAr: [
      'أوجه الطعن — أسباب الاستئناف التي أثارها المستأنف',
      'المراجعة القانونية — تقييم صحة تطبيق القانون في الحكم المطعون فيه',
      'الأخطاء المُحددة — أخطاء القانون أو الإجراء أو التسبيب إن وُجدت',
      'الاستدلال الاستئنافي — المسار القانوني للتأييد أو التعديل أو الإلغاء',
      'النتيجة المقترحة — تأييد أو تعديل أو إلغاء مع التعليل القانوني',
    ],
  },

  judge_cassation: {
    nameAr: 'القاضٍ في محكمة التمييز — محرك الرقابة القانونية العليا',
    reasoningSequenceAr: ['أوجه الطعن','المراجعة القانونية','الأخطاء المُحددة','الاستدلال الاستئنافي','النتيجة المقترحة'],
    outputsAr: ['قابلية الطعن للقبول','احتمالية النقض','المبدأ القانوني المستخلص'],
    characteristicsAr: [
      'التركيز على أخطاء القانون في الحكم المطعون فيه',
      'مراجعة العيوب الإجرائية في الأحكام المطعون فيها',
      'فحص جودة الاستدلال القضائي في الحكم المطعون فيه',
      'تقييم التناسب ومدى المشروعية',
      'تحديد أسباب التأييد أو النقض',
    ],
    outputStructureAr: [
      'أوجه الطعن — أسباب الطعن بالتمييز المُثارة شكلاً',
      'المراجعة القانونية — تقييم مدى صحة تطبيق القانون في مرحلتي التقاضي',
      'الأخطاء المُحددة — مواطن المخالفة القانونية أو القصور في التسبيب',
      'الاستدلال الاستئنافي — المسار القانوني للنقض أو الرفض',
      'النتيجة المقترحة — نقض أو رفض مع تحديد المبدأ القانوني المُرسَّخ',
    ],
  },

  // ── PPE Mode 5 (Prosecution) — shared by all prosecution roles ──

  prosecution_member: {
    nameAr: 'عضو النيابة العامة — محرك التحقيق والادعاء',
    reasoningSequenceAr: ['السلوك المُدَّعى به','الأركان القانونية','الأدلة المطلوبة','الإجراءات التحقيقية','التوصية'],
    outputsAr: ['التوصية بالتحقيق أو الحفظ','الإجراءات الفورية المطلوبة','الأدلة الواجب تأمينها'],
    characteristicsAr: [
      'تحديد أركان الجريمة المُدَّعى بها',
      'تحديد الأدلة المطلوبة لإثبات كل ركن',
      'إبراز خطوات التحقيق الضرورية',
      'تقييم مدى كفاية الأدلة المتوفرة',
      'اقتراح الإجراءات الإجرائية المناسبة',
    ],
    outputStructureAr: [
      'السلوك المُدَّعى به — وصف الوقائع وتحديد طبيعتها الجنائية',
      'الأركان القانونية — عناصر الجريمة الواجب إثباتها',
      'الأدلة المطلوبة — ما يجب تأمينه وطرق الحصول عليه',
      'الإجراءات التحقيقية — الخطوات الواجب اتخاذها فوراً',
      'التوصية — الإحالة للمحاكمة أو الحفظ مع التعليل',
    ],
  },

  prosecution_deputy: {
    nameAr: 'وكيل النيابة — محرك الاستدلال والادعاء',
    reasoningSequenceAr: ['السلوك المُدَّعى به','الأركان القانونية','الأدلة المطلوبة','الإجراءات التحقيقية','التوصية'],
    outputsAr: ['قرار الإحالة أو الحفظ','التكييف الجنائي','نقاط الاتهام'],
    characteristicsAr: [
      'تحديد أركان الجريمة المُدَّعى بها',
      'تحديد الأدلة المطلوبة لإثبات كل ركن',
      'إبراز خطوات التحقيق الضرورية',
      'تقييم مدى كفاية الأدلة المتوفرة',
      'اقتراح الإجراءات الإجرائية المناسبة',
    ],
    outputStructureAr: [
      'السلوك المُدَّعى به — وصف الوقائع وتحديد طبيعتها الجنائية',
      'الأركان القانونية — عناصر الجريمة الواجب إثباتها',
      'الأدلة المطلوبة — ما يجب تأمينه وطرق الحصول عليه',
      'الإجراءات التحقيقية — الخطوات الواجب اتخاذها فوراً',
      'التوصية — الإحالة للمحاكمة أو الحفظ مع التعليل',
    ],
  },

  prosecution_first_deputy: {
    nameAr: 'وكيل النيابة الأول — محرك الادعاء المتقدم',
    reasoningSequenceAr: ['السلوك المُدَّعى به','الأركان القانونية','الأدلة المطلوبة','الإجراءات التحقيقية','التوصية'],
    outputsAr: ['قرار الإحالة أو الحفظ','توجيهات التحقيق'],
    characteristicsAr: [
      'تحديد أركان الجريمة المُدَّعى بها',
      'تقييم مدى كفاية الأدلة المتوفرة',
      'اقتراح الإجراءات الإجرائية المناسبة',
    ],
    outputStructureAr: [
      'السلوك المُدَّعى به — وصف الوقائع وتحديد طبيعتها الجنائية',
      'الأركان القانونية — عناصر الجريمة الواجب إثباتها',
      'الأدلة المطلوبة — ما يجب تأمينه وطرق الحصول عليه',
      'الإجراءات التحقيقية — الخطوات الواجب اتخاذها فوراً',
      'التوصية — الإحالة للمحاكمة أو الحفظ مع التعليل',
    ],
  },

  prosecution_chief: {
    nameAr: 'رئيس النيابة — محرك الإشراف القضائي',
    reasoningSequenceAr: ['السلوك المُدَّعى به','الأركان القانونية','الأدلة المطلوبة','الإجراءات التحقيقية','التوصية'],
    outputsAr: ['القرار النهائي','التوجيهات الإجرائية'],
    characteristicsAr: [
      'مراجعة كفاية الأدلة المتوفرة',
      'الإشراف على سلامة الإجراءات',
      'اتخاذ قرار الإحالة النهائي',
    ],
    outputStructureAr: [
      'السلوك المُدَّعى به — وصف الوقائع وتحديد طبيعتها الجنائية',
      'الأركان القانونية — عناصر الجريمة الواجب إثباتها',
      'الأدلة المطلوبة — تقييم كفاية الأدلة الحالية',
      'الإجراءات التحقيقية — توجيهات التحقيق إذا لزم الأمر',
      'التوصية — القرار النهائي بالإحالة أو الحفظ مع التعليل',
    ],
  },

  public_attorney: {
    nameAr: 'المحامي العام — محرك الادعاء أمام المحاكم العليا',
    reasoningSequenceAr: ['السلوك المُدَّعى به','الأركان القانونية','الأدلة المطلوبة','الإجراءات التحقيقية','التوصية'],
    outputsAr: ['الموقف القانوني للنيابة','الحجج أمام المحكمة'],
    characteristicsAr: [
      'تحديد أركان الجريمة وتقييم الأدلة',
      'صياغة الحجج القانونية أمام المحاكم العليا',
    ],
    outputStructureAr: [
      'السلوك المُدَّعى به — وصف الوقائع وتحديد طبيعتها الجنائية',
      'الأركان القانونية — عناصر الجريمة الواجب إثباتها',
      'الأدلة المطلوبة — ما يجب الاحتجاج به أمام المحكمة',
      'الإجراءات التحقيقية — متطلبات الإجراءات أمام المحكمة العليا',
      'التوصية — موقف النيابة العامة وطلباتها',
    ],
  },

  // ── PPE Mode 8 (Researcher) — academic_researcher ──

  academic_researcher: {
    nameAr: 'الباحث الأكاديمي — محرك التحليل الأكاديمي المتخصص',
    reasoningSequenceAr: ['مشكلة البحث','التحليل الفقهي','التحليل المقارن','الجدل الأكاديمي','خاتمة البحث'],
    outputsAr: ['الهيكل البحثي الأكاديمي','المراجع الجوهرية','الإسهام المعرفي'],
    characteristicsAr: [
      'تطبيق التحليل الفقهي الدقيق',
      'عرض مقاربات القانون المقارن',
      'رصد الجدل الفقهي والخلافات العلمية',
      'إبراز التوجهات القضائية والفقهية',
      'توثيق المراجع وتوضيح المنهجية',
    ],
    outputStructureAr: [
      'مشكلة البحث — تحديد الإشكالية القانونية وفرضياتها',
      'التحليل الفقهي — الموقف العلمي من النص والحكم',
      'التحليل المقارن — كيف تعاملت الأنظمة القانونية الأخرى مع المسألة',
      'الجدل الأكاديمي — آراء الفقهاء المتباينة ومسوّغات كل رأي',
      'خاتمة البحث — الاستنتاج العلمي والإسهام في المعرفة القانونية',
    ],
  },

  // ── PPE Mode 1 (Student) — legal_intern ──

  legal_intern: {
    nameAr: 'المتدرب القانوني — المحرك التعليمي التطبيقي',
    reasoningSequenceAr: ['التعريف القانوني','المبدأ القانوني','النص التشريعي','مثال تطبيقي','الخلاصة'],
    outputsAr: ['شرح مبسط للمسألة','القانون المنطبق','الخطوات العملية'],
    characteristicsAr: [
      'شرح المفاهيم القانونية بلغة واضحة ومبسطة',
      'تعريف المصطلحات القانونية قبل استخدامها',
      'شرح المبادئ القانونية قبل تطبيقها على الوقائع',
      'ذكر أمثلة توضيحية من الواقع العملي',
      'تقديم شرح تعليمي منهجي ومتدرج',
      'تحديد الفقه القانوني ذي الصلة بالمسألة',
      'اقتراح مراجع ومصادر قراءة إضافية للتعمق',
      'التركيز على الفهم والاستيعاب لا على الممارسة المتقدمة',
    ],
    outputStructureAr: [
      'التعريف القانوني — تعريف المفهوم القانوني بلغة واضحة مع شرح المصطلحات',
      'المبدأ القانوني — القاعدة القانونية التي تحكم المسألة',
      'النص التشريعي — المواد القانونية المنطبقة مع شرح تبسيطي لمضمونها',
      'مثال تطبيقي — حالة عملية توضح تطبيق القاعدة على واقعة ملموسة',
      'الخلاصة — التلخيص التعليمي مع اقتراح مراجع للتعمق',
    ],
  },

  // ── PPE Mode 9 (Policy Maker) ──

  minister: {
    nameAr: 'الوزير — محرك السياسات العامة والقرار الحكومي',
    reasoningSequenceAr: ['الهدف العام','المخاطر','الانعكاسات الحوكمية','خيارات السياسة','التوصية'],
    outputsAr: ['ملخص السياسة','تقييم المخاطر','التوصيات الاستراتيجية'],
    characteristicsAr: [
      'التركيز على الأثر العام للسياسة أو القرار',
      'تحليل مخاطر التنفيذ',
      'تقييم انعكاسات الحوكمة',
      'مراعاة الجدوى التشغيلية',
      'إعداد توصيات سياساتية واضحة',
    ],
    outputStructureAr: [
      'الهدف العام — المصلحة العامة التي يسعى القرار إلى تحقيقها',
      'المخاطر — المخاطر التشغيلية والقانونية والمالية المحتملة',
      'الانعكاسات الحوكمية — الأثر على الهياكل التنظيمية والرقابية',
      'خيارات السياسة — البدائل المتاحة مع تقييم كل منها',
      'التوصية — الخيار الأمثل مع خطة التنفيذ المقترحة',
    ],
  },

  undersecretary: {
    nameAr: 'وكيل الوزارة — محرك التحليل السياساتي التنفيذي',
    reasoningSequenceAr: ['الهدف العام','المخاطر','الانعكاسات الحوكمية','خيارات السياسة','التوصية'],
    outputsAr: ['تقرير السياسة','تقييم التنفيذ','التوصيات'],
    characteristicsAr: [
      'التركيز على الأثر العام للسياسة أو القرار',
      'تحليل مخاطر التنفيذ',
      'تقييم انعكاسات الحوكمة',
      'مراعاة الجدوى التشغيلية',
    ],
    outputStructureAr: [
      'الهدف العام — المصلحة العامة التي يسعى القرار إلى تحقيقها',
      'المخاطر — المخاطر التشغيلية والقانونية والمالية المحتملة',
      'الانعكاسات الحوكمية — الأثر على الهياكل التنظيمية والرقابية',
      'خيارات السياسة — البدائل المتاحة مع تقييم كل منها',
      'التوصية — الخيار الأمثل مع خطة التنفيذ المقترحة',
    ],
  },

  director_general: {
    nameAr: 'المدير العام — محرك التحليل المؤسسي والتنفيذي',
    reasoningSequenceAr: ['الهدف العام','المخاطر','الانعكاسات الحوكمية','خيارات السياسة','التوصية'],
    outputsAr: ['الإطار المؤسسي','تقييم المخاطر','خطة التنفيذ'],
    characteristicsAr: [
      'التركيز على الأثر التشغيلي للقرار على المؤسسة',
      'تحليل مخاطر التنفيذ على مستوى الجهة',
      'مراعاة الجدوى التشغيلية والموارد المتاحة',
    ],
    outputStructureAr: [
      'الهدف العام — المصلحة المؤسسية التي يسعى القرار إلى تحقيقها',
      'المخاطر — المخاطر التشغيلية والقانونية المحتملة على مستوى الجهة',
      'الانعكاسات الحوكمية — الأثر على الهياكل التنظيمية الداخلية',
      'خيارات السياسة — البدائل التنفيذية المتاحة',
      'التوصية — الخيار الأمثل مع خطة التنفيذ',
    ],
  },

  government: {
    nameAr: 'الجهة الحكومية — محرك الإرشاد القانوني الحكومي',
    reasoningSequenceAr: ['الهدف العام','المخاطر','الانعكاسات الحوكمية','خيارات السياسة','التوصية'],
    outputsAr: ['ملخص الوضع القانوني','متطلبات الامتثال','التوصيات'],
    characteristicsAr: [
      'التركيز على الأثر العام للقرار على المصلحة العامة',
      'تحليل مخاطر التنفيذ والامتثال',
      'مراعاة الجدوى التشغيلية',
    ],
    outputStructureAr: [
      'الهدف العام — المصلحة العامة التي يسعى القرار إلى تحقيقها',
      'المخاطر — مخاطر عدم الامتثال والمخاطر القانونية',
      'الانعكاسات الحوكمية — الأثر على الهياكل الرقابية',
      'خيارات السياسة — البدائل المتاحة',
      'التوصية — الخيار الأمثل مع متطلبات الامتثال',
    ],
  },

  // ── General Public / Fallback engines ──
  government_entity: {
    nameAr: 'الجهة الحكومية — الإرشاد القانوني المؤسسي',
    reasoningSequenceAr: ['الهدف العام','المخاطر','الانعكاسات الحوكمية','خيارات السياسة','التوصية'],
    outputsAr: ['ملخص الوضع القانوني','متطلبات الامتثال','التوصيات'],
    characteristicsAr: [
      'التركيز على الأثر المؤسسي للقرار',
      'تحليل متطلبات الامتثال',
      'مراعاة الجدوى التشغيلية',
    ],
    outputStructureAr: [
      'الهدف العام — المصلحة المؤسسية المستهدفة',
      'المخاطر — مخاطر عدم الامتثال والمخاطر القانونية',
      'الانعكاسات الحوكمية — الأثر على الهياكل الرقابية',
      'خيارات السياسة — البدائل المتاحة للجهة',
      'التوصية — الخيار الأمثل مع متطلبات الامتثال',
    ],
  },

  // ── PPE — Police Roles (Special Police Module) ──

  police_officer_new: {
    nameAr: 'ضابط الشرطة الجديد — محرك الإجراءات الأساسية',
    reasoningSequenceAr: ['الإجراء المطلوب','السند القانوني','ضمانات الحقوق','التسلسل الإجرائي','الاستنتاج'],
    outputsAr: ['الإجراء الصحيح','ضمانات الحقوق المراعاة','تحذيرات إجرائية'],
    characteristicsAr: [
      'شرح الإجراءات الأساسية بخطوات واضحة ومرقّمة',
      'تحديد السند القانوني لكل إجراء',
      'إبراز الضمانات القانونية لحقوق الموقوف / المشتبه به',
      'التنبيه إلى العيوب الإجرائية التي تُبطل الدليل',
      'توضيح التسلسل الإجرائي الواجب اتباعه',
    ],
    outputStructureAr: [
      'الإجراء المطلوب — ما الخطوة الصحيحة في هذا الموقف؟',
      'السند القانوني — النص القانوني المجيز لهذا الإجراء',
      'ضمانات الحقوق — الحقوق الواجب مراعاتها وحمايتها',
      'التسلسل الإجرائي — الخطوات بترتيبها الصحيح',
      'تحذيرات إجرائية — ما قد يُبطل الدليل أو يُعرض القضية للبطلان',
    ],
  },

  police_station_officer: {
    nameAr: 'ضابط مركز الشرطة — محرك إدارة القضية',
    reasoningSequenceAr: ['تسجيل الواقعة','جمع الأدلة','إدارة الشهود','الإجراء الإجرائي','الاستنتاج'],
    outputsAr: ['الإجراء الصحيح لتسجيل البلاغ','قائمة الأدلة المطلوبة','التوصية الإجرائية'],
    characteristicsAr: [
      'توجيه إجراءات تسجيل القضية بدقة',
      'تحديد الأدلة الواجب جمعها وحفظها فوراً',
      'بيان آليات التعامل مع الشهود',
      'ضبط مسرح الجريمة وفق المعايير الإجرائية',
      'التحقق من الامتثال للإجراءات القانونية',
    ],
    outputStructureAr: [
      'تسجيل الواقعة — كيفية توثيق البلاغ ومضمون المحضر',
      'جمع الأدلة — قائمة الأدلة المطلوبة وطريقة حفظها',
      'إدارة الشهود — الأسلوب الإجرائي الصحيح للتعامل مع الشهود',
      'الإجراء الإجرائي — الخطوات المنهجية المطلوبة',
      'التوصية — الإجراء الفوري الواجب اتخاذه',
    ],
  },

  evidence_officer: {
    nameAr: 'ضابط جمع الأدلة — محرك سلسلة الحيازة',
    reasoningSequenceAr: ['الأدلة المادية','سلسلة الحيازة','التوثيق','التنسيق الجنائي','الاستنتاج'],
    outputsAr: ['قائمة الأدلة المطلوبة','متطلبات توثيق سلسلة الحيازة','التوصية الجنائية'],
    characteristicsAr: [
      'ضبط إجراءات جمع الأدلة المادية وفق المعايير القانونية',
      'التحقق من سلامة سلسلة الحيازة',
      'توضيح متطلبات التوثيق الإجرائي الكافي',
      'بيان إجراءات التنسيق مع خبراء الأدلة الجنائية',
      'تحديد الأدلة الناقصة وكيفية تأمينها',
    ],
    outputStructureAr: [
      'الأدلة المادية — ما يجب جمعه وكيفية التعامل معه',
      'سلسلة الحيازة — خطوات الحفاظ على سلامة الأدلة من اللحظة الأولى',
      'التوثيق — المتطلبات الإجرائية لإثبات مسار الدليل',
      'التنسيق الجنائي — متى ولماذا يُطلب الخبير الجنائي',
      'الأدلة الناقصة — ما لم يُجمع بعد وكيفية تأمينه',
    ],
  },

  investigation_officer: {
    nameAr: 'ضابط التحقيق الجنائي — محرك استراتيجية التحقيق',
    reasoningSequenceAr: ['استراتيجية التحقيق','أساليب الاستجواب','كفاية الأدلة','جاهزية الإحالة','الاستنتاج'],
    outputsAr: ['خطة التحقيق','تقييم كفاية الأدلة','قرار الإحالة أو الاستمرار'],
    characteristicsAr: [
      'بناء استراتيجية تحقيق منهجية',
      'تحديد أساليب الاستجواب القانونية والفعّالة',
      'تقييم كفاية الأدلة لكل ركن من أركان الجريمة',
      'قياس جاهزية الملف للإحالة إلى النيابة العامة',
      'تحديد المعلومات الناقصة وسُبل الحصول عليها',
    ],
    outputStructureAr: [
      'استراتيجية التحقيق — المسار المنهجي لاستكمال التحقيق',
      'أساليب الاستجواب — التقنيات القانونية للحصول على شهادات موثوقة',
      'كفاية الأدلة — تقييم قوة الملف لإثبات كل ركن جنائي',
      'جاهزية الإحالة — هل الملف مكتمل للإحالة؟ وما الناقص؟',
      'التوصية — الاستمرار في التحقيق أو الإحالة مع التبرير',
    ],
  },

  // ── PPE — Regulatory Authority ──

  regulatory_authority: {
    nameAr: 'ممثل الجهة التنظيمية — محرك الامتثال التنظيمي',
    reasoningSequenceAr: ['الإطار التنظيمي','آليات الرقابة','صلاحيات الإنفاذ','متطلبات الامتثال','التوصية'],
    outputsAr: ['تقييم الامتثال','آليات الرقابة المناسبة','الإجراء التنفيذي الموصى به'],
    characteristicsAr: [
      'تحليل الإطار التنظيمي المنطبق على المسألة',
      'تحديد آليات الرقابة والمتابعة المناسبة',
      'بيان صلاحيات الإنفاذ والجزاءات المتاحة',
      'تقييم مستوى الامتثال ونقاط الضعف',
      'اقتراح الإجراء التنفيذي المناسب',
    ],
    outputStructureAr: [
      'الإطار التنظيمي — الأنظمة واللوائح المنطبقة على الحالة',
      'آليات الرقابة — أدوات الإشراف والمتابعة المتاحة',
      'صلاحيات الإنفاذ — الجزاءات والتدابير التنفيذية المقررة قانوناً',
      'تقييم الامتثال — مستوى الامتثال الحالي ونقاط الضعف الجوهرية',
      'التوصية — الإجراء التنفيذي الأنسب مع تبريره القانوني',
    ],
  },

  // ── V4.0 — Specialized Police Engines ──────────────────────────────────────

  police_recruit_officer: {
    nameAr: 'ضابط حديث التعيين — محرك الإجراءات الأساسية',
    reasoningSequenceAr: ['الإجراء المطلوب','السند القانوني','ضمانات الحقوق','التسلسل الإجرائي','الاستنتاج'],
    outputsAr: ['الإجراء الصحيح','ضمانات الحقوق','تحذيرات إجرائية'],
    characteristicsAr: [
      'شرح الإجراءات الأساسية بخطوات واضحة ومرقّمة',
      'تحديد السند القانوني لكل إجراء',
      'إبراز الضمانات القانونية لحقوق الموقوف والمشتبه به',
      'التنبيه إلى العيوب الإجرائية التي تُبطل الدليل',
      'توضيح التسلسل الإجرائي الواجب اتباعه',
    ],
    outputStructureAr: [
      'الإجراء المطلوب — الخطوة الصحيحة في هذا الموقف',
      'السند القانوني — النص المُجيز لهذا الإجراء',
      'ضمانات الحقوق — الحقوق الواجب مراعاتها',
      'التسلسل الإجرائي — الخطوات بترتيبها الصحيح',
      'تحذيرات — ما قد يُبطل الدليل أو يُعرض القضية للبطلان',
    ],
  },

  evidence_collection_officer: {
    nameAr: 'ضابط جمع الاستدلالات — محرك الاستدلال الأولي',
    reasoningSequenceAr: ['الاستدلال الأولي','الأدلة الواجب جمعها','التوثيق الإجرائي','تسليم الملف','الاستنتاج'],
    outputsAr: ['الاستدلالات الأولية المطلوبة','توثيق جمع الأدلة','قائمة التسليم'],
    characteristicsAr: [
      'تحديد الاستدلالات الأولية المطلوبة وأسلوب جمعها',
      'بيان آليات التوثيق الإجرائي الكافي',
      'تحديد الأدلة الناقصة وكيفية تأمينها',
      'ضبط إجراءات تسليم الملف للتحقيق',
    ],
    outputStructureAr: [
      'الاستدلال الأولي — ما يجب رصده وتوثيقه فور ورود البلاغ',
      'الأدلة الواجب جمعها — قائمة الأدلة المادية والرقمية والشهود',
      'التوثيق الإجرائي — كيفية توثيق كل خطوة لضمان سلامة الملف',
      'تسليم الملف — إجراءات الإحالة للجهة المختصة',
      'الأدلة الناقصة — ما لم يُجمع بعد وسُبل استكماله',
    ],
  },

  criminal_investigation_officer: {
    nameAr: 'ضابط التحقيق الجنائي — محرك استراتيجية التحقيق',
    reasoningSequenceAr: ['استراتيجية التحقيق','أساليب الاستجواب','كفاية الأدلة','جاهزية الإحالة','الاستنتاج'],
    outputsAr: ['خطة التحقيق','تقييم كفاية الأدلة','قرار الإحالة أو الاستمرار'],
    characteristicsAr: [
      'بناء استراتيجية تحقيق منهجية ومتكاملة',
      'تحديد أساليب الاستجواب القانونية الفعّالة',
      'تقييم كفاية الأدلة لإثبات كل ركن من أركان الجريمة',
      'قياس جاهزية الملف للإحالة إلى النيابة العامة',
      'تحديد المعلومات الناقصة وسُبل الحصول عليها',
    ],
    outputStructureAr: [
      'استراتيجية التحقيق — المسار المنهجي لاستكمال التحقيق',
      'أساليب الاستجواب — التقنيات القانونية للحصول على شهادات موثوقة',
      'كفاية الأدلة — تقييم قوة الملف لإثبات كل ركن جنائي',
      'جاهزية الإحالة — هل الملف مكتمل؟ وما الناقص؟',
      'التوصية — الاستمرار في التحقيق أو الإحالة مع التبرير',
    ],
  },

  forensic_laboratory_officer: {
    nameAr: 'ضابط الأدلة الجنائية — محرك الأدلة العلمية',
    reasoningSequenceAr: ['الدليل الجنائي','منهجية الفحص','سلسلة الحيازة','تقرير الخبرة','الاستنتاج'],
    outputsAr: ['المنهجية الجنائية المطلوبة','سلسلة الحيازة','تقرير الخبرة'],
    characteristicsAr: [
      'تحديد الأدلة الجنائية المادية والرقمية القابلة للفحص',
      'ضبط منهجية جمع الأدلة العلمية وفق المعايير الدولية',
      'التحقق من سلامة سلسلة الحيازة من اللحظة الأولى',
      'بيان متطلبات تقرير الخبرة الجنائية',
    ],
    outputStructureAr: [
      'الدليل الجنائي — تحديد الأدلة المادية والرقمية القابلة للتحليل',
      'منهجية الفحص — الخطوات العلمية والقانونية لفحص الأدلة',
      'سلسلة الحيازة — توثيق انتقال الدليل منذ لحظة جمعه',
      'تقرير الخبرة — عناصر التقرير الجنائي المطلوبة',
      'الأدلة الناقصة — ما يحتاج تحليلاً إضافياً أو خبيراً متخصصاً',
    ],
  },

  cybercrime_officer: {
    nameAr: 'ضابط الجرائم الإلكترونية — محرك التحقيق الرقمي',
    reasoningSequenceAr: ['الدليل الرقمي','الاختصاص الإلكتروني','إجراءات الضبط الرقمي','التحليل الجنائي الرقمي','الاستنتاج'],
    outputsAr: ['منهجية الضبط الرقمي','الأدلة الإلكترونية المطلوبة','تقييم الاختصاص'],
    characteristicsAr: [
      'تحديد الأدلة الرقمية المطلوبة وأسلوب ضبطها',
      'تقييم الاختصاص المكاني في الجرائم الإلكترونية العابرة للحدود',
      'ضبط إجراءات التحقيق الجنائي الرقمي',
      'بيان التشريعات الإلكترونية ذات الصلة',
    ],
    outputStructureAr: [
      'الدليل الرقمي — تحديد الأدلة الإلكترونية وأسلوب ضبطها',
      'الاختصاص الإلكتروني — تحديد الجهة المختصة والتشريع الواجب التطبيق',
      'إجراءات الضبط الرقمي — الخطوات الإجرائية لضبط الجرائم الإلكترونية',
      'التحليل الجنائي الرقمي — المنهجية العلمية لتحليل الأدلة الرقمية',
      'التوصية — الإجراء التالي وفق التشريعات الإلكترونية النافذة',
    ],
  },

  community_policing_officer: {
    nameAr: 'ضابط الشرطة المجتمعية — محرك الوقاية والشراكة',
    reasoningSequenceAr: ['المسألة المجتمعية','الإطار القانوني','آليات الوقاية','الشراكة المجتمعية','الاستنتاج'],
    outputsAr: ['آليات الوقاية','الشراكة المجتمعية المطلوبة','الإجراء الوقائي'],
    characteristicsAr: [
      'التركيز على الوقاية والتدخل المبكر قبل تصاعد المشكلة',
      'تحديد آليات الشراكة مع المجتمع والمؤسسات المحلية',
      'بيان الإطار القانوني للتدخل المجتمعي وحدود الصلاحية',
      'توظيف أدوات الحوار والوساطة المجتمعية',
      'تقييم الأثر الاجتماعي للإجراءات الشرطية المقترحة',
    ],
    outputStructureAr: [
      'المسألة المجتمعية — تحديد طبيعة الإشكالية وأبعادها',
      'الإطار القانوني — التشريعات والأنظمة ذات الصلة',
      'آليات الوقاية — التدخلات الوقائية المناسبة',
      'الشراكة المجتمعية — الجهات الشريكة والأدوار المطلوبة',
      'التوصية — خطة العمل الوقائية المقترحة',
    ],
  },

  child_protection_officer: {
    nameAr: 'ضابط حماية الطفل — محرك حماية الطفولة',
    reasoningSequenceAr: ['وضع الطفل','الإطار التشريعي','إجراءات الحماية','التنسيق المؤسسي','الاستنتاج'],
    outputsAr: ['الإجراء الحمائي الفوري','التنسيق المطلوب','التقرير الإجرائي'],
    characteristicsAr: [
      'إعلاء مبدأ مصلحة الطفل الفضلى في كل إجراء دون استثناء',
      'تحديد إجراءات الحماية الفورية الواجبة وفق درجة الخطر',
      'بيان التشريعات الحمائية للطفل والمعايير الدولية المعتمدة',
      'توضيح متطلبات التنسيق مع الجهات المعنية (الصحة / التعليم / الشؤون)',
      'توثيق كل إجراء لضمان سلامة الملف القانوني الحمائي',
    ],
    outputStructureAr: [
      'وضع الطفل — تقييم الخطر والوضع الحمائي',
      'الإطار التشريعي — حقوق الطفل والتشريعات الحمائية',
      'إجراءات الحماية الفورية — الخطوات الواجبة اتخاذها فوراً',
      'التنسيق المؤسسي — الجهات الواجب إخطارها والتنسيق معها',
      'التوصية — الإجراء الأمثل لضمان سلامة الطفل وحقوقه',
    ],
  },

  juvenile_affairs_officer: {
    nameAr: 'ضابط الأحداث — محرك قضاء الأحداث',
    reasoningSequenceAr: ['وضع الحدث','الإطار التشريعي للأحداث','الإجراءات الخاصة','التأهيل والإصلاح','الاستنتاج'],
    outputsAr: ['الإجراء الإصلاحي المناسب','متطلبات قضاء الأحداث','التوصية التأهيلية'],
    characteristicsAr: [
      'تطبيق قواعد قضاء الأحداث المتميزة عن الجنائي العام بدقة',
      'مراعاة مبدأ مصلحة الحدث الفضلى في كل مرحلة إجرائية',
      'التركيز على التأهيل والإصلاح بدلاً من العقوبة الجزائية',
      'بيان الإجراءات الخاصة بالحدث وكيفية الانتهاء لوساطة أو برنامج تأهيل',
      'إشراك الأسرة والمؤسسات التأهيلية في مسار معالجة قضية الحدث',
    ],
    outputStructureAr: [
      'وضع الحدث — السن وطبيعة الواقعة والخلفية الاجتماعية',
      'الإطار التشريعي — أحكام الأحداث والاختصاصات الخاصة',
      'الإجراءات الخاصة — ما يختلف في معاملة الأحداث عن البالغين',
      'التأهيل والإصلاح — البدائل التأهيلية المتاحة',
      'التوصية — الإجراء الأنسب بمراعاة مصلحة الحدث الفضلى',
    ],
  },

  // ── V4.0 — Training Engines ──────────────────────────────────────────────────

  police_trainee: {
    nameAr: 'المتدرب الشرطي — محرك التدريب الأساسي',
    reasoningSequenceAr: ['المفهوم الإجرائي','الإطار القانوني','التطبيق العملي','الأخطاء الشائعة','الخلاصة'],
    outputsAr: ['الشرح التعليمي','الإطار القانوني','التطبيق العملي'],
    characteristicsAr: [
      'شرح الإجراءات الشرطية بلغة واضحة ومتدرجة',
      'تعريف المصطلحات الإجرائية قبل استخدامها',
      'تقديم أمثلة تطبيقية من الواقع العملي',
      'تحديد الأخطاء الشائعة والتحذير منها',
      'التركيز على الفهم والاستيعاب لا على الممارسة المتقدمة',
    ],
    outputStructureAr: [
      'المفهوم الإجرائي — شرح مبسط للإجراء أو القاعدة',
      'الإطار القانوني — النص القانوني ذو الصلة مع شرح مبسط',
      'التطبيق العملي — مثال من الواقع يوضح التطبيق',
      'الأخطاء الشائعة — ما يجب تجنبه وعواقب كل خطأ',
      'الخلاصة التعليمية — الدرس الجوهري المستخلص',
    ],
  },

  judicial_intern: {
    nameAr: 'المتدرب القضائي — محرك التدريب القضائي التعليمي',
    reasoningSequenceAr: ['المفهوم القضائي','الإطار القانوني','منهجية الاستدلال','تطبيق عملي','الخلاصة'],
    outputsAr: ['الشرح التعليمي القضائي','منهجية الاستدلال','التطبيق المرشَّد'],
    characteristicsAr: [
      'شرح المفاهيم القضائية بأسلوب تعليمي متدرج يناسب المتدرب',
      'إيضاح منهجية الاستدلال القضائي من الوقائع إلى الحكم خطوة بخطوة',
      'ربط النصوص القانونية بالتطبيق القضائي الفعلي بأمثلة واقعية',
      'تقديم نماذج على صياغة الأحكام والقرارات القضائية',
      'الإشارة إلى الأخطاء الإجرائية الشائعة التي يقع فيها المبتدئون',
    ],
    outputStructureAr: [
      'المفهوم القضائي — شرح المبدأ القضائي بلغة تعليمية واضحة',
      'الإطار القانوني — النص والسابقة القضائية ذات الصلة',
      'منهجية الاستدلال — مسار التفكير من الوقائع إلى الحكم',
      'تطبيق عملي — نموذج تطبيقي يوضح التطبيق الصحيح',
      'الخلاصة التعليمية — الدرس القضائي الجوهري',
    ],
  },

  // ── V4.0 — Enforcement Judge ─────────────────────────────────────────────────

  enforcement_judge: {
    nameAr: 'قاضي التنفيذ — محرك قضاء التنفيذ',
    reasoningSequenceAr: ['السند التنفيذي','إجراءات التنفيذ','الإشكاليات التنفيذية','وسائل التنفيذ الجبري','الاستنتاج'],
    outputsAr: ['قرار التنفيذ','الوسيلة التنفيذية المناسبة','معالجة الإشكاليات'],
    characteristicsAr: [
      'التحقق من صحة السند التنفيذي واكتمال شروطه الموضوعية والشكلية',
      'تحديد وسيلة التنفيذ الجبري الأنسب بناءً على نوع الالتزام',
      'معالجة الإشكاليات التنفيذية والاعتراضات بقرارات معللة',
      'مراعاة الضمانات الإجرائية وحقوق المنفذ ضده في كل مرحلة',
      'تحديد القواعد الخاصة بالتنفيذ الجزئي أو التراخي أو الوقف المؤقت',
    ],
    outputStructureAr: [
      'السند التنفيذي — مراجعة صحة السند واكتمال شروطه القانونية',
      'إجراءات التنفيذ — الخطوات الإجرائية الواجبة للشروع في التنفيذ',
      'الإشكاليات التنفيذية — الاعتراضات والعوائق وكيفية معالجتها',
      'وسائل التنفيذ الجبري — الحجز والبيع والإكراه المناسب',
      'قرار التنفيذ — الأمر القضائي المُعلَّل بالإذن أو الرفض',
    ],
  },

  // ── V4.0 — Arbitrator ────────────────────────────────────────────────────────

  arbitrator: {
    nameAr: 'المحكّم — محرك التحكيم التجاري والمدني',
    reasoningSequenceAr: ['الاختصاص التحكيمي','الوقائع والأدلة','القانون الواجب التطبيق','التحليل التحكيمي','قرار التحكيم'],
    outputsAr: ['قرار التحكيم المُعلَّل','القانون الواجب التطبيق','التوصية للأطراف'],
    characteristicsAr: [
      'التحقق من اتفاق التحكيم وصحة اختصاص الهيئة',
      'تطبيق قواعد التحكيم المتفق عليها',
      'تحليل الوقائع والأدلة بموضوعية محايدة',
      'تطبيق القانون المختار من الأطراف أو الأنسب',
      'صياغة قرار التحكيم بمعايير قابلية التنفيذ',
    ],
    outputStructureAr: [
      'الاختصاص التحكيمي — صحة الاتفاق وأهلية الأطراف',
      'الوقائع والأدلة — الوقائع الثابتة والمتنازع عليها',
      'القانون الواجب التطبيق — الاختيار المُبرَّر للقانون الحاكم',
      'التحليل التحكيمي — تطبيق القانون على الوقائع بموضوعية',
      'قرار التحكيم — المنطوق المُعلَّل القابل للتنفيذ',
    ],
  },

  // ── V4.0 — Legislative Researcher ───────────────────────────────────────────

  legislative_researcher: {
    nameAr: 'الباحث التشريعي — محرك البحث التشريعي المقارن',
    reasoningSequenceAr: ['الفجوة التشريعية','الإطار التشريعي الحالي','القانون المقارن','المقترح التشريعي','التوصية'],
    outputsAr: ['الفجوة التشريعية المحددة','المقترح التشريعي','الأثر المتوقع'],
    characteristicsAr: [
      'تحديد الفجوات التشريعية ومسوّغات التدخل التشريعي',
      'مراجعة الإطار التشريعي الحالي وكفايته',
      'إجراء مقارنة تشريعية مع الأنظمة القانونية المرجعية',
      'صياغة مقترحات تشريعية دقيقة وقابلة للتطبيق',
      'تقييم الأثر المتوقع للتعديل التشريعي',
    ],
    outputStructureAr: [
      'الفجوة التشريعية — المشكلة التي يعالجها النص المقترح',
      'الإطار التشريعي الحالي — ما يوجد وما ينقص',
      'القانون المقارن — كيف عالجت الأنظمة الأخرى المسألة ذاتها',
      'المقترح التشريعي — نص مقترح أو مبادئ توجيهية للصياغة',
      'الأثر المتوقع — التداعيات القانونية والمجتمعية المتوقعة',
    ],
  },

  // ── Future modules reserved (military justice, customs, financial crimes…) ──
};

/** Build the role-specific reasoning block injected into the AI prompt.
 *  Professional Persona Engine (PPE) format is used when characteristicsAr +
 *  outputStructureAr are present; falls back to legacy format otherwise. */
function buildEngineBlock(userType: UserType): string {
  const engine = ROLE_ENGINES[userType];
  if (!engine) return '';
  let block = `\n[محرك الشخصية المهنية — ${engine.nameAr}]\n`;
  if (engine.characteristicsAr && engine.outputStructureAr) {
    // Professional Persona Engine — binding spec format
    block += `[قاعدة الشخصية] تغيير الصفة المهنية يُغيِّر جوهرياً: اللغة، العمق، متطلبات الإثبات، الإرشاد الإجرائي، مسار الاستدلال، وهيكل الإجابة — مع الحفاظ التام على صحة النتيجة القانونية.\n`;
    block += `خصائص الاستجابة المطلوبة:\n`;
    engine.characteristicsAr.forEach((c) => { block += `  • ${c}\n`; });
    block += `هيكل الإجابة المُلزِم — يجب الالتزام بهذا الترتيب حرفياً:\n`;
    engine.outputStructureAr.forEach((s, i) => { block += `  ${i + 1}. ${s}\n`; });
  } else {
    // Legacy format
    block += `تسلسل الاستدلال المطلوب:\n`;
    engine.reasoningSequenceAr.forEach((step, i) => { block += `  ${i + 1}. ${step}\n`; });
    block += `المخرجات المطلوبة: ${engine.outputsAr.join(' | ')}\n`;
  }
  return block;
}

// ─── Special Police Module ────────────────────────────────────────────────────
// Injected as an additional mandatory section for all police identity types.

// V4.0 — expanded to 9 police engine types
const POLICE_IDENTITY_TYPES = new Set<UserType>([
  // V3 legacy
  'police_officer_new', 'evidence_officer', 'investigation_officer',
  // V4.0 engines
  'police_recruit_officer', 'police_station_officer',
  'evidence_collection_officer', 'criminal_investigation_officer',
  'forensic_laboratory_officer', 'cybercrime_officer',
  'community_policing_officer', 'child_protection_officer', 'juvenile_affairs_officer',
  // Training
  'police_trainee',
]);

// V4.0 — upgraded from 10 to 15 mandatory items
const POLICE_MODULE_BLOCK = `
[وحدة الشرطة مفعلة — 15 محوراً إلزامياً تُضاف بعد التحليل الرئيسي]
بعد إتمام التحليل القانوني أعلاه، أضف هذه المحاور الخمسة عشر بترتيبها:
  ١. قائمة الأدلة الواجب جمعها — الأدلة المادية والرقمية والشهادات المطلوبة لكل ركن جنائي.
  ٢. أسس ومبادئ جمع الاستدلالات — الخطوات الإجرائية المعتمدة للتحقيق السليم.
  ٣. متطلبات صحة المحضر — هل المحضر مستوفٍ للشروط الشكلية والموضوعية كافة؟
  ٤. مراجعة المشروعية الإجرائية — هل كل إجراء متخذ مطابق للقانون بشكل كامل؟
  ٥. مراجعة الاختصاص المكاني والنوعي — هل الجهة المختصة هي الجهة الصحيحة؟
  ٦. مراجعة سلسلة الحيازة للأدلة — سلامة الحفاظ على الأدلة وتوثيق انتقالها منذ اللحظة الأولى.
  ٧. التحذير من الأخطاء الإجرائية الجسيمة — كل خطأ قد يُبطل الدليل أو يُسقط الاتهام.
  ٨. تحديد الأدلة الناقصة — ما لم يُجمع بعد وسُبل الحصول عليه قانوناً.
  ٩. تقييم جاهزية الإحالة للنيابة العامة — هل الملف مكتمل للإحالة؟ وما العقبات؟
  ١٠. نسبة اكتمال ملف التحقيق (%) — تقدير نسبي مُبرَّر مع تحديد النواقص الجوهرية.
  ١١. قائمة إجراءات ما قبل الإحالة — الخطوات الواجب استيفاؤها قبل إحالة الملف.
  ١٢. قائمة إجراءات ما بعد الإحالة — ما يتبع الإحالة من متابعات وإجراءات لازمة.
  ١٣. تقييم قوة الأدلة — [ضعيف / متوسط / قوي] مع تبرير لكل تصنيف.
  ١٤. بيان احتمالية الطعن الإجرائي مستقبلاً — نقاط الضعف التي قد يستند إليها الدفاع طعناً.
  ١٥. توصيات تحسين الملف التحقيقي — إجراءات مقترحة لرفع جودة الملف قبل الإحالة.
`;

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
  // Role Neutrality Rule — always injected to prevent role bias in legal findings
  p += `[قاعدة الحياد القانوني] الصفة المهنية تؤثر على: الأسلوب، المصطلحات، عمق الشرح، التوصيات العملية فقط. لا تؤثر أبداً على: القواعد القانونية، الاستدلال، النتائج، تقييم المشروعية، أو حكم القانون. نفس الوقائع + نفس القانون = نفس النتيجة القانونية بصرف النظر عن هوية المستخدم.\n`;
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
  // Special Police Module — appended for all law-enforcement identities
  if (POLICE_IDENTITY_TYPES.has(config.userType)) {
    p += POLICE_MODULE_BLOCK;
  }
  // V5.0 § 6 — Professional Maturity Engine
  const maturity = MATURITY_CFG[config.maturityLevel];
  p += `\n[محرك النضج المهني — المستوى: ${maturity.ar}]\n`;
  p += `عمق الإجابة ومستوى اللغة المطلوب: ${maturity.depth}\n`;
  // V5.0 § 7 — National Jurisdiction Engine (expanded adaptation)
  if (config.jurisdiction === 'gcc') {
    p += `\n[محرك الاختصاص الوطني — دول مجلس التعاون الخليجي]\n`;
    p += `تناول المسألة بمنظور خليجي مقارن: الإمارات، السعودية، الكويت، قطر، البحرين، عُمان.\n`;
    p += `اذكر أوجه التوافق والاختلاف بين التشريعات الخليجية، مع إبراز الموقف الإماراتي تفصيلاً.\n`;
  } else if (config.jurisdiction === 'saudi') {
    p += `\n[محرك الاختصاص الوطني — المملكة العربية السعودية]\n`;
    p += `استخدم التشريعات السعودية (نظام المرافعات، نظام العمل، نظام الإجراءات الجزائية).\n`;
    p += `الجهة القضائية: ديوان المظالم للقضاء الإداري | اللغة: مصطلحات القضاء السعودي.\n`;
  } else if (config.jurisdiction === 'egypt') {
    p += `\n[محرك الاختصاص الوطني — جمهورية مصر العربية]\n`;
    p += `استخدم التشريعات المصرية والمبادئ المستقرة أمام مجلس الدولة والمحكمة الدستورية العليا.\n`;
  }
  // V5.0 § 2 — Legal Quality Assurance Engine (always on)
  p += QA_ENGINE_BLOCK;
  // V5.0 § 4 + § 8 — XAI + Knowledge Traceability (always on)
  p += XAI_TRACEABILITY_BLOCK;
  if (extras.length > 0) p += `الخيارات الخبيرة: يرجى تضمين: ${extras.join('، ')}\n`;
  return p + '\n';
}

// ─── Response modes ───────────────────────────────────────────────────────────

type ResponseMode = 'quick' | 'standard' | 'professional' | 'expert' | 'exemplary' | 'court_full' | 'shamsi_theory' | 'scenario_builder' | 'judicial_review' | 'risk_analysis';

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
    ar: 'إجابة مفصّلة',
    en: 'Detailed Answer',
    descAr: 'تحليل قانوني تفصيلي · 5–10 ثوانٍ',
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
    activeClass: 'bg-gold text-white border-gold',
    badgeClass: 'bg-gold/10 text-gold border-gold/25',
    maxSections: undefined,
  },
  exemplary: {
    icon: <span aria-hidden>🏛️</span>,
    ar: 'النموذج القياسي',
    en: 'Standard Model Answer',
    descAr: 'نموذج قضائي مثالي — يُعلِّم المسار الصحيح للاستدلال والحكم',
    activeClass: 'bg-slate-700 text-white border-slate-700',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    maxSections: undefined,
  },
  court_full: {
    icon: <span aria-hidden>⚖️</span>,
    ar: 'جلسة محكمة كاملة',
    en: 'Full Court Session',
    descAr: 'جلسة محاكمة كاملة — ASEP + نظرية الشامسي + الإرادة الرقمية',
    activeClass: 'bg-gold text-white border-gold',
    badgeClass: 'bg-gold/10 text-gold border-gold/25',
    maxSections: undefined,
  },
  shamsi_theory: {
    icon: <span aria-hidden>🧠</span>,
    ar: 'نظرية الشامسي',
    en: 'Al-Shamsi Theory',
    descAr: 'تحليل مُعمَّق بنظرية الشامسي — 11 بُعداً للقرار الخوارزمي والذكاء الاصطناعي',
    activeClass: 'bg-blue-700 text-white border-blue-700',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    maxSections: undefined,
  },
  scenario_builder: {
    icon: <span aria-hidden>🧩</span>,
    ar: 'تعليم السيناريوهات / بناء القضية',
    en: 'Scenario Builder',
    descAr: 'يُقيّم اكتمال السيناريو ويرشدك لبناء قضية قانونية متكاملة',
    activeClass: 'bg-teal-600 text-white border-teal-600',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    maxSections: undefined,
  },
  // V5.0 — Section 3: Judicial Review Simulator
  judicial_review: {
    icon: <span aria-hidden>🏛️</span>,
    ar: 'المراجعة القضائية الافتراضية',
    en: 'Judicial Review Simulator',
    descAr: '5 وجهات نظر متمايزة + احتمالية تأييد / تعديل / إلغاء / إعادة التحقيق',
    activeClass: 'bg-rose-700 text-white border-rose-700',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    maxSections: undefined,
  },
  // V5.0 — Section 5: Legal Risk Engine
  risk_analysis: {
    icon: <span aria-hidden>⚠️</span>,
    ar: 'محرك تحليل المخاطر',
    en: 'Legal Risk Engine',
    descAr: '8 أصناف مخاطر × 4 مستويات خطورة — إجرائي، موضوعي، إثباتي، تشريعي، دستوري…',
    activeClass: 'bg-gold text-white border-gold',
    badgeClass: 'bg-gold/10 text-gold border-gold/25',
    maxSections: undefined,
  },
};

// Prefix injected into the message content for Expert Opinion mode.
// This is pure orchestration — no backend or prompt changes.
const EXPERT_MODE_PREFIX =
  '[وضع الرأي القانوني الخبير] أنت مستشار قانوني خبير. قدّم رأيك القانوني الاحترافي بشأن ما يلي، متضمناً: الرأي القانوني الواضح، نقاط القوة، نقاط الضعف، مخاطر التقاضي، احتمالية النجاح في أي نزاع، والإجراء القانوني الموصى به. صرّح في البداية بأن هذا رأي قانوني غير ملزم.\n\n';

// Prefix injected for Scenario Builder mode — educational, completeness-first.
// ─── Scenario Engine — Training Mode ──────────────────────────────────────────

interface ScenarioConfig {
  caseType:        'criminal' | 'administrative' | 'civil' | 'family' | 'commercial' | 'cyber';
  complexity:      'basic' | 'intermediate' | 'advanced' | 'expert';
  proceduralStage: 'investigation' | 'prosecution' | 'trial' | 'appeal' | 'execution';
  // V5.0 — Advanced Scenario Engine (Section 9)
  scenarioType:    'training' | 'real' | 'crisis' | 'public_opinion' | 'multi_party';
}

const DEFAULT_SCENARIO_CONFIG: ScenarioConfig = {
  caseType: 'criminal', complexity: 'basic', proceduralStage: 'investigation',
  scenarioType: 'training',
};

const SCENARIO_CASE_TYPES: { value: ScenarioConfig['caseType']; ar: string; emoji: string }[] = [
  { value: 'criminal',       ar: 'جنائية',          emoji: '🔍' },
  { value: 'administrative', ar: 'إدارية',           emoji: '🏛️' },
  { value: 'civil',          ar: 'مدنية',            emoji: '⚖️' },
  { value: 'family',         ar: 'أحوال شخصية',      emoji: '👨‍👩‍👧' },
  { value: 'commercial',     ar: 'تجارية',           emoji: '💼' },
  { value: 'cyber',          ar: 'إلكترونية',        emoji: '💻' },
];

const SCENARIO_COMPLEXITY: { value: ScenarioConfig['complexity']; ar: string }[] = [
  { value: 'basic',        ar: 'مبتدئ' },
  { value: 'intermediate', ar: 'متوسط' },
  { value: 'advanced',     ar: 'متقدم' },
  { value: 'expert',       ar: 'خبير' },
];

// V5.0 — Advanced Scenario Engine (Section 9): 5 scenario types
const SCENARIO_TYPES: { value: ScenarioConfig['scenarioType']; ar: string; emoji: string }[] = [
  { value: 'training',       ar: 'تدريبي',             emoji: '📚' },
  { value: 'real',           ar: 'واقعي',              emoji: '🔍' },
  { value: 'crisis',         ar: 'أزمة',               emoji: '🚨' },
  { value: 'public_opinion', ar: 'رأي عام',            emoji: '📢' },
  { value: 'multi_party',    ar: 'متعدد الجهات',        emoji: '🤝' },
];

const SCENARIO_STAGES: { value: ScenarioConfig['proceduralStage']; ar: string }[] = [
  { value: 'investigation', ar: 'التحقيق' },
  { value: 'prosecution',   ar: 'الادعاء' },
  { value: 'trial',         ar: 'المحاكمة' },
  { value: 'appeal',        ar: 'الاستئناف' },
  { value: 'execution',     ar: 'التنفيذ' },
];

function buildScenarioPrefix(sc: ScenarioConfig, userType: UserType): string {
  const ct = SCENARIO_CASE_TYPES.find((x) => x.value === sc.caseType)?.ar ?? sc.caseType;
  const cx = SCENARIO_COMPLEXITY.find((x) => x.value === sc.complexity)?.ar ?? sc.complexity;
  const st = SCENARIO_STAGES.find((x) => x.value === sc.proceduralStage)?.ar ?? sc.proceduralStage;
  const stype = SCENARIO_TYPES.find((x) => x.value === sc.scenarioType)?.ar ?? sc.scenarioType;
  const identity = USER_TYPE_CONFIG[userType]?.ar ?? userType;
  return `[محرك السيناريو التعليمي — MLOS Scenario Engine v5.0]
الهوية المهنية: ${identity} | نوع السيناريو: ${stype} | نوع القضية: ${ct} | مستوى التعقيد: ${cx} | المرحلة الإجرائية: ${st}

أنت مُدرِّب قانوني متخصص. استنِد إلى الهوية المهنية ونوع القضية والمرحلة الإجرائية المحددة أعلاه لتخصيص السيناريو تخصيصاً كاملاً.

أَخرِج إجابتك حصراً بهذا الهيكل الثماني الإلزامي:

١) وقائع القضية
اذكر وقائع السيناريو المُقدَّم بوضوح، مع تحديد الأطراف والحدث المحوري.

٢) الأدلة المتاحة
اسرد الأدلة الموجودة وقوّتها الإثباتية.

٣) الأدلة الناقصة
حدّد ما يجب جمعه أو استكماله وتأثيره على القضية.

٤) التكييف القانوني
وصّف الواقعة قانوناً وحدد النص الحاكم وفق نوع القضية والمرحلة الإجرائية.

٥) المخاطر الإجرائية
اذكر العيوب الإجرائية والأخطاء المحتملة التي قد تُضعف القضية.

٦) النتيجة القضائية المتوقعة
قدّم التوجه المتوقع بناءً على الأدلة والإطار القانوني.

٧) الإجراءات المقترحة
اقترح الخطوات التالية الأنسب للهوية المهنية المحددة.

٨) تقييم التدريب
قيّم اكتمال الملف وجاهزيته بنسبة مئوية، مع نقاط القوة والضعف وتوصيات التحسين.

السيناريو المُقدَّم:\n\n`;
}

// Keep original prefix as fallback (used when scenario config not injected)
const SCENARIO_BUILDER_PREFIX = buildScenarioPrefix(DEFAULT_SCENARIO_CONFIG, 'unspecified');

// ─── V5.0 Engine Prefixes ────────────────────────────────────────────────────

// § Section 1 — Case Lifecycle Engine (10 procedural stages)
const CASE_LIFECYCLE_STAGES: { id: number; ar: string; emoji: string }[] = [
  { id: 1,  ar: 'البلاغ',              emoji: '📋' },
  { id: 2,  ar: 'جمع الاستدلالات',     emoji: '🔍' },
  { id: 3,  ar: 'التحقيق',             emoji: '🕵️' },
  { id: 4,  ar: 'الاتهام أو الحفظ',   emoji: '⚖️' },
  { id: 5,  ar: 'المحاكمة',            emoji: '🏛️' },
  { id: 6,  ar: 'الاستئناف',           emoji: '📁' },
  { id: 7,  ar: 'التمييز',             emoji: '⚖️' },
  { id: 8,  ar: 'التنفيذ',             emoji: '✅' },
  { id: 9,  ar: 'الأرشفة',             emoji: '🗂️' },
  { id: 10, ar: 'التعلم المؤسسي',      emoji: '🎓' },
];

function buildLifecyclePrefix(stage: number): string {
  const current = CASE_LIFECYCLE_STAGES.find((s) => s.id === stage);
  const prev    = CASE_LIFECYCLE_STAGES.find((s) => s.id === stage - 1);
  const next    = CASE_LIFECYCLE_STAGES.find((s) => s.id === stage + 1);
  const pct     = Math.round((stage / 10) * 100);
  return `\n[محرك دورة حياة القضية — المرحلة ${stage} من 10]
المرحلة الحالية: ${current?.emoji ?? ''} ${current?.ar ?? ''}
المرحلة السابقة: ${prev ? `${prev.emoji} ${prev.ar}` : '—'}
المرحلة اللاحقة: ${next ? `${next.emoji} ${next.ar}` : '—'}
نسبة الإنجاز الكلية: ${pct}%
ضع هذا السياق في الاعتبار عند صياغة إجابتك — التحليل والتوصيات يجب أن يتناسبا مع هذه المرحلة الإجرائية تحديداً.\n`;
}

// § Section 2 — Legal Quality Assurance Engine (8 checks)
const QA_ENGINE_BLOCK = `
[محرك ضمان الجودة القانونية — 8 فحوصات إلزامية]
قبل تقديم إجابتك النهائية، نفّذ هذه الفحوصات الثمانية داخلياً وأضف ملخص نتائجها في نهاية إجابتك:
  ① فحص الاختصاص — هل الجهة والقانون المختص محدد بدقة؟
  ② فحص المواعيد القانونية — هل المواعيد والمدد الإجرائية مراعاة؟
  ③ فحص سلامة الإجراءات — هل الإجراءات المتخذة مطابقة للقانون؟
  ④ فحص التسبيب — هل القرار أو الرأي مُعلَّل تعليلاً كافياً؟
  ⑤ فحص الأدلة — هل الأدلة المستخدمة كافية ومشروعة؟
  ⑥ فحص سلامة الاستدلال — هل المنطق القانوني متسق ولا ثغرات فيه؟
  ⑦ فحص التعارضات — هل ثمة تعارض مع نصوص أو مبادئ أخرى؟
  ⑧ فحص احتمالية الإلغاء أو الطعن — ما نقاط الضعف التي قد يستغلها الطعن؟

اختتم بـ:
[درجة الجودة القانونية]: __% — [ممتاز | جيد | متوسط | ضعيف | خطر إجرائي مرتفع]
`;

// § Section 3 — Judicial Review Simulator (5 viewpoints + 4 outcomes)
const JUDICIAL_REVIEW_PREFIX = `\
[محرك المراجعة القضائية الافتراضية — MLOS Judicial Review Simulator v5.0]

أنت هيئة قضائية متخيلة من خمسة. حلّل القضية من وجهات نظر مستقلة متمايزة، ثم أصدر تقديرات احتمالية مُبرَّرة.

أَخرِج إجابتك بهذا الهيكل الإلزامي:

١) وجهة نظر القاضي
حلّل القضية من منظور قضائي بحت: الوقائع، التكييف، الاستدلال، الحكم المتوقع.

٢) وجهة نظر النيابة
حلّل من منظور الادعاء العام: أدلة الإدانة، الوصف الجنائي، الطلبات.

٣) وجهة نظر الدفاع
حلّل من منظور الدفاع: نقاط الضعف في الاتهام، حجج البراءة أو التخفيف.

٤) وجهة نظر جهة الإدارة
حلّل من منظور الجهة الإدارية: مشروعية قراراتها، حجج الدفاع المؤسسي.

٥) وجهة نظر جهة الطعن
حلّل من منظور المراجعة القضائية: أسباب الطعن، مدى قبوله، احتمالية نجاحه.

٦) تقديرات الاحتمالية القضائية [مُبرَّرة]
  • تأييد القرار:       __% — [السبب]
  • تعديله:            __% — [السبب]
  • إلغائه:            __% — [السبب]
  • إعادة التحقيق:     __% — [السبب]
  (مجموع الاحتمالات = 100%)

القضية:\n\n`;

// § Section 5 — Legal Risk Engine (8 categories × 4 severity levels)
const RISK_ENGINE_PREFIX = `\
[محرك تحليل المخاطر القانونية — MLOS Legal Risk Engine v5.0]

أنت محلل مخاطر قانوني متخصص. صنّف مخاطر هذه القضية عبر الأصناف الثمانية التالية، مع تقدير الخطورة لكل صنف.

أَخرِج إجابتك بهذا الهيكل الإلزامي:

١) الخطر الإجرائي — [منخفض | متوسط | مرتفع | حرج]
وصف المخاطر الناجمة عن العيوب أو الأخطاء الإجرائية.

٢) الخطر الموضوعي — [منخفض | متوسط | مرتفع | حرج]
وصف مخاطر ضعف الموقف القانوني الموضوعي.

٣) الخطر الإثباتي — [منخفض | متوسط | مرتفع | حرج]
وصف مخاطر ضعف الأدلة أو صعوبة الإثبات.

٤) الخطر التشريعي — [منخفض | متوسط | مرتفع | حرج]
وصف مخاطر الغموض التشريعي أو التعارض بين النصوص.

٥) الخطر الدستوري — [منخفض | متوسط | مرتفع | حرج]
وصف مخاطر التعارض مع أحكام أو مبادئ دستورية.

٦) الخطر الرقابي — [منخفض | متوسط | مرتفع | حرج]
وصف مخاطر التدخل الرقابي أو العقوبات التنظيمية.

٧) الخطر الإعلامي — [منخفض | متوسط | مرتفع | حرج]
وصف مخاطر التغطية الإعلامية السلبية وتأثيرها.

٨) خطر السمعة المؤسسية — [منخفض | متوسط | مرتفع | حرج]
وصف مخاطر الضرر بسمعة الجهة أو المؤسسة.

٩) المؤشر الإجمالي للمخاطر
[منخفض | متوسط | مرتفع | حرج] — مع ترتيب أولوية المعالجة وخطة التخفيف.

القضية:\n\n`;

// § Section 4 — Explainable AI (XAI) + § Section 8 — Knowledge Traceability (always-on injections)
const XAI_TRACEABILITY_BLOCK = `
[طبقة الذكاء الاصطناعي القابل للتفسير — XAI + تتبع المعرفة القانونية]
في نهاية كل استنتاج رئيسي، أضف:
  [لماذا هذه النتيجة؟] اشرح المسار المنطقي من الوقائع إلى الاستنتاج.
  [الأدلة المستخدمة] اذكر الأدلة أو المعطيات التي استندت إليها.
  [النصوص القانونية] المادة القانونية المحددة + رقمها + المرجع التشريعي.
  [السوابق القضائية] المرجع القضائي المستخدم + الجهة القضائية + السنة.
  [المرجع الفقهي] الفقيه أو المرجع الفقهي عند توافره.
  [درجة الثقة]: __% — [مرتفعة جداً | مرتفعة | متوسطة | منخفضة] مع السبب.
`;

// § Section 6 — Professional Maturity Engine
const MATURITY_CFG: Record<MaturityLevel, { ar: string; depth: string }> = {
  trainee: { ar: 'متدرب',         depth: 'شرح تعليمي بسيط مع تعريف كل مصطلح واستخدام أمثلة تطبيقية' },
  junior:  { ar: 'مبتدئ',         depth: 'شرح وافٍ مع تحليل إجرائي واضح دون افتراض خبرة مسبقة' },
  mid:     { ar: 'متوسط الخبرة',  depth: 'تحليل قانوني كامل مع الإشارة إلى الخلافات الفقهية والسوابق القضائية' },
  expert:  { ar: 'خبير',          depth: 'تحليل متعمق حصري مع المقارنة الفقهية والتحليل النقدي والرأي الاستشاري المتخصص' },
};

// Groups that use the maturity selector
const MATURITY_APPLICABLE_GROUPS: Set<string> = new Set([
  'الشرطة والتحقيق', 'القضاء', 'النيابة العامة', 'المحاماة والاستشارات', 'التعليم والتدريب',
]);

// Prefix for Exemplary (نموذجي) mode — judicial-style model analysis with educational dimension.
const EXEMPLARY_MODE_PREFIX = `\
[وضع التحليل النموذجي — المحرك القضائي التعليمي]

قدّم هذه المسألة بأسلوب حكم قضائي نموذجي يُعلِّم القارئ المسار الصحيح للاستدلال. التزم بهذا الهيكل:
١. الوقائع المثبتة والمسألة القانونية محل الفصل.
٢. القانون الواجب التطبيق — مع الإشارة الصريحة إلى النصوص.
٣. تسلسل الاستدلال القانوني خطوة بخطوة.
٤. الحجج المضادة وكيفية الرد عليها.
٥. الاستنتاج القضائي المُعلَّل.
٦. الدرس القانوني المستخلص — ما الذي يُعلِّمنا هذا الحكم؟

الأسلوب: رسمي قضائي، واضح، تعليمي — مناسب للقضاة والمتدربين والمحامين والطلاب على حدٍّ سواء.

المسألة:\n\n`;

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
            : 'bg-gold/10 text-gold border-gold/25 hover:bg-gold/15'
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
        <span key={i} className={i < filled ? 'text-gold' : 'text-muted-foreground/30'}>★</span>
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
    s.confidence >= 75 ? 'text-gold'   : 'text-rose-600';
  const confDot =
    s.confidence >= 90 ? '🟢' :
    s.confidence >= 75 ? '🟡' : '🔴';
  const riskColor =
    s.disagreementRisk === 'منخفض'  ? 'text-emerald-700' :
    s.disagreementRisk === 'متوسط'  ? 'text-gold'   : 'text-rose-700';

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
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gold/10 border border-gold/25 rounded-lg mb-2">
          <Star className="w-3.5 h-3.5 text-gold shrink-0" />
          <span className="text-[11px] font-bold text-gold uppercase tracking-wide">تحليل قانوني متخصص — غير ملزم</span>
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

// ─── Scenario Input Panel ────────────────────────────────────────────────────

function ScenarioInputPanel({
  config, onChange, disabled,
}: {
  config: ScenarioConfig;
  onChange: (c: ScenarioConfig) => void;
  disabled?: boolean;
}) {
  const t = (ar: string, en: string) => ar;
  const sel = 'text-[11px] rounded-lg border border-border bg-background px-2 py-1 text-foreground cursor-pointer disabled:opacity-50';
  return (
    <div
      className="mb-2 rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2 flex flex-wrap gap-3 items-center"
      dir="rtl"
    >
      <span className="text-[10px] font-semibold text-teal-700 shrink-0">🧩 {t('محرك السيناريو', 'Scenario Engine')}</span>
      {/* Case type */}
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-muted-foreground">{t('نوع القضية', 'Case type')}</label>
        <select
          className={sel}
          value={config.caseType}
          onChange={(e) => onChange({ ...config, caseType: e.target.value as ScenarioConfig['caseType'] })}
          disabled={disabled}
        >
          {SCENARIO_CASE_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>{ct.emoji} {ct.ar}</option>
          ))}
        </select>
      </div>
      {/* Complexity */}
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-muted-foreground">{t('التعقيد', 'Complexity')}</label>
        <select
          className={sel}
          value={config.complexity}
          onChange={(e) => onChange({ ...config, complexity: e.target.value as ScenarioConfig['complexity'] })}
          disabled={disabled}
        >
          {SCENARIO_COMPLEXITY.map((cx) => (
            <option key={cx.value} value={cx.value}>{cx.ar}</option>
          ))}
        </select>
      </div>
      {/* Procedural stage */}
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-muted-foreground">{t('المرحلة الإجرائية', 'Stage')}</label>
        <select
          className={sel}
          value={config.proceduralStage}
          onChange={(e) => onChange({ ...config, proceduralStage: e.target.value as ScenarioConfig['proceduralStage'] })}
          disabled={disabled}
        >
          {SCENARIO_STAGES.map((st) => (
            <option key={st.value} value={st.value}>{st.ar}</option>
          ))}
        </select>
      </div>
      {/* V5.0 § 9 — Scenario type */}
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-muted-foreground">{t('نوع السيناريو', 'Scenario type')}</label>
        <select
          className={sel}
          value={config.scenarioType}
          onChange={(e) => onChange({ ...config, scenarioType: e.target.value as ScenarioConfig['scenarioType'] })}
          disabled={disabled}
        >
          {SCENARIO_TYPES.map((st) => (
            <option key={st.value} value={st.value}>{st.emoji} {st.ar}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Pre-analysis panel ───────────────────────────────────────────────────────

function PreAnalysisPanel({
  config, onChange, onStart, expertMode, onToggleExpert, currentInput, onInputChange,
}: {
  config: SessionConfig;
  onChange: (c: SessionConfig) => void;
  onStart: () => void;
  expertMode: boolean;
  onToggleExpert: () => void;
  currentInput?: string;
  onInputChange?: (value: string) => void;
}) {
  // Derive the selected identity — only set once the user actually picks one;
  // 'unspecified' (the default) shows the dropdown placeholder instead.
  const identityChosen = config.userType !== 'unspecified';
  const selectedIdentity = PRIMARY_IDENTITIES.find((id) => id.value === config.userType);

  // Whether the selected identity triggers the Special Police Module
  const isPolice = POLICE_IDENTITY_TYPES.has(config.userType);

  // V5.0 § 6 — whether this role group gets a maturity selector
  const showMaturity = MATURITY_APPLICABLE_GROUPS.has(selectedIdentity?.groupAr ?? '');

  // ── التصنيف القانوني الرئيسي — changing the top-level domain always clears
  // the branch AND the specialization beneath it (spec: "عند تغيير المستوى
  // الأعلى يتم مسح جميع المستويات الأدنى تلقائياً").
  function applyLegalDomain(domain: LegalDomain | '') {
    onChange({ ...config, legalDomain: domain, legalBranch: '', legalSpecialization: '' });
  }
  // Changing the branch always clears the specialization beneath it.
  function applyLegalBranch(branchId: string) {
    onChange({ ...config, legalBranch: branchId, legalSpecialization: '' });
  }
  const branchOptions: LegalBranchDef[] = config.legalDomain ? LEGAL_TAXONOMY[config.legalDomain].branches : [];
  const selectedBranch = getLegalBranchDef(config.legalDomain, config.legalBranch);
  const specializationOptions: LegalSpecializationDef[] = selectedBranch?.specializations ?? [];
  const BRANCH_LEVEL_LABEL: Record<LegalDomain, string> = {
    public_law: 'فرع القانون العام',
    private_law: 'فرع القانون الخاص',
    criminal_law: 'فرع القانون الجزائي',
    mixed_regulatory_law: 'فرع القانون التنظيمي',
  };

  // ── مصدر القانون — maps directly onto the underlying jurisdiction / comparative flags.
  function applyLawSource(src: LawSource | '') {
    if (!src) { onChange({ ...config, lawSource: '' }); return; }
    const cfg = LAW_SOURCE_CFG[src];
    onChange({ ...config, lawSource: src, jurisdiction: cfg.jurisdiction, comparativeMode: cfg.comparativeMode, applyAdvancedStandard: false });
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4" dir="rtl">
      <div className="max-w-xl mx-auto">

        {/* ── MLOS identity header ───────────────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="inline-flex flex-col items-center gap-1 mb-4">
            <div className="inline-flex items-center gap-2.5 bg-primary/8 border border-primary/20 rounded-xl px-4 py-2 mb-1">
              <Scale className="w-5 h-5 text-primary/80" aria-hidden />
              <span className="text-2xl font-black tracking-[0.12em] text-primary">MLOS</span>
            </div>
            <span className="text-sm font-semibold text-foreground/80 tracking-wide">
              Marsad Legal Operating System
            </span>
            <span className="text-sm font-medium text-muted-foreground" dir="rtl">
              نظام مرصد للتشغيل القانوني الذكي
            </span>
            <span className="text-[11px] text-primary/50 tracking-widest mt-0.5">نرصد · نحلل · نحكم</span>
          </div>
          <h2 className="text-base font-bold text-foreground mt-2">
            {currentInput?.trim()
              ? 'كيف ترغب في تحليل هذه القضية؟'
              : 'أدخل سؤالك القانوني أو وقائع القضية أولاً.'}
          </h2>
        </div>

        <div className="space-y-3">

          {/* ── Professional Identity — single dropdown ────────────────── */}
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
            <div className="px-3 pt-3 pb-1">
              <p className="text-[11px] font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <span>👤</span>
                الهوية المهنية
                <span className="text-[9px] font-normal text-muted-foreground">(من أنت؟)</span>
              </p>
              <select
                value={config.userType}
                onChange={(e) => onChange({ ...config, userType: e.target.value as UserType })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                style={{ direction: 'rtl' }}
              >
                <option value="unspecified" disabled>اختر هويتك المهنية</option>
                {/* Group identities by their groupAr for optgroup */}
                {Array.from(new Set(PRIMARY_IDENTITIES.map((id) => id.groupAr))).map((group) => (
                  <optgroup key={group} label={group}>
                    {PRIMARY_IDENTITIES.filter((id) => id.groupAr === group).map((id) => (
                      <option key={id.value} value={id.value}>
                        {id.emoji} {id.labelAr}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Selected identity badge + description — only once an identity is actually chosen */}
            {identityChosen && selectedIdentity && (
              <div className={`mx-3 mb-3 mt-2 rounded-lg px-3 py-2 text-[11px] ${
                isPolice
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-primary/5 border border-primary/15'
              }`}>
                <p className={`font-bold mb-0.5 ${isPolice ? 'text-blue-800' : 'text-primary'}`}>
                  {selectedIdentity.emoji} {selectedIdentity.labelAr}
                </p>
                {isPolice && (
                  <p className="text-[10px] text-blue-700 font-medium">
                    🔍 تُفعَّل الوحدة الخاصة بالشرطة — 15 محوراً إجرائياً إضافياً في كل إجابة
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── V5.0 § 6 — Professional Maturity (shown for applicable role groups) — hidden in the simplified assistant view */}
          {SHOW_LEGACY_CHAT_UI && showMaturity && (
            <CfgSection title="مستوى النضج المهني" icon="📊">
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(MATURITY_CFG) as [MaturityLevel, { ar: string; depth: string }][]).map(([k, v]) => (
                  <ConfigChip
                    key={k}
                    value={k}
                    selected={config.maturityLevel}
                    label={v.ar}
                    onSelect={(val) => onChange({ ...config, maturityLevel: val as MaturityLevel })}
                  />
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">
                {MATURITY_CFG[config.maturityLevel].depth}
              </p>
            </CfgSection>
          )}

          {/* ── الإطار التحليلي العام: التصنيف القانوني الرئيسي → الفرع → التخصص الدقيق ─────── */}
          <CfgSection title="الإطار التحليلي العام" icon="🧭">
            <label htmlFor="legal-domain-select" className="text-[10px] font-semibold text-muted-foreground block mb-1">
              التصنيف القانوني الرئيسي
            </label>
            <select
              id="legal-domain-select"
              aria-label="التصنيف القانوني الرئيسي"
              value={config.legalDomain}
              onChange={(e) => applyLegalDomain(e.target.value as LegalDomain | '')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
              style={{ direction: 'rtl' }}
            >
              <option value="" disabled>اختر التصنيف القانوني الرئيسي</option>
              {(Object.entries(LEGAL_TAXONOMY) as [LegalDomain, LegalDomainDef][]).map(([k, v]) => (
                <option key={k} value={k}>• {v.ar}</option>
              ))}
            </select>

            {/* لا تظهر القائمة التالية إلا بعد اختيار السابقة */}
            {branchOptions.length > 0 && (
              <div className="mt-2.5">
                <label htmlFor="legal-branch-select" className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  {BRANCH_LEVEL_LABEL[config.legalDomain as LegalDomain]}
                </label>
                <select
                  id="legal-branch-select"
                  aria-label={BRANCH_LEVEL_LABEL[config.legalDomain as LegalDomain]}
                  value={config.legalBranch}
                  onChange={(e) => applyLegalBranch(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                  style={{ direction: 'rtl' }}
                >
                  <option value="" disabled>{`اختر ${BRANCH_LEVEL_LABEL[config.legalDomain as LegalDomain]}`}</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>• {b.ar}</option>
                  ))}
                </select>
              </div>
            )}

            {/* التخصص الدقيق — لا تظهر إلا بعد اختيار فرع له تخصصات معرّفة */}
            {specializationOptions.length > 0 && (
              <div className="mt-2.5">
                <label htmlFor="legal-specialization-select" className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  التخصص الدقيق
                </label>
                <select
                  id="legal-specialization-select"
                  aria-label="التخصص الدقيق"
                  value={config.legalSpecialization}
                  onChange={(e) => onChange({ ...config, legalSpecialization: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                  style={{ direction: 'rtl' }}
                >
                  <option value="" disabled>اختر التخصص الدقيق</option>
                  {specializationOptions.map((s) => (
                    <option key={s.id} value={s.id}>• {s.ar}</option>
                  ))}
                </select>
              </div>
            )}
          </CfgSection>

          {/* ── مصدر القانون ─────────────────────────────────────────────── */}
          <CfgSection title="مصدر القانون" icon="📚">
            <label htmlFor="law-source-select" className="text-[10px] font-semibold text-muted-foreground block mb-1">
              اختر مصدر القانون
            </label>
            <select
              id="law-source-select"
              aria-label="اختر مصدر القانون"
              value={config.lawSource}
              onChange={(e) => applyLawSource(e.target.value as LawSource | '')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
              style={{ direction: 'rtl' }}
            >
              <option value="" disabled>اختر مصدر القانون</option>
              {(Object.entries(LAW_SOURCE_CFG) as [LawSource, { ar: string }][]).map(([k, v]) => (
                <option key={k} value={k}>• {v.ar}</option>
              ))}
            </select>
          </CfgSection>

          {/* ── Comparative Law toggle, Al-Shamsi toggle & Expert Mode toggle — hidden in the simplified assistant view */}
          {SHOW_LEGACY_CHAT_UI && (
          <>
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
              <p className="text-[9px] leading-relaxed mt-0.5 text-indigo-500">
                مقارنة منهجية بين الموقف الإماراتي والموقف الفرنسي مع جدول مقارن في كل إجابة.
              </p>
            </div>
          </label>

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
              <p className="text-[9px] leading-relaxed mt-0.5" style={{ color: '#3a6fa8' }}>
                نظرية الشامسي — تحليل إضافي للقرارات الذكية والخوارزميات وفق المبادئ الأحد عشر.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-between bg-gold/10 border border-gold/25 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-xs font-bold text-gold/75">وضع الخبير</p>
              <p className="text-[10px] text-gold">خيارات التحليل المتقدمة للتحليل الاحترافي العميق</p>
            </div>
            <button type="button" onClick={onToggleExpert}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${expertMode ? 'bg-gold' : 'bg-muted border border-border'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${expertMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          </>
          )}

          {/* ── Main legal question box ──────────────────────────────────── */}
          <div className="relative bg-card border-2 border-primary/25 rounded-2xl shadow-sm focus-within:border-primary/50 transition-colors mt-2">
            <textarea
              rows={4}
              className="w-full resize-none rounded-2xl bg-transparent px-4 py-4 pe-14 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none leading-relaxed"
              placeholder="اكتب سؤالك القانوني"
              dir="rtl"
              value={currentInput ?? ''}
              onChange={(e) => onInputChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onStart();
                }
              }}
            />
            <button
              type="button"
              onClick={onStart}
              aria-label="إرسال السؤال القانوني"
              title="إرسال السؤال القانوني"
              className="absolute bottom-3 start-3 h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" aria-hidden />
            </button>
          </div>

          {/* ── شكل الإجابة ───────────────────────────────────────────────── */}
          <CfgSection title="شكل الإجابة" icon="🗒">
            <label htmlFor="answer-format-select" className="text-[10px] font-semibold text-muted-foreground block mb-1">
              اختر شكل الإجابة
            </label>
            <select
              id="answer-format-select"
              aria-label="اختر شكل الإجابة"
              value={config.answerFormat}
              onChange={(e) => onChange({ ...config, answerFormat: e.target.value as AnswerFormat | '' })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
              style={{ direction: 'rtl' }}
            >
              <option value="" disabled>اختر شكل الإجابة</option>
              {(Object.entries(ANSWER_FORMAT_CFG) as [AnswerFormat, { ar: string }][]).map(([k, v]) => (
                <option key={k} value={k}>• {v.ar}</option>
              ))}
            </select>
          </CfgSection>

          {/* ── زر الإرسال ────────────────────────────────────────────────── */}
          <Button
            type="button"
            onClick={onStart}
            disabled={!currentInput?.trim()}
            className="w-full h-11 rounded-xl text-sm font-bold"
          >
            <Send className="w-4 h-4 me-2" aria-hidden />
            إرسال / تنفيذ
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Training scenario workspace (سيناريوهات التدريب والمراجعة القضائية) ──────
// Reached from the sidebar sub-menu (النقل من الصفحة الرئيسية — نفس المنطق والمخرجات،
// مع وراثة تلقائية للتصنيف القانوني/الفرع/التخصص/مصدر القانون من نفس الجلسة).

function TrainingScenarioWorkspace({
  outputType, config, trainingText, onTrainingTextChange, onStart, busy,
}: {
  outputType: TrainingOutputType;
  config: SessionConfig;
  trainingText: string;
  onTrainingTextChange: (v: string) => void;
  onStart: () => void;
  busy: boolean;
}) {
  const cfg = TRAINING_OUTPUT_CFG[outputType];
  const branch = getLegalBranchDef(config.legalDomain, config.legalBranch);
  const spec = getLegalSpecializationDef(config.legalDomain, config.legalBranch, config.legalSpecialization);

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4" dir="rtl">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-xl">🎓</span>
            <h2 className="text-base font-bold text-foreground">
              تدريب على إعداد {cfg.ar}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            سيناريوهات التدريب والمراجعة القضائية الافتراضية
          </p>
        </div>

        {/* ── التصنيف الموروث تلقائياً من الجلسة الحالية ────────────────── */}
        {(config.legalDomain || config.lawSource) && (
          <div className="mb-3 flex flex-wrap gap-1.5 justify-center">
            {config.legalDomain && (
              <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
                🧭 {LEGAL_TAXONOMY[config.legalDomain].ar}
                {branch ? ` · ${branch.ar}` : ''}
                {spec ? ` · ${spec.ar}` : ''}
              </span>
            )}
            {config.lawSource && (
              <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
                📚 {LAW_SOURCE_CFG[config.lawSource].ar}
              </span>
            )}
          </div>
        )}

        <label htmlFor="training-workspace-textarea" className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
          اكتب الواقعة أو القضية أو السؤال القانوني هنا...
        </label>
        <textarea
          id="training-workspace-textarea"
          aria-label="اكتب الواقعة أو القضية أو السؤال القانوني هنا"
          rows={6}
          className="w-full resize-none rounded-xl border-2 border-primary/25 bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50 leading-relaxed"
          placeholder="اكتب الواقعة أو القضية أو السؤال القانوني هنا..."
          dir="rtl"
          value={trainingText}
          onChange={(e) => onTrainingTextChange(e.target.value)}
        />

        <Button
          type="button"
          onClick={onStart}
          disabled={!trainingText.trim() || busy}
          className="w-full h-11 rounded-xl text-sm font-bold mt-3"
        >
          <Send className="w-4 h-4 me-2" aria-hidden />
          بدء التدريب
        </Button>
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
      {config.legalDomain && (
        <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
          🧭 {LEGAL_TAXONOMY[config.legalDomain].ar}
          {(() => {
            const branch = getLegalBranchDef(config.legalDomain, config.legalBranch);
            if (!branch) return null;
            const spec = getLegalSpecializationDef(config.legalDomain, config.legalBranch, config.legalSpecialization);
            return ` · ${branch.ar}${spec ? ` · ${spec.ar}` : ''}`;
          })()}
        </span>
      )}
      {config.lawSource && (
        <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
          📚 {LAW_SOURCE_CFG[config.lawSource].ar}
        </span>
      )}
      {config.answerFormat && (
        <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium">
          🗒 {ANSWER_FORMAT_CFG[config.answerFormat].ar}
        </span>
      )}
      {/* Extra state badges — hidden in the simplified assistant view; role/jurisdiction/answer-mode above are the only selectors shown */}
      {SHOW_LEGACY_CHAT_UI && POLICE_IDENTITY_TYPES.has(config.userType) && (
        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
          🔍 وحدة الشرطة
        </span>
      )}
      {SHOW_LEGACY_CHAT_UI && config.comparativeMode && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          🇦🇪↔🇫🇷 مقارنة إماراتي–فرنسي
        </span>
      )}
      {SHOW_LEGACY_CHAT_UI && config.applyAdvancedStandard && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: '#EAF2FF', color: '#1a3a6e', border: '1px solid #a8c4f0' }}
        >
          🧠 المعيار المتقدم
        </span>
      )}
      {SHOW_LEGACY_CHAT_UI && expertMode && (
        <span className="text-[10px] bg-gold/10 text-gold border border-gold/25 px-2 py-0.5 rounded-full font-bold">
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
    <div className="mb-2 bg-gold/60 border border-gold/70 rounded-xl px-3 py-2" dir="rtl">
      <p className="text-[10px] font-bold text-gold/75 mb-1.5 uppercase tracking-wide">خيارات الخبير</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {EXPERT_OPT_LABELS.map(({ key, ar }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={options[key]}
              onChange={(e) => onChange({ ...options, [key]: e.target.checked })}
              className="w-3 h-3 rounded accent-gold"
            />
            <span className="text-[10px] text-gold/75 font-medium">{ar}</span>
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
      <span className={`font-semibold ${warn ? 'text-gold' : 'text-foreground'}`}>{value}</span>
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
  { key: 'uae_compare',  emoji: '🇦🇪', ar: 'مقارنة بالقانون الإماراتي', color: 'bg-heading/10 border-heading/25 text-heading/75 hover:bg-heading/15' },
  { key: 'ai_analysis',  emoji: '🧠', ar: 'تحليل الذكاء الاصطناعي',    color: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100' },
  { key: 'shamsi',       emoji: '⚙',  ar: 'تطبيق نظرية الشامسي',       color: 'bg-gold/10 border-gold/25 text-gold/75 hover:bg-gold/15' },
  { key: 'memorandum',   emoji: '📝', ar: 'مذكرة قانونية',              color: 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100' },
  { key: 'appeal',       emoji: '📝', ar: 'صياغة صحيفة طعن',           color: 'bg-gold/10 border-gold/25 text-gold/75 hover:bg-gold/15' },
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
      {(Object.keys(MODE_CONFIG) as ResponseMode[]).filter((m) => m !== 'risk_analysis').map((m) => {
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
                      : <BookOpen className="w-3 h-3 shrink-0 text-gold" />}
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
            {/* prop is named canUseAi but the caller passes canCreateAiSession — this button creates a session (a write action) */}
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
                <BookOpen className="w-3 h-3 text-gold shrink-0" />
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

// ─── V5.0 § 1 — Case Lifecycle Tracker component ─────────────────────────────

function CaseLifecycleTracker({
  stage, onStageChange, onClose,
}: {
  stage: number;
  onStageChange: (s: number) => void;
  onClose: () => void;
}) {
  const pct = Math.round((stage / 10) * 100);
  return (
    <div className="mb-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-indigo-700">⚖️ محرك دورة حياة القضية — المرحلة {stage} من 10</span>
        <button
          type="button"
          onClick={onClose}
          className="text-[9px] text-indigo-400 hover:text-indigo-700 transition-colors"
        >
          إغلاق
        </button>
      </div>
      {/* Progress bar */}
      <div className="w-full bg-indigo-100 rounded-full h-1.5 mb-2">
        <div
          className="bg-indigo-600 h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Stage pills */}
      <div className="flex flex-wrap gap-1">
        {CASE_LIFECYCLE_STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStageChange(s.id)}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
              s.id === stage
                ? 'bg-indigo-600 text-white border-indigo-600'
                : s.id < stage
                  ? 'bg-indigo-100 text-indigo-600 border-indigo-200'
                  : 'bg-white text-muted-foreground border-border'
            }`}
          >
            {s.emoji} {s.ar}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-indigo-500 mt-1.5">
        {stage < 10
          ? `التالية: ${CASE_LIFECYCLE_STAGES[stage]?.emoji} ${CASE_LIFECYCLE_STAGES[stage]?.ar} · الإنجاز الكلي ${pct}%`
          : `✅ القضية مكتملة — ${pct}% إنجاز`
        }
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AiAssistant() {
  const t = useT();
  const { canUseAi, role } = useUserContext();
  // The backend restricts session/message *writes* (create session, send message,
  // rename/delete) to owner|supervisor via requireSupervisorOrOwner — narrower than
  // canUseAi (any non-citizen role, used for read access like GET sessions/messages).
  // Read-only roles (e.g. the guest/reviewer account) must not see write controls as
  // enabled, or they hit a 403 and the UI gets stuck (e.g. an eternal auto-create spinner).
  const canCreateAiSession = role === 'owner' || role === 'supervisor';
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
  const [currentMode, setCurrentMode] = useState<ResponseMode>('standard');
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
  /** MLOS restructured flow — سيناريوهات التدريب والمراجعة القضائية الافتراضية (Path 2). Independent of the main question box. */
  const [trainingText, setTrainingText] = useState('');
  // Query param set by the sidebar's "سيناريوهات التدريب والمراجعة القضائية" sub-menu
  // (e.g. /assistant?train=legal_memorandum). The component stays mounted across
  // sub-menu clicks (path never changes), so sessionConfig — and therefore the
  // legal domain/branch/specialization/source classification — is inherited automatically.
  const [searchParams] = useSearchParams();
  const trainParam = searchParams.get('train');
  const activeTrainingType: TrainingOutputType | '' =
    trainParam && trainParam in TRAINING_OUTPUT_CFG ? (trainParam as TrainingOutputType) : '';

  // ── Scenario Engine config ─────────────────────────────────────────────────
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig>(DEFAULT_SCENARIO_CONFIG);

  // ── V5.0 § 1 — Case Lifecycle Engine (0 = off, 1–10 = active stage) ────────
  const [lifecycleStage, setLifecycleStage] = useState<number>(0);
  const [showLifecycle, setShowLifecycle] = useState(false);

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

  // ── Go straight to the question interface — no "create a conversation first"
  // gate. If a guided/home-composer query is about to auto-start, let that flow
  // create its own session; otherwise open a session automatically on load.
  useEffect(() => {
    if (sessionStorage.getItem('pendingAssistantQuery')) return;
    // Read-only roles (e.g. the guest/reviewer account) can't create sessions —
    // POST /api/assistant/sessions 403s for them. Skip the auto-create so the
    // page doesn't get stuck on an infinite spinner waiting for an activeSession
    // that will never arrive; the read-only empty state below handles this case.
    if (!canCreateAiSession) return;
    createSession();
  }, [canCreateAiSession]);

  // ── Auto-start from home composer ──────────────────────────────────────────
  useEffect(() => {
    if (autoStartGuardRef.current) return;
    const pending = sessionStorage.getItem('pendingAssistantQuery');
    if (!pending) return;
    autoStartGuardRef.current = true;
    const query = pending.trim();
    if (!query) { sessionStorage.removeItem('pendingAssistantQuery'); return; }

    // ── Apply the guided front-door config from the dashboard, if present ────
    let guidedMode: ResponseMode | null = null;
    let appliedSessionConfig: SessionConfig = DEFAULT_SESSION_CONFIG;
    let appliedScenarioConfig: ScenarioConfig = DEFAULT_SCENARIO_CONFIG;
    let guidedConfigApplied = false;
    const rawCfg = sessionStorage.getItem('pendingAssistantConfig');
    if (rawCfg) {
      try {
        const cfg = JSON.parse(rawCfg) as Partial<GuidedAssistantConfig>;
        appliedSessionConfig = {
          ...DEFAULT_SESSION_CONFIG,
          userType: (cfg.userType as UserType) ?? DEFAULT_SESSION_CONFIG.userType,
          answerMode: cfg.answerStyle === 'quick' ? 'quick' : 'standard',
          depth: cfg.answerStyle === 'detailed' ? 'comprehensive' : cfg.answerStyle === 'standard' ? 'detailed' : DEFAULT_SESSION_CONFIG.depth,
          jurisdiction: cfg.legalReference === 'france' ? 'france' : cfg.legalReference === 'comparative' ? 'comparative' : 'uae',
          comparativeMode: cfg.legalReference === 'comparative',
          applyAdvancedStandard: cfg.legalReference === 'shamsi',
        };
        setSessionConfig(appliedSessionConfig);
        if (cfg.trainingMode) {
          const branchToCaseType: Record<string, ScenarioConfig['caseType']> = {
            admin: 'administrative', civil: 'civil', commercial: 'commercial', criminal: 'criminal',
          };
          appliedScenarioConfig = {
            ...DEFAULT_SCENARIO_CONFIG,
            scenarioType: 'training',
            caseType: cfg.legalBranch ? (branchToCaseType[cfg.legalBranch] ?? DEFAULT_SCENARIO_CONFIG.caseType) : DEFAULT_SCENARIO_CONFIG.caseType,
          };
          setScenarioConfig(appliedScenarioConfig);
          guidedMode = 'scenario_builder';
        }
        guidedConfigApplied = true;
      } catch { /* ignore malformed config */ }
    }
    if (guidedConfigApplied) setConfigCommitted(true); // dashboard already collected the config — skip the panel

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
          if (rawCfg) sessionStorage.setItem('pendingAssistantConfig', rawCfg); // preserve guided selections for retry
          toast({
            title: t('تعذّر بدء المحادثة', 'Could not start conversation'),
            description: t('حاول مرة أخرى', 'Please try again'),
            variant: 'destructive',
          });
          return;
        }
        sessionStorage.removeItem('pendingAssistantQuery');
        sessionStorage.removeItem('pendingAssistantConfig');
        const session: Session = await sr.json();
        setSessions((prev) => [session, ...prev]);
        setActiveSession(session);

        const tempId = Date.now();
        const mode = guidedMode ?? detectMode(query);
        setCurrentMode(mode);
        if (guidedMode) setModeLocked(true);
        const userMsg: Message = { id: tempId, sessionId: session.id, role: 'user', content: query, createdAt: new Date().toISOString() };
        setMessages([userMsg]);

        const content =
          mode === 'expert'           ? EXPERT_MODE_PREFIX + query :
          mode === 'scenario_builder' ? buildScenarioPrefix(appliedScenarioConfig, appliedSessionConfig.userType) + query :
          query;
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
    if (!input.trim()) { setCurrentMode('standard'); return; }
    setCurrentMode(detectMode(input));
  }, [input, modeLocked]);

  // Sync court mode when court_full response mode is selected
  useEffect(() => {
    if (currentMode === 'court_full') setCourtMode(true);
  }, [currentMode]);

  // Sync Al-Shamsi when shamsi_theory response mode is selected
  useEffect(() => {
    if (currentMode === 'shamsi_theory') {
      setSessionConfig((c) => ({ ...c, applyAdvancedStandard: true }));
    }
  }, [currentMode]);

  async function createSession() {
    if (!canCreateAiSession) return; // read-only roles cannot create sessions (403) — defensive guard
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

  async function sendMessage(overrideText?: string, overrideMode?: ResponseMode, contentOverride?: string) {
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

    // Build API content — config prefix + optional mode instruction.
    // contentOverride, when provided, is the MLOS restructured flow's fully-assembled
    // request body (المجال القانوني / الفرع / مصدر القانون / شكل الإجابة / سيناريو التدريب),
    // superseding the legacy mode-based prefix switch below.
    const configPfx = buildConfigPrefix(sessionConfig, expertMode, expertOptions);
    // V5.0 § 1 — prepend case lifecycle context when a stage is active
    const lifecyclePfx = lifecycleStage > 0 ? buildLifecyclePrefix(lifecycleStage) : '';
    const content = lifecyclePfx + configPfx + (
      contentOverride !== undefined ? contentOverride :
      mode === 'expert'            ? EXPERT_MODE_PREFIX + text :
      mode === 'exemplary'         ? EXEMPLARY_MODE_PREFIX + text :
      mode === 'scenario_builder'  ? buildScenarioPrefix(scenarioConfig, sessionConfig.userType) + text :
      mode === 'judicial_review'   ? JUDICIAL_REVIEW_PREFIX + text :
      mode === 'risk_analysis'     ? RISK_ENGINE_PREFIX + text :
      text
    );

    const body = JSON.stringify({
      content,
      documentIds: pinnedDocs.length > 0 ? pinnedDocs : undefined,
      legalSourceIds: pinnedSrcs.length > 0 ? pinnedSrcs : undefined,
      theoryLensId: theoryLens.lensId !== 'uae_only' ? theoryLens.lensId : undefined,
      customTheoryText: theoryLens.lensId === 'custom' ? theoryLens.customText : undefined,
    });

    // Snapshot of the message count *before* this turn — used to detect,
    // via a plain re-fetch, whether the server-side pipeline actually
    // finished and saved the assistant reply even though our connection to
    // it was interrupted. The AI generation on the server is independent of
    // the HTTP response stream (writes to a dropped connection are swallowed
    // server-side), so on a client-visible disconnect the safest single
    // retry is "ask the server what happened" rather than resubmitting the
    // question, which would insert a duplicate user message.
    const countBeforeSend = messages.length;

    async function pollForRecoveredReply(): Promise<Message | null> {
      if (!activeSession) return null;
      try {
        const r = await apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`);
        if (!r.ok) return null;
        const data = await r.json();
        const msgs = (data.messages ?? []) as Message[];
        // +2 = the user message we just sent + the assistant reply we're waiting on
        if (msgs.length >= countBeforeSend + 2) {
          const last = msgs[msgs.length - 1];
          if (last.role === 'assistant') return last;
        }
        return null;
      } catch {
        return null;
      }
    }

    /** One retry, after a short delay, giving the in-flight server pipeline time to finish. */
    async function retryOnceViaPoll(): Promise<Message | null> {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      return pollForRecoveredReply();
    }

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
        // True once we've shown the user a terminal, server-explained error —
        // suppresses the generic "connection lost" toast so the user only
        // ever sees one (accurate) message instead of two conflicting ones.
        let errorAlreadyHandled = false;

        const applyRecoveredReply = (finalMsg: Message, citations: Citation[]) => {
          receivedDone = true;
          const msgWithMeta: Message = { ...finalMsg, meta: { ...(finalMsg.meta ?? {}), citations } };
          setMsgDisplayMetaMap((prev) => ({ ...prev, [finalMsg.id]: { mode, userQuery: text } }));
          setMessages((prev) => prev.map((m) => (m.id === streamTempId ? msgWithMeta : m)));
          fetchSessions();
        };

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
                if (parsed.reset === true) {
                  // Server discarded a failed partial attempt and is starting
                  // over (retry or non-streaming fallback) — clear the bubble
                  // so the retried content doesn't get appended to garbage.
                  fullContent = '';
                  setMessages((prev) =>
                    prev.map((m) => m.id === streamTempId ? { ...m, content: '' } : m)
                  );
                } else if (typeof parsed.delta === 'string') {
                  fullContent += parsed.delta;
                  setMessages((prev) =>
                    prev.map((m) => m.id === streamTempId ? { ...m, content: fullContent } : m)
                  );
                } else if (parsed.done && parsed.message) {
                  applyRecoveredReply(parsed.message as Message, (parsed.citations ?? []) as Citation[]);
                } else if (parsed.error) {
                  errorAlreadyHandled = true;
                  // technical detail stays in the console/server logs; the user
                  // only ever sees the Arabic-friendly summary
                  console.error('Assistant stream error:', parsed.error, parsed.code);
                  toast({
                    title: t('تعذّر توليد الرد', 'Response failed'),
                    description: typeof parsed.arabicMessage === 'string'
                      ? parsed.arabicMessage
                      : t('حدث خطأ في خدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.', 'The AI service failed. Please try again.'),
                    variant: 'destructive',
                  });
                  // Remove the streaming placeholder on server-emitted error
                  setMessages((prev) => prev.filter((m) => m.id !== streamTempId));
                }
              } catch { /* malformed NDJSON line — skip */ }
            }
          }
          // EOF without a `done` line and without an explicit server error —
          // the connection itself dropped. Try one silent automatic recovery
          // before bothering the user, since the server-side generation may
          // have completed and saved successfully after we lost the socket.
          if (!receivedDone && !errorAlreadyHandled) {
            const recovered = await retryOnceViaPoll();
            if (recovered) {
              applyRecoveredReply(recovered, ((recovered.meta as { citations?: Citation[] } | undefined)?.citations ?? []));
            } else {
              console.error('Assistant stream disconnected before completion; automatic retry found no saved reply.');
              toast({
                title: t('انقطع الاتصال', 'Connection lost'),
                description: t(
                  'انتهى البث قبل اكتمال الرد، وفشلت إعادة المحاولة التلقائية. يرجى إعادة إرسال سؤالك.',
                  'The stream ended before the response completed, and the automatic retry found no result. Please resend your question.',
                ),
                variant: 'destructive',
              });
              if (!fullContent) {
                setMessages((prev) => prev.filter((m) => m.id !== streamTempId));
              }
            }
          }
        } catch (readerErr) {
          // Network / reader failure — same single automatic recovery attempt.
          console.error('Assistant stream reader failed:', readerErr);
          const recovered = await retryOnceViaPoll();
          if (recovered) {
            applyRecoveredReply(recovered, ((recovered.meta as { citations?: Citation[] } | undefined)?.citations ?? []));
          } else {
            toast({
              title: t('خطأ في البث', 'Streaming error'),
              description: t(
                'انقطع البث بشكل غير متوقع، وفشلت إعادة المحاولة التلقائية. يرجى إعادة إرسال سؤالك.',
                'The stream was interrupted unexpectedly, and the automatic retry found no result. Please resend your question.',
              ),
              variant: 'destructive',
            });
            setMessages((prev) => prev.filter((m) => m.id !== streamTempId));
          }
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
        const errData = await streamR.json().catch(() => ({})) as { error?: string; arabicMessage?: string; code?: string };
        console.error('Assistant non-streaming request failed:', errData.error, errData.code);
        toast({
          title: t('تعذّر توليد الرد', 'Response failed'),
          description: errData.arabicMessage ?? t('حدث خطأ في خدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.', 'The AI service failed. Please try again.'),
          variant: 'destructive',
        });
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
      }
    } catch (fetchErr) {
      // The initial connection to the server itself failed (offline, DNS,
      // CORS, etc — never reached the streaming/non-streaming branches
      // above). Same single-retry recovery: the user's message may already
      // be saved server-side even if we never saw a response.
      console.error('Assistant request failed before a response was received:', fetchErr);
      const recovered = await retryOnceViaPoll();
      if (recovered) {
        setMsgDisplayMetaMap((prev) => ({ ...prev, [recovered.id]: { mode, userQuery: text } }));
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsgId), userMsg, recovered]);
        fetchSessions();
      } else {
        toast({
          title: t('خطأ في الاتصال', 'Connection error'),
          description: t(
            'تعذّر الاتصال بالخادم، وفشلت إعادة المحاولة التلقائية. يرجى إعادة إرسال سؤالك.',
            'Could not reach the server, and the automatic retry found no result. Please resend your question.',
          ),
          variant: 'destructive',
        });
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
      }
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
    setCurrentMode('standard');
  }

  const toggleDoc = (id: number) =>
    setPinnedDocs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSrc = (id: number) =>
    setPinnedSrcs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const totalPinned = pinnedDocs.length + pinnedSrcs.length;

  return (
    <AppLayout variant="chat" hideDemoBanner>
      {/* Mobile sessions drawer — hidden in the simplified Judicial Command Center assistant view */}
      {SHOW_LEGACY_CHAT_UI && (
        <SessionsDrawer
          open={showSessionsDrawer}
          sessions={sessions}
          activeId={activeSession?.id}
          onSelect={(s) => { switchSession(s); setShowSessionsDrawer(false); }}
          onDelete={deleteSession}
          onCreate={async () => { await createSession(); setShowSessionsDrawer(false); }}
          onClose={() => setShowSessionsDrawer(false)}
          canUseAi={canCreateAiSession}
          t={t}
        />
      )}

      {/* ─── Main flex layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden" dir="rtl">

        {/* ─── Desktop sessions sidebar — hidden in the simplified assistant view ───── */}
        {SHOW_LEGACY_CHAT_UI && (
        <div className="hidden md:flex md:w-52 lg:w-60 shrink-0 flex-col gap-2 p-3 lg:p-4 border-e border-border bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-foreground">{t('المحادثات', 'Conversations')}</h2>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={createSession} disabled={!canCreateAiSession}>
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
            <div className="text-[10px] text-gold bg-gold/10 border border-gold/25 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shrink-0">
              <Pin className="w-3 h-3 shrink-0" />
              {t(`${totalPinned} مثبّت`, `${totalPinned} pinned`)}
            </div>
          )}
        </div>
        )}

        {/* ─── Chat column ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

          {/* Chat header */}
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border/50 flex items-center gap-2.5 shrink-0 bg-card">
            {SHOW_LEGACY_CHAT_UI && (
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
            )}

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
            {/* Expert Mode toggle — hidden in the simplified assistant view */}
            {SHOW_LEGACY_CHAT_UI && (
              <button
                type="button"
                onClick={() => setExpertMode((v) => !v)}
                className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors shrink-0 ${
                  expertMode
                    ? 'bg-gold text-white border-gold'
                    : 'border-border text-muted-foreground hover:bg-muted/30'
                }`}
                title={t('وضع الخبير', 'Expert Mode')}
              >
                ⭐ {expertMode ? t('مفعّل', 'Active') : t('وضع الخبير', 'Expert Mode')}
              </button>
            )}
            {SHOW_LEGACY_CHAT_UI && activeSession && (
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
              !canCreateAiSession ? (
                // Read-only roles (guest/reviewer) can browse but never get an
                // auto-created session — show a clear static state instead of
                // spinning forever waiting for a 403'd request to succeed.
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4" dir="rtl">
                  <Bot className="w-8 h-8 text-muted-foreground/30" aria-hidden />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {t('حسابك للقراءة فقط ولا يمكنه بدء محادثات جديدة مع المساعد الذكي.', 'Your account is read-only and cannot start new AI assistant conversations.')}
                  </p>
                </div>
              ) : (
                // Session opens automatically on load — this only shows for the brief moment while that request is in flight.
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )
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
                activeTrainingType ? (
                  <TrainingScenarioWorkspace
                    outputType={activeTrainingType}
                    config={sessionConfig}
                    trainingText={trainingText}
                    onTrainingTextChange={setTrainingText}
                    busy={sending}
                    onStart={() => {
                      if (!trainingText.trim()) return;
                      setConfigCommitted(true);
                      sendMessage(trainingText, undefined, buildTrainingRequestContent(sessionConfig, activeTrainingType, trainingText));
                      setTrainingText('');
                    }}
                  />
                ) : (
                <PreAnalysisPanel
                  config={sessionConfig}
                  onChange={setSessionConfig}
                  onStart={() => {
                    if (!input.trim()) return;
                    setConfigCommitted(true);
                    sendMessage(input, undefined, buildGeneralRequestContent(sessionConfig, input));
                  }}
                  expertMode={expertMode}
                  onToggleExpert={() => setExpertMode((v) => !v)}
                  currentInput={input}
                  onInputChange={setInput}
                />
                )
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
            {/* Pin panel popup — hidden in the simplified assistant view */}
            {SHOW_LEGACY_CHAT_UI && showPinPanel && (
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

            {/* Expert options panel — hidden in the simplified assistant view */}
            {SHOW_LEGACY_CHAT_UI && activeSession && expertMode && configCommitted && (
              <ExpertOptionsPanel options={expertOptions} onChange={setExpertOptions} />
            )}

            {/* V5.0 § 1 — Case Lifecycle Tracker — hidden in the simplified assistant view */}
            {SHOW_LEGACY_CHAT_UI && activeSession && showLifecycle && lifecycleStage > 0 && (
              <CaseLifecycleTracker
                stage={lifecycleStage}
                onStageChange={setLifecycleStage}
                onClose={() => { setShowLifecycle(false); setLifecycleStage(0); }}
              />
            )}

            {/* Scenario Engine inputs — hidden in the simplified assistant view; scenario_builder mode still works with its defaults */}
            {SHOW_LEGACY_CHAT_UI && activeSession && currentMode === 'scenario_builder' && (
              <ScenarioInputPanel
                config={scenarioConfig}
                onChange={setScenarioConfig}
                disabled={sending || !canCreateAiSession}
              />
            )}

            {/* Response mode selector & Theory Lens selector — removed per the MLOS restructured
                legal-analysis flow: response shape is now driven exclusively by شكل الإجابة /
                سيناريوهات التدريب (selected once in the pre-analysis panel), not by chat-time chips. */}
            {SHOW_LEGACY_CHAT_UI && activeSession && (
              <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                <ResponseModeSelector
                  value={currentMode}
                  onChange={(m) => { setCurrentMode(m); setModeLocked(true); }}
                  disabled={sending || !canCreateAiSession}
                />
              </div>
            )}

            {SHOW_LEGACY_CHAT_UI && activeSession && !courtMode && (
              <div className="mb-2">
                <TheoryLensSelector
                  value={theoryLens}
                  onChange={setTheoryLens}
                  arabic={true}
                  disabled={sending || !canCreateAiSession}
                />
              </div>
            )}

            {/* Stage 5 — Court mode toggles — hidden in the simplified assistant view; court_full mode remains selectable from the answer-mode selector */}
            {SHOW_LEGACY_CHAT_UI && activeSession && canCreateAiSession && (
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
                      ? 'bg-gold text-white border-gold shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:border-gold/80 hover:text-gold'
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

                {/* V5.0 § 1 — Case Lifecycle toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (!showLifecycle) { setShowLifecycle(true); if (lifecycleStage === 0) setLifecycleStage(1); }
                    else { setShowLifecycle(false); setLifecycleStage(0); }
                  }}
                  disabled={sending}
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                    showLifecycle && lifecycleStage > 0
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  ⚖️ {showLifecycle && lifecycleStage > 0 ? `دورة الحياة — م${lifecycleStage}` : 'دورة حياة القضية'}
                </button>
              </div>
            )}

            {/* Pinned badges — hidden in the simplified assistant view */}
            {SHOW_LEGACY_CHAT_UI && totalPinned > 0 && (
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
                    <span key={id} className="flex items-center gap-1 bg-gold/10 border border-gold/25 text-gold text-[10px] px-2 py-0.5 rounded-full">
                      <BookOpen className="w-2.5 h-2.5 shrink-0" />
                      <span className="max-w-[80px] sm:max-w-[120px] truncate">{s.titleAr ?? s.title}</span>
                      <button type="button" onClick={() => toggleSrc(id)} className="shrink-0"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2">
              {/* Pin button — hidden in the simplified assistant view */}
              {SHOW_LEGACY_CHAT_UI && (
                <button
                  type="button"
                  onClick={() => setShowPinPanel((s) => !s)}
                  disabled={!activeSession}
                  className={`shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40 ${
                    totalPinned > 0
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/80'
                  }`}
                  title={t('تثبيت مصادر', 'Pin sources')}
                >
                  {totalPinned > 0 ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                </button>
              )}

              <label className="sr-only" htmlFor="assistant-input">{t('رسالتك', 'Your message')}</label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                className="flex-1 resize-none border border-border rounded-xl px-3 py-2 sm:py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground min-w-0"
                placeholder={
                  totalPinned > 0
                    ? t('اكتب سؤالك...', 'Type your question...')
                    : t('اكتب سؤالك القانوني…', 'Type your legal question…')
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={!activeSession || !canCreateAiSession}
                style={{ minHeight: '2.25rem', maxHeight: '7rem' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
                }}
              />
              <Button
                size="sm"
                className={`shrink-0 h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl ${courtMode ? 'bg-gold hover:bg-gold border-gold' : ''}`}
                onClick={() => courtMode ? runCourtSession() : sendMessage()}
                disabled={!input.trim() || !activeSession || sending || courtLoading || !canCreateAiSession}
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
