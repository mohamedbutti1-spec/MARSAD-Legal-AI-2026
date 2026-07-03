/**
 * Admin CRUD for Legal OS scenario catalog
 *
 * GET    /legal-os-admin/roles                 — list all custom roles
 * POST   /legal-os-admin/roles                 — create a custom role
 * PUT    /legal-os-admin/roles/:id             — update a custom role
 * DELETE /legal-os-admin/roles/:id             — delete a custom role (+ its scenarios)
 *
 * GET    /legal-os-admin/scenarios             — list all custom scenarios (optionally ?roleKey=)
 * POST   /legal-os-admin/scenarios             — create a custom scenario
 * PUT    /legal-os-admin/scenarios/:id         — update a custom scenario
 * DELETE /legal-os-admin/scenarios/:id         — delete a custom scenario
 */
import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  legalOsCustomRolesTable,
  legalOsCustomScenariosTable,
} from "@workspace/db";
import { requireOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";

const router: IRouter = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const questionOptionSchema = z.object({
  value: z.string().min(1),
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
});

const questionNodeSchema = z.object({
  id: z.string().min(1),
  questionAr: z.string().min(1),
  questionEn: z.string().min(1),
  hintAr: z.string().optional(),
  answerType: z.enum(["chips", "yes-no", "text", "number"]),
  options: z.array(questionOptionSchema).optional(),
  placeholder: z.string().optional(),
  unit: z.string().optional(),
});

const createRoleSchema = z.object({
  roleKey: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_-]+$/, "roleKey must be lowercase alphanumeric/dash/underscore"),
  titleAr: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  descriptionAr: z.string().max(500).default(""),
  icon: z.string().max(60).default("UserCircle"),
  sortOrder: z.number().int().default(0),
});

const updateRoleSchema = createRoleSchema.partial().omit({ roleKey: true });

const createScenarioSchema = z.object({
  scenarioKey: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9_-]+$/, "scenarioKey must be lowercase alphanumeric/dash/underscore"),
  roleKey: z.string().min(1).max(80),
  titleAr: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  descriptionAr: z.string().max(500).default(""),
  jurisdictions: z.array(z.string()).default([]),
  estimatedMinutes: z.number().int().min(1).max(120).default(5),
  questions: z.array(questionNodeSchema).default([]),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateScenarioSchema = createScenarioSchema.partial().omit({ scenarioKey: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseId(param: string): number | null {
  const n = parseInt(param, 10);
  return isNaN(n) ? null : n;
}

// ─── Role CRUD ────────────────────────────────────────────────────────────────

router.get("/legal-os-admin/roles", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(legalOsCustomRolesTable)
    .orderBy(asc(legalOsCustomRolesTable.sortOrder), asc(legalOsCustomRolesTable.id));
  res.json({ roles: rows });
});

router.post("/legal-os-admin/roles", requireOwner, async (req, res): Promise<void> => {
  const parsed = createRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", detail: parsed.error.format() });
    return;
  }
  const data = parsed.data;

  // Check uniqueness
  const [existing] = await db
    .select({ id: legalOsCustomRolesTable.id })
    .from(legalOsCustomRolesTable)
    .where(eq(legalOsCustomRolesTable.roleKey, data.roleKey));
  if (existing) {
    res.status(409).json({ error: `A role with key "${data.roleKey}" already exists` });
    return;
  }

  const [created] = await db
    .insert(legalOsCustomRolesTable)
    .values(data)
    .returning();

  await logAudit(req, "legal-os-admin.role.create", { entityType: "legal_os_custom_role", entityId: created.id });
  res.status(201).json({ role: created });
});

