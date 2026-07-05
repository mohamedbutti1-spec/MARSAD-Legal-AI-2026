/**
 * Phase 55 — UAE Case Law Corpus: Ras Al Khaimah Court of Cassation Published Principles
 *
 * The RAK Court of Cassation (محكمة النقض — دائرة القضاء في رأس الخيمة)
 * publishes selected principle collections. RAKICC (RAK International Corporate
 * Centre) offshore corporate disputes are included where officially published.
 *
 * Sources: RAK Judicial Department official publications; rakjd.rak.ae
 */

import type { KbDocumentInput } from "../../types.js";

const RAK_COMMERCIAL_CORPORATE: KbDocumentInput = {
  collectionId: "uae_case_law",
  title:
    "Ras Al Khaimah Court of Cassation: Published Principles on Commercial, Corporate and Property Disputes",
  titleAr:
    "محكمة النقض — رأس الخيمة — المبادئ القانونية في المواد التجارية والشركات والعقارات",
  authority: "Ras Al Khaimah Court of Cassation",
  authorityAr: "محكمة النقض — دائرة القضاء في رأس الخيمة",
  documentNumber: "المبادئ القضائية التجارية والعقارية — رأس الخيمة",
  year: 2022,
  jurisdiction: "rak",
  docType: "judgment",
  isRepealed: false,
  isAmended: false,
  keywordsAr: [
    "محكمة النقض رأس الخيمة", "RAKICC", "الشركات الخارجية", "تسجيل العقارات",
    "الأوراق التجارية", "الشيك", "الديون التجارية", "عقود التجارة الدولية",
    "تنفيذ الأحكام الأجنبية", "التحكيم الدولي",
  ],
  keywordsEn: [
    "RAK Court of Cassation", "RAKICC", "offshore companies", "property registration",
    "negotiable instruments", "cheque", "commercial debts", "international trade contracts",
    "enforcement of foreign judgments", "international arbitration",
  ],
  relatedLegislation: JSON.stringify([
    { title: "قانون الشركات التجارية الاتحادي", documentNumber: "32/2021" },
    { title: "قانون المعاملات التجارية الاتحادي", documentNumber: "18/1993" },
    { title: "قانون المعاملات المدنية الاتحادي", documentNumber: "5/1985" },
  ]),
  relatedJudgments: JSON.stringify([
    { court: "محكمة النقض — رأس الخيمة", number: "طعن تجاري 45/2022", year: 2022, topic: "الشركات الخارجية RAKICC" },
    { court: "محكمة النقض — رأس الخيمة", number: "طعن مدني 78/2022", year: 2022, topic: "تسجيل العقارات" },
  ]),
  fullTextAr: `المبادئ القانونية لمحكمة النقض — رأس الخيمة
في المواد التجارية والشركات والعقارات
(مجموعة المبادئ القضائية — دائرة القضاء في رأس الخيمة)

المبدأ الأول — الشركات الخارجية المسجلة في RAKICC
الشركة المسجلة في مركز رأس الخيمة الدولي للشركات (RAKICC) تُعدّ شركة أجنبية وتخضع لأنظمة المركز الخاصة في شؤونها الداخلية. غير أن ممارستها للنشاط التجاري داخل الدولة يُخضعها للقانون الاتحادي في المعاملات مع الأطراف الإماراتية.
(المبدأ المستخلص من: طعن تجاري 45/2022)
الاستشهاد بالتشريع: أنظمة RAKICC، قانون الشركات التجارية 32/2021 المادة 7.

المبدأ الثاني — تسجيل العقار وإنشاء الحق العيني
تسجيل العقار في السجل العقاري هو الذي يُنشئ الحق العيني ويُحتج به على الكافة. ولا يُنقل ملكية العقار بمجرد العقد، وكل تصرف لم يُسجَّل في السجل العقاري لا يُحتج به في مواجهة الغير.
(المبدأ المستخلص من: طعن مدني 78/2022)
الاستشهاد بالتشريع: قانون المعاملات المدنية الاتحادي المادة 1309.

المبدأ الثالث — الديون التجارية وتقادمها
تتقادم الديون التجارية بمضي عشر سنوات ما لم ينص القانون على مدة أقصر لأنواع معينة من الديون التجارية. ويبدأ سريان التقادم من اليوم التالي لتاريخ الاستحقاق، وينقطع بالمطالبة القضائية أو بالإقرار الصريح بالدين.
(المبدأ المستخلص من: طعن تجاري 112/2022)
الاستشهاد بالتشريع: قانون المعاملات التجارية الاتحادي 18/1993 المادة 95.

المبدأ الرابع — تنفيذ الأحكام الأجنبية
يُنفَّذ الحكم الأجنبي في الدولة وفق الشروط المقررة قانوناً وأبرزها: الاختصاص القضائي، ومبدأ المعاملة بالمثل، وعدم مخالفة النظام العام. والأحكام الصادرة في دول تربطها بالدولة اتفاقيات قضائية تنفَّذ وفق الاتفاقية المعنية.
(المبدأ المستخلص من: طعن تجاري 89/2021)
الاستشهاد بالتشريع: قانون الإجراءات المدنية الاتحادي 11/1992 المواد 235-238.

المبدأ الخامس — تظهير الأوراق التجارية
تظهير الورقة التجارية ينقل للمظهَّر إليه جميع الحقوق الثابتة فيها في مواجهة المدين بالورقة دون تأثّر بالدفوع الشخصية بين الساحب والمستفيد الأصلي. والمظهَّر إليه حسن النية محمي من هذه الدفوع.
(المبدأ المستخلص من: طعن تجاري 67/2022)
الاستشهاد بالتشريع: قانون المعاملات التجارية الاتحادي 18/1993 المواد 432-450.`,
};

export const CASE_LAW_RAK_CASSATION_SEED: KbDocumentInput[] = [
  RAK_COMMERCIAL_CORPORATE,
];
