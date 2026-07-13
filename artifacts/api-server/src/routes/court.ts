/**
 * Stage 5 — Smart Administrative Court Simulation
 *
 * POST /court/simulate       — Full 10-section NDJSON streaming court session
 * POST /court/supreme-review — Layered 7-tier supreme court analysis (JSON)
 *
 * Streaming format (court/simulate):
 *   {"type":"section","id":"facts",       "data":{...}}
 *   {"type":"section","id":"issues",      "data":{...}}
 *   {"type":"section","id":"claimant",    "data":[...]}
 *   {"type":"section","id":"admin",       "data":[...]}
 *   {"type":"section","id":"commissioner","data":{...}}
 *   {"type":"section","id":"shamsi",      "data":[...]}  ← Project B: includes status/evidence/humanOversightNote
 *   {"type":"section","id":"judgment",    "data":{...}}
 *   {"type":"section","id":"operative",   "data":{...}}
 *   {"type":"section","id":"appeal",      "data":{...}}
 *   {"type":"section","id":"scores",      "data":{...}}
 *   {"type":"section","id":"asep",        "data":{...}}  ← Project A: ASEP explainability report
 *   {"type":"component_failed","component":"shamsi"|"asep"}  ← emitted when a mandatory component fails
 *   {"type":"done","model":"...","complete":true|false,"failedComponents":string[]}
 *
 * ARCHITECTURAL LOCK: ASEP and Al-Shamsi Matrix are mandatory.
 * If either fails, complete=false and the judgment is considered incomplete.
 */

import { Router, type IRouter, type Response } from "express";
import { requireShamsiOwner }  from "../middlewares/roleAuth";
import { aiRouter, TaskType }  from "../ai";
import { parseModelJson }      from "../ai/providers/interface";
import { logAudit }            from "../middlewares/auditLog";
import { aiAnalysisLimit }     from "../middlewares/rateLimits.js";

const router: IRouter = Router();

// ─── Shared system prompt ─────────────────────────────────────────────────────

