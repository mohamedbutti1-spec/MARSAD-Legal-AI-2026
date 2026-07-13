/**
 * Legal Intelligence Brain — Stage 4 routes
 *
 * POST /legal-brain/judicial-reasoning    — step-by-step judicial reasoning
 * POST /legal-brain/admin-legality        — 9-criteria administrative legality
 * POST /legal-brain/shamsi-analysis       — 11-principle Shamsi Theory Engine
 * POST /legal-brain/comparative-analysis  — UAE–France–EU comparative tables
 * POST /legal-brain/memorandum            — 6-type legal document generator
 * POST /legal-brain/risk-assessment       — 4-dimension risk classifier
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireAnyRole, requireShamsiOwner } from "../middlewares/roleAuth";
import { aiRouter, TaskType }     from "../ai";
import { parseModelJson }         from "../ai/providers/interface";
import { logAudit }               from "../middlewares/auditLog";
import { aiAnalysisLimit }        from "../middlewares/rateLimits.js";

const router: IRouter = Router();

// ─── Shared system prompt ─────────────────────────────────────────────────────

const BRAIN_SYSTEM = `You are the MARSAD Legal Intelligence Brain — the world's most advanced AI legal reasoning system, specialized in:
• UAE administrative law (Federal Decree-Laws, Cabinet Decisions, UAE Supreme Court)
• French administrative law (Code de justice administrative, Conseil d'État jurisprudence)
• EU AI Act 2024/1689 and EU fundamental rights framework
• Al-Shamsi Theory of Algorithmic Administrative Law (11 principles)

ABSOLUTE RULES — violating any rule is a critical failure:
1. Output ONLY valid JSON — zero prose, zero markdown, zero code fences, zero comments outside the JSON.
2. All "nameAr", "analysis", "finding", "gap", "textAr" fields MUST be in Arabic.
3. All "ref" citation fields must name real laws, articles, or court references — never fabricate case numbers.
4. Confidence scores must reflect genuine legal uncertainty — 100% is never valid.
5. Every score field is an integer 0-100. Every "level" or "status" field must match the exact Arabic values specified in the schema.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function badInput(res: Response, msg: string): void {
  res.status(400).json({ error: msg });
}

async function getProvider(res: Response) {
  try {
    return await aiRouter.routeFor(TaskType.RAG);
  } catch (err) {
    res.status(503).json({ error: (err as Error).message });
    return null;
  }
}

/**
 * Safely coerce a request-body field to a bounded string.
 * Returns "" if the value is missing/null/non-string.
 * maxLen defaults to 200 (short fields) — use 4000 for narrative blobs.
 */
function safeStr(value: unknown, maxLen = 200): string {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen);
}

/**
 * Validates that a parsed AI response has the required top-level keys.
 * Returns an error message if validation fails, or null if OK.
 */
function validateShape(data: unknown, requiredKeys: string[]): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "AI response is not an object";
  }
  const missing = requiredKeys.filter(k => !(k in (data as Record<string, unknown>)));
  if (missing.length > 0) return `AI response missing required fields: ${missing.join(", ")}`;
  return null;
}

