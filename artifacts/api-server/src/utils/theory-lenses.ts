/**
 * Theory Lenses — named analytical overlays for the AI Legal Assistant.
 *
 * Each lens describes an analytical framework that can be applied alongside
 * (never instead of) binding UAE authority. Adding a new lens only requires
 * adding an entry to THEORY_LENSES — no backend schema changes.
 *
 * Usage in routes:
 *   import { THEORY_LENSES, buildTheoryPromptSuffix } from "../utils/theory-lenses.js";
 */

export interface TheoryLens {
  /** Stable, URL-safe identifier */
  id: string;
  nameAr: string;
  nameEn: string;
  /**
   * How to classify authority citations produced by this lens.
   * Used by the frontend to apply the correct badge style.
   */
  authorityClass: 'binding_only' | 'theory' | 'comparative_persuasive' | 'custom';
  /**
   * System-prompt text appended when this lens is active.
   * Empty string for 'uae_only' (no overlay).
   * For 'custom' lenses the suffix is generated dynamically via buildTheoryPromptSuffix().
   */
  promptSuffix: string;
  /**
   * Label embedded in the separator the model emits to divide the two sections.
   * Format: ---THEORY LENS: {markerLabel}---
   * Empty for 'uae_only'.
   */
  markerLabel: string;
}

// ─── Al-Shamsi 12-dimension prompt suffix ────────────────────────────────────

const SHAMSI_SUFFIX = `
═══════════════════════════════════════════════════════════════════
تعليمات نظرية الشامسي — إلزامية في هذه الجلسة
═══════════════════════════════════════════════════════════════════
بعد إكمال التحليل القانوني الإماراتي الملزم أعلاه، أضف قسماً منفصلاً يبدأ بالعلامة التالية على سطر مستقل:

---THEORY LENS: Al-Shamsi---

ثم قدّم **تحليل نظرية الشامسي** وفق الأبعاد الاثني عشر:
١. الاختصاص — صلاحية الجهة في حدود اختصاصها القانوني.
٢. السبب — الوقائع الثابتة التي تبرر القرار.
٣. الشكل — الشكليات الإجرائية المطلوبة.
٤. الإجراءات — المسار الإجرائي قبل وأثناء وبعد القرار.
٥. المحل — الأثر القانوني المباشر للقرار.
٦. الغاية — الهدف المشروع وانتفاء الانحراف.
٧. المشروعية الرقمية — الامتثال للمعايير الأخلاقية للذكاء الاصطناعي.
٨. الأثر القانوني — التناسب مع حجم التدخل الإداري.
٩. الإرادة الإدارية — قياس الإرادة البشرية مقابل الإرادة الرقمية.
١٠. الحماية القانونية — ضمانات حقوق الأشخاص المتأثرين.
١١. الرقابة القضائية — قابلية القرار للطعن القضائي.
١٢. الامتثال التشريعي — التوافق مع المنظومة التشريعية.

قواعد ملزمة للقسم النظري:
• صنّف كل نقطة صراحةً: [نظرية — غير ملزمة]
• لا تناقض ولا تلغِ أي حكم من الأحكام الإماراتية الملزمة السابقة.
• حيث يتعارض القانون الإماراتي الملزم مع ما تستخلصه النظرية، صرّح: "القانون الإماراتي يتقدم — النظرية تُبقي ملاحظتها الأكاديمية."
• النظرية تعليقية وأكاديمية؛ لا توصيات تشغيلية دون سند قانوني ملزم.
`;

// ─── French Admin Law comparative suffix ─────────────────────────────────────

const FRENCH_ADMIN_SUFFIX = `
═══════════════════════════════════════════════════════════════════
تعليمات التحليل المقارن — القانون الإداري الفرنسي (إلزامية في هذه الجلسة)
═══════════════════════════════════════════════════════════════════
بعد إكمال التحليل القانوني الإماراتي الملزم أعلاه، أضف قسماً منفصلاً يبدأ بالعلامة التالية على سطر مستقل:

---THEORY LENS: Comparative – French Admin Law---

ثم قدّم **التحليل المقارن وفق القانون الإداري الفرنسي**:
• مبادئ مجلس الدولة الفرنسي (Conseil d'État) ذات الصلة.
• أعمدة القانون الإداري الفرنسي: الاختصاص (compétence)، الإجراء (procédure)، القانون (légalité)، الهدف (but).
• نظرية الانحراف في السلطة (détournement de pouvoir).
• مبدأ التناسب وفق الاجتهاد الفرنسي والأوروبي.
• أي حكم قضائي فرنسي أو مبدأ أكاديمي ذي صلة.

قواعد ملزمة للقسم المقارن:
• صنّف كل نقطة صراحةً: [مقارن — مقنع غير ملزم في الإمارات]
• لا تناقض ولا تلغِ أي حكم من الأحكام الإماراتية الملزمة السابقة.
• حيث يتعارض التوجه الفرنسي مع القانون الإماراتي، صرّح صراحةً: "القانون الإماراتي يتقدم؛ الموقف الفرنسي يُسجَّل كسلطة مقنعة فحسب."
• لا تُعطِ أي حكم فرنسي أو أوروبي صفة الإلزام في الدولة الإماراتية.
`;

// ─── THEORY_LENSES registry ───────────────────────────────────────────────────

