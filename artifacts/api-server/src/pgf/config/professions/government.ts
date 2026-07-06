import type { ProfessionConfig } from "../../types.js";

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الإدارة الحكومية — Government Administration
// ═════════════════════════════════════════════════════════════════════════════
const ADMIN_DECISION_MAKER: ProfessionConfig = {
  sectorId: "gov_admin", sectorNameAr: "الإدارة الحكومية", sectorNameEn: "Government Administration",
  professionId: "admin_decision_maker", professionNameAr: "متخذ القرار الإداري", professionNameEn: "Administrative Decision-Maker", icon: "🏛️",
  description: "متخذ القرار الإداري يُصدر القرارات الرسمية التي تؤثر على حقوق الأفراد والجهات ويتحمل مسؤوليتها القانونية.",
  responsibilities: ["إصدار القرارات الإدارية","ضمان مشروعية القرارات","توثيق الأسباب والمستندات","الالتزام بمبادئ العدالة والشفافية","إدارة الاعتراضات والتظلمات"],
  requiredCompetencies: ["القانون الإداري","التحليل المؤسسي","صياغة القرارات","إدارة المخاطر","التواصل المؤسسي"],
  requiredAuthorities: ["صلاحية إصدار القرارات ضمن اختصاصه","صلاحية الاطلاع على الملفات","صلاحية طلب الرأي القانوني","صلاحية التوقيع على القرارات"],
  legalBasis: [
    { title: "قانون الإجراءات الإدارية", reference: "مرسوم بقانون اتحادي رقم 39 لسنة 2023", type: "decree", binding: true },
    { title: "قانون الموارد البشرية في الحكومة الاتحادية", reference: "مرسوم بقانون اتحادي رقم 49 لسنة 2023", type: "decree", binding: true },
    { title: "قانون مكافحة الفساد", reference: "قانون اتحادي رقم 6 لسنة 2012", type: "law", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_mandate", title: "تحديد القرار والاختصاص", description: "هل القرار داخل في صلاحياتك القانونية؟", icon: "📋",
      questions: [
        { id: "decision_type", text: "ما نوع القرار الإداري المراد اتخاذه؟", type: "select", required: true, options: ["قرار تأديبي","قرار توظيف / فصل","قرار ترخيص","قرار تعاقدي","قرار تنظيمي","قرار مالي","أخرى"] },
        { id: "authority_confirmed", text: "هل القرار ضمن صلاحياتك التفويضية القانونية؟", type: "boolean", required: true, decisionKey: "authority_confirmed" },
        { id: "affected_parties", text: "من يتأثر بهذا القرار؟ صِف الأطراف.", type: "text", required: true, minLength: 20 },
      ],
      defaultNextStageId: "s2_legal_basis",
    },
    {
      id: "s2_legal_basis", title: "الأساس القانوني والإجرائي", description: "التحقق من الأساس القانوني للقرار", icon: "📜",
      questions: [
        { id: "legal_basis_exists", text: "هل ثمة نص قانوني صريح يُسوّغ هذا القرار؟", type: "boolean", required: true, decisionKey: "legal_basis_exists" },
        { id: "procedures_followed", text: "ما الإجراءات المسبقة التي اتُّخذت قبل القرار؟", type: "multiselect", required: true, options: ["استشارة قانونية","لجنة داخلية","جلسة استماع للمعني","موافقة جهة أعلى","دراسة الأثر","إشعار مسبق للمعني"] },
        { id: "conflict_of_interest", text: "هل ثمة تعارض مصالح محتمل لأي من المشاركين في القرار؟", type: "boolean", required: true, decisionKey: "conflict_of_interest" },
      ],
      defaultNextStageId: "s3_documentation",
    },
    {
      id: "s3_documentation", title: "التوثيق والمسوّغات", description: "استيفاء التوثيق اللازم للقرار", icon: "📁",
      questions: [
        { id: "documents_ready", text: "ما المستندات الداعمة المتوفرة؟", type: "multiselect", required: true, options: ["الملف الوظيفي/الشخصي","تقارير الأداء","محاضر الاجتماعات","آراء قانونية","بيانات مالية","قرارات سابقة ذات صلة"] },
        { id: "notification_required", text: "هل يستوجب القرار إشعاراً مسبقاً للمعني؟", type: "boolean", required: true, decisionKey: "notification_required" },
        { id: "appeal_rights", text: "هل تعرف ما هي حقوق الطعن المتاحة للمتضرر؟", type: "boolean", required: true },
      ],
      defaultNextStageId: "s4_risk",
    },
    {
      id: "s4_risk", title: "تقييم المخاطر القانونية", description: "تقييم مخاطر القرار قبل إصداره", icon: "⚠️",
      questions: [
        { id: "legal_risk", text: "ما المخاطر القانونية المحتملة لهذا القرار؟", type: "text", required: true, minLength: 20, hint: "مثلاً: احتمال الطعن، مطابقة اللوائح، التمييز." },
        { id: "urgency", text: "هل القرار عاجل؟", type: "boolean", required: true, decisionKey: "urgency" },
        { id: "escalation_needed", text: "هل يستدعي القرار موافقة مستوى أعلى؟", type: "boolean", required: true, decisionKey: "escalation_needed" },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_mandate", questionId: "authority_confirmed", answer: "false", nextStageId: "s4_risk", addFlag: "authority_gap" },
    { stageId: "s2_legal_basis", questionId: "legal_basis_exists", answer: "false", nextStageId: "s3_documentation", addFlag: "no_legal_basis" },
    { stageId: "s2_legal_basis", questionId: "conflict_of_interest", answer: "true", nextStageId: "s3_documentation", addFlag: "conflict_of_interest" },
    { stageId: "s3_documentation", questionId: "notification_required", answer: "true", nextStageId: "s4_risk", addFlag: "notification_pending" },
    { stageId: "s4_risk", questionId: "escalation_needed", answer: "true", nextStageId: "s4_risk", addFlag: "higher_approval_required" },
  ],
  requiredDocuments: [
    { name: "نموذج القرار الإداري", mandatory: true },
    { name: "الأساس القانوني المستند إليه", mandatory: true },
    { name: "محضر اجتماع اللجنة (إن وُجدت)", mandatory: false },
    { name: "الرأي القانوني من الشؤون القانونية", mandatory: false, whenRequired: "في القرارات ذات الأثر القانوني الكبير" },
    { name: "إشعار الطرف المعني", mandatory: false, whenRequired: "عند الاشتراط القانوني" },
    { name: "سجل التفويض بالصلاحية", mandatory: true },
    { name: "توقيعات الموافقة حسب التسلسل الهرمي", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "إصدار القرار دون أساس قانوني واضح", consequence: "إلغاء القرار بالطعن الإداري", remedy: "استشارة الشؤون القانونية قبل إصدار أي قرار جوهري" },
    { mistake: "عدم منح المعني حق الاعتراض أو الاستماع", consequence: "إلغاء القرار لعدم مراعاة ضمانات التقاضي الإداري", remedy: "منح المعني فرصة للرد قبل صدور القرار في القضايا التأديبية" },
    { mistake: "الخلط بين الصلاحية الأصلية والمفوَّضة", consequence: "بطلان القرار لعدم الاختصاص", remedy: "مراجعة نطاق التفويض بدقة قبل اتخاذ القرار" },
    { mistake: "تجاهل تعارض المصالح", consequence: "الطعن بالانحياز وإلغاء القرار", remedy: "التنحي والإفصاح عند وجود أي علاقة مع المعني" },
    { mistake: "توثيق غير كافٍ لمسوّغات القرار", consequence: "صعوبة الدفاع عن القرار عند الطعن", remedy: "توثيق جميع الأسباب والمستندات التي قام عليها القرار" },
  ],
  riskIndicators: [
    { indicator: "غياب الأساس القانوني الصريح", severity: "high", flag: "no_legal_basis" },
    { indicator: "تعارض مصالح في صنع القرار", severity: "high", flag: "conflict_of_interest" },
    { indicator: "تجاوز حدود الصلاحية", severity: "high", flag: "authority_gap" },
    { indicator: "إهمال إشعار الطرف المعني", severity: "medium", flag: "notification_pending" },
    { indicator: "القرار يستدعي موافقة مستوى أعلى", severity: "medium", flag: "higher_approval_required" },
  ],
  escalationRules: [
    { condition: "القرار يتجاوز حدود الصلاحية المفوَّضة", escalateTo: "المستوى الإداري الأعلى المختص", mandatory: true },
    { condition: "وجود تعارض مصالح", escalateTo: "رئيس الوحدة والشؤون القانونية", mandatory: true },
    { condition: "قرارات ذات أثر مالي كبير", escalateTo: "موافقة مجلس الإدارة أو اللجنة العليا", mandatory: true },
  ],
  bestPractices: [
    "الاستشارة القانونية قبل القرارات الجوهرية",
    "توثيق جميع مراحل صنع القرار في ملف منظم",
    "إعلام المعني بحقوقه في الطعن",
    "مراجعة دورية للقرارات الصادرة ومدى تنفيذها",
    "تجنب التأثيرات الخارجية غير الرسمية على القرار",
  ],
  thinkingModel: [
    { step: "الاختصاص", question: "هل هذا القرار ضمن صلاحياتي القانونية؟" },
    { step: "المشروعية", question: "هل القرار مستند إلى أساس قانوني صريح؟" },
    { step: "العدالة", question: "هل منحت المعني حقه في الاستماع والدفاع؟" },
    { step: "التوثيق", question: "هل المسوّغات والمستندات الداعمة مكتملة؟" },
    { step: "المخاطر", question: "ما احتمال الطعن في هذا القرار وكيف أتعامل معه؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "الصلاحية القانونية لإصدار القرار ثابتة", category: "legal", mandatory: true },
    { id: "fc2", item: "الأساس القانوني موثَّق ومُستند إليه بصراحة", category: "legal", mandatory: true },
    { id: "fc3", item: "المعني مُنح حق الاستماع (إن لزم)", category: "procedural", mandatory: true },
    { id: "fc4", item: "لا يوجد تعارض مصالح", category: "legal", mandatory: true },
    { id: "fc5", item: "الموافقات التسلسلية الهرمية مستكملة", category: "procedural", mandatory: true },
    { id: "fc6", item: "القرار يحتوي على مسوّغات واضحة", category: "documentation", mandatory: true },
    { id: "fc7", item: "حقوق الطعن محددة في القرار", category: "legal", mandatory: false },
    { id: "fc8", item: "القرار موثق في نظام الأرشفة الرسمي", category: "documentation", mandatory: true },
  ],
  assessmentContext: "متخذ القرار الإداري الحكومي في دولة الإمارات — يعمل وفق إطار قانوني واضح يُلزمه بضمانات العدالة الإجرائية والتسبيب.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الشؤون القانونية — Legal Affairs
// ═════════════════════════════════════════════════════════════════════════════
const LEGAL_AFFAIRS: ProfessionConfig = {
  sectorId: "legal_affairs", sectorNameAr: "الشؤون القانونية", sectorNameEn: "Legal Affairs",
  professionId: "legal_affairs_officer", professionNameAr: "مسؤول الشؤون القانونية", professionNameEn: "Legal Affairs Officer", icon: "📚",
  description: "مسؤول الشؤون القانونية يُقدم الرأي القانوني، يُراجع العقود، ويُتابع قضايا الجهة أمام القضاء.",
  responsibilities: ["تقديم الاستشارات القانونية للجهة","مراجعة العقود والاتفاقيات","تمثيل الجهة أمام القضاء","مراجعة مشاريع القرارات والأنظمة","متابعة التشريعات الجديدة"],
  requiredCompetencies: ["القانون المدني والإداري","صياغة العقود","إدارة التقاضي","تفسير التشريعات","التفاوض القانوني"],
  requiredAuthorities: ["صلاحية تقديم الرأي القانوني","صلاحية التوقيع على اللوائح القانونية","صلاحية تمثيل الجهة قضائياً"],
  legalBasis: [
    { title: "القانون المدني الاتحادي", reference: "قانون اتحادي رقم 5 لسنة 1985 وتعديلاته", type: "law", binding: true },
    { title: "قانون المعاملات التجارية", reference: "قانون اتحادي رقم 18 لسنة 1993", type: "law", binding: true },
    { title: "قانون العمل الاتحادي", reference: "مرسوم بقانون اتحادي رقم 33 لسنة 2021", type: "decree", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_matter", title: "تحديد المسألة القانونية", description: "وصف المسألة وتصنيفها", icon: "🔎",
      questions: [
        { id: "matter_type", text: "ما نوع المسألة القانونية؟", type: "select", required: true, options: ["استشارة قانونية","مراجعة عقد","قضية أمام المحكمة","مراجعة تشريع","نزاع تعاقدي","مسألة تأديبية","أخرى"] },
        { id: "urgency_level", text: "ما درجة الإلحاح؟", type: "select", required: true, options: ["عاجل — مواعيد قانونية وشيكة","متوسط — أسابيع","عادي — لا مواعيد ضاغطة"], decisionKey: "urgency_level" },
        { id: "background", text: "صِف ملابسات المسألة ومرحلتها الحالية.", type: "text", required: true, minLength: 40 },
      ],
      defaultNextStageId: "s2_analysis",
    },
    {
      id: "s2_analysis", title: "التحليل القانوني", description: "تحليل المسألة وتحديد الإطار القانوني", icon: "⚖️",
      questions: [
        { id: "applicable_law", text: "ما القوانين واللوائح المنطبقة على هذه المسألة؟", type: "text", required: true, minLength: 30 },
        { id: "conflicting_obligations", text: "هل ثمة التزامات تعاقدية أو قانونية متعارضة؟", type: "boolean", required: true, decisionKey: "conflicting_obligations" },
        { id: "risk_level", text: "ما مستوى المخاطر القانونية على الجهة؟", type: "select", required: true, options: ["عالٍ — احتمال مسؤولية كبيرة","متوسط — مخاطر محدودة","منخفض — مسألة روتينية"], decisionKey: "risk_level" },
      ],
      defaultNextStageId: "s3_advice",
    },
    {
      id: "s3_advice", title: "صياغة الرأي والتوصية", description: "تحديد الرأي القانوني والتوصيات العملية", icon: "✍️",
      questions: [
        { id: "recommendation", text: "ما الرأي القانوني الذي تنوي تقديمه؟", type: "text", required: true, minLength: 40, hint: "حدد الموقف القانوني بدقة، وخيارات التصرف المتاحة." },
        { id: "escalation", text: "هل المسألة تستدعي رأياً قانونياً خارجياً أو مشورة قانونية أعلى؟", type: "boolean", required: true, decisionKey: "escalation" },
        { id: "documentation_needed", text: "ما المستندات اللازمة لإتمام الرأي القانوني؟", type: "text", required: false, minLength: 10 },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_matter", questionId: "urgency_level", answer: "عاجل — مواعيد قانونية وشيكة", nextStageId: "s2_analysis", addFlag: "urgent_deadline" },
    { stageId: "s2_analysis", questionId: "conflicting_obligations", answer: "true", nextStageId: "s3_advice", addFlag: "conflicting_obligations" },
    { stageId: "s2_analysis", questionId: "risk_level", answer: "عالٍ — احتمال مسؤولية كبيرة", nextStageId: "s3_advice", addFlag: "high_legal_risk" },
    { stageId: "s3_advice", questionId: "escalation", answer: "true", nextStageId: "s3_advice", addFlag: "external_opinion_required" },
  ],
  requiredDocuments: [
    { name: "طلب الاستشارة القانونية الرسمي", mandatory: true },
    { name: "الوثائق والعقود ذات الصلة", mandatory: true },
    { name: "المراسلات السابقة في المسألة", mandatory: false },
    { name: "آراء قانونية سابقة (إن وُجدت)", mandatory: false },
    { name: "مستندات القضية (في حال التمثيل القضائي)", mandatory: false, whenRequired: "عند الترافع أمام القضاء" },
    { name: "مذكرة الرأي القانوني", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "الخلط بين الاستشارة القانونية والقرار الإداري", consequence: "نسب قرارات للمستشار تتجاوز دوره", remedy: "التمييز الواضح بين الرأي الاستشاري وقرار الجهة" },
    { mistake: "إغفال المواعيد القانونية في التقاضي", consequence: "انقضاء الحق أو سقوط الدعوى", remedy: "إنشاء نظام لتتبع المواعيد القانونية بدقة" },
    { mistake: "تقديم رأي قانوني دون الاطلاع على كامل الوثائق", consequence: "رأي قانوني مجتزأ أو مضلل", remedy: "الإصرار على الحصول على جميع الوثائق قبل الإفتاء" },
    { mistake: "إهمال متابعة تطورات التشريعات", consequence: "تقديم آراء مبنية على قوانين منسوخة", remedy: "المتابعة المنتظمة للجريدة الرسمية والتعديلات التشريعية" },
    { mistake: "إعداد مذكرات قانونية غير مدعومة بالنصوص", consequence: "ضعف موقف الجهة أمام القضاء", remedy: "الاستناد الصريح إلى المواد القانونية والسوابق القضائية" },
  ],
  riskIndicators: [
    { indicator: "مواعيد قانونية وشيكة", severity: "high", flag: "urgent_deadline" },
    { indicator: "التزامات قانونية متعارضة", severity: "high", flag: "conflicting_obligations" },
    { indicator: "مسؤولية قانونية عالية للجهة", severity: "high", flag: "high_legal_risk" },
    { indicator: "الحاجة لرأي قانوني خارجي", severity: "medium", flag: "external_opinion_required" },
  ],
  escalationRules: [
    { condition: "قضايا ذات مخاطر مالية كبيرة على الجهة", escalateTo: "المستشار القانوني العام أو الرئيس التنفيذي", mandatory: true },
    { condition: "مسائل دستورية أو تشريعية جوهرية", escalateTo: "إدارة الفتوى والتشريع أو مستشار خارجي", mandatory: true },
    { condition: "نزاع دولي أو تعاقد عابر للحدود", escalateTo: "مستشار قانوني متخصص في القانون الدولي", mandatory: true },
  ],
  bestPractices: [
    "توثيق كل رأي قانوني كتابياً مع مراجعه ومستنداته",
    "التحديث الدوري لقاعدة بيانات التشريعات المعمول بها",
    "إنشاء نظام إنذار مبكر للمواعيد القانونية",
    "مراجعة العقود قبل التوقيع لا بعده",
    "بناء ذاكرة مؤسسية للآراء القانونية السابقة",
  ],
  thinkingModel: [
    { step: "التصنيف", question: "ما طبيعة المسألة القانونية ونطاقها؟" },
    { step: "الإطار", question: "ما القوانين واللوائح الحاكمة لهذه المسألة؟" },
    { step: "الخيارات", question: "ما الخيارات القانونية المتاحة وما مزايا كل منها؟" },
    { step: "التوصية", question: "ما الرأي الأكثر حماية لمصالح الجهة مع الالتزام بالقانون؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "المسألة القانونية محددة ومصنفة بدقة", category: "legal", mandatory: true },
    { id: "fc2", item: "جميع الوثائق الداعمة استُعرضت", category: "documentation", mandatory: true },
    { id: "fc3", item: "النصوص القانونية المنطبقة محددة صراحةً", category: "legal", mandatory: true },
    { id: "fc4", item: "المخاطر القانونية مُقيَّمة", category: "risk", mandatory: true },
    { id: "fc5", item: "الرأي القانوني موثق كتابياً", category: "documentation", mandatory: true },
    { id: "fc6", item: "المواعيد القانونية محددة ومُتابَعة", category: "procedural", mandatory: true },
    { id: "fc7", item: "التوصية العملية واضحة وقابلة للتنفيذ", category: "quality", mandatory: true },
    { id: "fc8", item: "الرأي مُعتمد من المستوى الإداري المناسب", category: "procedural", mandatory: false },
  ],
  assessmentContext: "مسؤول الشؤون القانونية في الجهة الحكومية الإماراتية — يُقدم الرأي الاستشاري ويمثل الجهة قانونياً ويتابع التشريعات.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الموارد البشرية — Human Resources
// ═════════════════════════════════════════════════════════════════════════════
const HR_OFFICER: ProfessionConfig = {
  sectorId: "human_resources", sectorNameAr: "الموارد البشرية", sectorNameEn: "Human Resources",
  professionId: "hr_officer", professionNameAr: "مسؤول الموارد البشرية", professionNameEn: "HR Officer", icon: "👥",
  description: "مسؤول الموارد البشرية يُدير دورة حياة الموظف من التوظيف إلى انتهاء الخدمة وفق التشريعات المعمول بها.",
  responsibilities: ["إدارة التوظيف والاستقطاب","تطبيق سياسات الموارد البشرية","إجراء التحقيقات الإدارية","إدارة العلاقات الوظيفية","تطوير الكفاءات والتدريب"],
  requiredCompetencies: ["قانون العمل والموارد البشرية","التحقيق الإداري","تقييم الأداء","إدارة النزاعات","التواصل المؤسسي"],
  requiredAuthorities: ["صلاحية التوظيف ضمن نطاق الاعتماد","صلاحية إجراء التحقيقات","صلاحية تطبيق العقوبات ضمن الصلاحيات"],
  legalBasis: [
    { title: "مرسوم بقانون الموارد البشرية الاتحادي", reference: "مرسوم بقانون اتحادي رقم 49 لسنة 2023", type: "decree", binding: true },
    { title: "قانون العمل الاتحادي", reference: "مرسوم بقانون اتحادي رقم 33 لسنة 2021", type: "decree", binding: true },
    { title: "لائحة تأديب الموظفين", reference: "اللوائح التنفيذية المعتمدة لكل جهة", type: "regulation", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_case", title: "تحديد الحالة الوظيفية", description: "تصنيف الحالة وتحديد الإجراء المطلوب", icon: "👤",
      questions: [
        { id: "hr_matter", text: "ما نوع الحالة الوظيفية؟", type: "select", required: true, options: ["توظيف جديد","تعديل مسمى/راتب","إجازة / غياب","تحقيق إداري","إنهاء خدمة","شكوى وظيفية","تقييم أداء","تدريب وتطوير"], decisionKey: "hr_matter" },
        { id: "employee_category", text: "فئة الموظف؟", type: "select", required: true, options: ["موظف اتحادي","موظف محلي","متعاقد","مواطن","غير مواطن"] },
        { id: "urgency", text: "هل الحالة عاجلة؟", type: "boolean", required: true, decisionKey: "urgency" },
      ],
      defaultNextStageId: "s2_policy",
    },
    {
      id: "s2_policy", title: "مراجعة السياسة والإجراء المنطبق", description: "تحديد السياسة والإجراء القانوني الواجب", icon: "📋",
      questions: [
        { id: "policy_exists", text: "هل ثمة سياسة أو إجراء واضح يحكم هذه الحالة؟", type: "boolean", required: true, decisionKey: "policy_exists" },
        { id: "steps_taken", text: "ما الخطوات المتخذة حتى الآن في هذه الحالة؟", type: "text", required: true, minLength: 20 },
        { id: "employee_notified", text: "هل الموظف مُبلَّغ بالإجراء المتخذ؟", type: "boolean", required: true, decisionKey: "employee_notified" },
      ],
      defaultNextStageId: "s3_decision",
    },
    {
      id: "s3_decision", title: "القرار الوظيفي والمستندات", description: "اتخاذ القرار وتوثيقه", icon: "📝",
      questions: [
        { id: "decision", text: "ما القرار الوظيفي المقترح؟", type: "text", required: true, minLength: 20 },
        { id: "documents_complete", text: "هل الملف الوظيفي مكتمل بالمستندات اللازمة؟", type: "boolean", required: true },
        { id: "appeal_informed", text: "هل الموظف مُطلَع على حقه في التظلم؟", type: "boolean", required: true },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_case", questionId: "hr_matter", answer: "تحقيق إداري", nextStageId: "s2_policy", addFlag: "disciplinary_investigation" },
    { stageId: "s1_case", questionId: "hr_matter", answer: "إنهاء خدمة", nextStageId: "s2_policy", addFlag: "termination_process" },
    { stageId: "s1_case", questionId: "urgency", answer: "true", nextStageId: "s2_policy", addFlag: "urgent_matter" },
    { stageId: "s2_policy", questionId: "policy_exists", answer: "false", nextStageId: "s3_decision", addFlag: "no_policy_gap" },
    { stageId: "s2_policy", questionId: "employee_notified", answer: "false", nextStageId: "s3_decision", addFlag: "employee_not_notified" },
  ],
  requiredDocuments: [
    { name: "الملف الوظيفي الشامل", mandatory: true },
    { name: "عقد التوظيف أو آخر تعديل رسمي", mandatory: true },
    { name: "تقارير تقييم الأداء السنوية", mandatory: false },
    { name: "سجل الحضور والغياب", mandatory: false, whenRequired: "في حالات التغيب" },
    { name: "محاضر التحقيق الإداري", mandatory: false, whenRequired: "في الحالات التأديبية" },
    { name: "أمر القرار الوظيفي المُوقَّع", mandatory: true },
    { name: "إشعار الموظف الرسمي", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "إنهاء خدمة موظف دون تحقيق مسبق", consequence: "حكم بإعادة الموظف وتعويضه", remedy: "الإلزام بإجراء التحقيق الإداري قبل أي قرار بإنهاء الخدمة" },
    { mistake: "عدم إحاطة الموظف بالتهم الموجهة إليه", consequence: "بطلان قرار الجزاء", remedy: "إبلاغ الموظف كتابياً بكل تهمة قبل الاستجواب" },
    { mistake: "تطبيق عقوبة غير متناسبة مع المخالفة", consequence: "إلغاء القرار التأديبي", remedy: "التحقق من جدول العقوبات ومبدأ التناسب" },
    { mistake: "إهمال حفظ الملف الوظيفي بصورة منتظمة", consequence: "صعوبة الإثبات عند النزاع", remedy: "تحديث الملف الوظيفي باستمرار" },
    { mistake: "تجاوز مدد التقادم في المخالفات التأديبية", consequence: "سقوط حق الجهة في المحاسبة", remedy: "التتبع الدقيق لمدد التقادم وفق اللائحة" },
  ],
  riskIndicators: [
    { indicator: "إجراء تأديبي دون استيفاء ضمانات الدفاع", severity: "high", flag: "disciplinary_investigation" },
    { indicator: "إنهاء خدمة بدون توثيق كافٍ", severity: "high", flag: "termination_process" },
    { indicator: "موظف لم يُبلَّغ بالإجراء", severity: "medium", flag: "employee_not_notified" },
    { indicator: "غياب سياسة رسمية للحالة", severity: "medium", flag: "no_policy_gap" },
  ],
  escalationRules: [
    { condition: "تحقيق يتعلق بمسؤول تنفيذي", escalateTo: "الرئيس التنفيذي واللجنة التأديبية العليا", mandatory: true },
    { condition: "شكوى تمييز أو تحرش في العمل", escalateTo: "وحدة الشكاوى المتخصصة وفريق قانوني", mandatory: true },
    { condition: "نزاع عمالي خارج صلاحيات الجهة", escalateTo: "وزارة الموارد البشرية والتوطين", mandatory: true },
  ],
  bestPractices: [
    "توثيق كل قرار وظيفي فور اتخاذه مع مسوّغاته",
    "التثبت من مطابقة كل إجراء للائحة قبل تطبيقه",
    "ضمان حصول الموظف على نسخة من كل قرار يخصه",
    "مراجعة دورية لسياسات الموارد البشرية لمواكبة التشريعات",
    "التدريب المستمر للمديرين على التعامل مع الحالات الوظيفية",
  ],
  thinkingModel: [
    { step: "التصنيف", question: "هل هذه حالة إدارية، تأديبية، أم اجتماعية؟" },
    { step: "السياسة", question: "ما الإجراء الرسمي المحدد لهذه الحالة؟" },
    { step: "العدالة", question: "هل منحت الموظف حقوقه كاملة في الاستماع والدفاع؟" },
    { step: "التوثيق", question: "هل الملف مكتمل لدعم القرار عند أي نزاع لاحق؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "الحالة مصنفة وفق السياسة الرسمية", category: "procedural", mandatory: true },
    { id: "fc2", item: "الموظف أُبلغ بالإجراء كتابياً", category: "procedural", mandatory: true },
    { id: "fc3", item: "التحقيق الإداري استوفى ضمانات الدفاع (إن لزم)", category: "legal", mandatory: true },
    { id: "fc4", item: "القرار يتوافق مع جدول الجزاءات المعتمد", category: "legal", mandatory: true },
    { id: "fc5", item: "الملف الوظيفي محدَّث ومكتمل", category: "documentation", mandatory: true },
    { id: "fc6", item: "الموظف مُبلَّغ بحق التظلم", category: "legal", mandatory: true },
    { id: "fc7", item: "القرار موثق بتوقيعات الموافقة المطلوبة", category: "procedural", mandatory: true },
    { id: "fc8", item: "مدد التقادم محددة ومتابَعة", category: "risk", mandatory: false },
  ],
  assessmentContext: "مسؤول الموارد البشرية في الجهة الحكومية الإماراتية — يطبق أنظمة الخدمة المدنية الاتحادية والمحلية ويضمن العدالة الوظيفية.",
};

export const GOVERNMENT_PROFESSIONS: ProfessionConfig[] = [ADMIN_DECISION_MAKER, LEGAL_AFFAIRS, HR_OFFICER];
