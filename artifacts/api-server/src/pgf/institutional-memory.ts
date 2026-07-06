/**
 * PGF Institutional Memory — service layer
 *
 * Reads up to MAX_ENTRIES memory entries for a given (sector, profession, stage)
 * scope, ordered by confidence descending.
 *
 * Write operations are admin-only and go through the route layer directly.
 */
import { db, pgfInstitutionalMemoryTable } from "@workspace/db";
import { eq, and, desc, sql }              from "drizzle-orm";

export const MAX_ENTRIES = 5;

export type MemoryCategory =
  | "expert_practice"
  | "frequent_mistake"
  | "lesson_learned"
  | "recommended_sequence"
  | "practical_tip"
  | "success_indicator"
  | "failure_indicator";

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  expert_practice:      "الممارسة الخبراتية الشائعة",
  frequent_mistake:     "الأخطاء المتكررة",
  lesson_learned:       "الدروس المستفادة",
  recommended_sequence: "التسلسل الموصى به",
  practical_tip:        "نصائح عملية",
  success_indicator:    "مؤشرات النجاح",
  failure_indicator:    "مؤشرات الإخفاق",
};

export const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABELS));
export const VALID_SOURCE_TYPES = new Set(["institutional", "ai_generated", "user_contributed"]);

export async function getStageMemory(
  sectorId:     string,
  professionId: string,
  stageId:      string,
) {
  return db
    .select()
    .from(pgfInstitutionalMemoryTable)
    .where(
      and(
        eq(pgfInstitutionalMemoryTable.sectorId,     sectorId),
        eq(pgfInstitutionalMemoryTable.professionId, professionId),
        eq(pgfInstitutionalMemoryTable.stageId,      stageId),
      ),
    )
    .orderBy(desc(pgfInstitutionalMemoryTable.confidence))
    .limit(MAX_ENTRIES);
}
