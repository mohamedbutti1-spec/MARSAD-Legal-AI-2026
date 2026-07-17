/**
 * نظرية الشامسي — Al-Shamsi Theory
 * Official scientific reference page for the Marsad platform.
 * Premium institutional-grade knowledge portal, Arabic-first, fully RTL.
 */
import React, { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence, type Variants } from 'framer-motion';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Building2, FileQuestion, FileText, ListChecks, Target, Flag,
  ShieldCheck, Scale, Brain, Shield, Eye, BookCheck,
  ChevronDown, AlertTriangle, Zap, Clock, Users, GitMerge,
  BookOpen, Milestone, Star, Sparkles,
  BarChart2, ScrollText, FlaskConical,
} from 'lucide-react';

// ─── Shared animation primitives ─────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' as const } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function Section({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({
  badge,
  titleAr,
  subtitleAr,
  light = false,
}: {
  badge: string;
  titleAr: string;
  subtitleAr?: string;
  light?: boolean;
}) {
  return (
    <div className="mb-10 text-center" dir="rtl">
      <div
        className={`inline-flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full text-sm font-medium border ${
          light
            ? 'bg-white/10 border-white/20 text-white/80'
            : 'bg-gold/10 border-gold/25 text-gold'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${light ? 'bg-white/60' : 'bg-gold'}`} />
        {badge}
      </div>
      <h2
        className={`text-3xl lg:text-4xl font-black mb-3 tracking-tight ${
          light ? 'text-white' : 'text-heading'
        }`}
      >
        {titleAr}
      </h2>
      {subtitleAr && (
        <p
          className={`max-w-2xl mx-auto leading-relaxed text-base ${
            light ? 'text-white/70' : 'text-muted-foreground'
          }`}
        >
          {subtitleAr}
        </p>
      )}
      <div
        className={`mt-5 mx-auto w-20 h-0.5 bg-gradient-to-l from-transparent to-transparent ${
          light ? 'via-white/40' : 'via-gold'
        }`}
      />
    </div>
  );
}

// ─── 12 Dimensions data ───────────────────────────────────────────────────────

