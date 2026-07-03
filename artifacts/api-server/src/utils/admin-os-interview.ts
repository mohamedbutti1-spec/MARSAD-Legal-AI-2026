/**
 * Al-Shamsi Role-Aware Interview Template Engine — Phase 2
 *
 * Merges a base interview template (from admin_decision_types.interviewTemplate)
 * with role-specific modifiers (from admin_decision_roles.interviewModifiers)
 * to produce a flat, ordered, role-adapted list of question nodes.
 *
 * Merge order:
 *   1. prependQuestions (role-specific questions shown first)
 *   2. base template with:
 *      a. removeQuestions applied (excluded IDs filtered out)
 *      b. overrides applied (text/required overridden per role)
 *   3. appendQuestions (role-specific questions shown last)
 */

import type { InterviewQuestionNode } from "@workspace/db";
import type { InterviewModifiers, RoleActionCapabilities } from "@workspace/db";

// ─── Role relationship helper ───────────────────────────────────────────────────

/**
 * Returns the relationship between a role and a specific decision type.
 * Used to annotate GET /admin-os/decision-types responses.
 */
export type RoleRelationship = "can_issue" | "can_review" | "can_challenge" | "none";

/**
 * Competence level hierarchy for issuance authority.
 * Higher index = more authority; a role can issue decisions at or below its ceiling.
 * Roles with special ceilings (review_only, judicial_review, challenge_only) bypass
 * this table — they have fixed global relationships regardless of domain or level.
 */
const COMPETENCE_HIERARCHY: Record<string, number> = {
  ministerial:      5,
  director_general: 4,
  department_head:  3,
  hr_officer:       2,
  any:              1,
};


/**
 * Determines the role's relationship to a given decision type.
 *
 * Logic:
 *  1. review_only / judicial_review ceilings → can_review globally.
 *     These roles (Administrative Court, Legal Dept) can review any decision
 *     regardless of domain — their mandate is jurisdiction-wide oversight.
 *  2. challenge_only ceiling → can_challenge globally.
 *     A Citizen can challenge any administrative decision that affects them.
 *  3. For issuance roles: check domain + competence hierarchy.
 *     - Decision domain must be in permittedDomains (or "all").
 *     - Role's competenceCeiling level must be ≥ decision's requiredCompetenceLevel.
 *     - Both conditions → can_issue; otherwise → none.
 *
 * Note: the global behavior for challenge_only/judicial_review is intentional —
 * these roles are not domain-scoped by UAE Administrative Procedures Law.
 */
export function getRoleRelationship(params: {
  roleKey: string;
  competenceCeiling: string;
  permittedDomains: string[];
  actionCapabilities: RoleActionCapabilities;
  decisionDomain: string;
  requiredCompetenceLevel: string;
}): RoleRelationship {
  const {
    competenceCeiling,
    permittedDomains,
    actionCapabilities,
    decisionDomain,
    requiredCompetenceLevel,
  } = params;

  // ── Special global-relationship ceilings ───────────────────────────────────
  // Administrative Court and Legal Department: review any decision (global)
  if (competenceCeiling === "review_only" || competenceCeiling === "judicial_review") {
    return "can_review";
  }
  // Citizen: challenge any decision that affects them (global)
  if (competenceCeiling === "challenge_only") {
    return "can_challenge";
  }

  // ── Domain + competence gate for issuance roles ───────────────────────────
  // Step 1: domain must be in permitted list
  const domainAllowed =
    permittedDomains.includes("all") || permittedDomains.includes(decisionDomain);
  if (!domainAllowed) return "none";

  // Step 2: competence ceiling must meet or exceed required level
  const roleLevel     = COMPETENCE_HIERARCHY[competenceCeiling] ?? 0;
  const requiredLevel = COMPETENCE_HIERARCHY[requiredCompetenceLevel] ?? 1;

  if (actionCapabilities.canIssue && roleLevel >= requiredLevel) {
    return "can_issue";
  }

  return "none";
}

// ─── Template merging ───────────────────────────────────────────────────────────

/**
 * Merges a base interview template with role-specific modifiers.
 *
 * @param baseTemplate   The decision type's base question list (from DB)
 * @param modifiers      The role's interview modifiers (from DB)
 * @returns              The merged, ordered question list ready for the frontend
 */
export function buildInterviewTemplate(
  baseTemplate: InterviewQuestionNode[],
  modifiers: InterviewModifiers,
): InterviewQuestionNode[] {
  const removeSet = new Set(modifiers.removeQuestions ?? []);

  // Apply removes + overrides to base template
  const processedBase: InterviewQuestionNode[] = [];
  for (const q of baseTemplate) {
    if (removeSet.has(q.id)) continue;

    const override = modifiers.overrides?.find((o) => o.questionId === q.id);
    if (override) {
      processedBase.push({
        ...q,
        ...(override.questionAr !== undefined ? { questionAr: override.questionAr } : {}),
        ...(override.questionEn !== undefined ? { questionEn: override.questionEn } : {}),
        ...(override.hintAr !== undefined ? { hintAr: override.hintAr } : {}),
        ...(override.required !== undefined ? { required: override.required } : {}),
      });
    } else {
      processedBase.push(q);
    }
  }

  return [
    ...(modifiers.prependQuestions ?? []),
    ...processedBase,
    ...(modifiers.appendQuestions ?? []),
  ];
}

// ─── Role label helpers ─────────────────────────────────────────────────────────

export const ROLE_LABELS_AR: Record<string, string> = {
  government_official: "مسؤول حكومي",
  minister:            "وزير",
  director_general:    "مدير عام",
  hr:                  "قسم الموارد البشرية",
  legal_department:    "الإدارة القانونية",
  administrative_court: "محكمة إدارية",
  citizen:             "مواطن / مقيم",
};

export const ROLE_LABELS_EN: Record<string, string> = {
  government_official:  "Government Official",
  minister:             "Minister",
  director_general:     "Director General",
  hr:                   "HR Department",
  legal_department:     "Legal Department",
  administrative_court: "Administrative Court",
  citizen:              "Citizen / Resident",
};

/**
 * Returns a short description of the role's involvement type for the AI prompt.
 * This is injected into the evaluator system prompt to shift analysis framing.
 */
export function getRoleInvolvementContext(roleKey: string, competenceCeiling: string): string {
  switch (competenceCeiling) {
    case "ministerial":
      return "يُصدر هذا المسؤول القرار بصفته الوزير المختص استناداً إلى صلاحياته الوزارية التشريعية والتنظيمية";
    case "director_general":
      return "يُصدر هذا المسؤول القرار بصفته المدير العام للجهة الحكومية المعنية ضمن نطاق اختصاصها";
    case "department_head":
      return "يُصدر هذا المسؤول القرار بصفته رئيس القسم أو الدائرة في حدود الصلاحيات المفوَّضة إليه";
    case "hr_officer":
      return "يُصدر قسم الموارد البشرية هذا القرار في نطاق اختصاصه بشؤون الموظفين وفق أحكام قانون الخدمة المدنية";
    case "review_only":
      return "تراجع الإدارة القانونية هذا القرار للتحقق من مشروعيته وسلامته القانونية دون إصداره";
    case "judicial_review":
      return "تنظر المحكمة الإدارية في هذا القرار للبت في مدى مشروعيته وصحته الإجرائية والموضوعية";
    case "challenge_only":
      return "يتظلم المواطن/المقيم من هذا القرار الصادر بحقه ويسعى إلى الطعن فيه أو الحصول على تعويض";
    default:
      return `يتعامل المستخدم (${roleKey}) مع هذا القرار الإداري`;
  }
}
