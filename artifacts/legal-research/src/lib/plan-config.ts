/**
 * MARSAD Subscription Plan Configuration
 *
 * Defines the four subscription tiers, their feature limits, pricing,
 * and the feature-gate matrix used by UpgradeGate components.
 *
 * NO real payment is wired here — this is the data layer only.
 * Payment integration (Apple Pay / Google Pay / web checkout) is
 * wired separately once payment keys are available.
 */

export type PlanId = 'free' | 'professional' | 'expert' | 'enterprise';

/** Ordered numeric levels for comparison */
export const PLAN_LEVEL: Record<PlanId, number> = {
  free:         0,
  professional: 1,
  expert:       2,
  enterprise:   3,
};

export function planAtLeast(userPlan: PlanId, required: PlanId): boolean {
  return PLAN_LEVEL[userPlan] >= PLAN_LEVEL[required];
}

export interface PlanLimits {
  /** Legal questions per month; null = unlimited */
  questionsPerMonth: number | null;
  /** Legal checks / assessments per month */
  checksPerMonth: number | null;
  /** PDF report exports per month */
  pdfReportsPerMonth: number | null;
  /** Archive history in months; null = unlimited */
  archiveMonths: number | null;
  /** Legal jurisdiction comparisons per month */
  legalComparisons: number | null;
  /** Team member seats; null = unlimited */
  teamMembers: number | null;
}

export interface Plan {
  id: PlanId;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  priceMonthly: number | null; // null = contact us
  priceYearly:  number | null;
  currency: 'AED';
  limits: PlanLimits;
  /** Feature bullets shown in plan card (Arabic) */
  featuresAr: string[];
  featuresEn: string[];
  highlighted?: boolean;
  ctaAr: string;
  ctaEn: string;
  /** Badge text shown on card (e.g. "الأكثر طلبًا") */
  badgeAr?: string;
  badgeEn?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    nameAr: 'مجاني',
    nameEn: 'Free',
    descAr: 'للاستكشاف والاطلاع على إمكانات المنصة',
    descEn: 'Explore the platform and get started',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'AED',
    limits: {
      questionsPerMonth: 5,
      checksPerMonth: 2,
      pdfReportsPerMonth: 0,
      archiveMonths: 1,
      legalComparisons: 0,
      teamMembers: 1,
    },
    featuresAr: [
      '5 أسئلة قانونية شهريًا',
      '2 عملية فحص شهريًا',
      'الاطلاع على المصادر القانونية',
      'قاعدة المعرفة الأساسية',
    ],
    featuresEn: [
      '5 legal questions/month',
      '2 checks/month',
      'Access legal sources',
      'Basic knowledge base',
    ],
    ctaAr: 'ابدأ مجانًا',
    ctaEn: 'Start Free',
  },
  {
    id: 'professional',
    nameAr: 'مرصد المهني',
    nameEn: 'MARSAD Professional',
    descAr: 'للمحامين والمستشارين القانونيين والمهنيين',
    descEn: 'For lawyers, legal consultants and professionals',
    priceMonthly: 49,
    priceYearly: 399,
    currency: 'AED',
    limits: {
      questionsPerMonth: 100,
      checksPerMonth: 30,
      pdfReportsPerMonth: 10,
      archiveMonths: 12,
      legalComparisons: 10,
      teamMembers: 1,
    },
    featuresAr: [
      '100 سؤال قانوني شهريًا',
      '30 عملية فحص شهريًا',
      '10 تقارير PDF شهريًا',
      'أرشيف 12 شهرًا',
      '10 مقارنات قانونية شهريًا',
      'نتيجة ASLI للقرارات',
      'مساعد قانوني ذكي كامل',
    ],
    featuresEn: [
      '100 legal questions/month',
      '30 checks/month',
      '10 PDF reports/month',
      '12-month archive',
      '10 legal comparisons/month',
      'ASLI score for decisions',
      'Full AI legal assistant',
    ],
    badgeAr: 'الأكثر طلبًا',
    badgeEn: 'Most Popular',
    highlighted: true,
    ctaAr: 'ترقية إلى المهني',
    ctaEn: 'Upgrade to Professional',
  },
  {
    id: 'expert',
    nameAr: 'مرصد الخبير',
    nameEn: 'MARSAD Expert',
    descAr: 'للخبراء القانونيين والمدراء والقضاة والجهات الرقابية',
    descEn: 'For senior legal experts, judges and regulatory bodies',
    priceMonthly: 149,
    priceYearly: 1190,
    currency: 'AED',
    limits: {
      questionsPerMonth: null,
      checksPerMonth: null,
      pdfReportsPerMonth: null,
      archiveMonths: null,
      legalComparisons: null,
      teamMembers: 5,
    },
    featuresAr: [
      'أسئلة وفحوصات غير محدودة',
      'تقارير PDF غير محدودة',
      'أرشيف شامل وغير محدود',
      'مقارنات قانونية غير محدودة',
      'أولوية معالجة الطلبات',
      'تحليل نظرية الشامسي الكاملة',
      'MARSAD Audit المتقدم',
      '5 حسابات فريق عمل',
    ],
    featuresEn: [
      'Unlimited questions & checks',
      'Unlimited PDF reports',
      'Full unlimited archive',
      'Unlimited legal comparisons',
      'Priority processing',
      'Full Shamsi theory analysis',
      'Advanced MARSAD Audit',
      '5 team member accounts',
    ],
    ctaAr: 'ترقية إلى الخبير',
    ctaEn: 'Upgrade to Expert',
  },
  {
    id: 'enterprise',
    nameAr: 'الجهات والمؤسسات',
    nameEn: 'Enterprise',
    descAr: 'للجهات الحكومية والمؤسسات القانونية الكبرى والشركات',
    descEn: 'For government entities, large law firms and corporations',
    priceMonthly: null,
    priceYearly: null,
    currency: 'AED',
    limits: {
      questionsPerMonth: null,
      checksPerMonth: null,
      pdfReportsPerMonth: null,
      archiveMonths: null,
      legalComparisons: null,
      teamMembers: null,
    },
    featuresAr: [
      'استخدام مؤسسي غير محدود',
      'حسابات فريق عمل غير محدودة',
      'تكامل مع الأنظمة الداخلية',
      'تقارير وتحليلات مخصصة',
      'دعم تقني مخصص 24/7',
      'تدريب وتأهيل الفريق',
      'اتفاقية مستوى خدمة (SLA)',
    ],
    featuresEn: [
      'Unlimited institutional usage',
      'Unlimited team accounts',
      'Internal system integration',
      'Custom reports & analytics',
      'Dedicated 24/7 support',
      'Team training & onboarding',
      'Service Level Agreement (SLA)',
    ],
    ctaAr: 'تواصل معنا',
    ctaEn: 'Contact Us',
  },
];

