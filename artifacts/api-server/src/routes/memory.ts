/**
 * Phase 3 — Al-Shamsi Constitutional Memory (CM) API
 * الذاكرة الدستورية للقرار الإداري الذكي
 *
 * Append-only constitutional memory layer for every administrative decision.
 * Nothing is overwritten. Every action becomes permanent constitutional evidence.
 *
 *   GET  /api/memory/:decisionId    — full constitutional memory (versions + timeline + integrity)
 *   POST /api/memory/verify         — verify chain integrity for a decision
 *   POST /api/memory/archive        — archive a decision's constitutional memory
 *   GET  /api/memory/history        — paginated index of all constitutional records
 */
import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  getConstitutionalMemory,
  archiveMemory,
  recordMemoryEvent,
  getMemoryHistory,
} from "@workspace/db";
import { getPermissions, ALL_ROLES } from "@workspace/db/permissions";
import { getValidatedRole, getUserInfo } from "../lib/route-helpers";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(req: Request): string {
  return getUserInfo(req).userId;
}

function getOrg(req: Request): string {
  return getUserInfo(req).org;
}

// Full memory read: audit log readers, hash verifiers, or judges
function requireMemoryRead(req: Request, res: Response, next: NextFunction): void {
  const perms = getPermissions(getValidatedRole(req));
  if (!perms.canReadAuditLog && !perms.canRunHashVerification && getValidatedRole(req) !== "judge") {
    res.status(403).json({
      error:
        "الذاكرة الدستورية تتطلب صلاحية سجل التدقيق أو التحقق من الهاش أو دور القاضي",
    });
    return;
  }
  next();
}

// Archive: owner or supervisor only
function requireArchiveAccess(req: Request, res: Response, next: NextFunction): void {
  const role = getValidatedRole(req);
  if (role !== "owner" && role !== "supervisor") {
    res.status(403).json({
      error: "الأرشفة تتطلب صلاحية المالك أو المشرف",
    });
    return;
  }
  next();
}

// Governance dashboard: any role with canViewGovernanceDashboard
function requireGovernanceView(req: Request, res: Response, next: NextFunction): void {
  const perms = getPermissions(getValidatedRole(req));
  if (!perms.canViewGovernanceDashboard) {
    res.status(403).json({ error: "لوحة الحوكمة مقيدة بالمستخدمين المعتمدين" });
    return;
  }
  next();
}

// Verify: only hash-verification roles (external_auditor, owner)
function requireHashVerification(req: Request, res: Response, next: NextFunction): void {
  const perms = getPermissions(getValidatedRole(req));
  if (!perms.canRunHashVerification) {
    res.status(403).json({
      error: "التحقق من الهاش يتطلب دور المدقق الخارجي أو مالك المنصة",
    });
    return;
  }
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/memory/:decisionId
 * Full constitutional memory: all versions, full timeline, integrity report.
 * Roles: internal_auditor, external_auditor, owner, supervisor, judge.
 */
router.get(
  "/memory/history",
  requireGovernanceView,
  async (req: Request, res: Response): Promise<void> => {
    const limit  = Math.min(parseInt(String(req.query["limit"]  ?? "20"), 10), 100);
    const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"),  10), 0);

    const { records, total } = await getMemoryHistory({ limit, offset });

    res.json({
      total,
      limit,
      offset,
      records: records.map((r) => ({
        memoryId:             r.memoryId,
        decisionId:           r.decisionId,
        constitutionalNumber: r.constitutionalNumber,
        decisionVersion:      r.decisionVersion,
        decisionStatus:       r.decisionStatus,
        constitutionalStatus: r.constitutionalStatus,
        complianceStatus:     r.complianceStatus,
        appealStatus:         r.appealStatus,
        sealed:               r.sealed,
        archiveStatus:        r.archiveStatus,
        createdAt:            r.createdAt,
        governmentEntity:     r.governmentEntity,
        issuerRole:           r.issuerRole,
      })),
    });
  },
);

router.get(
  "/memory/:decisionId",
  requireMemoryRead,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(String(req.params["decisionId"] ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "معرّف القرار غير صالح" }); return; }

    const memory = await getConstitutionalMemory(id);
    if (!memory) {
      res.status(404).json({
        error: "لا توجد ذاكرة دستورية لهذا القرار",
        decisionId: id,
      });
      return;
    }

    res.json({
      decisionId: id,
      constitutionalNumber: memory.current.constitutionalNumber,
      currentVersion: memory.current.decisionVersion,
      totalVersions: memory.versions.length,
      timelineEvents: memory.timeline.length,
      integrity: memory.integrity,
      current: memory.current,
      versions: memory.versions,
      timeline: memory.timeline,
    });
  },
);

/**
 * POST /api/memory/verify
 * Verify chain integrity for a decision.
 * Roles: external_auditor, owner.
 */
router.post(
  "/memory/verify",
  requireHashVerification,
  async (req: Request, res: Response): Promise<void> => {
    const { decisionId } = req.body as { decisionId?: number };
    if (!decisionId) { res.status(400).json({ error: "decisionId مطلوب" }); return; }

    const memory = await getConstitutionalMemory(decisionId);
    if (!memory) {
      res.status(404).json({ error: "لا توجد ذاكرة دستورية لهذا القرار", decisionId });
      return;
    }

    // Record the verification event (fire-and-forget)
    recordMemoryEvent({
      decisionId,
      eventType: "memory.verified",
      eventSummaryAr: "تم التحقق من سلامة الذاكرة الدستورية",
      eventSummaryEn: "Constitutional memory integrity verified",
      actorId: getUserId(req),
      actorRole: getValidatedRole(req),
      actorOrg: getOrg(req),
      payload: {
        valid: memory.integrity.valid,
        versionsChecked: memory.integrity.versionsChecked,
        timelineChecked: memory.integrity.timelineChecked,
      },
    }).catch(console.error);

    res.json({
      decisionId,
      constitutionalNumber: memory.current.constitutionalNumber,
      verifiedAt: new Date().toISOString(),
      verifiedBy: getUserId(req),
      ...memory.integrity,
    });
  },
);

/**
 * POST /api/memory/archive
 * Archive a decision's constitutional memory.
 * Roles: owner, supervisor.
 */
router.post(
  "/memory/archive",
  requireArchiveAccess,
  async (req: Request, res: Response): Promise<void> => {
    const { decisionId } = req.body as { decisionId?: number };
    if (!decisionId) { res.status(400).json({ error: "decisionId مطلوب" }); return; }

    const result = await archiveMemory(decisionId, getUserId(req), getValidatedRole(req));
    if (!result) {
      res.status(404).json({ error: "لا توجد ذاكرة دستورية لهذا القرار", decisionId });
      return;
    }

    res.json({
      success: true,
      decisionId,
      constitutionalNumber: result.constitutionalNumber,
      archiveStatus: result.archiveStatus,
      archivedAt: new Date().toISOString(),
      archivedBy: getUserId(req),
    });
  },
);

export default router;