const COURT_SYSTEM = `You are the MARSAD Smart Administrative Court Engine — the world's most advanced AI administrative court simulation system.

You apply:
• UAE Federal Decree-Law No. 40/2023 on Administrative Procedures
• Al-Shamsi Theory of Algorithmic Administrative Law (11 principles)
• French Conseil d'État jurisprudence & Code de justice administrative
• EU AI Act 2024/1689 and fundamental rights framework

ABSOLUTE RULES:
1. Output ONLY valid JSON — zero prose, zero markdown, zero code fences.
2. All Arabic-label fields (summary, argument, reason, ruling, etc.) MUST be written in Arabic.
3. Citation "ref" fields must name real laws or real court references — never fabricate case numbers.
4. All score fields are integers 0–100. Status values must match the exact Arabic strings specified.
5. Never output 100% confidence — reflect genuine legal uncertainty.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStr(value: unknown, maxLen = 200): string {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen);
}

function validateShape(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "AI response is not an object";
  const missing = keys.filter((k) => !(k in (data as Record<string, unknown>)));
  return missing.length ? `AI response missing: ${missing.join(", ")}` : null;
}

async function getProvider(res: Response) {
  try { return await aiRouter.routeFor(TaskType.RAG); }
  catch (err) { res.status(503).json({ error: (err as Error).message }); return null; }
}

function writeLine(res: Response, obj: unknown): void {
  res.write(JSON.stringify(obj) + "\n");
}

// ── Architectural Lock Validation ─────────────────────────────────────────────

/** All 11 canonical Shamsi principle IDs — every session must contain all of them. */
const SHAMSI_REQUIRED_IDS: ReadonlySet<string> = new Set([
  "human_will", "digital_will", "algo_weight", "explainability",
  "legitimate_bias", "graded_compliance", "human_supervision",
  "procedural", "accountability", "judicial_review", "final_legality",
]);

const SHAMSI_VALID_STATUSES = new Set(["مُستوفى", "جزئي", "مخفق"]);

/**
 * Validates the Al-Shamsi Matrix structural contract.
 * Requires: exactly the 11 canonical principle IDs, each with
 * status ∈ {مُستوفى, جزئي, مخفق}, non-empty evidence, and humanOversightNote.
 */
function validateShamsiMatrix(shamsi: unknown): shamsi is unknown[] {
  if (!Array.isArray(shamsi) || shamsi.length < 11) return false;

  // All 11 canonical IDs must be present
  const ids = new Set((shamsi as Array<Record<string, unknown>>).map((p) => p.id as string));
  for (const required of SHAMSI_REQUIRED_IDS) {
    if (!ids.has(required)) return false;
  }

  // Each principle must have the required structured fields
  return (shamsi as Array<Record<string, unknown>>).every((p) =>
    typeof p.id === "string" &&
    typeof p.status === "string" &&
    SHAMSI_VALID_STATUSES.has(p.status) &&
    typeof p.evidence === "string" && p.evidence.trim().length > 0 &&
    typeof p.humanOversightNote === "string" && p.humanOversightNote.trim().length > 0
  );
}

/**
 * Validates the ASEP (Al-Shamsi Explainability Protocol) structural contract.
 * Requires: 10 answers, overallExplainability (number), conclusion (string),
 * each answer with question/answer strings and numeric confidence.
 */
function validateAsepReport(asep: unknown): boolean {
  if (!asep || typeof asep !== "object" || Array.isArray(asep)) return false;
  const report = asep as Record<string, unknown>;
  if (!Array.isArray(report.answers) || report.answers.length < 10) return false;
  if (typeof report.overallExplainability !== "number") return false;
  if (typeof report.conclusion !== "string" || report.conclusion.trim().length === 0) return false;
  return (report.answers as Array<Record<string, unknown>>).every((a) =>
    typeof a.question === "string" &&
    typeof a.answer === "string" && a.answer.trim().length > 0 &&
    typeof a.confidence === "number"
  );
}

/**
 * Terminates a streaming session that encountered an early unrecoverable error.
 * ALWAYS emits a terminal done event so clients can finalize their state machine.
 */
function terminalExit(
  res: Response,
  message: string,
  model: string,
  shamsiOk: boolean,
  asepOk: boolean,
): void {
  writeLine(res, { type: "error", message });
  const failedComponents = [
    ...(!shamsiOk ? ["shamsi"] : []),
    ...(!asepOk   ? ["asep"]   : []),
  ];
  writeLine(res, { type: "done", model, complete: false, failedComponents });
  res.end();
}

// ─── POST /court/simulate ─────────────────────────────────────────────────────

router.post(
  "/court/simulate",
  requireShamsiOwner,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const caseText = safeStr(req.body?.caseText, 5000);
    if (!caseText.trim()) { res.status(400).json({ error: "caseText is required" }); return; }

    const provider = await getProvider(res);
    if (!provider) return;

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    let model = "";
    // Capture data for Phase 5 ASEP
    let capturedFacts    = '';
    let capturedIssues   = '';
    let capturedShamsi   = '';
    let capturedJudgment = '';
    // ARCHITECTURAL LOCK — mandatory component tracking
    let shamsiOk = false;
    let asepOk   = false;

    // ── Phase 1: Facts + Issues ───────────────────────────────────────────────
    try {
      const r1 = await provider.complete({
        taskType: TaskType.RAG, systemPrompt: COURT_SYSTEM, maxTokens: 3500, temperature: 0.2,
        prompt: `أنت محكمة إدارية. حلّل هذه القضية وأخرج JSON بمفتاحين فقط: "facts" و"issues".

القضية:
${caseText}

