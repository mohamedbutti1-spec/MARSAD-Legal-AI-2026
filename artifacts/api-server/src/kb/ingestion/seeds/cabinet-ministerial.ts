/**
 * Phase 54 — UAE Legal Knowledge Base: Key Cabinet and Ministerial Decisions
 * Source: UAE Official Gazette / ministry publications
 */

import type { KbDocumentInput } from "../../types.js";

export const CABINET_MINISTERIAL_SEED: KbDocumentInput[] = [
  // ─── Cabinet Decisions ────────────────────────────────────────────────────
  {
    collectionId: "cabinet_decisions",
    title: "Cabinet Decision No. 85 of 2022 on the Regulation of Artificial Intelligence",
    titleAr: "قرار مجلس الوزراء رقم 85 لسنة 2022 في شأن تنظيم الذكاء الاصطناعي",
    authority: "UAE Cabinet of Ministers",
    authorityAr: "مجلس الوزراء الاتحادي",
    documentNumber: "85 of 2022",
    year: 2022,
    jurisdiction: "federal",
    docType: "cabinet_decision",
    effectiveDate: "2023-01-01",
    isRepealed: false,
    isAmended: false,
    keywordsAr: ["الذكاء الاصطناعي", "تنظيم الذكاء الاصطناعي", "الحوكمة الرقمية", "الأخلاقيات", "المسؤولية الخوارزمية"],
    keywordsEn: ["artificial intelligence", "AI regulation", "digital governance", "ethics", "algorithmic accountability"],
    fullTextAr: `قرار مجلس الوزراء رقم 85 لسنة 2022 في شأن تنظيم الذكاء الاصطناعي

استناداً إلى الدستور الاتحادي،
وإلى القانون الاتحادي رقم 1 لسنة 1972 في شأن اختصاصات الوزارات وصلاحيات الوزراء وتعديلاته،
يُصدر مجلس الوزراء القرار الآتي:

المادة 1 — الهدف
يهدف هذا القرار إلى تنظيم استخدام تقنيات الذكاء الاصطناعي وضمان توافقها مع القيم والمبادئ الوطنية ومتطلبات الأمن والخصوصية.

المادة 2 — النطاق
تسري أحكام هذا القرار على جميع الجهات الحكومية والخاصة التي تستخدم تقنيات الذكاء الاصطناعي في دولة الإمارات.

المادة 3 — مبادئ استخدام الذكاء الاصطناعي
يجب أن يلتزم استخدام الذكاء الاصطناعي بالمبادئ التالية:
(أ) الشفافية: يجب الإفصاح عن استخدام الذكاء الاصطناعي في اتخاذ القرارات.
(ب) المساءلة: يجب تحديد المسؤولين عن أنظمة الذكاء الاصطناعي.
(ج) العدالة: يجب تجنب التمييز والتحيز في أنظمة الذكاء الاصطناعي.
(د) الأمان: يجب اتخاذ تدابير الحماية اللازمة لضمان أمان أنظمة الذكاء الاصطناعي.
(هـ) الخصوصية: يجب احترام خصوصية البيانات في تطوير واستخدام أنظمة الذكاء الاصطناعي.

المادة 5 — الرقابة الإنسانية
يجب اشتراط الرقابة البشرية الفعّالة على قرارات الذكاء الاصطناعي ذات الأثر الجوهري على حقوق الأشخاص وحرياتهم.

المادة 7 — حق الشرح
للمتأثر بقرار يُتخذ بصورة رئيسية بواسطة نظام ذكاء اصطناعي الحق في الحصول على تفسير مفهوم لآلية اتخاذ ذلك القرار.`,
  },

  {
    collectionId: "cabinet_decisions",
    title: "Cabinet Decision No. 57 of 2022 on the National Policy for Artificial Intelligence",
    titleAr: "قرار مجلس الوزراء رقم 57 لسنة 2022 بشأن السياسة الوطنية للذكاء الاصطناعي",
    authority: "UAE Cabinet of Ministers",
    authorityAr: "مجلس الوزراء الاتحادي",
    documentNumber: "57 of 2022",
    year: 2022,
    jurisdiction: "federal",
    docType: "cabinet_decision",
    effectiveDate: "2022-06-01",
    isRepealed: false,
    isAmended: false,
    keywordsAr: ["السياسة الوطنية", "الذكاء الاصطناعي", "استراتيجية الذكاء الاصطناعي", "التحول الرقمي"],
    keywordsEn: ["national policy", "artificial intelligence", "AI strategy", "digital transformation"],
    fullTextAr: `قرار مجلس الوزراء رقم 57 لسنة 2022 بشأن السياسة الوطنية للذكاء الاصطناعي

يتبنى مجلس الوزراء السياسة الوطنية للذكاء الاصطناعي التي تقوم على ثلاثة محاور:
(أ) تطوير الكفاءات الوطنية في مجال الذكاء الاصطناعي.
(ب) بناء بيئة تنظيمية مواتية لتطوير واستخدام الذكاء الاصطناعي.
(ج) توظيف الذكاء الاصطناعي لتحقيق التنمية المستدامة.

وتُكلف الجهات الحكومية الاتحادية بتضمين تقنيات الذكاء الاصطناعي في خططها الاستراتيجية ووضع آليات للاستفادة منها في تحسين الخدمات الحكومية.`,
  },

  // ─── Ministerial Decisions ─────────────────────────────────────────────────
  {
    collectionId: "ministerial_decisions",
    title: "Ministerial Decision No. 279 of 2022 on Work Permits and Residency Procedures",
    titleAr: "قرار وزاري رقم 279 لسنة 2022 في شأن تصاريح العمل وإجراءات الإقامة",
    authority: "Ministry of Human Resources and Emiratisation",
    authorityAr: "وزارة الموارد البشرية والتوطين",
    documentNumber: "279 of 2022",
    year: 2022,
    jurisdiction: "federal",
    docType: "ministerial_decision",
    effectiveDate: "2022-02-02",
    isRepealed: false,
    isAmended: false,
    keywordsAr: ["تصاريح العمل", "الإقامة", "العمالة الوافدة", "التوطين", "العمالة المنزلية"],
    keywordsEn: ["work permits", "residency", "expatriate labour", "emiratisation", "domestic workers"],
    fullTextAr: `قرار وزاري رقم 279 لسنة 2022 في شأن تصاريح العمل وإجراءات الإقامة

المادة 1 — الشروط العامة
يُشترط لمنح تصريح العمل للعامل الوافد:
(أ) تقديم عقد عمل موقع من صاحب العمل والعامل.
(ب) توافر الاشتراطات الصحية المقررة.
(ج) مطابقة المؤهل العلمي أو المهني للوظيفة المطلوبة.
(د) عدم وجود حظر سفر أو حظر عمل على العامل.

المادة 3 — مدة التصريح
يُمنح تصريح العمل لمدة سنتين قابلة للتجديد.

المادة 7 — التوطين
تلتزم المنشآت التجارية التي تزيد عدد موظفيها على عشرة بتحقيق نسبة التوطين المقررة من قِبل الوزارة.`,
  },
];
