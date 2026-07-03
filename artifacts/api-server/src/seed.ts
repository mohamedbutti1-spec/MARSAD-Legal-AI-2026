import {
  db,
  usersTable,
  comparisonsTable,
  settingsTable,
  legalSourcesTable,
} from "@workspace/db";
import { logger } from "./lib/logger";

export async function seedDatabase() {
  // ─── Users ──────────────────────────────────────────────────────────────────
  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length === 0) {
    await db.insert(usersTable).values([
      { name: "محمد الشامسي", email: "m.alshamsi@legal.ae", role: "owner" },
      { name: "Sarah Al Mansoori", email: "s.mansoori@legal.ae", role: "supervisor" },
      { name: "Ahmed Khalil", email: "a.khalil@legal.ae", role: "viewer" },
    ]);
    logger.info("Seeded initial users");
  }

  // ─── Comparisons ────────────────────────────────────────────────────────────
  const existingComparisons = await db.select().from(comparisonsTable);
  if (existingComparisons.length === 0) {
    const sampleRows = JSON.stringify([
      { aspect: "نظام العقوبات / Criminal Penalties", uae: "القانون الاتحادي رقم 3 لسنة 1987 — عقوبات صارمة لحماية المجتمع", france: "Code Pénal 1994 — يركز على إعادة التأهيل والعدالة التصالحية" },
      { aspect: "حقوق الملكية / Property Rights", uae: "قانون المعاملات المدنية — ملكية مقيدة لغير المواطنين", france: "Code Civil — ملكية كاملة بغض النظر عن الجنسية" },
      { aspect: "قانون العمل / Labour Law", uae: "قانون العمل الاتحادي — نظام الكفالة", france: "Code du Travail — عقود مفتوحة ونقابات قوية" },
    ]);
    await db.insert(comparisonsTable).values([{
      title: "مقارنة القانون الجنائي — الإمارات وفرنسا",
      description: "مقارنة تفصيلية للأطر القانونية الجنائية في دولة الإمارات العربية المتحدة وفرنسا",
      rows: sampleRows,
      createdById: 1,
    }]);
    logger.info("Seeded initial comparison");
  }

  // ─── Settings ───────────────────────────────────────────────────────────────
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

  // ─── Legal Sources ───────────────────────────────────────────────────────────
  const existingSources = await db.select().from(legalSourcesTable);
  if (existingSources.length === 0) {
    await db.insert(legalSourcesTable).values([
      // UAE Legislation
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون المعاملات التجارية الاتحادي",
        titleAr: "قانون المعاملات التجارية الاتحادي",
        referenceNumber: "18/1993", year: 1993,
        subject: "Commercial Transactions", subjectAr: "المعاملات التجارية",
        content: "يُنظّم هذا القانون المعاملات التجارية في دولة الإمارات العربية المتحدة، بما فيها عقود البيع التجاري، والوكالة التجارية، والسفتجات والأوراق التجارية، والإفلاس التجاري.",
        summary: "The UAE Federal Commercial Transactions Law No. 18/1993 governs all commercial dealings including sales, agency, negotiable instruments, and commercial bankruptcy.",
        summaryAr: "يُنظّم قانون المعاملات التجارية الاتحادي رقم 18 لسنة 1993 جميع المعاملات التجارية بما فيها عقود البيع والوكالة والأوراق التجارية والإفلاس.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون العمل الاتحادي",
        titleAr: "قانون العمل الاتحادي",
        referenceNumber: "33/2021", year: 2021,
        subject: "Labour Law", subjectAr: "قانون العمل",
        content: "يُحدّد هذا القانون العلاقة بين صاحب العمل والعامل في القطاع الخاص، ويتضمن أحكام العقود، وساعات العمل، والإجازات، والفصل التعسفي، والتعويضات.",
        summary: "Federal Decree-Law No. 33/2021 on the Regulation of Labour Relations regulates employment in the UAE private sector.",
        summaryAr: "يُنظّم المرسوم بقانون اتحادي رقم 33 لسنة 2021 علاقات العمل في القطاع الخاص ويشمل العقود وساعات العمل والإجازات.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون الإجراءات المدنية الاتحادي",
        titleAr: "قانون الإجراءات المدنية الاتحادي",
        referenceNumber: "42/2022", year: 2022,
        subject: "Civil Procedure", subjectAr: "الإجراءات المدنية",
        content: "يُنظّم هذا القانون إجراءات التقاضي أمام المحاكم المدنية في الدولة، ويشمل قواعد الاختصاص، وتقديم الدعاوى، والأدلة، والطعون.",
        summaryAr: "يُنظّم قانون الإجراءات المدنية رقم 42 لسنة 2022 مراحل التقاضي المدني أمام المحاكم الاتحادية.",
      },
      // UAE Case Law
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم محكمة التمييز في الطعن التجاري رقم 547/2022",
        referenceNumber: "547/2022", year: 2022,
        subject: "Contract Breach", subjectAr: "إخلال بالعقد",
        courtLevel: "محكمة التمييز",
        content: "قضت محكمة التمييز بأن الإخلال بشرط عدم المنافسة يُعدّ ضاراً بمصالح صاحب العمل ويستوجب التعويض وفق المادة 127 من قانون العمل.",
        summaryAr: "قضت محكمة التمييز بتعويض صاحب العمل عن الإخلال بشرط عدم المنافسة استناداً إلى المادة 127 من قانون العمل.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم محكمة الاستئناف في الطعن العقاري رقم 215/2023",
        referenceNumber: "215/2023", year: 2023,
        subject: "Real Estate", subjectAr: "العقارات",
        courtLevel: "محكمة الاستئناف",
        content: "أكدت محكمة الاستئناف أن عقد البيع العقاري لا يكتمل إلا بالتسجيل في دائرة الأراضي والأملاك، وأن مجرد توقيع العقد لا يُنشئ حقاً عينياً.",
        summaryAr: "أكدت المحكمة أن نقل ملكية العقار يستلزم التسجيل الرسمي، ولا يكفي مجرد توقيع العقد.",
      },
      // French Law
      {
        jurisdiction: "france", docType: "code", language: "fr",
        title: "Code civil français — Droit des obligations",
        titleAr: "القانون المدني الفرنسي — قانون الالتزامات",
        referenceNumber: "Code civil / Articles 1100-1386", year: 2016,
        subject: "Civil Obligations", subjectAr: "الالتزامات المدنية",
        content: "Le droit des obligations français repose sur le Code civil de 1804, profondément réformé par l'ordonnance n°2016-131 du 10 février 2016. Il régit la formation, la validité et les effets des contrats.",
        summary: "French civil obligations law, updated by the 2016 reform, governs contract formation, validity, and effects, emphasizing good faith and freedom of contract.",
        summaryAr: "يُنظّم قانون الالتزامات الفرنسي المُحدَّث عام 2016 تكوين العقود وصحتها وآثارها، مع التركيز على مبدأ حسن النية وحرية التعاقد.",
      },
      {
        jurisdiction: "france", docType: "code", language: "fr",
        title: "Code du travail — Contrat de travail à durée indéterminée",
        titleAr: "قانون العمل الفرنسي — عقد العمل غير محدد المدة",
        referenceNumber: "L1221-1 à L1237-20", year: 2008,
        subject: "Labour Law", subjectAr: "قانون العمل",
        content: "Le Code du travail français définit le contrat à durée indéterminée (CDI) comme la forme normale du contrat de travail. Il prévoit des protections strictes contre le licenciement abusif.",
        summaryAr: "يُعرِّف قانون العمل الفرنسي عقد العمل غير محدد المدة باعتباره الشكل الأصلي للعقد، مع ضمانات صارمة ضد الفصل التعسفي.",
      },
      // EU Law
      {
        jurisdiction: "eu", docType: "regulation", language: "en",
        title: "General Data Protection Regulation (GDPR)",
        titleAr: "اللائحة العامة لحماية البيانات",
        referenceNumber: "2016/679", year: 2018,
        subject: "Data Protection", subjectAr: "حماية البيانات",
        content: "The GDPR is a comprehensive data protection framework applicable across the EU. It establishes principles for lawful processing, data subject rights (access, erasure, portability), and imposes obligations on controllers and processors.",
        summary: "The EU GDPR (2016/679) regulates personal data processing, establishing key principles, data subject rights, and compliance obligations for organisations operating in or targeting EU residents.",
        summaryAr: "تُنظّم اللائحة الأوروبية لحماية البيانات (GDPR) معالجة البيانات الشخصية وتُرسي مبادئ الشرعية وحقوق الأفراد والتزامات المؤسسات.",
      },
      {
        jurisdiction: "eu", docType: "directive", language: "en",
        title: "Directive on Copyright in the Digital Single Market",
        titleAr: "توجيه حقوق المؤلف في السوق الرقمية الموحدة",
        referenceNumber: "2019/790", year: 2019,
        subject: "Intellectual Property", subjectAr: "الملكية الفكرية",
        content: "This Directive modernises EU copyright rules for the digital environment. It introduces upload filters for platforms, a press publishers' right, and exceptions for text and data mining.",
        summaryAr: "يُحدِّث هذا التوجيه قواعد حقوق المؤلف الأوروبية للبيئة الرقمية، ويُنظّم فلاتر الرفع وحقوق الناشرين والاستثناءات للتحليل النصي.",
      },
    ]);
    logger.info("Seeded legal sources (UAE legislation, UAE case law, French law, EU law)");
  }
}
