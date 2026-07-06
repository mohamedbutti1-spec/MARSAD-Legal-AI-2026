/**
 * PWE — Professional Workflow Engine — service layer
 *
 * Returns the parsed workflow step(s) for a given (sector, profession, stage).
 * Array fields are JSON-parsed from TEXT storage before returning.
 */
import { db, pgfWorkflowStepsTable } from "@workspace/db";
import { eq, and, asc }              from "drizzle-orm";

export interface WorkflowBranchRule {
  condition: string;
  outcome:   string;
}

export interface WorkflowEscalationRule {
  condition: string;
  action:    string;
}

export interface ParsedWorkflowStep {
  id:                number;
  sectorId:          string;
  professionId:      string;
  stageId:           string;
  order:             number;
  title:             string;
  objective:         string;
  nextAction:        string;
  requiredDocuments: string[];
  approvals:         string[];
  checkpoints:       string[];
  branchRules:       WorkflowBranchRule[];
  escalationRules:   WorkflowEscalationRule[];
  expectedOutput:    string;
  estimatedDuration: string;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export async function getStageWorkflow(
  sectorId:     string,
  professionId: string,
  stageId:      string,
): Promise<ParsedWorkflowStep[]> {
  const rows = await db
    .select()
    .from(pgfWorkflowStepsTable)
    .where(
      and(
        eq(pgfWorkflowStepsTable.sectorId,     sectorId),
        eq(pgfWorkflowStepsTable.professionId, professionId),
        eq(pgfWorkflowStepsTable.stageId,      stageId),
      ),
    )
    .orderBy(asc(pgfWorkflowStepsTable.order));

  return rows.map((r) => ({
    id:                r.id,
    sectorId:          r.sectorId,
    professionId:      r.professionId,
    stageId:           r.stageId,
    order:             r.order,
    title:             r.title,
    objective:         r.objective,
    nextAction:        r.nextAction,
    requiredDocuments: parseJson<string[]>(r.requiredDocuments, []),
    approvals:         parseJson<string[]>(r.approvals, []),
    checkpoints:       parseJson<string[]>(r.checkpoints, []),
    branchRules:       parseJson<WorkflowBranchRule[]>(r.branchRules, []),
    escalationRules:   parseJson<WorkflowEscalationRule[]>(r.escalationRules, []),
    expectedOutput:    r.expectedOutput,
    estimatedDuration: r.estimatedDuration,
  }));
}