// ── À la carte one-time services ──────────────────────────────────────────────

export interface AlaCarteService {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  price: number;
  currency: 'AED';
  icon: string;
}

export const A_LA_CARTE: AlaCarteService[] = [
  {
    id: 'quick-report',
    nameAr: 'تقرير سريع',
    nameEn: 'Quick Report',
    descAr: 'تقرير قانوني مختصر لمسألة محددة خلال دقائق',
    descEn: 'A concise legal report on a specific issue within minutes',
    price: 19,
    currency: 'AED',
    icon: '⚡',
  },
  {
    id: 'full-check',
    nameAr: 'فحص قانوني متكامل',
    nameEn: 'Full Legal Check',
    descAr: 'مراجعة شاملة لوثيقة أو قرار مع تقييم ASLI',
    descEn: 'Comprehensive review of a document or decision with ASLI score',
    price: 49,
    currency: 'AED',
    icon: '🔍',
  },
  {
    id: 'pro-memo',
    nameAr: 'مذكرة أو تقرير احترافي',
    nameEn: 'Professional Memo / Report',
    descAr: 'مذكرة قانونية أو تقرير احترافي موثق وجاهز للرفع الرسمي',
    descEn: 'A documented legal memo or professional report ready for official submission',
    price: 99,
    currency: 'AED',
    icon: '📄',
  },
];

// ── Feature gate definitions ──────────────────────────────────────────────────
// Maps each gated feature to the minimum plan required to access it.
// Features not in this map are available to all plans.

export type GatedFeature =
  | 'ai_assistant'
  | 'asli_score'
  | 'pdf_export'
  | 'archive'
  | 'legal_comparison'
  | 'priority_processing'
  | 'team_accounts'
  | 'audit_log'
  | 'shamsi_framework'
  | 'extended_reports'
  | 'marsad_audit';

export const FEATURE_PLAN: Record<GatedFeature, PlanId> = {
  ai_assistant:        'professional',
  asli_score:          'professional',
  pdf_export:          'professional',
  archive:             'professional',
  legal_comparison:    'professional',
  extended_reports:    'expert',
  priority_processing: 'expert',
  audit_log:           'expert',
  shamsi_framework:    'expert',
  marsad_audit:        'expert',
  team_accounts:       'enterprise',
};

export function canAccessFeature(userPlan: PlanId, feature: GatedFeature): boolean {
  const required = FEATURE_PLAN[feature];
  return planAtLeast(userPlan, required);
}

/** Human-readable plan name in Arabic */
export function planNameAr(plan: PlanId): string {
  return PLANS.find(p => p.id === plan)?.nameAr ?? plan;
}

/** Human-readable minimum-plan requirement in Arabic */
export function requiredPlanNameAr(feature: GatedFeature): string {
  return planNameAr(FEATURE_PLAN[feature]);
}
