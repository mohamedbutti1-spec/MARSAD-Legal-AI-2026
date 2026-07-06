import type { ProfessionConfig } from "../../types.js";

// ─── Shared workflow factory ──────────────────────────────────────────────────
function techStages(role: string, standard: string) {
  return [
    {
      id: "s1_scope", title: "تحديد النطاق والمعيار", description: "تحديد نطاق العمل والمعيار المنطبق", icon: "📐",
      questions: [
        { id: "scope", text: "صِف نطاق المهمة أو التحقيق بدقة.", type: "text" as const, required: true, minLength: 30 },
        { id: "standard_version", text: `ما إصدار المعيار / الإطار المطبَّق؟ (${standard})`, type: "text" as const, required: true, minLength: 5 },
        { id: "critical_issue", text: "هل ثمة مشكلة حرجة تستدعي التعامل الفوري؟", type: "boolean" as const, required: true, decisionKey: "critical_issue" },
      ],
      defaultNextStageId: "s2_assessment",
    },
    {
      id: "s2_assessment", title: "التقييم والتحليل", description: "تقييم الوضع الحالي ومقارنته بالمتطلبات", icon: "🔬",
      questions: [
        { id: "compliance_level", text: "ما مستوى الامتثال الحالي؟", type: "select" as const, required: true, options: ["ممتاز (>90%)","جيد (75-90%)","مقبول (60-75%)","ضعيف (<60%)"], decisionKey: "compliance_level" },
        { id: "gap_description", text: "صِف الفجوات أو المخالفات المحددة.", type: "text" as const, required: true, minLength: 30 },
        { id: "root_cause", text: "ما السبب الجذري للمشكلة أو الفجوة؟", type: "text" as const, required: true, minLength: 20 },
      ],
      defaultNextStageId: "s3_action",
    },
    {
      id: "s3_action", title: "إجراءات التصحيح والتحسين", description: "وضع خطة التصحيح والوقاية", icon: "🛠️",
      questions: [
        { id: "corrective_actions", text: "ما الإجراءات التصحيحية المقترحة؟", type: "text" as const, required: true, minLength: 30 },
        { id: "timeline", text: "ما الجدول الزمني للتنفيذ؟", type: "select" as const, required: true, options: ["فوري (أسبوع)","قصير الأمد (شهر)","متوسط (3 أشهر)","طويل (6 أشهر أو أكثر)"] },
        { id: "escalation", text: "هل تستدعي المشكلة تصعيداً للإدارة العليا؟", type: "boolean" as const, required: true, decisionKey: "escalation" },
      ],
    },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الجودة — Quality
// ═════════════════════════════════════════════════════════════════════════════
const QUALITY_MANAGER: ProfessionConfig = {
  sectorId: "quality", sectorNameAr: "الجودة", sectorNameEn: "Quality",
  professionId: "quality_manager", professionNameAr: "مدير الجودة", professionNameEn: "Quality Manager", icon: "🏆",
  description: "مدير الجودة يُصمم ويُطبق نظام الجودة المؤسسي ويضمن التحسين المستمر في العمليات والمخرجات.",
  responsibilities: ["تصميم وتطوير نظام إدارة الجودة","الإشراف على تدقيقات الجودة","إدارة عدم المطابقة والإجراءات التصحيحية","رفع تقارير الجودة للإدارة العليا","قيادة مبادرات التحسين المستمر"],
  requiredCompetencies: ["إدارة الجودة الشاملة TQM","منهجية PDCA","تحليل بيانات الجودة","تدقيق الجودة","Lean / Six Sigma"],
  requiredAuthorities: ["صلاحية إيقاف العملية عند وجود خطر جودة","صلاحية إصدار تقارير عدم المطابقة","صلاحية الاطلاع على بيانات الأداء"],
  legalBasis: [
    { title: "إطار إدارة الجودة الحكومي الإماراتي", reference: "نموذج EFQM / جائزة جودة الإمارات", type: "standard", binding: false },
    { title: "متطلبات جودة الخدمات الحكومية", reference: "لائحة معايير الخدمة الحكومية الاتحادية", type: "regulation", binding: true },
    { title: "دليل منهجية PDCA", reference: "W. Edwards Deming — PDCA Cycle", type: "guideline", binding: false },
  ],
  workflowStages: techStages("مدير الجودة", "ISO 9001 / EFQM / جائزة جودة الإمارات"),
  decisionTree: [
    { stageId: "s1_scope", questionId: "critical_issue", answer: "true", nextStageId: "s2_assessment", addFlag: "quality_critical_issue" },
    { stageId: "s2_assessment", questionId: "compliance_level", answer: "ضعيف (<60%)", nextStageId: "s3_action", addFlag: "major_quality_gap" },
    { stageId: "s3_action", questionId: "escalation", answer: "true", nextStageId: "s3_action", addFlag: "quality_escalation" },
  ],
  requiredDocuments: [
    { name: "دليل الجودة المعتمد", mandatory: true },
    { name: "إجراءات العمل الموثقة (SOPs)", mandatory: true },
    { name: "تقارير تدقيق الجودة", mandatory: true },
    { name: "سجلات عدم المطابقة (NCRs)", mandatory: true },
    { name: "خطط التصحيح المعتمدة (CARs)", mandatory: false },
    { name: "مؤشرات أداء الجودة", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "إغلاق عدم المطابقة دون معالجة السبب الجذري", consequence: "تكرار المشكلة ذاتها", remedy: "تطبيق منهجية 5 Why أو Ishikawa لتحديد السبب الجذري" },
    { mistake: "وثائق الجودة متقادمة وغير محدثة", consequence: "العمل خارج إجراءات الجودة", remedy: "برنامج مراجعة دورية للوثائق مع مسؤول وموعد محدد" },
    { mistake: "تدقيقات الجودة شكلية فقط", consequence: "عدم اكتشاف المشكلات الفعلية", remedy: "تدقيق يعتمد على الأدلة والبيانات لا على الإجابات الشفهية فقط" },
    { mistake: "الجودة وظيفة مدير الجودة فقط", consequence: "ثقافة جودة ضعيفة على مستوى الجهة", remedy: "نشر مسؤولية الجودة على جميع الموظفين" },
    { mistake: "عدم الاستفادة من بيانات شكاوى المستفيدين", consequence: "تفاقم مشكلات الخدمة", remedy: "تحليل شكاوى المستفيدين كمصدر رئيسي لتحسين الجودة" },
  ],
  riskIndicators: [
    { indicator: "مشكلة جودة حرجة", severity: "high", flag: "quality_critical_issue" },
    { indicator: "فجوة جودة كبيرة", severity: "high", flag: "major_quality_gap" },
    { indicator: "الحاجة لتصعيد جودة", severity: "medium", flag: "quality_escalation" },
  ],
  escalationRules: [
    { condition: "خطأ جودة يؤثر على سلامة المستفيدين", escalateTo: "القيادة التنفيذية والجهات الرقابية", mandatory: true },
    { condition: "فشل في اعتمادية المنتج/الخدمة", escalateTo: "جهة الاعتماد الخارجية", mandatory: true },
    { condition: "رفض تنفيذ إجراءات التصحيح", escalateTo: "مجلس الإدارة", mandatory: true },
  ],
  bestPractices: [
    "استخدام PDCA كمنهجية أساسية للتحسين المستمر",
    "تفعيل نظام الاقتراحات وإشراك الموظفين في التحسين",
    "مؤشرات جودة مرتبطة برضا المستفيدين",
    "مراجعة دورية لوثائق الجودة مع إصدار رسمي لكل تعديل",
    "تدقيقات داخلية مجدولة وخارجية دورية",
  ],
  thinkingModel: [
    { step: "التحديد", question: "ما المعيار وما المتطلب المحدد الذي أقيس أمامه؟" },
    { step: "القياس", question: "هل البيانات متاحة وموثوقة للحكم على مستوى الجودة؟" },
    { step: "الجذر", question: "ما السبب الجذري لهذه الفجوة وليس الأعراض فقط؟" },
    { step: "التحسين", question: "هل الإجراء التصحيحي سيمنع تكرار المشكلة؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "عدم المطابقة موثقة في السجل الرسمي", category: "documentation", mandatory: true },
    { id: "fc2", item: "السبب الجذري محدد بمنهجية", category: "quality", mandatory: true },
    { id: "fc3", item: "إجراء تصحيحي معتمد ومنفَّذ", category: "procedural", mandatory: true },
    { id: "fc4", item: "فعالية الإجراء التصحيحي تم التحقق منها", category: "quality", mandatory: true },
    { id: "fc5", item: "وثائق الجودة محدَّثة", category: "documentation", mandatory: false },
    { id: "fc6", item: "الدروس المستفادة موثَّقة ومشترَكة", category: "quality", mandatory: false },
    { id: "fc7", item: "المخاطر الحرجة رُفعت للإدارة", category: "risk", mandatory: true },
    { id: "fc8", item: "رضا المستفيدين مقاس ومُراجَع", category: "quality", mandatory: false },
  ],
  assessmentContext: "مدير الجودة في الجهة الإماراتية — يعمل وفق نموذج EFQM وجائزة جودة الإمارات.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: ISO — ISO Management
// ═════════════════════════════════════════════════════════════════════════════
const ISO_COORDINATOR: ProfessionConfig = {
  sectorId: "iso", sectorNameAr: "الأيزو (ISO)", sectorNameEn: "ISO",
  professionId: "iso_coordinator", professionNameAr: "منسق ISO", professionNameEn: "ISO Coordinator", icon: "📋",
  description: "منسق ISO يُطبق متطلبات المعايير الدولية ويُشرف على الحصول على الاعتماد والمحافظة عليه.",
  responsibilities: ["تطبيق متطلبات معيار ISO المعمول به","إعداد وثائق نظام الإدارة","الإشراف على تدقيقات الاعتماد","إدارة عدم المطابقة","ربط متطلبات ISO بالإجراءات الداخلية"],
  requiredCompetencies: ["ISO 9001 / 14001 / 27001 / 45001","تدقيق نظم الإدارة","وثائق نظام الإدارة","تحليل السياق","إدارة المخاطر ISO"],
  requiredAuthorities: ["صلاحية تمثيل الجهة أمام هيئة الاعتماد","صلاحية إصدار الوثائق المعتمدة","صلاحية تعليق الإجراءات غير المتوافقة"],
  legalBasis: [
    { title: "متطلبات ISO 9001:2015 — أنظمة إدارة الجودة", reference: "ISO 9001:2015", type: "standard", binding: true },
    { title: "متطلبات ISO 27001:2022 — أمن المعلومات", reference: "ISO/IEC 27001:2022", type: "standard", binding: false },
    { title: "دليل هيئة الاعتماد الإماراتية (ESMA)", reference: "متطلبات هيئة الإمارات للمواصفات والمقاييس والجودة", type: "regulation", binding: true },
  ],
  workflowStages: techStages("منسق ISO", "ISO 9001 / 14001 / 27001 / 45001"),
  decisionTree: [
    { stageId: "s1_scope", questionId: "critical_issue", answer: "true", nextStageId: "s2_assessment", addFlag: "iso_critical_nonconformity" },
    { stageId: "s2_assessment", questionId: "compliance_level", answer: "ضعيف (<60%)", nextStageId: "s3_action", addFlag: "major_nonconformity" },
    { stageId: "s3_action", questionId: "escalation", answer: "true", nextStageId: "s3_action", addFlag: "certification_at_risk" },
  ],
  requiredDocuments: [
    { name: "دليل نظام الإدارة", mandatory: true },
    { name: "خريطة العمليات وإجراءات العمل", mandatory: true },
    { name: "تقارير التدقيق الداخلي", mandatory: true },
    { name: "سجلات عدم المطابقة", mandatory: true },
    { name: "مخرجات مراجعة الإدارة", mandatory: true },
    { name: "شهادة ISO السارية", mandatory: true },
    { name: "خطة التصحيح للتدقيق الخارجي", mandatory: false },
  ],
  commonMistakes: [
    { mistake: "وثائق النظام تصف الواقع المأمول لا الفعلي", consequence: "عدم مطابقة في التدقيق وفقدان الاعتماد", remedy: "التوثيق بناءً على ما يُنفَّذ فعلاً ثم تحسينه" },
    { mistake: "إغلاق عدم المطابقة بإجراءات شكلية", consequence: "تكرار نفس المشكلة في التدقيق القادم", remedy: "معالجة السبب الجذري وليس الأعراض فقط" },
    { mistake: "غياب مراجعة الإدارة الدورية", consequence: "فقدان التزام القيادة وفجوة في النظام", remedy: "جدولة مراجعة إدارة رسمية نصف سنوية على الأقل" },
    { mistake: "عدم تحديث الوثائق عند تغيير الإجراءات", consequence: "انفصال بين الواقع والوثائق", remedy: "عملية رقابة تغيير صارمة ومنهجية" },
    { mistake: "التدقيق الداخلي الإجرائي فقط دون تدقيق الأداء", consequence: "تدقيق خارجي يكشف مشكلات فعلية", remedy: "التدقيق على مخرجات العملية لا على الوثائق فقط" },
  ],
  riskIndicators: [
    { indicator: "عدم مطابقة رئيسية في التدقيق", severity: "high", flag: "major_nonconformity" },
    { indicator: "عدم مطابقة حرجة تهدد الاعتماد", severity: "high", flag: "iso_critical_nonconformity" },
    { indicator: "اعتماد ISO في خطر", severity: "high", flag: "certification_at_risk" },
  ],
  escalationRules: [
    { condition: "عدم مطابقة رئيسية تهدد شهادة الاعتماد", escalateTo: "الإدارة العليا وهيئة الاعتماد", mandatory: true },
    { condition: "مقاومة الإدارة لتطبيق متطلبات ISO", escalateTo: "مجلس الإدارة", mandatory: true },
    { condition: "فشل التدقيق الخارجي", escalateTo: "القيادة التنفيذية لاتخاذ إجراء طارئ", mandatory: true },
  ],
  bestPractices: [
    "ربط متطلبات ISO بالأهداف الاستراتيجية للجهة",
    "برامج توعية مستمرة للموظفين بأهمية نظام الإدارة",
    "تدقيق داخلي دوري بمدققين مؤهلين ومستقلين",
    "حلقات تحسين مستمر مرتبطة بنتائج التدقيق",
    "مراجعة إدارة رسمية موثقة تتضمن جميع مدخلات النظام",
  ],
  thinkingModel: [
    { step: "المتطلب", question: "ما المتطلب المحدد من المعيار الذي أتعامل معه؟" },
    { step: "الأدلة", question: "ما الدليل الموضوعي الذي يُثبت الامتثال أو عدمه؟" },
    { step: "الجذر", question: "ما السبب الجذري لعدم المطابقة؟" },
    { step: "الوقاية", question: "كيف أمنع تكرار هذه المشكلة مستقبلاً؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "نطاق نظام ISO محدد ومعتمد", category: "documentation", mandatory: true },
    { id: "fc2", item: "جميع عدم المطابقة موثقة ومعالجة", category: "quality", mandatory: true },
    { id: "fc3", item: "التدقيق الداخلي مُنجَز وفق الجدول", category: "procedural", mandatory: true },
    { id: "fc4", item: "مراجعة الإدارة مُنجَزة ومُوثَّقة", category: "procedural", mandatory: true },
    { id: "fc5", item: "خطط التصحيح مُنفَّذة ومُتحقَّق منها", category: "quality", mandatory: true },
    { id: "fc6", item: "الوثائق محدثة وتعكس الواقع الفعلي", category: "documentation", mandatory: true },
    { id: "fc7", item: "الاعتماد ساري ومواعيد التجديد معروفة", category: "legal", mandatory: true },
    { id: "fc8", item: "مخرجات النظام مُراجَعة ومُحسَّنة", category: "quality", mandatory: false },
  ],
  assessmentContext: "منسق ISO في الجهة الإماراتية — يعمل مع هيئة الإمارات للمواصفات ESMA ومنظمة ISO الدولية.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الأمن السيبراني — Cybersecurity
// ═════════════════════════════════════════════════════════════════════════════
const CYBERSECURITY_OFFICER: ProfessionConfig = {
  sectorId: "cybersecurity", sectorNameAr: "الأمن السيبراني", sectorNameEn: "Cybersecurity",
  professionId: "cybersecurity_officer", professionNameAr: "مسؤول الأمن السيبراني", professionNameEn: "Cybersecurity Officer", icon: "🔒",
  description: "مسؤول الأمن السيبراني يحمي الأنظمة والبيانات ويستجيب للحوادث الأمنية وفق الإطار الوطني للأمن السيبراني.",
  responsibilities: ["حماية البنية التحتية الرقمية","الاستجابة للحوادث الأمنية","إدارة ثغرات الأمن","ضمان الامتثال للإطار السيبراني الوطني","توعية الموظفين بالأمن السيبراني"],
  requiredCompetencies: ["الإطار الوطني للأمن السيبراني NESA/UAE IA","NIST Cybersecurity Framework","ISO 27001","الاستجابة للحوادث","اختبار الاختراق"],
  requiredAuthorities: ["صلاحية عزل الأنظمة المتضررة","صلاحية الاطلاع على جميع الأنظمة","صلاحية إيقاف الوصول في الطوارئ"],
  legalBasis: [
    { title: "الإطار الوطني لأمن المعلومات — NESA", reference: "المعيار الوطني لأمن المعلومات الإماراتي IAS", type: "standard", binding: true },
    { title: "قانون مكافحة الجرائم المعلوماتية", reference: "مرسوم بقانون اتحادي رقم 34 لسنة 2021", type: "decree", binding: true },
    { title: "لوائح حماية البيانات الشخصية", reference: "مرسوم بقانون اتحادي رقم 45 لسنة 2021", type: "decree", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_incident", title: "الكشف والتصنيف", description: "اكتشاف الحادث السيبراني وتصنيفه", icon: "🚨",
      questions: [
        { id: "incident_type", text: "ما نوع الحادث السيبراني؟", type: "select" as const, required: true, options: ["برمجية خبيثة","خرق بيانات","هجوم DDoS","تصيد احتيالي","وصول غير مصرح به","ثغرة أمنية","حادث داخلي","أخرى"], decisionKey: "incident_type" },
        { id: "scope", text: "ما نطاق تأثير الحادث؟", type: "select" as const, required: true, options: ["معزول — نظام واحد","قطاع — عدة أنظمة","جهة — كامل البنية التحتية","حرج — أنظمة بنية تحتية حيوية"], decisionKey: "scope" },
        { id: "data_breach", text: "هل ثمة خرق محتمل للبيانات الشخصية؟", type: "boolean" as const, required: true, decisionKey: "data_breach" },
      ],
      defaultNextStageId: "s2_response",
    },
    {
      id: "s2_response", title: "الاحتواء والتحقيق", description: "احتواء الحادث وإجراء التحقيق التقني", icon: "🛡️",
      questions: [
        { id: "contained", text: "هل تم احتواء الحادث ووقف انتشاره؟", type: "boolean" as const, required: true, decisionKey: "contained" },
        { id: "affected_systems", text: "ما الأنظمة والبيانات المتأثرة؟", type: "text" as const, required: true, minLength: 20 },
        { id: "forensics_done", text: "هل بدأ التحقيق الجنائي الرقمي؟", type: "boolean" as const, required: true },
      ],
      defaultNextStageId: "s3_recovery",
    },
    {
      id: "s3_recovery", title: "الاستعادة والإبلاغ", description: "استعادة الأنظمة والإبلاغ الرسمي", icon: "🔄",
      questions: [
        { id: "systems_restored", text: "هل الأنظمة المتأثرة أُعيدت للعمل بأمان؟", type: "boolean" as const, required: true },
        { id: "reporting_required", text: "هل الحادث يستدعي إبلاغ الجهات الرقابية؟", type: "select" as const, required: true, options: ["نعم — TDRA / CIRT الوطني","نعم — خرق بيانات يستلزم الإبلاغ","لا يستلزم إبلاغاً خارجياً"], decisionKey: "reporting_required" },
        { id: "lessons_documented", text: "هل الدروس المستفادة موثقة؟", type: "boolean" as const, required: true },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_incident", questionId: "scope", answer: "حرج — أنظمة بنية تحتية حيوية", nextStageId: "s2_response", addFlag: "critical_infrastructure" },
    { stageId: "s1_incident", questionId: "data_breach", answer: "true", nextStageId: "s2_response", addFlag: "data_breach_alert" },
    { stageId: "s2_response", questionId: "contained", answer: "false", nextStageId: "s2_response", addFlag: "ongoing_attack" },
    { stageId: "s3_recovery", questionId: "reporting_required", answer: "نعم — TDRA / CIRT الوطني", nextStageId: "s3_recovery", addFlag: "regulatory_report_required" },
    { stageId: "s3_recovery", questionId: "reporting_required", answer: "نعم — خرق بيانات يستلزم الإبلاغ", nextStageId: "s3_recovery", addFlag: "data_breach_report" },
  ],
  requiredDocuments: [
    { name: "سجل الحوادث الأمنية", mandatory: true },
    { name: "خطة الاستجابة للحوادث", mandatory: true },
    { name: "تقرير الحادث التقني", mandatory: true },
    { name: "سجلات الأنظمة (Logs)", mandatory: true },
    { name: "تقرير التحليل الجنائي الرقمي", mandatory: false, whenRequired: "في الحوادث الجسيمة" },
    { name: "إشعار الجهات الرقابية", mandatory: false, whenRequired: "عند الالتزام القانوني بالإبلاغ" },
    { name: "تقرير ما بعد الحادث (PIR)", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "تأخير احتواء الحادث لإجراء التحقيق أولاً", consequence: "انتشار الحادث وتضاعف الأضرار", remedy: "الاحتواء أولاً ثم التحقيق بعد التأمين" },
    { mistake: "حذف الأدلة الرقمية أثناء الاستجابة", consequence: "فقدان أدلة جنائية لا يمكن استعادتها", remedy: "عمل نسخ جنائية من الأنظمة قبل أي تعديل" },
    { mistake: "عدم الإبلاغ عن خرق البيانات في المدة القانونية", consequence: "غرامات وعقوبات قانونية", remedy: "إجراء تقييم فوري والإبلاغ خلال 72 ساعة وفق القانون" },
    { mistake: "عدم اختبار خطط الاستجابة دورياً", consequence: "فشل الاستجابة عند وقوع الحادث الفعلي", remedy: "تمارين مشتركة دورية لاختبار خطط الاستجابة" },
    { mistake: "التركيز على التقنية وإهمال العامل البشري", consequence: "نجاح هجمات التصيد رغم الأنظمة المتطورة", remedy: "برامج توعية منتظمة ومحاكاة هجمات التصيد" },
  ],
  riskIndicators: [
    { indicator: "هجوم على بنية تحتية حيوية", severity: "high", flag: "critical_infrastructure" },
    { indicator: "خرق بيانات محتمل", severity: "high", flag: "data_breach_alert" },
    { indicator: "هجوم جارٍ غير محتوى", severity: "high", flag: "ongoing_attack" },
    { indicator: "التزام بالإبلاغ الرقابي", severity: "high", flag: "regulatory_report_required" },
  ],
  escalationRules: [
    { condition: "هجوم على بنية تحتية حيوية وطنية", escalateTo: "TDRA والمركز الوطني للأمن السيبراني فوراً", mandatory: true },
    { condition: "خرق بيانات شخصية يستوجب الإبلاغ", escalateTo: "هيئة حماية البيانات والإدارة العليا", mandatory: true },
    { condition: "حادث يؤثر على عمليات الجهة الحيوية", escalateTo: "القيادة التنفيذية وخطة BCP", mandatory: true },
  ],
  bestPractices: [
    "تدريب منتظم للموظفين على التعرف على التهديدات السيبرانية",
    "اختبار دوري لخطط الاستجابة والتعافي من الكوارث",
    "تطبيق مبدأ أقل الصلاحيات في جميع الأنظمة",
    "مراقبة مستمرة للأنظمة والسجلات بحثاً عن أنشطة مشبوهة",
    "تحديث دوري لسياسات الأمن ومنهجية إدارة الثغرات",
  ],
  thinkingModel: [
    { step: "الكشف", question: "هل ما أراه حادث فعلي أم إيجابية كاذبة؟ ما الأدلة؟" },
    { step: "التأثير", question: "ما نطاق وخطورة التأثير على الأنظمة والبيانات؟" },
    { step: "الأولوية", question: "ما الإجراء الأول الأكثر إلحاحاً: الاحتواء، الاستجابة، أم الإبلاغ؟" },
    { step: "التعلم", question: "ما الذي سنغيره في دفاعاتنا بعد هذا الحادث؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "الحادث محتوى وانتشاره موقوف", category: "procedural", mandatory: true },
    { id: "fc2", item: "الأدلة الجنائية محفوظة ومأمونة", category: "documentation", mandatory: true },
    { id: "fc3", item: "الأنظمة أُعيدت للعمل بأمان", category: "procedural", mandatory: true },
    { id: "fc4", item: "الإبلاغ الرقابي تم في الموعد القانوني", category: "legal", mandatory: true },
    { id: "fc5", item: "التقرير التقني للحادث مُعدّ", category: "documentation", mandatory: true },
    { id: "fc6", item: "الأفراد المتضررون أُبلغوا (إن لزم)", category: "legal", mandatory: false },
    { id: "fc7", item: "الثغرة المستغلة سُدَّت أو مُخففت", category: "risk", mandatory: true },
    { id: "fc8", item: "الدروس المستفادة موثقة ومطبقة", category: "quality", mandatory: true },
  ],
  assessmentContext: "مسؤول الأمن السيبراني في الجهة الإماراتية — يعمل وفق الإطار الوطني NESA والتشريعات الاتحادية للجرائم الإلكترونية وحماية البيانات.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: حوكمة الذكاء الاصطناعي — AI Governance
// ═════════════════════════════════════════════════════════════════════════════
const AI_GOVERNANCE_OFFICER: ProfessionConfig = {
  sectorId: "ai_governance", sectorNameAr: "حوكمة الذكاء الاصطناعي", sectorNameEn: "AI Governance",
  professionId: "ai_governance_officer", professionNameAr: "مسؤول حوكمة الذكاء الاصطناعي", professionNameEn: "AI Governance Officer", icon: "🤖",
  description: "مسؤول حوكمة الذكاء الاصطناعي يضمن الاستخدام الأخلاقي والمسؤول والآمن لأنظمة الذكاء الاصطناعي.",
  responsibilities: ["تقييم أنظمة الذكاء الاصطناعي أخلاقياً","مراجعة الخوارزميات للتحيز والعدالة","ضمان الشفافية والتفسيرية","الامتثال لسياسات ذكاء اصطناعي الإمارات","إدارة مخاطر الذكاء الاصطناعي"],
  requiredCompetencies: ["أخلاقيات الذكاء الاصطناعي","تقييم التحيز الخوارزمي","الإطار القانوني للذكاء الاصطناعي","إدارة مخاطر الذكاء الاصطناعي","الشفافية والتفسيرية"],
  requiredAuthorities: ["صلاحية تأخير أو إيقاف نشر أنظمة AI","صلاحية مراجعة جميع قرارات الخوارزميات","صلاحية طلب تفسيرات من فريق التقنية"],
  legalBasis: [
    { title: "استراتيجية الإمارات للذكاء الاصطناعي 2031", reference: "استراتيجية الدولة الوطنية للذكاء الاصطناعي", type: "policy", binding: false },
    { title: "دليل أخلاقيات الذكاء الاصطناعي الإماراتي", reference: "المجلس الوطني للذكاء الاصطناعي — دليل الأخلاقيات", type: "guideline", binding: false },
    { title: "قانون حماية البيانات الشخصية", reference: "مرسوم بقانون اتحادي رقم 45 لسنة 2021", type: "decree", binding: true },
    { title: "إطار حوكمة الذكاء الاصطناعي — ISO/IEC 42001", reference: "ISO/IEC 42001:2023 AI Management Systems", type: "standard", binding: false },
  ],
  workflowStages: [
    {
      id: "s1_ai_system", title: "تقييم نظام الذكاء الاصطناعي", description: "وصف النظام وتصنيف مستوى مخاطره", icon: "🧠",
      questions: [
        { id: "ai_use_case", text: "ما حالة استخدام نظام الذكاء الاصطناعي؟", type: "text" as const, required: true, minLength: 30 },
        { id: "decision_impact", text: "هل يتخذ النظام قرارات تؤثر على حقوق أفراد؟", type: "boolean" as const, required: true, decisionKey: "decision_impact" },
        { id: "risk_level", text: "ما مستوى مخاطر النظام؟", type: "select" as const, required: true, options: ["مخاطر عالية — يؤثر على حقوق أساسية","مخاطر متوسطة — يؤثر على قرارات مهمة","مخاطر منخفضة — مساعدة فقط"], decisionKey: "risk_level" },
      ],
      defaultNextStageId: "s2_ethics_review",
    },
    {
      id: "s2_ethics_review", title: "المراجعة الأخلاقية والتقنية", description: "تقييم الشفافية والعدالة والموثوقية", icon: "⚖️",
      questions: [
        { id: "bias_tested", text: "هل النظام اختُبر للتحيز وعدم التمييز؟", type: "boolean" as const, required: true, decisionKey: "bias_tested" },
        { id: "explainability", text: "هل يمكن تفسير قرارات النظام للمستخدمين؟", type: "select" as const, required: true, options: ["شفاف كلياً","شفافية جزئية","صندوق أسود — لا شفافية"], decisionKey: "explainability" },
        { id: "human_oversight", text: "هل ثمة رقابة بشرية على قرارات النظام؟", type: "boolean" as const, required: true, decisionKey: "human_oversight" },
      ],
      defaultNextStageId: "s3_deployment",
    },
    {
      id: "s3_deployment", title: "قرار النشر والرقابة", description: "تحديد قرار النشر وآليات الرقابة المستمرة", icon: "🚀",
      questions: [
        { id: "deployment_decision", text: "ما توصيتك بشأن نشر النظام؟", type: "select" as const, required: true, options: ["موافقة كاملة","موافقة مشروطة بإصلاحات","تأجيل حتى معالجة المخاطر","رفض النشر"], decisionKey: "deployment_decision" },
        { id: "monitoring_plan", text: "ما خطة الرصد والمراجعة المستمرة بعد النشر؟", type: "text" as const, required: true, minLength: 20 },
        { id: "appeals_mechanism", text: "هل ثمة آلية تظلم للأفراد المتأثرين بقرارات النظام؟", type: "boolean" as const, required: true },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_ai_system", questionId: "decision_impact", answer: "true", nextStageId: "s2_ethics_review", addFlag: "high_impact_ai" },
    { stageId: "s1_ai_system", questionId: "risk_level", answer: "مخاطر عالية — يؤثر على حقوق أساسية", nextStageId: "s2_ethics_review", addFlag: "high_risk_ai" },
    { stageId: "s2_ethics_review", questionId: "bias_tested", answer: "false", nextStageId: "s3_deployment", addFlag: "untested_bias" },
    { stageId: "s2_ethics_review", questionId: "explainability", answer: "صندوق أسود — لا شفافية", nextStageId: "s3_deployment", addFlag: "black_box_system" },
    { stageId: "s2_ethics_review", questionId: "human_oversight", answer: "false", nextStageId: "s3_deployment", addFlag: "no_human_oversight" },
    { stageId: "s3_deployment", questionId: "deployment_decision", answer: "رفض النشر", nextStageId: "s3_deployment", addFlag: "deployment_rejected" },
  ],
  requiredDocuments: [
    { name: "تقييم أثر حقوق الإنسان للنظام (AI HRIA)", mandatory: true },
    { name: "وثائق الخوارزميات وبيانات التدريب", mandatory: true },
    { name: "نتائج اختبارات التحيز والعدالة", mandatory: true },
    { name: "سياسة البيانات وموافقة المستخدمين", mandatory: true },
    { name: "وثيقة سياسة الذكاء الاصطناعي المعتمدة", mandatory: true },
    { name: "خطة الرقابة المستمرة بعد النشر", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "نشر نظام AI دون تقييم أثر مسبق", consequence: "قرارات تمييزية وتبعات قانونية", remedy: "تقييم أثر إلزامي قبل نشر أي نظام ذو مخاطر عالية" },
    { mistake: "الاعتماد الكامل على قرارات الخوارزمية دون مراجعة بشرية", consequence: "قرارات خاطئة تؤثر على أفراد", remedy: "تطبيق مبدأ الإنسان في الحلقة لجميع القرارات المؤثرة" },
    { mistake: "إغفال تحيز بيانات التدريب", consequence: "نتائج متحيزة تنتهك مبدأ العدالة", remedy: "تدقيق مستقل لبيانات التدريب قبل البناء" },
    { mistake: "غياب آلية شرح قرارات النظام للمتأثرين", consequence: "انعدام الثقة وتبعات قانونية", remedy: "بناء واجهات شفافة تشرح أسباب كل قرار" },
    { mistake: "التغافل عن مخاطر انجراف النموذج (Model Drift)", consequence: "تدهور دقة النظام دون إنذار", remedy: "مراقبة مستمرة لأداء النموذج ومؤشرات الانجراف" },
  ],
  riskIndicators: [
    { indicator: "نظام AI ذو تأثير عالٍ على الحقوق", severity: "high", flag: "high_impact_ai" },
    { indicator: "نظام عالي المخاطر", severity: "high", flag: "high_risk_ai" },
    { indicator: "تحيز غير مختبر", severity: "high", flag: "untested_bias" },
    { indicator: "صندوق أسود بدون شفافية", severity: "high", flag: "black_box_system" },
    { indicator: "غياب الرقابة البشرية", severity: "high", flag: "no_human_oversight" },
    { indicator: "رفض النشر موصى به", severity: "high", flag: "deployment_rejected" },
  ],
  escalationRules: [
    { condition: "نظام AI يؤثر على حقوق أساسية دون ضمانات كافية", escalateTo: "القيادة التنفيذية والجهات التنظيمية", mandatory: true },
    { condition: "ضرر موثق ناجم عن قرارات الخوارزمية", escalateTo: "فريق قانوني وجهة حماية البيانات", mandatory: true },
    { condition: "مقاومة توصيات الحوكمة من فريق المنتج", escalateTo: "مجلس الإدارة أو لجنة أخلاقيات AI", mandatory: true },
  ],
  bestPractices: [
    "اعتماد مبدأ 'الإنسان في الحلقة' لجميع القرارات المؤثرة",
    "تدقيق مستقل دوري للأنظمة ذات المخاطر العالية",
    "وثائق شفافة لكل نظام AI تتضمن حدود عمله ومخاطره",
    "آليات تظلم واضحة للأفراد المتأثرين",
    "بناء قدرة مؤسسية على التقييم الأخلاقي للذكاء الاصطناعي",
  ],
  thinkingModel: [
    { step: "الأثر", question: "من يتأثر بقرارات هذا النظام وكيف؟" },
    { step: "العدالة", question: "هل النظام يعامل مجموعات مختلفة بشكل متساوٍ وعادل؟" },
    { step: "الشفافية", question: "هل يمكن تفسير قرارات النظام للمتأثرين بها؟" },
    { step: "المساءلة", question: "من يتحمل المسؤولية إذا أخطأ النظام؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "تقييم الأثر على الحقوق مكتمل", category: "legal", mandatory: true },
    { id: "fc2", item: "اختبارات التحيز والعدالة موثقة", category: "quality", mandatory: true },
    { id: "fc3", item: "آلية الرقابة البشرية مفعَّلة", category: "procedural", mandatory: true },
    { id: "fc4", item: "وثائق شرح قرارات النظام متاحة", category: "documentation", mandatory: true },
    { id: "fc5", item: "آلية تظلم الأفراد المتأثرين محددة", category: "legal", mandatory: true },
    { id: "fc6", item: "بيانات التدريب مراجَعة للتحيز", category: "quality", mandatory: true },
    { id: "fc7", item: "خطة رصد ما بعد النشر معتمدة", category: "procedural", mandatory: true },
    { id: "fc8", item: "الامتثال لقانون حماية البيانات مؤكَّد", category: "legal", mandatory: true },
  ],
  assessmentContext: "مسؤول حوكمة الذكاء الاصطناعي في دولة الإمارات — يعمل وفق استراتيجية الإمارات للذكاء الاصطناعي 2031 ودليل الأخلاقيات الوطني.",
};

export const QUALITY_TECH_PROFESSIONS: ProfessionConfig[] = [
  QUALITY_MANAGER, ISO_COORDINATOR, CYBERSECURITY_OFFICER, AI_GOVERNANCE_OFFICER,
];