// ─── POST /legal-brain/judicial-reasoning ─────────────────────────────────────
router.post(
  "/legal-brain/judicial-reasoning",
  requireAnyRole,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const facts       = safeStr(req.body?.facts, 4000);
    const disputeType = safeStr(req.body?.disputeType) || "غير محدد";
    const jurisdiction = safeStr(req.body?.jurisdiction) || "الإمارات العربية المتحدة";
    if (!facts.trim()) { badInput(res, "facts are required"); return; }

    const provider = await getProvider(res);
    if (!provider) return;

    const prompt = `حلِّل النزاع القانوني التالي تحليلاً قضائياً خطوةً بخطوة.
نوع النزاع: ${disputeType}
الولاية القضائية: ${jurisdiction}

الوقائع:
${facts}

أخرج JSON بهذا الهيكل بالضبط (لا تغيّر مفاتيح الـ JSON):
{
  "jurisdiction": "string — المحكمة المختصة المقترحة",
  "stages": [
    {
      "id": "string",
      "nameAr": "string",
      "analysis": "string — تحليل تفصيلي فقرة أو أكثر",
      "finding": "string — خلاصة هذه المرحلة",
      "legalBasis": ["string — نص قانوني أو سابقة قضائية"]
    }
  ],
  "ruling": "string — الحكم القضائي المقترح كاملاً",
  "rulingType": "قبول | رفض | قبول جزئي | إحالة | إعادة تقييم",
  "confidence": 0,
  "legalRisk": "منخفض | متوسط | مرتفع | حرج",
  "explainability": {
    "why": "string — لماذا هذا الحكم تحديداً",
    "whyNot": "string — لماذا لم يكن الحكم مختلفاً",
    "legalBasis": "string — الأساس القانوني الجوهري",
    "counterArguments": ["string"],
    "alternativeViews": ["string"]
  },
  "citations": [
    { "type": "legislation | case | doctrine | treaty", "ref": "string", "textAr": "string" }
  ],
  "appealProbability": 0,
  "recommendations": ["string"]
}

المراحل المطلوبة — أنشئ كائناً لكل مرحلة:
1. الاختصاص القضائي (competence)
2. قبول الدعوى — الأهلية · الصفة · المصلحة · الميعاد (admissibility)
3. الوقائع الثابتة (facts)
4. القانون الواجب التطبيق (applicable_law)
5. الاستدلال القضائي المنطقي (reasoning)
6. الحجج المضادة (counter_arguments)
7. الحكم النهائي المقترح (ruling)`;

    try {
      const result = await provider.complete({ taskType: TaskType.RAG, prompt, systemPrompt: BRAIN_SYSTEM, maxTokens: 6000, temperature: 0.2 });
      const parsed = parseModelJson(result.text);
      if (!parsed.ok) { res.status(422).json({ error: "AI output parse failed", raw: result.text.slice(0, 500) }); return; }
      const shapeErr = validateShape(parsed.data, ["jurisdiction", "stages", "ruling", "rulingType", "confidence"]);
      if (shapeErr) { res.status(422).json({ error: shapeErr }); return; }
      await logAudit(req, "legal-brain.judicial-reasoning", {});
      res.json({ result: parsed.data, model: result.model });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── POST /legal-brain/admin-legality ─────────────────────────────────────────
router.post(
  "/legal-brain/admin-legality",
  requireAnyRole,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const decisionText     = safeStr(req.body?.decisionText, 4000);
    const decisionType     = safeStr(req.body?.decisionType) || "غير محدد";
    const issuingAuthority = safeStr(req.body?.issuingAuthority) || "غير محددة";
    const decisionDate     = safeStr(req.body?.decisionDate) || "غير محدد";
    if (!decisionText.trim()) { badInput(res, "decisionText is required"); return; }

    const provider = await getProvider(res);
    if (!provider) return;

    const prompt = `قيّم مشروعية القرار الإداري التالي وفق الأركان التسعة للمشروعية الإدارية المعاصرة.
نوع القرار: ${decisionType}
الجهة المصدِرة: ${issuingAuthority}
تاريخ القرار: ${decisionDate}

نص القرار / وقائعه:
${decisionText}

أخرج JSON بهذا الهيكل بالضبط:
{
  "criteria": [
    {
      "id": "competence",
      "nameAr": "ركن الاختصاص",
      "status": "سليم | معيب | باطل",
      "score": 0,
      "analysis": "string — تحليل تفصيلي",
      "legalBasis": "string — المرجع القانوني",
      "gap": "string | null"
    },
    { "id": "form", "nameAr": "ركن الشكل والإجراءات", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null },
    { "id": "cause", "nameAr": "ركن السبب", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null },
    { "id": "subject", "nameAr": "ركن المحل", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null },
    { "id": "purpose", "nameAr": "ركن الغاية", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null },
    { "id": "proportionality", "nameAr": "مبدأ التناسب", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null },
    { "id": "procedural_fairness", "nameAr": "العدالة الإجرائية", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null },
    { "id": "transparency", "nameAr": "مبدأ الشفافية", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null },
    { "id": "human_oversight", "nameAr": "الرقابة البشرية", "status": "...", "score": 0, "analysis": "...", "legalBasis": "...", "gap": null }
  ],
  "overallValidity": "صحيح | قابل للإبطال | باطل",
  "legalityScore": 0,
  "annulmentGrounds": ["string"],
  "recommendations": ["string"],
  "confidence": 0,
  "explainability": {
    "why": "string",
    "whyNot": "string",
    "legalBasis": "string",
    "counterArguments": ["string"],
    "alternativeViews": ["string"]
  },
  "citations": [{ "type": "legislation | case | doctrine", "ref": "string", "textAr": "string" }]
}

ملاحظة: يجب إنشاء جميع الأركان التسعة في المصفوفة criteria مع تحليل حقيقي لكل ركن.`;

    try {
      const result = await provider.complete({ taskType: TaskType.RAG, prompt, systemPrompt: BRAIN_SYSTEM, maxTokens: 5500, temperature: 0.2 });
      const parsed = parseModelJson(result.text);
      if (!parsed.ok) { res.status(422).json({ error: "AI output parse failed", raw: result.text.slice(0, 500) }); return; }
      const shapeErr = validateShape(parsed.data, ["criteria", "overallValidity", "legalityScore"]);
      if (shapeErr) { res.status(422).json({ error: shapeErr }); return; }
      await logAudit(req, "legal-brain.admin-legality", {});
      res.json({ result: parsed.data, model: result.model });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── POST /legal-brain/shamsi-analysis ────────────────────────────────────────
router.post(
  "/legal-brain/shamsi-analysis",
  requireShamsiOwner,
  requireAnyRole,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const scenarioText  = safeStr(req.body?.scenarioText, 4000);
    const systemType    = safeStr(req.body?.systemType) || "نظام ذكاء اصطناعي";
    const decisionDomain = safeStr(req.body?.decisionDomain) || "غير محدد";
    if (!scenarioText.trim()) { badInput(res, "scenarioText is required"); return; }

    const provider = await getProvider(res);
    if (!provider) return;

    const prompt = `طبِّق نظرية الشامسي للقانون الإداري الخوارزمي على السيناريو التالي.
نوع النظام: ${systemType}
مجال القرار: ${decisionDomain}

السيناريو:
${scenarioText}

قيّم كل مبدأ من المبادئ الأحد عشر لنظرية الشامسي كوحدة تحليلية مستقلة مع نسبة امتثال.
أخرج JSON بهذا الهيكل بالضبط:
{
  "principles": [
    {
      "id": "human_will",
      "nameAr": "تكوين الإرادة البشرية",
      "score": 0,
      "status": "ممتثل | ممتثل جزئياً | غير ممتثل",
      "analysis": "string — تحليل تفصيلي على الأقل ثلاثة أسطر",
      "gaps": ["string — ثغرة محددة"],
      "recommendations": ["string — توصية عملية"]
    },
    { "id": "digital_will",       "nameAr": "تكوين الإرادة الرقمية",       "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "algo_weight",        "nameAr": "الوزن القانوني الخوارزمي",     "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "explainability",     "nameAr": "قابلية التفسير الخوارزمي",     "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "legitimate_bias",    "nameAr": "الانحياز الخوارزمي المشروع",   "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "graded_compliance",  "nameAr": "الامتثال المتدرج",              "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "human_supervision",  "nameAr": "الرقابة البشرية الفاعلة",      "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "procedural",         "nameAr": "الضمانات الإجرائية",            "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "accountability",     "nameAr": "المساءلة والمسؤولية",           "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "judicial_review",    "nameAr": "المراجعة القضائية",              "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] },
    { "id": "final_legality",     "nameAr": "مشروعية الخوارزمية الكلية",    "score": 0, "status": "...", "analysis": "...", "gaps": [], "recommendations": [] }
  ],
  "overallScore": 0,
  "complianceLevel": "عالٍ | متوسط | منخفض | حرج",
  "criticalGaps": ["string"],
  "recommendations": ["string"],
  "confidence": 0,
  "explainability": {
    "why": "string",
    "whyNot": "string",
    "legalBasis": "string",
    "counterArguments": ["string"],
    "alternativeViews": ["string"]
  }
}

يجب أن تحتوي مصفوفة principles على جميع المبادئ الأحد عشر بالترتيب.`;

    try {
      const result = await provider.complete({ taskType: TaskType.RAG, prompt, systemPrompt: BRAIN_SYSTEM, maxTokens: 7000, temperature: 0.2 });
      const parsed = parseModelJson(result.text);
      if (!parsed.ok) { res.status(422).json({ error: "AI output parse failed", raw: result.text.slice(0, 500) }); return; }
      const shapeErr = validateShape(parsed.data, ["principles", "overallScore", "complianceLevel"]);
      if (shapeErr) { res.status(422).json({ error: shapeErr }); return; }
      await logAudit(req, "legal-brain.shamsi-analysis", {});
      res.json({ result: parsed.data, model: result.model });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── POST /legal-brain/comparative-analysis ───────────────────────────────────
router.post(
  "/legal-brain/comparative-analysis",
  requireAnyRole,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const topic          = safeStr(req.body?.topic);
    const context        = safeStr(req.body?.context, 1000) || "لا يوجد";
    const includeEuAiAct = req.body?.includeEuAiAct === true;
    if (!topic.trim()) { badInput(res, "topic is required"); return; }

    const provider = await getProvider(res);
    if (!provider) return;

    const prompt = `قارن بين التشريع الإماراتي والتشريع الفرنسي${includeEuAiAct ? " وقانون الذكاء الاصطناعي الأوروبي (EU AI Act 2024/1689)" : ""} في الموضوع التالي.

الموضوع القانوني: ${topic}
السياق الإضافي: ${context}

أنشئ جدول مقارنة شامل مع تحليل أوجه التقارب والاختلاف.
أخرج JSON بهذا الهيكل بالضبط:
{
  "topic": "string",
  "rows": [
    {
      "aspect": "string — وجه المقارنة",
      "uae": "string — الموقف الإماراتي مع المصدر التشريعي",
      "france": "string — الموقف الفرنسي مع المصدر التشريعي",
      "eu": "string | null — موقف الاتحاد الأوروبي أو قانون الذكاء الاصطناعي",
      "similarity": "تطابق | تقارب | اختلاف جوهري | تعارض",
      "notes": "string — ملاحظة مقارنة"
    }
  ],
  "keyDifferences": ["string — فرق جوهري"],
  "convergenceAreas": ["string — نقطة تقارب"],
  "uaeLegalOrigins": "string — الأصول الفرنسية في القانون الإماراتي ذات الصلة",
  "practicalImplications": "string — التداعيات العملية للممارس القانوني",
  "recommendedApproach": "string — الموقف الموصى به",
  "confidence": 0,
  "citations": [
    { "system": "UAE | France | EU", "ref": "string", "textAr": "string" }
  ]
}

وجوه المقارنة المطلوبة (يجب تضمين جميعها):
1. التعريف القانوني والنطاق
2. شروط المشروعية والصحة
3. حقوق المتأثر وضماناته
4. الرقابة القضائية
5. المسؤولية والتعويض
6. الجزاءات والآثار
7. التطورات التشريعية الحديثة`;

    try {
      const result = await provider.complete({ taskType: TaskType.RAG, prompt, systemPrompt: BRAIN_SYSTEM, maxTokens: 6000, temperature: 0.3 });
      const parsed = parseModelJson(result.text);
      if (!parsed.ok) { res.status(422).json({ error: "AI output parse failed", raw: result.text.slice(0, 500) }); return; }
      const shapeErr = validateShape(parsed.data, ["topic", "rows", "keyDifferences", "confidence"]);
      if (shapeErr) { res.status(422).json({ error: shapeErr }); return; }
      await logAudit(req, "legal-brain.comparative-analysis", {});
      res.json({ result: parsed.data, model: result.model });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── POST /legal-brain/memorandum ─────────────────────────────────────────────
const MEMO_LABELS: Record<string, string> = {
  legal_opinion:      "رأي قانوني",
  court_memorandum:   "مذكرة استئناف قضائية",
  admin_appeal:       "تظلم إداري",
  defence_memorandum: "مذكرة دفاع",
  draft_judgment:     "مسودة حكم قضائي",
  draft_legislation:  "مسودة تشريع",
};

router.post(
  "/legal-brain/memorandum",
  requireAnyRole,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const docType       = safeStr(req.body?.docType);
    const briefText     = safeStr(req.body?.briefText, 4000);
    const partyName     = safeStr(req.body?.partyName);
    const opposingParty = safeStr(req.body?.opposingParty);
    const caseReference = safeStr(req.body?.caseReference);
    if (!briefText.trim()) { badInput(res, "briefText is required"); return; }
    if (!docType || !MEMO_LABELS[docType]) {
      badInput(res, `docType must be one of: ${Object.keys(MEMO_LABELS).join(", ")}`);
      return;
    }

    const provider = await getProvider(res);
    if (!provider) return;

    const prompt = `أنشئ ${MEMO_LABELS[docType]} احترافياً كاملاً استناداً إلى المعطيات التالية.
${partyName ? `الطرف الأول: ${partyName}` : ""}
${opposingParty ? `الطرف المقابل: ${opposingParty}` : ""}
${caseReference ? `المرجع / رقم القضية: ${caseReference}` : ""}

الوقائع والمعطيات:
${briefText}

أخرج JSON بهذا الهيكل بالضبط:
{
  "docType": "${docType}",
  "docTypeAr": "${MEMO_LABELS[docType]}",
  "title": "string — عنوان المستند الكامل",
  "date": "string — التاريخ هجرياً وميلادياً",
  "sections": [
    { "heading": "string — عنوان القسم", "content": "string — محتوى تفصيلي جوهري" }
  ],
  "conclusion": "string — الخلاصة والطلبات النهائية",
  "legalBases": ["string — نص قانوني أو مادة"],
  "citations": [{ "type": "legislation | case | doctrine", "ref": "string", "textAr": "string" }],
  "confidence": 0,
  "strengthAssessment": "string — تقييم قوة الحجج القانونية",
  "risks": ["string — مخاطر قانونية محتملة"]
}

اجعل المحتوى احترافياً واستشارياً بمستوى محامٍ خبير.`;

    try {
      const result = await provider.complete({ taskType: TaskType.RAG, prompt, systemPrompt: BRAIN_SYSTEM, maxTokens: 6000, temperature: 0.3 });
      const parsed = parseModelJson(result.text);
      if (!parsed.ok) { res.status(422).json({ error: "AI output parse failed", raw: result.text.slice(0, 500) }); return; }
      const shapeErr = validateShape(parsed.data, ["docType", "title", "sections", "conclusion"]);
      if (shapeErr) { res.status(422).json({ error: shapeErr }); return; }
      await logAudit(req, "legal-brain.memorandum", {});
      res.json({ result: parsed.data, model: result.model });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── POST /legal-brain/risk-assessment ────────────────────────────────────────
router.post(
  "/legal-brain/risk-assessment",
  requireAnyRole,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const scenarioText = safeStr(req.body?.scenarioText, 4000);
    const systemType   = safeStr(req.body?.systemType) || "غير محدد";
    const decisionType = safeStr(req.body?.decisionType) || "غير محدد";
    if (!scenarioText.trim()) { badInput(res, "scenarioText is required"); return; }

    const provider = await getProvider(res);
    if (!provider) return;

    const prompt = `قيّم المخاطر القانونية الشاملة للسيناريو التالي عبر الأبعاد الأربعة.
نوع النظام / الإجراء: ${systemType}
نوع القرار: ${decisionType}

السيناريو:
${scenarioText}

أخرج JSON بهذا الهيكل بالضبط:
{
  "legalRisk": {
    "level": "حرج | مرتفع | متوسط | منخفض",
    "score": 0,
    "factors": ["string — عامل خطر محدد"],
    "mitigations": ["string — إجراء تخفيفي عملي"]
  },
  "proceduralRisk": {
    "level": "حرج | مرتفع | متوسط | منخفض",
    "score": 0,
    "factors": ["string"],
    "mitigations": ["string"]
  },
  "constitutionalRisk": {
    "level": "حرج | مرتفع | متوسط | منخفض",
    "score": 0,
    "factors": ["string"],
    "mitigations": ["string"]
  },
  "aiRisk": {
    "level": "حرج | مرتفع | متوسط | منخفض",
    "score": 0,
    "factors": ["string"],
    "mitigations": ["string"]
  },
  "overallRisk": "حرج | مرتفع | متوسط | منخفض",
  "overallScore": 0,
  "confidence": 0,
  "urgentActions": ["string — إجراء عاجل يجب اتخاذه خلال 48 ساعة"],
  "explainability": {
    "why": "string",
    "whyNot": "string",
    "legalBasis": "string",
    "counterArguments": ["string"],
    "alternativeViews": ["string"]
  },
  "citations": [{ "type": "string", "ref": "string", "textAr": "string" }]
}`;

    try {
      const result = await provider.complete({ taskType: TaskType.RAG, prompt, systemPrompt: BRAIN_SYSTEM, maxTokens: 5000, temperature: 0.2 });
      const parsed = parseModelJson(result.text);
      if (!parsed.ok) { res.status(422).json({ error: "AI output parse failed", raw: result.text.slice(0, 500) }); return; }
      const shapeErr = validateShape(parsed.data, ["legalRisk", "proceduralRisk", "overallRisk", "overallScore"]);
      if (shapeErr) { res.status(422).json({ error: shapeErr }); return; }
      await logAudit(req, "legal-brain.risk-assessment", {});
      res.json({ result: parsed.data, model: result.model });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

export default router;
