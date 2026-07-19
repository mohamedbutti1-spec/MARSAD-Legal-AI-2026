import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { ChevronLeft, Lock, Send } from 'lucide-react';

// ─── تحليل القرار الإداري — المنتج الرئيسي للمنصة ─────────────────────────────
// نموذج إدخال القرار + اختيار إطار التحليل:
//   ◉ التحليل القانوني القياسي  → محرك المساعد الذكي الحالي (فرع إداري)
//   ⭐ M-Shamsi Framework       → المعيار المتقدم الحالي (applyAdvancedStandard)
// عناصر إطار الشامسي تظهر فقط عند اختياره — ولا تظهر في الصفحة الرئيسية إطلاقاً.
// الأتمتة نفسها بلا تغيير: نستخدم آلية pendingAssistantQuery/Config القائمة.

type FrameworkId = 'standard' | 'shamsi';

const SHAMSI_ELEMENTS = [
  { id: 'will-genesis',   icon: '🧬', nameAr: 'سجل نشأة الإرادة',        descAr: 'تتبع تكوين الإرادة الرقمية للقرار من المدخل إلى المخرج.' },
  { id: 'algo-weight',    icon: '🏋️', nameAr: 'الوزن الخوارزمي',          descAr: 'قياس حجم مساهمة الذكاء الاصطناعي في اتخاذ القرار.' },
  { id: 'asadi2',         icon: '🧠', nameAr: 'ASADI-2',                  descAr: 'مؤشر الشامسي للقرار الإداري الذكي — الجيل الثاني.' },
  { id: 'trust-engine',   icon: '🛡️', nameAr: 'محرك الثقة والمشروعية',    descAr: 'تقييم مشروعية القرار ودرجة الثقة وفق الأركان السبعة.' },
  { id: 'algo-reasons',   icon: '🗄️', nameAr: 'سجل الأسباب الخوارزمية',   descAr: 'توثيق الأسباب الخوارزمية المفسَّرة القابلة للمراجعة القضائية.' },
];

export default function DecisionAnalysis() {
  const [, navigate] = useLocation();
  const { canUseShamsiFramework, canCreateDecision } = useUserContext();
  const [decisionText, setDecisionText] = useState('');
  const [framework, setFramework] = useState<FrameworkId>('standard');

  const startAnalysis = () => {
    const text = decisionText.trim();
    if (!text) return;
    // نفس مسار "home composer" المعتمد في المساعد الذكي — بلا أي API جديد.
    sessionStorage.setItem(
      'pendingAssistantQuery',
      `حلّل القرار الإداري التالي تحليلاً قانونياً كاملاً:\n\n${text}`,
    );
    sessionStorage.setItem(
      'pendingAssistantConfig',
      JSON.stringify({
        userCategory: 'consultant',
        userType: 'legal_consultant',
        answerStyle: 'detailed',
        legalReference: framework === 'shamsi' ? 'shamsi' : 'uae',
        legalBranch: 'admin',
        trainingMode: false,
      }),
    );
    navigate('/assistant');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" dir="rtl">
        <div className="text-center space-y-2">
          <span className="text-4xl block" aria-hidden>🖋️</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            تحليل القرار الإداري
          </h1>
          <p className="text-sm text-muted-foreground">
            المنتج الرئيسي للمنصة — أدخل القرار واختر إطار التحليل
          </p>
        </div>

        {/* ── نموذج إدخال القرار ── */}
        <div className="moj-card rounded-2xl border border-border p-5 sm:p-6 space-y-3">
          <label htmlFor="decision-text" className="text-sm font-bold text-heading block">
            نص القرار الإداري
          </label>
          <textarea
            id="decision-text"
            value={decisionText}
            onChange={(e) => setDecisionText(e.target.value)}
            rows={7}
            placeholder="الصق نص القرار الإداري هنا، أو لخّص وقائعه: الجهة المصدرة، مضمون القرار، تاريخه، والأسباب المذكورة فيه…"
            className="w-full rounded-xl bg-background border border-border p-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/60 resize-y leading-relaxed"
          />
        </div>

        {/* ── إطار التحليل ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-heading">إطار التحليل</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* التحليل القانوني القياسي */}
            <button
              type="button"
              onClick={() => setFramework('standard')}
              className={`moj-card rounded-2xl border p-5 text-start transition-all ${
                framework === 'standard' ? 'border-gold shadow-lg' : 'border-border hover:border-gold/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                    framework === 'standard' ? 'border-gold bg-gold' : 'border-muted-foreground/40'
                  }`}
                  aria-hidden
                />
                <span className="font-bold text-heading">التحليل القانوني القياسي</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                تحليل أركان القرار الإداري ومشروعيته وفق القواعد العامة للقانون الإداري.
              </p>
            </button>

            {/* M-Shamsi Framework */}
            <button
              type="button"
              onClick={() => canUseShamsiFramework && setFramework('shamsi')}
              disabled={!canUseShamsiFramework}
              className={`moj-card rounded-2xl border p-5 text-start transition-all relative ${
                framework === 'shamsi'
                  ? 'border-gold shadow-lg'
                  : canUseShamsiFramework
                    ? 'border-border hover:border-gold/40'
                    : 'border-border opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                    framework === 'shamsi' ? 'border-gold bg-gold' : 'border-muted-foreground/40'
                  }`}
                  aria-hidden
                />
                <span className="font-bold text-heading">⭐ M-Shamsi Framework</span>
                {!canUseShamsiFramework && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full mr-auto">
                    <Lock className="w-3 h-3" aria-hidden /> للمصرح لهم
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                المعيار المتقدم — تقييم القرار الذكي وفق نظرية الشامسي وأركانها الدستورية.
              </p>
            </button>
          </div>
        </div>

        {/* ── عناصر M-Shamsi — تظهر فقط عند اختياره ── */}
        {framework === 'shamsi' && canUseShamsiFramework && (
          <div className="moj-card rounded-2xl border border-gold/40 p-5 sm:p-6 space-y-4">
            <p className="text-xs font-bold text-gold">مكوّنات إطار M-Shamsi المفعّلة لهذا التحليل</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SHAMSI_ELEMENTS.map((el) => (
                <div key={el.id} className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>{el.icon}</span>
                    <span className="text-[13px] font-bold text-heading leading-tight">{el.nameAr}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{el.descAr}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/admin-os">
                <span className="text-xs text-gold font-bold cursor-pointer hover:underline inline-flex items-center gap-1">
                  فتح نظام القرارات الإدارية الكامل <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                </span>
              </Link>
              <Link href="/shamsi-theory">
                <span className="text-xs text-muted-foreground font-semibold cursor-pointer hover:underline inline-flex items-center gap-1">
                  الاطلاع على النظرية <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* ── بدء التحليل ── */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={startAnalysis}
            disabled={!decisionText.trim()}
            className="gold-hover-glow inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gold text-background text-sm font-bold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" aria-hidden />
            بدء التحليل
          </button>
          {canCreateDecision && (
            <Link href="/decisions/new">
              <span className="text-xs text-muted-foreground hover:text-gold cursor-pointer transition-colors">
                أو افتح دورة القرار الإداري الكاملة (الوحدة الأولى) ←
              </span>
            </Link>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
