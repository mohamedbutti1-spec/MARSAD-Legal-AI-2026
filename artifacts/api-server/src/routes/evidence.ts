/**
 * Phase 4 — Constitutional Chain of Custody and Evidence Ledger API
 *
 * Immutable evidentiary chain for every constitutional decision.
 * Append-only. No delete. No edit.
 *
 *   GET  /evidence/:decisionId          — full evidence chain
 *   GET  /evidence/:decisionId/verify   — integrity verification + integrity score
 *   GET  /evidence/:decisionId/export   — court-ready judicial evidence package
 */
import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionStagesTable,
  decisionDciTable,
  decisionJdpTable,
  decisionCarTable,
  getEvidenceChain,
  verifyEvidenceChain,
  getConstitutionalMemory,
  verifyCustodyChain,
  getDecisionCustody,
} from "@workspace/db";
import { getPermissions, ALL_ROLES } from "@workspace/db/permissions";
import { getValidatedRole } from "../lib/route-helpers";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Evidence read: audit log readers, hash verifiers, or judges
function requireEvidenceRead(req: Request, res: Response, next: NextFunction): void {
  const perms = getPermissions(getValidatedRole(req));
  const role  = getValidatedRole(req);
  if (!perms.canReadAuditLog && !perms.canRunHashVerification && role !== "judge") {
    res.status(403).json({
      error: "سجل الأدلة يتطلب صلاحية سجل التدقيق أو التحقق من الهاش أو دور القاضي",
    });
    return;
  }
  next();
}

// Judicial export: judges and hash-verification roles (external_auditor, owner)
function requireJudicialAccess(req: Request, res: Response, next: NextFunction): void {
  const perms = getPermissions(getValidatedRole(req));
  const role  = getValidatedRole(req);
  if (!perms.canRunHashVerification && role !== "judge") {
    res.status(403).json({
      error: "التصدير القضائي يتطلب دور القاضي أو المدقق الخارجي أو مالك المنصة",
    });
    return;
  }
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /evidence/:decisionId
 * Full evidence chain with verification summary.
 */
router.get(
  "/evidence/:decisionId",
  requireEvidenceRead,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(String(req.params["decisionId"] ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "معرّف القرار غير صالح" }); return; }

    const [chain, verification] = await Promise.all([
      getEvidenceChain(id),
      verifyEvidenceChain(id),
    ]);

    if (!chain.length) {
      res.status(404).json({
        error: "لا توجد أدلة مسجّلة لهذا القرار",
        decisionId: id,
      });
      return;
    }

    res.json({
      decisionId:     id,
      totalEvents:    chain.length,
      verification,
      chain,
    });
  },
);

/**
 * GET /evidence/:decisionId/verify
 * Integrity verification engine — returns broken links, missing events,
 * hash verification, and an integrity score (0-100).
 */
router.get(
  "/evidence/:decisionId/verify",
  requireEvidenceRead,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(String(req.params["decisionId"] ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "معرّف القرار غير صالح" }); return; }

    const chain = await getEvidenceChain(id);
    if (!chain.length) {
      res.status(404).json({ error: "لا توجد أدلة مسجّلة لهذا القرار", decisionId: id });
      return;
    }

    const verification = await verifyEvidenceChain(id);

    // Detect missing expected events
    const presentActions = new Set(chain.map((e) => e.action));
    const expectedLifecycle = ["decision.created", "stage.completed", "car.generated"] as const;
    const missingEvents = expectedLifecycle.filter((a) => !presentActions.has(a));

    res.json({
      decisionId: id,
      verifiedAt: new Date().toISOString(),
      ...verification,
      missingEvents,
      actionsPresent: [...presentActions],
    });
  },
);

/**
 * GET /evidence/:decisionId/export
 * Court-ready judicial evidence package.
 * Returns a structured JSON bundle containing all constitutional artefacts,
 * the complete chain of custody, the evidence ledger, and integrity proofs.
 */
