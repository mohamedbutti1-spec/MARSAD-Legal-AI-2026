/**
 * PGF Profession Registry
 *
 * The single source of truth for all registered professions.
 * To add a new profession: create a ProfessionConfig and add it to the arrays below.
 */

import type { ProfessionConfig, PgfSectorSummary, PgfProfessionSummary } from "../types.js";

import { LAW_ENFORCEMENT_PROFESSIONS } from "./professions/law-enforcement.js";
import { GOVERNMENT_PROFESSIONS }      from "./professions/government.js";
import { GOVERNANCE_PROFESSIONS }      from "./professions/governance.js";
import { STRATEGY_PROFESSIONS }        from "./professions/strategy.js";
import { FINANCE_PROFESSIONS }         from "./professions/finance.js";
import { QUALITY_TECH_PROFESSIONS }    from "./professions/quality-tech.js";
import { ACADEMIC_PROFESSIONS }        from "./professions/academics.js";

// ─── Master list of all registered professions ────────────────────────────────

export const ALL_PROFESSIONS: ProfessionConfig[] = [
  ...LAW_ENFORCEMENT_PROFESSIONS,   // Judiciary, Public Prosecution, Police
  ...GOVERNMENT_PROFESSIONS,        // Gov Admin, Legal Affairs, HR
  ...GOVERNANCE_PROFESSIONS,        // Internal Audit, Governance, Compliance, Risk
  ...STRATEGY_PROFESSIONS,          // Strategy, Performance Management
  ...FINANCE_PROFESSIONS,           // Procurement, Finance, Taxation
  ...QUALITY_TECH_PROFESSIONS,      // Quality, ISO, Cybersecurity, AI Governance
  ...ACADEMIC_PROFESSIONS,          // Academic Research
];

// ─── Fast lookup maps ─────────────────────────────────────────────────────────

/** Lookup: `${sectorId}:${professionId}` → ProfessionConfig */
export const PROFESSION_MAP = new Map<string, ProfessionConfig>(
  ALL_PROFESSIONS.map((p) => [`${p.sectorId}:${p.professionId}`, p]),
);

/** Lookup: sectorId → ProfessionConfig[] */
export const SECTOR_MAP = new Map<string, ProfessionConfig[]>();
for (const p of ALL_PROFESSIONS) {
  const list = SECTOR_MAP.get(p.sectorId) ?? [];
  list.push(p);
  SECTOR_MAP.set(p.sectorId, list);
}

// ─── Public summary views (for API listing) ───────────────────────────────────

export function getSectorSummaries(): PgfSectorSummary[] {
  const sectors: PgfSectorSummary[] = [];
  for (const [sectorId, profs] of SECTOR_MAP.entries()) {
    const first = profs[0];
    sectors.push({
      sectorId,
      sectorNameAr: first.sectorNameAr,
      sectorNameEn: first.sectorNameEn,
      icon:         first.icon,
      professions:  profs.map(toProfessionSummary),
    });
  }
  return sectors;
}

export function toProfessionSummary(p: ProfessionConfig): PgfProfessionSummary {
  return {
    sectorId:         p.sectorId,
    professionId:     p.professionId,
    professionNameAr: p.professionNameAr,
    professionNameEn: p.professionNameEn,
    icon:             p.icon,
    description:      p.description,
  };
}

export function findProfession(
  sectorId: string,
  professionId: string,
): ProfessionConfig | undefined {
  return PROFESSION_MAP.get(`${sectorId}:${professionId}`);
}

/** Returns the next stage ID given current stage answers and the decision tree. */
export function resolveNextStage(
  config:       ProfessionConfig,
  stageId:      string,
  answers:      Record<string, string | string[] | boolean>,
): { nextStageId: string | null; addedFlag: string | null } {
  // Check decision tree nodes for this stage
  for (const node of config.decisionTree) {
    if (node.stageId !== stageId) continue;
    const answer = answers[node.questionId];
    if (answer === undefined) continue;
    const answerStr = Array.isArray(answer) ? answer.join(",") : String(answer);
    if (answerStr.toLowerCase() === node.answer.toLowerCase()) {
      return { nextStageId: node.nextStageId, addedFlag: node.addFlag ?? null };
    }
  }
  // Fallback to stage default
  const stage = config.workflowStages.find((s) => s.id === stageId);
  return { nextStageId: stage?.defaultNextStageId ?? null, addedFlag: null };
}

/** Returns true if all stages after the given one lead to null (i.e., this is the last). */
export function isLastStage(config: ProfessionConfig, stageId: string): boolean {
  const idx = config.workflowStages.findIndex((s) => s.id === stageId);
  return idx === config.workflowStages.length - 1;
}
