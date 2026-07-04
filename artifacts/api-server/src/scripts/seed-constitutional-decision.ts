/**
 * Executive Demonstration Scenario — "The Constitutional Decision"
 * ─────────────────────────────────────────────────────────────────
 * Produces one complete UAE administrative decision through every stage of
 * the M. Al-Shamsi Framework for Intelligent Administrative Decision-Making.
 *
 * Run from artifacts/api-server/:
 *   npx tsx src/scripts/seed-constitutional-decision.ts
 */

import {
  db,
  decisionsTable,
  decisionStagesTable,
  decisionDciTable,
  decisionJdpTable,
  DECISION_STAGE_KEYS,
} from "@workspace/db";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const stageHash = (decisionId: number, key: string, ts: string) =>
  sha256(`marsad|${decisionId}|${key}|${ts}|demo-constitutional-scenario`);
const D = (y: number, m: number, d: number, h = 9, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min, 0));

// ─── Timestamps (scenario: April 2026) ───────────────────────────────────────
const TS = {
  created:                  D(2026, 4, 12, 8,  0),
  administrative_request:   D(2026, 4, 12, 9, 30),
  legal_authority:          D(2026, 4, 13, 11, 15),
  facts_evidence:           D(2026, 4, 15, 14,  0),
  legal_basis:              D(2026, 4, 16, 10, 30),
  administrative_objective: D(2026, 4, 17,  9,  0),
  discretionary_power:      D(2026, 4, 18, 11,  0),
  proportionality:          D(2026, 4, 20, 14, 30),
  human_oversight:          D(2026, 4, 21, 10,  0),
  constitutional_validation:D(2026, 4, 22,  9,  0),
  decision_drafting:        D(2026, 4, 23, 11,  0),
  final_review:             D(2026, 4, 24,  9,  0),
};

const STAGE_NAMES: Record<string, string> = {
  administrative_request:   "الطلب الإداري",
  legal_authority:          "التحقق من الاختصاص",
  facts_evidence:           "الوقائع والأدلة",
  legal_basis:              "السند القانوني",
  administrative_objective: "الهدف الإداري",
  discretionary_power:      "السلطة التقديرية",
  proportionality:          "مبدأ التناسب",
  human_oversight:          "الرقابة البشرية",
  constitutional_validation:"التحقق الدستوري",
  decision_drafting:        "صياغة القرار",
  final_review:             "المراجعة النهائية",
};

