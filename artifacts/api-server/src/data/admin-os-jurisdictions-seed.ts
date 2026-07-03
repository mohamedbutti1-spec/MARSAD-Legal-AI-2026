/**
 * Admin Jurisdictions seed — Al-Shamsi Administrative Decision OS
 *
 * Active:   uae, france
 * Inactive stubs: gcc_sa, gcc_qa, gcc_bh, gcc_kw, gcc_om
 *
 * Adding a GCC jurisdiction later requires only:
 *   1. Setting active = true for the relevant row
 *   2. Completing the prompt module in ai/jurisdictions/<key>.prompt.ts
 *   3. Adding decision type seed data
 */

import type { JurisdictionLaw } from "@workspace/db";

export interface SeedJurisdiction {
  jurisdictionKey: string;
  nameAr: string;
  nameEn: string;
  legalSystem: string;
  primaryLaws: JurisdictionLaw[];
  promptModule: string;
  active: boolean;
}

export const JURISDICTION_SEEDS: SeedJurisdiction[] = [
  // ── UAE (active) ────────────────────────────────────────────────────────────
  {
    jurisdictionKey: "uae",
    nameAr: "الإمارات العربية المتحدة",
    nameEn: "United Arab Emirates",
    legalSystem: "mixed",
    promptModule: "uae",
    active: true,
    primaryLaws: [
      {
        nameAr: "قانون الإجراءات الإدارية الاتحادي",
        nameEn: "Federal Administrative Procedures Law",
        referenceNumber: "Federal Law No. 8/2011",
        effectiveYear: 2011,
      },
      {
        nameAr: "المرسوم بقانون اتحادي في شأن تنظيم علاقات العمل",
        nameEn: "Federal Decree-Law on Labour Relations",
        referenceNumber: "Federal Decree-Law No. 33/2021",
        effectiveYear: 2021,
      },
      {
        nameAr: "مبادئ الذكاء الاصطناعي الأخلاقية",
        nameEn: "UAE AI Ethics Principles",
        referenceNumber: "UAE AI Ethics 2017",
        effectiveYear: 2017,
        url: "https://ai.gov.ae",
      },
    ],
  },

  // ── France (active) ──────────────────────────────────────────────────────────
  {
    jurisdictionKey: "france",
    nameAr: "الجمهورية الفرنسية",
    nameEn: "French Republic",
    legalSystem: "civil",
    promptModule: "france",
    active: true,
    primaryLaws: [
      {
        nameAr: "قانون العلاقات بين الجمهور والإدارة",
        nameEn: "Code des relations entre le public et l'administration (CRPA)",
        referenceNumber: "Ordonnances 2015-1341 & 2015-1342",
        effectiveYear: 2016,
        url: "https://www.legifrance.gouv.fr/codes/id/LEGITEXT000031366350/",
      },
      {
        nameAr: "القانون العام للوظيفة العمومية",
        nameEn: "Code général de la fonction publique (CGFP)",
        referenceNumber: "Loi no 2019-828",
        effectiveYear: 2019,
      },
      {
        nameAr: "قانون الجمهورية الرقمية",
        nameEn: "Loi pour une République numérique",
        referenceNumber: "Loi no 2016-1321",
        effectiveYear: 2016,
        url: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000033202746/",
      },
      {
        nameAr: "اللائحة الأوروبية العامة لحماية البيانات",
        nameEn: "Règlement général sur la protection des données (RGPD)",
        referenceNumber: "EU 2016/679",
        effectiveYear: 2018,
      },
    ],
  },

  // ── GCC Stubs (inactive — framework only) ───────────────────────────────────
  {
    jurisdictionKey: "gcc_sa",
    nameAr: "المملكة العربية السعودية",
    nameEn: "Kingdom of Saudi Arabia",
    legalSystem: "islamic",
    promptModule: "sa",
    active: false,
    primaryLaws: [
      {
        nameAr: "نظام ديوان المظالم",
        nameEn: "Board of Grievances Law",
        referenceNumber: "Royal Decree M/78, 1428H",
        effectiveYear: 2007,
      },
    ],
  },
  {
    jurisdictionKey: "gcc_qa",
    nameAr: "دولة قطر",
    nameEn: "State of Qatar",
    legalSystem: "mixed",
    promptModule: "qa",
    active: false,
    primaryLaws: [
      {
        nameAr: "قانون الإجراءات الإدارية القطري",
        nameEn: "Administrative Procedures Law",
        referenceNumber: "Qatar Law No. 7/2007",
        effectiveYear: 2007,
      },
    ],
  },
  {
    jurisdictionKey: "gcc_bh",
    nameAr: "مملكة البحرين",
    nameEn: "Kingdom of Bahrain",
    legalSystem: "mixed",
    promptModule: "bh",
    active: false,
    primaryLaws: [
      {
        nameAr: "قانون المحاكم الإدارية",
        nameEn: "Administrative Courts Law",
        referenceNumber: "Decree-Law No. 64/2006",
        effectiveYear: 2006,
      },
    ],
  },
  {
    jurisdictionKey: "gcc_kw",
    nameAr: "دولة الكويت",
    nameEn: "State of Kuwait",
    legalSystem: "mixed",
    promptModule: "kw",
    active: false,
    primaryLaws: [
      {
        nameAr: "قانون إنشاء المحكمة الإدارية",
        nameEn: "Administrative Court Establishment Law",
        referenceNumber: "Kuwait Law No. 20/1981",
        effectiveYear: 1981,
      },
    ],
  },
  {
    jurisdictionKey: "gcc_om",
    nameAr: "سلطنة عُمان",
    nameEn: "Sultanate of Oman",
    legalSystem: "mixed",
    promptModule: "om",
    active: false,
    primaryLaws: [
      {
        nameAr: "النظام الأساسي للدولة",
        nameEn: "Basic Law of the State",
        referenceNumber: "Royal Decree No. 6/2021",
        effectiveYear: 2021,
      },
    ],
  },
];
