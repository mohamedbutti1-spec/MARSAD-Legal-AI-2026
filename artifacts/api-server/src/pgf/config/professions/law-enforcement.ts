import type { ProfessionConfig } from "../../types.js";

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: القضاء — Judiciary
// ═════════════════════════════════════════════════════════════════════════════
const JUDGE: ProfessionConfig = {
  sectorId: "judiciary", sectorNameAr: "القضاء", sectorNameEn: "Judiciary",
  professionId: "judge", professionNameAr: "القاضي", professionNameEn: "Judge", icon: "⚖️",
  description: "القاضي هو الجهة المختصة بالفصل في النزاعات وإصدار الأحكام وفق أحكام القانون والشريعة.",
  responsibilities: [
    "الفصل في الدعاوى المدنية والجزائية والإدارية",
    "تسبيب الأحكام القضائية وفق أحكام القانون",
    "ضمان سلامة الإجراءات القضائية",
    "صون استقلالية القضاء وحياده",
    "إدارة جلسات المحاكمة بحياد ونزاهة",
  ],
  requiredCompetencies: ["التحليل القانوني المعمّق","إدارة الجلسات","كتابة الأحكام","تفسير التشريعات","التفكير النقدي"],
  requiredAuthorities: ["صلاحية إصدار الأحكام","صلاحية إصدار الأوامر القضائية","صلاحية الحبس الاحتياطي","صلاحية تعيين الخبراء"],
  legalBasis: [
    { title: "قانون السلطة القضائية الاتحادي", reference: "قانون اتحادي رقم 3 لسنة 1983", type: "law", binding: true },
    { title: "قانون الإجراءات المدنية", reference: "قانون اتحادي رقم 11 لسنة 1992", type: "law", binding: true },
    { title: "قانون الإجراءات الجزائية", reference: "قانون اتحادي رقم 35 لسنة 1992", type: "law", binding: true },
    { title: "قانون الإثبات في المعاملات المدنية والتجارية", reference: "قانون اتحادي رقم 10 لسنة 1992", type: "law", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_case", title: "تحديد الدعوى والاختصاص", description: "تحديد طبيعة الدعوى والاختصاص القضائي", icon: "📋",
      questions: [
        { id: "case_type", text: "ما نوع الدعوى؟", type: "select", required: true, options: ["مدنية","جزائية","إدارية","أحوال شخصية","تجارية","عمالية"], decisionKey: "case_type" },
        { id: "jurisdiction", text: "هل الاختصاص القضائي ثابت لهذه المحكمة؟", type: "boolean", required: true, decisionKey: "jurisdiction" },
        { id: "parties", text: "صِف الأطراف وصفتهم القانونية في الدعوى.", type: "text", required: true, minLength: 30, hint: "المدعي، المدعى عليه، وأي أطراف ثالثة." },
      ],
      defaultNextStageId: "s2_proceedings",
    },
    {
      id: "s2_proceedings", title: "مراجعة الإجراءات السابقة", description: "مراجعة ما تم إجراؤه من إجراءات", icon: "📁",
      questions: [
        { id: "prior_steps", text: "ما الإجراءات التي اتُّخذت حتى الآن؟", type: "multiselect", required: true, options: ["تسجيل الدعوى","إعلان الأطراف","تبادل اللوائح","تعيين خبير","سماع الشهود","الاطلاع على المستندات","انتهاء المرافعات","حجز القضية للحكم"] },
        { id: "hearings_complete", text: "هل المرافعات منتهية؟", type: "boolean", required: true, decisionKey: "hearings_complete" },
        { id: "defects", text: "هل ثمة خلل إجرائي يستوجب المعالجة؟", type: "boolean", required: true, decisionKey: "defects" },
      ],
      defaultNextStageId: "s3_evidence",
    },
    {
      id: "s3_evidence", title: "تقييم الأدلة والمستندات", description: "تحليل الأدلة المقدمة وكفايتها", icon: "🔍",
      questions: [
        { id: "evidence_types", text: "ما أنواع الأدلة المقدمة في الدعوى؟", type: "multiselect", required: true, options: ["مستندات رسمية","شهادة شهود","تقرير خبير","اعتراف","قرائن","خبرة طبية","أدلة رقمية"] },
        { id: "evidence_sufficiency", text: "هل الأدلة المقدمة كافية للفصل في الدعوى؟", type: "select", required: true, options: ["كافية تماماً","كافية مع تحفظ","غير كافية — تحتاج إجراءات إضافية"], decisionKey: "evidence_sufficiency" },
        { id: "legal_issues", text: "ما المسائل القانونية الجوهرية الواجب الفصل فيها؟", type: "text", required: true, minLength: 40, hint: "وضّح النقاط القانونية الخلافية الأساسية." },
      ],
      defaultNextStageId: "s4_law",
    },
    {
      id: "s4_law", title: "تطبيق القانون والتسبيب", description: "تحديد القانون الواجب التطبيق وتسبيب الحكم", icon: "📜",
      questions: [
        { id: "applicable_law", text: "ما النصوص القانونية الواجب تطبيقها؟", type: "text", required: true, minLength: 30, hint: "أشِر إلى المواد والقوانين المحددة." },
        { id: "judicial_precedent", text: "هل ثمة سوابق قضائية ذات صلة؟", type: "boolean", required: true, decisionKey: "judicial_precedent" },
        { id: "verdict_type", text: "ما نوع الحكم المرتقب؟", type: "select", required: true, options: ["إدانة","براءة","قبول","رفض","عدم اختصاص","شطب","إيقاف السير"], decisionKey: "verdict_type" },
      ],
      defaultNextStageId: "s5_risk",
    },
    {
      id: "s5_risk", title: "تقييم المخاطر والتوصيات", description: "تقييم المخاطر الإجرائية والقانونية", icon: "⚠️",
      questions: [
        { id: "risks", text: "ما المخاطر القانونية أو الإجرائية القائمة؟", type: "text", required: true, minLength: 20, hint: "مثلاً: احتمال الطعن، خلل في الإجراءات، نقص الأدلة." },
        { id: "escalation_needed", text: "هل تستدعي الدعوى إحالة أو تصعيداً؟", type: "select", required: true, options: ["لا تحتاج تصعيداً","تحتاج استشارة رئيس الدائرة","تحتاج إحالة للمحكمة الأعلى","تحتاج تدخل النيابة العامة"], decisionKey: "escalation_needed" },
        { id: "next_action", text: "ما الإجراء التالي المخطط له؟", type: "text", required: true, minLength: 15 },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_case", questionId: "jurisdiction", answer: "false", nextStageId: "s5_risk", addFlag: "no_jurisdiction" },
    { stageId: "s2_proceedings", questionId: "hearings_complete", answer: "false", nextStageId: "s3_evidence", addFlag: "hearings_incomplete" },
    { stageId: "s2_proceedings", questionId: "defects", answer: "true", nextStageId: "s3_evidence", addFlag: "procedural_defect" },
    { stageId: "s3_evidence", questionId: "evidence_sufficiency", answer: "غير كافية — تحتاج إجراءات إضافية", nextStageId: "s4_law", addFlag: "insufficient_evidence" },
    { stageId: "s5_risk", questionId: "escalation_needed", answer: "تحتاج إحالة للمحكمة الأعلى", nextStageId: "s5_risk", addFlag: "escalation_required" },
  ],
  requiredDocuments: [
    { name: "صحيفة الدعوى", mandatory: true },
    { name: "إعلانات الخصوم", mandatory: true },
    { name: "المستندات المقدمة من الأطراف", mandatory: true },
    { name: "محاضر الجلسات", mandatory: true },
    { name: "تقرير الخبير (إن وُجد)", mandatory: false, whenRequired: "عند تعيين خبير" },
    { name: "أقوال الشهود المحررة", mandatory: false, whenRequired: "عند سماع شهود" },
    { name: "مذكرات الدفاع والرد", mandatory: true },
    { name: "لائحة الحكم المبدئية", mandatory: false, whenRequired: "قبل النطق بالحكم" },
  ],
  commonMistakes: [
    { mistake: "إهمال الدفع بعدم الاختصاص القضائي", consequence: "بطلان الحكم أو الطعن فيه", remedy: "التحقق من الاختصاص النوعي والمحلي قبل البدء في نظر الدعوى" },
    { mistake: "التقصير في تسبيب الحكم", consequence: "نقض الحكم من محكمة أعلى درجة", remedy: "إيراد الأسباب الواقعية والقانونية بصورة كاملة وواضحة" },
    { mistake: "الفصل في مسائل لم تُطرح أمام المحكمة", consequence: "بطلان الحكم في الجزء الزائد", remedy: "الالتزام بنطاق الدعوى كما حدده الخصوم في لوائحهم" },
    { mistake: "إهمال مبدأ المواجهة وحق الدفاع", consequence: "نقض الحكم لإخلاله بضمانات التقاضي", remedy: "التأكد من تمكين كل طرف من الرد على أدلة الطرف الآخر" },
    { mistake: "الخلط بين مراحل التقاضي", consequence: "خلل إجرائي يعيب الحكم", remedy: "اتباع التسلسل الإجرائي المقرر قانوناً بدقة" },
  ],
  riskIndicators: [
    { indicator: "انعدام الاختصاص القضائي", severity: "high", flag: "no_jurisdiction" },
    { indicator: "خلل جوهري في الإجراءات", severity: "high", flag: "procedural_defect" },
    { indicator: "قصور في الأدلة المقدمة", severity: "medium", flag: "insufficient_evidence" },
    { indicator: "الحاجة للإحالة للمحكمة الأعلى", severity: "medium", flag: "escalation_required" },
    { indicator: "سوابق قضائية مخالفة للتوجه المرتقب", severity: "low", flag: "conflicting_precedent" },
  ],
  escalationRules: [
    { condition: "عدم الاختصاص القضائي للمحكمة", escalateTo: "إحالة الدعوى للمحكمة المختصة", mandatory: true },
    { condition: "وجود خلل إجرائي جوهري", escalateTo: "استشارة رئيس الدائرة أو المحكمة", mandatory: true },
    { condition: "مسألة دستورية جوهرية", escalateTo: "الإحالة للمحكمة الاتحادية العليا", mandatory: true },
  ],
  bestPractices: [
    "الاطلاع على ملف الدعوى كاملاً قبل الجلسة الأولى",
    "تدوين ملاحظات وافية على كل جلسة",
    "إرساء المواجهة بين الخصوم في كل مرحلة إجرائية",
    "مراجعة السوابق القضائية الصادرة من محكمة التمييز",
    "الحرص على استيفاء عناصر التسبيب: الواقعة — القانون — التطبيق — الحكم",
    "ضمان توثيق جميع إجراءات الجلسة في المحضر",
  ],
  thinkingModel: [
    { step: "الاختصاص", question: "هل هذه القضية داخلة في اختصاص محكمتي نوعاً ومحلاً؟" },
    { step: "الإجراءات", question: "هل استوفيت جميع الإجراءات الشكلية الواجبة؟" },
    { step: "الموضوع", question: "ما الوقائع الثابتة والمتنازع عليها؟ وأيها جوهري؟" },
    { step: "القانون", question: "ما النصوص القانونية الحاكمة وكيف تنطبق على الوقائع؟" },
    { step: "الحكم", question: "هل الحكم المرتقب مدعوم بالأدلة والقانون ومؤسَّس تسبيباً كافياً؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "الاختصاص القضائي محدد وثابت", category: "legal", mandatory: true },
    { id: "fc2", item: "جميع الأطراف مُعلنون بصورة صحيحة", category: "procedural", mandatory: true },
    { id: "fc3", item: "الأدلة مناقَشة وتم الفصل في حجيتها", category: "legal", mandatory: true },
    { id: "fc4", item: "مبدأ المواجهة تحقق لجميع الأطراف", category: "procedural", mandatory: true },
    { id: "fc5", item: "الحكم مسبَّب واقعياً وقانونياً", category: "legal", mandatory: true },
    { id: "fc6", item: "السوابق القضائية ذات الصلة استُحضرت ووُضعت في الاعتبار", category: "legal", mandatory: false },
    { id: "fc7", item: "المسائل القانونية المثارة من أطراف الدعوى رُدَّ عليها جميعاً", category: "legal", mandatory: true },
    { id: "fc8", item: "منطوق الحكم واضح وقابل للتنفيذ", category: "quality", mandatory: true },
  ],
  assessmentContext: "القاضي في النظام القضائي الإماراتي — يفصل في النزاعات ويصدر الأحكام المسببة وفق القانون الاتحادي والمحلي. استقلاليته مصونة دستورياً.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: النيابة العامة — Public Prosecution
// ═════════════════════════════════════════════════════════════════════════════
const PROSECUTOR: ProfessionConfig = {
  sectorId: "public_prosecution", sectorNameAr: "النيابة العامة", sectorNameEn: "Public Prosecution",
  professionId: "prosecutor", professionNameAr: "وكيل النيابة", professionNameEn: "Public Prosecutor", icon: "🏛️",
  description: "وكيل النيابة يمثل الدعوى العمومية ويتولى التحقيق والادعاء وصون حقوق المجتمع.",
  responsibilities: ["إجراء التحقيقات الجنائية","مباشرة الدعوى الجنائية","حفظ الدعاوى أو إحالتها","إصدار أوامر القبض والتفتيش","الإشراف على تنفيذ الأحكام الجنائية"],
  requiredCompetencies: ["التحقيق الجنائي","تقييم الأدلة","القانون الجزائي","إعداد لوائح الاتهام","التواصل القانوني"],
  requiredAuthorities: ["صلاحية التحقيق","صلاحية إصدار أوامر القبض","صلاحية الحبس الاحتياطي","صلاحية طلب تفتيش الأماكن"],
  legalBasis: [
    { title: "قانون الإجراءات الجزائية", reference: "قانون اتحادي رقم 35 لسنة 1992", type: "law", binding: true },
    { title: "قانون العقوبات الاتحادي", reference: "مرسوم بقانون رقم 31 لسنة 2021", type: "decree", binding: true },
    { title: "قانون النيابة العامة", reference: "قانون اتحادي رقم 11 لسنة 2017", type: "law", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_incident", title: "استقبال البلاغ وتحديد الجريمة", description: "تقييم البلاغ وتحديد طبيعة الجريمة", icon: "📥",
      questions: [
        { id: "crime_type", text: "ما نوع الجريمة المبلَّغ عنها؟", type: "select", required: true, options: ["جناية","جنحة","مخالفة","جريمة أمن وطني","جريمة إلكترونية","جريمة مالية","أخرى"], decisionKey: "crime_type" },
        { id: "flagrante", text: "هل الجريمة مشهودة؟", type: "boolean", required: true, decisionKey: "flagrante" },
        { id: "victim_info", text: "صِف المجني عليه وطبيعة الضرر المزعوم.", type: "text", required: true, minLength: 30 },
      ],
      defaultNextStageId: "s2_investigation",
    },
    {
      id: "s2_investigation", title: "التحقيق الأولي", description: "جمع الأدلة واستيفاء التحقيق", icon: "🔍",
      questions: [
        { id: "suspect_status", text: "ما وضع المشتبه به؟", type: "select", required: true, options: ["موقوف","مطلق سراح بكفالة","مجهول الهوية","هارب","لا يوجد مشتبه به بعد"], decisionKey: "suspect_status" },
        { id: "evidence_collected", text: "ما الأدلة الجمعها حتى الآن؟", type: "multiselect", required: true, options: ["أقوال المجني عليه","أقوال الشهود","أدلة مادية","تسجيلات","تقارير طبية شرعية","تقارير تقنية","اعتراف المشتبه به"] },
        { id: "investigation_complete", text: "هل التحقيق مكتمل؟", type: "boolean", required: true, decisionKey: "investigation_complete" },
      ],
      defaultNextStageId: "s3_decision",
    },
    {
      id: "s3_decision", title: "قرار التصرف في الدعوى", description: "تحديد التصرف القانوني المناسب", icon: "⚖️",
      questions: [
        { id: "action", text: "ما القرار المقترح في الدعوى؟", type: "select", required: true, options: ["إحالة للمحكمة","حفظ الأوراق","أمر جنائي","تقديم طلب إفراج","طلب تمديد الحبس","إحالة لنيابة متخصصة"], decisionKey: "action" },
        { id: "legal_basis_action", text: "ما الأساس القانوني لهذا القرار؟", type: "text", required: true, minLength: 30 },
        { id: "risk_factors", text: "هل ثمة مخاطر أو ملابسات استثنائية؟", type: "text", required: false, minLength: 10, hint: "مثلاً: خطر الفرار، احتمال العود، خطورة الجريمة." },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_incident", questionId: "flagrante", answer: "true", nextStageId: "s2_investigation", addFlag: "flagrante_delicto" },
    { stageId: "s1_incident", questionId: "crime_type", answer: "جريمة أمن وطني", nextStageId: "s2_investigation", addFlag: "national_security" },
    { stageId: "s2_investigation", questionId: "suspect_status", answer: "هارب", nextStageId: "s3_decision", addFlag: "fugitive_suspect" },
    { stageId: "s2_investigation", questionId: "investigation_complete", answer: "false", nextStageId: "s2_investigation", addFlag: "investigation_incomplete" },
  ],
  requiredDocuments: [
    { name: "محضر البلاغ الأصلي", mandatory: true },
    { name: "أقوال الشهود والمجني عليهم", mandatory: true },
    { name: "تقرير معاينة مسرح الجريمة", mandatory: false, whenRequired: "في الجرائم الجسيمة" },
    { name: "التقرير الطبي الشرعي", mandatory: false, whenRequired: "في جرائم الإيذاء أو الوفاة" },
    { name: "أوامر القبض والتفتيش الصادرة", mandatory: false, whenRequired: "إذا صدرت" },
    { name: "الأدلة المادية والمضبوطات", mandatory: true },
    { name: "السجل الجنائي للمتهم", mandatory: false, whenRequired: "عند الاشتباه بالعود" },
    { name: "لائحة الاتهام", mandatory: true, whenRequired: "عند الإحالة للمحكمة" },
  ],
  commonMistakes: [
    { mistake: "حبس الاحتياطي دون مسوّغ قانوني كافٍ", consequence: "إلغاء أمر الحبس وتعويض المتهم", remedy: "التأكد من توافر شروط الحبس الاحتياطي قبل طلبه" },
    { mistake: "الإهمال في جمع الأدلة في الوقت المناسب", consequence: "ضياع الدليل وضعف القضية", remedy: "التحرك الفوري لتأمين مسرح الجريمة والأدلة" },
    { mistake: "إغفال الإعلان الصحيح للمتهم", consequence: "بطلان إجراءات المحاكمة", remedy: "التأكد من صحة الإعلانات وتوثيقها" },
    { mistake: "الخلط بين الجناية والجنحة في وصف الفعل", consequence: "اختلال الاختصاص وبطلان الإجراءات", remedy: "التدقيق في التكييف القانوني للجريمة من البداية" },
    { mistake: "حفظ الدعاوى دون تحقيق كافٍ", consequence: "إفلات مرتكبي الجرائم من العقاب", remedy: "إتمام التحقيق قبل اتخاذ أي قرار بالحفظ" },
  ],
  riskIndicators: [
    { indicator: "وجود متهم هارب", severity: "high", flag: "fugitive_suspect" },
    { indicator: "جريمة أمن وطني أو إرهاب", severity: "high", flag: "national_security" },
    { indicator: "قصور في الأدلة الجنائية", severity: "medium", flag: "evidence_gap" },
    { indicator: "تحقيق غير مكتمل", severity: "medium", flag: "investigation_incomplete" },
    { indicator: "احتمال تلوث مسرح الجريمة", severity: "high", flag: "scene_contamination" },
  ],
  escalationRules: [
    { condition: "جرائم أمن وطني أو إرهاب", escalateTo: "النيابة المتخصصة لأمن الدولة", mandatory: true },
    { condition: "وفاة مشتبه به في الحجز", escalateTo: "المدعي العام الأعلى فوراً", mandatory: true },
    { condition: "تعارض المصالح مع أحد المتهمين", escalateTo: "رئيس النيابة لتكليف بديل", mandatory: true },
  ],
  bestPractices: [
    "توثيق كل خطوة تحقيقية فور اتخاذها",
    "التحقق من صحة سلسلة الحيازة للأدلة المادية",
    "إخطار المتهم بحقه في الاستعانة بمحامٍ فور توقيفه",
    "التنسيق مع الجهات الأمنية المختصة في الجرائم الكبرى",
    "مراجعة السجل الجنائي والملفات السابقة قبل اتخاذ القرار",
  ],
  thinkingModel: [
    { step: "التكييف", question: "هل الأفعال المزعومة تشكّل جريمة؟ وما وصفها القانوني الصحيح؟" },
    { step: "الأدلة", question: "هل الأدلة المتوفرة كافية لإثبات أركان الجريمة؟" },
    { step: "الإجراءات", question: "هل جميع الإجراءات التحقيقية استُنفدت بصورة قانونية سليمة؟" },
    { step: "القرار", question: "ما التصرف الأنسب: إحالة، حفظ، أم استكمال التحقيق؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "التكييف القانوني للجريمة صحيح", category: "legal", mandatory: true },
    { id: "fc2", item: "المتهم أُبلغ بحقه في الاستعانة بمحامٍ", category: "procedural", mandatory: true },
    { id: "fc3", item: "سلسلة الحيازة للأدلة موثقة", category: "documentation", mandatory: true },
    { id: "fc4", item: "مدة الحبس الاحتياطي ضمن الحد القانوني", category: "legal", mandatory: true },
    { id: "fc5", item: "التقرير الطبي الشرعي مُستكمَل (إن لزم)", category: "documentation", mandatory: false },
    { id: "fc6", item: "قرار التصرف مسبَّب قانونياً", category: "legal", mandatory: true },
    { id: "fc7", item: "المجني عليه أُحيط علماً بحقوقه", category: "procedural", mandatory: true },
    { id: "fc8", item: "الملف موثق ومرتب قبل الإحالة", category: "documentation", mandatory: true },
  ],
  assessmentContext: "وكيل النيابة في دولة الإمارات — يتولى التحقيق والادعاء العام في الجرائم ويتمتع بصلاحيات واسعة مقيدة بضمانات قانونية محددة.",
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: الشرطة — Police
// ═════════════════════════════════════════════════════════════════════════════
const POLICE_OFFICER: ProfessionConfig = {
  sectorId: "police", sectorNameAr: "الشرطة", sectorNameEn: "Police",
  professionId: "police_officer", professionNameAr: "ضابط الشرطة / الضبط القضائي", professionNameEn: "Police / Judicial Officer", icon: "🚔",
  description: "ضابط الشرطة ورجل الضبط القضائي يتولى ضبط الجرائم وجمع الأدلة وتطبيق القانون.",
  responsibilities: ["ضبط الجرائم والمتهمين","جمع الأدلة المادية وتأمينها","تحرير المحاضر والتقارير الأمنية","تنفيذ أوامر القبض والتفتيش","التنسيق مع النيابة العامة"],
  requiredCompetencies: ["التحقيق الميداني","جمع الأدلة","تحرير المحاضر","التعامل مع المتهمين","إجراءات مسرح الجريمة"],
  requiredAuthorities: ["صلاحية الضبط والإيداع","صلاحية دخول مسرح الجريمة","صلاحية طلب بيانات الاتصالات","صلاحية التفتيش بموجب أمر قضائي"],
  legalBasis: [
    { title: "قانون الإجراءات الجزائية", reference: "قانون اتحادي رقم 35 لسنة 1992", type: "law", binding: true },
    { title: "قانون مكافحة الجرائم المعلوماتية", reference: "مرسوم بقانون رقم 34 لسنة 2021", type: "decree", binding: true },
    { title: "قانون الشرطة والأمن العام", reference: "اللوائح والأنظمة الداخلية المعتمدة", type: "regulation", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_scene", title: "تأمين مسرح الجريمة", description: "الوصول وتأمين المسرح وأول الإجراءات", icon: "🚧",
      questions: [
        { id: "scene_secured", text: "هل تم تأمين مسرح الجريمة بالكامل؟", type: "boolean", required: true, decisionKey: "scene_secured" },
        { id: "crime_nature", text: "ما طبيعة الجريمة المُبلَّغ عنها؟", type: "select", required: true, options: ["سرقة","إيذاء جسدي","جريمة قتل","جريمة إلكترونية","جريمة مالية","مخدرات","جريمة جنسية","أخرى"], decisionKey: "crime_nature" },
        { id: "injuries", text: "هل يوجد مصابون أو وفيات؟", type: "boolean", required: true, decisionKey: "injuries" },
      ],
      defaultNextStageId: "s2_evidence",
    },
    {
      id: "s2_evidence", title: "جمع الأدلة", description: "توثيق وجمع الأدلة المادية والرقمية", icon: "📸",
      questions: [
        { id: "evidence_types", text: "ما أنواع الأدلة الجمعها؟", type: "multiselect", required: true, options: ["بصمات","طلقات نارية","أدلة بيولوجية","تسجيلات كاميرات","أجهزة رقمية","مستندات ورقية","مواد مخدرة","أسلحة"] },
        { id: "chain_custody", text: "هل سلسلة الحيازة (Chain of Custody) مُوثَّقة لجميع الأدلة؟", type: "boolean", required: true, decisionKey: "chain_custody" },
        { id: "witnesses", text: "هل تم تحديد الشهود العيان وتسجيل بياناتهم؟", type: "boolean", required: true },
      ],
      defaultNextStageId: "s3_report",
    },
    {
      id: "s3_report", title: "تحرير المحضر والتنسيق", description: "إعداد المحضر والتنسيق مع النيابة", icon: "📄",
      questions: [
        { id: "report_complete", text: "هل المحضر الرسمي محرَّر بالكامل؟", type: "boolean", required: true, decisionKey: "report_complete" },
        { id: "prosecution_notified", text: "هل تم إخطار النيابة العامة؟", type: "select", required: true, options: ["نعم — تم الإخطار","لا — لم يتم بعد","الجريمة لا تستوجب إخطاراً فورياً"], decisionKey: "prosecution_notified" },
        { id: "suspect_status", text: "ما وضع المشتبه به؟", type: "select", required: true, options: ["موقوف في الحجز","مطلق سراح","هارب","غير محدد الهوية"] },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_scene", questionId: "scene_secured", answer: "false", nextStageId: "s1_scene", addFlag: "scene_not_secured" },
    { stageId: "s1_scene", questionId: "injuries", answer: "true", nextStageId: "s2_evidence", addFlag: "casualties_present" },
    { stageId: "s2_evidence", questionId: "chain_custody", answer: "false", nextStageId: "s3_report", addFlag: "custody_breach" },
    { stageId: "s3_report", questionId: "prosecution_notified", answer: "لا — لم يتم بعد", nextStageId: "s3_report", addFlag: "prosecution_not_notified" },
  ],
  requiredDocuments: [
    { name: "محضر المعاينة الأولية", mandatory: true },
    { name: "خريطة / مخطط مسرح الجريمة", mandatory: true },
    { name: "سجل الأدلة المادية وسلسلة الحيازة", mandatory: true },
    { name: "صور مسرح الجريمة", mandatory: true },
    { name: "أقوال الشهود الأوليين", mandatory: true },
    { name: "تقرير الطب الشرعي الأولي", mandatory: false, whenRequired: "في حالات الإصابة أو الوفاة" },
    { name: "أوامر القبض والتفتيش المعتمدة", mandatory: false, whenRequired: "عند تنفيذ التفتيش" },
  ],
  commonMistakes: [
    { mistake: "تلوث مسرح الجريمة قبل توثيقه", consequence: "فقدان أدلة حاسمة وضعف القضية", remedy: "تأمين المسرح فور الوصول قبل أي تحريك للأدلة" },
    { mistake: "إهمال توثيق سلسلة الحيازة", consequence: "رفض الأدلة أمام المحكمة", remedy: "توثيق كل يد تلمس الدليل من لحظة اكتشافه" },
    { mistake: "التأخر في إخطار النيابة العامة", consequence: "بطلان إجراءات القبض أو التوقيف", remedy: "الإخطار الفوري خلال المدد القانونية المقررة" },
    { mistake: "استجواب المشتبه به دون إخطاره بحقوقه", consequence: "بطلان أقواله واستبعادها من الأدلة", remedy: "الإخطار الفوري بحق الاستعانة بمحامٍ وحق الصمت" },
    { mistake: "التفتيش دون أمر قضائي في غير حالات الجريمة المشهودة", consequence: "بطلان التفتيش واستبعاد ما ضُبط", remedy: "الحصول على إذن قضائي مسبق أو التأكد من توافر حالة التلبس" },
  ],
  riskIndicators: [
    { indicator: "مسرح الجريمة غير مؤمَّن", severity: "high", flag: "scene_not_secured" },
    { indicator: "وجود ضحايا أو مصابين", severity: "high", flag: "casualties_present" },
    { indicator: "خلل في سلسلة الحيازة", severity: "high", flag: "custody_breach" },
    { indicator: "النيابة لم تُخطَر", severity: "medium", flag: "prosecution_not_notified" },
  ],
  escalationRules: [
    { condition: "وجود وفيات أو إصابات بالغة", escalateTo: "إخطار فوري للقيادة والنيابة", mandatory: true },
    { condition: "جريمة منظمة أو ذات أبعاد أمنية", escalateTo: "إحالة للأجهزة الأمنية المتخصصة", mandatory: true },
    { condition: "مشتبه به من مسؤولين أو ذوي حصانة", escalateTo: "إخطار النيابة وجهات الاختصاص", mandatory: true },
  ],
  bestPractices: [
    "الوصول لمسرح الجريمة بالحد الأدنى من الأفراد لتقليل التلوث",
    "التصوير الشامل قبل لمس أي شيء في المسرح",
    "الاحتفاظ بسجل زمني مفصل لكل إجراء",
    "التنسيق الفوري مع الطب الشرعي في الجرائم الجسيمة",
    "عزل الشهود عن بعض منذ البداية للحصول على أقوال مستقلة",
  ],
  thinkingModel: [
    { step: "الأمان", question: "هل الموقف آمن للضباط والجمهور؟ هل تم تأمين المسرح؟" },
    { step: "الحفاظ", question: "هل تم حفظ الأدلة قبل أي تعديل على المسرح؟" },
    { step: "التوثيق", question: "هل كل إجراء موثق بدقة وفي الوقت الحقيقي؟" },
    { step: "التنسيق", question: "من يجب إخطاره الآن؟ هل النيابة والأجهزة المختصة على علم؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "مسرح الجريمة مؤمَّن وموثَّق", category: "procedural", mandatory: true },
    { id: "fc2", item: "جميع الأدلة جُمعت مع سلسلة حيازة كاملة", category: "documentation", mandatory: true },
    { id: "fc3", item: "الشهود حُددوا وسُجلت بياناتهم", category: "procedural", mandatory: true },
    { id: "fc4", item: "النيابة أُخطرت في الوقت المناسب", category: "procedural", mandatory: true },
    { id: "fc5", item: "المحضر محرَّر ومُوقَّع بصورة قانونية", category: "documentation", mandatory: true },
    { id: "fc6", item: "المشتبه به أُبلغ بحقوقه", category: "legal", mandatory: true },
    { id: "fc7", item: "التقارير الطبية الشرعية مطلوبة (إن لزم)", category: "documentation", mandatory: false },
    { id: "fc8", item: "الملف موثق ومرتب للتسليم للنيابة", category: "documentation", mandatory: true },
  ],
  assessmentContext: "ضابط الشرطة ورجل الضبط القضائي في دولة الإمارات — يعمل في إطار صلاحيات قانونية محددة ويخضع لرقابة النيابة العامة.",
};

export const LAW_ENFORCEMENT_PROFESSIONS: ProfessionConfig[] = [JUDGE, PROSECUTOR, POLICE_OFFICER];