router.get(
  "/evidence/:decisionId/export",
  requireJudicialAccess,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(String(req.params["decisionId"] ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "معرّف القرار غير صالح" }); return; }

    // Fetch all artefacts in parallel
    const [
      decisionRows,
      stageRows,
      dciRows,
      jdpRows,
      carRows,
      evidenceChain,
      evidenceVerification,
      constitutionalMemory,
      custodyChain,
      custodyVerification,
    ] = await Promise.all([
      db.select().from(decisionsTable).where(eq(decisionsTable.id, id)),
      db.select().from(decisionStagesTable).where(eq(decisionStagesTable.decisionId, id)),
      db.select().from(decisionDciTable).where(eq(decisionDciTable.decisionId, id)),
      db.select().from(decisionJdpTable).where(eq(decisionJdpTable.decisionId, id)),
      db.select().from(decisionCarTable).where(eq(decisionCarTable.decisionId, id)),
      getEvidenceChain(id),
      verifyEvidenceChain(id),
      getConstitutionalMemory(id).catch(() => null),
      getDecisionCustody(id).catch(() => [] as never[]),
      verifyCustodyChain(id).catch(() => ({ valid: false, recordsChecked: 0, latestChainHash: null, errors: [] as never[], genesisHash: null, firstTamperedSequence: null })),
    ]);

    const decision = decisionRows[0];
    if (!decision) {
      res.status(404).json({ error: "القرار غير موجود", decisionId: id });
      return;
    }

    const dci = dciRows[0] ?? null;
    const jdp = jdpRows[0] ?? null;
    const car = carRows[0] ?? null;

    // QVA data lives inside the decision stages / session — extract from DCI
    const qvaData = dci
      ? {
          alShamsiFrameworkCompliance: (dci as Record<string, unknown>).alShamsiFrameworkCompliance,
          legalityScore:               (dci as Record<string, unknown>).legalityScore,
          riskScore:                   (dci as Record<string, unknown>).riskScore,
        }
      : null;

    const exportedAt = new Date().toISOString();

    res.json({
      // ── Package header ───────────────────────────────────────────────────
      packageType:    "MARSAD-JUDICIAL-EVIDENCE-PACKAGE-v4",
      framework:      "Al-Shamsi Constitutional Decision Framework™",
      exportedAt,
      exportedBy:     req.headers["x-user-id"] ?? "system",
      exportedByRole: getValidatedRole(req),
      decisionId:     id,

      // ── Constitutional passport ──────────────────────────────────────────
      constitutionalPassport: {
        caseNumber:   decision.caseNumber,
        titleAr:      decision.titleAr,
        jurisdiction: decision.jurisdiction,
        status:       decision.status,
        createdAt:    decision.createdAt,
        updatedAt:    decision.updatedAt,
      },

      // ── Decision stages ──────────────────────────────────────────────────
      stages: stageRows.map((s) => ({
        stageKey:    s.stageKey,
        stageNumber: s.stageNumber,
        completedAt: s.completedAt,
      })),

      // ── Constitutional Identity (DCI) ─────────────────────────────────────
      dci: dci
        ? {
            currentVersion:               (dci as Record<string, unknown>).currentVersion,
            alShamsiFrameworkCompliance:  (dci as Record<string, unknown>).alShamsiFrameworkCompliance,
            isSealed:                     (dci as Record<string, unknown>).isSealed,
            legalJustification:           (dci as Record<string, unknown>).legalJustification,
            constitutionalBasis:          (dci as Record<string, unknown>).constitutionalBasis,
          }
        : null,

      // ── Judicial Defense Package (JDP) ────────────────────────────────────
      jdp: jdp ? {
        packageVersion: (jdp as Record<string, unknown>).packageVersion,
        generatedAt:    (jdp as Record<string, unknown>).generatedAt,
      } : null,

      // ── Constitutional Answer Record (CAR) ───────────────────────────────
      car: car ? {
        generatedAt: (car as Record<string, unknown>).generatedAt,
        sections:    Object.keys((car as Record<string, unknown>).carData as object ?? {}).length,
      } : null,

      // ── Quantitative Validity Assessment (QVA) ───────────────────────────
      qva: qvaData,

      // ── Constitutional Memory ─────────────────────────────────────────────
      constitutionalMemory: constitutionalMemory
        ? {
            constitutionalNumber: constitutionalMemory.current.constitutionalNumber,
            currentVersion:       constitutionalMemory.current.decisionVersion,
            totalVersions:        constitutionalMemory.versions.length,
            integrity:            constitutionalMemory.integrity,
          }
        : null,

      // ── Chain of Custody (Phase 3) ────────────────────────────────────────
      chainOfCustody: {
        recordCount:  custodyChain.length,
        integrity:    custodyVerification,
        chain:        custodyChain,
      },

      // ── Evidence Ledger (Phase 4) ─────────────────────────────────────────
      evidenceLedger: {
        totalEvents:  evidenceChain.length,
        integrity:    evidenceVerification,
        chain:        evidenceChain,
      },

      // ── SHA-256 proof of integrity ────────────────────────────────────────
      integrityProof: {
        evidenceChainHash:  evidenceVerification.latestChainHash,
        custodyChainHash:   custodyVerification.latestChainHash ?? null,
        constitutionalHash: constitutionalMemory?.current.completeAuditHash ?? null,
        allChainsValid:
          evidenceVerification.valid &&
          custodyVerification.valid &&
          (constitutionalMemory?.integrity.valid ?? true),
      },
    });
  },
);

export default router;
