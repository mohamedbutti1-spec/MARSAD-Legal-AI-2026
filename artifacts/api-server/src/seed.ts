import {
  db,
  usersTable,
  comparisonsTable,
  settingsTable,
  legalSourcesTable,
  seedRiskCategories,
} from "@workspace/db";
import { logger } from "./lib/logger";
import { migrateResearchWorkspace } from "./research-workspace/migration.js";
import { migrateAdkg } from "./adkg/migration.js";
import { migrateJre } from "./jre/migration.js";
import { migrateJdc } from "./jdc/migration.js";
import { migrateSpg } from "./spg/migration.js";

const sampleRows = [
  {
    concept:    "مبدأ العقد",
    uae:        "يتطلب قانون المعاملات المدنية الإيجاب والقبول والمحل والسبب",
    france:     "يشترط القانون المدني الفرنسي الرضا والأهلية والمحل والسبب",
    eu:         "لا توجد قواعد اتفاقية موحدة للعقود في الاتحاد الأوروبي رغم وجود مبادئ مشتركة",
    notes:      "المفاهيم متقاربة، غير أن التفاصيل التطبيقية تتباين",
  },
  {
    concept:    "الفصل التعسفي",
    uae:        "يُتيح قانون العمل التعويض بحد أقصى 3 أشهر عن كل سنة خدمة",
    france:     "يستلزم إجراء الاستماع وتقديم مبرر حقيقي وجدي للفصل",
    eu:         "يحكمه التوجيه الأوروبي 2001/23/EC وأحكام CJEU",
    notes:      "يوفر القانون الفرنسي حماية أكثر إجرائية",
  },
];