// ─── Per-stage stageData + aiAnalysis + aiContribution ───────────────────────
const STAGES: Record<string, { stageData: Record<string, unknown>; aiAnalysis: Record<string, unknown>; aiContribution: string }> = {

  administrative_request: {
    stageData: {
      decisionType: "suspension",
      urgencyLevel: "emergency",
      requestSource: "بلاغات موظفي التمريض وتقرير التفتيش الاستثنائي — الإدارة العامة للرقابة الصحية",
      requestDate: "2026-03-15",
      requestSummary: "تلقّت وزارة الصحة ووقاية المجتمع بلاغات موثقة من أحد عشر (11) ممرضاً معتمداً يعملون في مستشفى الأفق الطبي الخاص بمدينة أبوظبي. أفادت البلاغات بتردٍّ جسيم في معايير سلامة المرضى يشمل: وجود أدوية منتهية الصلاحية في وحدة العناية المركزة، وتوظيف أطباء يحملون مؤهلات غير معتمدة، وتسجيل ثلاثة وعشرين (23) خطأً دوائياً موثقاً خلال الفترة أغسطس 2025 – مارس 2026، فضلاً عن ثلاث وفيات قيد التحقيق.",
      relatedIncidents: "ثلاث وفيات محتملة الصلة بأخطاء بروتوكولية — الفترة: سبتمبر 2025 – فبراير 2026 — قيد التحقيق لدى النيابة العامة (قضايا: ن.ع/2025/4471 ون.ع/2025/4892 ون.ع/2026/0112)",
      priorActions: "ثلاثة إنذارات رسمية صادرة عن الإدارة العامة للرقابة الصحية: إنذار رقم 445/2025 (أغسطس 2025) — إنذار رقم 712/2025 (نوفمبر 2025) — إنذار رقم 089/2026 (يناير 2026). قدّمت إدارة المستشفى في كل مرة خطة تصحيح ظلت حبراً على ورق.",
      affectedParties: "ما يزيد على ثمانمائة (800) مريض حالي — مئتان وأربعون (240) موظفاً — مساهمو شركة الأفق للرعاية الصحية ش.م.خ",
    },
    aiAnalysis: {
      requestValidity: "مقبول — يستوفي كامل متطلبات البلاغ الرسمي",
      urgencyClassification: "حرج (مستوى 1) — تدخل فوري مطلوب",
      riskLevel: "مرتفع جداً",
      recommendedPath: "التفتيش الاستثنائي العاجل مع الحفاظ على الأدلة",
      priorActionsAssessment: "استُنفدت وسائل الإصلاح التحذيرية العادية بالكامل",
      marsadRecommendation: "المضي في الإجراء الاستثنائي العاجل — تُستوفى متطلبات المادة (37) من المرسوم الاتحادي بقانون رقم (4) لسنة 2016",
    },
    aiContribution: "حلّل نظام MARSAD البلاغات الأحد عشرة وملفات الإنذارات الثلاثة وصنّف الخطر تصنيفاً آلياً في المستوى الحرج، واقترح مسار التفتيش الاستثنائي العاجل وفق أحكام المادة (37/4). أقرّ المسؤولون البشريون الاستنتاجات وأذنوا بتفعيل الإجراءات الطارئة.",
  },

  legal_authority: {
    stageData: {
      issuingBodyAr: "وزارة الصحة ووقاية المجتمع — الإدارة العامة للرقابة والتفتيش الصحي — إمارة أبوظبي",
      authorizedOfficial: "د. خالد محمد العامري — وكيل الوزارة المساعد للرقابة الصحية",
      authorizationBasis: "المادة (37) من المرسوم الاتحادي بقانون رقم (4) لسنة 2016 في شأن المنشآت الطبية",
      delegationChain: "صاحب السمو وزير الصحة → وكيل الوزارة → وكيل الوزارة المساعد للرقابة (قرار تفويض رقم 215/2024)",
      jurisdictionScope: "جميع المنشآت الصحية الخاصة المرخصة في إمارة أبوظبي",
      constitutionalBasis: "المادة (19) من الدستور الاتحادي — الحق في الرعاية الصحية وصون الصحة العامة",
      jurisdictionChecks: { material: "confirmed", territorial: "confirmed", temporal: "confirmed", hierarchical: "confirmed" },
      legalBasisStrength: "strong",
      facilityLicenseNumber: "HAAD-PRIV-ABU-2019-04471",
    },
    aiAnalysis: {
      authorityConfirmed: true,
      allJurisdictionChecksPass: true,
      delegationValid: true,
      legalityScore: 98,
      notes: "الصلاحية القانونية مؤكدة. سلسلة التفويض مستوفاة على المستويات الأربعة.",
    },
    aiContribution: "تحقّق نظام MARSAD تلقائياً من صلاحية الاختصاص على أربعة مستويات (موضوعي — مكاني — زمني — درجي) وأكّد سريان التفويض الوزاري رقم 215/2024. أقرّ المسؤولون البشريون النتائج دون أي تحفظ.",
  },

  facts_evidence: {
    stageData: {
      inspectionPeriod: "1 – 5 أبريل 2026م — خمسة أيام متواصلة",
      inspectionTeam: "ثمانية (8) مفتشين متخصصين: أربعة أطباء ومفتشَان دوائيَّان ومفتشَا جودة",
      leaderOfInspection: "المفتش العام د. منى سعيد الشامسي",
      totalViolations: 27,
      criticalViolations: 9,
      violationCategories: {
        medicationSafety: "أدوية منتهية الصلاحية في وحدة العناية المركزة وغرفة الطوارئ",
        staffCredentials: "أربعة أطباء بشهادات غير معتمدة (موضوع بلاغ جنائي)",
        equipmentFailure: "خمسة أجهزة إنعاش خارج الخدمة أو بحاجة صيانة",
        documentationFailures: "غياب سجلات طبية لأربعة وعشرين مريضاً مقيمَين",
        infectionControl: "ثلاث مخالفات جسيمة في بروتوكولات مكافحة العدوى",
      },
      medicationErrors: "23 خطأً دوائياً موثقاً — 12 منها صُنِّفت خطراً جسيماً وفق تصنيف NCC MERP",
      deathsUnderInvestigation: "ثلاث وفيات: ن.ع/2025/4471 — ن.ع/2025/4892 — ن.ع/2026/0112",
      priorWarningsIssuedAndIgnored: [
        "إنذار 445/2025 (أغسطس 2025) — استجابة: خطة تصحيح لم تُنفَّذ",
        "إنذار 712/2025 (نوفمبر 2025) — استجابة: وعود شفهية بلا إجراءات",
        "إنذار 089/2026 (يناير 2026) — استجابة: خطة ثانية لم تُنفَّذ",
      ],
      witnessStatements: "12 إفادة موثقة من موظفين تُؤكد المخالفات",
    },
    aiAnalysis: {
      evidenceQuality: "complete",
      evidenceStrength: "قوية جداً — أدلة مادية ووثائقية وشهادات تُشكّل سجلاً إثباتياً متكاملاً",
      riskToCurrentPatients: "مرتفع جداً — يستوجب تدخلاً فورياً",
      priorActionExhaustion: "تأكيد — ثلاثة إنذارات تُثبت استنفاد وسائل الإصلاح التحذيرية",
      patternAnalysis: "الأخطاء الثلاثة والعشرون تُشير إلى خلل منهجي لا أخطاء فردية",
    },
    aiContribution: "أجرى نظام MARSAD تحليلاً إحصائياً لأنماط الأخطاء الدوائية وكشف طابعها المنهجي، وصنّف مستوى الخطر وفق معايير NCC MERP، وتحقّق من اكتمال سلسلة الأدلة ومدى قبوليتها القضائية.",
  },

  legal_basis: {
    stageData: {
      primaryLegislation: "المرسوم الاتحادي بقانون رقم (4) لسنة 2016 في شأن المنشآت الطبية",
      primaryArticles: [
        "المادة (37) — الإيقاف المؤقت للترخيص",
        "المادة (38) — تعيين مدير تشغيل مؤقت",
        "المادة (40) — المسؤولية الجنائية والمدنية",
        "المادة (43) — إجراءات التبليغ وحق الطعن",
      ],
      secondaryLegislation: [
        "قرار مجلس الوزراء رقم (7) لسنة 2019 — معايير اعتماد المنشآت الصحية",
        "القانون الاتحادي رقم (2) لسنة 2019 — السجلات الصحية الإلكترونية",
        "قانون العقوبات الاتحادي — المادة (338) الإهمال الطبي",
      ],
      constitutionalBasis: [
        "المادة (19) الدستور الاتحادي — كفالة الصحة العامة",
        "المادة (25) الدستور الاتحادي — المساواة أمام القانون",
        "المادة (26) الدستور الاتحادي — الحماية الإجرائية",
      ],
      judicialPrecedent: "حكم المحكمة الاتحادية العليا (طعن إداري 447/2021) — أيّد سلطة الوزارة بالإيقاف المؤقت",
      legalBasisStrength: "strong",
    },
    aiAnalysis: {
      primaryArticleApplicability: "مباشرة وصريحة",
      constitutionalCompliance: true,
      legalityScore: 97,
      legislativeGaps: "لا توجد — السند القانوني شامل ومتكامل",
    },
    aiContribution: "رسم نظام MARSAD خريطة تشريعية متكاملة وتحقّق من استيفاء كل شرط إجرائي منصوص عليه في المواد المستند إليها، وأحال إلى سابقة قضائية مُؤيِّدة للمحكمة الاتحادية العليا.",
  },

  administrative_objective: {
    stageData: {
      primaryObjective: "حماية سلامة المرضى وصون الصحة العامة من خلال إيقاف المخالفات الجسيمة المستمرة وإعادة تأهيل المنشأة",
      secondaryObjectives: [
        "تعيين إدارة مؤقتة كفؤة لضمان استمرار تقديم الخدمة دون انقطاع",
        "حماية الحقوق العلاجية للمرضى الحاليين وتوفير خيار النقل الآمن",
        "إرساء مبدأ المساءلة المؤسسية في القطاع الصحي الخاص",
        "فتح مسار واضح وقابل للتحقق لإعادة الترخيص",
      ],
      targetOutcome: "إيقاف مؤقت 90 يوماً + مدير تشغيل مؤقت + خطة تصحيح مُلزِمة قابلة للمراجعة الشهرية",
      publicInterestWeight: "مرتفع جداً — حماية 800 مريض حالٍ وصون الثقة العامة في المنظومة الصحية الوطنية",
    },
    aiAnalysis: {
      objectiveClarity: "عالية جداً",
      publicInterestWeight: "مرتفع جداً",
      legitimateAimConfirmed: true,
      purposeDeviation: "لا يوجد انحراف عن الهدف المشروع",
      objectiveScore: 96,
    },
    aiContribution: "صاغ نظام MARSAD الأهداف التشغيلية القابلة للقياس وتحقّق من خلو الإجراء من الانحراف عن السلطة. أضاف الفريق الإداري مؤشرات الأداء الرئيسية (KPIs) بعد مراجعة مخرجات النظام.",
  },

  discretionary_power: {
    stageData: {
      discretionaryBasis: "المادة (37/2) تُخوّل الوزارة تحديد مدة الإيقاف بين 30 يوماً و6 أشهر وفق خطورة المخالفات وإمكانية التصحيح",
      discretionaryScope: "limited_discretion",
      factorsWeighed: [
        "خطورة المخالفات التسع الجسيمة وأثرها المباشر على سلامة المرضى",
        "فشل ثلاثة إنذارات متتالية يُثبت ضعف الاستجابة الإدارية",
        "800 مريض حالٍ يستدعي استمرار الخدمة في ظل إدارة مؤقتة",
        "إمكانية إصلاح المخالفات خلال 90 يوماً وفق تقدير فريق التفتيش",
        "الأثر الاقتصادي على 240 موظفاً يستوجب الموازنة مع حقوقهم",
      ],
      alternativesConsidered: [
        "إنذار رابع — مرفوض: ثلاث تجارب فاشلة تُثبت عدم الجدوى",
        "إيقاف جزئي — مرفوض: تشابك المخالفات يجعل العزل الجزئي وهماً",
        "إلغاء فوري نهائي — مرفوض: عدم التناسب مع إمكانية التصحيح",
        "تحويل حكومي — مرفوض: انعدام السند القانوني",
      ],
      chosenApproach: "إيقاف مؤقت 90 يوماً + مدير مؤقت + خطة تصحيح مُلزِمة",
    },
    aiAnalysis: {
      discretionExercisedProperly: true,
      alternativesAdequatelyConsidered: true,
      discretionScore: 95,
      durationJustification: "90 يوماً: أدنى مدة كافية للإصلاح الجوهري — لا هي قصيرة دون أثر ولا طويلة بما يُدمّر المنشأة",
    },
    aiContribution: "قيّم نظام MARSAD البدائل الأربعة تقييماً منهجياً بمعايير الفاعلية والتناسب والأثر على الأطراف، وحدّد خيار الإيقاف التسعيني بوصفه الاستجابة الأمثل.",
  },

  proportionality: {
    stageData: {
      legitimateAimTest: "اجتاز — هدف حماية الصحة العامة مشروع دستورياً بالمادة (19)",
      necessityTest: "اجتاز — ثلاثة إنذارات أثبتت استنفاد الإجراءات الأقل تدخلاً",
      strictProportionalityTest: "اجتاز — الإيقاف المؤقت 90 يوماً أدنى درجات التدخل الكافي",
      proportionalityConclusion: "proportionate",
      mitigatingMeasures: [
        "مدير مؤقت يُديم تقديم الخدمة للمرضى الحاليين",
        "بروتوكول نقل آمن مدعوم مالياً للراغبين في الانتقال",
        "ضمان استمرار رواتب الموظفين طوال فترة الإيقاف",
        "مسار إعادة ترخيص واضح ومُحدَّد المعالم",
      ],
    },
    aiAnalysis: {
      legitimateAimPassed: true,
      necessityPassed: true,
      strictProportionalityPassed: true,
      overallProportionality: "proportionate",
      proportionalityScore: 93,
    },
    aiContribution: "أجرى نظام MARSAD الاختبارات الدستورية الثلاثة وفق منهجية السوابق القضائية الاتحادية، وحدّد تدابير التخفيف الأمثل. راجعت اللجنة كل اختبار وأضافت ضمان رواتب الموظفين.",
  },

  human_oversight: {
    stageData: {
      supervisingOfficer: "د. خالد محمد العامري — وكيل الوزارة المساعد للرقابة الصحية",
      reviewCommitteeName: "لجنة مراجعة القرارات الصحية العليا — وزارة الصحة ووقاية المجتمع",
      committeeMembers: [
        "أ.د. فاطمة راشد الزعابي — رئيسة اللجنة، وكيلة الوزارة",
        "د. خالد محمد العامري — مقدِّم القرار",
        "د. محمد سعيد الكعبي — الشؤون القانونية والتشريعية",
        "د. سارة أحمد المنصوري — مديرة إدارة الجودة الصحية",
        "المستشار / سلطان يوسف الحمادي — مستشار قانوني أول",
        "د. منى سعيد الشامسي — المفتش العام",
      ],
      reviewDate: "21 أبريل 2026م",
      sessionDuration: "4 ساعات و30 دقيقة — 9:00 – 13:30",
      humanDecision: "موافقة جماعية بالإجماع التام",
      votingRecord: "6 أصوات موافقة — 0 اعتراض — 0 امتناع",
      aiRecommendationAdopted: "تبنّت اللجنة جميع توصيات MARSAD",
      humanJudgmentAdditions: "أضافت اللجنة بنداً بضمان استمرار رواتب الموظفين — لم يكن في التوصيات الأولية للنظام",
      humanOwner: "د. خالد محمد العامري — وكيل الوزارة المساعد للرقابة الصحية — وزارة الصحة ووقاية المجتمع",
      reviewedAllStages: true,
      aiContributionAcknowledgment: true,
      legalConsequencesAware: true,
    },
    aiAnalysis: {
      humanOversightLevel: "full",
      humanJudgmentBeyondAi: "ضمان رواتب الموظفين + لجنة متابعة بمشاركة مدنية — إضافات بشرية حقيقية",
      aiRoleProper: "استشاري وتحليلي — الإنسان يقرر والذكاء يسند (المبدأ الدستوري الرابع)",
      oversightScore: 99,
    },
    aiContribution: "وثّق نظام MARSAD جلسة المراجعة البشرية وتحقّق من استيفاء المبدأ الدستوري الرابع (الإنسان يقرر — الذكاء يسند)، وسجّل الإضافات البشرية المستقلة بوصفها مؤشراً على الرقابة الحقيقية لا الشكلية.",
  },

  constitutional_validation: {
    stageData: {
      validationDate: "22 أبريل 2026م",
      validationOfficer: "د. خالد محمد العامري",
      overallScore: 94,
      overallResult: "passed",
      alShamsiFrameworkCompliance: "full",
      principleResults: [
        { principle: "مبدأ سيادة القانون والمشروعية",         passed: true, score: 97 },
        { principle: "مبدأ التناسب الدستوري",                 passed: true, score: 93 },
        { principle: "مبدأ الشفافية والوضوح",                  passed: true, score: 89 },
        { principle: "مبدأ المساءلة والمسؤولية",               passed: true, score: 95 },
        { principle: "مبدأ الحياد والنزاهة المؤسسية",          passed: true, score: 93 },
        { principle: "مبدأ حماية الحقوق الأساسية",             passed: true, score: 88 },
        { principle: "مبدأ الرقابة البشرية الفعّالة",          passed: true, score: 99 },
        { principle: "مبدأ قابلية التفسير والبيان",            passed: true, score: 91 },
        { principle: "مبدأ المشروعية الإجرائية",               passed: true, score: 96 },
        { principle: "مبدأ المصلحة العامة والتضامن الاجتماعي", passed: true, score: 98 },
      ],
      sealingAuthorized: true,
    },
    aiAnalysis: {
      constitutionalValidationPassed: true,
      allTenPrinciplesPassed: true,
      alShamsiScore: 94,
      sealingRecommended: true,
      notes: "جميع المبادئ العشرة اجتازت بمتوسط 93.9/100. يُوصى بختم الهوية الدستورية.",
    },
    aiContribution: "نفّذ نظام MARSAD التحقق الدستوري الآلي على المبادئ العشرة لإطار الشامسي وأنتج درجة الامتثال الكلية وأصدر توصية الختم. قرّر المسؤول البشري ختم الهوية بمراجعة مستقلة.",
  },

  decision_drafting: {
    stageData: {
      decisionNumber: "م/ر/2026/147",
      decisionDate: "22 أبريل 2026م",
      decisionTextAr: `قرار وكيل وزارة الصحة ووقاية المجتمع المساعد للرقابة الصحية
رقم (م/ر/2026/147) — بتاريخ 22 أبريل 2026م

نحن، د. خالد محمد العامري، وكيل الوزارة المساعد للرقابة الصحية،

استناداً إلى المرسوم الاتحادي بقانون رقم (4) لسنة 2016 ولا سيما المادتين (37) و(38) منه،
واستناداً إلى قرار مجلس الوزراء رقم (7) لسنة 2019،
واستناداً إلى قرار التفويض الوزاري رقم (215/2024)،
وبعد الاطلاع على تقارير التفتيش الاستثنائي (1-5 أبريل 2026م)،
وبعد مداولات لجنة مراجعة القرارات الصحية العليا (21 أبريل 2026م)،
وبعد اعتماد نظام MARSAD للقرار الإداري الذكي وفق إطار الشامسي،

قرّرنا ما يلي:

المادة الأولى: يُوقَف نشاط مستشفى الأفق الطبي الخاص (HAAD-PRIV-ABU-2019-04471) مؤقتاً لمدة تسعين (90) يوماً.
المادة الثانية: يُعيَّن د. سعيد منصور الظاهري مديراً مؤقتاً للتشغيل (DHA-LIC-2018-7702).
المادة الثالثة: تُقدِّم الإدارة خطة تصحيح شاملة خلال 14 يوماً مع متابعة شهرية.
المادة الرابعة: تُضمَن رواتب الموظفين كاملةً. يُوفَّر نقل آمن مدعوم لكل مريض راغب.
المادة الخامسة: يحق للمنشأة الطعن أمام المحكمة الإدارية الابتدائية خلال 30 يوماً.

أبوظبي — 22 أبريل 2026م
وكيل وزارة الصحة ووقاية المجتمع المساعد للرقابة الصحية
د. خالد محمد العامري`,
      operativeArticlesCount: 5,
      draftVersion: "النسخة النهائية المعتمدة من اللجنة القانونية",
    },
    aiAnalysis: {
      draftQuality: "ممتاز",
      legalFormCompliance: true,
      languageScore: 97,
      appealRightsIncluded: true,
      recommendations: "الصياغة مستوفية جميع المتطلبات القانونية والشكلية.",
    },
    aiContribution: "اقترح نظام MARSAD الهيكل الأولي وتحقّق من استيفاء المتطلبات الإجرائية الإلزامية. صاغ الفريق القانوني النص النهائي بعد مراجعة تفصيلية.",
  },

  final_review: {
    stageData: {
      finalReviewDate: "24 أبريل 2026م",
      reviewOutcome: "اعتماد نهائي — القرار صالح للإصدار الرسمي والتبليغ",
      signatoryName: "د. خالد محمد العامري",
      signatoryTitle: "وكيل وزارة الصحة ووقاية المجتمع المساعد للرقابة الصحية",
      effectiveDate: "24 أبريل 2026م",
      notificationTargets: [
        "إدارة مستشفى الأفق الطبي الخاص — تسليم شخصي",
        "د. سعيد منصور الظاهري — المدير المؤقت المُعيَّن",
        "الإدارة العامة للرقابة والتفتيش الصحي",
        "هيئة الصحة أبوظبي (HAAD)",
        "النيابة العامة — ملف التحقيق",
        "دائرة الصحة أبوظبي — تنسيق نقل المرضى",
      ],
      marsadCaseStatus: "complete",
      dciSealed: true,
      jdpAuthorized: true,
      finalCheckList: {
        legalBasisVerified: true,
        proportionalityVerified: true,
        humanOversightVerified: true,
        constitutionalValidationPassed: true,
        draftLanguageApproved: true,
        appealRightsIncluded: true,
        notificationListComplete: true,
        marsadRecordComplete: true,
      },
    },
    aiAnalysis: {
      finalCheckAllPassed: true,
      complianceScore: 98,
      jdpReadyToGenerate: true,
      closingNotes: "الملف مكتمل في جميع مراحله الإحدى عشرة. الهوية الدستورية مختومة. حزمة الدفاع القضائي جاهزة للتوليد.",
    },
    aiContribution: "أجرى نظام MARSAD المراجعة النهائية الشاملة عبر قائمة التحقق الآلية لكل مرحلة وأصدر شهادة الاكتمال. طابق الفريق القانوني جميع البنود قبل التوقيع النهائي.",
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  MARSAD — Executive Demonstration Scenario");
  console.log("  القرار الدستوري — The Constitutional Decision");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 0 — clean previous run (explicit ordering — decision_stages has no cascade FK)
  const [prev] = await db.select({ id: decisionsTable.id })
    .from(decisionsTable).where(eq(decisionsTable.caseNumber, "MARSAD-2026-0147"));
  if (prev) {
    console.log("→ حذف السيناريو التجريبي السابق...");
    // Delete child rows that lack cascade first, then the parent (DCI + JDP cascade automatically)
    await db.delete(decisionStagesTable).where(eq(decisionStagesTable.decisionId, prev.id));
    await db.delete(decisionsTable).where(eq(decisionsTable.id, prev.id));
    console.log("  ✓ تم الحذف\n");
  }

  // 1 — Decision
  console.log("1. إنشاء القرار الرئيسي...");
  const [decision] = await db.insert(decisionsTable).values({
    caseNumber:      "MARSAD-2026-0147",
    titleAr:         "قرار بإيقاف مزاولة النشاط الصحي مؤقتاً وتعيين مدير تشغيل مؤقت لمستشفى الأفق الطبي الخاص",
    titleEn:         "Decision on Temporary Suspension of Healthcare Activities and Appointment of Interim Operations Director — Al-Ufuq Private Medical Hospital",
    status:          "complete",
    currentStage:    "final_review",
    stagesCompleted: [...DECISION_STAGE_KEYS],
    jurisdiction:    "uae",
    decisionType:    "suspension",
    organizationUnit: "وزارة الصحة ووقاية المجتمع — الإدارة العامة للرقابة والتفتيش الصحي — إمارة أبوظبي",
    issuingAuthority: "د. خالد محمد العامري — وكيل الوزارة المساعد للرقابة الصحية",
    createdBy:       1,
    metadata: {
      scenario: "executive-demonstration",
      scenarioName: "القرار الدستوري — The Constitutional Decision",
      facilityName: "مستشفى الأفق الطبي الخاص",
      facilityLicense: "HAAD-PRIV-ABU-2019-04471",
      affectedPatients: 800,
      affectedEmployees: 240,
      suspensionDays: 90,
    },
    createdAt: TS.created,
    updatedAt: TS.final_review,
  }).returning();
  console.log(`  ✓ القرار: ${decision.caseNumber} (ID: ${decision.id})\n`);

  // 2 — Stages
  console.log("2. إنشاء المراحل الإحدى عشرة...");
  const stageHashes: string[] = [];
  for (const [idx, key] of DECISION_STAGE_KEYS.entries()) {
    const ts = TS[key as keyof typeof TS];
    const h  = stageHash(decision.id, key, ts.toISOString());
    stageHashes.push(h);
    await db.insert(decisionStagesTable).values({
      decisionId:       decision.id,
      stageKey:         key,
      stageNumber:      idx + 1,
      stageData:        STAGES[key]!.stageData,
      aiContribution:   STAGES[key]!.aiContribution,
      aiAnalysis:       STAGES[key]!.aiAnalysis,
      humanOverride:    false,
      validationStatus: "passed",
      validationDetails: {},
      validatedAt:      ts,
      validatedBy:      1,
      auditHash:        h,
      completedAt:      ts,
    });
    console.log(`  ✓ [${String(idx + 1).padStart(2," ")}] ${STAGE_NAMES[key]}`);
  }

  // 3 — Sealed DCI
  console.log("\n3. إنشاء الهوية الدستورية المختومة (DCI)...");
  const completeAuditHash = sha256(stageHashes.join("|"));
  const sealedAt = TS.constitutional_validation;
  await db.insert(decisionDciTable).values({
    decisionId:                   decision.id,
    decisionType:                 "إيقاف مزاولة نشاط مؤقت وتعيين مدير تشغيل",
    competentAuthority:           "وكيل الوزارة المساعد للرقابة الصحية — د. خالد محمد العامري — وزارة الصحة ووقاية المجتمع",
    applicableLegalBasis: [
      "المرسوم الاتحادي بقانون رقم (4) لسنة 2016 — المادة (37) الإيقاف المؤقت",
      "المرسوم الاتحادي بقانون رقم (4) لسنة 2016 — المادة (38) تعيين مدير مؤقت",
      "قرار مجلس الوزراء رقم (7) لسنة 2019 — معايير الاعتماد",
      "المادة (19) من الدستور الاتحادي — صون الصحة العامة",
    ],
    purposeOfDecision:            "حماية سلامة المرضى وصون الصحة العامة من خلال إيقاف المخالفات الجسيمة المستمرة وإعادة تأهيل المنشأة",
    humanDecisionOwner:           "د. خالد محمد العامري — وكيل الوزارة المساعد للرقابة الصحية — وزارة الصحة ووقاية المجتمع",
    aiParticipationLevel:         "comprehensive",
    humanOversightLevel:          "full",
    explainabilityLevel:          "high",
    transparencyLevel:            "high",
    evidenceCompleteness:         "complete",
    proportionalityStatus:        "proportionate",
    legalityStatus:               "confirmed",
    constitutionalValidationStatus: "passed",
    alShamsiFrameworkCompliance:  "full",
    completeAuditHash,
    currentVersion:               1,
    versionHistory:               [],
    isSealed:                     true,
    sealedAt,
    sealedBy:                     1,
    createdAt:                    TS.created,
    updatedAt:                    sealedAt,
  });
  console.log(`  ✓ مختومة — بصمة SHA-256: ${completeAuditHash.substring(0, 24)}...`);

  // 4 — JDP (14 sections)
  console.log("\n4. إنشاء حزمة الدفاع القضائي (JDP) — 14 قسماً دستورياً...");

  const factualChronology = DECISION_STAGE_KEYS.map((key, i) => ({
    stageNumber: i + 1,
    stage: key,
    stageName: STAGE_NAMES[key]!,
    date: TS[key as keyof typeof TS]?.toISOString().substring(0, 10) ?? null,
    description: ({
      administrative_request:   "تلقّت الوزارة بلاغات موثقة من أحد عشر ممرضاً. صنّف MARSAD الخطر في المستوى الحرج وأوصى بتفعيل إجراءات الطوارئ وفق المادة (37/4).",
      legal_authority:          "تُحقّق فريق الاختصاص من الصلاحية على أربعة مستويات وأكّد سريان التفويض الوزاري. لا إشكالية في الاختصاص من أي وجه.",
      facts_evidence:           "فريق تفتيش ثمانية مفتشين أجرى تفتيشاً ميدانياً خمسة أيام ورصد سبعاً وعشرين مخالفة، تسعٌ منها جسيمة تمس سلامة المرضى مباشرةً.",
      legal_basis:              "رسم الفريق القانوني خريطة تشريعية متكاملة تُثبت الاستناد الصريح إلى المادتين (37) و(38) مع سوابق قضائية مُؤيِّدة للمحكمة الاتحادية العليا.",
      administrative_objective: "حُدِّد هدف القرار بصياغة قابلة للقياس. تحقّق النظام من خلو الهدف من الانحراف عن السلطة بعد تحليل شامل.",
      discretionary_power:      "قُيِّمت أربعة بدائل ورُفض ثلاثة منها بأسباب موضوعية. الإيقاف التسعيني مع الإدارة المؤقتة هو الاستجابة الأمثل.",
      proportionality:          "الاختبارات الدستورية الثلاثة للتناسب اجتازت. أُدرجت ستة تدابير تخفيف لحماية حقوق الأطراف المتأثرة.",
      human_oversight:          "لجنة من ستة مسؤولين اجتمعت أربع ساعات ونصف وصوّتت بالإجماع. أضافت بنداً بضمان رواتب الموظفين لم يكن في توصيات النظام.",
      constitutional_validation: "جميع المبادئ العشرة اجتازت بمتوسط 93.9/100. أصدر المسؤول المُخوَّل قرار ختم الهوية الدستورية.",
      decision_drafting:        "صيغ القرار في خمس مواد تنفيذية مرّت بمراجعة قانونية ولغوية مزدوجة.",
      final_review:             "اعتُمد القرار ووُقِّع ووُزِّع على ستة جهات معنية في اليوم ذاته.",
    })[key] ?? "",
    actor: "د. خالد محمد العامري وفريق القرار — وزارة الصحة ووقاية المجتمع",
    aiContribution: STAGES[key]!.aiContribution,
  }));

  const legalBasis = {
    overview: "يستند القرار إلى منظومة تشريعية متكاملة على ثلاثة مستويات: دستوري واتحادي ولائحي. المادة (37) من المرسوم الاتحادي بقانون رقم (4) لسنة 2016 تُخوّل الوزارة صراحةً إيقاف ترخيص المنشآت الصحية الخاصة مؤقتاً عند ثبوت المخالفات الجسيمة الماسّة بسلامة المرضى.",
    grounds: [
      { law: "المرسوم الاتحادي بقانون رقم (4) لسنة 2016", article: "المادة (37) — الإيقاف المؤقت", relevance: "تُخوّل الوزارة صراحةً إيقاف الترخيص مؤقتاً عند ثبوت مخالفات جسيمة — تنطبق مباشرةً على الوقائع" },
      { law: "المرسوم الاتحادي بقانون رقم (4) لسنة 2016", article: "المادة (38) — تعيين مدير مؤقت", relevance: "تُجيز تعيين مدير تشغيل مؤقت لضمان استمرار الخدمة الصحية لـ 800 مريض" },
      { law: "قرار مجلس الوزراء رقم (7) لسنة 2019", article: "الملحق (أ) — معايير السلامة الإلزامية", relevance: "يُحدد المعايير التي خالفتها المنشأة في 27 مخالفة موثقة" },
      { law: "الدستور الاتحادي", article: "المادة (19) — صون الصحة العامة", relevance: "تُلزم الدولة دستورياً بالتدخل الوقائي لصون الصحة العامة" },
    ],
    conclusion: "السند القانوني متكامل وصريح. لا فجوات تشريعية. المادة (37) تنطبق حرفياً على الوقائع المُثبَتة بالدليل المادي والشهادات الموثقة.",
  };

  const applicableLegislation = [
    { title: "المرسوم الاتحادي بقانون رقم (4) لسنة 2016 في شأن المنشآت الطبية", reference: "اتحادي/4/2016", applicableArticles: ["المادة (37)", "المادة (38)", "المادة (40)", "المادة (43)"], relevance: "التشريع الأساسي المُنظِّم لصلاحيات الوزارة في إيقاف ترخيص المنشآت الصحية الخاصة" },
    { title: "قرار مجلس الوزراء رقم (7) لسنة 2019 — معايير اعتماد المنشآت الصحية", reference: "ق.م.و/7/2019", applicableArticles: ["الملحق (أ)", "الملحق (ب)"], relevance: "يُحدد المعايير الإلزامية التي خالفتها المنشأة في 27 مخالفة موثقة" },
    { title: "القانون الاتحادي رقم (2) لسنة 2019 — تقنية المعلومات في الصحة", reference: "اتحادي/2/2019", applicableArticles: ["المادة (12)", "المادة (15)"], relevance: "يُلزم بالسجلات الطبية الإلكترونية التي افتقر إليها 24 مريضاً" },
    { title: "الدستور الاتحادي لدولة الإمارات العربية المتحدة", reference: "دستور/1971", applicableArticles: ["المادة (19)", "المادة (25)", "المادة (26)"], relevance: "الأساس الدستوري الأعلى: كفالة الصحة العامة — المساواة — حق الدفاع والطعن" },
    { title: "قانون العقوبات الاتحادي — الإهمال الطبي", reference: "اتحادي/3/1987 معدّل", applicableArticles: ["المادة (338)"], relevance: "يُؤسَّس عليه البلاغ الجنائي المتعلق بالوفيات الثلاث قيد التحقيق" },
  ];

  const evidenceSummary = {
    overview: "سجل إثباتي متكامل يشمل أدلة مادية محرَّزة وتقارير تفتيش رسمية وشهادات موثقة وسجلات إدارية. الأدلة تُثبت خللاً منهجياً لا أخطاءً فردية.",
    items: [
      { type: "تقرير التفتيش الاستثنائي", description: "تقرير رسمي موقَّع من 8 مفتشين متخصصين يُوثّق 27 مخالفة خلال 5 أيام ميدانية", weight: "high" as const, admissibility: "وثيقة رسمية حكومية — قابلة للإثبات القضائي الكامل" },
      { type: "أدوية منتهية الصلاحية — عينات محرَّزة", description: "عينات مُحرَّزة من وحدة العناية المركزة وغرفة الطوارئ محفوظة في مستودع الأدلة الرقمية", weight: "high" as const, admissibility: "أدلة مادية مُحرَّزة وفق إجراءات النيابة العامة — سلسلة الحيازة موثقة" },
      { type: "شهادات موظفين موثقة", description: "12 إفادة موقَّعة تُؤكد المخالفات وتُضيف تفاصيل عن ضغوط إدارية لإخفاء الحوادث", weight: "high" as const, admissibility: "شهادات محرَّرة بحضور مستشار قانوني — قابلة للاستشهاد بها أمام المحكمة" },
      { type: "سجل الأخطاء الدوائية", description: "23 خطأً دوائياً موثقاً بأرقام المرضى والتواريخ والأطباء خلال أغسطس 2025 – مارس 2026", weight: "high" as const, admissibility: "سجلات طبية رسمية مستخرجة بقرار قضائي — قوة إثباتية كاملة" },
      { type: "ملفات الإنذارات الثلاثة", description: "إنذارات 445/2025 و712/2025 و089/2026 مع توثيق فشل الاستجابة في كل مرة", weight: "high" as const, admissibility: "مراسلات حكومية رسمية — تُثبت استنفاد وسائل الإصلاح التحذيرية" },
    ],
    completenessAssessment: "عالية جداً — السجل الإثباتي يغطي مستويات الإثبات الثلاثة: مادي — وثائقي — شهادات",
    conclusion: "الأدلة تُؤسِّس يقيناً إدارياً بوجود المخالفات وجسامتها. لا ثغرات إثباتية في السجل.",
  };

  const proportionalityAnalysis = {
    legitimateAimTest: { result: "passed" as const, reasoning: "حماية الصحة العامة وسلامة المرضى هدف مشروع دستورياً بالمادة (19) ويُمثّل أعلى أولويات الدولة." },
    necessityTest: { result: "passed" as const, reasoning: "استُنفدت الإجراءات الأقل تدخلاً ثلاث مرات (إنذارات 445/2025 و712/2025 و089/2026) دون نتيجة جوهرية. الإيقاف الشامل هو الحد الأدنى الكافي." },
    strictProportionalityTest: { result: "passed" as const, reasoning: "إيقاف مؤقت 90 يوماً مع 6 تدابير تخفيف يُمثّل أقل درجات التدخل القادرة على إحداث التغيير. حماية 800 مريض مقابل قيد مؤقت قابل للاسترداد." },
    overallConclusion: "القرار يجتاز الاختبارات الدستورية الثلاثة بوضوح. التدابير التخفيفية الست ترفع مستوى التناسب إلى أعلى درجاته.",
  };

  const discretionaryReasoning = {
    overview: "مارست الوزارة سلطتها التقديرية ضمن حدود المادة (37/2) باختيار مدة 90 يوماً من نطاق 30–180 يوماً، بناءً على تقييم منهجي لأربعة عوامل موضوعية.",
    factorsConsidered: [
      "خطورة التسع مخالفات الجسيمة وتأثيرها المباشر على المرضى",
      "فشل ثلاثة إنذارات متتالية يُثبت ضعف الاستجابة الإدارية",
      "وجود 800 مريض حالٍ يستلزم استمرار الخدمة",
      "تقدير فريق التفتيش بإمكانية التصحيح خلال 90 يوماً",
      "الأثر الاقتصادي على 240 موظفاً",
    ],
    alternativesEvaluated: "أربعة بدائل قُيِّمت واستُبعدت: الإنذار الرابع (فاشل بالتجربة) — الإيقاف الجزئي (المخالفات متشابكة) — الإلغاء الفوري (مفرط) — التحويل الحكومي (انعدام السند).",
    publicInterestBalance: "المصلحة العامة (800 مريض + ثقة منظومة الصحة + الردع التنظيمي) تفوق بمراحل العبء المؤقت على المنشأة.",
    conclusion: "السلطة التقديرية مُمارَسة بقدر وأمانة ضمن الحدود القانونية، ومُبرَّرة بأسباب يصمد أمام الرقابة القضائية.",
  };

  const aiParticipationExplanation = {
    overview: "اضطلع نظام MARSAD بدور استشاري وتحليلي شامل في جميع المراحل الإحدى عشرة. الإنسان ظل صاحب القرار النهائي في كل مرحلة.",
    totalStagesWithAiAssistance: 11,
    participationLevel: "comprehensive",
    stageContributions: DECISION_STAGE_KEYS.map((key) => ({
      stage: key,
      stageName: STAGE_NAMES[key]!,
      contribution: STAGES[key]!.aiContribution,
      humanVerification: "راجع المسؤول البشري المختص جميع المخرجات وأقرّها أو عدّل فيها",
      reviewedBy: "د. خالد محمد العامري أو عضو اللجنة المختص",
    })),
    overallAssessment: "نظام MARSAD أسهم في سرعة التحليل ودقته وشمولية الاختبارات، بينما الحكم البشري سيّد الموقف في كل مفترق. المبدأ الرابع (الإنسان يقرر — الذكاء يسند) طُبِّق طبيقاً أميناً.",
  };

  const humanOversightRecord = {
    authorizedOfficer: "د. خالد محمد العامري",
    position: "وكيل الوزارة المساعد للرقابة الصحية",
    organization: "وزارة الصحة ووقاية المجتمع — إمارة أبوظبي",
    oversightLevel: "full",
    verificationSteps: DECISION_STAGE_KEYS.map((key) => ({
      stage: key,
      stageName: STAGE_NAMES[key]!,
      humanAction: ({
        administrative_request:   "مراجعة البلاغات الأحد عشرة والإذن بتفعيل إجراءات الطوارئ",
        legal_authority:          "التحقق الشخصي من صلاحية التفويض وإقرار نطاق الاختصاص",
        facts_evidence:           "مراجعة تقرير التفتيش كاملاً والتثبت من جسامة المخالفات",
        legal_basis:              "مراجعة التحليل القانوني مع المستشار والتحقق من المواد",
        administrative_objective: "إقرار الأهداف والتحقق من خلوها من الانحراف",
        discretionary_power:      "دراسة البدائل الأربعة واعتماد خيار الإيقاف التسعيني",
        proportionality:          "مراجعة الاختبارات الثلاثة وإقرار التدابير التخفيفية",
        human_oversight:          "رئاسة جلسة اللجنة وإضافة ضمان رواتب الموظفين",
        constitutional_validation:"إصدار قرار ختم الهوية بعد مراجعة المبادئ العشرة",
        decision_drafting:        "مراجعة الصياغة مع الفريق القانوني والاعتماد النهائي",
        final_review:             "التوقيع الرسمي والإذن بالتبليغ لجميع الجهات",
      })[key] ?? "",
      outcome: "إقرار وإذن بالمضي — مع إضافات بشرية في مرحلتَي الرقابة والمراجعة",
    })),
    conclusion: "رقابة بشرية استثنائية: مسؤول من المستوى القيادي، لجنة ستة خبراء، إجماع تام، وإضافة مستقلة تتجاوز توصيات الذكاء الاصطناعي.",
  };

  const constitutionalValidationResults = {
    overallResult: "passed",
    validationDate: TS.constitutional_validation.toISOString().substring(0, 10),
    alShamsiScore: 94,
    principleResults: [
      { principle: "مبدأ سيادة القانون والمشروعية",         passed: true, score: 97, notes: "المادة (37) صريحة. لا غموض ولا تعارض تشريعي." },
      { principle: "مبدأ التناسب الدستوري",                 passed: true, score: 93, notes: "الاختبارات الثلاثة اجتازت. الإيقاف المؤقت هو الأقل تدخلاً الكافي." },
      { principle: "مبدأ الشفافية والوضوح",                  passed: true, score: 89, notes: "الأسباب موثقة. مسار الطعن صريح في المادة الخامسة." },
      { principle: "مبدأ المساءلة والمسؤولية",               passed: true, score: 95, notes: "سلسلة مسؤولية واضحة من المفتش العام إلى وكيل الوزارة." },
      { principle: "مبدأ الحياد والنزاهة المؤسسية",          passed: true, score: 93, notes: "انعدام الصلة الشخصية بين اللجنة والمنشأة — تقييم موضوعي." },
      { principle: "مبدأ حماية الحقوق الأساسية",             passed: true, score: 88, notes: "حق الدفاع، الطعن (30 يوماً)، الرواتب، نقل المرضى — جميعها مكفولة." },
      { principle: "مبدأ الرقابة البشرية الفعّالة",          passed: true, score: 99, notes: "أعلى درجة ممكنة. ستة مسؤولين. إجماع. إضافة مستقلة." },
      { principle: "مبدأ قابلية التفسير والبيان",            passed: true, score: 91, notes: "كل استنتاج مُبرَّر بأسباب موضوعية قابلة للتحقق القضائي." },
      { principle: "مبدأ المشروعية الإجرائية",               passed: true, score: 96, notes: "الإجراءات مستوفاة كاملةً: تفتيش ← توثيق ← لجنة ← قرار ← تبليغ." },
      { principle: "مبدأ المصلحة العامة والتضامن الاجتماعي", passed: true, score: 98, notes: "حماية 800 مريض أولى أولويات المصلحة العامة." },
    ],
    conclusion: "اجتياز استثنائي بمتوسط 93.9/100. جميع المبادئ فوق عتبة الاجتياز. القرار يصمد أمام أي مراجعة قضائية.",
  };

  const dciSummary = {
    decisionId: "MARSAD-2026-0147",
    decisionType: "إيقاف مزاولة نشاط مؤقت وتعيين مدير تشغيل",
    competentAuthority: "وكيل الوزارة المساعد للرقابة الصحية — د. خالد محمد العامري",
    constitutionalValidationStatus: "passed",
    alShamsiFrameworkCompliance: "full",
    sealedAt: sealedAt.toISOString(),
    completeAuditHash,
    currentVersion: 1,
  };

  const auditChain = {
    overview: "سلسلة تدقيق رقمية تغطي المراحل الإحدى عشرة. كل مرحلة تحمل بصمة SHA-256 مستقلة. البصمة الشاملة هي SHA-256 لجميع البصمات مجتمعةً.",
    stages: DECISION_STAGE_KEYS.map((key, i) => ({
      stageNumber: i + 1,
      stage: key,
      stageName: STAGE_NAMES[key]!,
      auditHash: stageHashes[i]!,
      completedAt: TS[key as keyof typeof TS]?.toISOString() ?? null,
    })),
    completeHash: completeAuditHash,
    integrityStatus: "verified" as const,
  };

  const versionHistoryRecord = {
    currentVersion: 1, isSealed: true, sealedAt: sealedAt.toISOString(), amendments: [],
  };

  const anticipatedJudicialReviewQuestions = [
    {
      category: "السند القانوني",
      question: "ما السند القانوني الصريح الذي يُخوّل وزارة الصحة إيقاف ترخيص منشأة خاصة مؤقتاً دون حكم قضائي سابق؟",
      legalGrounding: "قد يُطعن بأن الإيقاف الإداري دون سند تشريعي صريح يُشكّل تعدياً على حق مزاولة النشاط",
      preparedAnswer: "المادة (37) من المرسوم الاتحادي 4/2016 تُخوّل الوزارة صراحةً دون غموض إيقاف ترخيص المنشأة مؤقتاً حتى 6 أشهر. هذه الصلاحية قائمة على المادة (19) من الدستور. المحكمة الاتحادية العليا أيّدتها صراحةً في الطعن الإداري 447/2021.",
      relevantEvidence: "نص المادة (37) — حكم الطعن الإداري 447/2021 — المادة (19) الدستور — قرار التفويض 215/2024",
    },
    {
      category: "التناسب",
      question: "هل إيقاف المستشفى بالكامل لـ 90 يوماً متناسب مع المخالفات المُثبَتة؟",
      legalGrounding: "قد يُدّعى أن الإيقاف الكلي تجاوز حدّ التناسب الدستوري",
      preparedAnswer: "الاختبارات الثلاثة اجتازت: الهدف مشروع (المادة 19) — الإجراءات الأقل تدخلاً استُنفدت 3 مرات — الإيقاف الجزئي رُفض لتشابك المخالفات. مدة 90 يوماً أدنى مدة كافية للإصلاح الجوهري وفق فريق التفتيش.",
      relevantEvidence: "تقرير التفتيش — ملفات الإنذارات الثلاثة — محضر جلسة اللجنة — تقييم إمكانية التصحيح",
    },
    {
      category: "جودة الأدلة",
      question: "هل الأدلة المستند إليها بلغت مستوى الإثبات المطلوب لإصدار قرار الإيقاف؟",
      legalGrounding: "قد تُطعن في مصداقية الشهادات أو صحة الأدلة المادية",
      preparedAnswer: "السجل الإثباتي ثلاثي المستويات: (أ) أدلة مادية محرَّزة وفق إجراءات النيابة. (ب) تقارير 8 مفتشين رسمية. (ج) 12 شهادة موثقة بحضور مستشار قانوني. سلسلة الحيازة كاملة لجميع الأدلة المادية.",
      relevantEvidence: "محاضر التفتيش — وصولات الأدلة المحرَّزة — نماذج الشهادات — سجلات الأخطاء الدوائية",
    },
    {
      category: "الامتثال الإجرائي",
      question: "هل استُوفيت الإجراءات الشكلية الإلزامية؟ وهل أُتيح للمنشأة حق الدفاع المسبق؟",
      legalGrounding: "قد يُدّعى انتهاك مبدأ المواجهة وحق الدفاع",
      preparedAnswer: "الإجراءات مستوفاة: (أ) أُبلغت المنشأة بنتائج التفتيش وردّت كتابةً. (ب) ثلاثة إنذارات أتاحت كل الفرص للتصحيح. (ج) المادة (43) لا تُلزم بإجراء مسبق في حالات الخطر الفوري. (د) حق الطعن مكفول 30 يوماً.",
      relevantEvidence: "محاضر التفتيش الموقَّعة — ملفات الإنذارات — الرد الكتابي للمستشفى — المادة الخامسة من القرار",
    },
    {
      category: "الصلاحية الدستورية",
      question: "هل القرار ينتهك حماية حرية النشاط الاقتصادي المكفولة دستورياً؟",
      legalGrounding: "قد يُستند إلى حماية النشاط الاقتصادي المشروع من القيود الإدارية",
      preparedAnswer: "حماية النشاط الاقتصادي ليست مطلقة. المادة (19) تُقيِّد الحق الاقتصادي عند التعارض مع الصحة العامة. القيد مؤقت ومتناسب مع 6 تدابير تخفيف — ليس إلغاءً نهائياً. المحكمة الاتحادية أرست هذا المبدأ في سلسلة أحكام.",
      relevantEvidence: "المادتان (19) و(40) الدستور — أحكام المحكمة الاتحادية — التدابير التخفيفية الستة",
    },
    {
      category: "مساءلة الذكاء الاصطناعي",
      question: "كيف يمكن التحقق من أن الإنسان — لا الذكاء الاصطناعي — هو من اتخذ القرار فعلياً؟",
      legalGrounding: "قد يُطعن في مشروعية تفويض تحليل القرار لنظام آلي",
      preparedAnswer: "MARSAD دور استشاري تحليلي صرف. القرار موقَّع من د. خالد العامري شخصياً. لجنة 6 مسؤولين صوّتت بالإجماع. البشر أضافوا بنداً (ضمان رواتب الموظفين) لم يقترحه النظام. سجل MARSAD يُوثّق بدقة ما فعله النظام وما أقرّه الإنسان — مما يجعله أكثر شفافية من القرارات التقليدية غير الموثقة.",
      relevantEvidence: "سجل MARSAD الكامل — محضر جلسة اللجنة — نص القرار الموقَّع — بنود الإضافات البشرية",
    },
  ];

  const explainabilityReport = {
    overview: "قرار الإيقاف المؤقت وتعيين المدير المؤقت استجابة إدارية حتمية لخطر صحي فعلي وفوري، استُنفدت قبله جميع الإجراءات التحذيرية، وجاء بأدنى درجة التدخل الكافية.",
    decisionRationale: "خمسة اعتبارات جوهرية: (1) 27 مخالفة منها 9 جسيمة تمس سلامة المرضى مباشرةً. (2) فشل 3 إنذارات رسمية متتالية على 7 أشهر. (3) 3 وفيات محتملة الصلة بالإهمال الطبي قيد التحقيق. (4) 800 مريض في وضع خطر فعلي لا يسمح بالتأخير. (5) أدلة أولية على تزوير مؤهلات طاقم طبي.",
    alternativesConsidered: "أربعة بدائل واستُبعدت جميعها: الإنذار الرابع (3 تجارب فاشلة) — الإيقاف الجزئي (المخالفات متشابكة) — الإلغاء الفوري (مفرط) — التحويل الحكومي (انعدام السند).",
    impactAssessment: "المنشأة: إيقاف مؤقت 90 يوماً مع مسار إعادة ترخيص. الموظفون 240: رواتب مستمرة طوال الإيقاف. المرضى 800: حماية فورية مع استمرار الرعاية. القطاع الصحي: رسالة حازمة بأن معايير السلامة غير قابلة للتفاوض.",
    publicInterestJustification: "سلامة 800 مريض أعلى أولويات المصلحة الفورية. يُضاف: صون الثقة العامة في منظومة الصحة الوطنية، والردع التنظيمي الذي يحمي المرضى المستقبليين في جميع المنشآت.",
    minorityInterestConsiderations: "أصحاب المنشأة: حق الطعن مكفول 30 يوماً. الإيقاف مؤقت لا نهائي. الموظفون: رواتب مضمونة في المادة الرابعة. المرضى الراغبون في الانتقال: بروتوكول نقل آمن مدعوم.",
    conclusion: "قرار صحيح في التوقيت الصحيح. دستوري يصمد أمام أي مراجعة قضائية. يُمثّل نموذجاً لحوكمة الذكاء الاصطناعي المسؤولة.",
  };

  await db.insert(decisionJdpTable).values({
    decisionId: decision.id,
    status: "ready",
    generatedAt: TS.final_review,
    generatedBy: 1,
    generationDurationMs: 38_240,
    factualChronology,
    legalBasis,
    applicableLegislation,
    evidenceSummary,
    proportionalityAnalysis,
    discretionaryReasoning,
    aiParticipationExplanation,
    humanOversightRecord,
    constitutionalValidationResults,
    dciSummary,
    auditChain,
    versionHistoryRecord,
    anticipatedJudicialReviewQuestions,
    explainabilityReport,
    createdAt: TS.final_review,
    updatedAt: TS.final_review,
  });
  console.log("  ✓ 14 قسماً دستورياً مُكتملاً");

  // 5 — Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ✓  السيناريو التجريبي التنفيذي مكتمل بنجاح");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  القرار:              ${decision.caseNumber}`);
  console.log(`  المراحل المكتملة:   11 / 11`);
  console.log(`  الهوية الدستورية:   مختومة — ${completeAuditHash.substring(0, 20)}...`);
  console.log(`  حزمة الدفاع القضائي: جاهزة — 14 قسماً`);
  console.log(`  إطار الشامسي:       كامل — 94/100`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  افتح القرار الإداري الذكي وابحث عن MARSAD-2026-0147");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

seed().catch((err) => { console.error("خطأ:", err); process.exit(1); });
