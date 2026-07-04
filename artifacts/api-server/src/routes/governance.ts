/**
 * Phase 2 — Executive Governance Layer
 * Role-scoped API endpoints for all 11 governance dashboards.
 * Every endpoint reads the permission matrix and returns only what the
 * requesting role is authorised to see. No existing decision logic is modified.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHash } from "crypto";
import { eq, and, desc, gte, sql, isNotNull } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionStagesTable,
  decisionDciTable,
  decisionJdpTable,
  decisionCarTable,
  auditLogsTable,
  recordCustodyEvent,
  verifyCustodyChain,
  getDecisionCustody,
  createOrUpdateMemory,
  recordMemoryEvent,
  recordEvidenceEvent,
} from "@workspace/db";
import { getPermissions, ALL_ROLES } from "@workspace/db/permissions";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRole(req: Request): string {
  const h = req.headers["x-user-role"];
  const r = Array.isArray(h) ? h[0] : (h ?? "citizen");
  return ALL_ROLES.includes(r as never) ? r : "citizen";
}

function getUserId(req: Request): number {
  const h = req.headers["x-user-id"];
  return parseInt(Array.isArray(h) ? h[0] : (h ?? "1"), 10) || 1;
}

function getUserOrg(req: Request): string | null {
  const h = req.headers["x-user-org"];
  const raw = (Array.isArray(h) ? h[0] : h) ?? "";
  return raw.trim() || null;   // treat empty / whitespace as absent
}

/** Middleware: allow all registered roles (including governance + citizen) */
function allowAnyGovernanceRole(req: Request, res: Response, next: NextFunction): void {
  const role = getRole(req);
  const perms = getPermissions(role);
  if (!perms.canViewGovernanceDashboard && !perms.canSearchByCaseNumber) {
    res.status(403).json({ error: "Access denied for this role" });
    return;
  }
  next();
}

// ─── GET /api/governance/dashboard ────────────────────────────────────────────
// Returns role-appropriate aggregated statistics.

