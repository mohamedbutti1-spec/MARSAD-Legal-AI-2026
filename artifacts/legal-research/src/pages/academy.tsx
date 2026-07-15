import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { ChevronDown, GraduationCap, Play } from 'lucide-react';
import { stageAssistantPrompt } from '@/lib/marsad-personas';

// ─── أكاديمية مرصد للمحاكاة المهنية ────────────────────────────────────────────
// Interactive step-by-step professional simulation tracks. Each track lists
// its methodological phases (per the V2 workflow spec) and launches an
// interactive simulation in the AI assistant through the existing
// pendingAssistantQuery hand-off — the assistant plays the scenario master,
// asking the trainee for a decision at every step.

interface AcademyPhase {
  ar: string;
  points: string[];
}

interface AcademyTrack {
  id: string;
  ar: string;
  emoji: string;
  descAr: string;
  phases: AcademyPhase[];
  /** Kick-off prompt for the interactive simulation in the assistant. */
  simulationPrompt: string;
}

const ACADEMY_TRACKS: AcademyTrack[] = [
  {
    id: 'crime_scene',
    ar: 'أنت في مسرح جريمة',
    emoji: '📍',
    descAr: 'محاكاة كاملة لإدارة مسرح الجريمة من لحظة البلاغ حتى تسليم المحضر',
    phases: [
      { ar: 'ماذا تفعل قبل الوصول؟', points: ['تلقي البلاغ وتوجيهه فوراً', 'تحديد نوع البلاغ وموقعه وفتح محضر استدلال', 'إبلاغ غرفة العمليات والجهات المختصة', 'إحضار الأدوات والمعدات اللازمة'] },
      { ar: 'ماذا تفعل أثناء الوصول؟', points: ['تأمين الموقع ومنع الاقتراب', 'الاطلاع على أي معلومات أولية متاحة', 'التأكد من وسائل السلامة العامة'] },
      { ar: 'ماذا تفعل أثناء المعاينة؟', points: ['توثيق المسرح تصويراً ورسماً كروكياً', 'رفع الأدلة وفق سلسلة العهدة', 'سماع أقوال الشهود الحاضرين', 'حصر أفراد الفريق والأدوار'] },
      { ar: 'ماذا تفعل بعد الانتهاء؟', points: ['إقفال المسرح وتسليم الأدلة', 'تحرير محضر المعاينة النهائي', 'مراجعة كل خطوة قبل الاعتماد'] },
    ],
    simulationPrompt:
      '[أكاديمية مرصد للمحاكاة المهنية — مسار: أنت في مسرح جريمة]\n' +
      'أدر معي محاكاة تدريبية تفاعلية كاملة لمسرح جريمة. أنت مدير السيناريو: ابدأ بوصف بلاغ واقعي (اختر نوع الجريمة)، ثم اسألني في كل مرحلة (قبل الوصول، أثناء الوصول، أثناء المعاينة، بعد الانتهاء) عن الإجراء الذي سأتخذه، وقيّم إجابتي وفق الأصول القانونية والإجرائية، وصحح أخطائي، ثم انتقل للمرحلة التالية. في الختام أعطني تقييماً شاملاً بنقاط القوة والضعف.',
  },
  {
    id: 'complainant',
    ar: 'أنت أمام مشتكي في مركز الشرطة',
    emoji: '🗣️',
    descAr: 'محاكاة استقبال المشتكي وتحرير البلاغ واتخاذ قرار الانتقال',
    phases: [
      { ar: 'ماذا تسأل؟', points: ['بيانات المشتكي وصفته', 'وقائع الشكوى: الزمان والمكان والأشخاص', 'الأدلة والشهود المتاحون'] },
      { ar: 'ماذا تحرر؟', points: ['محضر سماع أقوال', 'بلاغ رسمي مصنف حسب نوع الواقعة', 'إثبات المرفقات والمضبوطات'] },
      { ar: 'كيف تصيغ البلاغ؟', points: ['صياغة الوقائع بدقة وحياد', 'الوصف القانوني الأولي للواقعة', 'تحديد الجهة المختصة بالنظر'] },
      { ar: 'متى تنتقل إلى الموقع؟', points: ['حالات التلبس والآثار القابلة للزوال', 'حالات الخطر على الأشخاص أو الأموال', 'قرار الانتقال وتوثيقه'] },
    ],
    simulationPrompt:
      '[أكاديمية مرصد للمحاكاة المهنية — مسار: أنت أمام مشتكي في مركز الشرطة]\n' +
      'أدر معي محاكاة تفاعلية: أنت تمثل شخصية مشتكٍ حضر إلى مركز الشرطة بواقعة واقعية (اخترها أنت). سأقوم أنا بدور الضابط: أسألك وأتخذ الإجراءات. قيّم أسئلتي وما أقرر تحريره وصياغتي للبلاغ وقراري بالانتقال للموقع من عدمه، وصحح لي وفق القانون في كل خطوة، ثم أعطني تقييماً ختامياً.',
  },
  {
    id: 'trial_prep',
    ar: 'أنت تستعد لجلسة محاكمة',
    emoji: '⚖️',
    descAr: 'محاكاة الإعداد لجلسة محاكمة وإدارة الحضور والمرافعة',
    phases: [
      { ar: 'ماذا تراجع؟', points: ['ملف الدعوى كاملاً: الوقائع والمستندات', 'الدفوع والطلبات السابقة', 'النصوص القانونية والسوابق ذات الصلة'] },
      { ar: 'ماذا تقول؟', points: ['خطة المرافعة ونقاطها الجوهرية', 'الرد على دفوع الخصم المتوقعة'] },
      { ar: 'ماذا لا تقول؟', points: ['ما يضر بمركز موكلك أو موقفك', 'الإقرارات غير المحسوبة', 'ما يخالف واجبات المهنة واللياقة'] },
      { ar: 'ماذا تدون؟', points: ['ما يصدر عن المحكمة من قرارات', 'أقوال الشهود والخصوم الجوهرية', 'المواعيد والتكليفات'] },
      { ar: 'ماذا تمتنع عنه؟', points: ['مقاطعة المحكمة أو الخصوم', 'إبداء طلبات غير مدروسة', 'الانفعال والخروج عن الموضوع'] },
    ],
    simulationPrompt:
      '[أكاديمية مرصد للمحاكاة المهنية — مسار: أنت تستعد لجلسة محاكمة]\n' +
      'أدر معي محاكاة تفاعلية للاستعداد لجلسة محاكمة ثم إدارتها. اختر قضية واقعية وحدد دوري (محامٍ أو عضو نيابة)، ثم اختبرني مرحلياً: ماذا أراجع، ماذا أقول، ماذا لا أقول، ماذا أدوّن، وماذا أمتنع عنه. مثّل شخصية القاضي والخصم في الجلسة، وقيّم أدائي وصحح أخطائي، ثم أعطني تقييماً ختامياً شاملاً.',
  },
  {
    id: 'memo_writing',
    ar: 'أنت تستعد لكتابة مذكرة',
    emoji: '📝',
    descAr: 'محاكاة بناء مذكرة قانونية من الوقائع إلى الطلبات',
    phases: [
      { ar: 'كيف تبدأ؟', points: ['تحديد نوع المذكرة والمحكمة والخصوم', 'الديباجة والبيانات الشكلية'] },
      { ar: 'كيف ترتب الوقائع؟', points: ['التسلسل الزمني الدقيق', 'ربط كل واقعة بمستندها', 'استبعاد ما لا ينتج أثراً'] },
      { ar: 'كيف ترتب الدفوع؟', points: ['الدفوع الشكلية أولاً', 'الدفوع الموضوعية بترتيب قوتها', 'الاحتياطي من الدفوع'] },
      { ar: 'كيف تبني الطلبات؟', points: ['الطلبات الأصلية بدقة', 'الطلبات الاحتياطية', 'التوافق بين الأسباب والطلبات'] },
    ],
    simulationPrompt:
      '[أكاديمية مرصد للمحاكاة المهنية — مسار: أنت تستعد لكتابة مذكرة]\n' +
      'أدر معي محاكاة تفاعلية لكتابة مذكرة قانونية. اعرض عليّ قضية واقعية بمستنداتها، ثم خذني خطوة بخطوة: كيف أبدأ، كيف أرتب الوقائع، كيف أرتب الدفوع، كيف أبني الطلبات — في كل خطوة اطلب مني الصياغة وقيّمها وحسّنها معي، وفي الختام ساعدني على إخراج المذكرة كاملة وقيّم عملي.',
  },
  {
    id: 'investigation_session',
    ar: 'أنت داخل جلسة تحقيق',
    emoji: '🔍',
    descAr: 'محاكاة إدارة جلسة تحقيق والانتقال بين الأسئلة والمواجهة والقرار',
    phases: [
      { ar: 'كيف تبدأ؟', points: ['إثبات البيانات والضمانات القانونية', 'تلاوة التهمة وحق الاستعانة بمحام', 'الأسئلة التمهيدية المفتوحة'] },
      { ar: 'كيف تنتقل بين الأسئلة؟', points: ['من العام إلى الخاص', 'تثبيت الأقوال قبل المواجهة', 'ملاحظة التناقضات وتوثيقها'] },
      { ar: 'متى تواجه بالأدلة؟', points: ['بعد استنفاد الرواية الحرة', 'مواجهة متدرجة بحسب قوة الدليل', 'إثبات ردود المتهم حرفياً'] },
      { ar: 'متى تقرر الإحالة أو الحفظ؟', points: ['كفاية الأدلة ومدى جديتها', 'أسباب الحفظ المقررة قانوناً', 'تسبيب القرار في الحالتين'] },
    ],
    simulationPrompt:
      '[أكاديمية مرصد للمحاكاة المهنية — مسار: أنت داخل جلسة تحقيق]\n' +
      'أدر معي محاكاة تفاعلية لجلسة تحقيق: أنت تمثل شخصية المتهم في قضية واقعية (اخترها أنت) وأنا المحقق. أجب على أسئلتي كمتهم واقعي، وبالتوازي قيّم — كمدرب — طريقة بدئي للجلسة وتسلسل أسئلتي وتوقيت مواجهتي بالأدلة، وفي النهاية اطلب مني قرار التصرف (إحالة أو حفظ) وقيّم تسبيبي له.',
  },
];

