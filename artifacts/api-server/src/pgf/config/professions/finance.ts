import type { ProfessionConfig } from "../../types.js";

// ─── Shared workflow for finance professions ──────────────────────────────────
function financeStages(role: string, legalRef: string) {
  return [
    {
      id: "s1_transaction", title: "تحديد المعاملة أو الحالة المالية", description: "وصف وتصنيف المعاملة أو الحالة المالية", icon: "💼",
      questions: [
        { id: "transaction_type", text: "ما نوع المعاملة أو الحالة المالية؟", type: "text" as const, required: true, minLength: 20 },
        { id: "amount", text: "ما القيمة المالية المعنية؟ (نطاق تقريبي)", type: "select" as const, required: true, options: ["أقل من 100,000 درهم","100,000 - 1,000,000 درهم","1 - 10 مليون درهم","أكثر من 10 مليون درهم"], decisionKey: "amount" },
        { id: "legal_basis", text: `ما النص القانوني الحاكم لهذه المعاملة؟ (${legalRef})`, type: "text" as const, required: true, minLength: 15 },
      ],
      defaultNextStageId: "s2_compliance_check",
    },
    {
      id: "s2_compliance_check", title: "فحص الامتثال والإجراءات", description: "التحقق من استيفاء إجراءات الرقابة المالية", icon: "✅",
      questions: [
        { id: "approvals_obtained", text: "هل الموافقات التسلسلية الهرمية مستكملة؟", type: "boolean" as const, required: true, decisionKey: "approvals_obtained" },
        { id: "documentation_complete", text: "هل المستندات الداعمة كاملة وصحيحة؟", type: "boolean" as const, required: true, decisionKey: "documentation_complete" },
        { id: "conflict_interest", text: "هل يوجد أي تضارب مصالح في هذه المعاملة؟", type: "boolean" as const, required: true, decisionKey: "conflict_interest" },
      ],
      defaultNextStageId: "s3_risk_action",
    },
    {
      id: "s3_risk_action", title: "المخاطر والإجراء المقترح", description: "تقييم المخاطر المالية وتحديد الإجراء", icon: "⚠️",
      questions: [
        { id: "financial_risk", text: "ما المخاطر المالية المرتبطة بهذه الحالة؟", type: "text" as const, required: true, minLength: 20, hint: "مثلاً: مخاطر السيولة، مخاطر الاحتيال، مخاطر الامتثال الضريبي." },
        { id: "recommended_action", text: "ما الإجراء المالي المقترح؟", type: "text" as const, required: true, minLength: 15 },
        { id: "escalation_req", text: "هل الحالة تستدعي موافقة مالية عليا؟", type: "boolean" as const, required: true, decisionKey: "escalation_req" },
      ],
    },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: المشتريات — Procurement
// ═════════════════════════════════════════════════════════════════════════════
const PROCUREMENT_OFFICER: ProfessionConfig = {
  sectorId: "procurement", sectorNameAr: "المشتريات", sectorNameEn: "Procurement",
  professionId: "procurement_officer", professionNameAr: "مسؤول المشتريات", professionNameEn: "Procurement Officer", icon: "📦",
  description: "مسؤول المشتريات يُنفذ إجراءات التوريد والتعاقد وفق لوائح المشتريات الحكومية لضمان العدالة والشفافية.",
  responsibilities: ["تنفيذ إجراءات المناقصات والعروض","مراجعة عقود الموردين","ضمان الامتثال للوائح المشتريات","تقييم العروض وترسية العقود","متابعة تنفيذ العقود"],
  requiredCompetencies: ["لوائح المشتريات الحكومية","تقييم العروض","إدارة العقود","التفاوض مع الموردين","إدارة المخاطر التعاقدية"],
  requiredAuthorities: ["صلاحية دعوة الموردين","صلاحية مراجعة العروض","صلاحية إعداد توصية الترسية","صلاحية إصدار أوامر الشراء ضمن الاعتماد"],
  legalBasis: [
    { title: "قانون المناقصات والمزايدات الاتحادي", reference: "مرسوم بقانون اتحادي رقم 6 لسنة 2008 وتعديلاته", type: "decree", binding: true },
    { title: "اللائحة التنفيذية للمشتريات الاتحادية", reference: "قرار مجلس الوزراء رقم 32 لسنة 2014", type: "regulation", binding: true },
    { title: "اشتراطات التوطين والمحتوى المحلي", reference: "سياسة المحتوى الوطني المعتمدة", type: "policy", binding: true },
  ],
  workflowStages: financeStages("مسؤول المشتريات", "قانون المناقصات والمزايدات"),
  decisionTree: [
    { stageId: "s1_transaction", questionId: "amount", answer: "أكثر من 10 مليون درهم", nextStageId: "s2_compliance_check", addFlag: "high_value_tender" },
    { stageId: "s2_compliance_check", questionId: "approvals_obtained", answer: "false", nextStageId: "s3_risk_action", addFlag: "missing_approvals" },
    { stageId: "s2_compliance_check", questionId: "conflict_interest", answer: "true", nextStageId: "s3_risk_action", addFlag: "conflict_of_interest" },
    { stageId: "s3_risk_action", questionId: "escalation_req", answer: "true", nextStageId: "s3_risk_action", addFlag: "senior_approval_required" },
  ],
  requiredDocuments: [
    { name: "طلب الشراء المعتمد", mandatory: true },
    { name: "وثائق المناقصة / طلب العروض", mandatory: true },
    { name: "محضر لجنة العطاءات", mandatory: true },
    { name: "تقرير تقييم العروض", mandatory: true },
    { name: "عقد التوريد أو الخدمة الموقع", mandatory: true },
    { name: "الضمانات البنكية (إن لزمت)", mandatory: false, whenRequired: "في العقود الكبيرة" },
    { name: "شهادة إنجاز الخدمات أو تسلم البضاعة", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "تجزئة المشتريات للتحايل على حدود الاعتماد", consequence: "مخالفة اللوائح والتعرض للتحقيق", remedy: "التعامل مع المشتريات المتشابهة كصفقة واحدة" },
    { mistake: "قبول عروض تقل عن الحد الأدنى المطلوب", consequence: "ضعف التنافسية وانخفاض جودة الخدمة", remedy: "الالتزام بالحد الأدنى لعدد العروض المطلوبة قانوناً" },
    { mistake: "مشاركة المورد في تصميم المواصفات", consequence: "عقد مفصَّل لمورد بعينه", remedy: "الفصل الكامل بين مرحلة التصميم وعملية العطاء" },
    { mistake: "إغفال شروط الكفالات والضمانات", consequence: "ضياع حقوق الجهة عند تعثر المورد", remedy: "التحقق من صلاحية الكفالات ومطابقتها للعقد" },
    { mistake: "التعاقد مع مورد غير مؤهل", consequence: "فشل العقد وخسارة مالية", remedy: "فحص دقيق لمؤهلات وملف المورد قبل الترسية" },
  ],
  riskIndicators: [
    { indicator: "مناقصة بقيمة عالية جداً", severity: "high", flag: "high_value_tender" },
    { indicator: "موافقات ناقصة", severity: "high", flag: "missing_approvals" },
    { indicator: "تضارب مصالح في التقييم", severity: "high", flag: "conflict_of_interest" },
    { indicator: "حاجة لموافقة عليا", severity: "medium", flag: "senior_approval_required" },
  ],
  escalationRules: [
    { condition: "مناقصات تتجاوز حد الاعتماد الممنوح", escalateTo: "لجنة العطاءات العليا أو مجلس الإدارة", mandatory: true },
    { condition: "شبهة تلاعب في العطاءات", escalateTo: "الجهات الرقابية وهيئة مكافحة الفساد", mandatory: true },
    { condition: "نزاع مع مورد عن عقد كبير", escalateTo: "الشؤون القانونية والإدارة العليا", mandatory: true },
  ],
  bestPractices: [
    "توثيق كل مرحلة من مراحل المناقصة بدقة",
    "الإفصاح الكامل للموردين عن معايير التقييم مسبقاً",
    "تدوير أعضاء لجان التقييم لتجنب تضارب المصالح",
    "مراجعة أداء الموردين الحاليين قبل التجديد",
    "بناء سجل للموردين المعتمدين وتحديثه باستمرار",
  ],
  thinkingModel: [
    { step: "الاحتياج", question: "هل الاحتياج محدد بدقة وليس مبالغاً فيه؟" },
    { step: "التنافس", question: "هل العملية تضمن منافسة عادلة بين الموردين؟" },
    { step: "الامتثال", question: "هل جميع إجراءات اللائحة مُستوفاة بالتسلسل الصحيح؟" },
    { step: "القيمة", question: "هل الترسية تحقق أفضل قيمة مقابل المال للجهة؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "طلب الشراء معتمد من المستوى الصحيح", category: "procedural", mandatory: true },
    { id: "fc2", item: "وثائق المناقصة شاملة وعادلة", category: "quality", mandatory: true },
    { id: "fc3", item: "محضر لجنة التقييم موقَّع ومكتمل", category: "documentation", mandatory: true },
    { id: "fc4", item: "الترسية مبررة بمعايير موضوعية", category: "legal", mandatory: true },
    { id: "fc5", item: "العقد يحمي حقوق الجهة ويتضمن آليات العقوبات", category: "legal", mandatory: true },
    { id: "fc6", item: "تضارب المصالح مُعلَن ومُدار", category: "legal", mandatory: true },
    { id: "fc7", item: "الكفالات صالحة ومودَعة", category: "risk", mandatory: false },
    { id: "fc8", item: "آلية متابعة تنفيذ العقد محددة", category: "procedural", mandatory: true },
  ],
  assessmentContext: "مسؤول المشتريات الحكومي في دولة الإمارات — يعمل وفق لوائح المناقصات الاتحادية وقرارات الوزراء.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: المالية الحكومية — Government Finance
// ═════════════════════════════════════════════════════════════════════════════
const FINANCE_OFFICER: ProfessionConfig = {
  sectorId: "finance", sectorNameAr: "المالية الحكومية", sectorNameEn: "Government Finance",
  professionId: "finance_officer", professionNameAr: "مسؤول المالية الحكومية", professionNameEn: "Government Finance Officer", icon: "💰",
  description: "مسؤول المالية الحكومية يُدير الموازنات والتقارير المالية ويضمن الامتثال للمعايير المالية الحكومية.",
  responsibilities: ["إعداد الموازنات وإدارتها","إعداد التقارير المالية الدورية","ضمان صحة البيانات المحاسبية","الرقابة على الصرف","متابعة الإيرادات والمصروفات"],
  requiredCompetencies: ["المحاسبة الحكومية IPSAS","تحليل الموازنات","الرقابة المالية","إعداد التقارير التنفيذية","المعايير الدولية للقطاع العام"],
  requiredAuthorities: ["صلاحية إصدار أوامر الصرف ضمن الاعتماد","صلاحية مراجعة البيانات المالية","صلاحية التحقق من الاعتمادات"],
  legalBasis: [
    { title: "قانون المالية العامة", reference: "قانون اتحادي رقم 7 لسنة 2021", type: "law", binding: true },
    { title: "معايير المحاسبة الحكومية الدولية IPSAS", reference: "IPSAS — International Public Sector Accounting Standards", type: "standard", binding: false },
    { title: "لوائح الصرف الحكومي", reference: "قرارات وزير المالية التنفيذية", type: "regulation", binding: true },
  ],
  workflowStages: financeStages("مسؤول المالية", "قانون المالية العامة ولوائح الصرف"),
  decisionTree: [
    { stageId: "s1_transaction", questionId: "amount", answer: "أكثر من 10 مليون درهم", nextStageId: "s2_compliance_check", addFlag: "large_transaction" },
    { stageId: "s2_compliance_check", questionId: "approvals_obtained", answer: "false", nextStageId: "s3_risk_action", addFlag: "missing_approvals" },
    { stageId: "s2_compliance_check", questionId: "documentation_complete", answer: "false", nextStageId: "s3_risk_action", addFlag: "documentation_gap" },
    { stageId: "s3_risk_action", questionId: "escalation_req", answer: "true", nextStageId: "s3_risk_action", addFlag: "finance_escalation" },
  ],
  requiredDocuments: [
    { name: "الموازنة التشغيلية المعتمدة", mandatory: true },
    { name: "أوامر الصرف وفواتير الموردين", mandatory: true },
    { name: "كشوف الحسابات الشهرية", mandatory: true },
    { name: "تقارير الانحراف عن الموازنة", mandatory: false },
    { name: "القيود المحاسبية", mandatory: true },
    { name: "التقرير المالي الدوري", mandatory: true },
    { name: "الاعتمادات المالية", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "الصرف بدون اعتماد موازنة كافٍ", consequence: "تجاوز الموازنة وعقوبات مالية", remedy: "التحقق من الرصيد المتاح قبل أي عملية صرف" },
    { mistake: "تأخير إعداد التقارير المالية", consequence: "قرارات مبنية على بيانات قديمة", remedy: "جداول زمنية صارمة لإعداد التقارير مع مساءلة واضحة" },
    { mistake: "ضعف الفصل بين المهام (Segregation of Duties)", consequence: "خطر احتيال داخلي وضعف الرقابة", remedy: "تطبيق مبدأ الفصل الكامل بين الأمين والمحاسب والمعتمِد" },
    { mistake: "عدم التسوية الدورية للحسابات", consequence: "تراكم الفروقات واستحالة المراجعة", remedy: "تسوية الحسابات شهرياً كأقصى حد" },
    { mistake: "إغفال المتطلبات الضريبية في المعاملات", consequence: "غرامات ضريبية وسمعة مالية متأثرة", remedy: "التحقق من الالتزامات الضريبية في كل معاملة كبيرة" },
  ],
  riskIndicators: [
    { indicator: "معاملة مالية ذات قيمة عالية", severity: "high", flag: "large_transaction" },
    { indicator: "موافقات مالية ناقصة", severity: "high", flag: "missing_approvals" },
    { indicator: "وثائق مالية غير مكتملة", severity: "medium", flag: "documentation_gap" },
    { indicator: "حاجة لتصعيد مالي", severity: "medium", flag: "finance_escalation" },
  ],
  escalationRules: [
    { condition: "تجاوز الموازنة المعتمدة", escalateTo: "وزارة المالية ومسؤول الموازنة", mandatory: true },
    { condition: "اشتباه في مخالفة مالية أو احتيال", escalateTo: "التدقيق الداخلي والنيابة العامة", mandatory: true },
    { condition: "معاملات فوق حد الاعتماد الممنوح", escalateTo: "وزير المالية أو المجلس التنفيذي", mandatory: true },
  ],
  bestPractices: [
    "الفصل الكامل بين مهام الأمانة والمحاسبة والاعتماد",
    "مراجعة شهرية لتحليل الانحراف عن الموازنة",
    "تطبيق معايير IPSAS في إعداد التقارير المالية",
    "أرشفة إلكترونية منظمة لجميع المستندات المالية",
    "تدريب دوري على التحديثات في اللوائح المالية الحكومية",
  ],
  thinkingModel: [
    { step: "الاعتماد", question: "هل يوجد اعتماد موازنة كافٍ لهذه المعاملة؟" },
    { step: "الموافقة", question: "هل الموافقات التسلسلية المطلوبة مستكملة؟" },
    { step: "التوثيق", question: "هل المستندات الداعمة كاملة وصحيحة؟" },
    { step: "الرقابة", question: "هل مبدأ الفصل بين المهام محترم في هذه المعاملة؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "الاعتماد المالي متاح وغير متجاوَز", category: "legal", mandatory: true },
    { id: "fc2", item: "الموافقات التسلسلية مستكملة", category: "procedural", mandatory: true },
    { id: "fc3", item: "الوثائق المالية الداعمة كاملة", category: "documentation", mandatory: true },
    { id: "fc4", item: "القيود المحاسبية صحيحة ومرحَّلة", category: "quality", mandatory: true },
    { id: "fc5", item: "الفصل بين المهام محترم", category: "legal", mandatory: true },
    { id: "fc6", item: "المتطلبات الضريبية مستوفاة", category: "legal", mandatory: false },
    { id: "fc7", item: "التقرير المالي جاهز للمراجعة", category: "documentation", mandatory: true },
    { id: "fc8", item: "التسوية الدورية للحسابات مكتملة", category: "procedural", mandatory: true },
  ],
  assessmentContext: "مسؤول المالية الحكومية في دولة الإمارات — يعمل وفق قانون المالية العامة ومعايير IPSAS.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الضرائب — Taxation
// ═════════════════════════════════════════════════════════════════════════════
const TAX_OFFICER: ProfessionConfig = {
  sectorId: "taxation", sectorNameAr: "الضرائب", sectorNameEn: "Taxation",
  professionId: "tax_officer", professionNameAr: "مسؤول الضرائب", professionNameEn: "Tax Officer", icon: "🧾",
  description: "مسؤول الضرائب يُطبق تشريعات الضريبة على القيمة المضافة وضريبة الشركات ويُعد الإقرارات الضريبية.",
  responsibilities: ["إعداد الإقرارات الضريبية","إدارة التسجيل الضريبي","التعامل مع الهيئة الاتحادية للضرائب","إدارة النزاعات الضريبية","التخطيط الضريبي الامتثالي"],
  requiredCompetencies: ["ضريبة القيمة المضافة VAT","ضريبة الشركات CIT","الإقرارات الضريبية","التفسير التشريعي الضريبي","التحويل بين الأنظمة المحاسبية"],
  requiredAuthorities: ["صلاحية التسجيل الضريبي","صلاحية تقديم الإقرارات","صلاحية التواصل مع هيئة الضرائب"],
  legalBasis: [
    { title: "قانون ضريبة القيمة المضافة", reference: "مرسوم بقانون اتحادي رقم 8 لسنة 2017", type: "decree", binding: true },
    { title: "قانون ضريبة الشركات", reference: "مرسوم بقانون اتحادي رقم 47 لسنة 2022", type: "decree", binding: true },
    { title: "لائحة ضريبة القيمة المضافة التنفيذية", reference: "مرسوم بقانون رقم 52 لسنة 2017", type: "decree", binding: true },
  ],
  workflowStages: financeStages("مسؤول الضرائب", "قانون ضريبة القيمة المضافة وضريبة الشركات"),
  decisionTree: [
    { stageId: "s1_transaction", questionId: "amount", answer: "أكثر من 10 مليون درهم", nextStageId: "s2_compliance_check", addFlag: "large_tax_transaction" },
    { stageId: "s2_compliance_check", questionId: "approvals_obtained", answer: "false", nextStageId: "s3_risk_action", addFlag: "missing_tax_documentation" },
    { stageId: "s2_compliance_check", questionId: "documentation_complete", answer: "false", nextStageId: "s3_risk_action", addFlag: "incomplete_tax_records" },
    { stageId: "s3_risk_action", questionId: "escalation_req", answer: "true", nextStageId: "s3_risk_action", addFlag: "tax_dispute" },
  ],
  requiredDocuments: [
    { name: "شهادة التسجيل الضريبي", mandatory: true },
    { name: "الفواتير الضريبية المستوفاة للشروط", mandatory: true },
    { name: "سجل المبيعات والمشتريات", mandatory: true },
    { name: "الإقرار الضريبي المُعد للتقديم", mandatory: true },
    { name: "إيصالات دفع الضريبة السابقة", mandatory: false },
    { name: "مراسلات الهيئة الاتحادية للضرائب", mandatory: false },
    { name: "وثائق دعم استرداد الضريبة (إن وُجدت)", mandatory: false },
  ],
  commonMistakes: [
    { mistake: "تأخير تسجيل الجهة ضريبياً عند تجاوز عتبة التسجيل", consequence: "غرامات التأخير وأثر رجعي", remedy: "مراقبة الإيرادات مقارنة بعتبة التسجيل بصورة مستمرة" },
    { mistake: "إدراج ضريبة مدخلات غير قابلة للاسترداد", consequence: "غرامات ورسوم إضافية", remedy: "مراجعة قوائم الضريبة غير القابلة للاسترداد قبل الإقرار" },
    { mistake: "أخطاء في حساب الضريبة على المعاملات المختلطة", consequence: "نقص في المبالغ المسددة", remedy: "تصنيف كل معاملة بدقة قبل حساب الضريبة" },
    { mistake: "إهمال الاحتفاظ بالمستندات المطلوبة قانوناً", consequence: "رفض المطالبات في حالة التدقيق", remedy: "الاحتفاظ بالمستندات 5 سنوات كحد أدنى" },
    { mistake: "تسجيل إيرادات الفترة في الفترة الخاطئة", consequence: "اختلال أساس الضريبة", remedy: "مراجعة مبدأ الاستحقاق قبل إعداد كل إقرار" },
  ],
  riskIndicators: [
    { indicator: "معاملة ضريبية كبيرة القيمة", severity: "high", flag: "large_tax_transaction" },
    { indicator: "وثائق ضريبية ناقصة", severity: "high", flag: "incomplete_tax_records" },
    { indicator: "نزاع ضريبي مع الهيئة", severity: "high", flag: "tax_dispute" },
    { indicator: "سجلات ضريبية غير مكتملة", severity: "medium", flag: "missing_tax_documentation" },
  ],
  escalationRules: [
    { condition: "نزاع ضريبي مع الهيئة الاتحادية للضرائب", escalateTo: "مستشار ضريبي متخصص والإدارة العليا", mandatory: true },
    { condition: "اكتشاف أخطاء جوهرية في إقرارات سابقة", escalateTo: "الهيئة الاتحادية للضرائب طوعاً وفق الآليات المقررة", mandatory: true },
    { condition: "استفسارات تحقيق ضريبي", escalateTo: "مستشار قانوني ضريبي متخصص", mandatory: true },
  ],
  bestPractices: [
    "مراجعة جميع الفواتير قبل تقديم الإقرار",
    "تتبع مواعيد الإقرارات والسداد في تقويم ضريبي مخصص",
    "التحديث الدوري على تعديلات قانون الضريبة",
    "الاحتفاظ بأرشيف منظم للمستندات الضريبية لمدة 5 سنوات",
    "التواصل الاستباقي مع الهيئة عند أي استفسار",
  ],
  thinkingModel: [
    { step: "التصنيف", question: "ما التصنيف الضريبي الصحيح لهذه المعاملة؟" },
    { step: "التوثيق", question: "هل الفاتورة مستوفية لجميع الشروط القانونية؟" },
    { step: "الحساب", question: "هل مبلغ الضريبة محسوب وفق الآلية الصحيحة؟" },
    { step: "الامتثال", question: "هل سيُقدَّم الإقرار في الموعد القانوني؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "التسجيل الضريبي ساري وصالح", category: "legal", mandatory: true },
    { id: "fc2", item: "جميع الفواتير مستوفية للشروط القانونية", category: "legal", mandatory: true },
    { id: "fc3", item: "سجل المبيعات والمشتريات مكتمل", category: "documentation", mandatory: true },
    { id: "fc4", item: "الإقرار الضريبي محسوب ومراجَع", category: "quality", mandatory: true },
    { id: "fc5", item: "الإقرار مُقدَّم في الموعد المحدد", category: "procedural", mandatory: true },
    { id: "fc6", item: "الضريبة المستحقة مسددة كاملة", category: "legal", mandatory: true },
    { id: "fc7", item: "المستندات محفوظة 5 سنوات كحد أدنى", category: "documentation", mandatory: true },
    { id: "fc8", item: "مراسلات الهيئة مُرد عليها", category: "procedural", mandatory: false },
  ],
  assessmentContext: "مسؤول الضرائب في دولة الإمارات — يعمل مع الهيئة الاتحادية للضرائب وفق قوانين VAT وضريبة الشركات.",
};

export const FINANCE_PROFESSIONS: ProfessionConfig[] = [PROCUREMENT_OFFICER, FINANCE_OFFICER, TAX_OFFICER];
