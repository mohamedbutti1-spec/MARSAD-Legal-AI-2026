/**
 * /pricing — Subscription & Pricing page
 *
 * Shows four plan tiers (Free / Professional / Expert / Enterprise)
 * plus three à la carte one-time services.
 *
 * No real payment is wired — CTA buttons are "ready to connect" stubs
 * that show a "coming soon" message until Apple Pay / Google Pay /
 * web checkout keys are configured.
 */
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Check, X, Sparkles, Phone, Mail, ChevronDown, ChevronUp,
  Zap, FileText, Search, Lock, Star, Users, Infinity,
  ArrowLeft,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { useToast } from '@/hooks/use-toast';
import {
  PLANS, A_LA_CARTE,
  type PlanId,
  type Plan,
} from '@/lib/plan-config';

// ── Helpers ───────────────────────────────────────────────────────────────────
const t = (ar: string, en: string, isAr: boolean) => (isAr ? ar : en);

function fmt(n: number | null, isAr: boolean): string {
  if (n === null) return isAr ? 'غير محدود' : 'Unlimited';
  if (n === 0) return isAr ? 'غير متاح' : 'Not included';
  return String(n);
}

// Feature comparison rows
interface FeatureRow {
  labelAr: string;
  labelEn: string;
  key: 'questionsPerMonth' | 'checksPerMonth' | 'pdfReportsPerMonth' |
       'archiveMonths' | 'legalComparisons' | 'teamMembers';
  suffix?: { ar: string; en: string };
}

const FEATURE_ROWS: FeatureRow[] = [
  { labelAr: 'أسئلة قانونية / شهر',   labelEn: 'Legal questions / month',   key: 'questionsPerMonth' },
  { labelAr: 'عمليات فحص / شهر',       labelEn: 'Checks / month',            key: 'checksPerMonth' },
  { labelAr: 'تقارير PDF / شهر',        labelEn: 'PDF exports / month',       key: 'pdfReportsPerMonth' },
  { labelAr: 'أرشيف (أشهر)',            labelEn: 'Archive (months)',           key: 'archiveMonths', suffix: { ar: 'شهرًا', en: 'mo' } },
  { labelAr: 'مقارنات قانونية / شهر',  labelEn: 'Legal comparisons / month', key: 'legalComparisons' },
  { labelAr: 'حسابات فريق العمل',       labelEn: 'Team member seats',         key: 'teamMembers' },
];

const BOOLEAN_FEATURES = [
  { ar: 'مساعد قانوني ذكي',          en: 'AI legal assistant',         plans: ['professional', 'expert', 'enterprise'] },
  { ar: 'نتيجة ASLI للقرارات',       en: 'ASLI score for decisions',   plans: ['professional', 'expert', 'enterprise'] },
  { ar: 'تحليل نظرية الشامسي',       en: 'Shamsi theory analysis',     plans: ['expert', 'enterprise'] },
  { ar: 'MARSAD Audit المتقدم',       en: 'Advanced MARSAD Audit',      plans: ['expert', 'enterprise'] },
  { ar: 'أولوية معالجة الطلبات',      en: 'Priority processing',        plans: ['expert', 'enterprise'] },
  { ar: 'تكامل مع الأنظمة',          en: 'System integration',         plans: ['enterprise'] },
  { ar: 'دعم تقني مخصص 24/7',        en: 'Dedicated 24/7 support',     plans: ['enterprise'] },
  { ar: 'اتفاقية مستوى خدمة (SLA)',  en: 'Service Level Agreement',    plans: ['enterprise'] },
] as const;