{
  "facts": {
    "summary": "string — ملخص الوقائع",
    "disputedDecision": "string — القرار محل النزاع",
    "parties": [{"role": "string — الدور القانوني", "name": "string — الاسم أو الوصف"}],
    "requests": ["string — الطلب القضائي"]
  },
  "issues": {
    "jurisdiction": "string — تحليل الاختصاص",
    "form": "string — تحليل الشكل والإجراءات",
    "cause": "string — تحليل ركن السبب",
    "subject": "string — تحليل ركن المحل",
    "purpose": "string — تحليل ركن الغاية",
    "proportionality": "string — مبدأ التناسب",
    "transparency": "string — مبدأ الشفافية",
    "humanOversight": "string — الرقابة البشرية",
    "algorithmicEffect": "string | null"
  }
}`,
      });
      model = r1.model;
      const p1 = parseModelJson(r1.text);
      if (!p1.ok || !p1.data || typeof p1.data !== "object") {
        writeLine(res, { type: "error", message: "Phase 1 (facts/issues) parse failed" }); res.end(); return;
      }
      const d1 = p1.data as Record<string, unknown>;
      if (d1.facts)  { writeLine(res, { type: "section", id: "facts",  data: d1.facts });  capturedFacts  = JSON.stringify(d1.facts).slice(0, 1500); }
      if (d1.issues) { writeLine(res, { type: "section", id: "issues", data: d1.issues }); capturedIssues = JSON.stringify(d1.issues).slice(0, 1500); }
    } catch (e) {
      // Phase 1 failure: no mandatory components can succeed — mark both failed
      terminalExit(res, (e as Error).message, model, false, false); return;
    }

    // ── Phase 2: Claimant + Admin Defenses ───────────────────────────────────
    try {
      const r2 = await provider.complete({
        taskType: TaskType.RAG, systemPrompt: COURT_SYSTEM, maxTokens: 5500, temperature: 0.25,
        prompt: `بناءً على القضية التالية، أنشئ دفوع الطرفين كـ JSON بمفتاحين: "claimant" (مصفوفة) و"admin" (مصفوفة). أبقِ كل حجة موجزة (3-4 جمل كحد أقصى).

القضية:
${caseText}

{
  "claimant": [
    {"ground": "أوجه عدم المشروعية",        "argument": "string", "strength": "قوي | متوسط | ضعيف"},
    {"ground": "عيب السبب",                 "argument": "string", "strength": "..."},
    {"ground": "عيب الشكل",                 "argument": "string", "strength": "..."},
    {"ground": "عيب إساءة استعمال السلطة",   "argument": "string", "strength": "..."},
    {"ground": "غياب الشفافية",              "argument": "string", "strength": "..."},
    {"ground": "الإخلال بحق الدفاع",         "argument": "string", "strength": "..."},
    {"ground": "الخلل الخوارزمي",            "argument": "string", "strength": "..."}
  ],
  "admin": [
    {"ground": "سلامة الاختصاص",             "argument": "string", "strength": "قوي | متوسط | ضعيف"},
    {"ground": "صحة الإجراءات",              "argument": "string", "strength": "..."},
    {"ground": "مشروعية السبب",              "argument": "string", "strength": "..."},
    {"ground": "تناسب القرار",               "argument": "string", "strength": "..."},
    {"ground": "وجود رقابة بشرية",           "argument": "string", "strength": "..."},
    {"ground": "حدود الإفصاح الخوارزمي",     "argument": "string", "strength": "..."},
    {"ground": "حماية المصلحة العامة",        "argument": "string", "strength": "..."}
  ]
}`,
      });
      const p2 = parseModelJson(r2.text);
      if (!p2.ok || !p2.data || typeof p2.data !== "object") {
        writeLine(res, { type: "error", message: "Phase 2 (defenses) parse failed" }); res.end(); return;
      }
      const d2 = p2.data as Record<string, unknown>;
      if (Array.isArray(d2.claimant)) writeLine(res, { type: "section", id: "claimant", data: d2.claimant });
      if (Array.isArray(d2.admin))    writeLine(res, { type: "section", id: "admin",    data: d2.admin });
    } catch (e) {
      // Phase 2 failure: shamsi/asep still pending — mark both failed
      terminalExit(res, (e as Error).message, model, false, false); return;
    }

    // ── Phase 3: Commissioner Report + Shamsi Analysis ───────────────────────
    try {
      const r3 = await provider.complete({
        taskType: TaskType.RAG, systemPrompt: COURT_SYSTEM, maxTokens: 10000, temperature: 0.2,
        prompt: `أنت مفوّض الدولة ومحلّل نظرية الشامسي. حلّل هذه القضية:

