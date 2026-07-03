/**
 * Seed runner — admin_jurisdictions table
 * Idempotent: upserts on jurisdictionKey
 *
 * Usage:
 *   cd artifacts/api-server
 *   pnpm run tsx src/scripts/seed-admin-os-jurisdictions.ts
 */

import { db, adminJurisdictionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { JURISDICTION_SEEDS } from "../data/admin-os-jurisdictions-seed";

async function main() {
  console.log(`Seeding ${JURISDICTION_SEEDS.length} jurisdictions…`);

  for (const seed of JURISDICTION_SEEDS) {
    const existing = await db
      .select({ id: adminJurisdictionsTable.id })
      .from(adminJurisdictionsTable)
      .where(eq(adminJurisdictionsTable.jurisdictionKey, seed.jurisdictionKey));

    if (existing.length > 0) {
      await db
        .update(adminJurisdictionsTable)
        .set({
          nameAr: seed.nameAr,
          nameEn: seed.nameEn,
          legalSystem: seed.legalSystem,
          primaryLaws: seed.primaryLaws,
          promptModule: seed.promptModule,
          active: seed.active,
        })
        .where(eq(adminJurisdictionsTable.jurisdictionKey, seed.jurisdictionKey));
      console.log(`  ↻ Updated: ${seed.jurisdictionKey} (${seed.nameEn})`);
    } else {
      await db.insert(adminJurisdictionsTable).values(seed);
      console.log(`  + Inserted: ${seed.jurisdictionKey} (${seed.nameEn})`);
    }
  }

  console.log("✓ Jurisdictions seeded successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
