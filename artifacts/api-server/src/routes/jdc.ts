/**
 * JDC — Judicial Deliberation Chamber Routes
 *
 * POST /jdc/chambers          — Create a new chamber and run deliberation
 * GET  /jdc/chambers          — List chambers for the current user
 * GET  /jdc/chambers/:id      — Get a specific chamber with full deliberation
 * DELETE /jdc/chambers/:id    — Delete a chamber
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql, eq, desc, and } from "drizzle-orm";
import { requireAnyRole } from "../middlewares/roleAuth";
import { runChamberDeliberation } from "../utils/judicial-deliberation-chamber.js";
import type { JreParties } from "../utils/judicial-reasoning-engine.js";
import type { PanelSize } from "../utils/judicial-deliberation-chamber.js";
import { getUserId } from "../lib/route-helpers.js";
import { aiSessionLimit } from "../middlewares/rateLimits.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Drizzle doesn't have a generated table for jdc_chambers (dynamic migration),
// so we use raw sql helpers that mirror the JRE pattern.

async function insertChamber(values: {
  userId:          number;
  title:           string;
  panelSize:       number;
  disputeType:     string;
  disputeSummary:  string;
  parties:         string;
  hasAiDecision:   string;
  theoryLensId:    string | null;
  theoryLensName:  string | null;
  customTheoryText: string | null;
  status:          string;
}): Promise<{ id: number }> {
  const result = await db.execute(sql`
    INSERT INTO jdc_chambers
      (user_id, title, panel_size, dispute_type, dispute_summary, parties,
       has_ai_decision, theory_lens_id, theory_lens_name, custom_theory_text,
       status, updated_at)
    VALUES
      (${values.userId}, ${values.title}, ${values.panelSize}, ${values.disputeType},
       ${values.disputeSummary}, ${values.parties}, ${values.hasAiDecision},
       ${values.theoryLensId}, ${values.theoryLensName}, ${values.customTheoryText},
       ${values.status}, NOW())
    RETURNING id
  `);
  const rows = result.rows as Array<{ id: number }>;
  return rows[0];
}

async function updateChamber(id: number, values: {
  status:        string;
  deliberation?: string | null;
  legalityScore?: number | null;
  riskScore?:     number | null;
}): Promise<void> {
  await db.execute(sql`
    UPDATE jdc_chambers
    SET
      status         = ${values.status},
      deliberation   = ${values.deliberation ?? null},
      legality_score = ${values.legalityScore ?? null},
      risk_score     = ${values.riskScore ?? null},
      updated_at     = NOW()
    WHERE id = ${id}
  `);
}

async function findChamber(id: number, userId: number): Promise<Record<string, unknown> | null> {
  const result = await db.execute(sql`
    SELECT * FROM jdc_chambers WHERE id = ${id} AND user_id = ${userId}
  `);
  const rows = result.rows as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

function parseChamberRow(row: Record<string, unknown>) {
  const parties = (() => {
    try { return JSON.parse(row.parties as string); } catch { return {}; }
  })();
  const deliberation = (() => {
    try { return row.deliberation ? JSON.parse(row.deliberation as string) : null; } catch { return null; }
  })();
  return {
    id:               row.id,
    userId:           row.user_id,
    title:            row.title,
    panelSize:        row.panel_size,
    disputeType:      row.dispute_type,
    disputeSummary:   row.dispute_summary,
    parties,
    hasAiDecision:    row.has_ai_decision,
    theoryLensId:     row.theory_lens_id  ?? null,
    theoryLensName:   row.theory_lens_name ?? null,
    customTheoryText: row.custom_theory_text ?? null,
    status:           row.status,
    deliberation,
    legalityScore:    row.legality_score ?? null,
    riskScore:        row.risk_score     ?? null,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

// ─── GET /jdc/chambers ────────────────────────────────────────────────────────

router.get("/jdc/chambers", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const result = await db.execute(sql`
    SELECT id, user_id, title, panel_size, dispute_type, has_ai_decision,
           theory_lens_id, status, legality_score, risk_score, created_at, updated_at
    FROM jdc_chambers
    WHERE user_id = ${uid}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  const chambers = (result.rows as Array<Record<string, unknown>>).map((row) => ({
    id:           row.id,
    userId:       row.user_id,
    title:        row.title,
    panelSize:    row.panel_size,
    disputeType:  row.dispute_type,
    hasAiDecision: row.has_ai_decision,
    theoryLensId: row.theory_lens_id ?? null,
    status:       row.status,
    legalityScore: row.legality_score ?? null,
    riskScore:    row.risk_score ?? null,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  }));
  res.json({ chambers });
});

// ─── GET /jdc/chambers/:id ────────────────────────────────────────────────────

router.get("/jdc/chambers/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(String(req.params.id), 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid chamber id" }); return; }

  const row = await findChamber(id, uid);
  if (!row) { res.status(404).json({ error: "Chamber not found" }); return; }

  res.json({ chamber: parseChamberRow(row) });
});

// ─── POST /jdc/chambers ──────────────────────────────────────────────────────

router.post("/jdc/chambers", requireAnyRole, aiSessionLimit, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const {
    title,
    disputeSummary,
    parties = {},
    disputeType     = "annulment",
    panelSize       = 3,
    hasAiDecision   = false,
    theoryLensId    = null,
    theoryLensName  = null,
    customTheoryText = null,
  } = req.body as {
    title?:           string;
    disputeSummary:   string;
    parties?:         Partial<JreParties>;
    disputeType?:     string;
    panelSize?:       number;
    hasAiDecision?:   boolean;
    theoryLensId?:    string | null;
    theoryLensName?:  string | null;
    customTheoryText?: string | null;
  };

  // Validation
  if (!disputeSummary || disputeSummary.trim().length < 50) {
    res.status(400).json({ error: "disputeSummary is required and must be at least 50 characters" });
    return;
  }
  if (!parties.applicant && !parties.applicantAr) {
    res.status(400).json({ error: "parties.applicant (or applicantAr) is required" });
    return;
  }
  if (!parties.respondent && !parties.respondentAr) {
    res.status(400).json({ error: "parties.respondent (or respondentAr) is required" });
    return;
  }
  if (![1, 3, 5].includes(panelSize)) {
    res.status(400).json({ error: "panelSize must be 1, 3, or 5" });
    return;
  }

  const normalizedParties: JreParties = {
    applicant:    parties.applicant    || parties.applicantAr    || "",
    respondent:   parties.respondent   || parties.respondentAr   || "",
    applicantAr:  parties.applicantAr  || parties.applicant      || "",
    respondentAr: parties.respondentAr || parties.respondent     || "",
  };

  const panelLabel = panelSize === 1 ? "قاضٍ فرد" : panelSize === 3 ? "دائرة ثلاثية" : "دائرة خماسية";
  const chamberTitle = title?.trim() || `${panelLabel} — ${disputeType} — ${new Date().toLocaleDateString("ar-AE")}`;

  // Create chamber in deliberating state
  const { id: chamberId } = await insertChamber({
    userId:          uid,
    title:           chamberTitle,
    panelSize,
    disputeType,
    disputeSummary:  disputeSummary.trim(),
    parties:         JSON.stringify(normalizedParties),
    hasAiDecision:   hasAiDecision ? "true" : "false",
    theoryLensId:    theoryLensId  || null,
    theoryLensName:  theoryLensName || null,
    customTheoryText: customTheoryText || null,
    status:          "deliberating",
  });

  // Run full chamber deliberation
  try {
    const deliberation = await runChamberDeliberation({
      disputeSummary:  disputeSummary.trim(),
      parties:         normalizedParties,
      disputeType,
      panelSize:       panelSize as PanelSize,
      hasAiDecision,
      theoryLensId:    theoryLensId || null,
      userId:          uid,
    });

    await updateChamber(chamberId, {
      status:        "complete",
      deliberation:  JSON.stringify(deliberation),
      legalityScore: deliberation.legalityScore ?? null,
      riskScore:     deliberation.riskScore     ?? null,
    });

    const row = await findChamber(chamberId, uid);
    res.json({ chamber: parseChamberRow(row!) });
  } catch (err) {
    req.log?.error({ err }, "JDC deliberation failed");

    await updateChamber(chamberId, { status: "error" });

    res.status(500).json({
      error:     "Deliberation failed. Please try again.",
      chamberId,
      detail:    (err as Error).message,
    });
  }
});

// ─── DELETE /jdc/chambers/:id ────────────────────────────────────────────────

router.delete("/jdc/chambers/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(String(req.params.id), 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid chamber id" }); return; }

  const existing = await findChamber(id, uid);
  if (!existing) { res.status(404).json({ error: "Chamber not found" }); return; }

  await db.execute(sql`DELETE FROM jdc_chambers WHERE id = ${id} AND user_id = ${uid}`);
  res.json({ success: true });
});

export default router;
