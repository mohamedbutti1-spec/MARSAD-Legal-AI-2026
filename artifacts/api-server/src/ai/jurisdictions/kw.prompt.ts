/**
 * Kuwait (GCC) Jurisdiction Plugin — STUB
 *
 * TODO: Complete this plugin with Kuwaiti administrative law framework:
 *   - قانون إنشاء المحكمة الإدارية الكويتية رقم 20 لسنة 1981
 *   - قانون الخدمة المدنية رقم 15 لسنة 1979 وتعديلاته
 *   - قانون المعاملات الإلكترونية رقم 20 لسنة 2014
 *   - مرسوم بقانون رقم 68 لسنة 1980 (قانون المرافعات المدنية والتجارية)
 *   - اختصاص المحكمة الإدارية في مراجعة القرارات الإدارية
 *   - رؤية الكويت 2035 وإصلاحات الخدمة المدنية
 */

import type { JurisdictionPlugin, JurisdictionPluginParams } from "./index";

const kwPlugin: JurisdictionPlugin = {
  jurisdictionKey: "gcc_kw",
  nameAr: "دولة الكويت",
  nameEn: "State of Kuwait",
  legalSystem: "mixed", // civil law + Islamic law
  active: false, // TODO: activate when legal context is complete

  buildJurisdictionContext(_params: JurisdictionPluginParams): string {
    // TODO: complete for gcc_kw jurisdiction
    // Reference: المحكمة الإدارية الكويتية وقانون الخدمة المدنية
    return `[STUB] Kuwait jurisdiction context — not yet implemented.
هذه الوحدة في طور الإعداد. يرجى استكمال الإطار القانوني الكويتي.`;
  },
};

export default kwPlugin;