${caseText}

أخرج JSON بمفتاحين: "commissioner" و"shamsi" (11 مبادئ):
{
  "commissioner": {
    "facts": "string — عرض الوقائع",
    "applicableLaw": "string — القانون الواجب التطبيق",
    "defenseAnalysis": "string — تحليل الدفوع",
    "legalOpinion": "string — الرأي القانوني",
    "recommendation": "قبول | رفض | قبول جزئي"
  },
  "shamsi": [
    {"id":"human_will",       "nameAr":"تكوين الإرادة البشرية",       "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string — الأدلة المستند إليها","humanOversightNote":"string — دور الرقابة البشرية","legalRisk":"string","recommendation":"string"},
    {"id":"digital_will",     "nameAr":"تكوين الإرادة الرقمية",       "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"algo_weight",      "nameAr":"الوزن القانوني الخوارزمي",     "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"explainability",   "nameAr":"قابلية التفسير الخوارزمي",     "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"legitimate_bias",  "nameAr":"الانحياز الخوارزمي المشروع",   "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"graded_compliance","nameAr":"الامتثال المتدرج",              "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"human_supervision","nameAr":"الرقابة البشرية الفاعلة",      "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"procedural",       "nameAr":"الضمانات الإجرائية",            "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"accountability",   "nameAr":"المساءلة والمسؤولية",           "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"judicial_review",  "nameAr":"المراجعة القضائية",              "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"},
    {"id":"final_legality",   "nameAr":"مشروعية الخوارزمية الكلية",    "score":0,"status":"مُستوفى | جزئي | مخفق","reason":"string","evidence":"string","humanOversightNote":"string","legalRisk":"string","recommendation":"string"}
  ]
}`,
      });
      const p3 = parseModelJson(r3.text);
      if (!p3.ok || !p3.data || typeof p3.data !== "object") {
        // Commissioner/Shamsi parse failed — emit component_failed for shamsi then continue to Phase 4/5
        writeLine(res, { type: "error", message: "Phase 3 (commissioner/shamsi) parse failed" });
        writeLine(res, { type: "component_failed", component: "shamsi", reason: "Phase 3 JSON parse failed" });
        // shamsiOk stays false; continue — ASEP may still succeed
      } else {
        const d3 = p3.data as Record<string, unknown>;
        if (d3.commissioner && typeof d3.commissioner === "object") writeLine(res, { type: "section", id: "commissioner", data: d3.commissioner });

        // ARCHITECTURAL LOCK: validate full Shamsi contract (11 IDs, required fields)
        if (validateShamsiMatrix(d3.shamsi)) {
          writeLine(res, { type: "section", id: "shamsi", data: d3.shamsi });
          capturedShamsi = JSON.stringify(d3.shamsi).slice(0, 2000);
          shamsiOk = true;
        } else {
          const shamsiLen = Array.isArray(d3.shamsi) ? (d3.shamsi as unknown[]).length : 0;
          writeLine(res, {
            type: "component_failed",
            component: "shamsi",
            reason: `Shamsi matrix failed structural validation (got ${shamsiLen} principles, need 11 with required fields)`,
          });
          // Emit whatever we have so the frontend can show partial data
          if (Array.isArray(d3.shamsi) && d3.shamsi.length > 0) {
            writeLine(res, { type: "section", id: "shamsi", data: d3.shamsi });
          }
        }
      }
    } catch (e) {
      writeLine(res, { type: "error", message: (e as Error).message });
      writeLine(res, { type: "component_failed", component: "shamsi", reason: (e as Error).message });
      // Continue to Phase 4/5 — do not terminate early
    }

    // ── Phase 4: Judgment + Operative + Appeal + Scores ──────────────────────
    try {
      const r4 = await provider.complete({
        taskType: TaskType.RAG, systemPrompt: COURT_SYSTEM, maxTokens: 4500, temperature: 0.2,
        prompt: `أصدر الحكم الكامل في هذه القضية الإدارية:

