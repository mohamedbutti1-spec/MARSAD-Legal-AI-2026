import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { Lightbulb, Send, ShieldAlert, ExternalLink } from 'lucide-react';
import { useUserContext } from '@/lib/user-context';
import { stageAssistantPrompt } from '@/lib/marsad-personas';

// ─── محرك السيناريوهات ─────────────────────────────────────────────────────────
// A standalone scenario engine per the V2 workflow spec: the user describes a
// situation, picks an engine (ماذا لو؟ / غرفة الأزمات / محاكاة واقعية /
// إدارة المخاطر / تقييم القرارات / توقع النتائج القانونية), and the request is
// launched into the AI assistant through the existing pendingAssistantQuery
// hand-off. Quantitative national risk modeling stays in /risk-engine.

interface ScenarioEngine {
  id: string;
  ar: string;
  emoji: string;
  descAr: string;
  /** Instruction block prepended to the user's situation text. */
  instructions: string;
}

const SCENARIO_ENGINES: ScenarioEngine[] = [
  {
    id: 'what_if',
    ar: 'ماذا لو؟',
    emoji: '🔀',
    descAr: 'تحليل افتراضي متفرع: ماذا يتغير قانونياً لو تغير عنصر من الوقائع أو القرار',
    instructions:
      '[محرك السيناريوهات — ماذا لو؟]\n' +
      'حلل الموقف التالي بمنهج «ماذا لو»: حدد المتغيرات الجوهرية، ثم اعرض لكل متغير سيناريو بديلاً وأثره القانوني والعملي، في جدول مقارن، مع بيان السيناريو الأرجح والأخطر.\n',
  },
  {
    id: 'crisis_room',
    ar: 'غرفة الأزمات',
    emoji: '🚨',
    descAr: 'إدارة موقف عاجل: أولويات التحرك والقرارات الفورية والجهات الواجب إشراكها',
    instructions:
      '[محرك السيناريوهات — غرفة الأزمات]\n' +
      'تعامل مع الموقف التالي كخلية أزمة: رتب الإجراءات الفورية بحسب الأولوية الزمنية (أول ساعة، أول يوم، أول أسبوع)، وحدد الجهات الواجب إشراكها والقرارات القانونية العاجلة والمحاذير التي تفاقم الأزمة.\n',
  },
  {
    id: 'realistic_simulation',
    ar: 'محاكاة واقعية',
    emoji: '🎭',
    descAr: 'تمثيل تفاعلي كامل للموقف بأدواره المختلفة مع تقييم قراراتك',
    instructions:
      '[محرك السيناريوهات — محاكاة واقعية]\n' +
      'أدر معي محاكاة تفاعلية للموقف التالي: مثّل الأطراف المقابلة بواقعية، واسألني عن قراري في كل منعطف، وقيّم كل قرار فور اتخاذه، ثم أعطني تقييماً ختامياً.\n',
  },
  {
    id: 'risk_management',
    ar: 'إدارة المخاطر',
    emoji: '⚠️',
    descAr: 'تحديد المخاطر القانونية والإدارية وتقييم احتمالها وأثرها وخطط التخفيف',
    instructions:
      '[محرك السيناريوهات — إدارة المخاطر]\n' +
      'حلل مخاطر الموقف التالي: اذكر كل خطر (قانوني، إداري، مالي، سمعة) مع تقدير الاحتمال والأثر (مرتفع/متوسط/منخفض) في مصفوفة مخاطر، وخطة تخفيف عملية لكل خطر، والمخاطر المتبقية بعد التخفيف.\n',
  },
  {
    id: 'decision_evaluation',
    ar: 'تقييم القرارات',
    emoji: '🧮',
    descAr: 'تقييم قرار متخذ أو مقترح: المشروعية والملاءمة والبدائل الأفضل',
    instructions:
      '[محرك السيناريوهات — تقييم القرارات]\n' +
      'قيّم القرار التالي: افحص مشروعيته (السبب، المحل، الشكل، الاختصاص، الغاية)، وملاءمته العملية، ونقاط الطعن المحتملة، والبدائل الأفضل مع الترجيح المسبب.\n',
  },
  {
    id: 'outcome_prediction',
    ar: 'توقع النتائج القانونية',
    emoji: '🔮',
    descAr: 'استشراف المآلات القانونية المحتملة للموقف ونسب ترجيحها',
    instructions:
      '[محرك السيناريوهات — توقع النتائج القانونية]\n' +
      'استشرف النتائج القانونية المحتملة للموقف التالي: اعرض المآلات الممكنة (قضائياً وإدارياً) مع نسبة ترجيح تقديرية لكل مآل وأساسه القانوني والعوامل التي ترفع أو تخفض احتماله، ثم التوصية العملية.\n',
  },
];

