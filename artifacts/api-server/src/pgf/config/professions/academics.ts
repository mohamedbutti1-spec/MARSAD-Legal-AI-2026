import type { ProfessionConfig } from "../../types.js";

// ═════════════════════════════════════════════════════════════════════════════
// SECTOR: البحث الأكاديمي — Academic Research
// ═════════════════════════════════════════════════════════════════════════════
const ACADEMIC_RESEARCHER: ProfessionConfig = {
  sectorId: "academic_research", sectorNameAr: "البحث الأكاديمي", sectorNameEn: "Academic Research",
  professionId: "academic_researcher", professionNameAr: "الباحث الأكاديمي", professionNameEn: "Academic Researcher", icon: "🎓",
  description: "الباحث الأكاديمي يُجري بحثاً علمياً أصيلاً وفق المعايير الأكاديمية المعتمدة ويُسهم في بناء المعرفة.",
  responsibilities: ["إجراء البحث العلمي الأصيل","صياغة الأسئلة البحثية ومراجعة الأدبيات","تطبيق المنهجية البحثية المناسبة","تحليل البيانات وتفسير النتائج","نشر البحث في مجلات علمية محكَّمة"],
  requiredCompetencies: ["المناهج البحثية الكمية والنوعية","مراجعة الأدبيات","التحليل الإحصائي","الكتابة الأكاديمية","أخلاقيات البحث"],
  requiredAuthorities: ["صلاحية الوصول لقواعد البيانات الأكاديمية","صلاحية إجراء المقابلات والمسوحات","صلاحية نشر نتائج البحث"],
  legalBasis: [
    { title: "دليل أخلاقيات البحث العلمي — مجلس البحث", reference: "سياسة أخلاقيات البحث — مجلس أبوظبي للبحث العلمي ADEK/ASPIRE", type: "policy", binding: true },
    { title: "معايير الأمانة الأكاديمية للجامعة", reference: "سياسات الجامعة أو المؤسسة البحثية", type: "policy", binding: true },
    { title: "متطلبات لجنة أخلاقيات البحث مع البشر IRB", reference: "إرشادات الأخلاقيات المعتمدة دولياً — Declaration of Helsinki", type: "standard", binding: true },
  ],
  workflowStages: [
    {
      id: "s1_research_design", title: "تصميم البحث", description: "صياغة السؤال البحثي وتحديد المنهجية", icon: "📐",
      questions: [
        { id: "research_question", text: "ما سؤالك البحثي الرئيسي؟ (يجب أن يكون محدداً وقابلاً للبحث)", type: "text" as const, required: true, minLength: 30, hint: "ينبغي أن يكون محدداً وأصيلاً وذا أهمية علمية." },
        { id: "methodology", text: "ما المنهجية البحثية المختارة؟", type: "select" as const, required: true, options: ["كمي","نوعي","مختلط (كمي ونوعي)","استعراض منهجي / Meta-analysis","بحث إجرائي (Action Research)","دراسة حالة"], decisionKey: "methodology" },
        { id: "ethics_approval", text: "هل يستلزم بحثك موافقة لجنة الأخلاقيات (IRB)؟", type: "boolean" as const, required: true, decisionKey: "ethics_approval" },
      ],
      defaultNextStageId: "s2_literature",
    },
    {
      id: "s2_literature", title: "مراجعة الأدبيات", description: "تقييم الأدبيات السابقة وتحديد الفجوة البحثية", icon: "📚",
      questions: [
        { id: "sources_reviewed", text: "ما قواعد البيانات الأكاديمية التي راجعتها؟", type: "multiselect" as const, required: true, options: ["Scopus","Web of Science","Google Scholar","PubMed","JSTOR","IEEE Xplore","قواعد بيانات عربية"] },
        { id: "literature_gap", text: "ما الفجوة البحثية التي يملأها بحثك؟", type: "text" as const, required: true, minLength: 40, hint: "هذا هو المبرر الأساسي لإجراء البحث." },
        { id: "originality", text: "كيف يختلف بحثك عن الدراسات السابقة؟", type: "text" as const, required: true, minLength: 30 },
      ],
      defaultNextStageId: "s3_data",
    },
    {
      id: "s3_data", title: "جمع البيانات وتحليلها", description: "تقييم جودة البيانات وصحة التحليل", icon: "📊",
      questions: [
        { id: "data_collection", text: "ما أدوات جمع البيانات؟", type: "multiselect" as const, required: true, options: ["استبانة","مقابلات","مجموعات بؤرية","ملاحظة","تجربة","تحليل وثائق","بيانات ثانوية / أرشيفية"] },
        { id: "validity_reliability", text: "هل التحقق من الصدق والثبات مؤكَّد؟", type: "boolean" as const, required: true, decisionKey: "validity_reliability" },
        { id: "ethical_compliance", text: "هل المشاركون قدَّموا موافقة مستنيرة موثقة؟", type: "boolean" as const, required: true, decisionKey: "ethical_compliance" },
      ],
      defaultNextStageId: "s4_publication",
    },
    {
      id: "s4_publication", title: "النشر والمساهمة", description: "تقييم جاهزية البحث للنشر", icon: "📝",
      questions: [
        { id: "target_journal", text: "ما المجلة أو المؤتمر المستهدف للنشر؟", type: "text" as const, required: true, minLength: 10 },
        { id: "authorship_clear", text: "هل حقوق التأليف وأولويته محددة ومتفق عليها؟", type: "boolean" as const, required: true, decisionKey: "authorship_clear" },
        { id: "plagiarism_checked", text: "هل مُراجَعة البحث لمنع الانتحال الأدبي؟", type: "boolean" as const, required: true, decisionKey: "plagiarism_checked" },
      ],
    },
  ],
  decisionTree: [
    { stageId: "s1_research_design", questionId: "ethics_approval", answer: "true", nextStageId: "s2_literature", addFlag: "irb_required" },
    { stageId: "s3_data", questionId: "validity_reliability", answer: "false", nextStageId: "s4_publication", addFlag: "validity_concern" },
    { stageId: "s3_data", questionId: "ethical_compliance", answer: "false", nextStageId: "s4_publication", addFlag: "ethics_breach" },
    { stageId: "s4_publication", questionId: "authorship_clear", answer: "false", nextStageId: "s4_publication", addFlag: "authorship_dispute" },
    { stageId: "s4_publication", questionId: "plagiarism_checked", answer: "false", nextStageId: "s4_publication", addFlag: "plagiarism_risk" },
  ],
  requiredDocuments: [
    { name: "خطة البحث التفصيلية (Research Proposal)", mandatory: true },
    { name: "موافقة لجنة الأخلاقيات IRB", mandatory: false, whenRequired: "عند البحث مع المشاركين البشريين" },
    { name: "استمارات الموافقة المستنيرة للمشاركين", mandatory: false, whenRequired: "في البحث مع الإنسان" },
    { name: "نتائج فحص الانتحال الأدبي", mandatory: true },
    { name: "بيانات البحث الخام وتوثيق التحليل", mandatory: true },
    { name: "مسودة ورقة البحث للمراجعة", mandatory: true },
    { name: "قائمة المراجع بأسلوب موحد (APA/Vancouver/IEEE)", mandatory: true },
  ],
  commonMistakes: [
    { mistake: "سؤال بحثي غامض أو فضفاض", consequence: "بحث لا يمكن الإجابة عنه أو قياسه", remedy: "تضييق السؤال البحثي حتى يكون محدداً وقابلاً للبحث" },
    { mistake: "مراجعة أدبيات سطحية", consequence: "البحث في مجال مدروس سابقاً أو تجاهل الأدبيات ذات الصلة", remedy: "مراجعة منهجية وشاملة قبل صياغة السؤال البحثي" },
    { mistake: "إجراء البحث مع المشاركين قبل موافقة IRB", consequence: "رفض البحث أو عواقب قانونية وأخلاقية", remedy: "الحصول على موافقة IRB إلزامياً قبل أي تفاعل مع المشاركين" },
    { mistake: "اختيار الأسلوب الإحصائي بعد جمع البيانات", consequence: "تحليل غير مناسب وضعف في صحة الاستنتاجات", remedy: "تحديد الأسلوب الإحصائي في مرحلة التصميم قبل جمع البيانات" },
    { mistake: "إهمال نشر النتائج السلبية", consequence: "تحيز في الأدبيات الأكاديمية", remedy: "التعامل مع النتائج السلبية بنفس الجدية العلمية" },
  ],
  riskIndicators: [
    { indicator: "البحث يستلزم موافقة أخلاقيات IRB", severity: "high", flag: "irb_required" },
    { indicator: "خلل في الصدق أو الثبات", severity: "high", flag: "validity_concern" },
    { indicator: "انتهاك أخلاقيات البحث", severity: "high", flag: "ethics_breach" },
    { indicator: "نزاع حقوق التأليف", severity: "medium", flag: "authorship_dispute" },
    { indicator: "خطر الانتحال الأدبي", severity: "high", flag: "plagiarism_risk" },
  ],
  escalationRules: [
    { condition: "انتهاك محتمل لأخلاقيات البحث مع المشاركين", escalateTo: "لجنة الأخلاقيات المؤسسية IRB فوراً", mandatory: true },
    { condition: "ادعاء انتحال أدبي أو احتيال بحثي", escalateTo: "مكتب النزاهة الأكاديمية في المؤسسة", mandatory: true },
    { condition: "نزاع حقوق ملكية فكرية", escalateTo: "القسم القانوني وإدارة الأبحاث", mandatory: true },
  ],
  bestPractices: [
    "التسجيل المسبق للبحث في قواعد بيانات معتمدة (PROSPERO للمراجعات)",
    "الاستشارة المبكرة مع خبير إحصائي في تصميم الدراسة",
    "الالتزام بمبادئ FAIR للبيانات (Findable, Accessible, Interoperable, Reusable)",
    "الشفافية الكاملة في الإفصاح عن طرق البحث لإمكانية التكرار",
    "تحديث المعرفة المنهجية بأحدث معايير التقارير في التخصص (CONSORT/STROBE/إلخ)",
  ],
  thinkingModel: [
    { step: "الأصالة", question: "هل سؤالي البحثي أصيل ويملأ فجوة حقيقية في الأدبيات؟" },
    { step: "المنهجية", question: "هل المنهج المختار هو الأنسب للإجابة عن سؤالي البحثي؟" },
    { step: "الصحة", question: "هل نتائجي صحيحة وقابلة للتعميم أو مقيدة بسياق محدد؟" },
    { step: "الأثر", question: "ما المساهمة المعرفية والعملية لهذا البحث؟" },
  ],
  finalChecklist: [
    { id: "fc1", item: "السؤال البحثي محدد وقابل للقياس", category: "quality", mandatory: true },
    { id: "fc2", item: "مراجعة الأدبيات شاملة وحديثة", category: "quality", mandatory: true },
    { id: "fc3", item: "موافقة IRB مستكملة (إن لزمت)", category: "legal", mandatory: true },
    { id: "fc4", item: "الموافقة المستنيرة موثقة من المشاركين", category: "legal", mandatory: false },
    { id: "fc5", item: "المنهجية موثقة لإمكانية التكرار", category: "documentation", mandatory: true },
    { id: "fc6", item: "فحص الانتحال الأدبي أُجري", category: "quality", mandatory: true },
    { id: "fc7", item: "حقوق التأليف محددة ومتفق عليها", category: "legal", mandatory: true },
    { id: "fc8", item: "البيانات محفوظة وفق معايير الحماية", category: "documentation", mandatory: true },
  ],
  assessmentContext: "الباحث الأكاديمي في المؤسسات الإماراتية — يعمل وفق معايير أخلاقيات البحث الدولية ومتطلبات المجلس الوطني للبحث العلمي.",
};

export const ACADEMIC_PROFESSIONS: ProfessionConfig[] = [ACADEMIC_RESEARCHER];
