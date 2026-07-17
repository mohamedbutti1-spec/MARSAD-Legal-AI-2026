/**
 * Admin — Legal OS Scenario Catalog Manager
 *
 * Allows owner-role users to create and edit custom roles and scenarios
 * without touching code. Custom entries are persisted in the DB and merged
 * with the hardcoded catalog at runtime.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Plus, Pencil, Trash2, ChevronRight, Loader2, X,
  GripVertical, UserCircle, Briefcase, Building2, Globe,
  Scale, Gavel, Landmark, BookOpen, Users, Shield, Save,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  Layers, HelpCircle, List, Type, Hash, ToggleLeft, Tag,
  ArrowUp, ArrowDown, Copy,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnswerType = 'chips' | 'yes-no' | 'text' | 'number';

interface QuestionOption {
  value: string;
  labelAr: string;
  labelEn: string;
}

interface QuestionNode {
  id: string;
  questionAr: string;
  questionEn: string;
  hintAr?: string;
  answerType: AnswerType;
  options?: QuestionOption[];
  placeholder?: string;
  unit?: string;
}

interface CustomRole {
  id: number;
  roleKey: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  icon: string;
  sortOrder: number;
}

interface CustomScenario {
  id: number;
  scenarioKey: string;
  roleKey: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  jurisdictions: string[];
  estimatedMinutes: number;
  questions: QuestionNode[];
  sortOrder: number;
  isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
const API = `${BASE_URL}/api`;

const ANSWER_TYPE_OPTIONS: { value: AnswerType; labelAr: string; icon: React.ReactNode }[] = [
  { value: 'chips',  labelAr: 'اختيار متعدد', icon: <Tag className="w-4 h-4" /> },
  { value: 'yes-no', labelAr: 'نعم / لا',    icon: <ToggleLeft className="w-4 h-4" /> },
  { value: 'text',   labelAr: 'نص حر',       icon: <Type className="w-4 h-4" /> },
  { value: 'number', labelAr: 'رقم',         icon: <Hash className="w-4 h-4" /> },
];

const ICON_OPTIONS = [
  'UserCircle', 'Briefcase', 'Building2', 'Globe',
  'Scale', 'Gavel', 'Landmark', 'BookOpen',
  'Users', 'Shield', 'Layers', 'List',
];

const IconComponent: Record<string, React.ReactNode> = {
  UserCircle: <UserCircle className="w-5 h-5" />,
  Briefcase:  <Briefcase  className="w-5 h-5" />,
  Building2:  <Building2  className="w-5 h-5" />,
  Globe:      <Globe      className="w-5 h-5" />,
  Scale:      <Scale      className="w-5 h-5" />,
  Gavel:      <Gavel      className="w-5 h-5" />,
  Landmark:   <Landmark   className="w-5 h-5" />,
  BookOpen:   <BookOpen   className="w-5 h-5" />,
  Users:      <Users      className="w-5 h-5" />,
  Shield:     <Shield     className="w-5 h-5" />,
  Layers:     <Layers     className="w-5 h-5" />,
  List:       <List       className="w-5 h-5" />,
};

const JURISDICTION_OPTIONS = ['UAE', 'France', 'EU', 'GCC', 'International', 'KSA', 'Kuwait', 'Qatar'];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiCall<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as { error?: string }).error || 'Request failed');
  }
  return res.json() as Promise<T>;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Empty factories ──────────────────────────────────────────────────────────

function emptyRole(): Omit<CustomRole, 'id'> {
  return { roleKey: '', titleAr: '', titleEn: '', descriptionAr: '', icon: 'UserCircle', sortOrder: 0 };
}

function emptyScenario(roleKey: string): Omit<CustomScenario, 'id'> {
  return {
    scenarioKey: '', roleKey, titleAr: '', titleEn: '', descriptionAr: '',
    jurisdictions: ['UAE'], estimatedMinutes: 5, questions: [], sortOrder: 0, isActive: true,
  };
}

function emptyQuestion(): QuestionNode {
  return { id: generateId(), questionAr: '', questionEn: '', answerType: 'chips', options: [] };
}

function emptyOption(): QuestionOption {
  return { value: '', labelAr: '', labelEn: '' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({
  label, children, required,
}: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, dir, disabled,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  dir?: 'rtl' | 'ltr'; disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      dir={dir}
      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/50 disabled:opacity-50"
    />
  );
}

function TextArea({
  value, onChange, placeholder, dir, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  dir?: 'rtl' | 'ltr'; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      rows={rows}
      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/50 resize-none"
    />
  );
}

function NumberInput({
  value, onChange, min, max, label,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-20 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/50"
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

// ─── Role Form Modal ──────────────────────────────────────────────────────────

function RoleFormModal({
  initial, onSave, onClose, saving,
}: {
  initial: Omit<CustomRole, 'id'>;
  onSave: (data: Omit<CustomRole, 'id'>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<CustomRole, 'id'>>(initial);
  const set = (k: keyof typeof form) => (v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleTitleEnChange = (v: string) => {
    setForm((p) => ({
      ...p,
      titleEn: v,
      roleKey: p.roleKey || slugify(v),
    }));
  };

  const valid = form.titleAr.trim() && form.titleEn.trim() && form.roleKey.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">
            {initial.roleKey ? 'تعديل دور' : 'إضافة دور جديد'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="العنوان بالعربية" required>
              <TextInput value={form.titleAr} onChange={set('titleAr')} placeholder="محامي / مستشار" dir="rtl" />
            </FieldRow>
            <FieldRow label="العنوان بالإنجليزية" required>
              <TextInput value={form.titleEn} onChange={handleTitleEnChange} placeholder="Lawyer / Counsel" dir="ltr" />
            </FieldRow>
          </div>

          <FieldRow label="المعرّف الفريد (slug)" required>
            <TextInput
              value={form.roleKey}
              onChange={set('roleKey')}
              placeholder="custom-lawyer"
              dir="ltr"
              disabled={!!initial.roleKey}
            />
            <p className="text-[11px] text-muted-foreground mt-1">أحرف صغيرة وأرقام وشُرَط فقط، لا يمكن تغييره لاحقاً</p>
          </FieldRow>

          <FieldRow label="وصف الدور">
            <TextArea value={form.descriptionAr} onChange={set('descriptionAr')} placeholder="وصف موجز لهذا الدور..." dir="rtl" rows={2} />
          </FieldRow>

          <FieldRow label="أيقونة">
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => set('icon')(icon)}
                  className={`p-2 rounded-lg border transition-all ${
                    form.icon === icon
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-border bg-card text-muted-foreground hover:border-border'
                  }`}
                  title={icon}
                >
                  {IconComponent[icon]}
                </button>
              ))}
            </div>
          </FieldRow>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={saving || !valid}
            className="bg-gold text-foreground hover:bg-gold/90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Save className="w-4 h-4 me-2" />}
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Question Builder ─────────────────────────────────────────────────────────

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: QuestionNode;
  index: number;
  total: number;
  onChange: (q: QuestionNode) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const set = (k: keyof QuestionNode) => (v: unknown) => onChange({ ...question, [k]: v });

  const addOption = () => {
    const opts = [...(question.options ?? []), emptyOption()];
    onChange({ ...question, options: opts });
  };

  const updateOption = (i: number, opt: QuestionOption) => {
    const opts = [...(question.options ?? [])];
    opts[i] = opt;
    onChange({ ...question, options: opts });
  };

  const removeOption = (i: number) => {
    const opts = [...(question.options ?? [])];
    opts.splice(i, 1);
    onChange({ ...question, options: opts });
  };

  const handleTypeChange = (t: AnswerType) => {
    const base: QuestionNode = { ...question, answerType: t };
    if (t === 'chips') base.options = base.options ?? [];
    else delete base.options;
    if (t !== 'text' && t !== 'number') { delete base.placeholder; delete base.unit; }
    onChange(base);
  };

  return (
    <div className="border border-border rounded-xl bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold text-muted-foreground bg-card rounded px-1.5 py-0.5 shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm text-foreground truncate font-medium">
          {question.questionAr || question.questionEn || 'سؤال جديد'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-destructive/60 hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Answer type */}
          <FieldRow label="نوع الإجابة" required>
            <div className="flex flex-wrap gap-2">
              {ANSWER_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTypeChange(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    question.answerType === opt.value
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-border bg-card text-muted-foreground hover:border-border'
                  }`}
                >
                  {opt.icon}
                  {opt.labelAr}
                </button>
              ))}
            </div>
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="السؤال بالعربية" required>
              <TextInput value={question.questionAr} onChange={set('questionAr')} placeholder="ما نوع ...؟" dir="rtl" />
            </FieldRow>
            <FieldRow label="السؤال بالإنجليزية">
              <TextInput value={question.questionEn} onChange={set('questionEn')} placeholder="What type of ...?" dir="ltr" />
            </FieldRow>
          </div>

          <FieldRow label="تلميح (اختياري)">
            <TextInput value={question.hintAr ?? ''} onChange={set('hintAr')} placeholder="توضيح إضافي..." dir="rtl" />
          </FieldRow>

          {(question.answerType === 'text' || question.answerType === 'number') && (
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="نص مساعد (placeholder)">
                <TextInput value={question.placeholder ?? ''} onChange={set('placeholder')} placeholder="مثال: 50000" />
              </FieldRow>
              {question.answerType === 'number' && (
                <FieldRow label="الوحدة">
                  <TextInput value={question.unit ?? ''} onChange={set('unit')} placeholder="مثال: AED" dir="ltr" />
                </FieldRow>
              )}
            </div>
          )}

          {question.answerType === 'chips' && (
            <FieldRow label="خيارات الإجابة">
              <div className="space-y-2">
                {(question.options ?? []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <div className="flex-1 grid grid-cols-3 gap-1.5">
                      <TextInput
                        value={opt.value}
                        onChange={(v) => updateOption(oi, { ...opt, value: slugify(v) })}
                        placeholder="قيمة (slug)"
                        dir="ltr"
                      />
                      <TextInput
                        value={opt.labelAr}
                        onChange={(v) => updateOption(oi, { ...opt, labelAr: v })}
                        placeholder="التسمية بالعربية"
                        dir="rtl"
                      />
                      <TextInput
                        value={opt.labelEn}
                        onChange={(v) => updateOption(oi, { ...opt, labelEn: v })}
                        placeholder="Label in English"
                        dir="ltr"
                      />
                    </div>
                    <button
                      onClick={() => removeOption(oi)}
                      className="p-1.5 rounded text-destructive/60 hover:text-destructive shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="flex items-center gap-1.5 text-xs text-gold/70 hover:text-gold font-medium mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة خيار
                </button>
              </div>
            </FieldRow>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scenario Form Modal ──────────────────────────────────────────────────────

function ScenarioFormModal({
  initial,
  roleKey,
  onSave,
  onClose,
  saving,
}: {
  initial: Omit<CustomScenario, 'id'>;
  roleKey: string;
  onSave: (data: Omit<CustomScenario, 'id'>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<CustomScenario, 'id'>>(initial);
  const [activeTab, setActiveTab] = useState<'details' | 'questions'>('details');
  const set = (k: keyof typeof form) => (v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleTitleEnChange = (v: string) => {
    setForm((p) => ({
      ...p,
      titleEn: v,
      scenarioKey: p.scenarioKey || `${roleKey}-${slugify(v)}`,
    }));
  };

  const toggleJurisdiction = (j: string) => {
    setForm((p) => ({
      ...p,
      jurisdictions: p.jurisdictions.includes(j)
        ? p.jurisdictions.filter((x) => x !== j)
        : [...p.jurisdictions, j],
    }));
  };

  const addQuestion = () => {
    setForm((p) => ({ ...p, questions: [...p.questions, emptyQuestion()] }));
  };

  const updateQuestion = (i: number, q: QuestionNode) => {
    setForm((p) => {
      const qs = [...p.questions];
      qs[i] = q;
      return { ...p, questions: qs };
    });
  };

  const deleteQuestion = (i: number) => {
    setForm((p) => {
      const qs = [...p.questions];
      qs.splice(i, 1);
      return { ...p, questions: qs };
    });
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    setForm((p) => {
      const qs = [...p.questions];
      const j = i + dir;
      if (j < 0 || j >= qs.length) return p;
      [qs[i], qs[j]] = [qs[j], qs[i]];
      return { ...p, questions: qs };
    });
  };

  const valid = form.titleAr.trim() && form.titleEn.trim() && form.scenarioKey.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-bold text-foreground">
            {initial.scenarioKey ? 'تعديل سيناريو' : 'إضافة سيناريو جديد'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {(['details', 'questions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-gold border-b-2 border-gold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'details' ? 'التفاصيل الأساسية' : `شجرة الأسئلة (${form.questions.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="العنوان بالعربية" required>
                  <TextInput value={form.titleAr} onChange={set('titleAr')} placeholder="إنهاء عقد إيجار" dir="rtl" />
                </FieldRow>
                <FieldRow label="العنوان بالإنجليزية" required>
                  <TextInput value={form.titleEn} onChange={handleTitleEnChange} placeholder="Terminate a Rental Contract" dir="ltr" />
                </FieldRow>
              </div>

              <FieldRow label="معرّف السيناريو (slug)" required>
                <TextInput
                  value={form.scenarioKey}
                  onChange={set('scenarioKey')}
                  placeholder="custom-role-scenario-name"
                  dir="ltr"
                  disabled={!!initial.scenarioKey}
                />
                <p className="text-[11px] text-muted-foreground mt-1">لا يمكن تغييره بعد الحفظ</p>
              </FieldRow>

              <FieldRow label="وصف السيناريو">
                <TextArea value={form.descriptionAr} onChange={set('descriptionAr')} placeholder="وصف موجز يظهر للمستخدم..." dir="rtl" />
              </FieldRow>

              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="الاختصاصات القانونية">
                  <div className="flex flex-wrap gap-2">
                    {JURISDICTION_OPTIONS.map((j) => (
                      <button
                        key={j}
                        onClick={() => toggleJurisdiction(j)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          form.jurisdictions.includes(j)
                            ? 'border-gold/60 bg-gold/10 text-gold'
                            : 'border-border bg-card text-muted-foreground hover:border-border'
                        }`}
                      >
                        {j}
                      </button>
                    ))}
                  </div>
                </FieldRow>

                <FieldRow label="الوقت التقديري (دقيقة)">
                  <NumberInput
                    value={form.estimatedMinutes}
                    onChange={(v) => set('estimatedMinutes')(Math.max(1, Math.min(120, v)))}
                    min={1}
                    max={120}
                    label="دقيقة"
                  />
                </FieldRow>
              </div>

              <FieldRow label="الحالة">
                <button
                  onClick={() => set('isActive')(!form.isActive)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                    form.isActive
                      ? 'border-heading/40 bg-heading/10 text-heading'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {form.isActive ? 'مفعّل — سيظهر في الفهرس' : 'معطّل — لن يظهر للمستخدمين'}
                </button>
              </FieldRow>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-3">
              {form.questions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">لم تُضَف أسئلة بعد</p>
                  <p className="text-xs mt-1">اضغط "إضافة سؤال" لبناء شجرة الأسئلة</p>
                </div>
              )}
              {form.questions.map((q, i) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  index={i}
                  total={form.questions.length}
                  onChange={(updated) => updateQuestion(i, updated)}
                  onDelete={() => deleteQuestion(i)}
                  onMoveUp={() => moveQuestion(i, -1)}
                  onMoveDown={() => moveQuestion(i, 1)}
                />
              ))}
              <button
                onClick={addQuestion}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
              >
                <Plus className="w-4 h-4" />
                إضافة سؤال
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <div className="text-xs text-muted-foreground">
            {form.questions.length} سؤال
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
            <Button
              onClick={() => onSave(form)}
              disabled={saving || !valid}
              className="bg-gold text-foreground hover:bg-gold/90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Save className="w-4 h-4 me-2" />}
              حفظ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminLegalOS() {
  const { toast } = useToast();

  // State
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [scenarios, setScenarios] = useState<CustomScenario[]>([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [roleModal, setRoleModal] = useState<{
    open: boolean; data: Omit<CustomRole, 'id'>; editId?: number;
  } | null>(null);
  const [scenarioModal, setScenarioModal] = useState<{
    open: boolean; data: Omit<CustomScenario, 'id'>; editId?: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Load data
  const loadRoles = useCallback(async () => {
    const data = await apiCall<{ roles: CustomRole[] }>(`${API}/legal-os-admin/roles`, 'GET');
    setRoles(data.roles);
    return data.roles;
  }, []);

  const loadScenarios = useCallback(async () => {
    const data = await apiCall<{ scenarios: CustomScenario[] }>(`${API}/legal-os-admin/scenarios`, 'GET');
    setScenarios(data.scenarios);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadRoles(), loadScenarios()])
      .catch(() => toast({ title: 'خطأ في تحميل البيانات', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [loadRoles, loadScenarios, toast]);

  // Derived
  const selectedRole = roles.find((r) => r.roleKey === selectedRoleKey);
  const roleScenarios = scenarios.filter((s) => s.roleKey === selectedRoleKey);

  // ── Role actions ────────────────────────────────────────────────────────────

  const openCreateRole = () => setRoleModal({ open: true, data: emptyRole() });

  const openEditRole = (role: CustomRole) =>
    setRoleModal({
      open: true,
      editId: role.id,
      data: {
        roleKey: role.roleKey, titleAr: role.titleAr, titleEn: role.titleEn,
        descriptionAr: role.descriptionAr, icon: role.icon, sortOrder: role.sortOrder,
      },
    });

  const saveRole = async (data: Omit<CustomRole, 'id'>) => {
    if (!roleModal) return;
    setSaving(true);
    try {
      if (roleModal.editId) {
        await apiCall(`${API}/legal-os-admin/roles/${roleModal.editId}`, 'PUT', data);
        toast({ title: 'تم تحديث الدور بنجاح' });
      } else {
        await apiCall(`${API}/legal-os-admin/roles`, 'POST', data);
        toast({ title: 'تم إنشاء الدور بنجاح' });
        setSelectedRoleKey(data.roleKey);
      }
      await loadRoles();
      setRoleModal(null);
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: CustomRole) => {
    if (!confirm(`هل تريد حذف الدور "${role.titleAr}" وجميع سيناريوهاته؟`)) return;
    setDeleting(role.id);
    try {
      await apiCall(`${API}/legal-os-admin/roles/${role.id}`, 'DELETE');
      toast({ title: 'تم حذف الدور' });
      if (selectedRoleKey === role.roleKey) setSelectedRoleKey(null);
      await Promise.all([loadRoles(), loadScenarios()]);
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  // ── Scenario actions ────────────────────────────────────────────────────────

  const openCreateScenario = () => {
    if (!selectedRoleKey) return;
    setScenarioModal({ open: true, data: emptyScenario(selectedRoleKey) });
  };

  const openEditScenario = (s: CustomScenario) =>
    setScenarioModal({
      open: true,
      editId: s.id,
      data: {
        scenarioKey: s.scenarioKey, roleKey: s.roleKey,
        titleAr: s.titleAr, titleEn: s.titleEn, descriptionAr: s.descriptionAr,
        jurisdictions: s.jurisdictions, estimatedMinutes: s.estimatedMinutes,
        questions: s.questions, sortOrder: s.sortOrder, isActive: s.isActive,
      },
    });

  const saveScenario = async (data: Omit<CustomScenario, 'id'>) => {
    if (!scenarioModal) return;
    setSaving(true);
    try {
      if (scenarioModal.editId) {
        await apiCall(`${API}/legal-os-admin/scenarios/${scenarioModal.editId}`, 'PUT', data);
        toast({ title: 'تم تحديث السيناريو بنجاح' });
      } else {
        await apiCall(`${API}/legal-os-admin/scenarios`, 'POST', data);
        toast({ title: 'تم إنشاء السيناريو بنجاح' });
      }
      await loadScenarios();
      setScenarioModal(null);
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteScenario = async (s: CustomScenario) => {
    if (!confirm(`هل تريد حذف السيناريو "${s.titleAr}"؟`)) return;
    setDeleting(s.id);
    try {
      await apiCall(`${API}/legal-os-admin/scenarios/${s.id}`, 'DELETE');
      toast({ title: 'تم حذف السيناريو' });
      await loadScenarios();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      {/* Modals */}
      {roleModal?.open && (
        <RoleFormModal
          initial={roleModal.data}
          onSave={saveRole}
          onClose={() => setRoleModal(null)}
          saving={saving}
        />
      )}
      {scenarioModal?.open && (
        <ScenarioFormModal
          initial={scenarioModal.data}
          roleKey={selectedRoleKey ?? ''}
          onSave={saveScenario}
          onClose={() => setScenarioModal(null)}
          saving={saving}
        />
      )}

      <div className="flex h-full min-h-0">
        {/* ── Left panel: Roles ──────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-e border-border flex flex-col bg-card/50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border">
            <div>
              <h2 className="font-bold text-foreground text-sm">الأدوار المخصصة</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{roles.length} دور مضاف</p>
            </div>
            <Button
              size="sm"
              onClick={openCreateRole}
              className="bg-gold text-foreground hover:bg-gold/90 h-8 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5 me-1" />
              دور جديد
            </Button>
          </div>

          {/* Info banner */}
          <div className="mx-3 mt-3 p-3 rounded-lg bg-heading/10 border border-heading/20 text-[11px] text-heading leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 inline me-1 -mt-0.5" />
            الأدوار المُدمجة (مواطن، محامي...) مخزّنة في الكود — لا تظهر هنا.
          </div>

          {/* Role list */}
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : roles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد أدوار مخصصة</p>
                <p className="text-xs mt-1">اضغط "دور جديد" للبدء</p>
              </div>
            ) : (
              roles.map((role) => {
                const isSelected = selectedRoleKey === role.roleKey;
                const count = scenarios.filter((s) => s.roleKey === role.roleKey).length;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleKey(role.roleKey)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-all ${
                      isSelected ? 'bg-gold/10 border-e-2 border-gold' : 'hover:bg-card/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-gold/20 text-gold' : 'bg-card text-muted-foreground'
                    }`}>
                      {IconComponent[role.icon] ?? <UserCircle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-gold' : 'text-foreground'}`}>
                        {role.titleAr}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{role.titleEn}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] bg-card text-muted-foreground rounded-full px-2 py-0.5">
                        {count}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right panel: Scenarios ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedRole ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-base font-semibold">اختر دوراً من القائمة</p>
                <p className="text-sm mt-1 text-muted-foreground">سيتم عرض السيناريوهات هنا</p>
              </div>
            </div>
          ) : (
            <>
              {/* Scenarios header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                    {IconComponent[selectedRole.icon] ?? <UserCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">{selectedRole.titleAr}</h2>
                    <p className="text-[11px] text-muted-foreground">{selectedRole.titleEn} · {roleScenarios.length} سيناريو</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditRole(selectedRole)}
                    className="h-8 px-3 text-xs border-border text-foreground hover:bg-card"
                  >
                    <Pencil className="w-3.5 h-3.5 me-1" />
                    تعديل الدور
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteRole(selectedRole)}
                    disabled={deleting === selectedRole.id}
                    className="h-8 px-3 text-xs border-destructive/50 text-destructive hover:bg-destructive/20"
                  >
                    {deleting === selectedRole.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5 me-1" />
                    }
                    حذف الدور
                  </Button>
                  <Button
                    size="sm"
                    onClick={openCreateScenario}
                    className="bg-gold text-foreground hover:bg-gold/90 h-8 px-3 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 me-1" />
                    سيناريو جديد
                  </Button>
                </div>
              </div>

              {/* Scenario cards */}
              <div className="flex-1 overflow-y-auto p-6">
                {roleScenarios.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">لا توجد سيناريوهات لهذا الدور</p>
                    <p className="text-xs mt-1">اضغط "سيناريو جديد" لإضافة أول سيناريو</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roleScenarios.map((s) => (
                      <div
                        key={s.id}
                        className="bg-card/50 border border-border rounded-xl p-5 hover:border-border transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-foreground text-sm">{s.titleAr}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.titleEn}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditScenario(s)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteScenario(s)}
                              disabled={deleting === s.id}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/20 transition-all"
                            >
                              {deleting === s.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </div>

                        {s.descriptionAr && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.descriptionAr}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          {s.jurisdictions.map((j) => (
                            <span key={j} className="bg-card text-foreground px-2 py-0.5 rounded-full">
                              {j}
                            </span>
                          ))}
                          <span className="text-muted-foreground flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" />
                            {s.questions.length} سؤال
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{s.estimatedMinutes} دقيقة</span>
                          {!s.isActive && (
                            <span className="bg-destructive/30 text-destructive border border-destructive/40 px-2 py-0.5 rounded-full">
                              معطّل
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