${caseText}

أخرج JSON بأربعة مفاتيح: "judgment", "operative", "appeal", "scores":
{
  "judgment": {
    "preamble": "string — باسم العدالة / بعد الاطلاع على الأوراق",
    "facts": "string — حيث إن الوقائع تتحصل في",
    "courtView": "string — وحيث إن المحكمة ترى",
    "established": "string — وحيث إن الثابت",
    "challenged": "string — وحيث إن القرار محل الطعن",
    "ruling": "string — لذلك حكمت المحكمة"
  },
  "operative": {
    "decision": "قبول | رفض | قبول جزئي",
    "cancellation": "إلغاء القرار | تأييد القرار | تعديل القرار",
    "effect": "string — أثر الحكم",
    "adminObligation": "string | null",
    "reformRecommendations": ["string"]
  },
  "appeal": {
    "isAppealable": true,
    "successChance": 0,
    "strongestGrounds": ["string"],
    "weakestPoints": ["string"]
  },
  "scores": {
    "legality": 0,
    "transparency": 0,
    "algorithmicExplainability": 0,
    "humanOversight": 0,
    "judicialRisk": 0,
    "annulmentProbability": 0,
    "shamsiIndex": 0
  }
}`,
      });
      const p4 = parseModelJson(r4.text);
      const shapeErr = validateShape(p4.ok ? p4.data : null, ["judgment", "operative", "appeal", "scores"]);
      if (p4.ok && !shapeErr && p4.data && typeof p4.data === "object") {
        const d = p4.data as Record<string, unknown>;
        if (d.judgment)  { writeLine(res, { type: "section", id: "judgment",  data: d.judgment });  capturedJudgment = JSON.stringify(d.judgment).slice(0, 2000); }
        if (d.operative) writeLine(res, { type: "section", id: "operative", data: d.operative });
        if (d.appeal)    writeLine(res, { type: "section", id: "appeal",    data: d.appeal });
        if (d.scores)    writeLine(res, { type: "section", id: "scores",    data: d.scores });
      } else if (shapeErr || !p4.ok) {
        writeLine(res, { type: "error", message: shapeErr ?? "Phase 4 parse failed" });
        // Phase 4 failure is non-fatal for the architectural lock — ASEP may still succeed
      }
    } catch (e) {
      writeLine(res, { type: "error", message: (e as Error).message });
      // Phase 4 failure is non-fatal — continue to ASEP Phase 5
    }

    // ── Phase 5: ASEP — Al-Shamsi Explainability Protocol ────────────────────
    // ARCHITECTURAL LOCK: ASEP is mandatory. Failure marks the session incomplete.
    try {
      const r5 = await provider.complete({
        taskType: TaskType.RAG,
        systemPrompt: COURT_SYSTEM,
        maxTokens: 4000,
        temperature: 0.2,
        prompt: `استناداً إلى بيانات الجلسة القضائية:

الوقائع: ${capturedFacts}
المسائل القانونية: ${capturedIssues}
نظرية الشامسي: ${capturedShamsi}
الحكم: ${capturedJudgment}

أجب عن الأسئلة العشرة لبروتوكول قابلية التفسير (ASEP) في JSON:
{
  "answers": [
    {"question":"ما الوقائع التي استند إليها الحكم؟","answer":"string","confidence":0,"flagged":false},
    {"question":"ما الأحكام القانونية المطبقة؟","answer":"string","confidence":0,"flagged":false},
    {"question":"كيف وُزِّنت كل واقعة قانونياً؟","answer":"string","confidence":0,"flagged":false},
    {"question":"هل اكتُشف تحيز خوارزمي؟","answer":"string","confidence":0,"flagged":false},
    {"question":"إن وُجد التحيز، هل هو مبرر قانونياً؟","answer":"string","confidence":0,"flagged":false},
    {"question":"لماذا رُفضت الحجج المعارضة؟","answer":"string","confidence":0,"flagged":false},
    {"question":"أين تدخلت الرقابة البشرية؟","answer":"string","confidence":0,"flagged":false},
    {"question":"ما مستوى الثقة في كل استنتاج؟","answer":"string","confidence":0,"flagged":false},
    {"question":"هل يمكن قانوناً تصوُّر نتيجة أخرى مقبولة؟","answer":"string","confidence":0,"flagged":false},
    {"question":"هل يستوفي الحكم جميع مبادئ نظرية الشامسي؟","answer":"string","confidence":0,"flagged":false}
  ],
  "overallExplainability": 0,
  "conclusion": "string — خلاصة قابلية التفسير الكلية"
}

