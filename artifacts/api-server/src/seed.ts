import { db, usersTable, comparisonsTable, settingsTable } from "@workspace/db";
import { logger } from "./lib/logger";

export async function seedDatabase() {
  // Seed owner user (Mohamed Al Shamsi)
  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length === 0) {
    await db.insert(usersTable).values([
      { name: "محمد الشامسي", email: "m.alshamsi@legal.ae", role: "owner" },
      { name: "Sarah Al Mansoori", email: "s.mansoori@legal.ae", role: "supervisor" },
      { name: "Ahmed Khalil", email: "a.khalil@legal.ae", role: "viewer" },
    ]);
    logger.info("Seeded initial users");
  }

  // Seed a sample comparison
  const existingComparisons = await db.select().from(comparisonsTable);
  if (existingComparisons.length === 0) {
    const sampleRows = JSON.stringify([
      { aspect: "نظام العقوبات / Criminal Penalties", uae: "القانون الاتحادي رقم 3 لسنة 1987 — عقوبات صارمة لحماية المجتمع", france: "Code Pénal 1994 — يركز على إعادة التأهيل والعدالة التصالحية" },
      { aspect: "حقوق الملكية / Property Rights", uae: "قانون المعاملات المدنية — ملكية مقيدة لغير المواطنين", france: "Code Civil — ملكية كاملة بغض النظر عن الجنسية" },
      { aspect: "قانون العمل / Labour Law", uae: "قانون العمل الاتحادي — نظام الكفالة", france: "Code du Travail — عقود مفتوحة ونقابات قوية" },
    ]);
    await db.insert(comparisonsTable).values([
      {
        title: "مقارنة القانون الجنائي — الإمارات وفرنسا",
        description: "مقارنة تفصيلية للأطر القانونية الجنائية في دولة الإمارات العربية المتحدة وفرنسا",
        rows: sampleRows,
        createdById: 1,
      },
    ]);
    logger.info("Seeded initial comparison");
  }

  // Ensure settings exist
  const existingSettings = await db.select().from(settingsTable);
  if (existingSettings.length === 0) {
    await db.insert(settingsTable).values({
      aiEnabled: true,
      maxUploadSizeMb: 50,
      allowedFileTypes: "pdf,docx,txt",
      maintenanceMode: false,
    });
    logger.info("Seeded initial settings");
  }
}
