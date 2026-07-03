/**
 * UAE Jurisdiction Plugin — Al-Shamsi Administrative Decision OS
 *
 * Legal framework: UAE Federal administrative law
 * Primary legislation: Federal Law No. 8/2011 (Administrative Procedures),
 *   Federal Decree-Law No. 33/2021 (Human Resources), UAE AI Ethics Principles
 */

import type { JurisdictionPlugin, JurisdictionPluginParams } from "./index";

const uaePlugin: JurisdictionPlugin = {
  jurisdictionKey: "uae",
  nameAr: "الإمارات العربية المتحدة",
  nameEn: "United Arab Emirates",
  legalSystem: "mixed", // civil law base + Islamic law + UAE federal statutes
  active: true,

  buildJurisdictionContext(params: JurisdictionPluginParams): string {
    const { applicableLaws } = params;

    const lawsList = applicableLaws
      .map((l) => `• ${l.lawAr} (${l.referenceNumber})`)
      .join("\n");

    return `النظام القانوني: القانون الإداري الإماراتي (نظام مختلط — قانون مدني + شريعة إسلامية + تشريعات فيدرالية)

المرجعية التشريعية الأساسية:
• قانون الإجراءات الإدارية الاتحادي رقم 8 لسنة 2011
• المرسوم بقانون اتحادي رقم 33 لسنة 2021 في شأن تنظيم علاقات العمل
• مبادئ الذكاء الاصطناعي الأخلاقية في الإمارات (2017)
• القانون الاتحادي رقم 5 لسنة 2012 في شأن مكافحة جرائم تقنية المعلومات
${lawsList ? `\nالقوانين المنطبقة على هذا القرار:\n${lawsList}` : ""}

إطار نظرية الشمسي في النظام الإماراتي:
1. الاختصاص: يجب أن يستند إلى نص قانوني صريح أو تفويض رسمي موثق
2. الشكل: الكتابة + التوقيع + التسبيب (للقرارات الماسّة بالحقوق) + التبليغ الرسمي
3. السبب: واقعة ثابتة + أساس قانوني سليم + تناسب مع الحالة
4. المحل: مشروع + ممكن + محدد + لا يخالف النظام العام والآداب
5. الغاية: المصلحة العامة + غياب الانحراف بالسلطة (détournement de pouvoir)
6. الإرادة الإنسانية: حرية الإرادة + انعدام الغلط والإكراه والتدليس
7. تكوين الإرادة الرقمية: اعتماد الأنظمة الرقمية رسمياً + صحة التوقيع الإلكتروني
8. الوزن الخوارزمي: لا يتجاوز دور التوصية — القرار النهائي إنساني
9. التحيز الخوارزمي: خضوع النظام لاختبارات عدالة دورية + إفصاح عن التحيزات
10. قابلية التفسير: إمكان شرح القرار للمتأثر بلغة واضحة ومفهومة
11. الرقابة البشرية: آليات تدقيق + مراجعة داخلية + رقابة الديوان المحاسبة
12. الجاهزية القضائية: ملف تقني مكتمل + تسبيب واضح + احترام الآجال

مبادئ قضائية محكمة اتحادية إماراتية:
• مبدأ المشروعية: تقييد الإدارة بحدود القانون
• مبدأ التناسب: القرار متناسب مع خطورة المخالفة أو الحاجة
• مبدأ الشفافية: الإدارة ملزمة بإعلام المواطن بالإجراءات`;
  },
};

export default uaePlugin;