قواعد: confidence هو عدد صحيح 0–100. flagged=true إذا كانت الإجابة تُثير إشكالية قانونية جدية.`,
      });
      const p5 = parseModelJson(r5.text);
      // ARCHITECTURAL LOCK: validate full ASEP contract (10 answers + required fields)
      if (p5.ok && validateAsepReport(p5.data)) {
        writeLine(res, { type: "section", id: "asep", data: p5.data });
        asepOk = true;
      } else {
        const reason = !p5.ok
          ? "ASEP JSON parse failed"
          : `ASEP structural validation failed: need 10 answers with question/answer/confidence fields`;
        writeLine(res, { type: "component_failed", component: "asep", reason });
        // Emit whatever partial ASEP data arrived so the frontend can show partial results
        if (p5.ok && p5.data && typeof p5.data === "object") {
          writeLine(res, { type: "section", id: "asep", data: p5.data });
        }
      }
    } catch (e) {
      writeLine(res, { type: "component_failed", component: "asep", reason: (e as Error).message });
    }

    // ARCHITECTURAL LOCK — complete=true only when ALL mandatory components succeeded
    const failedComponents: string[] = [
      ...(!shamsiOk ? ["shamsi"] : []),
      ...(!asepOk   ? ["asep"]   : []),
    ];
    const sessionComplete = failedComponents.length === 0;

    await logAudit(req, "court.simulate", { details: { complete: sessionComplete, failedComponents } });
    writeLine(res, { type: "done", model, complete: sessionComplete, failedComponents });
    res.end();
  }
);

// ─── POST /court/supreme-review ───────────────────────────────────────────────

router.post(
  "/court/supreme-review",
  requireShamsiOwner,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const caseText = safeStr(req.body?.caseText, 5000);
    if (!caseText.trim()) { res.status(400).json({ error: "caseText is required" }); return; }

    const provider = await getProvider(res);
    if (!provider) return;

    try {
      const result = await provider.complete({
        taskType: TaskType.RAG,
        systemPrompt: COURT_SYSTEM,
        maxTokens: 6000,
        temperature: 0.3,
        prompt: `أجرِ مراجعة قضائية متعددة المستويات لهذه القضية الإدارية:

${caseText}

أخرج JSON بسبعة مفاتيح:
{
  "firstInstance":  "string — تحليل حكم أول درجة وأسبابه بالتفصيل",
  "appeal":         "string — توقع حكم محكمة الاستئناف مع التعليل",
  "cassation":      "string — موقف محكمة التمييز / النقض المحتمل",
  "frenchCouncil":  "string — كيف كان سيحكم مجلس الدولة الفرنسي في ذات القضية",
  "europeanCourt":  "string | null — موقف المحكمة الأوروبية لحقوق الإنسان إن كانت القضية ذات صلة وإلا null",
  "shamsiEval":     "string — تقييم القضية من منظور نظرية الشامسي الشاملة",
  "finalComparison":"string — النتيجة النهائية المقارنة والخلاصة التحليلية"
}`,
      });

      const parsed = parseModelJson(result.text);
      const shapeErr = validateShape(parsed.ok ? parsed.data : null,
        ["firstInstance", "appeal", "cassation", "frenchCouncil", "shamsiEval", "finalComparison"]);
      if (!parsed.ok || shapeErr) {
        res.status(422).json({ error: shapeErr ?? "AI output parse failed" }); return;
      }

      await logAudit(req, "court.supreme-review", {});
      res.json({ result: parsed.data, model: result.model });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

export default router;