export default function Scenarios() {
  const [, navigate] = useLocation();
  const { canViewRiskDashboard } = useUserContext();
  const [selected, setSelected] = useState<ScenarioEngine>(SCENARIO_ENGINES[0]);
  const [situation, setSituation] = useState('');

  const launch = () => {
    const text = situation.trim();
    if (!text) return;
    stageAssistantPrompt(selected.instructions + '\nالموقف:\n' + text);
    navigate('/assistant');
  };

  return (
    <AppLayout>
      <div dir="rtl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/10 border border-gold/25 mb-3">
            <Lightbulb className="w-7 h-7 text-gold" aria-hidden />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading mb-2" style={{ fontFamily: 'var(--app-font-serif)' }}>
            محرك السيناريوهات
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            صف موقفك واختر المحرك المناسب — من التحليل الافتراضي إلى غرفة الأزمات
            وتوقع النتائج القانونية.
          </p>
        </div>

        {/* Engine cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {SCENARIO_ENGINES.map((engine) => {
            const isSelected = selected.id === engine.id;
            return (
              <button
                key={engine.id}
                type="button"
                onClick={() => setSelected(engine)}
                className={`moj-card rounded-xl p-4 text-start transition-all ${
                  isSelected ? 'border-gold/60 ring-1 ring-gold/40' : 'hover:border-gold/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg" aria-hidden>{engine.emoji}</span>
                  <span className={`text-[13px] font-bold ${isSelected ? 'text-gold' : 'text-heading'}`}>
                    {engine.ar}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{engine.descAr}</p>
              </button>
            );
          })}
        </div>

        {/* Situation input */}
        <div className="mb-4">
          <label htmlFor="scenario-situation" className="text-[12px] font-bold text-heading block mb-2">
            {selected.emoji} صف الموقف أو القرار المراد تحليله عبر «{selected.ar}»
          </label>
          <div className="relative bg-card border-2 border-gold/25 rounded-2xl focus-within:border-gold/50 transition-colors">
            <textarea
              id="scenario-situation"
              rows={5}
              dir="rtl"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="اكتب وقائع الموقف أو القرار هنا بأكبر قدر من التفصيل..."
              className="w-full resize-none rounded-2xl bg-transparent px-4 py-4 pe-14 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none leading-relaxed"
            />
            <button
              type="button"
              onClick={launch}
              disabled={!situation.trim()}
              aria-label="تشغيل السيناريو"
              className="absolute bottom-3 start-3 h-9 w-9 rounded-xl bg-gold text-background flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Link to the quantitative national risk engine for authorized roles */}
        {canViewRiskDashboard && (
          <button
            type="button"
            onClick={() => navigate('/risk-engine')}
            className="moj-card rounded-xl p-4 w-full text-start hover:border-gold/40 transition-all group flex items-center gap-3"
          >
            <ShieldAlert className="w-5 h-5 text-gold shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-heading group-hover:text-gold transition-colors">
                محرك النمذجة الوطنية للمخاطر
              </p>
              <p className="text-[10px] text-muted-foreground">
                النمذجة الكمية للمخاطر على مستوى القرارات والمؤشرات الوطنية
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground/50 group-hover:text-gold transition-colors shrink-0" aria-hidden />
          </button>
        )}
      </div>
    </AppLayout>
  );
}
