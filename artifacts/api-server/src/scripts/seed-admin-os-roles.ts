/**
 * Seed script — Al-Shamsi 7 Role Definitions (Phase 2)
 * Run with: npx tsx src/scripts/seed-admin-os-roles.ts
 * (from artifacts/api-server directory)
 */

import { db, adminDecisionRolesTable } from "@workspace/db";
import { SEED_ROLES } from "../data/admin-os-roles-seed.js";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding admin_decision_roles …");

  for (const role of SEED_ROLES) {
    // Upsert by roleKey (idempotent)
    const existing = await db
      .select({ id: adminDecisionRolesTable.id })
      .from(adminDecisionRolesTable)
      .where(eq(adminDecisionRolesTable.roleKey, role.roleKey))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(adminDecisionRolesTable)
        .set({
          titleAr: role.titleAr,
          titleEn: role.titleEn,
          descriptionAr: role.descriptionAr,
          descriptionEn: role.descriptionEn,
          competenceCeiling: role.competenceCeiling,
          permittedDomains: role.permittedDomains,
          actionCapabilities: role.actionCapabilities,
          jurisdictionScope: role.jurisdictionScope,
          preferredLanguage: role.preferredLanguage,
          interviewModifiers: role.interviewModifiers,
          legalBasisAr: role.legalBasisAr,
          legalBasisEn: role.legalBasisEn,
        })
        .where(eq(adminDecisionRolesTable.roleKey, role.roleKey));
      console.log(`  ↻ Updated: ${role.titleEn}`);
    } else {
      await db.insert(adminDecisionRolesTable).values(role);
      console.log(`  ✓ Inserted: ${role.titleEn}`);
    }
  }

  console.log(`\n✅ Seeded ${SEED_ROLES.length} role definitions.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
