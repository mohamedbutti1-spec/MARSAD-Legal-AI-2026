/**
 * Phase 53 — UAE Legal Knowledge Base: Collection Registry
 *
 * Defines all 17 indexed collections covering the complete UAE legal hierarchy.
 * Each collection descriptor is the single source of truth for:
 *   - Hierarchy level (maps directly to the Phase 52 reasoning engine levels 1–8)
 *   - Binding status (used by retrieval engine to label results correctly)
 *   - Default metadata for documents that don't override individual fields
 *
 * These objects are STATIC — no DB table needed.
 * The pipeline uses collectionId to set hierarchyLevel and bindingStatus automatically.
 */

import type { KbCollection, KbCollectionId } from "./types.js";

// ─── All 17 collections ───────────────────────────────────────────────────────

const COLLECTIONS: Record<KbCollectionId, KbCollection> = {

  // ── Level 1 — Constitutional ────────────────────────────────────────────────

  uae_constitution: {
    id: "uae_constitution",
    nameEn: "UAE Constitution",
    nameAr: "الدستور الاتحادي لدولة الإمارات العربية المتحدة",
    hierarchyLevel: "1",
    bindingStatus: "constitutional",
    defaultDocType: "constitution",
    jurisdiction: "federal",
    authorityEn: "Federal National Council / Constituent Assembly",
    authorityAr: "المجلس الوطني الاتحادي / الجمعية التأسيسية",
    description:
      "The supreme law of the UAE. All legislation must conform to it. " +
      "Permanent Constitution of 1971 with subsequent amendments.",
  },

  constitutional_judgments: {
    id: "constitutional_judgments",
    nameEn: "Constitutional Judgments",
    nameAr: "الأحكام الدستورية",
    hierarchyLevel: "1",
    bindingStatus: "constitutional",
    defaultDocType: "judgment",
    jurisdiction: "federal",
    authorityEn: "Federal Supreme Court — Constitutional Chamber",
    authorityAr: "المحكمة الاتحادية العليا — الدائرة الدستورية",
    description:
      "Judgments of the Federal Supreme Court exercising constitutional jurisdiction. " +
      "Binding on all state authorities; interpret and apply the UAE Constitution.",
  },

  // ── Level 2–3 — Primary Legislation ────────────────────────────────────────

  federal_laws: {
    id: "federal_laws",
    nameEn: "Federal Laws",
    nameAr: "القوانين الاتحادية",
    hierarchyLevel: "2",
    bindingStatus: "binding",
    defaultDocType: "law",
    jurisdiction: "federal",
    authorityEn: "UAE Federal National Council / President",
    authorityAr: "المجلس الوطني الاتحادي / رئيس الدولة",
    description:
      "Laws enacted through the standard federal legislative process. " +
      "Approved by the Federal National Council and ratified by the President.",
  },

  federal_decree_laws: {
    id: "federal_decree_laws",
    nameEn: "Federal Decree-Laws",
    nameAr: "المراسيم بقوانين الاتحادية",
    hierarchyLevel: "2",
    bindingStatus: "binding",
    defaultDocType: "decree_law",
    jurisdiction: "federal",
    authorityEn: "President of the UAE",
    authorityAr: "رئيس الدولة",
    description:
      "Laws enacted by presidential decree, having full force of primary legislation. " +
      "Used extensively since 2021; equivalent to Federal Laws in hierarchy.",
  },

  official_gazette: {
    id: "official_gazette",
    nameEn: "Official Gazette",
    nameAr: "الجريدة الرسمية",
    hierarchyLevel: "2",
    bindingStatus: "informational",
    defaultDocType: "gazette_notice",
    jurisdiction: "federal",
    authorityEn: "UAE Ministry of Justice — Official Gazette Office",
    authorityAr: "وزارة العدل — إدارة الجريدة الرسمية",
    description:
      "Official publication of record for all federal laws, decrees, and official notices. " +
      "Primary source for enactment dates and official text.",
  },

  // ── Level 4 — Executive / Regulatory ───────────────────────────────────────

  executive_regulations: {
    id: "executive_regulations",
    nameEn: "Executive Regulations",
    nameAr: "اللوائح التنفيذية",
    hierarchyLevel: "4",
    bindingStatus: "binding",
    defaultDocType: "regulation",
    jurisdiction: "federal",
    authorityEn: "UAE Cabinet / Competent Ministry",
    authorityAr: "مجلس الوزراء / الوزارة المختصة",
    description:
      "Regulations that operationalise federal laws. Issued by the Cabinet or a designated " +
      "ministry. Binding but subordinate to the law they implement.",
  },

  cabinet_decisions: {
    id: "cabinet_decisions",
    nameEn: "Cabinet Decisions",
    nameAr: "قرارات مجلس الوزراء",
    hierarchyLevel: "4",
    bindingStatus: "binding",
    defaultDocType: "cabinet_decision",
    jurisdiction: "federal",
    authorityEn: "UAE Cabinet of Ministers",
    authorityAr: "مجلس الوزراء الاتحادي",
    description:
      "Decisions issued by the UAE Cabinet. Binding on all federal entities. " +
      "May establish policy, amend regulations, or create subsidiary bodies.",
  },

  // ── Level 5 — Ministerial ───────────────────────────────────────────────────

  ministerial_decisions: {
    id: "ministerial_decisions",
    nameEn: "Ministerial Decisions",
    nameAr: "القرارات الوزارية",
    hierarchyLevel: "5",
    bindingStatus: "binding",
    defaultDocType: "ministerial_decision",
    jurisdiction: "federal",
    authorityEn: "Competent Federal Ministry",
    authorityAr: "الوزارة الاتحادية المختصة",
    description:
      "Decisions issued by individual ministers within their portfolios. " +
      "Binding on regulated entities; subordinate to Cabinet Decisions and Executive Regulations.",
  },

  // ── Level 6 — Administrative / Guidance ────────────────────────────────────

  circulars: {
    id: "circulars",
    nameEn: "Official Circulars",
    nameAr: "التعاميم الرسمية",
    hierarchyLevel: "6",
    bindingStatus: "advisory",
    defaultDocType: "circular",
    jurisdiction: "federal",
    authorityEn: "Federal Ministries and Government Entities",
    authorityAr: "الوزارات والجهات الحكومية الاتحادية",
    description:
      "Administrative circulars directing internal government conduct. " +
      "Advisory in nature unless issued pursuant to a binding legal instrument.",
  },

  explanatory_memoranda: {
    id: "explanatory_memoranda",
    nameEn: "Official Explanatory Memoranda",
    nameAr: "المذكرات الإيضاحية الرسمية",
    hierarchyLevel: "6",
    bindingStatus: "advisory",
    defaultDocType: "explanatory_memorandum",
    jurisdiction: "federal",
    authorityEn: "UAE Ministry of Justice / Legislative Affairs",
    authorityAr: "وزارة العدل / الشؤون التشريعية",
    description:
      "Official explanatory notes accompanying legislation. Non-binding but authoritative " +
      "for legislative intent; admissible as interpretive aid in UAE courts.",
  },

  official_guidance: {
    id: "official_guidance",
    nameEn: "Official Government Guidance",
    nameAr: "الإرشادات الحكومية الرسمية",
    hierarchyLevel: "6",
    bindingStatus: "advisory",
    defaultDocType: "guidance",
    jurisdiction: "multi",
    authorityEn: "Federal and Local Government Entities",
    authorityAr: "الجهات الحكومية الاتحادية والمحلية",
    description:
      "Non-binding official guidance documents, practice notes, and regulatory interpretations " +
      "issued by government bodies to assist compliance.",
  },

  // ── Level 7a — Federal Supreme Court ───────────────────────────────────────

  uae_supreme_court: {
    id: "uae_supreme_court",
    nameEn: "UAE Supreme Court (Civil / Criminal)",
    nameAr: "المحكمة الاتحادية العليا — الدوائر المدنية والجزائية",
    hierarchyLevel: "7a",
    bindingStatus: "binding",
    defaultDocType: "judgment",
    jurisdiction: "federal",
    authorityEn: "UAE Federal Supreme Court",
    authorityAr: "المحكمة الاتحادية العليا",
    description:
      "Civil, criminal, commercial, and personal status judgments of the Federal Supreme Court. " +
      "Binding on all lower federal courts; strongest precedential weight.",
  },

  federal_supreme_court: {
    id: "federal_supreme_court",
    nameEn: "Federal Supreme Court (Administrative / Public Law)",
    nameAr: "المحكمة الاتحادية العليا — القضاء الإداري",
    hierarchyLevel: "7a",
    bindingStatus: "binding",
    defaultDocType: "judgment",
    jurisdiction: "federal",
    authorityEn: "UAE Federal Supreme Court — Administrative Chamber",
    authorityAr: "المحكمة الاتحادية العليا — الدائرة الإدارية",
    description:
      "Administrative law and public law judgments of the Federal Supreme Court. " +
      "Controls legality of federal government decisions; annulment and liability.",
  },

  // ── Level 7b — Federal Appeals ─────────────────────────────────────────────

  federal_admin_judiciary: {
    id: "federal_admin_judiciary",
    nameEn: "Federal Administrative Judiciary",
    nameAr: "القضاء الإداري الاتحادي",
    hierarchyLevel: "7b",
    bindingStatus: "binding",
    defaultDocType: "judgment",
    jurisdiction: "federal",
    authorityEn: "Federal Administrative Courts (First Instance and Appeal)",
    authorityAr: "المحاكم الإدارية الاتحادية — الدرجة الأولى والاستئناف",
    description:
      "First instance and appellate administrative court judgments at the federal level. " +
      "Reviews federal administrative decisions; subordinate to the Federal Supreme Court.",
  },

  // ── Level 7c — Emirate-Level Courts ────────────────────────────────────────

  abu_dhabi_courts: {
    id: "abu_dhabi_courts",
    nameEn: "Abu Dhabi Courts",
    nameAr: "محاكم أبوظبي",
    hierarchyLevel: "7c",
    bindingStatus: "binding",
    defaultDocType: "judgment",
    jurisdiction: "abu_dhabi",
    authorityEn: "Abu Dhabi Judicial Department",
    authorityAr: "دائرة القضاء أبوظبي",
    description:
      "Judgments of Abu Dhabi courts (Court of First Instance, Court of Appeal, " +
      "Court of Cassation). Binding within Abu Dhabi; persuasive in other emirates.",
  },

  dubai_courts: {
    id: "dubai_courts",
    nameEn: "Dubai Courts",
    nameAr: "محاكم دبي",
    hierarchyLevel: "7c",
    bindingStatus: "binding",
    defaultDocType: "judgment",
    jurisdiction: "dubai",
    authorityEn: "Dubai Courts",
    authorityAr: "محاكم دبي",
    description:
      "Judgments of Dubai courts (Court of First Instance, Court of Appeal, " +
      "Court of Cassation). Binding within Dubai; persuasive in other emirates.",
  },

  rak_courts: {
    id: "rak_courts",
    nameEn: "Ras Al Khaimah Courts",
    nameAr: "محاكم رأس الخيمة",
    hierarchyLevel: "7c",
    bindingStatus: "binding",
    defaultDocType: "judgment",
    jurisdiction: "rak",
    authorityEn: "Ras Al Khaimah Judicial Department",
    authorityAr: "دائرة القضاء في رأس الخيمة",
    description:
      "Judgments of Ras Al Khaimah courts. Binding within RAK; " +
      "persuasive in other emirates. Includes RAKICC commercial disputes.",
  },
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Return the collection descriptor for a given collection ID. */
export function getCollection(id: KbCollectionId): KbCollection {
  const col = COLLECTIONS[id];
  if (!col) throw new Error(`Unknown KB collection: ${id}`);
  return col;
}

/** Return all 17 collection descriptors as an ordered array. */
export function getAllCollections(): KbCollection[] {
  return Object.values(COLLECTIONS);
}

/** Return all collection IDs at a given hierarchy level. */
export function getCollectionsByLevel(level: string): KbCollection[] {
  return getAllCollections().filter((c) => c.hierarchyLevel === level);
}

/** Return all collection IDs for a given jurisdiction. */
export function getCollectionsByJurisdiction(jurisdiction: string): KbCollection[] {
  return getAllCollections().filter(
    (c) => c.jurisdiction === jurisdiction || c.jurisdiction === "multi",
  );
}

/** Return all case-law collections (hierarchy levels 7a, 7b, 7c). */
export function getCaseLawCollections(): KbCollection[] {
  return getAllCollections().filter((c) =>
    ["7a", "7b", "7c"].includes(c.hierarchyLevel),
  );
}

/** Return all legislation collections (hierarchy levels 1–6). */
export function getLegislationCollections(): KbCollection[] {
  return getAllCollections().filter((c) =>
    ["1", "2", "3", "4", "5", "6"].includes(c.hierarchyLevel),
  );
}

export { COLLECTIONS };
