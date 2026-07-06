import type { ProfessionConfig } from "../../types.js";

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الاستراتيجية — Strategy
// ═════════════════════════════════════════════════════════════════════════════
const STRATEGY_OFFICER: ProfessionConfig = {
  sectorId: "strategy", sectorNameAr: "الاستراتيجية", sectorNameEn: "Strategy",
  professionId: "strategy_officer", professionNameAr: "مسؤول التخطيط الاستراتيجي", professionNameEn: "Strategic Planning Officer", icon: "🎯",
  description: "مسؤول التخطيط الاستراتيجي يقود عمليات وضع الأهداف الاستراتيجية وترجمتها إلى خطط تشغيلية قابلة للقياس.",
  responsibilities: ["قيادة دورة التخطيط الاستراتيجي","تحليل البيئة الداخلية والخارجية","ترجمة الاستراتيجية لمبادرات وخطط تشغيلية","قياس ومتابعة الأداء الاستراتيجي","رفع التقارير الاستراتيجية للقيادة"],
  requiredCompetencies: ["SWOT / PESTEL / Balanced Scorecard","تحليل البيانات الاستراتيجية","إدارة المشاريع","التخطيط السيناريوهي","التواصل مع القيادة"],
  requiredAuthorities: ["صلاحية الاطلاع على البيانات المؤسسية","صلاحية تنسيق أعمال جميع الأقسام","صلاحية رفع توصيات للقيادة"],
  legalBasis: [
    { title: "خطة الإمارات الاقتصادية 2031", reference: "رؤية الإمارات 2031 وأهدافها الوطنية", type: "policy", binding: false },
    { title: "أُطر وأدوات التخطيط الحكومي الاتحادي", reference: "دليل التخطيط الاستراتيجي الحكومي — مكتب رئاسة الحكومة", type: "guideline", binding: false },
    { title: "منهجية Balanced Scorecard", reference: "Norton & Kaplan — Balanced Scorecard", type: "standard", binding: false },
  ],
  workflowStages: [
    {
      id: "s1_context", title: "تحليل السياق والبيئة", description: "تحليل الواقع الحالي والبيئة المحيطة", icon: "🌐",
      questions: [
        { id: "planning_level", text: "ما مستوى التخطيط؟", type: "select", required: true, options: ["مؤسسي (5 سنوات)","قطاعي / إداري (3 سنوات)","تشغيلي سنوي","مبادرة محددة"], decisionKey: "planning_level" },
        { id: "stakeholders", text: "من هم أصحاب المصلحة الرئيسيون في هذه الخطة؟", type: "text", required: true, minLength: 20 },
        { id: "env_analysis_done", text: "هل أُجري تحليل SWOT أو PESTEL حديث؟", type: "boolean", required: true, decisionKey: "env_analysis_done" },
      ],
      defaultNextStageId: "s2_objectives",
    },
    {
      id: "s2_objectives", title: "الأهداف والمبادرات", description: "تحديد الأهداف الاستراتيجية وترتيب أولويتها", icon: "🎯",
      questions: [
        { id: "goals", text: "ما الأهداف الاستراتيجية الرئيسية (3-5 أهداف)؟", type: "text", required: true, minLength: 50, hint: "صِفها بوضوح مع ربطها بالرؤية والرسالة." },
        { id: "alignment", text: "هل الأهداف مرتبطة بالرؤية الوطنية أو الإطار الاستراتيجي الأعلى؟", type: "boolean", required: true, decisionKey: "alignment" },
        { id: "kpi_defined", text: "هل مؤشرات الأداء (KPIs) محددة لكل هدف؟", type: "boolean", required: true, decisionKey: "kpi_defined" },
      ],
      defaultNextStageId: "s3_risks",
    },
    {
      id: "s3_risks", title: "المخاطر الاستراتيجية والموارد", description: "تقييم المخاطر وضمان توفر الموارد", icon: "⚠️",
      questions: [
        { id: "strategic_risks", text: "ما أبرز المخاطر التي تهدد تحقيق الأهداف؟", type: "text", required: true, minLength: 30 },
        { id: "resources_allocated", text: "هل الموارد المالية والبشرية اللازمة مخصصة؟", type: "boolean", required: true, decisionKey: "resources_allocated" },
        { id: "review_mechanism", text: "ما آلية المراجعة والمتابعة الدورية؟", type: "select", required: true, options: ["شهرية","ربع سنوية","نصف سنوية","سنوية"] },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_context", questionId: "env_analysis_done", answer: "false", nextStageId: "s2_objectives", addFlag: "no_env_analysis" },
    { stageId: "s2_objectives", questionId: "alignment", answer: "false", nextStageId: "s3_risks", addFlag: "misalignment_risk" },
    { stageId: "s2_objectives", questionId: "kpi_defined", answer: "false", nextStageId: "s3_risks", addFlag: "no_kpis" },
    { stageId: "s3_risks", questionId: "resources_allocated", answer: "false", nextStageId: "s3_risks", addFlag: "resource_gap" },
  ],
  requiredDocuments: [
    { name: "الخطة الاستراتيجية المؤسسية المعتمدة", mandatory: true },
    { name: "تحليل البيئة (SWOT/PESTEL)", mandatory: true },
    { name: "مصفوفة الأهداف ومؤشرات الأداء", mandatory: true },
    { name: "خرائط المبادرات والمشاريع", mandatory: true },
    { name: "تقارير الأداء الدورية", mandatory: false },
    { name: "ميزانية الخطة الاستراتيجية", mandatory: false, whenRequired: "عند طلب الموافقة المالية" },
  ],
  commonMistakes: [
    { mistake: "أهداف غير قابلة للقياس (ليست SMART)", consequence: "عجز عن قياس التحقق وتحديد المسؤولية", remedy: "تحويل كل هدف لمؤشر قابل للقياس ومرتبط بموعد محدد" },
    { mistake: "الخطة الاستراتيجية منفصلة عن الميزانية", consequence: "خطة لا تُنفَّذ لعدم توفر التمويل", remedy: "ربط كل مبادرة بميزانية معتمدة من البداية" },
    { mistake: "غياب مراجعة الخطة عند التغيرات البيئية", consequence: "أهداف تصبح غير ملائمة للواقع", remedy: "مراجعة ربع سنوية تشمل إعادة تقييم الافتراضات" },
    { mistake: "الخطة تُعد بمعزل عن القيادة التنفيذية", consequence: "ضعف الالتزام والتنفيذ", remedy: "إشراك القيادة في تصميم الخطة لا في الموافقة عليها فقط" },
    { mistake: "عدم توصيل الخطة للموظفين", consequence: "غياب الانحياز المؤسسي للأهداف", remedy: "برامج توعية وتواصل داخلي مستمر حول الخطة الاستراتيجية" },
  ],
  riskIndicators: [
    { indicator: "غياب تحليل بيئي حديث", severity: "medium", flag: "no_env_analysis" },
    { indicator: "أهداف غير مرتبطة بالرؤية الوطنية", severity: "medium", flag: "misalignment_risk" },
    { indicator: "غياب مؤشرات أداء محددة", severity: "high", flag: "no_kpis" },
    { indicator: "فجوة في الموارد المطلوبة", severity: "high", flag: "resource_gap" },
  ],
  escalationRules: [
    { condition: "الخطة تتعارض مع توجهات الحكومة الاتحادية", escalateTo: "القيادة العليا للمواءمة", mandatory: true },
    { condition: "احتياجات موارد تتجاوز صلاحية الميزانية", escalateTo: "مجلس الإدارة أو الجهة التمويلية", mandatory: true },
    { condition: "تغييرات استراتيجية جوهرية في الخطة", escalateTo: "القيادة التنفيذية للموافقة", mandatory: true },
  ],
  bestPractices: [
    "ربط الخطة الاستراتيجية بالرؤية الوطنية للإمارات",
    "اعتماد نموذج Balanced Scorecard لضمان توازن المنظور",
    "التخطيط السيناريوهي للتحضير لمستجدات غير متوقعة",
    "تواصل مستمر وشفاف حول تقدم الخطة مع جميع المستويات",
    "بناء قدرة مؤسسية على التكيف الاستراتيجي السريع",
  ],
  thinkingModel: [
    { step: "المواءمة", question: "هل هذه الأهداف تخدم الرؤية الوطنية والمؤسسية؟" },
    { step: "الجدوى", question: "هل الموارد والقدرات متاحة لتحقيق هذه الأهداف؟" },
    { step: "القياس", question: "كيف سنعرف أننا حققنا هذا الهدف؟ ما المؤشرات؟" },
    { step: "المخاطر", question: "ما الذي قد يمنع تحقيق الأهداف وكيف نستعد له؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "الأهداف SMART وقابلة للقياس", category: "quality", mandatory: true },
    { id: "fc2", item: "الخطة مرتبطة بالرؤية الوطنية", category: "procedural", mandatory: true },
    { id: "fc3", item: "مؤشرات الأداء محددة لكل هدف", category: "quality", mandatory: true },
    { id: "fc4", item: "الموارد المطلوبة مخصصة ومعتمدة", category: "procedural", mandatory: true },
    { id: "fc5", item: "المخاطر الاستراتيجية محددة وخطط التخفيف جاهزة", category: "risk", mandatory: true },
    { id: "fc6", item: "آلية مراجعة دورية محددة", category: "procedural", mandatory: true },
    { id: "fc7", item: "القيادة وافقت وتلتزم بالخطة", category: "procedural", mandatory: true },
    { id: "fc8", item: "الخطة موصَّلة للفرق المنفِّذة", category: "quality", mandatory: true },
  ],
  assessmentContext: "مسؤول التخطيط الاستراتيجي في الجهة الإماراتية — يعمل في إطار رؤية الإمارات 2031 والتوجهات الوطنية.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: إدارة الأداء — Performance Management
// ═════════════════════════════════════════════════════════════════════════════
const PERFORMANCE_MANAGER: ProfessionConfig = {
  sectorId: "performance_management", sectorNameAr: "إدارة الأداء", sectorNameEn: "Performance Management",
  professionId: "performance_manager", professionNameAr: "مسؤول إدارة الأداء", professionNameEn: "Performance Management Officer", icon: "📈",
  description: "مسؤول إدارة الأداء يُصمم ويُشرف على منظومة مؤشرات الأداء المؤسسي ويضمن التحسين المستمر.",
  responsibilities: ["تصميم مؤشرات الأداء (KPIs)","مراقبة الأداء المؤسسي والإداري","إعداد تقارير الأداء الدورية","تحليل جذور الانحرافات وتوصيات التصحيح","إدارة دورة التقييم السنوية"],
  requiredCompetencies: ["Balanced Scorecard","تحليل البيانات","تصميم المؤشرات","إعداد التقارير التنفيذية","إدارة الأداء الوظيفي"],
  requiredAuthorities: ["صلاحية طلب البيانات من جميع الأقسام","صلاحية رفع تقارير للإدارة العليا","صلاحية تقييم الأداء الإداري"],
  legalBasis: [
    { title: "منهجية حكومة الإمارات لإدارة الأداء", reference: "دليل نظام إدارة الأداء الحكومي — وزارة الموارد البشرية", type: "guideline", binding: true },
    { title: "أُطر الأداء الوطني", reference: "مؤشرات دليل التنافسية الوطنية", type: "policy", binding: false },
    { title: "Balanced Scorecard Methodology", reference: "Norton & Kaplan Framework", type: "standard", binding: false },
  ],
  workflowStages: [
    {
      id: "s1_kpi", title: "مراجعة المؤشرات والأهداف", description: "مراجعة مؤشرات الأداء وأهدافها", icon: "🎯",
      questions: [
        { id: "review_period", text: "ما الفترة التي تراجعها؟", type: "select", required: true, options: ["شهرية","ربع سنوية","نصف سنوية","سنوية"] },
        { id: "kpi_count", text: "كم عدد مؤشرات الأداء الخاضعة للمراجعة؟", type: "select", required: true, options: ["1-5","6-15","16-30","أكثر من 30"] },
        { id: "targets_set", text: "هل الأهداف المستهدفة لجميع المؤشرات محددة ومعتمدة مسبقاً؟", type: "boolean", required: true, decisionKey: "targets_set" },
      ],
      defaultNextStageId: "s2_performance",
    },
    {
      id: "s2_performance", title: "تحليل الأداء الفعلي", description: "قياس الفجوة بين الأداء الفعلي والمستهدف", icon: "📊",
      questions: [
        { id: "performance_status", text: "ما الوضع العام للأداء؟", type: "select", required: true, options: ["متفوق (>110%)","محقق (90-110%)","مقبول (75-90%)","دون المستهدف (<75%)","بيانات غير مكتملة"], decisionKey: "performance_status" },
        { id: "underperformers", text: "هل ثمة مؤشرات متأخرة تستدعي التصعيد؟", type: "boolean", required: true, decisionKey: "underperformers" },
        { id: "root_cause", text: "ما أبرز أسباب الانحراف؟", type: "text", required: true, minLength: 20 },
      ],
      defaultNextStageId: "s3_action",
    },
    {
      id: "s3_action", title: "إجراءات التصحيح والتحسين", description: "تحديد إجراءات التصحيح والتحسين", icon: "🛠️",
      questions: [
        { id: "corrective_actions", text: "ما إجراءات التصحيح المقترحة؟", type: "text", required: true, minLength: 30 },
        { id: "responsible_parties", text: "من المسؤول عن تنفيذ هذه الإجراءات؟", type: "text", required: true, minLength: 10 },
        { id: "escalation_to_leadership", text: "هل الأداء يستدعي عرضاً على القيادة؟", type: "boolean", required: true, decisionKey: "escalation_to_leadership" },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_kpi", questionId: "targets_set", answer: "false", nextStageId: "s2_performance", addFlag: "no_targets" },
    { stageId: "s2_performance", questionId: "performance_status", answer: "دون المستهدف (<75%)", nextStageId: "s3_action", addFlag: "critical_underperformance" },
    { stageId: "s2_performance", questionId: "underperformers", answer: "true", nextStageId: "s3_action", addFlag: "escalation_needed" },
    { stageId: "s3_action", questionId: "escalation_to_leadership", answer: "true", nextStageId: "s3_action", addFlag: "leadership_escalation" },
  ],
  requiredDocuments: [
    { name: "لوحة مؤشرات الأداء الرئيسية", mandatory: true },
    { name: "بيانات الأداء الفعلي للفترة", mandatory: true },
    { name: "الأهداف المستهدفة المعتمدة", mandatory: true },
    { name: "تقارير الأداء السابقة للمقارنة", mandatory: false },
    { name: "خطة التصحيح والتحسين", mandatory: false, whenRequired: "عند وجود انحرافات" },
    { name: "التقرير التنفيذي للأداء", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "مؤشرات أداء كثيرة تفقد التركيز", consequence: "تشتت الجهود وصعوبة الإدارة", remedy: "التركيز على 5-7 مؤشرات جوهرية لكل مستوى تنظيمي" },
    { mistake: "أهداف غير واقعية تُحبط الفرق", consequence: "انخفاض الدافعية وتحريف البيانات", remedy: "تحديد الأهداف بمنهجية تشاركية وبناءً على البيانات التاريخية" },
    { mistake: "التركيز على جمع البيانات دون التحليل", consequence: "تقارير أداء دون قيمة", remedy: "التركيز على السبب الجذري والإجراء التصحيحي" },
    { mistake: "تقارير أداء للأرشيف فقط دون استخدام", consequence: "إهدار الموارد وغياب ثقافة الأداء", remedy: "ربط التقارير بالقرارات التنفيذية وجلسات المراجعة" },
    { mistake: "مؤشرات الأداء لا ترتبط بالأهداف الاستراتيجية", consequence: "جهود تشغيلية لا تُحرك الاستراتيجية", remedy: "خريطة استراتيجية تُظهر الرابط بين كل مؤشر وهدف استراتيجي" },
  ],
  riskIndicators: [
    { indicator: "أداء حرج (<75% من المستهدف)", severity: "high", flag: "critical_underperformance" },
    { indicator: "مؤشرات دون أهداف محددة", severity: "medium", flag: "no_targets" },
    { indicator: "مؤشرات تستدعي تصعيداً", severity: "medium", flag: "escalation_needed" },
    { indicator: "حاجة لعرض على القيادة", severity: "medium", flag: "leadership_escalation" },
  ],
  escalationRules: [
    { condition: "أداء حرج يهدد تحقيق الأهداف الاستراتيجية", escalateTo: "القيادة التنفيذية للتدخل الفوري", mandatory: true },
    { condition: "فجوة بيانات تعيق التقييم", escalateTo: "مسؤولو تقنية المعلومات والإحصاء", mandatory: false },
    { condition: "مؤشرات دولية أو وطنية في خطر", escalateTo: "الجهة المعنية ومكتب رئاسة الحكومة", mandatory: true },
  ],
  bestPractices: [
    "ربط مؤشرات الأداء الفردي بالمؤسسي والاستراتيجي",
    "اجتماعات مراجعة ربع سنوية منتظمة مع أصحاب المؤشرات",
    "الاحتفاء بالإنجازات بنفس اهتمام معالجة القصور",
    "تصورات بيانية واضحة في تقارير الأداء التنفيذية",
    "بناء قاعدة بيانات تاريخية للأداء لدعم القرارات",
  ],
  thinkingModel: [
    { step: "القياس", question: "هل البيانات صحيحة وكاملة وموثوقة؟" },
    { step: "الفجوة", question: "ما الفجوة بين الأداء الفعلي والمستهدف ولماذا؟" },
    { step: "الأثر", question: "ما أثر هذا الأداء على تحقيق الأهداف الاستراتيجية؟" },
    { step: "التصحيح", question: "ما الإجراء الأكثر فاعلية لمعالجة جذر المشكلة؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "جميع البيانات الأداء جُمعت وتحققت من صحتها", category: "documentation", mandatory: true },
    { id: "fc2", item: "الفجوات محللة مع تحديد الأسباب الجذرية", category: "quality", mandatory: true },
    { id: "fc3", item: "إجراءات التصحيح محددة بمسؤوليات ومواعيد", category: "procedural", mandatory: true },
    { id: "fc4", item: "المؤشرات الحرجة رُفعت للقيادة", category: "risk", mandatory: true },
    { id: "fc5", item: "التقرير التنفيذي جاهز وواضح", category: "documentation", mandatory: true },
    { id: "fc6", item: "الأهداف للفترة القادمة مراجَعة ومعدَّلة إن لزم", category: "procedural", mandatory: false },
    { id: "fc7", item: "نتائج الأداء وُصِّلت لأصحاب المؤشرات", category: "procedural", mandatory: true },
    { id: "fc8", item: "لوحة مؤشرات الأداء محدثة", category: "documentation", mandatory: true },
  ],
  assessmentContext: "مسؤول إدارة الأداء في الجهة الإماراتية — يعمل في إطار منظومة الأداء الحكومي الوطنية.",
};

export const STRATEGY_PROFESSIONS: ProfessionConfig[] = [STRATEGY_OFFICER, PERFORMANCE_MANAGER];