export async function seedDatabase() {
  // ─── Phase 57: Research Workspace tables (additive, IF NOT EXISTS) ───────────
  await migrateResearchWorkspace().catch((err) =>
    logger.warn({ err }, "Research workspace migration failed (non-fatal)"),
  );
  // ─── Phase 58: ADKG tables (additive, IF NOT EXISTS) ─────────────────────
  await migrateAdkg().catch((err) =>
    logger.warn({ err }, "ADKG migration failed (non-fatal)"),
  );
  // ─── JRE: Judicial Reasoning Engine tables (additive, IF NOT EXISTS) ─────
  await migrateJre().catch((err) =>
    logger.warn({ err }, "JRE migration failed (non-fatal)"),
  );
  logger.info("JRE migration complete");
  // ─── JDC: Judicial Deliberation Chamber tables (additive, IF NOT EXISTS) ──
  await migrateJdc().catch((err) =>
    logger.warn({ err }, "JDC migration failed (non-fatal)"),
  );
  logger.info("JDC migration complete");
  // ─── SPG: Smart Professional Guidance tables (additive, IF NOT EXISTS) ────
  await migrateSpg().catch((err) =>
    logger.warn({ err }, "SPG migration failed (non-fatal)"),
  );
  logger.info("SPG migration complete");

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
    await db.insert(comparisonsTable).values([{
      title: "مقارنة القانون الجنائي — الإمارات وفرنسا",
      description: "مقارنة تفصيلية للأطر القانونية الجنائية في دولة الإمارات العربية المتحدة وفرنسا",
      rows: JSON.stringify(sampleRows),
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
      // ── UAE Legislation (12 records) ────────────────────────────────────────
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون المعاملات التجارية الاتحادي",
        titleAr: "قانون المعاملات التجارية الاتحادي",
        referenceNumber: "18/1993", year: 1993,
        subject: "Commercial Transactions", subjectAr: "المعاملات التجارية",
        content: "يُنظّم هذا القانون المعاملات التجارية في دولة الإمارات العربية المتحدة، بما فيها عقود البيع التجاري، والوكالة التجارية، والسفتجات والأوراق التجارية، والإفلاس التجاري. يُحدد القانون شروط صحة العقود التجارية، وحقوق والتزامات الأطراف التجارية، وآليات تسوية النزاعات.",
        summary: "The UAE Federal Commercial Transactions Law No. 18/1993 governs all commercial dealings including sales, agency, negotiable instruments, and commercial bankruptcy.",
        summaryAr: "يُنظّم قانون المعاملات التجارية الاتحادي رقم 18 لسنة 1993 جميع المعاملات التجارية بما فيها عقود البيع والوكالة والأوراق التجارية والإفلاس.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون العمل الاتحادي",
        titleAr: "قانون العمل الاتحادي",
        referenceNumber: "33/2021", year: 2021,
        subject: "Labour Law", subjectAr: "قانون العمل",
        content: "يُحدّد هذا القانون العلاقة بين صاحب العمل والعامل في القطاع الخاص، ويتضمن أحكام العقود، وساعات العمل، والإجازات، والفصل التعسفي، والتعويضات. يُعدّ هذا القانون إصلاحاً جوهرياً شاملاً يُحلّ محل القانون الاتحادي رقم 8 لسنة 1980.",
        summary: "Federal Decree-Law No. 33/2021 on the Regulation of Labour Relations regulates employment in the UAE private sector.",
        summaryAr: "يُنظّم المرسوم بقانون اتحادي رقم 33 لسنة 2021 علاقات العمل في القطاع الخاص ويشمل العقود وساعات العمل والإجازات.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون الإجراءات المدنية الاتحادي",
        titleAr: "قانون الإجراءات المدنية الاتحادي",
        referenceNumber: "42/2022", year: 2022,
        subject: "Civil Procedure", subjectAr: "الإجراءات المدنية",
        content: "يُنظّم هذا القانون إجراءات التقاضي أمام المحاكم المدنية في الدولة، ويشمل قواعد الاختصاص، وتقديم الدعاوى، والأدلة، والطعون. يُعزّز القانون الرقمنة في التقاضي ويُتيح التقاضي الإلكتروني.",
        summaryAr: "يُنظّم قانون الإجراءات المدنية رقم 42 لسنة 2022 مراحل التقاضي المدني أمام المحاكم الاتحادية.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون المعاملات المدنية الاتحادي",
        titleAr: "قانون المعاملات المدنية الاتحادي",
        referenceNumber: "5/1985", year: 1985,
        subject: "Civil Transactions", subjectAr: "المعاملات المدنية",
        content: "يُعدّ هذا القانون الإطار التشريعي الأساسي للمعاملات المدنية في الدولة، ويتضمن أحكام العقود والمسؤولية التقصيرية والحقوق العينية والميراث والزواج. يستند القانون إلى أحكام الفقه الإسلامي مع التأثر بالقانون المدني المصري.",
        summary: "UAE Civil Transactions Law No. 5/1985, the cornerstone of civil law, covering contracts, torts, property rights, and family law with Islamic jurisprudence foundations.",
        summaryAr: "قانون المعاملات المدنية رقم 5 لسنة 1985 هو الإطار التشريعي الأساسي الذي يُنظّم العقود والمسؤولية التقصيرية والحقوق العينية.",
      },
      {
        jurisdiction: "uae_legislation", docType: "decree", language: "ar",
        title: "مرسوم بقانون اتحادي بشأن حماية البيانات الشخصية",
        titleAr: "مرسوم بقانون اتحادي بشأن حماية البيانات الشخصية",
        referenceNumber: "45/2021", year: 2021,
        subject: "Data Protection", subjectAr: "حماية البيانات الشخصية",
        content: "يُنشئ هذا المرسوم إطاراً تنظيمياً شاملاً لحماية البيانات الشخصية في الدولة، ويُحدّد حقوق أصحاب البيانات والتزامات المعالجين. يُوجب إجراء تقييم أثر حماية البيانات، وتعيين مسؤول عن حماية البيانات.",
        summary: "UAE Federal Decree-Law No. 45/2021 on Personal Data Protection establishes a comprehensive data privacy framework mirroring key GDPR principles.",
        summaryAr: "يُنشئ مرسوم بقانون رقم 45 لسنة 2021 إطاراً وطنياً لحماية البيانات الشخصية مستلهماً من اللائحة الأوروبية GDPR.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون الجرائم المعلوماتية الاتحادي",
        titleAr: "قانون الجرائم المعلوماتية الاتحادي",
        referenceNumber: "34/2021", year: 2021,
        subject: "Cybercrime", subjectAr: "الجرائم المعلوماتية",
        content: "يُجرّم هذا القانون الجرائم المرتكبة عبر أنظمة المعلومات والشبكات الإلكترونية، بما فيها الاختراق والتنمر الإلكتروني والاحتيال الإلكتروني. يُعدّل القانون المرسوم بقانون رقم 5 لسنة 2012.",
        summaryAr: "يُجرّم قانون الجرائم المعلوماتية رقم 34 لسنة 2021 جرائم الإنترنت والاختراق والتنمر الإلكتروني والاحتيال الرقمي.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون الشركات التجارية الاتحادي",
        titleAr: "قانون الشركات التجارية الاتحادي",
        referenceNumber: "32/2021", year: 2021,
        subject: "Commercial Companies", subjectAr: "الشركات التجارية",
        content: "يُحدد هذا القانون أنواع الشركات التجارية المرخصة في الدولة وإجراءات تأسيسها وحوكمتها وتصفيتها. يُلغي القانون اشتراط الشريك المحلي لمعظم القطاعات ويُتيح التملك الأجنبي الكامل.",
        summary: "UAE Commercial Companies Law No. 32/2021 regulates company formation, governance, and dissolution, allowing 100% foreign ownership in most sectors.",
        summaryAr: "يُنظّم قانون الشركات التجارية رقم 32 لسنة 2021 تأسيس الشركات وحوكمتها ويُبيح التملك الأجنبي الكامل في معظم القطاعات.",
      },
      {
        jurisdiction: "uae_legislation", docType: "regulation", language: "ar",
        title: "لائحة تنظيم الوساطة والتحكيم في المنازعات المدنية",
        titleAr: "لائحة تنظيم الوساطة والتحكيم في المنازعات المدنية",
        referenceNumber: "6/2021", year: 2021,
        subject: "Alternative Dispute Resolution", subjectAr: "الوساطة والتحكيم",
        content: "تُنظّم هذه اللائحة إجراءات الوساطة الإجبارية قبل التقاضي في المنازعات المدنية والتجارية، وتُحدد معايير اعتماد الوسطاء وإجراءات التحكيم المُعجَّل.",
        summaryAr: "تُنظّم اللائحة إجراءات الوساطة الإلزامية قبل التقاضي والتحكيم المُعجَّل في المنازعات المدنية والتجارية.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون مكافحة غسل الأموال وتمويل الإرهاب",
        titleAr: "قانون مكافحة غسل الأموال وتمويل الإرهاب",
        referenceNumber: "20/2018", year: 2018,
        subject: "Anti-Money Laundering", subjectAr: "مكافحة غسل الأموال",
        content: "يُرسي هذا القانون منظومة تشريعية متكاملة لمكافحة غسيل الأموال وتمويل الإرهاب وتمويل انتشار الأسلحة، ويُحدد متطلبات العناية الواجبة والإبلاغ عن المعاملات المشبوهة.",
        summaryAr: "يُرسي قانون مكافحة غسل الأموال رقم 20 لسنة 2018 منظومة شاملة للامتثال المالي وإجراءات العناية الواجبة والإبلاغ عن العمليات المشبوهة.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون الملكية الفكرية الاتحادي",
        titleAr: "قانون الملكية الفكرية الاتحادي",
        referenceNumber: "38/2021", year: 2021,
        subject: "Intellectual Property", subjectAr: "الملكية الفكرية",
        content: "يُنظّم هذا القانون حقوق المؤلف والحقوق المجاورة، ويُحدد آليات الحماية والإنفاذ وشروط الترخيص. يتوافق القانون مع اتفاقية تريبس ومعاهدات منظمة التجارة العالمية.",
        summaryAr: "يُنظّم قانون الملكية الفكرية رقم 38 لسنة 2021 حقوق المؤلف والحقوق المجاورة ويتوافق مع المعايير الدولية لمنظمة التجارة العالمية.",
      },
      {
        jurisdiction: "uae_legislation", docType: "law", language: "ar",
        title: "قانون إنشاء المحكمة الاتحادية العليا",
        titleAr: "قانون إنشاء المحكمة الاتحادية العليا",
        referenceNumber: "10/1973", year: 1973,
        subject: "Judiciary", subjectAr: "السلطة القضائية",
        content: "يُنشئ هذا القانون المحكمة الاتحادية العليا ويُحدد اختصاصاتها بالنظر في الطعون بعدم الدستورية والنزاعات بين الإمارات والقضايا الجنائية الكبرى.",
        summaryAr: "يُؤسّس قانون رقم 10 لسنة 1973 المحكمة الاتحادية العليا ويُحدد اختصاصاتها الدستورية والرقابية.",
      },
      {
        jurisdiction: "uae_legislation", docType: "resolution", language: "ar",
        title: "قرار مجلس الوزراء بشأن تصنيف بيانات الجهات الحكومية",
        titleAr: "قرار مجلس الوزراء بشأن تصنيف بيانات الجهات الحكومية",
        referenceNumber: "21/2023", year: 2023,
        subject: "Data Classification", subjectAr: "تصنيف البيانات",
        content: "يُقرّ هذا القرار نظام تصنيف البيانات الحكومية وفق أربعة مستويات: عامة، ومقيدة، وسرية، وسرية للغاية. يُلزم الجهات الحكومية بتطبيق ضمانات تقنية وتنظيمية مناسبة لكل مستوى.",
        summaryAr: "يُقرّ قرار مجلس الوزراء نظام تصنيف البيانات الحكومية في أربعة مستويات مع الضمانات التقنية المطلوبة لكل تصنيف.",
      },

      // ── UAE Case Law (12 records) ────────────────────────────────────────────
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم محكمة التمييز في الطعن التجاري رقم 547/2022",
        referenceNumber: "547/2022", year: 2022,
        subject: "Contract Breach", subjectAr: "إخلال بالعقد",
        courtLevel: "محكمة التمييز",
        content: "قضت محكمة التمييز بأن الإخلال بشرط عدم المنافسة يُعدّ ضاراً بمصالح صاحب العمل ويستوجب التعويض وفق المادة 127 من قانون العمل. أكدت المحكمة أن شرط عدم المنافسة يكون نافذاً متى كان محدداً زمنياً وجغرافياً ومهنياً، وأن مدة سنة واحدة في نطاق دولة الإمارات معقولة.",
        summaryAr: "قضت محكمة التمييز بتعويض صاحب العمل عن الإخلال بشرط عدم المنافسة استناداً إلى المادة 127 من قانون العمل، مشترطةً التحديد الزمني والجغرافي والمهني.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم محكمة الاستئناف في الطعن العقاري رقم 215/2023",
        referenceNumber: "215/2023", year: 2023,
        subject: "Real Estate", subjectAr: "العقارات",
        courtLevel: "محكمة الاستئناف",
        content: "أكدت محكمة الاستئناف أن عقد البيع العقاري لا يكتمل إلا بالتسجيل في دائرة الأراضي والأملاك، وأن مجرد توقيع العقد لا يُنشئ حقاً عينياً. فسّرت المحكمة المادة 1259 من قانون المعاملات المدنية تفسيراً واسعاً يشترط الشكلية في عقود العقارات.",
        summaryAr: "أكدت المحكمة أن نقل ملكية العقار يستلزم التسجيل الرسمي في الدائرة المختصة، ولا يكفي مجرد توقيع العقد لإنشاء الحق العيني.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم المحكمة الاتحادية العليا في قضية الشركات رقم 178/2021",
        referenceNumber: "178/2021", year: 2021,
        subject: "Company Law", subjectAr: "قانون الشركات",
        courtLevel: "المحكمة الاتحادية العليا",
        content: "قررت المحكمة الاتحادية العليا أن مساهمي الشركة المساهمة لا يسألون شخصياً عن ديون الشركة إلا في حالات الغش أو التعسف في استخدام الشخصية الاعتبارية، مُرسيةً مبدأ الحجاب الشركي في القانون الإماراتي.",
        summaryAr: "رسّخت المحكمة مبدأ الحجاب الشركي مع الاستثناءات المتعلقة بالغش وإساءة استخدام الشخصية الاعتبارية في قانون الشركات الإماراتي.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم دائرة التمييز التجارية رقم 312/2022",
        referenceNumber: "312/2022", year: 2022,
        subject: "Arbitration Clause", subjectAr: "شرط التحكيم",
        courtLevel: "محكمة التمييز",
        content: "قررت المحكمة أن شرط التحكيم الوارد في العقد يُلزم المحكمة بالتوقف عن النظر في الدعوى والإحالة إلى التحكيم، ما لم يكن الشرط باطلاً بطلاناً صريحاً. أكدت المحكمة أن القضاء الإماراتي يُكرّس استقلالية شرط التحكيم عن سائر شروط العقد.",
        summaryAr: "أكدت المحكمة مبدأ استقلالية شرط التحكيم وإلزامية الإحالة إلى التحكيم عند وجوده في العقد ما لم يكن باطلاً.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم المحكمة الابتدائية دبي في قضية حماية البيانات رقم 456/2023",
        referenceNumber: "456/2023", year: 2023,
        subject: "Data Protection", subjectAr: "حماية البيانات",
        courtLevel: "المحكمة الابتدائية",
        content: "قضت المحكمة بتعويض المدعي عن انتهاك بياناته الشخصية من قِبل شركة تجارية بموجب مرسوم بقانون رقم 45 لسنة 2021، مُرسيةً معايير واضحة للضرر المادي والمعنوي الناجم عن انتهاك البيانات.",
        summaryAr: "أرست المحكمة معايير تعويض واضحة عن انتهاكات البيانات الشخصية استناداً إلى قانون حماية البيانات 2021.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم محكمة النقض في طعن العمالة رقم 892/2022",
        referenceNumber: "892/2022", year: 2022,
        subject: "End of Service Benefits", subjectAr: "مكافأة نهاية الخدمة",
        courtLevel: "محكمة النقض",
        content: "فصلت محكمة النقض في مسألة احتساب مكافأة نهاية الخدمة عند تغيير طبيعة العقد من عقد محدد المدة إلى غير محدد، مُقررةً أن مدة الخدمة تُحتسب متراكمة دون انقطاع.",
        summaryAr: "قررت المحكمة أن التحول من عقد محدد المدة إلى غير محدد لا يُقطع تراكم مدة الخدمة عند احتساب مكافأة نهاية الخدمة.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم دائرة المنازعات المدنية أبوظبي رقم 105/2023",
        referenceNumber: "105/2023", year: 2023,
        subject: "Tort Liability", subjectAr: "المسؤولية التقصيرية",
        courtLevel: "محكمة الاستئناف",
        content: "طبّقت المحكمة مبدأ السببية في المسؤولية التقصيرية وقررت أن التعويض يشمل الضرر المباشر والضرر غير المباشر المتوقع، مستندةً إلى المادة 282 وما بعدها من قانون المعاملات المدنية.",
        summaryAr: "طبّقت المحكمة مبدأ السببية وقررت شمول التعويض للضرر المباشر والمتوقع غير المباشر وفق قانون المعاملات المدنية.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "ruling", language: "ar",
        title: "قرار الدائرة الجنائية في محكمة التمييز رقم 733/2023",
        referenceNumber: "733/2023", year: 2023,
        subject: "Cybercrime", subjectAr: "الجرائم الإلكترونية",
        courtLevel: "محكمة التمييز",
        content: "فسّرت المحكمة نطاق تطبيق قانون مكافحة الجرائم المعلوماتية على نشر المحتوى المُسيء عبر منصات التواصل الاجتماعي، مُقررةً أن حق التعبير لا يُسوّغ انتهاك كرامة الأشخاص أو الترويج لمحتوى يُثير الفتنة.",
        summaryAr: "فسّرت المحكمة حدود تطبيق قانون الجرائم المعلوماتية على محتوى وسائل التواصل الاجتماعي مُرجّحةً حماية الكرامة على حرية التعبير.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم المحكمة الاتحادية العليا في قضية الإفلاس رقم 23/2022",
        referenceNumber: "23/2022", year: 2022,
        subject: "Insolvency", subjectAr: "الإعسار والإفلاس",
        courtLevel: "المحكمة الاتحادية العليا",
        content: "فصلت المحكمة في أولوية الدائنين في إجراءات التصفية بموجب قانون الإفلاس، مُقررةً أن ديون الموظفين ومكافآت نهاية خدمتهم تحتل مرتبة متقدمة على سائر الدائنين غير المضمونين.",
        summaryAr: "قررت المحكمة تقدّم ديون الموظفين ومكافآت نهاية الخدمة على الدائنين غير المضمونين في إجراءات التصفية.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم دبي الدولية في قضية التحكيم التجاري رقم DIFC-ARB-2022-001",
        referenceNumber: "DIFC-ARB-2022-001", year: 2022,
        subject: "International Arbitration", subjectAr: "التحكيم الدولي",
        courtLevel: "محاكم مركز دبي المالي الدولي",
        content: "قضت محاكم مركز دبي المالي الدولي بتنفيذ حكم تحكيم أجنبي صادر عن مركز لندن للتحكيم الدولي، مؤكدةً التزام الإمارات باتفاقية نيويورك لسنة 1958 وشروط تنفيذ أحكام التحكيم الأجنبية.",
        summaryAr: "أكدت محاكم DIFC التزام الإمارات باتفاقية نيويورك ونفّذت حكم تحكيم لندني وفق الشروط المقررة لتنفيذ الأحكام الأجنبية.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "judgment", language: "ar",
        title: "حكم محكمة الاستئناف في نزاع الملكية الفكرية رقم 341/2021",
        referenceNumber: "341/2021", year: 2021,
        subject: "Intellectual Property", subjectAr: "الملكية الفكرية",
        courtLevel: "محكمة الاستئناف",
        content: "قضت المحكمة بتعويض صاحب العلامة التجارية عن تقليدها، محددةً معايير التقليد الجوهري والخلط في ذهن المستهلك، ومُقررةً أن الشهرة التجارية تُعزز الحماية الممنوحة للعلامة.",
        summaryAr: "حدّدت المحكمة معايير التقليد الجوهري للعلامة التجارية وأثر الشهرة في تعزيز نطاق الحماية القانونية.",
      },
      {
        jurisdiction: "uae_caselaw", docType: "circular", language: "ar",
        title: "منشور وزارة العدل بشأن تطبيق منظومة التقاضي الإلكتروني",
        referenceNumber: "W-2023-15", year: 2023,
        subject: "Electronic Litigation", subjectAr: "التقاضي الإلكتروني",
        courtLevel: "وزارة العدل",
        content: "يُلزم هذا المنشور جميع المحاكم الاتحادية بقبول المذكرات والطعون والمستندات إلكترونياً عبر بوابة وزارة العدل، ويُحدد المتطلبات التقنية والإجرائية لاعتماد المستندات الإلكترونية.",
        summaryAr: "يُلزم المنشور المحاكم الاتحادية بقبول المذكرات والمستندات إلكترونياً عبر بوابة وزارة العدل مع تحديد المتطلبات الإجرائية.",
      },

      // ── French Law (11 records) ──────────────────────────────────────────────
      {
        jurisdiction: "france", docType: "code", language: "fr",
        title: "Code civil français — Droit des obligations",
        titleAr: "القانون المدني الفرنسي — قانون الالتزامات",
        referenceNumber: "Code civil / Articles 1100-1386", year: 2016,
        subject: "Civil Obligations", subjectAr: "الالتزامات المدنية",
        content: "Le droit des obligations français repose sur le Code civil de 1804, profondément réformé par l'ordonnance n°2016-131 du 10 février 2016. Il régit la formation, la validité et les effets des contrats, le régime général des obligations, ainsi que la responsabilité civile extracontractuelle. Le principe de bonne foi est désormais expressément consacré à l'article 1104.",
        summary: "French civil obligations law, updated by the 2016 reform, governs contract formation, validity, and effects, emphasizing good faith and freedom of contract.",
        summaryAr: "يُنظّم قانون الالتزامات الفرنسي المُحدَّث عام 2016 تكوين العقود وصحتها وآثارها، مع التركيز على مبدأ حسن النية وحرية التعاقد.",
      },
      {
        jurisdiction: "france", docType: "code", language: "fr",
        title: "Code du travail — Contrat de travail à durée indéterminée",
        titleAr: "قانون العمل الفرنسي — عقد العمل غير محدد المدة",
        referenceNumber: "L1221-1 à L1237-20", year: 2008,
        subject: "Labour Law", subjectAr: "قانون العمل",
        content: "Le Code du travail français définit le contrat à durée indéterminée (CDI) comme la forme normale du contrat de travail. Il prévoit des protections strictes contre le licenciement abusif, notamment la procédure obligatoire d'entretien préalable, la notification par lettre recommandée, et le contrôle judiciaire de la cause réelle et sérieuse de licenciement.",
        summaryAr: "يُعرِّف قانون العمل الفرنسي عقد العمل غير محدد المدة باعتباره الشكل الأصلي للعقد، مع ضمانات صارمة ضد الفصل التعسفي.",
      },
      {
        jurisdiction: "france", docType: "code", language: "fr",
        title: "Code de commerce — Droit des sociétés commerciales",
        titleAr: "قانون التجارة الفرنسي — قانون الشركات التجارية",
        referenceNumber: "L210-1 et suivants", year: 2001,
        subject: "Company Law", subjectAr: "قانون الشركات",
        content: "Le Code de commerce français régit la constitution, le fonctionnement et la dissolution des sociétés commerciales (SA, SAS, SARL, SNC). La SAS (Société par actions simplifiée) est devenue la forme préférée en raison de sa grande liberté statutaire. Les règles de gouvernance incluent les organes de direction, les commissaires aux comptes, et la responsabilité des dirigeants.",
        summary: "French commercial company law regulates SA, SAS, SARL and SNC company types with SAS being the most flexible for contractual governance.",
        summaryAr: "يُنظّم قانون التجارة الفرنسي أشكال الشركات التجارية من مساهمة مبسطة وذات مسؤولية محدودة وتضامنية، مع إطار حوكمة واضح.",
      },
      {
        jurisdiction: "france", docType: "law", language: "fr",
        title: "Loi Informatique et Libertés (modifiée par la loi RGPD)",
        titleAr: "قانون المعلوماتية والحريات الفرنسي المُعدَّل بموجب RGPD",
        referenceNumber: "78-17", year: 2018,
        subject: "Data Protection", subjectAr: "حماية البيانات",
        content: "La loi Informatique et Libertés, modifiée pour s'aligner sur le RGPD, confère à la CNIL des pouvoirs de contrôle et de sanction renforcés. Elle prévoit des dispositions spécifiques pour le traitement des données en matière de sécurité publique, de recherche, et de santé. La violation peut entraîner des amendes jusqu'à 4% du chiffre d'affaires mondial.",
        summary: "France's data protection law, updated to align with GDPR, empowers the CNIL authority with enforcement powers and fines up to 4% of global turnover.",
        summaryAr: "يُواءم القانون الفرنسي للمعلوماتية والحريات المُعدَّل الإطارَ الوطني مع اللائحة الأوروبية GDPR ويمنح هيئة CNIL صلاحيات إنفاذ موسّعة.",
      },
      {
        jurisdiction: "france", docType: "judgment", language: "fr",
        title: "Cour de cassation — Arrêt sur le principe de bonne foi contractuelle",
        titleAr: "محكمة النقض الفرنسية — حكم حول مبدأ حسن النية التعاقدية",
        referenceNumber: "Cass. Com. 15-3-2021", year: 2021,
        subject: "Contract Law", subjectAr: "قانون العقود",
        content: "La Cour de cassation a jugé que l'obligation de bonne foi dans l'exécution des contrats (article 1104 du Code civil) ne permet pas de modifier le contenu du contrat mais impose aux parties d'agir loyalement et de faciliter l'exécution des obligations de l'autre partie. Ce principe s'applique dès la phase de négociation.",
        summary: "French Court of Cassation ruled that good faith obligations do not allow modification of contract terms but require loyal conduct and facilitation of performance.",
        summaryAr: "قضت محكمة النقض الفرنسية بأن التزام حسن النية لا يُجيز تعديل مضمون العقد لكنه يستوجب التصرف بأمانة وتسهيل تنفيذ الالتزامات.",
      },
      {
        jurisdiction: "france", docType: "law", language: "fr",
        title: "Loi Macron — Réforme des professions réglementées",
        titleAr: "قانون ماكرون — إصلاح المهن المُنظَّمة",
        referenceNumber: "2015-990", year: 2015,
        subject: "Regulated Professions", subjectAr: "المهن المُنظَّمة",
        content: "La loi Macron a libéralisé plusieurs professions réglementées (notaires, huissiers, avocats au Conseil) en assouplissant les conditions d'installation, en permettant les sociétés interprofessionnelles, et en modernisant les tarifs. Elle a également renforcé la transparence dans les marchés publics.",
        summaryAr: "حرّر قانون ماكرون قطاع المهن المُنظَّمة من خلال تخفيف شروط التأسيس والسماح بالشركات متعددة التخصصات وتحديث الأتعاب.",
      },
      {
        jurisdiction: "france", docType: "decree", language: "fr",
        title: "Décret sur la médiation civile et commerciale obligatoire",
        titleAr: "مرسوم الوساطة المدنية والتجارية الإلزامية",
        referenceNumber: "2023-357", year: 2023,
        subject: "Alternative Dispute Resolution", subjectAr: "الوساطة الإلزامية",
        content: "Le décret étend l'obligation de tentative préalable de médiation avant tout recours judiciaire aux litiges commerciaux de moins de 5 000 euros. Il fixe les conditions d'agrément des médiateurs, les délais de la procédure de médiation, et les effets sur la prescription.",
        summaryAr: "يُوسّع المرسوم إلزامية محاولة الوساطة قبل التقاضي في النزاعات التجارية، ويُحدد شروط اعتماد الوسطاء وآثار الوساطة على مدد التقادم.",
      },
      {
        jurisdiction: "france", docType: "code", language: "fr",
        title: "Code pénal — Infractions économiques et financières",
        titleAr: "قانون العقوبات الفرنسي — الجرائم الاقتصادية والمالية",
        referenceNumber: "Livre III, Titre I, II", year: 2010,
        subject: "Criminal Law", subjectAr: "القانون الجنائي",
        content: "Le Code pénal français incrimine les escroqueries, les abus de confiance, les délits d'initiés, la corruption active et passive, et le blanchiment de capitaux. Les personnes morales sont pénalement responsables en vertu de l'article 121-2. Les peines peuvent atteindre 10 ans d'emprisonnement et des amendes de plusieurs millions d'euros.",
        summaryAr: "يُجرّم قانون العقوبات الفرنسي الاحتيال وخيانة الأمانة والتداول بمعلومات داخلية والرشوة وغسل الأموال، مع المسؤولية الجنائية للشخص المعنوي.",
      },
      {
        jurisdiction: "france", docType: "judgment", language: "fr",
        title: "Conseil d'État — Arrêt sur le droit à l'oubli numérique",
        titleAr: "مجلس الدولة الفرنسي — حكم حق النسيان الرقمي",
        referenceNumber: "CE 6 déc. 2019", year: 2019,
        subject: "Data Protection", subjectAr: "حماية البيانات",
        content: "Le Conseil d'État a confirmé que le droit au déréférencement (droit à l'oubli) s'applique à l'échelle mondiale pour les données sensibles ou portant gravement atteinte à la vie privée, tout en reconnaissant la possibilité d'un déréférencement limité à l'UE pour les données moins sensibles. Il établit un équilibre entre liberté d'information et protection de la vie privée.",
        summary: "French Council of State confirmed global scope of right to be forgotten for sensitive data while allowing EU-only delisting for less sensitive information.",
        summaryAr: "أكد مجلس الدولة الفرنسي سريان حق النسيان بنطاق عالمي للبيانات الحساسة، مع إمكانية تحديد نطاقه بالاتحاد الأوروبي للبيانات الأقل حساسية.",
      },
      {
        jurisdiction: "france", docType: "law", language: "fr",
        title: "Loi Sapin II — Transparence et lutte contre la corruption",
        titleAr: "قانون سابان الثاني — الشفافية ومكافحة الفساد",
        referenceNumber: "2016-1691", year: 2016,
        subject: "Anti-Corruption", subjectAr: "مكافحة الفساد",
        content: "La loi Sapin II a créé l'Agence française anticorruption (AFA) et imposé aux grandes entreprises l'obligation de mettre en place des dispositifs de prévention et de détection de la corruption (cartographie des risques, code de conduite, dispositif d'alerte, évaluation des tiers). Elle a également introduit la convention judiciaire d'intérêt public.",
        summary: "France's Sapin II anti-corruption law created the AFA agency and imposed compliance obligations on large companies including risk mapping, codes of conduct, and whistleblower protection.",
        summaryAr: "أنشأ قانون سابان الثاني وكالة مكافحة الفساد الفرنسية وأوجب على الشركات الكبرى برامج امتثال شاملة لمكافحة الرشوة وحماية المبلّغين عن المخالفات.",
      },
      {
        jurisdiction: "france", docType: "code", language: "fr",
        title: "Code de la propriété intellectuelle — Droit d'auteur",
        titleAr: "قانون الملكية الفكرية الفرنسي — حق المؤلف",
        referenceNumber: "L111-1 et suivants", year: 1992,
        subject: "Intellectual Property", subjectAr: "الملكية الفكرية",
        content: "Le droit d'auteur français protège les œuvres de l'esprit dès leur création, sans formalité de dépôt. La durée de protection est de 70 ans après la mort de l'auteur. La France consacre un droit moral inaliénable et perpétuel à l'auteur, distinct des droits patrimoniaux. L'exception de courte citation et les exceptions pédagogiques sont strictement encadrées.",
        summaryAr: "يحمي حق المؤلف الفرنسي المصنفات الفكرية منذ إبداعها دون اشتراط إيداع، لمدة 70 سنة بعد وفاة المؤلف، مع حق أدبي غير قابل للتنازل.",
      },

      // ── EU Law (11 records) ──────────────────────────────────────────────────
      {
        jurisdiction: "eu", docType: "regulation", language: "en",
        title: "General Data Protection Regulation (GDPR)",
        titleAr: "اللائحة العامة لحماية البيانات (GDPR)",
        referenceNumber: "2016/679", year: 2018,
        subject: "Data Protection", subjectAr: "حماية البيانات",
        content: "The GDPR is a comprehensive data protection framework applicable across the EU. It establishes principles for lawful processing (Article 5), data subject rights (access, erasure, portability, objection — Articles 15-22), and imposes obligations on controllers and processors including DPIAs, Records of Processing Activities, and Data Breach Notifications. Maximum fines reach €20 million or 4% of global annual turnover.",
        summary: "The EU GDPR (2016/679) regulates personal data processing, establishing key principles, data subject rights, and compliance obligations for organisations operating in or targeting EU residents.",
        summaryAr: "تُنظّم اللائحة الأوروبية لحماية البيانات (GDPR) معالجة البيانات الشخصية وتُرسي مبادئ الشرعية وحقوق الأفراد والتزامات المؤسسات.",
      },
      {
        jurisdiction: "eu", docType: "directive", language: "en",
        title: "Directive on Copyright in the Digital Single Market",
        titleAr: "توجيه حقوق المؤلف في السوق الرقمية الموحدة",
        referenceNumber: "2019/790", year: 2019,
        subject: "Intellectual Property", subjectAr: "الملكية الفكرية",
        content: "This Directive modernises EU copyright rules for the digital environment. It introduces upload filters for platforms (Article 17), a press publishers' right (Article 15), and exceptions for text and data mining for research institutions (Articles 3-4). Member states must implement these provisions, creating significant obligations for online platforms hosting user-generated content.",
        summaryAr: "يُحدِّث هذا التوجيه قواعد حقوق المؤلف الأوروبية للبيئة الرقمية، ويُنظّم فلاتر الرفع وحقوق الناشرين والاستثناءات للتحليل النصي.",
      },
      {
        jurisdiction: "eu", docType: "regulation", language: "en",
        title: "Digital Markets Act (DMA)",
        titleAr: "قانون الأسواق الرقمية الأوروبي",
        referenceNumber: "2022/1925", year: 2022,
        subject: "Digital Regulation", subjectAr: "تنظيم الأسواق الرقمية",
        content: "The DMA introduces ex-ante rules for 'gatekeeper' platforms (Google, Apple, Meta, Amazon, Microsoft, ByteDance). Gatekeepers must allow third-party interoperability, share data with business users, and avoid self-preferencing. Non-compliance can lead to fines of up to 10% of global annual turnover and, for systematic violations, up to 20% or behavioural remedies.",
        summary: "EU's Digital Markets Act regulates 'gatekeeper' platforms with ex-ante obligations on interoperability, data sharing, and prohibition of self-preferencing.",
        summaryAr: "يُنظّم قانون الأسواق الرقمية الأوروبي منصات 'حارسة البوابات' بالتزامات مسبقة تشمل قابلية التشغيل البيني وتبادل البيانات وحظر تفضيل الخدمات الذاتية.",
      },
      {
        jurisdiction: "eu", docType: "regulation", language: "en",
        title: "Digital Services Act (DSA)",
        titleAr: "قانون الخدمات الرقمية الأوروبي",
        referenceNumber: "2022/2065", year: 2022,
        subject: "Digital Services", subjectAr: "الخدمات الرقمية",
        content: "The DSA creates a comprehensive liability and accountability framework for digital services. Very Large Online Platforms (VLOPs) face additional obligations: risk assessments, independent audits, researcher data access, and crisis response protocols. It prohibits targeted advertising based on sensitive data and targeting of minors. The European Commission directly supervises VLOPs.",
        summary: "EU Digital Services Act regulates online platforms with tiered obligations, banning targeted ads for minors and requiring risk assessments for very large platforms.",
        summaryAr: "يُنشئ قانون الخدمات الرقمية إطاراً تنظيمياً متدرجاً للمنصات الرقمية ويحظر الإعلانات المستهدفة للقاصرين ويُلزم المنصات الكبرى بتقييمات المخاطر.",
      },
      {
        jurisdiction: "eu", docType: "regulation", language: "en",
        title: "EU Artificial Intelligence Act",
        titleAr: "قانون الذكاء الاصطناعي الأوروبي",
        referenceNumber: "2024/1689", year: 2024,
        subject: "Artificial Intelligence", subjectAr: "الذكاء الاصطناعي",
        content: "The EU AI Act establishes a risk-based regulatory framework for AI systems: prohibited AI practices (social scoring, real-time biometric surveillance), high-risk AI systems (employment, education, justice — requiring conformity assessments), and limited/minimal risk systems. General Purpose AI models (GPAIs) like large language models face transparency and systemic risk requirements.",
        summary: "The EU AI Act creates a risk-tiered framework regulating AI from prohibited practices to high-risk systems requiring conformity assessments.",
        summaryAr: "يُنشئ قانون الذكاء الاصطناعي الأوروبي إطاراً تنظيمياً مبنياً على المخاطر يُنظّم تطبيقات الذكاء الاصطناعي من المحظورة إلى عالية المخاطر.",
      },
      {
        jurisdiction: "eu", docType: "directive", language: "en",
        title: "Anti-Money Laundering Directive (AMLD6)",
        titleAr: "التوجيه السادس لمكافحة غسل الأموال (AMLD6)",
        referenceNumber: "2018/1673", year: 2018,
        subject: "Anti-Money Laundering", subjectAr: "مكافحة غسل الأموال",
        content: "AMLD6 harmonises criminal law on money laundering across the EU. It extends the list of predicate offences (now 22 categories including cybercrime and environmental crime), extends criminal liability to legal persons, and introduces minimum sanctions of 4 years imprisonment. Aiding, abetting, and attempting are also criminalised.",
        summary: "AMLD6 harmonises EU criminal law on money laundering, expanding predicate offences to 22 categories and requiring corporate criminal liability.",
        summaryAr: "يُوحّد التوجيه السادس لمكافحة غسل الأموال القانون الجنائي الأوروبي في هذا المجال ويُوسّع الجرائم الأصلية إلى 22 فئة مع المسؤولية الجنائية للأشخاص المعنويين.",
      },
      {
        jurisdiction: "eu", docType: "regulation", language: "en",
        title: "EU Markets in Crypto-Assets Regulation (MiCA)",
        titleAr: "لائحة أسواق الأصول المشفرة الأوروبية (MiCA)",
        referenceNumber: "2023/1114", year: 2023,
        subject: "Crypto-Assets", subjectAr: "الأصول المشفرة",
        content: "MiCA creates the first comprehensive EU framework for crypto-assets not covered by existing financial services law. It regulates issuers of asset-referenced tokens (ARTs) and e-money tokens (EMTs), as well as Crypto-Asset Service Providers (CASPs). Stablecoin issuers face strict capital and reserve requirements. CASPs require authorisation and must maintain client asset segregation.",
        summary: "MiCA establishes the EU's comprehensive framework for crypto-asset regulation covering issuers of stablecoins and service providers.",
        summaryAr: "تُنشئ لائحة MiCA الإطار الأوروبي الشامل لتنظيم الأصول المشفرة وموفري خدماتها ومُصدري العملات المستقرة.",
      },
      {
        jurisdiction: "eu", docType: "directive", language: "en",
        title: "EU Whistleblower Protection Directive",
        titleAr: "توجيه الاتحاد الأوروبي لحماية المُبلِّغين عن المخالفات",
        referenceNumber: "2019/1937", year: 2019,
        subject: "Whistleblower Protection", subjectAr: "حماية المُبلِّغين عن المخالفات",
        content: "This Directive requires organisations with 50+ employees to establish internal reporting channels. Whistleblowers reporting violations of EU law are protected against retaliation. The Directive covers a broad scope of EU law including public procurement, financial services, data protection, and environmental law. Member states may extend protection to additional national law violations.",
        summary: "EU Whistleblower Directive mandates internal reporting channels for organisations with 50+ employees and protects reporters from retaliation.",
        summaryAr: "يُوجب التوجيه الأوروبي على المنظمات التي تضم 50 موظفاً أو أكثر إنشاء قنوات إبلاغ داخلية ويحمي المُبلِّغين من الانتقام.",
      },
      {
        jurisdiction: "eu", docType: "judgment", language: "en",
        title: "CJEU — Schrems II (Data Transfer to Third Countries)",
        titleAr: "محكمة العدل الأوروبية — شريمز الثاني (نقل البيانات لدول ثالثة)",
        referenceNumber: "C-311/18", year: 2020,
        subject: "Data Protection", subjectAr: "حماية البيانات",
        content: "The Court of Justice of the EU invalidated the EU-US Privacy Shield in Schrems II, finding that US surveillance laws do not provide adequate protection for EU personal data. The Court upheld Standard Contractual Clauses (SCCs) as a valid transfer mechanism but required case-by-case transfer impact assessments. This ruling significantly impacts global data flows from the EU.",
        summary: "CJEU's Schrems II invalidated EU-US Privacy Shield and required mandatory Transfer Impact Assessments for data transfers to third countries using SCCs.",
        summaryAr: "ألغت محكمة العدل الأوروبية درع الخصوصية بين الاتحاد الأوروبي والولايات المتحدة وفرضت تقييم أثر النقل لكل عملية نقل بيانات لدول ثالثة.",
      },
      {
        jurisdiction: "eu", docType: "regulation", language: "en",
        title: "EU Corporate Sustainability Reporting Directive (CSRD)",
        titleAr: "توجيه إعداد تقارير الاستدامة للشركات الأوروبية (CSRD)",
        referenceNumber: "2022/2464", year: 2022,
        subject: "ESG / Sustainability", subjectAr: "الاستدامة والمسؤولية",
        content: "The CSRD replaces the Non-Financial Reporting Directive (NFRD) and substantially expands sustainability reporting requirements. Large companies must report on environmental (Taxonomy Regulation aligned), social, and governance (ESG) matters using European Sustainability Reporting Standards (ESRS). Third-country companies with significant EU operations are also in scope.",
        summary: "EU CSRD requires large companies to report on ESG matters using standardised European Sustainability Reporting Standards, extending to third-country companies.",
        summaryAr: "يُلزم التوجيه الأوروبي CSRD الشركات الكبرى بالإفصاح عن أداء الاستدامة وفق المعايير الأوروبية ESRS بما يشمل الشركات غير الأوروبية ذات النشاط الكبير في السوق الأوروبية.",
      },
      {
        jurisdiction: "eu", docType: "directive", language: "en",
        title: "EU Directive on Corporate Sustainability Due Diligence (CS3D)",
        titleAr: "توجيه العناية الواجبة في مجال الاستدامة للشركات",
        referenceNumber: "2024/1760", year: 2024,
        subject: "Supply Chain Due Diligence", subjectAr: "العناية الواجبة في سلاسل التوريد",
        content: "CS3D requires large EU companies and certain non-EU companies to conduct human rights and environmental due diligence across their supply chains. Companies must identify, prevent, and address actual and potential adverse impacts. Directors have a duty to integrate sustainability into corporate strategy. Penalties can reach 5% of global net turnover.",
        summary: "EU CS3D mandates supply chain human rights and environmental due diligence for large companies with penalties up to 5% of global turnover.",
        summaryAr: "يُوجب توجيه CS3D على الشركات الكبرى إجراء العناية الواجبة بشأن حقوق الإنسان والبيئة في سلاسل التوريد تحت طائلة غرامات تبلغ 5% من حجم الأعمال العالمي.",
      },
    ]);
    logger.info("Seeded legal sources: UAE legislation (12), UAE case law (12), French law (11), EU law (11) = 46 records");
  }

  // ─── NRME Risk Categories ────────────────────────────────────────────────────
  await seedRiskCategories();
  logger.info("Seeded NRME risk categories (9 UAE gov categories — idempotent)");
}