router.put("/legal-os-admin/roles/:id", requireOwner, async (req, res): Promise<void> => {
  const id = parseId(req.params.id as string);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", detail: parsed.error.format() });
    return;
  }

  const [existing] = await db
    .select({ id: legalOsCustomRolesTable.id })
    .from(legalOsCustomRolesTable)
    .where(eq(legalOsCustomRolesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Role not found" }); return; }

  const [updated] = await db
    .update(legalOsCustomRolesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(legalOsCustomRolesTable.id, id))
    .returning();

  await logAudit(req, "legal-os-admin.role.update", { entityType: "legal_os_custom_role", entityId: id });
  res.json({ role: updated });
});

router.delete("/legal-os-admin/roles/:id", requireOwner, async (req, res): Promise<void> => {
  const id = parseId(req.params.id as string);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select({ roleKey: legalOsCustomRolesTable.roleKey })
    .from(legalOsCustomRolesTable)
    .where(eq(legalOsCustomRolesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Role not found" }); return; }

  // Cascade delete scenarios belonging to this role
  await db
    .delete(legalOsCustomScenariosTable)
    .where(eq(legalOsCustomScenariosTable.roleKey, existing.roleKey));

  await db.delete(legalOsCustomRolesTable).where(eq(legalOsCustomRolesTable.id, id));

  await logAudit(req, "legal-os-admin.role.delete", { entityType: "legal_os_custom_role", entityId: id });
  res.json({ ok: true });
});

// ─── Scenario CRUD ────────────────────────────────────────────────────────────

router.get("/legal-os-admin/scenarios", requireOwner, async (req, res): Promise<void> => {
  const roleKey = req.query.roleKey as string | undefined;

  const rows = roleKey
    ? await db
        .select()
        .from(legalOsCustomScenariosTable)
        .where(eq(legalOsCustomScenariosTable.roleKey, roleKey))
        .orderBy(asc(legalOsCustomScenariosTable.sortOrder), asc(legalOsCustomScenariosTable.id))
    : await db
        .select()
        .from(legalOsCustomScenariosTable)
        .orderBy(asc(legalOsCustomScenariosTable.sortOrder), asc(legalOsCustomScenariosTable.id));

  res.json({ scenarios: rows });
});

router.post("/legal-os-admin/scenarios", requireOwner, async (req, res): Promise<void> => {
  const parsed = createScenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", detail: parsed.error.format() });
    return;
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: legalOsCustomScenariosTable.id })
    .from(legalOsCustomScenariosTable)
    .where(eq(legalOsCustomScenariosTable.scenarioKey, data.scenarioKey));
  if (existing) {
    res.status(409).json({ error: `A scenario with key "${data.scenarioKey}" already exists` });
    return;
  }

  const [created] = await db
    .insert(legalOsCustomScenariosTable)
    .values(data)
    .returning();

  await logAudit(req, "legal-os-admin.scenario.create", { entityType: "legal_os_custom_scenario", entityId: created.id });
  res.status(201).json({ scenario: created });
});

router.put("/legal-os-admin/scenarios/:id", requireOwner, async (req, res): Promise<void> => {
  const id = parseId(req.params.id as string);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = updateScenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", detail: parsed.error.format() });
    return;
  }

  const [existing] = await db
    .select({ id: legalOsCustomScenariosTable.id })
    .from(legalOsCustomScenariosTable)
    .where(eq(legalOsCustomScenariosTable.id, id));
  if (!existing) { res.status(404).json({ error: "Scenario not found" }); return; }

  const [updated] = await db
    .update(legalOsCustomScenariosTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(legalOsCustomScenariosTable.id, id))
    .returning();

  await logAudit(req, "legal-os-admin.scenario.update", { entityType: "legal_os_custom_scenario", entityId: id });
  res.json({ scenario: updated });
});

router.delete("/legal-os-admin/scenarios/:id", requireOwner, async (req, res): Promise<void> => {
  const id = parseId(req.params.id as string);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select({ id: legalOsCustomScenariosTable.id })
    .from(legalOsCustomScenariosTable)
    .where(eq(legalOsCustomScenariosTable.id, id));
  if (!existing) { res.status(404).json({ error: "Scenario not found" }); return; }

  await db.delete(legalOsCustomScenariosTable).where(eq(legalOsCustomScenariosTable.id, id));

  await logAudit(req, "legal-os-admin.scenario.delete", { entityType: "legal_os_custom_scenario", entityId: id });
  res.json({ ok: true });
});

export default router;