// ── Animation variants ─────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan, yearly, isAr, currentPlan, onCta,
}: {
  plan: Plan;
  yearly: boolean;
  isAr: boolean;
  currentPlan: PlanId;
  onCta: (plan: Plan) => void;
}) {
  const isCurrentPlan = currentPlan === plan.id;
  const price = yearly ? plan.priceYearly : plan.priceMonthly;

  return (
    <motion.div
      variants={fadeUp}
      className={`relative flex flex-col rounded-2xl border p-6 gap-5 transition-all
        ${plan.highlighted
          ? 'border-gold/60 bg-gradient-to-b from-gold/[0.07] to-transparent shadow-[0_0_40px_rgba(201,168,76,0.12)]'
          : 'border-border bg-card/50'}`}
    >
      {/* Popular badge */}
      {plan.badgeAr && (
        <div className="absolute -top-3 right-4 inline-flex items-center gap-1 text-[11px] font-bold bg-gold text-background px-3 py-1 rounded-full shadow-md">
          <Star className="w-3 h-3" />
          {isAr ? plan.badgeAr : plan.badgeEn}
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 left-4 inline-flex items-center gap-1 text-[11px] font-semibold border border-gold/30 bg-gold/10 text-gold px-3 py-1 rounded-full">
          <Check className="w-3 h-3" />
          {isAr ? 'خطتك الحالية' : 'Current plan'}
        </div>
      )}

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {isAr ? plan.nameAr : plan.nameEn}
        </p>
        <p className="text-sm text-muted-foreground leading-snug mb-4">
          {isAr ? plan.descAr : plan.descEn}
        </p>

        {/* Price */}
        {plan.priceMonthly === null ? (
          <div className="text-2xl font-black text-foreground">
            {isAr ? 'تواصل معنا' : 'Contact us'}
          </div>
        ) : plan.priceMonthly === 0 ? (
          <div className="text-2xl font-black text-foreground">
            {isAr ? 'مجاني' : 'Free'}
          </div>
        ) : (
          <div className="flex items-end gap-1">
            <span className="text-3xl font-black text-foreground">
              {yearly ? plan.priceYearly : plan.priceMonthly}
            </span>
            <span className="text-sm text-muted-foreground mb-1">
              {isAr ? 'درهم' : 'AED'}
              {yearly ? (isAr ? '/سنة' : '/yr') : (isAr ? '/شهر' : '/mo')}
            </span>
          </div>
        )}

        {/* Yearly savings */}
        {yearly && plan.priceMonthly !== null && plan.priceMonthly > 0 && plan.priceYearly !== null && (
          <p className="text-[11px] text-green-400 mt-1">
            {isAr
              ? `وفّر ${(plan.priceMonthly * 12) - plan.priceYearly} درهمًا سنويًا`
              : `Save ${(plan.priceMonthly * 12) - plan.priceYearly} AED/year`}
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => onCta(plan)}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all
          ${plan.highlighted
            ? 'bg-gold text-background hover:opacity-90'
            : plan.id === 'enterprise'
            ? 'border border-gold/30 text-gold hover:bg-gold/10'
            : isCurrentPlan
            ? 'border border-border text-muted-foreground cursor-default'
            : 'border border-border text-foreground hover:bg-muted/40'}`}
        disabled={isCurrentPlan && plan.priceMonthly === 0}
      >
        {isCurrentPlan
          ? (isAr ? 'خطتك الحالية' : 'Current plan')
          : (isAr ? plan.ctaAr : plan.ctaEn)}
      </button>

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {(isAr ? plan.featuresAr : plan.featuresEn).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
            <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ── À la carte card ───────────────────────────────────────────────────────────
function AlaCarteCard({ svc, isAr, onBuy }: {
  svc: typeof A_LA_CARTE[number];
  isAr: boolean;
  onBuy: (svc: typeof A_LA_CARTE[number]) => void;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card/50 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl mb-1">{svc.icon}</div>
          <p className="font-semibold text-foreground text-sm">
            {isAr ? svc.nameAr : svc.nameEn}
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {isAr ? svc.descAr : svc.descEn}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-black text-gold">{svc.price}</span>
          <span className="text-xs text-muted-foreground block">{isAr ? 'درهم' : 'AED'}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onBuy(svc)}
        className="w-full py-2.5 rounded-xl border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/10 transition-colors"
      >
        {isAr ? 'طلب الخدمة' : 'Request Service'}
      </button>
    </motion.div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────
function ComparisonTable({ isAr }: { isAr: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
      >
        <span className="font-semibold text-foreground text-sm">
          {isAr ? 'مقارنة تفصيلية بين الخطط' : 'Detailed plan comparison'}
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir={isAr ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="border-t border-border bg-muted/20">
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground w-40">
                  {isAr ? 'الميزة' : 'Feature'}
                </th>
                {PLANS.map(p => (
                  <th key={p.id} className="px-3 py-3 text-center text-xs font-semibold">
                    <span className={p.highlighted ? 'text-gold' : 'text-foreground/70'}>
                      {isAr ? p.nameAr : p.nameEn}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Numeric limits */}
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key} className="border-t border-border/50 hover:bg-muted/10">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {isAr ? row.labelAr : row.labelEn}
                  </td>
                  {PLANS.map(plan => {
                    const val = plan.limits[row.key];
                    const display = fmt(val, isAr);
                    return (
                      <td key={plan.id} className="px-3 py-3 text-center text-xs font-medium">
                        {val === null ? (
                          <Infinity className="w-4 h-4 text-gold mx-auto" />
                        ) : val === 0 ? (
                          <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className={plan.highlighted ? 'text-gold' : 'text-foreground/80'}>{display}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Boolean features */}
              {BOOLEAN_FEATURES.map((feat) => (
                <tr key={feat.ar} className="border-t border-border/50 hover:bg-muted/10">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {isAr ? feat.ar : feat.en}
                  </td>
                  {PLANS.map(plan => (
                    <td key={plan.id} className="px-3 py-3 text-center">
                      {(feat.plans as readonly string[]).includes(plan.id) ? (
                        <Check className="w-4 h-4 text-gold mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Pricing() {
  const { lang, isOwner } = useUserContext();
  const userPlan = ((useUserContext() as { plan?: PlanId }).plan) ?? 'free';
  const isAr = lang === 'ar';
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [yearly, setYearly] = useState(false);

  function handleCta(plan: Plan) {
    if (plan.id === 'enterprise') {
      toast({
        title: isAr ? 'تواصل معنا' : 'Contact Us',
        description: isAr
          ? 'يسعدنا التواصل معك لتصميم خطة مؤسسية مخصصة. سيتم تفعيل نموذج التواصل قريبًا.'
          : 'We\'d love to design a custom enterprise plan for you. Contact form coming soon.',
      });
      return;
    }
    if (plan.id === 'free' || plan.id === userPlan) return;

    toast({
      title: isAr ? 'قريبًا — بوابة الدفع تحت الإعداد' : 'Coming Soon — Payment gateway in setup',
      description: isAr
        ? `سيتم تفعيل الاشتراك في خطة ${plan.nameAr} فور ربط بوابة الدفع · Apple Pay · Google Pay · بطاقة ائتمانية`
        : `${plan.nameEn} subscription will be activated once the payment gateway is connected · Apple Pay · Google Pay · Credit card`,
      duration: 6000,
    });
  }

  function handleAlaCarte(svc: typeof A_LA_CARTE[number]) {
    toast({
      title: isAr ? 'قريبًا — الخدمات المنفردة تحت الإعداد' : 'Coming Soon — À la carte in setup',
      description: isAr
        ? `خدمة «${svc.nameAr}» ستُتاح فور ربط بوابة الدفع.`
        : `"${svc.nameEn}" will be available once the payment gateway is connected.`,
      duration: 5000,
    });
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-12" dir={isAr ? 'rtl' : 'ltr'}>

        {/* ── Back button ── */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isAr ? 'العودة' : 'Back'}
        </button>

        {/* ── Hero ── */}
        <motion.div
          initial="hidden" animate="visible" variants={stagger}
          className="text-center space-y-4"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gold bg-gold/10 border border-gold/20 px-3 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            {isAr ? 'الاشتراكات والأسعار' : 'Subscriptions & Pricing'}
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-2xl sm:text-3xl font-black text-foreground leading-tight">
            {isAr ? 'اختر الخطة المناسبة لاحتياجاتك' : 'Choose the right plan for you'}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {isAr
              ? 'منصة مرصد للقرارات الإدارية الذكية — خطط مرنة للمهنيين القانونيين والجهات المؤسسية'
              : 'MARSAD AI Administrative Decision Platform — flexible plans for legal professionals and institutions'}
          </motion.p>

          {/* ── Billing toggle ── */}
          <motion.div variants={fadeUp} className="inline-flex items-center gap-3 bg-muted/30 rounded-full p-1 border border-border">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${!yearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {isAr ? 'شهري' : 'Monthly'}
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${yearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {isAr ? 'سنوي' : 'Yearly'}
              <span className="mr-1.5 text-[10px] font-bold text-green-400">
                {isAr ? 'وفّر 30%' : 'Save 30%'}
              </span>
            </button>
          </motion.div>
        </motion.div>

        {/* ── Plan cards ── */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              yearly={yearly}
              isAr={isAr}
              currentPlan={isOwner ? 'expert' : userPlan}
              onCta={handleCta}
            />
          ))}
        </motion.div>

        {/* ── Coming-soon notice ── */}
        <div className="rounded-2xl border border-gold/20 bg-gold/5 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Lock className="w-5 h-5 text-gold shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isAr ? 'بوابة الدفع تحت الإعداد' : 'Payment gateway in setup'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {isAr
                ? 'سيتم تفعيل الاشتراكات والخدمات المدفوعة فور إتمام ربط بوابة الدفع. ستُقبل: Apple Pay · Google Pay · بطاقة ائتمانية · تحويل بنكي.'
                : 'Paid subscriptions will be activated once the payment gateway is connected. Accepted: Apple Pay · Google Pay · Credit card · Bank transfer.'}
            </p>
          </div>
        </div>

        {/* ── Comparison table ── */}
        <ComparisonTable isAr={isAr} />

        {/* ── À la carte ── */}
        <div className="space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">
              {isAr ? 'خدمات منفردة — بدون اشتراك' : 'À la carte — no subscription needed'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAr ? 'ادفع مرة واحدة مقابل خدمة بعينها' : 'Pay once for a single service'}
            </p>
          </div>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {A_LA_CARTE.map(svc => (
              <AlaCarteCard key={svc.id} svc={svc} isAr={isAr} onBuy={handleAlaCarte} />
            ))}
          </motion.div>
        </div>

        {/* ── Enterprise CTA ── */}
        <div className="rounded-2xl border border-border bg-card/60 px-6 py-8 text-center space-y-4">
          <div className="text-3xl">🏛️</div>
          <h3 className="text-lg font-bold text-foreground">
            {isAr ? 'الجهات الحكومية والمؤسسات الكبرى' : 'Government & Enterprise'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {isAr
              ? 'خطط مؤسسية مرنة مع تكامل كامل مع أنظمتكم الداخلية واتفاقية مستوى خدمة واضحة'
              : 'Flexible enterprise plans with full integration into your internal systems and clear SLA'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => handleCta(PLANS[3])}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-background text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <Users className="w-4 h-4" />
              {isAr ? 'تواصل للمؤسسات' : 'Contact for Enterprise'}
            </button>
          </div>
        </div>

        {/* ── FAQ ── */}
        <FaqSection isAr={isAr} />

      </div>
    </AppLayout>
  );
}

// ── FAQ section ───────────────────────────────────────────────────────────────
interface Faq { q: string; a: string }

const FAQ_AR: Faq[] = [
  { q: 'متى تُفعَّل الاشتراكات المدفوعة؟', a: 'ستُفعَّل الاشتراكات فور إتمام ربط بوابة الدفع بالمنصة. يمكنك التسجيل مجانًا والاستفادة من جميع الميزات المتاحة في الخطة المجانية.' },
  { q: 'هل يمكنني إلغاء الاشتراك في أي وقت؟', a: 'نعم، يمكنك إلغاء الاشتراك في أي وقت دون رسوم إلغاء. يستمر الاشتراك حتى نهاية الفترة المدفوعة.' },
  { q: 'هل الأسعار شاملة ضريبة القيمة المضافة؟', a: 'الأسعار المعروضة لا تشمل ضريبة القيمة المضافة. ستُحتسب الضريبة عند إتمام عملية الدفع وفق النسب المعمول بها.' },
  { q: 'ما الفرق بين الخطة المهنية والخطة الخبير؟', a: 'الخطة المهنية تناسب المهنيين القانونيين ذوي الاستخدام المعتدل مع حد شهري للأسئلة والتقارير. خطة الخبير توفر استخدامًا غير محدود مع أولوية معالجة وصلاحيات متقدمة لتحليل نظرية الشامسي.' },
  { q: 'هل يمكنني الترقية أو التخفيض في أي وقت؟', a: 'نعم، يمكنك تغيير خطتك في أي وقت. عند الترقية تُطبَّق الإمكانات الجديدة فورًا، وعند التخفيض تبدأ الخطة الجديدة من تاريخ التجديد.' },
];

const FAQ_EN: Faq[] = [
  { q: 'When will paid subscriptions be activated?', a: 'Subscriptions will be activated once the payment gateway is connected to the platform. You can register for free and use all features in the Free plan.' },
  { q: 'Can I cancel my subscription at any time?', a: 'Yes, you can cancel at any time without cancellation fees. Your subscription remains active until the end of the paid period.' },
  { q: 'Do prices include VAT?', a: 'Displayed prices do not include VAT. Tax will be calculated at checkout according to applicable rates.' },
  { q: 'What is the difference between Professional and Expert?', a: 'Professional suits legal professionals with moderate usage and monthly limits. Expert provides unlimited usage with priority processing and advanced Shamsi theory analysis.' },
  { q: 'Can I upgrade or downgrade at any time?', a: 'Yes, you can change your plan anytime. Upgrades take effect immediately; downgrades start from the next renewal date.' },
];

function FaqSection({ isAr }: { isAr: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = isAr ? FAQ_AR : FAQ_EN;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground text-center">
        {isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
      </h2>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-start hover:bg-muted/20 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{faq.q}</span>
              {open === i
                ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
            {open === i && (
              <div className="px-5 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