const DIMENSIONS = [
  {
    id: 1,
    nameAr: 'الاختصاص',
    icon: Building2,
    hue: 'blue',
    descAr:
      'صلاحية الجهة الإدارية لإصدار القرار في حدود اختصاصها القانوني والتنظيمي المحدد بموجب القانون الاتحادي أو المحلي.',
    criteriaAr:
      'يُقيَّم من خلال: سند التفويض القانوني، والتراتبية الإدارية، وحدود الاختصاص المكاني والموضوعي والزماني.',
  },
  {
    id: 2,
    nameAr: 'السبب',
    icon: FileQuestion,
    hue: 'violet',
    descAr:
      'الوقائع القانونية والمادية الثابتة التي تبرر إصدار القرار الإداري وتمثل ركيزته الموضوعية.',
    criteriaAr:
      'يُقيَّم من خلال: صحة الوقائع، وكفاية الأسباب الموجبة، وانتفاء عيب السبب بصوره المختلفة.',
  },
  {
    id: 3,
    nameAr: 'الشكل',
    icon: FileText,
    hue: 'sky',
    descAr:
      'الشكليات الإجرائية المطلوبة لصحة القرار من تسبيب إلزامي وكتابة رسمية وتوقيع معتمد وختم مؤسسي.',
    criteriaAr:
      'يُقيَّم من خلال: استيفاء نموذج القرار الرسمي، وصحة التوقيعات، والتسبيب الكافي والمفصل.',
  },
  {
    id: 4,
    nameAr: 'الإجراءات',
    icon: ListChecks,
    hue: 'teal',
    descAr:
      'المسار الإجرائي المتبع قبل وأثناء وبعد إصدار القرار بما يشمل الإخطار والتشاور والطعن.',
    criteriaAr:
      'يُقيَّم من خلال: مراحل الإجراء المسبق، ومدى إتاحة حق الدفاع، واستيفاء مواعيد الطعن الإداري.',
  },
  {
    id: 5,
    nameAr: 'المحل',
    icon: Target,
    hue: 'amber',
    descAr:
      'الأثر القانوني المباشر للقرار وانعكاسه على المراكز القانونية الذاتية للأشخاص المعنيين.',
    criteriaAr:
      'يُقيَّم من خلال: ممكنية التنفيذ، وعدم مخالفة النظام العام، وتحديد موضوع القرار بدقة كافية.',
  },
  {
    id: 6,
    nameAr: 'الغاية',
    icon: Flag,
    hue: 'rose',
    descAr:
      'الهدف المشروع الذي يسعى القرار إلى تحقيقه في إطار المصلحة العامة مع انتفاء عيب الانحراف.',
    criteriaAr:
      'يُقيَّم من خلال: التطابق مع المصلحة العامة المُعلنة، وانتفاء الغاية الشخصية أو الانتقامية.',
  },
  {
    id: 7,
    nameAr: 'المشروعية الرقمية',
    icon: ShieldCheck,
    hue: 'emerald',
    descAr:
      'مدى امتثال القرار المُنتج رقمياً أو بمساعدة الذكاء الاصطناعي للمعايير القانونية والأخلاقية الحاكمة.',
    criteriaAr:
      'يُقيَّم من خلال: الامتثال لمبادئ الذكاء الاصطناعي المسؤول، وقابلية التفسير، وانتفاء التحيز الخوارزمي.',
  },
  {
    id: 8,
    nameAr: 'الأثر القانوني',
    icon: Scale,
    hue: 'indigo',
    descAr:
      'تداعيات القرار على الحقوق والالتزامات والمراكز القانونية ومدى التناسب مع حجم التدخل الإداري.',
    criteriaAr:
      'يُقيَّم من خلال: التناسب مع المصلحة العامة، ومبدأ عدم الإضرار غير المبرر، وضمان التعويض العادل.',
  },
  {
    id: 9,
    nameAr: 'الإرادة الإدارية',
    icon: Brain,
    hue: 'purple',
    descAr:
      'قياس عنصر الإرادة البشرية الواعية في صنع القرار مقابل درجة الاعتماد على التوليد الرقمي الآلي.',
    criteriaAr:
      'يُقيَّم من خلال: نسبة مشاركة المسؤول البشري، ومراحل المراجعة الإنسانية، وتوثيق قرارات التجاوز.',
  },
  {
    id: 10,
    nameAr: 'الحماية القانونية',
    icon: Shield,
    hue: 'cyan',
    descAr:
      'مدى توافر ضمانات حماية الحقوق الأساسية للأشخاص المتأثرين بالقرار الإداري في كافة مراحله.',
    criteriaAr:
      'يُقيَّم من خلال: الإخطار المسبق، وحق الاطلاع على الأسباب، وإتاحة سبل التظلم الفعالة.',
  },
  {
    id: 11,
    nameAr: 'الرقابة القضائية',
    icon: Eye,
    hue: 'orange',
    descAr:
      'قابلية القرار للطعن القضائي ومعايير رقابة القضاء الإداري على مشروعيته وملاءمته.',
    criteriaAr:
      'يُقيَّم من خلال: توافر أسباب الإلغاء القضائي، ومدى قابلية مراجعة الخوارزمية، وتوثيق مسار الاستئناف.',
  },
  {
    id: 12,
    nameAr: 'الامتثال التشريعي',
    icon: BookCheck,
    hue: 'lime',
    descAr:
      'مدى توافق القرار مع منظومة التشريعات الوطنية والاتحادية والدولية المعمول بها في وقت إصداره.',
    criteriaAr:
      'يُقيَّم من خلال: المرجعية التشريعية المُستند إليها، وغياب التعارض مع قواعد دستورية أو آمرة.',
  },
];

const HUE_CLASSES: Record<string, { bg: string; icon: string; ring: string; badge: string }> = {
  blue:    { bg: 'bg-heading/10',    icon: 'text-heading',    ring: 'border-heading/25',   badge: 'bg-heading/15 text-heading' },
  violet:  { bg: 'bg-heading/10',  icon: 'text-heading',  ring: 'border-heading/25', badge: 'bg-heading/15 text-heading' },
  sky:     { bg: 'bg-heading/10',     icon: 'text-heading',     ring: 'border-heading/25',    badge: 'bg-heading/15 text-heading' },
  teal:    { bg: 'bg-heading/10',    icon: 'text-heading',    ring: 'border-heading/25',   badge: 'bg-heading/15 text-heading' },
  amber:   { bg: 'bg-gold/10',   icon: 'text-gold',   ring: 'border-gold/25',  badge: 'bg-gold/15 text-gold' },
  rose:    { bg: 'bg-destructive/10',    icon: 'text-destructive',    ring: 'border-destructive/25',   badge: 'bg-destructive/15 text-destructive' },
  emerald: { bg: 'bg-heading/10', icon: 'text-heading', ring: 'border-heading/25',badge: 'bg-heading/15 text-heading' },
  indigo:  { bg: 'bg-heading/10',  icon: 'text-heading',  ring: 'border-heading/25', badge: 'bg-heading/15 text-heading' },
  purple:  { bg: 'bg-heading/10',  icon: 'text-heading',  ring: 'border-heading/25', badge: 'bg-heading/15 text-heading' },
  cyan:    { bg: 'bg-heading/10',    icon: 'text-heading',    ring: 'border-heading/25',   badge: 'bg-heading/15 text-heading' },
  orange:  { bg: 'bg-gold/10',  icon: 'text-gold',  ring: 'border-gold/25', badge: 'bg-gold/15 text-gold' },
  lime:    { bg: 'bg-heading/10',    icon: 'text-heading',    ring: 'border-heading/25',   badge: 'bg-heading/15 text-heading' },
};

