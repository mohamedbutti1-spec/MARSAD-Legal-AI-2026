import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { ChevronLeft, Paperclip, Send } from 'lucide-react';
import { MarsadEmblem } from '@/components/icons/marsad-emblem';
import { MARSAD_SERVICES } from '@/lib/journey-catalog';
import {
  ANSWER_STYLES, type AnswerStyleId,
  LEGAL_REFERENCES, type LegalRefId,
  LEGAL_BRANCHES, type LegalBranchId,
  ANALYSIS_DEPTHS, type AnalysisDepthId,
} from '@/lib/guided-assistant-config';

// ─── الصفحة الرئيسية بعد تسجيل الدخول — MLOS Legal AI ─────────────────────────
// التصميم المعتمد: ترحيب + مربع سؤال كبير + صف إعدادات التحليل + ثلاث بطاقات
// (القانون / التدريب / المجتمع) فقط. لا خدمات أخرى في هذه الصفحة.
// الإرسال يستخدم آلية pendingAssistantQuery/Config القائمة — الأتمتة بلا تغيير.

const PILLARS = [
  {
    id: 'law',
    icon: '⚖',
    nameAr: 'القانون',
    descAr: 'تحليل القرارات الإدارية والأحكام القضائية، المقارنة التشريعية، وصياغة المذكرات والتقارير والدراسات.',
    href: '/services/law',
    cta: 'دخول إلى خدمات القانون',
  },
  {
    id: 'training',
    icon: '🎓',
    nameAr: 'التدريب',
    descAr: 'بيئات محاكاة مهنية: مركز الشرطة، جلسة المحكمة، مسرح الجريمة، والسيناريوهات القانونية التفاعلية.',
    href: '/services/training',
    cta: 'دخول إلى خدمات التدريب',
  },
  {
    id: 'community',
    icon: '🛡',
    nameAr: 'المجتمع',
    descAr: 'التوعية المجتمعية، المواد التثقيفية، المؤشرات والإحصاءات، والأدلة الإرشادية.',
    href: '/services/community',
    cta: 'دخول إلى خدمات المجتمع',
  },
];

/** Small labelled select used in the analysis-settings row. */
function SettingSelect<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { id: T; labelAr: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-[120px] flex-1 sm:flex-none">
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-lg bg-background border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-gold/60 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.labelAr}</option>
        ))}
      </select>
    </label>
  );
}

export default function JourneyHome() {
  const [, navigate] = useLocation();
  const { lang, setLang, canUseShamsiFramework, canUpload } = useUserContext();

  const [question, setQuestion] = useState('');
  const [answerStyle, setAnswerStyle] = useState<AnswerStyleId>('standard');
  const [legalReference, setLegalReference] = useState<LegalRefId>('uae');
  const [legalBranch, setLegalBranch] = useState<LegalBranchId>('admin');
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepthId>('detailed');

  // نظرية الشامسي لا تُعرض كخيار إلا للمصرح لهم — الصلاحيات كما هي.
  const legalRefOptions = LEGAL_REFERENCES.filter(
    (r) => r.id !== 'shamsi' || canUseShamsiFramework,
  );

  const submitQuestion = () => {
    const q = question.trim();
    if (!q) return;
    sessionStorage.setItem('pendingAssistantQuery', q);
    sessionStorage.setItem(
      'pendingAssistantConfig',
      JSON.stringify({
        userCategory: 'general_user',
        userType: 'unspecified',
        answerStyle,
        legalReference,
        legalBranch,
        trainingMode: false,
        analysisDepth,
      }),
    );
    navigate('/assistant');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10 space-y-10" dir="rtl">

        {/* ── الشعار والترحيب ── */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20">
            <MarsadEmblem className="w-10 h-10 text-gold" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            مرحباً بك في مرصد
          </h1>
          <p className="text-xs font-bold text-gold tracking-widest" dir="ltr">MLOS · LEGAL AI</p>
        </div>

        {/* ── مربع السؤال ── */}
        <div className="moj-card rounded-2xl border border-gold/30 p-4 sm:p-5 shadow-lg space-y-4">
          {/* في اتجاه RTL: الزر أولاً في الـ DOM ليظهر على اليمين كما في التصميم المعتمد */}
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={submitQuestion}
              disabled={!question.trim()}
              aria-label="إرسال"
              className="gold-hover-glow shrink-0 w-11 h-11 rounded-xl bg-gold text-background flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5 -scale-x-100" aria-hidden />
            </button>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitQuestion();
                }
              }}
              rows={3}
              placeholder="اكتب سؤالك القانوني أو ارفع قراراً إدارياً لتحليله..."
              className="flex-1 bg-transparent border-0 resize-none text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none leading-relaxed py-1"
            />
          </div>
        </div>

        {/* ── إعدادات التحليل — صف أفقي واحد تحت مربع السؤال ── */}
        <div className="flex flex-wrap items-end gap-2.5 sm:gap-3 -mt-5">
          <SettingSelect<AnswerStyleId>   label="نوع الإجابة"     value={answerStyle}    options={ANSWER_STYLES}    onChange={setAnswerStyle} />
          <SettingSelect<LegalRefId>      label="النظام القانوني" value={legalReference} options={legalRefOptions}  onChange={setLegalReference} />
          <SettingSelect<LegalBranchId>   label="الفرع القانوني"  value={legalBranch}    options={LEGAL_BRANCHES}   onChange={setLegalBranch} />
          <SettingSelect<AnalysisDepthId> label="مستوى التحليل"   value={analysisDepth}  options={ANALYSIS_DEPTHS}  onChange={setAnalysisDepth} />
          <label className="flex flex-col gap-1 min-w-[90px]">
            <span className="text-[10px] font-bold text-muted-foreground">اللغة</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'ar' | 'en')}
              className="rounded-lg bg-background border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-gold/60 cursor-pointer"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          {canUpload && (
            <Link href="/upload">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-gold/50 hover:text-gold cursor-pointer transition-colors">
                <Paperclip className="w-3.5 h-3.5" aria-hidden />
                إرفاق ملف
              </span>
            </Link>
          )}
        </div>

        {/* ── المحاور الرئيسية الثلاثة ── */}
        <div className="grid sm:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <Link key={p.id} href={p.href}>
              <div className="moj-card h-full rounded-2xl border border-border p-6 flex flex-col items-center text-center gap-3.5 cursor-pointer hover:border-gold/50 hover:shadow-lg transition-all group">
                <span className="text-4xl group-hover:scale-110 transition-transform" aria-hidden>{p.icon}</span>
                <h2 className="text-lg font-bold text-heading">{p.nameAr}</h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{p.descAr}</p>
                <span className="gold-hover-glow inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold text-background text-[13px] font-bold group-hover:opacity-90 transition-all">
                  {p.cta}
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}

// ─── خدمات مرصد — صفحة روابط الوحدات القائمة (بلا تغيير) ──────────────────────

export function MarsadServicesPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-heading">خدمات مرصد</h1>
          <p className="text-sm text-muted-foreground">وحدات المنصة الأساسية — كما هي، بكامل أتمتتها</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {MARSAD_SERVICES.map((s) => (
            <Link key={s.id} href={s.href}>
              <div className="moj-card rounded-xl border border-border p-5 flex items-center gap-4 cursor-pointer hover:border-gold/50 hover:shadow-lg transition-all">
                <span className="text-3xl" aria-hidden>{s.icon}</span>
                <div className="min-w-0">
                  <p className="font-bold text-heading">{s.nameAr}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.descAr}</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground mr-auto shrink-0" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
