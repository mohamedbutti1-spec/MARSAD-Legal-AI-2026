/**
 * 16-Pillar Administrative Decision Analyzer — shared display constants
 * Keeps the frontend in sync with the backend evaluator's pillar definitions.
 *
 * Traditional pillars (6)  — classical administrative law
 * AI/Digital pillars (10)  — Al-Shamsi digital-era additions
 *
 * Weights must sum to 100 across all 16.
 */

export interface PillarMeta {
  key: string;
  labelAr: string;
  labelEn: string;
  /** Weight percentage (0-100) used in legality score computation */
  weight: number;
  descriptionAr: string;
}

export const TRADITIONAL_PILLARS: PillarMeta[] = [
  {
    key: 'jurisdiction',
    labelAr: 'الاختصاص المؤسسي',
    labelEn: 'Jurisdiction',
    weight: 14,
    descriptionAr: 'هل الجهة المُصدِرة تملك الصلاحية القانونية لإصدار هذا النوع من القرارات؟',
  },
  {
    key: 'competence',
    labelAr: 'أهلية المُصدِر',
    labelEn: 'Competence',
    weight: 8,
    descriptionAr: 'هل الموظف/المسؤول الذي وقّع القرار يملك الأهلية القانونية والمستوى الوظيفي المطلوب؟',
  },
  {
    key: 'form',
    labelAr: 'الشكل',
    labelEn: 'Form',
    weight: 7,
    descriptionAr: 'هل القرار مستوفٍ للشكل القانوني المطلوب (كتابة، توقيع، تسبيب، تبليغ)؟',
  },
  {
    key: 'cause',
    labelAr: 'السبب',
    labelEn: 'Cause',
    weight: 12,
    descriptionAr: 'هل ثمة واقعة أو حالة قانونية مشروعة تسوّغ القرار؟',
  },
  {
    key: 'subjectMatter',
    labelAr: 'المحل',
    labelEn: 'Subject Matter',
    weight: 7,
    descriptionAr: 'هل موضوع القرار مشروع وممكن وغير مخالف للنظام العام؟',
  },
  {
    key: 'purpose',
    labelAr: 'الغاية',
    labelEn: 'Purpose',
    weight: 7,
    descriptionAr: 'هل القرار يستهدف المصلحة العامة وليس أغراضاً شخصية أو انحرافاً بالسلطة؟',
  },
];

export const AI_DECISION_PILLARS: PillarMeta[] = [
  {
    key: 'humanWill',
    labelAr: 'الإرادة الإنسانية',
    labelEn: 'Human Will',
    weight: 7,
    descriptionAr: 'هل القرار صادر عن إرادة إنسانية حرة وواعية؟',
  },
  {
    key: 'digitalWillFormation',
    labelAr: 'تكوين الإرادة الرقمية',
    labelEn: 'Digital Will Formation',
    weight: 5,
    descriptionAr: 'هل الأنظمة الرقمية المستخدمة معتمدة قانونياً وفق المرسوم بقانون 21/2021؟',
  },
  {
    key: 'algorithmicWeight',
    labelAr: 'الوزن القانوني الخوارزمي',
    labelEn: 'Algorithmic Legal Weight',
    weight: 5,
    descriptionAr: 'ما مقدار تأثير التوصية الخوارزمية على القرار النهائي؟',
  },
  {
    key: 'algorithmicBias',
    labelAr: 'التحيز الخوارزمي',
    labelEn: 'Algorithmic Bias',
    weight: 4,
    descriptionAr: 'هل الخوارزمية خضعت للتقييم وفحص التحيز والمراجعة الدورية؟',
  },
  {
    key: 'explainability',
    labelAr: 'قابلية التفسير',
    labelEn: 'Explainability',
    weight: 4,
    descriptionAr: 'هل يمكن شرح القرار للمتأثر بلغة واضحة وفق حق الاطلاع؟',
  },
  {
    key: 'humanOversight',
    labelAr: 'الإشراف البشري',
    labelEn: 'Human Oversight',
    weight: 4,
    descriptionAr: 'هل ثمة رقابة بشرية كافية على عملية اتخاذ القرار وتنفيذه؟',
  },
  {
    key: 'judicialReviewReadiness',
    labelAr: 'الجاهزية للمراجعة القضائية',
    labelEn: 'Judicial Review Readiness',
    weight: 4,
    descriptionAr: 'هل القرار موثق بما يكفي للصمود أمام الطعن القضائي؟',
  },
  {
    key: 'proportionality',
    labelAr: 'التناسب',
    labelEn: 'Proportionality',
    weight: 5,
    descriptionAr: 'هل الإجراء الإداري المتخذ متناسب مع الهدف المُعلن ولا يتجاوز ما هو ضروري؟',
  },
  {
    key: 'transparency',
    labelAr: 'الشفافية',
    labelEn: 'Transparency',
    weight: 4,
    descriptionAr: 'هل تم الإفصاح بشكل كافٍ عن أسباب القرار للأطراف المتأثرة؟',
  },
  {
    key: 'accountability',
    labelAr: 'المساءلة',
    labelEn: 'Accountability',
    weight: 3,
    descriptionAr: 'هل ثمة إنسان مسؤول ومحدد الهوية يمكن مساءلته قانونياً عن هذا القرار؟',
  },
];

export const ALL_PILLARS: PillarMeta[] = [...TRADITIONAL_PILLARS, ...AI_DECISION_PILLARS];

// Colour scheme for findings
export const PILLAR_STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string; labelAr: string }> = {
  compliant: {
    bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0',
    label: 'Compliant', labelAr: 'مطابق',
  },
  partial: {
    bg: '#fffbeb', text: '#92400e', border: '#fde68a',
    label: 'At Risk', labelAr: 'قيد الخطر',
  },
  'non-compliant': {
    bg: '#fef2f2', text: '#991b1b', border: '#fecaca',
    label: 'Deficient', labelAr: 'ناقص',
  },
  unknown: {
    bg: '#f8fafc', text: '#64748b', border: '#e2e8f0',
    label: 'Unknown', labelAr: 'غير محدد',
  },
};

// Authority label colours
export const AUTHORITY_LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  '[UAE Binding]':              { bg: '#dcfce7', text: '#166534' },
  '[Comparative Persuasive]':   { bg: '#dbeafe', text: '#1e40af' },
};