export const THEORY_LENSES: TheoryLens[] = [
  {
    id: 'uae_only',
    nameAr: 'القانون الإماراتي فقط',
    nameEn: 'UAE Law Only',
    authorityClass: 'binding_only',
    promptSuffix: '',
    markerLabel: '',
  },
  {
    id: 'shamsi',
    nameAr: 'نظرية الشامسي',
    nameEn: 'Al-Shamsi Theory',
    authorityClass: 'theory',
    promptSuffix: SHAMSI_SUFFIX,
    markerLabel: 'Al-Shamsi',
  },
  {
    id: 'french_admin',
    nameAr: 'القانون الإداري الفرنسي',
    nameEn: 'Comparative (French Admin Law)',
    authorityClass: 'comparative_persuasive',
    promptSuffix: FRENCH_ADMIN_SUFFIX,
    markerLabel: 'Comparative – French Admin Law',
  },
  {
    id: 'custom',
    nameAr: 'نظرية مخصصة',
    nameEn: 'Custom Theory',
    authorityClass: 'custom',
    promptSuffix: '', // generated dynamically — see buildTheoryPromptSuffix()
    markerLabel: 'Custom Theory',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Look up a lens by id; returns undefined when not found. */
export function findLens(id: string): TheoryLens | undefined {
  return THEORY_LENSES.find((l) => l.id === id);
}

/**
 * Build the full prompt suffix for an active theory lens.
 * For 'custom' lenses, inlines the user's theory description.
 * Returns empty string when id is 'uae_only' or unknown.
 */
export function buildTheoryPromptSuffix(
  lensId: string,
  customTheoryText?: string,
): { suffix: string; markerLabel: string } {
  const lens = findLens(lensId);
  if (!lens || lens.id === 'uae_only') return { suffix: '', markerLabel: '' };

  if (lens.id === 'custom') {
    const desc = (customTheoryText ?? '').trim();
    if (!desc) return { suffix: '', markerLabel: '' };

    const suffix = `
═══════════════════════════════════════════════════════════════════
تعليمات النظرية المخصصة — إلزامية في هذه الجلسة
═══════════════════════════════════════════════════════════════════
بعد إكمال التحليل القانوني الإماراتي الملزم أعلاه، أضف قسماً منفصلاً يبدأ بالعلامة التالية على سطر مستقل:

---THEORY LENS: Custom Theory---

ثم طبّق **الإطار النظري التالي** الذي حدّده المستخدم:
${desc}

قواعد ملزمة للقسم النظري:
• صنّف كل نقطة صراحةً: [نظري — غير ملزم]
• لا تناقض ولا تلغِ أي حكم من الأحكام الإماراتية الملزمة السابقة.
• حيث يتعارض هذا الإطار النظري مع القانون الإماراتي الملزم، صرّح: "القانون الإماراتي يتقدم."
`;
    return { suffix, markerLabel: 'Custom Theory' };
  }

  return { suffix: lens.promptSuffix, markerLabel: lens.markerLabel };
}

/**
 * Parse an AI response that may contain a theory section marker.
 * Returns { bindingAnalysis, theoryAnalysis, theoryLabel } where theoryAnalysis
 * is undefined when no marker was found (UAE-only mode).
 */
export function parseTheoryResponse(text: string): {
  bindingAnalysis: string;
  theoryAnalysis?: string;
  theoryLabel?: string;
} {
  // Marker format: ---THEORY LENS: {label}---
  const markerRe = /^---THEORY LENS:\s*(.+?)---$/m;
  const match = markerRe.exec(text);
  if (!match) {
    return { bindingAnalysis: text.trim() };
  }

  const markerIndex = match.index;
  const theoryLabel = match[1].trim();

  const bindingAnalysis = text.slice(0, markerIndex).trim();
  const theoryAnalysis  = text.slice(markerIndex + match[0].length).trim();

  return { bindingAnalysis, theoryAnalysis, theoryLabel };
}

/**
 * Every identifier, across every module, that refers to the Al-Shamsi Theory
 * lens. Two independent id namespaces exist in this codebase — the chat/JDC
 * theory-lens-selector uses 'shamsi', while the JRE/JDC session-creation
 * forms (types/jre.ts THEORY_LENS_OPTIONS) use 'al_shamsi' — so both must be
 * checked here or a request through the other namespace bypasses the lock.
 */
const SHAMSI_LENS_IDS = new Set(["shamsi", "al_shamsi"]);

/**
 * sanitizeTheoryLensId — Al-Shamsi Theory is owner-only. Any request for a
 * Shamsi lens id (see SHAMSI_LENS_IDS) coming from a non-owner role (or with
 * the framework disabled) is silently downgraded to 'uae_only' server-side,
 * regardless of what the frontend sent — this is the defense-in-depth
 * backstop for the general chat/JRE/JDC endpoints, which cannot be gated
 * wholesale like admin-os/court. Callers that use a different "no lens"
 * sentinel (e.g. JRE/JDC's null/'') already normalize 'uae_only' back to
 * their own neutral value.
 */
export function sanitizeTheoryLensId(
  lensId: string | null | undefined,
  role: string | undefined,
  shamsiEnabled: boolean,
): string {
  const id = (lensId ?? "uae_only").trim() || "uae_only";
  if (SHAMSI_LENS_IDS.has(id) && (!shamsiEnabled || role !== "owner")) {
    return "uae_only";
  }
  return id;
}
