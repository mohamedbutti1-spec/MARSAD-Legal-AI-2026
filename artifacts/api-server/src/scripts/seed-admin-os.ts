/**
 * Seed script — UAE Administrative Decision Types (Al-Shamsi Phase 1)
 * Run with: npx tsx src/scripts/seed-admin-os.ts
 */

import { db, adminDecisionTypesTable } from "@workspace/db";
import { SEED_DECISION_TYPES } from "../data/admin-os-seed.js";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding admin_decision_types …");

  // Check if already seeded (idempotent)
  const existing = await db
    .select({ id: adminDecisionTypesTable.id })
    .from(adminDecisionTypesTable)
    .where(eq(adminDecisionTypesTable.jurisdiction, "uae"))
    .limit(1);

  if (existing.length > 0) {
    console.log("⚠️  UAE decision types already seeded. Clearing and re-seeding …");
    await db
      .delete(adminDecisionTypesTable)
      .where(eq(adminDecisionTypesTable.jurisdiction, "uae"));
  }

  for (const dt of SEED_DECISION_TYPES) {
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
    console.log(`  ✓ ${dt.decisionTypeEn}`);
  }

  console.log(`\n✅ Seeded ${SEED_DECISION_TYPES.length} UAE administrative decision types.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