// ─── ASLI Gauge (SVG) ─────────────────────────────────────────────────────────

function AsliGauge({ score = 78 }: { score?: number }) {
  const R = 80;
  const cx = 110;
  const cy = 110;
  const startAngle = 210; // degrees, 0=12-o'clock, clockwise
  const sweep = 300;      // total arc span in degrees

  // Convert "clock" angle to SVG x,y (0° = 12-o'clock, clockwise)
  function polar(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  }

  // Build an SVG arc path from one angle to another (clockwise)
  function arcPath(from: number, to: number) {
    const s = polar(from);
    const e = polar(to);
    const largeArc = to - from > 180 ? 1 : 0;
    return `M ${s.x.toFixed(4)} ${s.y.toFixed(4)} A ${R} ${R} 0 ${largeArc} 1 ${e.x.toFixed(4)} ${e.y.toFixed(4)}`;
  }

  // Arc length for strokeDasharray animation — avoids interpolating SVG path flags
  const totalArcLen = (sweep / 360) * 2 * Math.PI * R; // ≈ 418.9
  const scoreArcLen = (score / 100) * totalArcLen;
  const fullArcPath = arcPath(startAngle, startAngle + sweep);

  // Needle rotation: needle line points straight up (negative-y) from centre,
  // then we rotate the <g> by the score angle around the centre pivot.
  const scoreAngleDeg = startAngle + (score / 100) * sweep;

  const bands = [
    { from: startAngle,               to: startAngle + sweep * 0.40, color: '#EF4444' },
    { from: startAngle + sweep * 0.40, to: startAngle + sweep * 0.70, color: '#F59E0B' },
    { from: startAngle + sweep * 0.70, to: startAngle + sweep * 0.85, color: '#84CC16' },
    { from: startAngle + sweep * 0.85, to: startAngle + sweep,        color: '#22C55E' },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="220" height="160" viewBox="0 0 220 160">
        {/* Grey track */}
        <path d={fullArcPath} fill="none" stroke="#E2E8F0" strokeWidth="14" strokeLinecap="round" />

        {/* Colour bands */}
        {bands.map((b, i) => (
          <path
            key={i}
            d={arcPath(b.from, b.to)}
            fill="none"
            stroke={b.color}
            strokeWidth="14"
            strokeLinecap={i === 0 || i === bands.length - 1 ? 'round' : 'butt'}
            opacity={0.9}
          />
        ))}

        {/* Score arc overlay — animated via strokeDashoffset (no d-attribute morphing) */}
        <motion.path
          d={fullArcPath}
          fill="none"
          stroke="#1B2A4A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={totalArcLen}
          initial={{ strokeDashoffset: totalArcLen }}
          animate={{ strokeDashoffset: totalArcLen - scoreArcLen }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />

        {/* Needle — rotated g so no SVG coordinate interpolation */}
        <g transform={`translate(${cx}, ${cy})`}>
          <motion.g
            initial={{ rotate: startAngle }}
            animate={{ rotate: scoreAngleDeg }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          >
            <line x1={0} y1={0} x2={0} y2={-(R - 12)}
              stroke="#1B2A4A" strokeWidth="3" strokeLinecap="round" />
          </motion.g>
        </g>
        <circle cx={cx} cy={cy} r="6" fill="#1B2A4A" />

        {/* Score text */}
        <text x={cx} y={cy + 36} textAnchor="middle" fontSize="28" fontWeight="900" fill="#1B2A4A">
          {score}
        </text>
        <text x={cx} y={cy + 52} textAnchor="middle" fontSize="10" fill="#64748B">
          من 100
        </text>
        {/* Range labels */}
        <text x="22"  y="148" fontSize="9" fill="#EF4444" textAnchor="middle">0</text>
        <text x="198" y="148" fontSize="9" fill="#22C55E" textAnchor="middle">100</text>
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs w-full max-w-xs" dir="rtl">
        {[
          { label: 'خطر شديد', range: '0 – 40', color: 'bg-destructive' },
          { label: 'امتثال جزئي', range: '41 – 70', color: 'bg-gold' },
          { label: 'مشروع مشروط', range: '71 – 85', color: 'bg-heading' },
          { label: 'مشروع تام', range: '86 – 100', color: 'bg-heading' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-heading font-semibold ms-auto">{item.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Workflow Timeline ────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { icon: ScrollText, titleAr: 'استقبال القضية وتحديد النطاق', descAr: 'يُقدَّم الطلب مع تحديد نوع القرار الإداري ونطاقه القانوني والجهة الجغرافية المختصة.' },
  { icon: Users,      titleAr: 'تصنيف الدور الوظيفي والصلاحيات', descAr: 'يُحدَّد دور مقدم الطلب (مدير عام / مسؤول تنفيذي / محامٍ...) لضبط معايير التقييم الملائمة.' },
  { icon: GitMerge,   titleAr: 'التحليل المزدوج الإماراتي-الفرنسي', descAr: 'تُطبَّق مبادئ القانون الإداري الإماراتي جنباً إلى جنب مع مبادئ القانون الإداري الفرنسي الكلاسيكية.' },
  { icon: BarChart2,  titleAr: 'قياس الأبعاد الاثني عشر', descAr: 'يُقيَّم القرار تفصيلياً وفق الأبعاد الاثني عشر لنظرية الشامسي عبر محادثة تفاعلية ذكية.' },
  { icon: FlaskConical, titleAr: 'احتساب مؤشر الشرعية ASLI', descAr: 'تُجمَع درجات الأبعاد وتُرجَّح وفق خوارزمية الشامسي لإنتاج مؤشر الشرعية الإدارية الرقمية.' },
  { icon: BookOpen,   titleAr: 'صياغة الموجز القانوني القضائي', descAr: 'يُولَّد تلقائياً موجز قانوني ثنائي اللغة يتضمن الحكم والأسانيد والتوصيات والسوابق القضائية.' },
  { icon: ShieldCheck, titleAr: 'التوثيق في سجل المراجعة التدقيقية', descAr: 'يُسجَّل القرار وبصمته الرقمية SHA-256 في سجل مراجعة غير قابل للتعديل لضمان النزاهة المؤسسية.' },
];

// ─── Future Vision Timeline ───────────────────────────────────────────────────

const VISION_MILESTONES = [
  { year: '2025', titleAr: 'الإطار التشريعي الوطني', descAr: 'إصدار أول إطار تشريعي وطني يضبط صحة القرارات الإدارية الرقمية وشروط المسؤولية.' },
  { year: '2027', titleAr: 'اعتماد معادلة الشامسي قضائياً', descAr: 'توظيف مؤشر الشرعية ASLI مرجعاً معتمداً في أحكام المحاكم الإدارية الاتحادية.' },
  { year: '2030', titleAr: 'تكامل رؤية الإمارات الذكية', descAr: 'اندماج النظرية مع منظومة الحكومة الذكية ومبادرات رؤية الإمارات 2031 للتحول الرقمي.' },
  { year: '2035', titleAr: 'معيار خليجي وعربي موحد', descAr: 'تبنّي دول مجلس التعاون منهجية الشامسي معياراً مرجعياً للتشريع الإداري الرقمي المشترك.' },
  { year: '2040', titleAr: 'الإطار الدولي للذكاء الاصطناعي الإداري', descAr: 'مساهمة نظرية الشامسي في صياغة المعايير الأممية لأخلاقيات الذكاء الاصطناعي في الإدارة العامة.' },
];

// ─── Main page component ──────────────────────────────────────────────────────

export default function ShamsiTheory() {
  const [openDimension, setOpenDimension] = useState<number | null>(null);

  return (
    <AppLayout>
      <div dir="rtl" className="min-h-screen bg-background overflow-x-hidden">

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1 — HERO
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-card text-foreground">
          {/* Geometric background pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none"
               style={{ backgroundImage: 'repeating-linear-gradient(45deg, #C9A84C 0, #C9A84C 1px, transparent 0, transparent 50%)', backgroundSize: '30px 30px' }} />
          {/* Gold gradient overlay top */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />

          <div className="relative max-w-5xl mx-auto px-6 py-20 lg:py-28">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="text-center"
            >
              {/* Platform badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center gap-2 mb-6 px-5 py-2 rounded-full bg-gold/15 border border-gold/30 text-gold text-sm font-semibold"
              >
                <Star className="w-3.5 h-3.5" />
                المرجع العلمي الرسمي · منصة مرصد
                <Star className="w-3.5 h-3.5" />
              </motion.div>

              {/* Main title */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-5xl lg:text-7xl font-black tracking-tight mb-4 leading-tight"
                style={{ fontFamily: "'Amiri', 'IBM Plex Sans Arabic', serif" }}
              >
                نظرية{' '}
                <span className="text-gold">الشامسي</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="text-base text-gold/80 font-medium tracking-widest mb-8 uppercase"
              >
                Al-Shamsi Theory of Administrative Decision Legitimacy
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className="max-w-3xl mx-auto text-white/75 text-lg leading-loose"
              >
                إطار قانوني أكاديمي متكامل لتقييم مشروعية القرارات الإدارية في عصر الذكاء الاصطناعي،
                يجمع بين مبادئ القانون الإداري الإماراتي والفرنسي عبر اثني عشر بعداً تحليلياً
                مترابطاً تُقيسها خوارزمية مؤشر الشرعية الإدارية الرقمية{' '}
                <span className="text-gold font-semibold">(ASLI)</span>.
              </motion.div>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto"
              >
                {[
                  { value: '١٢', label: 'بُعداً تحليلياً' },
                  { value: '٢', label: 'منظومة قانونية' },
                  { value: 'ASLI', label: 'مؤشر الشرعية' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-3xl font-black text-gold">{stat.value}</div>
                    <div className="text-xs text-white/50 mt-1">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom wave */}
          <div className="absolute bottom-0 inset-x-0 h-12 bg-background"
               style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 — WHY TRADITIONAL MODEL FAILS
        ══════════════════════════════════════════════════════════════ */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <Section>
            <SectionHeader
              badge="القسم الأول"
              titleAr="لماذا لم يعد النموذج التقليدي كافياً؟"
              subtitleAr="في عصر الذكاء الاصطناعي، باتت القرارات الإدارية تُصدَر بسرعة وبأثر واسع دون أن يواكبها إطار قانوني يقيس مشروعيتها الرقمية."
            />
          </Section>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {[
              {
                icon: Zap,
                titleAr: 'سرعة إصدار القرار الرقمي',
                descAr: 'تُنتج الأنظمة الرقمية قرارات إدارية في أجزاء من الثانية، مما يجعل آليات الرقابة التقليدية عاجزة عن مواكبة الوتيرة أو تقييم المشروعية في الوقت الفعلي.',
                color: 'border-gold/40 bg-gold/10',
                iconColor: 'text-gold bg-gold/15',
              },
              {
                icon: AlertTriangle,
                titleAr: 'غياب معيار قياس الإرادة',
                descAr: 'لا يوجد في التشريع التقليدي معيار قانوني واضح يحدد متى تكون الإرادة في القرار الإداري بشرية كافية مقارنةً بما تنتجه الخوارزميات.',
                color: 'border-destructive/30 bg-destructive/10',
                iconColor: 'text-destructive bg-destructive/15',
              },
              {
                icon: Eye,
                titleAr: 'ضعف قابلية المراجعة القضائية',
                descAr: 'المحاكم الإدارية التقليدية لا تملك أدوات تقنية لفحص القرارات المُنتجة رقمياً والتحقق من سلامة النموذج الخوارزمي الذي أنتجها.',
                color: 'border-heading/30 bg-heading/10',
                iconColor: 'text-heading bg-heading/15',
              },
              {
                icon: Clock,
                titleAr: 'تأخر التشريع عن التقنية',
                descAr: 'دورة إصدار التشريعات تقاس بالسنوات، في حين تتطور قدرات الذكاء الاصطناعي بمعدلات أسية، مما يخلق فجوة تنظيمية تتسع باستمرار.',
                color: 'border-heading/30 bg-heading/10',
                iconColor: 'text-heading bg-heading/15',
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.titleAr}
                  variants={fadeUp}
                  className={`rounded-2xl border-2 p-6 ${card.color} flex gap-4`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-heading text-base mb-1.5">{card.titleAr}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{card.descAr}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3 — HUMAN WILL vs DIGITAL WILL
        ══════════════════════════════════════════════════════════════ */}
        <section className="bg-card py-20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none"
               style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #C9A84C 0, transparent 60%), radial-gradient(circle at 70% 50%, #C9A84C 0, transparent 60%)' }} />

          <div className="max-w-6xl mx-auto px-6 relative">
            <Section>
              <SectionHeader
                badge="القسم الثاني"
                titleAr="الإرادة البشرية مقابل الإرادة الرقمية"
                subtitleAr="أحد المحاور المركزية في نظرية الشامسي: تحديد الحد الفاصل بين القرار الذي تصنعه إرادة بشرية واعية والقرار الذي تنتجه خوارزمية رقمية."
                light
              />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* Human Will */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="bg-white/8 border border-white/15 rounded-2xl p-7 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-lg">الإرادة البشرية</h3>
                    <p className="text-white/40 text-xs">Human Will Formation</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    'تصدر عن تفكير واعٍ يستحضر السياق الكامل للقضية',
                    'تحمل عنصر المسؤولية الأخلاقية والقانونية الشخصية',
                    'قابلة للنقاش والإقناع والمراجعة في ضوء حجج جديدة',
                    'تتضمن بُعداً تقديرياً يستوعب استثناءات العدالة',
                    'يمكن استجواب صاحبها قضائياً عن دوافعها وأسبابها',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Divider */}
              <div className="hidden lg:flex flex-col items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 mt-10">
                <div className="h-32 w-px bg-gradient-to-b from-transparent via-gold to-transparent" />
                <div className="w-10 h-10 rounded-full bg-card border-2 border-gold/40 flex items-center justify-center text-gold text-xs font-bold my-2">
                  VS
                </div>
                <div className="h-32 w-px bg-gradient-to-b from-transparent via-gold to-transparent" />
              </div>

              {/* Digital Will */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="bg-white/8 border border-white/15 rounded-2xl p-7 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-heading/20 border border-heading/30 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-heading" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-lg">الإرادة الرقمية</h3>
                    <p className="text-white/40 text-xs">Digital Will Formation</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    'تصدر عن نموذج إحصائي مدرَّب على بيانات تاريخية',
                    'تفتقر إلى المسؤولية الذاتية وقد تحمل تحيزات مضمنة',
                    'تُنتج الخروج ذاته لأي مدخل متماثل دون مرونة',
                    'لا تعي السياق الاجتماعي أو الاستثناءات الإنسانية',
                    'صعبة المساءلة القضائية بسبب غموض الصندوق الأسود',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-heading flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Bridge note */}
            <Section className="mt-8">
              <div className="bg-gold/10 border border-gold/25 rounded-xl px-6 py-4 text-center text-gold text-sm leading-relaxed">
                <span className="font-bold">مبدأ الشامسي في المزاوجة: </span>
                تشترط النظرية أن لا يقل مؤشر الإرادة البشرية عن 40% في أي قرار إداري رقمي يمس حقوقاً أساسية،
                وأن يتمتع المسؤول البشري بصلاحية التجاوز الفعلي لأي مخرجات خوارزمية.
              </div>
            </Section>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 4 — THE 16 DIMENSIONS (12 foundational + 4 CJI)
        ══════════════════════════════════════════════════════════════ */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <Section>
            <SectionHeader
              badge="القسم الثالث"
              titleAr="أبعاد نظرية الشامسي — الإطار الستة عشر"
              subtitleAr="تُرسي النظرية اثني عشر بُعداً للمشروعية الإدارية. يُضيف محرك الذكاء القضائي الدستوري (CJI) أربعةً أبعاداً رقمية تكميلية، ليبلغ إجمالي الأبعاد القابلة للقياس في منصة مرصد ستةَ عشر بُعداً."
            />
            <div className="mb-8 flex items-start gap-3 bg-gold/10 border border-gold/25 rounded-xl px-5 py-3.5 text-sm text-heading" dir="rtl">
              <span className="shrink-0 mt-0.5">ℹ️</span>
              <div>
                <strong>ملاحظة إصدار:</strong> الأبعاد 1–12 هي الأبعاد التأسيسية لنظرية الشامسي. أضاف محرك الذكاء القضائي الدستوري (CJI — الإصدار 5) أربعةً أبعاداً رقمية تكميلية: <em>التحيز الخوارزمي، والإجراءات القانونية الواجبة، والمساواة، والحقوق الأساسية</em> — وذلك لاستيعاب المتطلبات الخاصة بالقرارات المدعومة بالذكاء الاصطناعي وفق الإطار القانوني الإماراتي لعام 2026.
              </div>
            </div>
          </Section>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {DIMENSIONS.map((dim) => {
              const Icon = dim.icon;
              const hue = HUE_CLASSES[dim.hue];
              const isOpen = openDimension === dim.id;
              return (
                <motion.div
                  key={dim.id}
                  variants={fadeUp}
                  className={`rounded-2xl border bg-card shadow-sm overflow-hidden cursor-pointer transition-shadow duration-200 hover:shadow-md ${hue.ring}`}
                  onClick={() => setOpenDimension(isOpen ? null : dim.id)}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hue.bg}`}>
                        <Icon className={`w-5 h-5 ${hue.icon}`} />
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${hue.badge}`}>
                        بُعد {dim.id}
                      </span>
                    </div>
                    <h3 className="font-black text-heading text-lg mb-1">{dim.nameAr}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
                      {dim.descAr}
                    </p>
                    <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${hue.icon}`}>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      />
                      {isOpen ? 'إخفاء التفاصيل' : 'عرض معايير التقييم'}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className={`px-5 pb-5 pt-2 border-t ${hue.ring} ${hue.bg}`}>
                          <p className="text-xs text-heading font-semibold mb-1.5">معايير التقييم:</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{dim.criteriaAr}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>

          <Section className="mt-4">
            <div className="bg-card/5 border border-border/10 rounded-xl px-6 py-4 text-center text-sm text-muted-foreground">
              💡 انقر على أي بُعد لعرض معايير تقييمه التفصيلية. تُوزَّع الدرجة الكلية مئة نقطة وفق أوزان مرجَّحة تراعي طبيعة القرار. تُقيَّم الأبعاد 1–12 وفق منهجية الشامسي، وتُقيَّم الأبعاد 13–16 وفق محرك الذكاء القضائي الدستوري (CJI).
            </div>
          </Section>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 5 — EMIRATI LAW & FRENCH ADMINISTRATIVE LAW
        ══════════════════════════════════════════════════════════════ */}
        <section className="bg-card py-20 border-y border-border/40">
          <div className="max-w-6xl mx-auto px-6">
            <Section>
              <SectionHeader
                badge="القسم الرابع"
                titleAr="العلاقة بين القانون الإماراتي والقانون الإداري الفرنسي"
                subtitleAr="نظرية الشامسي لا تنشأ في فراغ؛ بل تستمد روافدها من منظومتين قانونيتين راسختين تتلاقيان في بناء معيار المشروعية الإدارية."
              />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              {[
                {
                  flag: '🇦🇪',
                  titleAr: 'القانون الإداري الإماراتي',
                  subtitleAr: 'Federal Administrative Law',
                  color: 'border-heading/30 bg-heading/10',
                  headerColor: 'bg-heading',
                  items: [
                    { ref: 'المرسوم بقانون اتحادي رقم 19 لسنة 2022', descAr: 'قانون المعاملات الإدارية ومعايير جودة الخدمات الحكومية' },
                    { ref: 'القانون الاتحادي رقم 15 لسنة 2023', descAr: 'تنظيم الذكاء الاصطناعي في القطاع العام' },
                    { ref: 'مرسوم رقم 56 لسنة 2020', descAr: 'إستراتيجية الإمارات للذكاء الاصطناعي 2031' },
                    { ref: 'نظام الشكاوى والتظلمات الحكومية', descAr: 'ضمانات الطعن الإداري وآليات الانتصاف' },
                  ],
                },
                {
                  flag: '🇫🇷',
                  titleAr: 'القانون الإداري الفرنسي',
                  subtitleAr: 'Droit Administratif Français',
                  color: 'border-heading/30 bg-heading/10',
                  headerColor: 'bg-heading',
                  items: [
                    { ref: 'حكم Blanco 1873', descAr: 'أساس استقلالية القانون الإداري وقضاء مجلس الدولة' },
                    { ref: 'نظرية الانحراف بالسلطة (Détournement)', descAr: 'حظر استخدام السلطة لأغراض مغايرة للمصلحة العامة' },
                    { ref: 'Code des relations avec le public 2015', descAr: 'مبدأ الشفافية ووجوب تسبيب القرارات الإدارية' },
                    { ref: 'Loi pour une République numérique 2016', descAr: 'حقوق المواطنين في مواجهة القرارات الخوارزمية' },
                  ],
                },
              ].map((col) => (
                <motion.div
                  key={col.titleAr}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className={`rounded-2xl border-2 overflow-hidden ${col.color}`}
                >
                  <div className={`${col.headerColor} text-white px-6 py-4 flex items-center gap-3`}>
                    <span className="text-2xl">{col.flag}</span>
                    <div>
                      <h3 className="font-black text-base">{col.titleAr}</h3>
                      <p className="text-white/60 text-xs">{col.subtitleAr}</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    {col.items.map((item) => (
                      <div key={item.ref} className="bg-white/70 rounded-xl p-3.5 border border-white/60">
                        <p className="font-bold text-heading text-sm mb-1">{item.ref}</p>
                        <p className="text-muted-foreground text-xs">{item.descAr}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Shared principles */}
            <Section>
              <div className="rounded-2xl bg-gradient-to-l from-heading/10 via-white to-heading/10 border border-border/40 p-6">
                <h3 className="font-black text-heading text-center text-base mb-5">
                  المبادئ المشتركة التي تستمدها نظرية الشامسي من المنظومتين
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    'مبدأ المشروعية',
                    'وجوب التسبيب',
                    'التناسب',
                    'حق الدفاع',
                    'عدم الانحراف',
                    'الرقابة القضائية',
                    'الشفافية الخوارزمية',
                    'حماية الحقوق',
                  ].map((p) => (
                    <div key={p}
                      className="flex items-center justify-center text-center text-xs font-semibold text-heading py-2.5 px-3 rounded-lg bg-card border border-gold/30 shadow-sm">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 6 — PRACTICAL EVALUATION WORKFLOW
        ══════════════════════════════════════════════════════════════ */}
        <section className="max-w-4xl mx-auto px-6 py-20">
          <Section>
            <SectionHeader
              badge="القسم الخامس"
              titleAr="مسار التقييم العملي"
              subtitleAr="سبع مراحل متسلسلة تضمن تقييماً شاملاً ومنهجياً لكل قرار إداري وفق أحكام نظرية الشامسي."
            />
          </Section>

          <div className="relative">
            {/* Vertical spine */}
            <div className="absolute right-7 top-4 bottom-4 w-0.5 bg-gradient-to-b from-gold via-gold/40 to-transparent hidden sm:block" />

            <div className="space-y-5">
              {WORKFLOW_STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.titleAr}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.5, delay: idx * 0.07 }}
                    className="flex gap-5 items-start relative"
                  >
                    {/* Step circle */}
                    <div className="relative z-10 flex-shrink-0 w-14 h-14 rounded-2xl bg-card border-2 border-gold/40 flex flex-col items-center justify-center shadow-sm">
                      <Icon className="w-5 h-5 text-gold" />
                      <span className="text-[9px] text-white/40 mt-0.5">{idx + 1}</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 bg-card rounded-2xl border border-border/50 shadow-sm p-4 pt-3.5">
                      <h3 className="font-bold text-heading text-base mb-1">{step.titleAr}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{step.descAr}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 7 — ASLI INDEX
        ══════════════════════════════════════════════════════════════ */}
        <section className="bg-card py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/3 to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative">
            <Section>
              <SectionHeader
                badge="القسم السادس"
                titleAr="مؤشر الشرعية الإدارية الرقمية"
                subtitleAr="Al-Shamsi Legitimacy Index — ASLI"
                light
              />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Gauge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="bg-card rounded-3xl p-8 flex flex-col items-center shadow-xl"
              >
                <p className="text-heading font-black text-base mb-1">نموذج توضيحي</p>
                <p className="text-muted-foreground text-xs mb-6">درجة تمثيلية لقرار بدرجة عالية من الامتثال</p>
                <AsliGauge score={78} />
                <div className="mt-6 text-center">
                  <span className="inline-flex items-center gap-2 bg-heading/15 text-heading font-bold text-sm px-4 py-2 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-heading" />
                    مشروع مشروط — يُصدَر بقيود تحسينية
                  </span>
                </div>
              </motion.div>

              {/* Explanation */}
              <div className="space-y-5">
                {[
                  {
                    titleAr: 'كيف يُحسَب المؤشر؟',
                    descAr: 'تُعطى كل قضية درجةً من صفر إلى مئة لكل بُعد من الأبعاد الاثني عشر. ثم تُجمع هذه الدرجات مرجَّحةً بمعاملات تعكس أهمية كل بُعد في سياق نوع القرار والولاية القضائية.',
                    icon: BarChart2,
                  },
                  {
                    titleAr: 'ما الذي يُقدمه ASLI؟',
                    descAr: 'مؤشر موحد قابل للمقارنة عبر القضايا والجهات والأنواع، يُمكّن القضاء الإداري من اعتماد معيار موضوعي لتصنيف مشروعية القرارات بدل الاجتهاد الفردي المتذبذب.',
                    icon: Scale,
                  },
                  {
                    titleAr: 'الأثر القانوني للنتيجة',
                    descAr: 'الدرجة أقل من 40: تُوصَى باتخاذ القرار موقوفاً وإعادة تقييمه. 41–70: إصدار مشروط بضمانات إضافية. 71–85: مشروع مع توصيات تحسينية. 86–100: مشروع تام بلا قيود.',
                    icon: BookCheck,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.titleAr}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="flex gap-4 bg-white/8 border border-white/12 rounded-2xl p-5"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4.5 h-4.5 text-gold" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm mb-1.5">{item.titleAr}</h4>
                        <p className="text-white/60 text-xs leading-relaxed">{item.descAr}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 8 — FUTURE LEGISLATIVE VISION
        ══════════════════════════════════════════════════════════════ */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <Section>
            <SectionHeader
              badge="القسم السابع"
              titleAr="الرؤية التشريعية المستقبلية"
              subtitleAr="نظرية الشامسي ليست نتاج تحليل الحاضر فحسب، بل خارطة طريق لبناء منظومة تشريعية عربية متقدمة تواكب مستقبل الذكاء الاصطناعي في الإدارة العامة."
            />
          </Section>

          {/* Horizontal timeline */}
          <div className="relative">
            {/* Spine */}
            <div className="hidden md:block absolute top-9 left-0 right-0 h-0.5 bg-gradient-to-l from-transparent via-gold/50 to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {VISION_MILESTONES.map((m, idx) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="flex flex-col items-center text-center"
                >
                  {/* Year bubble */}
                  <div className="relative z-10 w-[4.5rem] h-[4.5rem] rounded-full bg-card border-4 border-gold/40 flex flex-col items-center justify-center shadow-md mb-4">
                    <Milestone className="w-3.5 h-3.5 text-gold mb-0.5" />
                    <span className="text-gold font-black text-sm">{m.year}</span>
                  </div>
                  <h4 className="font-black text-heading text-sm mb-2 leading-snug">{m.titleAr}</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">{m.descAr}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Closing statement */}
          <Section className="mt-16">
            <div className="relative rounded-3xl bg-gradient-to-l from-secondary to-card p-8 text-center text-white overflow-hidden">
              <div className="absolute inset-0 opacity-5"
                   style={{ backgroundImage: 'repeating-linear-gradient(45deg, #C9A84C 0, #C9A84C 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />
              <div className="relative">
                <Sparkles className="w-8 h-8 text-gold mx-auto mb-4" />
                <h3 className="text-2xl font-black mb-3" style={{ fontFamily: "'Amiri', serif" }}>
                  نحو إدارة عامة عادلة وشفافة ومساءلة
                </h3>
                <p className="text-white/70 max-w-2xl mx-auto leading-loose text-sm">
                  نظرية الشامسي هي مساهمة قانونية عربية أصيلة في الحوار العالمي حول حوكمة الذكاء الاصطناعي.
                  إنها دعوة إلى بناء دولة قانون رقمية تحترم الإرادة الإنسانية وتُحاسب الخوارزمية وتصون كرامة المواطن
                  في كل قرار إداري يمسّ حياته.
                </p>
              </div>
            </div>
          </Section>
        </section>

      </div>
    </AppLayout>
  );
}
