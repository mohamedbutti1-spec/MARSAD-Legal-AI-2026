/**
 * Seed runner — French administrative decision types (jurisdiction = france)
 * Idempotent: clears existing France rows, then inserts fresh.
 *
 * Usage:
 *   cd artifacts/api-server
 *   pnpm run tsx src/scripts/seed-admin-os-france.ts
 */

import { db, adminDecisionTypesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { FRANCE_DECISION_TYPES } from "../data/admin-os-france-seed";

async function main() {
  console.log("Clearing existing France decision types…");
  await db
    .delete(adminDecisionTypesTable)
    .where(eq(adminDecisionTypesTable.jurisdiction, "france"));

  console.log(`Inserting ${FRANCE_DECISION_TYPES.length} French decision types…`);
  for (const dt of FRANCE_DECISION_TYPES) {
    await db.insert(adminDecisionTypesTable).values({
      jurisdiction: dt.jurisdiction,
      domain: dt.domain,
      decisionTypeAr: dt.decisionTypeAr,
      decisionTypeEn: dt.decisionTypeEn,
      descriptionAr: dt.descriptionAr,
      requiredCompetenceLevel: dt.requiredCompetenceLevel,
      inherentRiskLevel: dt.inherentRiskLevel,
      applicableLaws: dt.applicableLaws,
      interviewTemplate: dt.interviewTemplate,
    });
    console.log(`  + ${dt.decisionTypeEn}`);
  }

  console.log(`✓ ${FRANCE_DECISION_TYPES.length} French decision types seeded successfully.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("France seed failed:", err);
  process.exit(1);
});