export default function Academy() {
  const [, navigate] = useLocation();
  const [openTrack, setOpenTrack] = useState<string | null>(null);

  const startSimulation = (track: AcademyTrack) => {
    stageAssistantPrompt(track.simulationPrompt);
    navigate('/assistant');
  };

  return (
    <AppLayout>
      <div dir="rtl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/10 border border-gold/25 mb-3">
            <GraduationCap className="w-7 h-7 text-gold" aria-hidden />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading mb-2" style={{ fontFamily: 'var(--app-font-serif)' }}>
            أكاديمية مرصد للمحاكاة المهنية
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            تدريب تفاعلي خطوة بخطوة على المواقف المهنية الحقيقية — المساعد الذكي يدير
            السيناريو ويقيّم قراراتك في كل مرحلة ويمنحك تقييماً ختامياً شاملاً.
          </p>
        </div>

        {/* Tracks */}
        <div className="space-y-3">
          {ACADEMY_TRACKS.map((track) => {
            const isOpen = openTrack === track.id;
            return (
              <div key={track.id} className={`moj-card rounded-xl overflow-hidden transition-all ${isOpen ? 'border-gold/40' : ''}`}>
                <button
                  type="button"
                  onClick={() => setOpenTrack(isOpen ? null : track.id)}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-start"
                >
                  <span className="text-xl shrink-0" aria-hidden>{track.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-heading">{track.ar}</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{track.descAr}</p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 border-t border-border/50 pt-4">
                    <ol className="space-y-3 mb-5">
                      {track.phases.map((phase, i) => (
                        <li key={phase.ar} className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-gold/15 border border-gold/30 text-gold text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-heading mb-1">{phase.ar}</p>
                            <ul className="space-y-0.5">
                              {phase.points.map((pt) => (
                                <li key={pt} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-gold/60 mt-0.5 shrink-0" aria-hidden>✓</span>
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      onClick={() => startSimulation(track)}
                      className="gold-hover-glow inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-background text-sm font-bold hover:opacity-90 transition-all"
                    >
                      <Play className="w-4 h-4" aria-hidden />
                      ابدأ المحاكاة التفاعلية
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
