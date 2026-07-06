import type { ProfessionConfig } from "../../types.js";

// ─── Shared workflow factory for governance/oversight professions ──────────────
function govStages(role: string, legalRef: string) {
  return [
    {
      id: "s1_scope", title: "تحديد نطاق المهمة", description: "تعريف نطاق وأهداف المهمة الرقابية", icon: "🎯",
      questions: [
        { id: "mandate", text: `ما نطاق مهمة ${role} في هذه الحالة؟`, type: "text" as const, required: true, minLength: 30 },
        { id: "authority_ok", text: "هل لديك التفويض الرسمي لتنفيذ هذه المهمة؟", type: "boolean" as const, required: true, decisionKey: "authority_ok" },
        { id: "risk_area", text: "ما مجال المخاطر أو القصور المُحتمَل؟", type: "select" as const, required: true, options: ["امتثال قانوني","حوكمة","مالي","تشغيلي","سمعة","أمني","بيئي"], decisionKey: "risk_area" },
      ],
      defaultNextStageId: "s2_evidence",
    },
    {
      id: "s2_evidence", title: "جمع الأدلة والبيانات", description: "تجميع الوثائق والبيانات اللازمة", icon: "📊",
      questions: [
        { id: "data_sources", text: "ما مصادر البيانات التي اطلعت عليها؟", type: "multiselect" as const, required: true, options: ["السجلات المالية","السياسات والإجراءات","التقارير الدورية","سجلات الموظفين","عقود المشتريات","أنظمة المعلومات","مقابلات الموظفين"] },
        { id: "gaps_found", text: "هل وجدت فجوات أو مخالفات أولية؟", type: "boolean" as const, required: true, decisionKey: "gaps_found" },
        { id: "documentation_quality", text: "ما تقييمك لجودة التوثيق لدى الجهة؟", type: "select" as const, required: true, options: ["ممتازة","جيدة","مقبولة","ضعيفة — تحتاج تحسيناً"] },
      ],
      defaultNextStageId: "s3_findings",
    },
    {
      id: "s3_findings", title: "النتائج والتوصيات", description: "صياغة النتائج وتوصيات المعالجة", icon: "📋",
      questions: [
        { id: "main_findings", text: "ما أبرز النتائج التي توصلت إليها؟", type: "text" as const, required: true, minLength: 40, hint: `المرجع: ${legalRef}` },
        { id: "severity", text: "ما درجة خطورة المخالفات/الفجوات المكتشفة؟", type: "select" as const, required: true, options: ["حرجة — تهدد الاستمرارية","عالية","متوسطة","منخفضة"], decisionKey: "severity" },
        { id: "escalation_required", text: "هل تستدعي النتائج تصعيداً فورياً؟", type: "boolean" as const, required: true, decisionKey: "escalation_required" },
      ],
    },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: التدقيق الداخلي — Internal Audit
// ═════════════════════════════════════════════════════════════════════════════
const INTERNAL_AUDITOR: ProfessionConfig = {
  sectorId: "internal_audit", sectorNameAr: "التدقيق الداخلي", sectorNameEn: "Internal Audit",
  professionId: "internal_auditor", professionNameAr: "المدقق الداخلي", professionNameEn: "Internal Auditor", icon: "🔎",
  description: "المدقق الداخلي يُقيّم الأنظمة والعمليات ويكشف المخاطر ويرفع التقارير لمجلس الإدارة.",
  responsibilities: ["إعداد خطة التدقيق السنوية","تنفيذ مهام التدقيق","تقييم نظام الرقابة الداخلية","رفع تقارير التدقيق","متابعة تنفيذ التوصيات"],
  requiredCompetencies: ["معايير IIA الدولية","تحليل المخاطر","تدقيق الأنظمة","إعداد التقارير","الفهم المالي"],
  requiredAuthorities: ["صلاحية الاطلاع على جميع السجلات","صلاحية مقابلة أي موظف","صلاحية رفع تقارير مباشرة لمجلس الإدارة"],
  legalBasis: [
    { title: "معايير التدقيق الداخلي الدولية IIA", reference: "Standards for the Professional Practice of Internal Auditing — IIA", type: "standard", binding: true },
    { title: "قواعد حوكمة الشركات الحكومية", reference: "قرار مجلس الوزراء رقم 57 لسنة 2018", type: "regulation", binding: true },
    { title: "قانون المساءلة المالية", reference: "قانون اتحادي رقم 7 لسنة 2021", type: "law", binding: true },
  ],
  workflowStages: govStages("المدقق الداخلي", "معايير IIA وقواعد الحوكمة"),
  decisionTree: [
    { stageId: "s1_scope", questionId: "authority_ok", answer: "false", nextStageId: "s3_findings", addFlag: "audit_authority_gap" },
    { stageId: "s2_evidence", questionId: "gaps_found", answer: "true", nextStageId: "s3_findings", addFlag: "gaps_identified" },
    { stageId: "s3_findings", questionId: "severity", answer: "حرجة — تهدد الاستمرارية", nextStageId: "s3_findings", addFlag: "critical_finding" },
    { stageId: "s3_findings", questionId: "escalation_required", answer: "true", nextStageId: "s3_findings", addFlag: "escalation_required" },
  ],
  requiredDocuments: [
    { name: "خطة التدقيق المعتمدة", mandatory: true },
    { name: "برنامج التدقيق التفصيلي", mandatory: true },
    { name: "أوراق عمل التدقيق", mandatory: true },
    { name: "السياسات والإجراءات المُدقَّقة", mandatory: true },
    { name: "السجلات المالية ذات الصلة", mandatory: false },
    { name: "تقرير التدقيق المسودة للمراجعة", mandatory: true },
    { name: "ردود الجهة على التوصيات", mandatory: false, whenRequired: "بعد توزيع التقرير" },
  ],
  commonMistakes: [
    { mistake: "توسيع نطاق التدقيق دون تعديل الخطة", consequence: "إهدار الموارد وضعف التركيز", remedy: "الالتزام بنطاق المهمة المعتمد وتوثيق أي تغيير" },
    { mistake: "عدم مراجعة أوراق العمل مع المدير المسؤول", consequence: "نتائج غير مدعومة بالأدلة", remedy: "مراجعة إجبارية لأوراق العمل قبل رفع التقرير" },
    { mistake: "إهمال متابعة توصيات التدقيق السابقة", consequence: "تكرار نفس المشكلات دون حل", remedy: "تضمين متابعة التوصيات السابقة في كل خطة تدقيق" },
    { mistake: "التدقيق دون استقلالية كافية عن الجهة المُدقَّقة", consequence: "تضارب المصالح ونتائج غير موضوعية", remedy: "الإفصاح الفوري عن أي تضارب مصالح" },
    { mistake: "تقارير التدقيق الغامضة أو غير المحددة", consequence: "عدم قدرة الإدارة على التصرف", remedy: "صياغة توصيات محددة وقابلة للقياس والتنفيذ" },
  ],
  riskIndicators: [
    { indicator: "نتيجة حرجة تهدد الاستمرارية", severity: "high", flag: "critical_finding" },
    { indicator: "فجوات في الرقابة الداخلية", severity: "medium", flag: "gaps_identified" },
    { indicator: "غياب صلاحية التدقيق", severity: "high", flag: "audit_authority_gap" },
    { indicator: "الحاجة لتصعيد فوري", severity: "high", flag: "escalation_required" },
  ],
  escalationRules: [
    { condition: "اكتشاف غش أو احتيال مالي", escalateTo: "مجلس الإدارة / لجنة التدقيق مباشرة", mandatory: true },
    { condition: "مقاومة الإدارة لعملية التدقيق", escalateTo: "رئيس مجلس الإدارة ولجنة التدقيق", mandatory: true },
    { condition: "مخالفات جنائية محتملة", escalateTo: "الجهات القانونية والنيابة العامة", mandatory: true },
  ],
  bestPractices: [
    "اتباع نهج القائم على المخاطر في تحديد أولويات التدقيق",
    "توثيق جميع الأدلة بصورة منهجية ومنظمة",
    "مشاركة الإدارة في مراجعة النتائج قبل الإصدار",
    "التحديث المستمر لمعرفة معايير IIA",
    "الحفاظ على الاستقلالية التامة عن العمليات المُدقَّقة",
  ],
  thinkingModel: [
    { step: "الاستقلالية", question: "هل أستطيع تنفيذ هذه المهمة بموضوعية كاملة؟" },
    { step: "الأدلة", question: "هل الأدلة التي جمعتها كافية لدعم استنتاجاتي؟" },
    { step: "الأثر", question: "ما الأثر الفعلي للقصور أو المخالفة على الجهة؟" },
    { step: "التوصية", question: "هل توصياتي عملية ومحددة وقابلة للتنفيذ والقياس؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "خطة التدقيق معتمدة وملتزَم بنطاقها", category: "procedural", mandatory: true },
    { id: "fc2", item: "أوراق العمل كاملة وموثقة", category: "documentation", mandatory: true },
    { id: "fc3", item: "النتائج مدعومة بأدلة كافية", category: "quality", mandatory: true },
    { id: "fc4", item: "التوصيات محددة وقابلة للقياس", category: "quality", mandatory: true },
    { id: "fc5", item: "تضارب المصالح مُفصَح عنه", category: "legal", mandatory: true },
    { id: "fc6", item: "الإدارة راجعت مسودة التقرير", category: "procedural", mandatory: true },
    { id: "fc7", item: "التصعيد الفوري تم لأي نتيجة حرجة", category: "risk", mandatory: true },
    { id: "fc8", item: "توصيات التدقيق السابقة جُرِّدت", category: "procedural", mandatory: false },
  ],
  assessmentContext: "المدقق الداخلي في الجهة الحكومية الإماراتية — يعمل وفق معايير IIA الدولية ويُفيد مباشرة للجنة التدقيق.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الحوكمة — Governance
// ═════════════════════════════════════════════════════════════════════════════
const GOVERNANCE_OFFICER: ProfessionConfig = {
  sectorId: "governance", sectorNameAr: "الحوكمة", sectorNameEn: "Governance",
  professionId: "governance_officer", professionNameAr: "مسؤول الحوكمة", professionNameEn: "Governance Officer", icon: "🛡️",
  description: "مسؤول الحوكمة يُصمم ويُطبق أُطر الحوكمة المؤسسية ويضمن الشفافية والمساءلة.",
  responsibilities: ["تصميم إطار الحوكمة المؤسسية","مراجعة السياسات والتشريعات الداخلية","الإشراف على الامتثال المؤسسي","التقرير لمجلس الإدارة","إدارة تضارب المصالح"],
  requiredCompetencies: ["أُطر الحوكمة (COSO/OECD)","القانون الإداري","إدارة المجالس","الشفافية والإفصاح","إدارة المخاطر الاستراتيجية"],
  requiredAuthorities: ["صلاحية مراجعة القرارات","صلاحية الاطلاع على بروتوكولات الاجتماعات","صلاحية رفع تقارير مباشرة للمجلس"],
  legalBasis: [
    { title: "قرار مجلس الوزراء بشأن حوكمة المؤسسات الحكومية", reference: "قرار مجلس الوزراء رقم 57 لسنة 2018", type: "regulation", binding: true },
    { title: "مبادئ حوكمة الشركات OECD", reference: "مبادئ منظمة OECD للحوكمة 2023", type: "standard", binding: false },
    { title: "قانون مكافحة الفساد والرشوة", reference: "قانون اتحادي رقم 6 لسنة 2012", type: "law", binding: true },
  ],
  workflowStages: govStages("مسؤول الحوكمة", "إطار COSO ومبادئ OECD"),
  decisionTree: [
    { stageId: "s1_scope", questionId: "authority_ok", answer: "false", nextStageId: "s3_findings", addFlag: "authority_gap" },
    { stageId: "s2_evidence", questionId: "gaps_found", answer: "true", nextStageId: "s3_findings", addFlag: "governance_gap" },
    { stageId: "s3_findings", questionId: "severity", answer: "حرجة — تهدد الاستمرارية", nextStageId: "s3_findings", addFlag: "governance_crisis" },
    { stageId: "s3_findings", questionId: "escalation_required", answer: "true", nextStageId: "s3_findings", addFlag: "board_escalation" },
  ],
  requiredDocuments: [
    { name: "إطار الحوكمة المؤسسي المعتمد", mandatory: true },
    { name: "محاضر اجتماعات مجلس الإدارة", mandatory: true },
    { name: "سجل تضارب المصالح", mandatory: true },
    { name: "سياسات الإفصاح والشفافية", mandatory: true },
    { name: "تقارير الحوكمة الدورية", mandatory: true },
    { name: "خريطة الصلاحيات والتفويضات", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "إطار الحوكمة لا يُطبَّق فعلياً بل يبقى ورقياً", consequence: "ثغرات حوكمية تؤثر على المساءلة", remedy: "وضع آليات رقابة وقياس مستمر لمؤشرات الحوكمة" },
    { mistake: "تضارب المصالح غير موثق ولا مُدار", consequence: "تأثير على قرارات مجلس الإدارة واستقلاليته", remedy: "اعتماد سجل إلزامي لتضارب المصالح وتحديثه دورياً" },
    { mistake: "غياب سياسة واضحة للإفصاح", consequence: "ثغرات شفافية تضر بثقة المعنيين", remedy: "سياسة إفصاح موثقة ومعتمدة من المجلس" },
    { mistake: "ضعف التوثيق لقرارات مجلس الإدارة", consequence: "عدم القدرة على تتبع المساءلة", remedy: "محاضر مفصلة لجميع اجتماعات المجلس" },
    { mistake: "الخلط بين مهام الحوكمة والتدقيق الداخلي", consequence: "ضعف حدود الاختصاص بين الوظيفتين", remedy: "تحديد صريح لدور كل وظيفة في النظام الداخلي" },
  ],
  riskIndicators: [
    { indicator: "أزمة حوكمة تهدد الاستمرارية", severity: "high", flag: "governance_crisis" },
    { indicator: "فجوات في إطار الحوكمة", severity: "medium", flag: "governance_gap" },
    { indicator: "الحاجة لتصعيد للمجلس", severity: "high", flag: "board_escalation" },
    { indicator: "غياب صلاحية واضحة", severity: "medium", flag: "authority_gap" },
  ],
  escalationRules: [
    { condition: "مخالفة جسيمة لإطار الحوكمة", escalateTo: "مجلس الإدارة ورئيس لجنة التدقيق", mandatory: true },
    { condition: "احتمال فساد أو تضارب مصالح غير مُعلَن", escalateTo: "الجهات الرقابية الحكومية", mandatory: true },
    { condition: "إخفاء معلومات عن المساهمين أو الجمهور", escalateTo: "هيئة الأوراق المالية أو الجهة الرقابية", mandatory: true },
  ],
  bestPractices: [
    "تحديث إطار الحوكمة سنوياً بما يواكب التغيرات القانونية",
    "إجراء تقييم ذاتي لمجلس الإدارة كل عام",
    "تدريب أعضاء المجلس على مبادئ الحوكمة الحديثة",
    "اعتماد مؤشرات أداء واضحة لقياس فاعلية الحوكمة",
    "الإفصاح الاستباقي قبل أن تنشأ إشكاليات",
  ],
  thinkingModel: [
    { step: "الشفافية", question: "هل المعلومات الجوهرية مُفصَح عنها للأطراف ذات المصلحة؟" },
    { step: "المساءلة", question: "هل المسؤوليات محددة ومنسوبة لأصحابها بوضوح؟" },
    { step: "الاستقلالية", question: "هل قرارات المجلس مستقلة عن تأثيرات تضارب المصالح؟" },
    { step: "الاستدامة", question: "هل الحوكمة المطبقة تحمي المؤسسة على المدى البعيد؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "إطار الحوكمة معتمد ومطبق فعلياً", category: "procedural", mandatory: true },
    { id: "fc2", item: "سجل تضارب المصالح محدَّث", category: "legal", mandatory: true },
    { id: "fc3", item: "قرارات المجلس موثقة في محاضر مفصلة", category: "documentation", mandatory: true },
    { id: "fc4", item: "سياسات الإفصاح مطبقة ومراجَعة", category: "legal", mandatory: true },
    { id: "fc5", item: "مؤشرات الحوكمة قابلة للقياس", category: "quality", mandatory: true },
    { id: "fc6", item: "خريطة الصلاحيات محدثة وموزعة", category: "procedural", mandatory: true },
    { id: "fc7", item: "التقييم الذاتي للمجلس أُجري دورياً", category: "quality", mandatory: false },
    { id: "fc8", item: "النتائج الحرجة رُفعت للمجلس", category: "risk", mandatory: true },
  ],
  assessmentContext: "مسؤول الحوكمة في الجهة الإماراتية — يعمل وفق قرارات مجلس الوزراء ومبادئ OECD وإطار COSO.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الامتثال — Compliance
// ═════════════════════════════════════════════════════════════════════════════
const COMPLIANCE_OFFICER: ProfessionConfig = {
  sectorId: "compliance", sectorNameAr: "الامتثال", sectorNameEn: "Compliance",
  professionId: "compliance_officer", professionNameAr: "مسؤول الامتثال", professionNameEn: "Compliance Officer", icon: "✅",
  description: "مسؤول الامتثال يضمن التزام الجهة بالتشريعات واللوائح والمعايير وتجنب المخالفات والغرامات.",
  responsibilities: ["مراقبة الامتثال التشريعي","رفع تقارير الامتثال","إدارة مخاطر الغرامات التنظيمية","تدريب الموظفين على متطلبات الامتثال","التعامل مع الجهات الرقابية"],
  requiredCompetencies: ["إدارة الامتثال","التشريعات القطاعية","إدارة المخاطر","التدريب المؤسسي","التواصل مع الجهات الرقابية"],
  requiredAuthorities: ["صلاحية الاطلاع على جميع الأنشطة","صلاحية وقف العمليات غير المتوافقة","صلاحية رفع تقارير مباشرة للإدارة العليا"],
  legalBasis: [
    { title: "قانون مكافحة غسل الأموال وتمويل الإرهاب", reference: "مرسوم بقانون اتحادي رقم 20 لسنة 2018", type: "decree", binding: true },
    { title: "اللوائح التنظيمية للقطاع ذي الصلة", reference: "لوائح الجهة الرقابية المختصة", type: "regulation", binding: true },
    { title: "نظام مكافحة الفساد", reference: "قانون اتحادي رقم 6 لسنة 2012", type: "law", binding: true },
  ],
  workflowStages: govStages("مسؤول الامتثال", "اللوائح التنظيمية ومتطلبات الجهات الرقابية"),
  decisionTree: [
    { stageId: "s1_scope", questionId: "authority_ok", answer: "false", nextStageId: "s3_findings", addFlag: "compliance_authority_gap" },
    { stageId: "s2_evidence", questionId: "gaps_found", answer: "true", nextStageId: "s3_findings", addFlag: "compliance_gap" },
    { stageId: "s3_findings", questionId: "severity", answer: "حرجة — تهدد الاستمرارية", nextStageId: "s3_findings", addFlag: "regulatory_breach" },
    { stageId: "s3_findings", questionId: "escalation_required", answer: "true", nextStageId: "s3_findings", addFlag: "regulator_notification" },
  ],
  requiredDocuments: [
    { name: "سجل المتطلبات التنظيمية المنطبقة", mandatory: true },
    { name: "نتائج تقييم الامتثال الأخير", mandatory: true },
    { name: "سجلات التدريب على الامتثال", mandatory: true },
    { name: "المراسلات مع الجهة الرقابية", mandatory: false },
    { name: "خطة معالجة الفجوات", mandatory: false, whenRequired: "عند اكتشاف مخالفات" },
    { name: "تقرير الامتثال الدوري", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "الاعتماد على آخر تقييم دون مراجعة مستمرة", consequence: "مخالفات تنظيمية غير مُكتشَفة", remedy: "إنشاء نظام مراقبة مستمر لمتطلبات الامتثال" },
    { mistake: "عدم الإبلاغ الفوري عن المخالفات للجهة الرقابية", consequence: "تضاعف الغرامات وعقوبات الإخفاء", remedy: "سياسة واضحة للإبلاغ الاستباقي عن المخالفات" },
    { mistake: "ضعف تدريب الموظفين على متطلبات الامتثال", consequence: "مخالفات غير متعمدة تُعرِّض الجهة للعقوبات", remedy: "برامج تدريب منتظمة ومؤشرات قياس فهم الامتثال" },
    { mistake: "عدم متابعة التعديلات التنظيمية الجديدة", consequence: "استمرار الممارسات القديمة غير المتوافقة", remedy: "آلية تنبيه تلقائية لمتابعة التشريعات والتعديلات" },
    { mistake: "الفصل بين الامتثال والعمليات التشغيلية", consequence: "ثقافة مؤسسية تنظر للامتثال كعبء لا فريضة", remedy: "دمج متطلبات الامتثال في إجراءات العمل اليومية" },
  ],
  riskIndicators: [
    { indicator: "خرق تنظيمي يستوجب الإبلاغ", severity: "high", flag: "regulatory_breach" },
    { indicator: "فجوة في متطلبات الامتثال", severity: "medium", flag: "compliance_gap" },
    { indicator: "الحاجة لإخطار الجهة الرقابية", severity: "high", flag: "regulator_notification" },
    { indicator: "غياب صلاحية الامتثال", severity: "high", flag: "compliance_authority_gap" },
  ],
  escalationRules: [
    { condition: "مخالفة تنظيمية تستوجب الإبلاغ للجهة الرقابية", escalateTo: "الرئيس التنفيذي والجهة الرقابية", mandatory: true },
    { condition: "احتمال غسل الأموال أو تمويل الإرهاب", escalateTo: "وحدة الاستخبارات المالية الاتحادية فوراً", mandatory: true },
    { condition: "مقاومة الإدارة لتصحيح المخالفات", escalateTo: "مجلس الإدارة ولجنة التدقيق", mandatory: true },
  ],
  bestPractices: [
    "تحديث مصفوفة الامتثال مع كل تعديل تنظيمي",
    "إجراء فحص دوري لمستوى الامتثال في كل قسم",
    "بناء ثقافة الإبلاغ الذاتي الاستباقي",
    "التنسيق مع الجهة الرقابية قبل إجراء تغييرات جوهرية",
    "توثيق كل جهد امتثالي لبناء سجل دفاعي",
  ],
  thinkingModel: [
    { step: "التحديد", question: "ما المتطلبات التنظيمية الدقيقة المنطبقة على هذه الحالة؟" },
    { step: "الفجوة", question: "أين الفجوة بين الواقع والمتطلب؟ وما حجمها؟" },
    { step: "المعالجة", question: "ما أسرع وأفعل إجراء لسد الفجوة؟" },
    { step: "الإبلاغ", question: "هل أحتاج لإبلاغ الجهة الرقابية؟ متى وكيف؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "مصفوفة المتطلبات التنظيمية محدثة", category: "documentation", mandatory: true },
    { id: "fc2", item: "الفجوات مُحددة ومصنفة بالخطورة", category: "risk", mandatory: true },
    { id: "fc3", item: "خطة المعالجة معتمدة من الإدارة", category: "procedural", mandatory: true },
    { id: "fc4", item: "الإبلاغ الرقابي تم في مواعيده (إن لزم)", category: "legal", mandatory: true },
    { id: "fc5", item: "سجلات التدريب على الامتثال محدثة", category: "documentation", mandatory: true },
    { id: "fc6", item: "الإجراءات المخالفة أُوقفت فوراً", category: "procedural", mandatory: true },
    { id: "fc7", item: "تقرير الامتثال جاهز للإدارة العليا", category: "quality", mandatory: true },
    { id: "fc8", item: "التوصيات متابَعة حتى الإغلاق", category: "procedural", mandatory: false },
  ],
  assessmentContext: "مسؤول الامتثال في الجهة الإماراتية — يعمل مع الجهات الرقابية المعنية ويضمن الالتزام بالتشريعات الاتحادية والمحلية.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: إدارة المخاطر — Risk Management
// ═════════════════════════════════════════════════════════════════════════════
const RISK_MANAGER: ProfessionConfig = {
  sectorId: "risk_management", sectorNameAr: "إدارة المخاطر", sectorNameEn: "Risk Management",
  professionId: "risk_manager", professionNameAr: "مدير المخاطر", professionNameEn: "Risk Manager", icon: "📊",
  description: "مدير المخاطر يُحدد المخاطر المؤسسية ويُقيّمها ويُعد خطط الاستجابة للحد من أثرها.",
  responsibilities: ["تحديد وتقييم المخاطر المؤسسية","إعداد سجل المخاطر","تطوير خطط الاستجابة","رفع تقارير المخاطر للإدارة","مراجعة ومتابعة خطط التخفيف"],
  requiredCompetencies: ["إطار إدارة المخاطر ISO 31000","تحليل السيناريوهات","مصفوفة المخاطر","الاحتمالية والأثر","التخطيط للطوارئ"],
  requiredAuthorities: ["صلاحية الاطلاع على بيانات الجهة","صلاحية رفع تقارير للإدارة العليا","صلاحية تعليق إجراءات ذات مخاطر عالية"],
  legalBasis: [
    { title: "معيار ISO 31000 لإدارة المخاطر", reference: "ISO 31000:2018 Risk Management Guidelines", type: "standard", binding: false },
    { title: "قواعد حوكمة الشركات الحكومية", reference: "قرار مجلس الوزراء رقم 57 لسنة 2018", type: "regulation", binding: true },
    { title: "متطلبات إدارة الاستمرارية", reference: "ISO 22301:2019 — Business Continuity", type: "standard", binding: false },
  ],
  workflowStages: [
    {
      id: "s1_risk_id", title: "تحديد المخاطر", description: "رصد وتصنيف المخاطر المؤسسية", icon: "🔍",
      questions: [
        { id: "risk_category", text: "ما فئة المخاطر التي تتناولها؟", type: "select", required: true, options: ["مخاطر تشغيلية","مخاطر مالية","مخاطر امتثال","مخاطر استراتيجية","مخاطر سمعة","مخاطر أمنية/سيبرانية","مخاطر بيئية"], decisionKey: "risk_category" },
        { id: "risk_description", text: "صِف المخاطر المحددة بدقة.", type: "text", required: true, minLength: 40 },
        { id: "current_controls", text: "ما الضوابط الرقابية الحالية؟", type: "text", required: true, minLength: 20 },
      ],
      defaultNextStageId: "s2_assessment",
    },
    {
      id: "s2_assessment", title: "تقييم الاحتمالية والأثر", description: "قياس مستوى المخاطر وترتيب أولويتها", icon: "📈",
      questions: [
        { id: "probability", text: "ما احتمالية وقوع هذه المخاطر؟", type: "select", required: true, options: ["شبه مؤكد (>90%)","عالية (60-90%)","متوسطة (30-60%)","منخفضة (10-30%)","نادرة (<10%)"], decisionKey: "probability" },
        { id: "impact", text: "ما درجة الأثر في حال وقوع المخاطر؟", type: "select", required: true, options: ["كارثي — يهدد الاستمرارية","خطير — أثر كبير","متوسط","محدود","ضئيل"], decisionKey: "impact" },
        { id: "risk_appetite", text: "هل مستوى المخاطرة ضمن الشهية المقبولة للجهة؟", type: "boolean", required: true, decisionKey: "risk_appetite" },
      ],
      defaultNextStageId: "s3_response",
    },
    {
      id: "s3_response", title: "خطة الاستجابة", description: "تحديد استراتيجية الاستجابة للمخاطر", icon: "🛡️",
      questions: [
        { id: "response_strategy", text: "ما استراتيجية الاستجابة المقترحة؟", type: "select", required: true, options: ["تجنب المخاطر","تخفيف المخاطر","نقل المخاطر (تأمين)","قبول المخاطر مع رصدها"], decisionKey: "response_strategy" },
        { id: "action_plan", text: "ما الإجراءات التفصيلية لتنفيذ الاستراتيجية؟", type: "text", required: true, minLength: 30 },
        { id: "escalation_needed", text: "هل مستوى المخاطرة يستدعي عرضها على الإدارة العليا؟", type: "boolean", required: true, decisionKey: "escalation_needed" },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s2_assessment", questionId: "probability", answer: "شبه مؤكد (>90%)", nextStageId: "s3_response", addFlag: "imminent_risk" },
    { stageId: "s2_assessment", questionId: "impact", answer: "كارثي — يهدد الاستمرارية", nextStageId: "s3_response", addFlag: "critical_risk" },
    { stageId: "s2_assessment", questionId: "risk_appetite", answer: "false", nextStageId: "s3_response", addFlag: "risk_appetite_exceeded" },
    { stageId: "s3_response", questionId: "escalation_needed", answer: "true", nextStageId: "s3_response", addFlag: "risk_escalation" },
  ],
  requiredDocuments: [
    { name: "سجل المخاطر (Risk Register)", mandatory: true },
    { name: "مصفوفة تقييم المخاطر", mandatory: true },
    { name: "وثيقة الشهية للمخاطر المعتمدة", mandatory: true },
    { name: "خطط الاستجابة والتخفيف", mandatory: true },
    { name: "خطة الاستمرارية (BCP)", mandatory: false, whenRequired: "للمخاطر الكارثية" },
    { name: "تقرير المخاطر الدوري للإدارة", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "تقييم المخاطر دون مشاركة أصحاب الاختصاص", consequence: "فجوات في التغطية ومخاطر غير مُحددة", remedy: "إشراك جميع مديري الأقسام في رصد وتقييم مخاطرهم" },
    { mistake: "الاعتماد على سجل مخاطر قديم دون تحديث", consequence: "إغفال المخاطر الناشئة", remedy: "مراجعة وتحديث سجل المخاطر ربع سنوياً على الأقل" },
    { mistake: "خطط استجابة غير محددة الأطراف والمواعيد", consequence: "عدم التنفيذ عند الأزمات", remedy: "تحديد المسؤول والموعد والميزانية لكل إجراء" },
    { mistake: "تجاهل المخاطر الناشئة عن التغيرات البيئية", consequence: "مفاجآت غير محسوبة", remedy: "مسح بيئي دوري ومراجعة افتراضات التقييم" },
    { mistake: "ضعف ثقافة المخاطر في الجهة", consequence: "إخفاء المشكلات بدلاً من الإبلاغ عنها", remedy: "بناء ثقافة الإبلاغ الاستباقي بدون عقوبة" },
  ],
  riskIndicators: [
    { indicator: "مخاطر وشيكة الوقوع", severity: "high", flag: "imminent_risk" },
    { indicator: "مخاطر كارثية تهدد الاستمرارية", severity: "high", flag: "critical_risk" },
    { indicator: "تجاوز الشهية للمخاطر", severity: "high", flag: "risk_appetite_exceeded" },
    { indicator: "الحاجة لتصعيد للإدارة العليا", severity: "medium", flag: "risk_escalation" },
  ],
  escalationRules: [
    { condition: "مخاطر كارثية تهدد استمرارية الجهة", escalateTo: "مجلس الإدارة والإدارة العليا فوراً", mandatory: true },
    { condition: "مخاطر تتجاوز شهية المخاطر المعتمدة", escalateTo: "لجنة المخاطر وصاحب الصلاحية", mandatory: true },
    { condition: "مخاطر تتطلب تدخل جهات خارجية", escalateTo: "الجهات التنظيمية أو شركات التأمين", mandatory: false },
  ],
  bestPractices: [
    "اعتماد منهجية ISO 31000 كأساس لإطار إدارة المخاطر",
    "دمج تقييم المخاطر في عمليات التخطيط الاستراتيجي",
    "تحديث سجل المخاطر عند كل حدث أو تغيير جوهري",
    "اختبار دوري لخطط الاستمرارية والطوارئ",
    "تقارير منتظمة وشفافة عن المخاطر للإدارة والمجلس",
  ],
  thinkingModel: [
    { step: "التحديد", question: "ما المخاطر الكاملة في هذا الموقف؟ هل فاتني أي شيء؟" },
    { step: "القياس", question: "ما الاحتمالية والأثر الواقعي لكل خطر؟" },
    { step: "التأهيل", question: "هل هذا الخطر ضمن الشهية المقبولة أم يستدعي تصرفاً؟" },
    { step: "الاستجابة", question: "ما استراتيجية الاستجابة الأكثر فعالية وكفاءة؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "جميع المخاطر محددة ومدرجة في السجل", category: "documentation", mandatory: true },
    { id: "fc2", item: "الاحتمالية والأثر مُقيَّمان لكل خطر", category: "risk", mandatory: true },
    { id: "fc3", item: "خطط الاستجابة محددة بوضوح", category: "procedural", mandatory: true },
    { id: "fc4", item: "المسؤولون عن كل إجراء محددون", category: "procedural", mandatory: true },
    { id: "fc5", item: "المخاطر الحرجة رُفعت للإدارة العليا", category: "risk", mandatory: true },
    { id: "fc6", item: "الشهية للمخاطر موثقة ومعتمدة", category: "documentation", mandatory: true },
    { id: "fc7", item: "آلية رصد ومتابعة خطط التخفيف محددة", category: "quality", mandatory: true },
    { id: "fc8", item: "تقرير المخاطر جاهز للإدارة العليا", category: "documentation", mandatory: true },
  ],
  assessmentContext: "مدير المخاطر في الجهة الإماراتية — يعمل وفق ISO 31000 وإطار حوكمة الشركات الحكومية.",
};

export const GOVERNANCE_PROFESSIONS: ProfessionConfig[] = [
  INTERNAL_AUDITOR, GOVERNANCE_OFFICER, COMPLIANCE_OFFICER, RISK_MANAGER,
];
