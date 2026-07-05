/**
 * Phase 54 — UAE Legal Knowledge Base: Official Gazette Seed
 *
 * Key Official Gazette issues that contain landmark legislation.
 * These serve as the primary source of record for enactment dates.
 * Source: UAE Ministry of Justice / Official Gazette archive
 */

import type { KbDocumentInput } from "../../types.js";

export const OFFICIAL_GAZETTE_SEED: KbDocumentInput[] = [
  {
    collectionId: "official_gazette",
    title: "UAE Official Gazette Issue 726 — November 2021 (Major Legislative Reform Package)",
    titleAr: "الجريدة الرسمية لدولة الإمارات العربية المتحدة — العدد 726 — نوفمبر 2021",
    authority: "UAE Ministry of Justice — Official Gazette Office",
    authorityAr: "وزارة العدل — إدارة الجريدة الرسمية",
    documentNumber: "Issue 726",
    year: 2021,
    jurisdiction: "federal",
    docType: "gazette_notice",
    effectiveDate: "2021-11-15",
    isRepealed: false,
    isAmended: false,
    officialGazetteRef: "UAE Official Gazette Issue 726",
    keywordsAr: ["الجريدة الرسمية", "العدد 726", "التشريعات", "حزمة التشريعات 2021", "مرسوم بقانون"],
    keywordsEn: ["official gazette", "issue 726", "legislation", "2021 legislative package", "decree-law"],
    fullTextAr: `الجريدة الرسمية لدولة الإمارات العربية المتحدة
العدد 726 — نوفمبر 2021

التشريعات الصادرة في هذا العدد:

1. مرسوم بقانون اتحادي رقم 32 لسنة 2021 في شأن الشركات التجارية
   (يُلغي القانون الاتحادي رقم 2 لسنة 2015)

2. مرسوم بقانون اتحادي رقم 33 لسنة 2021 في شأن تنظيم علاقات العمل
   (يُلغي القانون الاتحادي رقم 8 لسنة 1980)

3. مرسوم بقانون اتحادي رقم 34 لسنة 2021 في شأن مكافحة الشائعات والجرائم المعلوماتية
   (يُلغي القانون الاتحادي رقم 5 لسنة 2012)

4. مرسوم بقانون اتحادي رقم 35 لسنة 2021 في شأن مكافحة التمييز والكراهية

5. مرسوم بقانون اتحادي رقم 45 لسنة 2021 بشأن حماية البيانات الشخصية

ملاحظة: جميع المراسيم بقوانين المذكورة تدخل حيز التنفيذ اعتباراً من 2 يناير 2022.

هذا العدد من الجريدة الرسمية يُعدّ المرجع الأصيل لتواريخ الإصدار والنفاذ.`,
  },
  {
    collectionId: "official_gazette",
    title: "UAE Official Gazette Issue 752 — November 2022 (Federal Decree-Law 49/2022 — HR Reform)",
    titleAr: "الجريدة الرسمية لدولة الإمارات العربية المتحدة — العدد 752 — نوفمبر 2022",
    authority: "UAE Ministry of Justice — Official Gazette Office",
    authorityAr: "وزارة العدل — إدارة الجريدة الرسمية",
    documentNumber: "Issue 752",
    year: 2022,
    jurisdiction: "federal",
    docType: "gazette_notice",
    effectiveDate: "2022-11-15",
    isRepealed: false,
    isAmended: false,
    officialGazetteRef: "UAE Official Gazette Issue 752",
    keywordsAr: ["الجريدة الرسمية", "العدد 752", "الموارد البشرية", "الخدمة المدنية"],
    keywordsEn: ["official gazette", "issue 752", "human resources", "civil service"],
    fullTextAr: `الجريدة الرسمية لدولة الإمارات العربية المتحدة
العدد 752 — نوفمبر 2022

التشريعات الصادرة في هذا العدد:

1. مرسوم بقانون اتحادي رقم 49 لسنة 2022 في شأن الموارد البشرية في الحكومة الاتحادية
   (يُلغي القانون الاتحادي رقم 11 لسنة 2008)
   يسري اعتباراً من 1 فبراير 2023.

2. مرسوم بقانون اتحادي رقم 50 لسنة 2022 في شأن مكافحة الرشوة
   يسري اعتباراً من 1 يناير 2023.

هذا العدد من الجريدة الرسمية يُعدّ المرجع الأصيل لتواريخ الإصدار والنفاذ.`,
  },
];
