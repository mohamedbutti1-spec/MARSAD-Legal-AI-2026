/**
 * Module 1 — Intelligent Administrative Decision Workspace
 * Constitutional administrative decision creation — 11 sequential legal stages.
 * M. Al-Shamsi Framework™ · MARSAD Constitutional Standard v1.0
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Shield, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronDown, ChevronUp,
  Sparkles, Scale, AlertTriangle, Building2, FileText, Loader2, ArrowRight,
  Lock, Check,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageKey =
  | 'administrative_request' | 'legal_authority' | 'facts_evidence'
  | 'legal_basis' | 'administrative_objective' | 'discretionary_power'
  | 'proportionality' | 'human_oversight' | 'constitutional_validation'
  | 'decision_drafting' | 'final_review';

interface Decision {
  id: number; caseNumber: string; titleAr: string; titleEn?: string;
  status: string; currentStage: string; stagesCompleted: string[];
  jurisdiction: string; decisionType: string; organizationUnit: string;
  issuingAuthority?: string; createdAt: string;
}

interface DecisionStage {
  id: number; decisionId: number; stageKey: string; stageNumber: number;
  stageData: Record<string, unknown>; aiContribution?: string;
  aiAnalysis: Record<string, unknown>; validationStatus: string;
  validationDetails: Record<string, unknown>; completedAt?: string;
}

// ─── Stage Configuration ──────────────────────────────────────────────────────

const STAGE_ORDER: StageKey[] = [
  'administrative_request', 'legal_authority', 'facts_evidence', 'legal_basis',
  'administrative_objective', 'discretionary_power', 'proportionality',
  'human_oversight', 'constitutional_validation', 'decision_drafting', 'final_review',
];

interface StageConfig { nameAr: string; nameEn: string; principleAr: string; isGate?: boolean; }
const STAGE_CONFIG: Record<StageKey, StageConfig> = {
  administrative_request:  { nameAr: 'الطلب الإداري',          nameEn: 'Administrative Request',    principleAr: 'تحديد موضوع القرار وطبيعته وأطرافه' },
  legal_authority:         { nameAr: 'التحقق من الاختصاص',     nameEn: 'Legal Authority',           principleAr: 'الاختصاص الموضوعي والمكاني والزمني والدرجي' },
  facts_evidence:          { nameAr: 'الوقائع والأدلة',         nameEn: 'Facts & Evidence',          principleAr: 'الركن المادي — وجود الوقائع وصحتها واكتمالها' },
  legal_basis:             { nameAr: 'السند القانوني',          nameEn: 'Legal Basis',               principleAr: 'الركن القانوني — المشروعية والتسمية والسبب' },
  administrative_objective:{ nameAr: 'الهدف الإداري',          nameEn: 'Administrative Objective',  principleAr: 'الغاية الإدارية ومبدأ درء انحراف السلطة' },
  discretionary_power:     { nameAr: 'السلطة التقديرية',        nameEn: 'Discretionary Power',       principleAr: 'حدود السلطة التقديرية وضوابط ممارستها' },
  proportionality:         { nameAr: 'مبدأ التناسب',            nameEn: 'Proportionality',           principleAr: 'الملاءمة · الضرورة · التناسب الدقيق' },
  human_oversight:         { nameAr: 'الرقابة البشرية',         nameEn: 'Human Oversight',           principleAr: 'المبدأ الدستوري الرابع — الإنسان يقرر · الذكاء يسند' },
  constitutional_validation:{ nameAr: 'التحقق الدستوري',        nameEn: 'Constitutional Validation', principleAr: 'بوابة المشروعية الدستورية — 10 مبادئ · إطار الشامسي', isGate: true },
  decision_drafting:       { nameAr: 'صياغة القرار',            nameEn: 'Decision Drafting',         principleAr: 'الصياغة الرسمية للقرار الإداري باللغة العربية' },
  final_review:            { nameAr: 'المراجعة النهائية',       nameEn: 'Final Review',              principleAr: 'الاعتماد النهائي وإصدار القرار الموقّع' },
};

const JURISDICTION_LABELS: Record<string, string> = {
  uae: 'الإمارات', sa: 'السعودية', qa: 'قطر', bh: 'البحرين', kw: 'الكويت', om: 'عُمان', fr: 'فرنسا', eu: 'الاتحاد الأوروبي',
};

// ─── API Helper ───────────────────────────────────────────────────────────────

function apiFetch(method: string, path: string, body?: unknown) {
  const role = localStorage.getItem('userRole') || 'owner';
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
    body: body != null ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || r.statusText); }
    return r.json();
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ValidationBadge({ status }: { status: string }) {
  if (status === 'passed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40">
      <Check className="w-3 h-3" /> اجتاز التحقق
    </span>
  );
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800/40">
      <XCircle className="w-3 h-3" /> لم يجتز التحقق
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-slate-500 bg-slate-50 border-slate-200 dark:border-slate-700">
      <Clock className="w-3 h-3" /> في انتظار التحقق
    </span>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-foreground/80 mb-1.5">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-colors ${className ?? ''}`}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-colors resize-none"
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
    >
      <option value="">— اختر —</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Stage Form Fields ────────────────────────────────────────────────────────

function StageForm({ stageKey, data, onChange }: {
  stageKey: StageKey; data: Record<string, unknown>; onChange: (field: string, value: unknown) => void;
}) {
  const v = (field: string, fallback = '') => (data[field] as string) ?? fallback;
  const b = (field: string) => Boolean(data[field]);

  switch (stageKey) {
    case 'administrative_request': return (
      <div className="space-y-4">
        <div><FieldLabel required>عنوان الطلب</FieldLabel>
          <TextInput value={v('requestTitle')} onChange={(val) => onChange('requestTitle', val)} placeholder="أدخل عنوان الطلب الإداري" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><FieldLabel required>نوع القرار الإداري</FieldLabel>
            <SelectInput value={v('requestType')} onChange={(val) => onChange('requestType', val)} options={[
              { value: 'appointment', label: 'تعيين' }, { value: 'promotion', label: 'ترقية' },
              { value: 'dismissal', label: 'فصل / إنهاء خدمة' }, { value: 'license', label: 'منح ترخيص' },
              { value: 'revocation', label: 'إلغاء ترخيص' }, { value: 'penalty', label: 'فرض عقوبة تأديبية' },
              { value: 'confiscation', label: 'مصادرة' }, { value: 'expropriation', label: 'نزع ملكية' },
              { value: 'suspension', label: 'إيقاف عن العمل' }, { value: 'other', label: 'أخرى' },
            ]} /></div>
          <div><FieldLabel required>درجة الأولوية</FieldLabel>
            <SelectInput value={v('urgencyLevel')} onChange={(val) => onChange('urgencyLevel', val)} options={[
              { value: 'routine', label: 'عادية' }, { value: 'urgent', label: 'مستعجلة' }, { value: 'emergency', label: 'طارئة' },
            ]} /></div>
        </div>
        <div><FieldLabel required>الطرف الطالب / المعني</FieldLabel>
          <TextInput value={v('requestingParty')} onChange={(val) => onChange('requestingParty', val)} placeholder="الاسم الكامل للطرف المعني" /></div>
        <div><FieldLabel required>الجهة الإدارية ذات الصلة</FieldLabel>
          <TextInput value={v('requestingOrganization')} onChange={(val) => onChange('requestingOrganization', val)} placeholder="اسم الجهة الحكومية أو الإدارية" /></div>
        <div><FieldLabel required>وصف الطلب الإداري</FieldLabel>
          <TextArea value={v('requestDescription')} onChange={(val) => onChange('requestDescription', val)} placeholder="صِف الطلب الإداري بتفصيل كافٍ..." rows={5} /></div>
        <div><FieldLabel>الأثر المتوقع للقرار</FieldLabel>
          <TextArea value={v('estimatedImpact')} onChange={(val) => onChange('estimatedImpact', val)} placeholder="ما الأثر المتوقع لهذا القرار على أصحاب المصلحة؟" rows={3} /></div>
      </div>
    );

    case 'legal_authority': return (
      <div className="space-y-4">
        <div><FieldLabel required>اسم الجهة المختصة بإصدار القرار</FieldLabel>
          <TextInput value={v('issuingAuthorityName')} onChange={(val) => onChange('issuingAuthorityName', val)} placeholder="مثال: وزارة الموارد البشرية والتوطين" /></div>
        <div><FieldLabel required>المسمى الوظيفي للمسؤول المُصدِر</FieldLabel>
          <TextInput value={v('authorityPosition')} onChange={(val) => onChange('authorityPosition', val)} placeholder="مثال: وكيل الوزارة، مدير عام الشؤون الإدارية" /></div>
        <div><FieldLabel required>السند القانوني للاختصاص</FieldLabel>
          <TextInput value={v('authorityLegalBasis')} onChange={(val) => onChange('authorityLegalBasis', val)} placeholder="مثال: المادة (10) من القانون الاتحادي رقم (8) لسنة 2011" /></div>
        <div><FieldLabel required>أنواع الاختصاص المتوافرة</FieldLabel>
          <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/20">
            {[
              { key: 'material', label: 'الاختصاص الموضوعي', desc: 'هل للجهة صلاحية موضوعية على هذا النوع من القرارات؟' },
              { key: 'territorial', label: 'الاختصاص المكاني', desc: 'هل صلاحية الجهة تشمل هذا النطاق الجغرافي؟' },
              { key: 'temporal', label: 'الاختصاص الزمني', desc: 'هل الصلاحية سارية المفعول في هذا التوقيت؟' },
              { key: 'hierarchical', label: 'الاختصاص الدرجي', desc: 'هل هذا المستوى الإداري الصحيح في التسلسل الهرمي؟' },
            ].map((comp) => (
              <label key={comp.key} className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={b(`competence_${comp.key}`)} onChange={(e) => onChange(`competence_${comp.key}`, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-foreground" />
                <div>
                  <span className="text-sm font-semibold text-foreground/90">{comp.label}</span>
                  <p className="text-xs text-muted-foreground">{comp.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={b('delegationExists')} onChange={(e) => onChange('delegationExists', e.target.checked)} className="w-4 h-4 rounded border-border accent-foreground" />
            <span className="text-sm font-semibold text-foreground/80">يوجد تفويض في ممارسة الصلاحية</span>
          </label>
          {b('delegationExists') && (
            <div><FieldLabel>تفاصيل التفويض</FieldLabel>
              <TextArea value={v('delegationDetails')} onChange={(val) => onChange('delegationDetails', val)} placeholder="رقم قرار التفويض وتاريخه ونطاقه..." rows={3} /></div>
          )}
        </div>
      </div>
    );

    case 'facts_evidence': return (
      <div className="space-y-4">
        <div><FieldLabel required>الخلفية الواقعية للقرار</FieldLabel>
          <TextArea value={v('factualBackground')} onChange={(val) => onChange('factualBackground', val)} placeholder="اشرح السياق الواقعي الذي دعا إلى إصدار هذا القرار..." rows={5} /></div>
        <div><FieldLabel required>الوقائع الجوهرية</FieldLabel>
          <TextArea value={v('keyFacts')} onChange={(val) => onChange('keyFacts', val)} placeholder="افصل بين كل واقعة بسطر جديد. كن محدداً وموثقاً..." rows={5} /></div>
        <div><FieldLabel required>أنواع الأدلة المتوافرة</FieldLabel>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
            {[
              'وثائق رسمية', 'تقارير إدارية', 'محاضر رسمية', 'شهادات موثقة',
              'تقارير خبراء', 'صور ومستندات مصورة', 'سجلات إلكترونية',
            ].map((type) => {
              const key = `evidenceType_${type}`;
              return (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-md border border-border/40 bg-background hover:border-foreground/20">
                  <input type="checkbox" checked={b(key)} onChange={(e) => onChange(key, e.target.checked)} className="w-3.5 h-3.5 accent-foreground" />
                  <span className="text-xs font-medium text-foreground/80">{type}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div><FieldLabel required>ملخص الأدلة والإثباتات</FieldLabel>
          <TextArea value={v('evidenceSummary')} onChange={(val) => onChange('evidenceSummary', val)} placeholder="لخّص الأدلة المتوفرة وكيف تدعم الوقائع المُدّعاة..." rows={4} /></div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={b('factsDisputed')} onChange={(e) => onChange('factsDisputed', e.target.checked)} className="w-4 h-4 rounded border-border accent-foreground" />
            <span className="text-sm font-semibold text-foreground/80">الوقائع متنازع عليها أو غير مسلّم بها</span>
          </label>
          {b('factsDisputed') && (
            <TextArea value={v('disputeDetails')} onChange={(val) => onChange('disputeDetails', val)} placeholder="اشرح طبيعة النزاع على الوقائع..." rows={3} />
          )}
        </div>
      </div>
    );

    case 'legal_basis': return (
      <div className="space-y-4">
        <div><FieldLabel required>القانون / المرسوم الأساسي</FieldLabel>
          <TextInput value={v('primaryLaw')} onChange={(val) => onChange('primaryLaw', val)} placeholder="مثال: المرسوم بقانون اتحادي رقم (33) لسنة 2021 في شأن تنظيم علاقات العمل" /></div>
        <div><FieldLabel required>المواد القانونية المحددة</FieldLabel>
          <TextInput value={v('specificArticles')} onChange={(val) => onChange('specificArticles', val)} placeholder="مثال: المادة (42)، الفقرة (أ) من المادة (67)" /></div>
        <div><FieldLabel>اللوائح والقرارات التنفيذية المكملة</FieldLabel>
          <TextArea value={v('regulatoryInstruments')} onChange={(val) => onChange('regulatoryInstruments', val)} placeholder="أضف اللوائح والقرارات الوزارية والتعاميم ذات الصلة..." rows={4} /></div>
        <div><FieldLabel>السوابق القضائية والاجتهادات ذات الصلة</FieldLabel>
          <TextArea value={v('jurisprudenceReferences')} onChange={(val) => onChange('jurisprudenceReferences', val)} placeholder="أحكام المحاكم الإدارية ذات الصلة، إن وجدت..." rows={3} /></div>
        <div><FieldLabel required>تقييم كفاية السند القانوني</FieldLabel>
          <SelectInput value={v('legalBasisSufficiency')} onChange={(val) => onChange('legalBasisSufficiency', val)} options={[
            { value: 'strong', label: 'قوي — السند القانوني وافٍ ومحدد' },
            { value: 'adequate', label: 'كافٍ — السند مقبول مع ملاحظات طفيفة' },
            { value: 'needs_strengthening', label: 'يحتاج تقوية — يستحسن إضافة استناد إضافي' },
            { value: 'insufficient', label: 'غير كافٍ — السند القانوني قاصر' },
          ]} /></div>
      </div>
    );

    case 'administrative_objective': return (
      <div className="space-y-4">
        <div><FieldLabel required>الهدف الأساسي للقرار</FieldLabel>
          <TextArea value={v('primaryObjective')} onChange={(val) => onChange('primaryObjective', val)} placeholder="ما الهدف الذي يسعى هذا القرار إلى تحقيقه؟ كن محدداً وواضحاً..." rows={4} /></div>
        <div><FieldLabel required>أساس المصلحة العامة</FieldLabel>
          <TextArea value={v('publicInterestBasis')} onChange={(val) => onChange('publicInterestBasis', val)} placeholder="كيف يخدم هذا القرار المصلحة العامة؟ ما الضرر الذي يدرأ أو المنفعة التي يجلب؟" rows={4} /></div>
        <div><FieldLabel>وصف الأطراف المتضررة</FieldLabel>
          <TextArea value={v('affectedPartiesDescription')} onChange={(val) => onChange('affectedPartiesDescription', val)} placeholder="من سيتأثر بهذا القرار؟ ما طبيعة الأثر؟" rows={3} /></div>
        <div><FieldLabel>البدائل المدروسة لتحقيق الهدف</FieldLabel>
          <TextArea value={v('alternativeObjectives')} onChange={(val) => onChange('alternativeObjectives', val)} placeholder="هل دُرست وسائل بديلة لتحقيق الهدف ذاته؟ لماذا لم يُختر أيٌّ منها؟" rows={3} /></div>
      </div>
    );

    case 'discretionary_power': return (
      <div className="space-y-4">
        <div><FieldLabel required>طبيعة القرار من حيث السلطة التقديرية</FieldLabel>
          <SelectInput value={v('decisionNature')} onChange={(val) => onChange('decisionNature', val)} options={[
            { value: 'fully_bound', label: 'مقيّد تماماً — لا سلطة تقديرية (الشروط القانونية حاكمة)' },
            { value: 'limited_discretion', label: 'تقديري محدود — هامش ضيق من السلطة التقديرية' },
            { value: 'wide_discretion', label: 'تقديري واسع — هامش واسع من السلطة التقديرية' },
          ]} /></div>
        <div><FieldLabel required>العناصر القانونية الملزمة</FieldLabel>
          <TextArea value={v('bindingLegalElements')} onChange={(val) => onChange('bindingLegalElements', val)} placeholder="ما العناصر التي يُلزم القانون باتباعها دون اجتهاد؟ (الشروط، الإجراءات، الآجال)" rows={4} /></div>
        <div><FieldLabel>نطاق السلطة التقديرية المتاح</FieldLabel>
          <TextArea value={v('discretionarySpace')} onChange={(val) => onChange('discretionarySpace', val)} placeholder="في أي جوانب تملك الجهة هامشاً للتقدير والاختيار؟" rows={3} /></div>
        <div><FieldLabel required>مبرر ممارسة السلطة التقديرية في هذه الحالة</FieldLabel>
          <TextArea value={v('discretionJustification')} onChange={(val) => onChange('discretionJustification', val)} placeholder="لماذا اختيرت هذه الوسيلة تحديداً من بين الخيارات المتاحة؟" rows={4} /></div>
        <div><FieldLabel>عوامل خطر الانحراف بالسلطة</FieldLabel>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
            {[
              'تعارض في المصالح', 'عوامل تمييزية محتملة', 'ضغوط خارجية', 'دوافع غير إدارية', 'استعجال مصطنع',
            ].map((factor) => {
              const key = `abuseRisk_${factor}`;
              return (
                <label key={factor} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-md border border-border/40 bg-background hover:border-red-200">
                  <input type="checkbox" checked={b(key)} onChange={(e) => onChange(key, e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
                  <span className="text-xs text-foreground/80">{factor}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );

    case 'proportionality': return (
      <div className="space-y-4">
        <div><FieldLabel required>وصف التدبير / الإجراء المقترح</FieldLabel>
          <TextArea value={v('measureDescription')} onChange={(val) => onChange('measureDescription', val)} placeholder="صِف بالتفصيل التدبير أو الإجراء المُتخَّذ..." rows={4} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><FieldLabel required>وزن / أهمية الهدف</FieldLabel>
            <SelectInput value={v('objectiveWeight')} onChange={(val) => onChange('objectiveWeight', val)} options={[
              { value: 'minor', label: 'طفيف — هدف بسيط' }, { value: 'moderate', label: 'معتدل — هدف ذو أهمية' },
              { value: 'substantial', label: 'جوهري — هدف مهم' }, { value: 'critical', label: 'بالغ الأهمية — هدف حيوي' },
            ]} /></div>
          <div><FieldLabel required>درجة العبء على الأطراف</FieldLabel>
            <SelectInput value={v('burdenOnParties')} onChange={(val) => onChange('burdenOnParties', val)} options={[
              { value: 'minimal', label: 'ضئيل — عبء طفيف' }, { value: 'moderate', label: 'معتدل — عبء مقبول' },
              { value: 'heavy', label: 'ثقيل — عبء كبير' }, { value: 'excessive', label: 'مفرط — عبء غير مبرر' },
            ]} /></div>
        </div>
        <div><FieldLabel required>الوسائل الأقل تقييداً التي دُرست ورُفضت</FieldLabel>
          <TextArea value={v('lessRestrictiveMeansConsidered')} onChange={(val) => onChange('lessRestrictiveMeansConsidered', val)} placeholder="اذكر البدائل الأقل تأثيراً على حقوق الأفراد التي نُظر فيها، وسبب عدم اعتمادها..." rows={4} /></div>
        <div><FieldLabel required>خلاصة تقييم التناسب</FieldLabel>
          <SelectInput value={v('proportionalityConclusion')} onChange={(val) => onChange('proportionalityConclusion', val)} options={[
            { value: 'proportionate', label: 'متناسب — التدبير متناسب تماماً مع الهدف' },
            { value: 'marginally', label: 'متناسب نسبياً — مع بعض التحفظات' },
            { value: 'disproportionate', label: 'غير متناسب — يستلزم مراجعة التدبير' },
          ]} /></div>
      </div>
    );

    case 'human_oversight': return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border-2 border-foreground/15 bg-foreground/[0.02] space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-foreground/60 uppercase">
            <Shield className="w-3.5 h-3.5" /> المبدأ الدستوري الرابع — الرقابة البشرية
          </div>
          <p className="text-sm text-foreground/80">يجب أن يكون كل قرار موقّعاً من إنسان يدرك مسؤوليته القانونية الكاملة. الذكاء الاصطناعي يسند ولا يحلّ محل.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><FieldLabel required>اسم المسؤول الإداري</FieldLabel>
            <TextInput value={v('officialName')} onChange={(val) => onChange('officialName', val)} placeholder="الاسم الثلاثي الكامل" /></div>
          <div><FieldLabel required>المسمى الوظيفي</FieldLabel>
            <TextInput value={v('officialPosition')} onChange={(val) => onChange('officialPosition', val)} placeholder="مثال: وكيل وزارة العدل" /></div>
        </div>
        <div><FieldLabel required>الجهة / الوزارة</FieldLabel>
          <TextInput value={v('officialOrganization')} onChange={(val) => onChange('officialOrganization', val)} placeholder="اسم الجهة الحكومية" /></div>
        <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-muted/20">
          <p className="text-xs font-bold text-foreground/70 uppercase tracking-wide">إقرارات الرقابة البشرية</p>
          {[
            { key: 'reviewedAllStages', label: 'أؤكد أنني راجعت جميع مراحل إعداد هذا القرار وتحققت من مضمونها' },
            { key: 'aiContributionAcknowledgment', label: 'أُقرّ بأن الذكاء الاصطناعي أسهم في تحليل هذا القرار وأن حكمي البشري يعلو على أي توصية آلية' },
            { key: 'legalConsequencesAware', label: 'أُقرّ بأنني أدرك التبعات القانونية الكاملة لهذا القرار وأتحمل مسؤوليتها' },
            { key: 'finalHumanApproval', label: 'أُوافق على إصدار هذا القرار بصفتي المسؤول الإداري المختص' },
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={b(item.key)} onChange={(e) => onChange(item.key, e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border accent-foreground" />
              <span className="text-sm text-foreground/80 leading-relaxed">{item.label}</span>
            </label>
          ))}
        </div>
        <div><FieldLabel>الحكم البشري المستقل المُضاف (ما أضفته من اجتهاد بشري)</FieldLabel>
          <TextArea value={v('humanJudgmentApplied')} onChange={(val) => onChange('humanJudgmentApplied', val)} placeholder="ما الاعتبارات والحكمة الإنسانية التي أضفتها بما لا تستطيع الخوارزمية تقديره؟" rows={4} /></div>
      </div>
    );

    case 'constitutional_validation': return (
      <div className="space-y-4">
        <div className="p-5 rounded-xl border-2 border-foreground/20 bg-foreground/[0.02] space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-foreground/10 border-2 border-foreground/20 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-foreground/70" />
          </div>
          <h3 className="font-bold text-foreground text-lg">بوابة التحقق الدستوري</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            سيقوم الذكاء الاصطناعي بتحليل جميع المراحل السابقة ومقارنتها مع المبادئ الدستورية العشرة لإطار الشامسي. لا يمكن المتابعة إلا بعد اجتياز هذه البوابة.
          </p>
          <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">المبادئ الدستورية العشرة · MARSAD Constitutional Standard v1.0</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            'الذكاء يخدم القانون', 'المشروعية', 'الشفافية', 'الرقابة البشرية',
            'القابلية للتفسير', 'التناسب', 'ضمانات الإجراءات', 'المساءلة', 'قابلية المراجعة', 'المشروعية المستمرة',
          ].map((p, i) => (
            <div key={p} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted/40 border border-border/40">
              <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[10px] font-medium text-foreground/70 leading-tight">{p}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">اضغط على "تحقق دستوري" أدناه لتشغيل التحقق الشامل</p>
      </div>
    );

    case 'decision_drafting': return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <span>سيقوم الذكاء الاصطناعي بصياغة مسودة القرار الرسمي. اضغط "مساعدة الذكاء الاصطناعي" ثم راجع وعدّل النص حسب اجتهادك القانوني.</span>
        </div>
        <div><FieldLabel required>ديباجة القرار</FieldLabel>
          <TextArea value={v('preamble')} onChange={(val) => onChange('preamble', val)} placeholder="نحن / إنّ [الجهة المُصدِرة] ، [المسمى الوظيفي] ، بناءً على ..." rows={4} /></div>
        <div><FieldLabel required>الإشارات والاستناد</FieldLabel>
          <TextArea value={v('recitals')} onChange={(val) => onChange('recitals', val)} placeholder="استناداً إلى / إشارةً إلى / بناءً على / وبعد الاطلاع على ..." rows={5} /></div>
        <div><FieldLabel required>منطوق القرار / المواد التقريرية</FieldLabel>
          <TextArea value={v('operativeClauses')} onChange={(val) => onChange('operativeClauses', val)} placeholder="المادة الأولى: ...&#10;المادة الثانية: ...&#10;المادة الثالثة: على الجهات المعنية تنفيذ هذا القرار ..." rows={6} /></div>
        <div><FieldLabel>أسباب القرار ومبرراته</FieldLabel>
          <TextArea value={v('reasons')} onChange={(val) => onChange('reasons', val)} placeholder="حيث إن ... وحيث إن ... وبناءً على ما تقدم ..." rows={5} /></div>
        <div><FieldLabel required>بيان حق الطعن والتظلم</FieldLabel>
          <TextArea value={v('appealRights')} onChange={(val) => onChange('appealRights', val)} placeholder="يحق لذوي الشأن التظلم من هذا القرار خلال ... ، ويحق لهم الطعن أمام المحكمة الإدارية المختصة وفقاً لأحكام ..." rows={3} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><FieldLabel>تاريخ النفاذ</FieldLabel>
            <input type="date" value={v('effectiveDate')} onChange={(e) => onChange('effectiveDate', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20" /></div>
          <div><FieldLabel>لغة القرار</FieldLabel>
            <SelectInput value={v('decisionLanguage', 'ar')} onChange={(val) => onChange('decisionLanguage', val)} options={[
              { value: 'ar', label: 'عربي فقط' }, { value: 'ar_en', label: 'عربي وإنجليزي' },
            ]} /></div>
        </div>
      </div>
    );

    case 'final_review': return (
      <div className="space-y-4">
        <div><FieldLabel required>اسم المراجع النهائي</FieldLabel>
          <TextInput value={v('reviewerName')} onChange={(val) => onChange('reviewerName', val)} placeholder="اسم المسؤول الذي يُجري المراجعة النهائية" /></div>
        <div><FieldLabel>ملاحظات المراجعة النهائية</FieldLabel>
          <TextArea value={v('reviewNotes')} onChange={(val) => onChange('reviewNotes', val)} placeholder="أي ملاحظات أو تعديلات أجريت في المراجعة النهائية..." rows={4} /></div>
        <div><FieldLabel required>الرقم الرسمي للقرار</FieldLabel>
          <TextInput value={v('decisionNumber')} onChange={(val) => onChange('decisionNumber', val)} placeholder="مثال: قرار رقم (125) لسنة 2026" /></div>
        <div><FieldLabel>تاريخ النفاذ الرسمي</FieldLabel>
          <input type="date" value={v('officialEffectiveDate')} onChange={(e) => onChange('officialEffectiveDate', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20" /></div>
        <div className="p-4 rounded-lg border border-border/60 bg-muted/20 space-y-3">
          {[
            { key: 'allStagesReviewed', label: 'تأكيد: جميع المراحل الدستورية الأحد عشر مكتملة ومُتحقَّق منها' },
            { key: 'constitutionalValidationPassed', label: 'تأكيد: اجتاز القرار بوابة التحقق الدستوري بنجاح' },
            { key: 'finalApprovalDeclaration', label: 'إعلان: أنا المسؤول المختص أُقرّ باعتماد هذا القرار الإداري ونفاذه' },
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={b(item.key)} onChange={(e) => onChange(item.key, e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border accent-foreground" />
              <span className="text-sm font-semibold text-foreground/80">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
}

// ─── AI Analysis Panel ────────────────────────────────────────────────────────

function AIAnalysisPanel({ analysis, stageKey }: { analysis: Record<string, unknown>; stageKey: StageKey }) {
  const [expanded, setExpanded] = useState(true);
  if (!analysis || Object.keys(analysis).length === 0) return null;

  const passed = stageKey === 'constitutional_validation'
    ? Boolean(analysis.overallPassed)
    : Boolean(analysis.passed);

  const issues = (analysis.issues as string[]) ?? (analysis.criticalFailures as string[]) ?? [];
  const recommendations = (analysis.recommendations as string[]) ?? (analysis.remediationRequired as string[]) ?? [];
  const summary = (analysis.stageSummary as string) ?? (analysis.constitutionalSummary as string) ?? '';
  const contribution = analysis.aiContribution as string;

  return (
    <div className={`rounded-xl border ${passed ? 'border-emerald-200 dark:border-emerald-800/40' : 'border-amber-200 dark:border-amber-800/40'} overflow-hidden`}>
      <button onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${passed ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>تحليل الذكاء الاصطناعي — إطار الشامسي</span>
          {passed ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-background">
          {summary && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
              <p className="text-xs font-bold text-muted-foreground mb-1">الملخص</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Constitutional validation principle results */}
          {stageKey === 'constitutional_validation' && Boolean(analysis.principleResults) && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">نتائج المبادئ الدستورية</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(analysis.principleResults as Record<string, Record<string, unknown>>).map(([key, result]) => {
                  const pr = result as { passed: boolean; score: number; notes: string };
                  return (
                    <div key={key} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${pr.passed ? 'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/30' : 'border-red-200/60 bg-red-50/50 dark:border-red-800/30'}`}>
                      {pr.passed ? <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
                      <div>
                        <span className="font-mono text-muted-foreground/60">{key}</span>
                        {pr.notes && <p className="text-muted-foreground mt-0.5">{String(pr.notes)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {typeof analysis.asliPreScore === 'number' && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
                  <Scale className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">مؤشر ASLI التمهيدي: <span className="font-mono">{analysis.asliPreScore}/100</span></span>
                </div>
              )}
            </div>
          )}

          {issues.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5">المشكلات المُحددة</p>
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5">التوصيات</p>
              <ul className="space-y-1">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {contribution && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">إسهام الذكاء الاصطناعي</p>
              <p className="text-xs text-muted-foreground italic leading-relaxed">{contribution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateDecisionDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ titleAr: '', jurisdiction: 'uae', decisionType: '', organizationUnit: '', issuingAuthority: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const f = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreate = async () => {
    if (!form.titleAr || !form.decisionType || !form.organizationUnit) {
      setError('يرجى ملء جميع الحقول الإلزامية'); return;
    }
    setIsCreating(true); setError('');
    try {
      const data = await apiFetch('POST', '/api/decisions', form);
      onCreated(data.decision.id);
    } catch (e: any) { setError(e.message || 'فشل إنشاء القرار'); setIsCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground">
            <Scale className="w-3.5 h-3.5" /> إطار الشامسي · الوحدة الأولى
          </div>
          <h2 className="text-xl font-bold text-foreground">إنشاء قرار إداري جديد</h2>
          <p className="text-sm text-muted-foreground">سيُسجَّل هذا القرار بمرجع دائم وتبدأ دورة حياته القانونية</p>
        </div>

        <div className="space-y-3">
          <div><FieldLabel required>عنوان القرار الإداري</FieldLabel>
            <TextInput value={form.titleAr} onChange={(v) => f('titleAr', v)} placeholder="مثال: قرار تعيين مدير عام دائرة الموارد البشرية" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel required>الاختصاص القانوني</FieldLabel>
              <SelectInput value={form.jurisdiction} onChange={(v) => f('jurisdiction', v)} options={[
                { value: 'uae', label: 'الإمارات العربية المتحدة' }, { value: 'sa', label: 'المملكة العربية السعودية' },
                { value: 'qa', label: 'دولة قطر' }, { value: 'bh', label: 'مملكة البحرين' },
                { value: 'kw', label: 'دولة الكويت' }, { value: 'om', label: 'سلطنة عُمان' },
                { value: 'fr', label: 'الجمهورية الفرنسية' }, { value: 'eu', label: 'الاتحاد الأوروبي' },
              ]} /></div>
            <div><FieldLabel required>نوع القرار</FieldLabel>
              <SelectInput value={form.decisionType} onChange={(v) => f('decisionType', v)} options={[
                { value: 'appointment', label: 'تعيين' }, { value: 'promotion', label: 'ترقية' },
                { value: 'dismissal', label: 'فصل / إنهاء خدمة' }, { value: 'license', label: 'منح ترخيص' },
                { value: 'revocation', label: 'إلغاء ترخيص' }, { value: 'penalty', label: 'عقوبة تأديبية' },
                { value: 'confiscation', label: 'مصادرة' }, { value: 'suspension', label: 'إيقاف عن العمل' },
                { value: 'other', label: 'أخرى' },
              ]} /></div>
          </div>
          <div><FieldLabel required>الجهة الإدارية المُصدِرة</FieldLabel>
            <TextInput value={form.organizationUnit} onChange={(v) => f('organizationUnit', v)} placeholder="مثال: وزارة الموارد البشرية والتوطين" /></div>
          <div><FieldLabel>المسؤول المُصدِر</FieldLabel>
            <TextInput value={form.issuingAuthority} onChange={(v) => f('issuingAuthority', v)} placeholder="مثال: وكيل الوزارة" /></div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleCreate} disabled={isCreating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
            {isCreating ? 'جارٍ الإنشاء...' : 'إنشاء القرار'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Workspace ───────────────────────────────────────────────────────────

export default function DecisionWorkspace() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const decisionId = params.id ? parseInt(params.id) : null;
  const [activeStage, setActiveStage] = useState<StageKey>('administrative_request');
  const [formData, setFormData] = useState<Record<StageKey, Record<string, unknown>>>({} as any);
  const [aiAnalysis, setAiAnalysis] = useState<Record<StageKey, Record<string, unknown>>>({} as any);
  const [validationResults, setValidationResults] = useState<Record<StageKey, { passed: boolean; analysis: Record<string, unknown>; validationStatus: string }>>({} as any);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(!decisionId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load decision
  const { data, isLoading } = useQuery({
    queryKey: ['decision', decisionId],
    queryFn: () => apiFetch('GET', `/api/decisions/${decisionId}`),
    enabled: Boolean(decisionId),
  });

  const decision: Decision | null = data?.decision ?? null;
  const stages: DecisionStage[] = data?.stages ?? [];

  // Sync loaded stage data
  useEffect(() => {
    if (stages.length > 0) {
      const loaded: Record<string, Record<string, unknown>> = {};
      const loadedAI: Record<string, Record<string, unknown>> = {};
      const loadedValidation: Record<string, any> = {};
      for (const s of stages) {
        loaded[s.stageKey] = s.stageData || {};
        if (s.aiAnalysis && Object.keys(s.aiAnalysis).length > 0) loadedAI[s.stageKey] = s.aiAnalysis;
        if (s.validationStatus !== 'pending') {
          loadedValidation[s.stageKey] = { passed: s.validationStatus === 'passed', analysis: s.validationDetails, validationStatus: s.validationStatus };
        }
      }
      setFormData((prev) => ({ ...prev, ...loaded }));
      setAiAnalysis((prev) => ({ ...prev, ...loadedAI }));
      setValidationResults((prev) => ({ ...prev, ...loadedValidation }));
    }
  }, [stages]);

  // Set active stage from decision
  useEffect(() => {
    if (decision?.currentStage) setActiveStage(decision.currentStage as StageKey);
  }, [decision?.currentStage]);

  const completed: string[] = decision?.stagesCompleted ?? [];
  const stageStatus = (key: StageKey): 'completed' | 'active' | 'failed' | 'locked' => {
    if (completed.includes(key)) return 'completed';
    if (key === activeStage) return 'active';
    const keyIdx = STAGE_ORDER.indexOf(key);
    const currentIdx = STAGE_ORDER.indexOf((decision?.currentStage as StageKey) ?? 'administrative_request');
    if (keyIdx > currentIdx) return 'locked';
    return 'active';
  };

  const handleFormChange = useCallback((field: string, value: unknown) => {
    const stage = activeStage;
    setFormData((prev) => ({ ...prev, [stage]: { ...(prev[stage] || {}), [field]: value } }));
    if (decisionId) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const updated = { ...(formData[stage] || {}), [field]: value };
          await apiFetch('PUT', `/api/decisions/${decisionId}/stages/${stage}`, updated);
        } catch (e) { console.error('Auto-save failed', e); }
        setIsSaving(false);
      }, 1200);
    }
  }, [activeStage, decisionId, formData]);

  const handleRequestAI = async () => {
    if (!decisionId) return;
    setIsLoadingAI(true);
    try {
      const stageFormData = formData[activeStage] || {};
      // Save first
      await apiFetch('PUT', `/api/decisions/${decisionId}/stages/${activeStage}`, stageFormData);
      const result = await apiFetch('POST', `/api/decisions/${decisionId}/stages/${activeStage}/ai-assist`, stageFormData);
      setAiAnalysis((prev) => ({ ...prev, [activeStage]: result.analysis }));
      // If AI generated decision text for drafting stage, populate form
      if (activeStage === 'decision_drafting' && result.analysis) {
        const a = result.analysis;
        if (a.preamble) handleFormChange('preamble', a.preamble);
        if (a.recitals) handleFormChange('recitals', a.recitals);
        if (a.operativeClauses) handleFormChange('operativeClauses', a.operativeClauses);
        if (a.reasons) handleFormChange('reasons', a.reasons);
        if (a.appealRights) handleFormChange('appealRights', a.appealRights);
      }
      qc.invalidateQueries({ queryKey: ['decision', decisionId] });
    } catch (e: any) { alert(e.message || 'فشلت مساعدة الذكاء الاصطناعي'); }
    setIsLoadingAI(false);
  };

  const handleValidate = async () => {
    if (!decisionId) return;
    setIsValidating(true);
    try {
      const stageFormData = formData[activeStage] || {};
      await apiFetch('PUT', `/api/decisions/${decisionId}/stages/${activeStage}`, stageFormData);
      const result = await apiFetch('POST', `/api/decisions/${decisionId}/stages/${activeStage}/validate`, stageFormData);
      setValidationResults((prev) => ({ ...prev, [activeStage]: result }));
      setAiAnalysis((prev) => ({ ...prev, [activeStage]: result.analysis }));
      qc.invalidateQueries({ queryKey: ['decision', decisionId] });
    } catch (e: any) { alert(e.message || 'فشل التحقق'); }
    setIsValidating(false);
  };

  const handleComplete = async () => {
    if (!decisionId) return;
    const vr = validationResults[activeStage];
    if (!vr || !vr.passed) { alert('يجب اجتياز التحقق الدستوري أولاً قبل المتابعة'); return; }
    setIsCompleting(true);
    try {
      const result = await apiFetch('POST', `/api/decisions/${decisionId}/stages/${activeStage}/complete`, {});
      if (result.nextStage) {
        setActiveStage(result.nextStage as StageKey);
      }
      qc.invalidateQueries({ queryKey: ['decision', decisionId] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
    } catch (e: any) { alert(e.message || 'فشل إتمام المرحلة'); }
    setIsCompleting(false);
  };

  const currentValidation = validationResults[activeStage];
  const currentAI = aiAnalysis[activeStage];
  const config = STAGE_CONFIG[activeStage];
  const stageIdx = STAGE_ORDER.indexOf(activeStage);

  return (
    <AppLayout variant="default">
      <div dir="rtl" className="h-full">

        {showCreate && (
          <CreateDecisionDialog onCreated={(id) => { setShowCreate(false); navigate(`/decisions/${id}`); }} />
        )}

        {decisionId && isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {decisionId && !isLoading && decision && (
          <div className="space-y-0 -m-4 sm:-m-6 lg:-m-8">

            {/* ── Decision Header ───────────────────────────────── */}
            <div className="border-b border-border/60 bg-card px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-muted-foreground/60 tracking-widest" dir="ltr">
                    {decision.caseNumber}
                    <span className="text-border/60">·</span>
                    {JURISDICTION_LABELS[decision.jurisdiction] ?? decision.jurisdiction}
                  </div>
                  <h1 className="font-bold text-foreground text-lg leading-snug">{decision.titleAr}</h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" /> {decision.organizationUnit}
                    </span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-xs text-muted-foreground">
                      {completed.length} / {STAGE_ORDER.length} مراحل
                    </span>
                    {isSaving && <span className="text-xs text-muted-foreground/50 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> يحفظ...</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-32 bg-muted/60 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.round((completed.length / STAGE_ORDER.length) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{Math.round((completed.length / STAGE_ORDER.length) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* ── Two-column layout ─────────────────────────────── */}
            <div className="flex" style={{ minHeight: 'calc(100vh - 12rem)' }}>

              {/* Stage Timeline Sidebar */}
              <div className="w-64 shrink-0 border-e border-border/60 bg-muted/10 overflow-y-auto sticky top-0" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                <div className="py-3 px-2 space-y-0.5">
                  {STAGE_ORDER.map((key, idx) => {
                    const st = stageStatus(key);
                    const cfg = STAGE_CONFIG[key];
                    const isActive = key === activeStage;
                    const isLocked = st === 'locked';
                    const isCompleted = st === 'completed';
                    const hasFailed = validationResults[key]?.passed === false;

                    // Constitutional gate visual separator
                    const showGate = idx === 8; // before constitutional_validation

                    return (
                      <React.Fragment key={key}>
                        {showGate && (
                          <div className="mx-2 my-2 flex items-center gap-2">
                            <div className="flex-1 h-px bg-border/60" />
                            <span className="text-[9px] font-bold tracking-widest text-muted-foreground/50 uppercase whitespace-nowrap px-1">البوابة الدستورية</span>
                            <div className="flex-1 h-px bg-border/60" />
                          </div>
                        )}
                        <button
                          onClick={() => !isLocked && setActiveStage(key)}
                          disabled={isLocked}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all duration-150 text-start group ${
                            isActive ? 'bg-foreground/10 border border-foreground/20' :
                            isLocked ? 'opacity-40 cursor-not-allowed' :
                            'hover:bg-foreground/5 cursor-pointer'
                          }`}
                        >
                          {/* Stage number / status icon */}
                          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCompleted ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40' :
                            hasFailed ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40' :
                            isActive ? 'bg-foreground/15 border border-foreground/30 text-foreground' :
                            isLocked ? 'bg-muted border border-border/40 text-muted-foreground/30' :
                            'bg-muted/60 border border-border/40 text-muted-foreground'
                          }`}>
                            {isCompleted ? <Check className="w-3 h-3" /> :
                             hasFailed ? <XCircle className="w-3 h-3" /> :
                             isLocked ? <Lock className="w-3 h-3" /> :
                             String(idx + 1).padStart(2, '0')}
                          </div>

                          {/* Stage name */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate leading-tight ${isActive ? 'text-foreground' : isLocked ? 'text-muted-foreground/30' : 'text-foreground/70'}`}>
                              {cfg.nameAr}
                            </p>
                            {cfg.isGate && (
                              <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">بوابة دستورية</p>
                            )}
                          </div>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Main Stage Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">

                  {/* Stage header */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground/50">{String(stageIdx + 1).padStart(2, '0')} / {STAGE_ORDER.length}</span>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">{config.nameEn}</span>
                      {currentValidation && <ValidationBadge status={currentValidation.validationStatus} />}
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{config.nameAr}</h2>
                    <p className="text-sm text-muted-foreground">{config.principleAr}</p>
                  </div>

                  {/* Stage form */}
                  <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                    <StageForm
                      stageKey={activeStage}
                      data={formData[activeStage] || {}}
                      onChange={handleFormChange}
                    />
                  </div>

                  {/* AI Analysis Panel */}
                  {currentAI && Object.keys(currentAI).length > 0 && (
                    <AIAnalysisPanel analysis={currentAI} stageKey={activeStage} />
                  )}

                  {/* Validation result (if failed) */}
                  {currentValidation && !currentValidation.passed && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/60 dark:bg-red-950/20">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">لم يجتز هذا القرار التحقق الدستوري</p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">راجع ملاحظات الذكاء الاصطناعي أعلاه وعالج المشكلات المُحددة، ثم أعد التحقق.</p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 flex-wrap pb-8">
                    {/* AI Assist */}
                    <button
                      onClick={handleRequestAI} disabled={isLoadingAI || isValidating || isCompleting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-background text-sm font-semibold text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-all disabled:opacity-50"
                    >
                      {isLoadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isLoadingAI ? 'يحلل...' : 'مساعدة الذكاء الاصطناعي'}
                    </button>

                    {/* Validate */}
                    <button
                      onClick={handleValidate} disabled={isLoadingAI || isValidating || isCompleting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-background text-sm font-semibold text-foreground/80 hover:border-amber-400/50 hover:text-amber-700 dark:hover:text-amber-400 transition-all disabled:opacity-50"
                    >
                      {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {isValidating ? 'يتحقق...' : 'تحقق دستوري'}
                    </button>

                    {/* Complete & Advance */}
                    {currentValidation?.passed && (
                      <button
                        onClick={handleComplete} disabled={isLoadingAI || isValidating || isCompleting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 ms-auto"
                      >
                        {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        {isCompleting ? 'جارٍ الإتمام...' : activeStage === 'final_review' ? 'اعتماد القرار' : 'إتمام المرحلة والمتابعة'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