router.get("/governance/dashboard", allowAnyGovernanceRole, async (req, res) => {
  const role = getRole(req);
  const perms = getPermissions(role);

  if (!perms.canReadDecisionList) {
    res.json({ stats: null, role });
    return;
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Base decisions query (apply sealedOnly for roles that require it)
    let allDecisions = await db
      .select({
        id: decisionsTable.id,
        status: decisionsTable.status,
        createdAt: decisionsTable.createdAt,
        organizationUnit: decisionsTable.organizationUnit,
      })
      .from(decisionsTable)
      .orderBy(desc(decisionsTable.createdAt));

    if (perms.sealedOnly) {
      // Only sealed decisions — join with DCI
      const sealedIds = (await db
        .select({ decisionId: decisionDciTable.decisionId })
        .from(decisionDciTable)
        .where(eq(decisionDciTable.isSealed, true)))
        .map((r) => r.decisionId);
      allDecisions = allDecisions.filter((d) => sealedIds.includes(d.id));
    }

    const userOrg = getUserOrg(req);
    // seeOwnOrgOnly: deny-by-default when no org claim is present.
    // With the frontend always sending X-User-Org this case only arises
    // for direct API calls without a proper identity claim.
    if (perms.seeOwnOrgOnly && !userOrg) {
      res.json({ role, stats: { totalDecisions: 0, totalThisMonth: 0, sealedCount: 0, constitutionalPassRate: 0, avgDaysToSeal: 0, byStatus: {}, hiiDistribution: null, complianceDistribution: {}, attentionDecisions: [] } });
      return;
    }
    if (perms.seeOwnOrgOnly && userOrg) {
      allDecisions = allDecisions.filter(
        (d) => d.organizationUnit === userOrg,
      );
    }

    const totalDecisions = allDecisions.length;
    const totalThisMonth = allDecisions.filter(
      (d) => new Date(d.createdAt) >= monthStart,
    ).length;

    const byStatus: Record<string, number> = {};
    for (const d of allDecisions) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    }

    // Scope DCI aggregations to the same set of decisions the role can see.
    const allowedIds = new Set(allDecisions.map((d) => d.id));
    const allDci = (await db.select().from(decisionDciTable)).filter((d) =>
      allowedIds.has(d.decisionId),
    );
    const sealedCount = allDci.filter((d) => d.isSealed).length;

    // Constitutional pass rate
    const validatedDci = allDci.filter(
      (d) => d.constitutionalValidationStatus !== "pending",
    );
    const passedCount = validatedDci.filter(
      (d) => d.constitutionalValidationStatus === "passed",
    ).length;
    const constitutionalPassRate =
      validatedDci.length > 0
        ? Math.round((passedCount / validatedDci.length) * 100)
        : 0;

    // Average days to seal
    const sealedDci = allDci.filter((d) => d.isSealed && d.sealedAt);
    let avgDaysToSeal = 0;
    if (sealedDci.length > 0) {
      const totalDays = sealedDci.reduce((acc, d) => {
        const created = new Date(d.createdAt).getTime();
        const sealed = new Date(d.sealedAt!).getTime();
        return acc + (sealed - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgDaysToSeal = Math.round(totalDays / sealedDci.length);
    }

    // HII distribution (only for roles with canReadHii)
    const hiiDistribution: Record<string, number> = {};
    if (perms.canReadHii) {
      for (const d of allDci) {
        const k = d.humanInfluenceIndex ?? "pending";
        hiiDistribution[k] = (hiiDistribution[k] ?? 0) + 1;
      }
    }

    // Compliance distribution
    const complianceDistribution: Record<string, number> = {};
    for (const d of allDci) {
      const k = d.alShamsiFrameworkCompliance ?? "pending";
      complianceDistribution[k] = (complianceDistribution[k] ?? 0) + 1;
    }

    // Decisions needing attention — scoped to what this role is allowed to see.
    const attentionDecisions = perms.canReadDecisionList
      ? allDecisions.filter(
          (d) =>
            d.status === "validation_failed" ||
            (d.status === "in_progress" &&
              new Date(d.createdAt).getTime() <
                Date.now() - 7 * 24 * 60 * 60 * 1000),
        )
      : [];

    res.json({
      role,
      stats: {
        totalDecisions,
        totalThisMonth,
        sealedCount,
        constitutionalPassRate,
        avgDaysToSeal,
        byStatus,
        hiiDistribution: perms.canReadHii ? hiiDistribution : null,
        complianceDistribution,
        attentionDecisions: attentionDecisions.slice(0, 5),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/governance/decisions ────────────────────────────────────────────
// Returns role-scoped decisions list with DCI summary fields.

router.get("/governance/decisions", allowAnyGovernanceRole, async (req, res) => {
  const role = getRole(req);
  const perms = getPermissions(role);

  if (!perms.canReadDecisionList) {
    res.json({ decisions: [], role });
    return;
  }

  try {
    const userOrg = getUserOrg(req);

    // seeOwnOrgOnly: deny-by-default when no org claim is present.
    if (perms.seeOwnOrgOnly && !userOrg) {
      res.json({ decisions: [], role });
      return;
    }

    const decisions = await db
      .select()
      .from(decisionsTable)
      .orderBy(desc(decisionsTable.createdAt));

    // Fetch related DCI records
    const allDci = await db.select().from(decisionDciTable);
    const dciByDecisionId = new Map(allDci.map((d) => [d.decisionId, d]));

    let result = decisions.map((d) => {
      const dci = dciByDecisionId.get(d.id);
      // Delegation state lives in the metadata JSONB field — not a top-level column.
      const meta = (d.metadata as Record<string, unknown>) ?? {};
      return {
        id: d.id,
        caseNumber: d.caseNumber,
        titleAr: d.titleAr,
        titleEn: d.titleEn,
        status: d.status,
        currentStage: d.currentStage,
        stagesCompleted: d.stagesCompleted,
        organizationUnit: d.organizationUnit,
        issuingAuthority: d.issuingAuthority,
        createdBy: d.createdBy,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        delegatedForReview: meta.delegatedForReview ?? false,
        delegatedAt: meta.delegatedAt ?? null,
        // DCI summary (scoped by permissions)
        dci: dci
          ? {
              isSealed: dci.isSealed,
              sealedAt: dci.sealedAt,
              alShamsiFrameworkCompliance: dci.alShamsiFrameworkCompliance,
              constitutionalValidationStatus: dci.constitutionalValidationStatus,
              lsiStatus: dci.lsiStatus,
              humanDecisionOwner: dci.humanDecisionOwner,
              ...(perms.canReadHii
                ? {
                    humanInfluenceIndex: dci.humanInfluenceIndex,
                    aiActualInfluence: dci.aiActualInfluence,
                  }
                : {}),
              ...(perms.canReadAuditHashes
                ? { completeAuditHash: dci.completeAuditHash }
                : {}),
              ...(perms.canReadConstitutionalGates
                ? {
                    lsiStatus: dci.lsiStatus,
                    qvaVarianceLevel: dci.qvaVarianceLevel,
                    qvaRunCount: dci.qvaRunCount,
                  }
                : {}),
            }
          : null,
      };
    });

    // Apply sealedOnly filter
    if (perms.sealedOnly) {
      result = result.filter((d) => d.dci?.isSealed === true);
    }

    // Apply org filter
    if (perms.seeOwnOrgOnly && userOrg) {
      result = result.filter((d) => d.organizationUnit === userOrg);
    }

    res.json({ decisions: result, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/governance/decisions/:id/permitted ──────────────────────────────
// Full role-scoped payload for one decision — includes only permitted sections.

router.get(
  "/governance/decisions/:id/permitted",
  allowAnyGovernanceRole,
  async (req, res) => {
    const role = getRole(req);
    const perms = getPermissions(role);
    const id = parseInt(req.params["id"] as string, 10);

    if (!perms.canReadDecisionDetail) {
      res.status(403).json({ error: "This role cannot read decision details" });
      return;
    }

    try {
      const [decision] = await db
        .select()
        .from(decisionsTable)
        .where(eq(decisionsTable.id, id));

      if (!decision) {
        res.status(404).json({ error: "Decision not found" });
        return;
      }

      // sealedOnly: only permit if DCI is sealed
      const [dciRow] = await db
        .select()
        .from(decisionDciTable)
        .where(eq(decisionDciTable.decisionId, id));

      if (perms.sealedOnly && !dciRow?.isSealed) {
        res.status(403).json({ error: "This decision is not yet sealed" });
        return;
      }

      // seeOwnOrgOnly: enforce org boundary on detail access.
      // Deny when no org claim is present OR when the claim doesn't match.
      const userOrgDetail = getUserOrg(req);
      if (perms.seeOwnOrgOnly) {
        if (!userOrgDetail) {
          res.status(403).json({ error: "Organisation identity required for this role" });
          return;
        }
        if (decision.organizationUnit !== userOrgDetail) {
          res.status(403).json({
            error: "This decision belongs to a different organisation unit and is outside your permitted scope",
          });
          return;
        }
      }

      const payload: Record<string, unknown> = { decision, role };

      // Stages
      if (perms.canReadStageData) {
        const stages = await db
          .select()
          .from(decisionStagesTable)
          .where(eq(decisionStagesTable.decisionId, id))
          .orderBy(decisionStagesTable.stageNumber);

        payload.stages = perms.canReadAiAnalysis
          ? stages
          : stages.map((s) => ({
              ...s,
              aiAnalysis: null, // strip AI analysis text
              aiContribution: null,
            }));
      }

      // DCI — explicit allowlist; never spread the full row to avoid leaking
      // fields that the requesting role is not permitted to see.
      if (perms.canReadDci && dciRow) {
        payload.dci = {
          // Always-visible identity fields
          id: dciRow.id,
          decisionId: dciRow.decisionId,
          isSealed: dciRow.isSealed,
          sealedAt: dciRow.sealedAt,
          alShamsiFrameworkCompliance: dciRow.alShamsiFrameworkCompliance,
          constitutionalValidationStatus: dciRow.constitutionalValidationStatus,
          createdAt: dciRow.createdAt,
          updatedAt: dciRow.updatedAt,
          // Human-decision fields
          humanDecisionOwner: dciRow.humanDecisionOwner,
          // HII — gated
          humanInfluenceIndex: perms.canReadHii ? dciRow.humanInfluenceIndex : undefined,
          aiActualInfluence:   perms.canReadHii ? dciRow.aiActualInfluence   : undefined,
          // QVA raw — gated
          qvaResults: perms.canReadQvaRaw ? dciRow.qvaResults : [],
          // lsiStatus uses the canonical DB column name
          lsiStatus: dciRow.lsiStatus,
          // Audit hash — only for auditors
          completeAuditHash: perms.canReadAuditHashes ? dciRow.completeAuditHash : undefined,
        };
      }

      // JDP
      if (perms.canReadJdp) {
        const [jdp] = await db
          .select()
          .from(decisionJdpTable)
          .where(eq(decisionJdpTable.decisionId, id));
        payload.jdp = jdp ?? null;
      }

      // CAR
      if (perms.canReadCar) {
        const [car] = await db
          .select()
          .from(decisionCarTable)
          .where(eq(decisionCarTable.decisionId, id));
        payload.car = car ?? null;
      }

      // Audit log
      if (perms.canReadAuditLog) {
        const logs = await db
          .select()
          .from(auditLogsTable)
          .where(
            and(
              eq(auditLogsTable.entityType, "decision"),
              eq(auditLogsTable.entityId, id),
            ),
          )
          .orderBy(auditLogsTable.createdAt)
          .limit(200);
        payload.auditLog = logs;
      }

      // Stage audit hashes (for auditors)
      if (perms.canReadAuditHashes) {
        const stages = await db
          .select({
            stageKey: decisionStagesTable.stageKey,
            stageNumber: decisionStagesTable.stageNumber,
            auditHash: decisionStagesTable.auditHash,
            completedAt: decisionStagesTable.completedAt,
          })
          .from(decisionStagesTable)
          .where(eq(decisionStagesTable.decisionId, id))
          .orderBy(decisionStagesTable.stageNumber);
        payload.stageHashes = stages;
      }

      res.json(payload);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── GET /api/governance/decisions/:id/hash-verify ────────────────────────────
// External Auditor: recompute SHA-256 chain and compare with stored hash.

router.get(
  "/governance/decisions/:id/hash-verify",
  allowAnyGovernanceRole,
  async (req, res) => {
    const role = getRole(req);
    const perms = getPermissions(role);
    const id = parseInt(req.params["id"] as string, 10);

    if (!perms.canRunHashVerification) {
      res.status(403).json({ error: "Hash verification requires External Auditor role" });
      return;
    }

    try {
      const [dci] = await db
        .select()
        .from(decisionDciTable)
        .where(eq(decisionDciTable.decisionId, id));

      if (!dci || !dci.isSealed) {
        res.status(404).json({ error: "Sealed DCI not found for this decision" });
        return;
      }

      const stages = await db
        .select({
          stageNumber: decisionStagesTable.stageNumber,
          stageKey: decisionStagesTable.stageKey,
          auditHash: decisionStagesTable.auditHash,
          completedAt: decisionStagesTable.completedAt,
        })
        .from(decisionStagesTable)
        .where(eq(decisionStagesTable.decisionId, id))
        .orderBy(decisionStagesTable.stageNumber);

      const hashInput = stages.map((s) => s.auditHash ?? "").join("|");
      const computedHash = createHash("sha256").update(hashInput).digest("hex");
      const storedHash = dci.completeAuditHash ?? "";
      const verified = computedHash === storedHash;

      res.json({
        verified,
        storedHash,
        computedHash,
        stagesChecked: stages.length,
        stages: stages.map((s) => ({
          stageNumber: s.stageNumber,
          stageKey: s.stageKey,
          auditHash: s.auditHash ?? "(missing)",
          completedAt: s.completedAt,
          present: Boolean(s.auditHash),
        })),
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── POST /api/governance/decisions/:id/delegate ──────────────────────────────
// Undersecretary: flag a decision for mandatory review.

router.post(
  "/governance/decisions/:id/delegate",
  allowAnyGovernanceRole,
  async (req, res) => {
    const role = getRole(req);
    const perms = getPermissions(role);
    const id = parseInt(req.params["id"] as string, 10);
    const userId = getUserId(req);

    if (!perms.canDelegateDecision) {
      res.status(403).json({ error: "Delegation requires Undersecretary role" });
      return;
    }

    try {
      const [decision] = await db
        .select()
        .from(decisionsTable)
        .where(eq(decisionsTable.id, id));

      if (!decision) {
        res.status(404).json({ error: "Decision not found" });
        return;
      }

      await db
        .update(decisionsTable)
        .set({
          metadata: {
            ...(decision.metadata as Record<string, unknown> ?? {}),
            delegatedForReview: true,
            delegatedAt: new Date().toISOString(),
            delegatedBy: userId,
          },
          updatedAt: new Date(),
        })
        .where(eq(decisionsTable.id, id));

      const [updated] = await db
        .select()
        .from(decisionsTable)
        .where(eq(decisionsTable.id, id));

      // Phase 3 — Chain of Custody: delegation event
      recordCustodyEvent({
        decisionId: id,
        userId,
        userRole:     role,
        organization: getUserOrg(req),
        action:         "decision.delegated",
        actionCategory: "governance",
        deviceInfo:  { userAgent: req.headers["user-agent"] ?? "" },
        ipAddress:   String(Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? ""),
        previousValue: null,
        newValue:    { delegatedForReview: true, delegatedBy: userId, delegatedAt: new Date().toISOString() },
        legalJustification: "تفويض القرار للمراجعة الإلزامية من قِبل وكيل الوزارة",
        aiRecommendation:   null,
        humanModification:  "تفويض إداري",
      }).catch((e: unknown) => console.error("[custody.delegate]", e));

      // Phase 3 — Constitutional Memory: delegation event
      recordMemoryEvent({
        decisionId: id,
        eventType:      "human.review",
        eventSummaryAr: "تفويض القرار للمراجعة من قِبل وكيل الوزارة",
        eventSummaryEn: "Decision delegated for mandatory undersecretary review",
        actorId:   String(userId),
        actorRole: role,
        actorOrg:  getUserOrg(req),
        payload:   { delegatedAt: new Date().toISOString() },
      }).catch((e: unknown) => console.error("[memory.event.delegate]", e));

      // Phase 4 — Evidence Ledger: delegation
      recordEvidenceEvent({
        decisionId:         id,
        action:             "decision.delegated",
        eventCategory:      "governance",
        actor:              String(userId),
        actorRole:          role,
        actorOrg:           getUserOrg(req),
        affectedObject:     `decision:${id}`,
        affectedObjectType: "decision",
        evidenceSummaryAr:  "تفويض القرار للمراجعة الإلزامية",
        evidenceSummaryEn:  "Decision delegated for mandatory review",
        metadata:           { delegatedAt: new Date().toISOString() },
      }).catch((e: unknown) => console.error("[evidence.delegate]", e));

      res.json({ success: true, decision: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── POST /api/governance/decisions/:id/undelegate ───────────────────────────
// Undersecretary: remove delegation flag.

router.post(
  "/governance/decisions/:id/undelegate",
  allowAnyGovernanceRole,
  async (req, res) => {
    const role = getRole(req);
    const perms = getPermissions(role);
    const id = parseInt(req.params["id"] as string, 10);

    if (!perms.canDelegateDecision) {
      res.status(403).json({ error: "Requires Undersecretary role" });
      return;
    }

    try {
      const [decision] = await db
        .select()
        .from(decisionsTable)
        .where(eq(decisionsTable.id, id));

      if (!decision) {
        res.status(404).json({ error: "Decision not found" });
        return;
      }

      const meta = { ...(decision.metadata as Record<string, unknown> ?? {}) };
      delete meta.delegatedForReview;
      delete meta.delegatedAt;
      delete meta.delegatedBy;

      await db
        .update(decisionsTable)
        .set({ metadata: meta, updatedAt: new Date() })
        .where(eq(decisionsTable.id, id));

      // Phase 3 — Chain of Custody: undelegation event
      recordCustodyEvent({
        decisionId: id,
        userId:       getUserId(req),
        userRole:     role,
        organization: getUserOrg(req),
        action:         "decision.undelegated",
        actionCategory: "governance",
        deviceInfo:  { userAgent: req.headers["user-agent"] ?? "" },
        ipAddress:   String(Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? ""),
        previousValue: { delegatedForReview: true },
        newValue:    { delegatedForReview: false },
        legalJustification: "إلغاء تفويض المراجعة الإلزامية",
        aiRecommendation:   null,
        humanModification:  "إلغاء التفويض الإداري",
      }).catch((e: unknown) => console.error("[custody.undelegate]", e));

      // Phase 3 — Constitutional Memory: undelegation event
      recordMemoryEvent({
        decisionId: id,
        eventType:      "amendment",
        eventSummaryAr: "إلغاء تفويض المراجعة الإلزامية",
        eventSummaryEn: "Mandatory review delegation removed",
        actorId:   String(getUserId(req)),
        actorRole: role,
        actorOrg:  getUserOrg(req),
        payload:   { undelegatedAt: new Date().toISOString() },
      }).catch((e: unknown) => console.error("[memory.event.undelegate]", e));

      // Phase 4 — Evidence Ledger: undelegation
      recordEvidenceEvent({
        decisionId:         id,
        action:             "decision.undelegated",
        eventCategory:      "governance",
        actor:              String(getUserId(req)),
        actorRole:          role,
        actorOrg:           getUserOrg(req),
        affectedObject:     `decision:${id}`,
        affectedObjectType: "decision",
        evidenceSummaryAr:  "إلغاء تفويض المراجعة الإلزامية",
        evidenceSummaryEn:  "Mandatory review delegation removed",
        metadata:           { undelegatedAt: new Date().toISOString() },
      }).catch((e: unknown) => console.error("[evidence.undelegate]", e));

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── GET /api/governance/citizen/car ──────────────────────────────────────────
// Public: look up a CAR by case number. No auth required — case number is the key.

router.get("/governance/citizen/car", async (req, res) => {
  const caseNumber = (req.query.caseNumber as string ?? "").trim().toUpperCase();

  if (!caseNumber || caseNumber.length < 4) {
    res.status(400).json({ error: "رقم القضية مطلوب" });
    return;
  }

  try {
    const [decision] = await db
      .select({ id: decisionsTable.id, caseNumber: decisionsTable.caseNumber, titleAr: decisionsTable.titleAr })
      .from(decisionsTable)
      .where(eq(decisionsTable.caseNumber, caseNumber));

    if (!decision) {
      res.status(404).json({ error: "لم يُعثر على قرار بهذا الرقم" });
      return;
    }

    // Only serve CAR for sealed decisions
    const [dci] = await db
      .select({ isSealed: decisionDciTable.isSealed })
      .from(decisionDciTable)
      .where(eq(decisionDciTable.decisionId, decision.id));

    if (!dci?.isSealed) {
      res.status(404).json({ error: "هذا القرار غير مُختوم بعد. لا يمكن الاطلاع على سجل المساءلة." });
      return;
    }

    const [car] = await db
      .select()
      .from(decisionCarTable)
      .where(eq(decisionCarTable.decisionId, decision.id));

    if (!car || car.status !== "ready") {
      res.status(404).json({ error: "سجل المساءلة الدستورية لهذا القرار غير متاح بعد" });
      return;
    }

    // Phase 3 — include custody summary for public attestation (no sensitive hashes).
    // Wrapped in try-catch so a custody service failure never breaks the primary
    // citizen CAR response (custody is supplemental information here).
    let custodySummary: {
      recordCount: number;
      valid: boolean | null;
      latestChainHash: string | null;
      genesisTimestamp: Date | null;
      latestTimestamp: Date | null;
    } | null = null;
    try {
      const custodyChain  = await getDecisionCustody(decision.id);
      const custodyVerify = await verifyCustodyChain(decision.id);
      custodySummary = {
        recordCount:      custodyChain.length,
        valid:            custodyVerify.valid,
        latestChainHash:  custodyChain.at(-1)?.chainHash ? custodyChain.at(-1)!.chainHash.slice(0, 16) + "…" : null,
        genesisTimestamp: custodyChain[0]?.timestamp ?? null,
        latestTimestamp:  custodyChain.at(-1)?.timestamp ?? null,
      };
    } catch (custodyErr) {
      console.error("[custody.citizen-car] non-fatal custody summary error:", custodyErr);
    }

    res.json({ decision, car, custodySummary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطأ داخلي في الخادم" });
  }
});

export default router;
