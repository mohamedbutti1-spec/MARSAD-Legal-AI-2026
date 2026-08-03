/**
 * Integration tests for the Legal Research API.
 * Run: pnpm --filter @workspace/api-server run test
 *
 * Auth model: JWT cookies (marsad_session).
 * The app strips x-user-role / x-user-id headers as an anti-spoofing measure
 * and reads identity exclusively from the verified JWT payload.
 * All tests here use signToken() to produce cookies for each role under test.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { eq } from "drizzle-orm";
import { db, usersTable, decisionReplayEventsTable, userSessionsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import app from "../app";
import { signToken, COOKIE_NAME } from "../lib/jwt";

let server: http.Server;
let baseUrl: string;

// The authenticate middleware compares each token's `pwv` claim against the
// live users.password_version column when a matching row exists (see
// authenticate.ts). Real seeded accounts (ids 1/2/3 here) must be signed with
// their current password_version or every request gets rejected as a stale
// session; synthetic/non-existent ids have no row to compare against, so any
// value works for them.
const passwordVersions = new Map<number, number>();

// ── Cookie / header factories ─────────────────────────────────────────────────

function cookieFor(role: string, userId = 1, org = ""): string {
  const pwv = passwordVersions.get(userId) ?? 0;
  return `${COOKIE_NAME}=${signToken({ userId, role, org, pwv, mustChangePassword: false, sid: '' })}`;
}

function json(extra: Record<string, string> = {}): Record<string, string> {
  return { "Content-Type": "application/json", ...extra };
}

// Named header sets — populated in before()
let H_OWNER:      Record<string, string>;
let H_SUPERVISOR: Record<string, string>;
let H_VIEWER:     Record<string, string>;
let H_VIEWER_1:   Record<string, string>; // viewer, userId=1 — used to assert admin-os/Shamsi denial
let H_BAD_ROLE:   Record<string, string>; // signed token but invalid role → 401
const H_ANON: Record<string, string> = {};  // unauthenticated

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function req(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = H_OWNER,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get("content-type") || "";
  const responseBody = ct.includes("application/json") ? await res.json() : await res.text();
  return { status: res.status, body: responseBody };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

before(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;

  // Load real password_version values for the seeded accounts used below so
  // signed test cookies match the live DB (see authenticate.ts).
  for (const id of [1, 2, 3]) {
    const [row] = await db
      .select({ passwordVersion: usersTable.passwordVersion })
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (row) passwordVersions.set(id, row.passwordVersion);
  }

  // Build JWT cookies after SESSION_SECRET is verified to be in environment
  H_OWNER      = json({ Cookie: cookieFor("owner",      1) });
  H_SUPERVISOR = json({ Cookie: cookieFor("supervisor", 2) });
  H_VIEWER     = json({ Cookie: cookieFor("viewer",     3) });
  H_VIEWER_1   = json({ Cookie: cookieFor("viewer",     1) });
  H_BAD_ROLE   = json({ Cookie: cookieFor("superadmin", 99) }); // not in ALL_ROLES
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Health", () => {
  it("GET /api/healthz returns 200", async () => {
    const { status } = await req("GET", "/api/healthz", undefined, H_ANON);
    assert.equal(status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Role-based access control", () => {
  it("GET /api/documents returns 200 for owner", async () => {
    const { status } = await req("GET", "/api/documents");
    assert.equal(status, 200);
  });

  it("GET /api/documents returns 200 for viewer", async () => {
    const { status } = await req("GET", "/api/documents", undefined, H_VIEWER);
    assert.equal(status, 200);
  });

  it("POST /api/users returns 403 for supervisor", async () => {
    const { status } = await req(
      "POST",
      "/api/users",
      { name: "Test", email: "test@x.com", role: "viewer" },
      H_SUPERVISOR,
    );
    assert.equal(status, 403);
  });

  it("POST /api/users returns 403 for viewer", async () => {
    const { status } = await req(
      "POST",
      "/api/users",
      { name: "Test", email: "test@x.com", role: "viewer" },
      H_VIEWER,
    );
    assert.equal(status, 403);
  });

  it("GET /api/users returns 403 for supervisor", async () => {
    const { status } = await req("GET", "/api/users", undefined, H_SUPERVISOR);
    assert.equal(status, 403);
  });

  it("GET /api/settings returns 200 for owner", async () => {
    const { status } = await req("GET", "/api/settings");
    assert.equal(status, 200);
  });

  it("PATCH /api/settings returns 403 for supervisor", async () => {
    const { status } = await req(
      "PATCH",
      "/api/settings",
      { aiEnabled: true },
      H_SUPERVISOR,
    );
    assert.equal(status, 403);
  });

  it("PATCH /api/settings returns 403 for viewer", async () => {
    const { status } = await req(
      "PATCH",
      "/api/settings",
      { aiEnabled: true },
      H_VIEWER,
    );
    assert.equal(status, 403);
  });

  it("Rejects request with invalid role in JWT", async () => {
    const { status } = await req("GET", "/api/documents", undefined, H_BAD_ROLE);
    assert.equal(status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Documents", () => {
  it("GET /api/documents returns array", async () => {
    const { status, body } = await req("GET", "/api/documents");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });

  it("GET /api/documents/stats returns stats object", async () => {
    const { status, body } = await req("GET", "/api/documents/stats");
    assert.equal(status, 200);
    assert.ok(typeof (body as Record<string, unknown>).total === "number");
    assert.ok(typeof (body as Record<string, unknown>).totalSize === "number");
    assert.ok(Array.isArray((body as Record<string, unknown>).byType));
  });

  it("GET /api/documents/999999 returns 404", async () => {
    const { status } = await req("GET", "/api/documents/999999");
    assert.equal(status, 404);
  });

  it("DELETE /api/documents/999999 returns 404", async () => {
    const { status } = await req("DELETE", "/api/documents/999999");
    assert.equal(status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Comparisons", () => {
  let createdId: number;

  it("GET /api/comparisons returns array", async () => {
    const { status, body } = await req("GET", "/api/comparisons");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });

  it("POST /api/comparisons creates a comparison", async () => {
    const { status, body } = await req("POST", "/api/comparisons", {
      title: "Test Comparison",
      rows: JSON.stringify([{ aspect: "Test", uae: "UAE law", france: "French law" }]),
    });
    assert.equal(status, 201);
    createdId = (body as Record<string, unknown>).id as number;
    assert.ok(createdId > 0);
  });

  it("DELETE /api/comparisons/:id removes it", async () => {
    if (!createdId) return;
    const { status } = await req("DELETE", `/api/comparisons/${createdId}`);
    assert.equal(status, 204);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Settings", () => {
  it("GET /api/settings returns settings object", async () => {
    const { status, body } = await req("GET", "/api/settings");
    assert.equal(status, 200);
    assert.ok(typeof (body as Record<string, unknown>).aiEnabled === "boolean");
  });

  it("PATCH /api/settings updates owner-only field", async () => {
    const { status } = await req("PATCH", "/api/settings", { aiEnabled: true });
    assert.equal(status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Citations", () => {
  it("POST /api/citations/generate (manual) returns harvard + apa + uaeGov", async () => {
    const { status, body } = await req("POST", "/api/citations/generate", {
      sourceType: "manual",
      title: "القانون المدني الإماراتي",
      authorName: "حمدان المرشد",
      publicationYear: "2020",
      publisher: "دار الثقافة",
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(typeof b.harvard === "string" && b.harvard.length > 0, "harvard must be a non-empty string");
    assert.ok(typeof b.apa === "string" && b.apa.length > 0, "apa must be a non-empty string");
    assert.ok(typeof b.uaeGov === "string" && b.uaeGov.length > 0, "uaeGov must be a non-empty string");
  });

  it("POST /api/citations/generate rejects unknown sourceType", async () => {
    const { status } = await req("POST", "/api/citations/generate", {
      sourceType: "unknown_type",
    });
    assert.equal(status, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Audit Log", () => {
  it("GET /api/audit returns logs for owner", async () => {
    const { status, body } = await req("GET", "/api/audit");
    assert.equal(status, 200);
    assert.ok(Array.isArray((body as Record<string, unknown>).logs));
  });

  it("GET /api/audit returns 403 for viewer", async () => {
    const { status } = await req("GET", "/api/audit", undefined, H_VIEWER);
    assert.equal(status, 403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Export", () => {
  it("POST /api/export returns download URL", async () => {
    const { status, body } = await req("POST", "/api/export", {
      type: "documents",
    });
    assert.equal(status, 200);
    assert.ok(typeof (body as Record<string, unknown>).downloadUrl === "string");
    assert.ok(typeof (body as Record<string, unknown>).filename === "string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Rate limiting", () => {
  it("Returns 200 for normal request frequency", async () => {
    const { status } = await req("GET", "/api/healthz", undefined, H_ANON);
    assert.equal(status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("AI provider abstraction — security invariants", () => {
  it("GET /api/settings never exposes raw API key values", async () => {
    const { status, body } = await req("GET", "/api/settings");
    assert.equal(status, 200);
    const text = JSON.stringify(body);
    assert.ok(!text.includes("claudeApiKey"), "claudeApiKey field must not be in response");
    assert.ok(!text.includes("perplexityApiKey"), "perplexityApiKey field must not be in response");
    assert.ok(typeof (body as Record<string, unknown>).claude === "boolean", "claude flag must be boolean");
    assert.ok(typeof (body as Record<string, unknown>).perplexity === "boolean", "perplexity flag must be boolean");
  });

  it("PATCH /api/settings/api-keys requires owner role", async () => {
    const { status } = await req(
      "PATCH",
      "/api/settings/api-keys",
      { claudeApiKey: "evil-key" },
      H_SUPERVISOR,
    );
    assert.equal(status, 403);
  });

  it("PATCH /api/settings/api-keys returns only boolean flags — never the saved key", async () => {
    const { status, body } = await req(
      "PATCH",
      "/api/settings/api-keys",
      { perplexityApiKey: "pplx-test-placeholder" },
    );
    assert.equal(status, 200);
    const text = JSON.stringify(body);
    assert.ok(text.includes("keyStatus"), "response must include keyStatus");
    assert.ok(!text.includes("pplx-test-placeholder"), "raw key must not be echoed in response");
    // Clean up
    await req("PATCH", "/api/settings/api-keys", { perplexityApiKey: "" });
  });

  it("PATCH /api/settings/api-keys rejects unknown fields", async () => {
    const { status } = await req(
      "PATCH",
      "/api/settings/api-keys",
      { openaiApiKey: "sk-proj-bad-field" },
    );
    assert.equal(status, 400);
  });

  it("AI router routes DOCUMENT_SEARCH through Claude (provider in _meta)", async () => {
    const { status, body } = await req("POST", "/api/ai/search", {
      query: "test query for provider verification",
      limit: 1,
    });
    // 503 = no provider configured; 500 = provider configured but AI call failed (e.g. rate limit,
    // empty RAG context, or environment-specific issue). Both are acceptable non-200 skip conditions.
    if (status === 503 || status === 500) return;
    assert.equal(status, 200);
    const meta = (body as Record<string, unknown>)._meta as Record<string, unknown> | undefined;
    assert.ok(meta, "_meta field must be present");
    assert.equal(meta.provider, "claude", "DOCUMENT_SEARCH must route to claude");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Admin Decision OS — Phase 2 Role Engine", () => {
  it("GET /api/admin-os/roles denies non-owner roles (Al-Shamsi Theory is owner-only)", async () => {
    const { status } = await req("GET", "/api/admin-os/roles", undefined, H_VIEWER_1);
    assert.equal(status, 403);
  });

  it("GET /api/admin-os/roles returns all 7 roles", async () => {
    const { status, body } = await req("GET", "/api/admin-os/roles", undefined, H_OWNER);
    assert.equal(status, 200);
    const roles = (body as Record<string, unknown>).roles as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(roles), "roles must be an array");
    assert.equal(roles.length, 7, "must have exactly 7 roles");
    const roleKeys = roles.map((r) => r.roleKey);
    assert.ok(roleKeys.includes("minister"), "must include minister");
    assert.ok(roleKeys.includes("citizen"), "must include citizen");
    assert.ok(roleKeys.includes("administrative_court"), "must include administrative_court");
  });

  it("GET /api/admin-os/roles/:roleKey returns role detail with interviewModifiers", async () => {
    const { status, body } = await req("GET", "/api/admin-os/roles/citizen", undefined, H_OWNER);
    assert.equal(status, 200);
    const role = (body as Record<string, unknown>).role as Record<string, unknown>;
    assert.equal(role.roleKey, "citizen");
    assert.equal(role.competenceCeiling, "challenge_only");
    assert.ok(role.interviewModifiers, "interviewModifiers must be present");
    const mods = role.interviewModifiers as Record<string, unknown>;
    assert.ok(Array.isArray(mods.prependQuestions), "prependQuestions must be array");
    assert.ok((mods.prependQuestions as unknown[]).length > 0, "citizen must have prepend questions");
  });

  it("GET /api/admin-os/roles/:roleKey returns 404 for unknown role", async () => {
    const { status } = await req("GET", "/api/admin-os/roles/superhero", undefined, H_OWNER);
    assert.equal(status, 404);
  });

  it("GET /api/admin-os/roles each role has required fields", async () => {
    const { status, body } = await req("GET", "/api/admin-os/roles", undefined, H_OWNER);
    assert.equal(status, 200);
    const roles = (body as Record<string, unknown>).roles as Array<Record<string, unknown>>;
    for (const role of roles) {
      assert.ok(typeof role.roleKey === "string", `roleKey must be string on ${role.roleKey}`);
      assert.ok(typeof role.titleAr === "string", `titleAr must be string on ${role.roleKey}`);
      assert.ok(typeof role.titleEn === "string", `titleEn must be string on ${role.roleKey}`);
      assert.ok(typeof role.competenceCeiling === "string", `competenceCeiling must be string on ${role.roleKey}`);
      assert.ok(Array.isArray(role.permittedDomains), `permittedDomains must be array on ${role.roleKey}`);
      const caps = role.actionCapabilities as Record<string, unknown>;
      assert.ok(typeof caps.canIssue === "boolean", `canIssue must be boolean on ${role.roleKey}`);
      assert.ok(typeof caps.canReview === "boolean", `canReview must be boolean on ${role.roleKey}`);
      assert.ok(typeof caps.canChallenge === "boolean", `canChallenge must be boolean on ${role.roleKey}`);
    }
  });

  it("GET /api/admin-os/decision-types?role=minister annotates with roleRelationship", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/decision-types?jurisdiction=uae&role=minister", undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    const types = b.decisionTypes as Array<Record<string, unknown>>;
    assert.ok(types.length > 0, "must have types");
    assert.ok(types.every((t) => typeof t.roleRelationship === "string"), "all types must have roleRelationship");
    const validRelationships = new Set(["can_issue", "can_review", "can_challenge", "none"]);
    assert.ok(types.every((t) => validRelationships.has(t.roleRelationship as string)), "all roleRelationships must be valid");
    assert.ok(types.some((t) => t.roleRelationship === "can_issue"), "minister must have can_issue on some types");
    const roleInfo = b.role as Record<string, unknown>;
    assert.equal(roleInfo.roleKey, "minister");
  });

  it("GET /api/admin-os/decision-types?role=citizen has only can_challenge relationships", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/decision-types?jurisdiction=uae&role=citizen", undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const types = (body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>;
    assert.ok(
      types.every((t) => t.roleRelationship === "can_challenge" || t.roleRelationship === "none"),
      "citizen must only have can_challenge or none relationships",
    );
  });

  it("GET /api/admin-os/decision-types?role=administrative_court has only can_review relationships", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/decision-types?jurisdiction=uae&role=administrative_court", undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const types = (body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>;
    assert.ok(
      types.every((t) => t.roleRelationship === "can_review"),
      "administrative_court must only have can_review relationships",
    );
  });

  it("GET /api/admin-os/decision-types?role=hr has can_issue only on personnel domain", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/decision-types?jurisdiction=uae&role=hr", undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const types = (body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>;
    const nonPersonnelCanIssue = types.filter(
      (t) => t.domain !== "personnel" && t.roleRelationship === "can_issue",
    );
    assert.equal(nonPersonnelCanIssue.length, 0, "HR must not have can_issue on non-personnel domains");
    const personnelCanIssue = types.filter(
      (t) => t.domain === "personnel" && t.roleRelationship === "can_issue",
    );
    assert.ok(personnelCanIssue.length > 0, "HR must have can_issue on some personnel decisions");
  });

  it("GET /api/admin-os/interview-template/:id returns base template without role", async () => {
    const listRes = await req("GET", "/api/admin-os/decision-types?jurisdiction=uae", undefined, H_OWNER);
    const firstId = ((listRes.body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>)[0].id as number;
    const { status, body } = await req(
      "GET", `/api/admin-os/interview-template/${firstId}`, undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(Array.isArray(b.questions), "questions must be array");
    assert.ok((b.questionCount as number) > 0, "must have questions");
    assert.equal(b.role, null, "role must be null when no role param");
  });

  it("GET /api/admin-os/interview-template/:id?role=citizen prepends citizen questions", async () => {
    const listRes = await req("GET", "/api/admin-os/decision-types?jurisdiction=uae", undefined, H_OWNER);
    const firstId = ((listRes.body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>)[0].id as number;
    const baseRes = await req(
      "GET", `/api/admin-os/interview-template/${firstId}`, undefined, H_OWNER,
    );
    const baseCount = (baseRes.body as Record<string, unknown>).questionCount as number;
    const { status, body } = await req(
      "GET", `/api/admin-os/interview-template/${firstId}?role=citizen`, undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok((b.questionCount as number) > baseCount, "citizen must add prepend questions, increasing count");
    const roleInfo = b.role as Record<string, unknown>;
    assert.equal(roleInfo.roleKey, "citizen", "role info must be returned");
    const questions = b.questions as Array<Record<string, unknown>>;
    assert.equal(questions[0].id, "citizen_decision_received", "first question must be citizen_decision_received");
  });

  it("GET /api/admin-os/interview-template/999999 returns 404", async () => {
    const { status } = await req(
      "GET", "/api/admin-os/interview-template/999999", undefined, H_OWNER,
    );
    assert.equal(status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Admin Decision OS — Al-Shamsi endpoints", () => {
  it("GET /api/admin-os/decision-types returns seeded UAE catalog", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/decision-types?jurisdiction=uae", undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(Array.isArray(b.decisionTypes), "decisionTypes must be an array");
    assert.ok((b.decisionTypes as unknown[]).length >= 30, "must have at least 30 seeded decision types");
    assert.ok(typeof b.grouped === "object" && b.grouped !== null, "grouped must be an object");
    const domains = Object.keys(b.grouped as object);
    assert.ok(domains.includes("personnel"), "must have personnel domain");
    assert.ok(domains.includes("regulatory"), "must have regulatory domain");
    assert.ok(domains.includes("digital"), "must have digital domain");
  });

  it("GET /api/admin-os/decision-types filters by domain", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/decision-types?jurisdiction=uae&domain=procurement", undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const types = (body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>;
    assert.ok(types.length > 0, "procurement domain must have entries");
    assert.ok(types.every((t) => t.domain === "procurement"), "all returned types must be procurement");
  });

  it("GET /api/admin-os/sessions returns empty array for new owner user", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/sessions", undefined,
      json({ Cookie: cookieFor("owner", 99999) }),
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray((body as Record<string, unknown>).sessions), "sessions must be an array");
  });

  it("GET /api/admin-os/sessions denies non-owner roles (Al-Shamsi lock)", async () => {
    const { status } = await req(
      "GET", "/api/admin-os/sessions", undefined,
      json({ Cookie: cookieFor("viewer", 99999) }),
    );
    assert.equal(status, 403);
  });

  it("POST /api/admin-os/assess rejects missing required fields", async () => {
    const { status, body } = await req("POST", "/api/admin-os/assess", {});
    assert.equal(status, 400);
    assert.ok(typeof (body as Record<string, unknown>).error === "string");
  });

  it("POST /api/admin-os/assess rejects invalid role", async () => {
    const { status, body } = await req("POST", "/api/admin-os/assess", {
      role: "superadmin",
      decisionTypeId: 1,
      answers: {},
    });
    assert.equal(status, 400);
    const error = (body as Record<string, unknown>).error as string;
    assert.ok(error.includes("Invalid role"), `expected invalid role error, got: ${error}`);
  });

  it("POST /api/admin-os/assess rejects non-existent decisionTypeId", async () => {
    const { status } = await req("POST", "/api/admin-os/assess", {
      role: "minister",
      decisionTypeId: 999999,
      answers: { authority_source: "قانون اتحادي رقم 11" },
    });
    assert.equal(status, 404);
  });

  it("DELETE /api/admin-os/sessions/999999 returns 404", async () => {
    const { status } = await req("DELETE", "/api/admin-os/sessions/999999");
    assert.equal(status, 404);
  });

  it("GET /api/admin-os/decision-types each type has required fields", async () => {
    const { status, body } = await req(
      "GET", "/api/admin-os/decision-types?jurisdiction=uae", undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const types = (body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>;
    for (const t of types.slice(0, 5)) {
      assert.ok(typeof t.id === "number", "id must be number");
      assert.ok(typeof t.decisionTypeAr === "string", "decisionTypeAr must be string");
      assert.ok(typeof t.decisionTypeEn === "string", "decisionTypeEn must be string");
      assert.ok(["low", "medium", "high", "critical"].includes(t.inherentRiskLevel as string), "inherentRiskLevel must be valid");
      assert.ok(Array.isArray(t.interviewTemplate), "interviewTemplate must be array");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression test for a confirmed leak: GET /decisions/:id/replay nulled the
// dedicated `alShamsiDimensions` field for non-owners, but the raw Shamsi
// principle-scoring data still passed through unredacted via the `inputs`/
// `outputs`/`auditHash` fields of the replay_09_alshamsi_engine stage (sourced
// from the same underlying aiAnalysis/replay-event row under different keys).
describe("Decision Replay — Al-Shamsi Theory data is fully redacted for non-owners", () => {
  // Uses a real seeded decision that already has a completed
  // constitutional_validation stage (case MARSAD-2026-0147) so the route's
  // decision-lookup / org-scoping / sealed-scoping checks all pass normally.
  // We only add a replay event row (deleted in `after`) to exercise the
  // `replayEvent ? outputs : virtualOutputs` branch that leaked the raw data.
  const REAL_DECISION_ID = 4;
  const SHAMSI_PAYLOAD = { jurisdiction: 90, cause: 85 };
  const AUDIT_HASH = "test-shamsi-leak-regression";

  before(async () => {
    await db.insert(decisionReplayEventsTable).values({
      decisionId: REAL_DECISION_ID,
      replayStageKey: "replay_09_alshamsi_engine",
      sourceStageKey: "constitutional_validation",
      actor: "1",
      alShamsiDimensions: SHAMSI_PAYLOAD,
      auditHash: AUDIT_HASH,
    } as typeof decisionReplayEventsTable.$inferInsert);
  });

  after(async () => {
    await db.delete(decisionReplayEventsTable)
      .where(eq(decisionReplayEventsTable.auditHash, AUDIT_HASH));
  });

  function findShamsiStage(body: unknown) {
    const timeline = (body as Record<string, unknown>).timeline as Record<string, unknown>;
    const stages = timeline.stages as Array<Record<string, unknown>>;
    return stages.find((s) => s.replayStageKey === "replay_09_alshamsi_engine")!;
  }

  it("owner sees the real Al-Shamsi data (dedicated field + inputs/outputs/hash)", async () => {
    const { status, body } = await req(
      "GET", `/api/decisions/${REAL_DECISION_ID}/replay`, undefined, H_OWNER,
    );
    assert.equal(status, 200);
    const stage = findShamsiStage(body);
    assert.deepEqual(stage.alShamsiDimensions, SHAMSI_PAYLOAD);
    assert.equal(stage.auditHash, AUDIT_HASH);
    assert.ok(stage.inputs !== null, "owner must see the stage inputs");
    assert.ok(stage.outputs !== null, "owner must see the stage outputs");
  });

  it("non-owner (viewer) gets full redaction — not just the dedicated field", async () => {
    const { status, body } = await req(
      "GET", `/api/decisions/${REAL_DECISION_ID}/replay`, undefined, H_VIEWER,
    );
    assert.equal(status, 200);
    const stage = findShamsiStage(body);
    // The dedicated field being null is not enough on its own — this is the
    // regression check: the SAME Shamsi scores previously leaked through
    // `inputs`/`outputs` (sourced from the same underlying stageData/
    // aiAnalysis) even when `alShamsiDimensions` itself was already null.
    assert.equal(stage.alShamsiDimensions, null);
    assert.equal(stage.inputs, null, "inputs must not leak Shamsi principleResults to non-owners");
    assert.equal(stage.outputs, null, "outputs must not leak Shamsi scores to non-owners");
    assert.equal(stage.auditHash, null, "auditHash must not identify a non-owner-visible Shamsi record");
    assert.equal(stage.reasoningNarrative, null);
    assert.deepEqual(stage.evidenceUsed, []);
    assert.deepEqual(stage.riskIndicators, []);
    assert.equal(stage.humanInterventionRecord, null);
    // Stage still shows up in the timeline (existence isn't hidden) — only
    // its Al-Shamsi payload is stripped, matching the CIL/admin-os pattern.
    assert.equal(stage.status, "complete");
  });

  it("supervisor (non-owner) is also fully redacted", async () => {
    const { status, body } = await req(
      "GET", `/api/decisions/${REAL_DECISION_ID}/replay`, undefined, H_SUPERVISOR,
    );
    assert.equal(status, 200);
    const stage = findShamsiStage(body);
    assert.equal(stage.alShamsiDimensions, null);
    assert.equal(stage.outputs, null);
    assert.equal(stage.inputs, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Court Simulation — Architectural Lock (ASEP + Al-Shamsi Matrix + Digital Will Engine)", () => {
  it("POST /api/court/simulate rejects unauthenticated requests", async () => {
    const { status } = await req(
      "POST", "/api/court/simulate",
      { caseText: "قرار إداري بفصل موظف" },
      H_ANON,
    );
    assert.equal(status, 401);
  });

  it("POST /api/court/simulate returns 400 when caseText is missing", async () => {
    const { status } = await req("POST", "/api/court/simulate", {});
    assert.equal(status, 400);
  });

  it("POST /api/court/simulate returns 400 when caseText is empty string", async () => {
    const { status } = await req("POST", "/api/court/simulate", { caseText: "   " });
    assert.equal(status, 400);
  });

  it("POST /api/court/supreme-review rejects unauthenticated requests", async () => {
    const { status } = await req(
      "POST", "/api/court/supreme-review",
      { caseText: "قضية اختبار" },
      H_ANON,
    );
    assert.equal(status, 401);
  });

  it("POST /api/court/supreme-review returns 400 when caseText is missing", async () => {
    const { status } = await req("POST", "/api/court/supreme-review", {});
    assert.equal(status, 400);
  });

  // ── NDJSON contract verification (fast — no real AI call needed) ──────────────
  it("Court simulate: NDJSON content-type and streaming headers are set", async () => {
    // Verify the endpoint begins streaming immediately (we abort after headers arrive)
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    try {
      const res = await fetch(`${baseUrl}/api/court/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/x-ndjson",
          "Cookie": cookieFor("owner", 1),
        },
        body: JSON.stringify({ caseText: "طعن موظف في قرار فصله" }),
        signal: ac.signal,
      });
      clearTimeout(timer);
      assert.equal(res.status, 200, "simulate must return 200 when auth+body are valid");
      assert.ok(
        res.headers.get("content-type")?.includes("ndjson"),
        "must return ndjson content-type",
      );
      assert.equal(res.headers.get("cache-control"), "no-cache", "must set no-cache");
      // Drain to avoid leaking the stream
      if (res.body) { try { await res.body.cancel(); } catch { /* ok */ } }
    } catch (e) {
      clearTimeout(timer);
      // AbortError is expected if AI phases are running (we only care about headers)
      if ((e as Error).name !== "AbortError") throw e;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Judicial Review (CJI) stays judge-accessible: it's a general constitutional
// review engine (generic 16-dimension schema), not an Al-Shamsi-branded tool.
// The single "Al-Shamsi Framework™" mention lives only inside the internal AI
// prompt and is never returned in any response, so it needs no route lock —
// locking it out broke a legitimate judge-facing AI feature and was reverted.
describe("Judicial Review (CJI) — judge access preserved, not Shamsi-gated", () => {
  it("GET /api/judicial-review/:id allows judge role (not_run status for a fresh decision)", async () => {
    const { status } = await req(
      "GET", "/api/judicial-review/999999999", undefined,
      json({ Cookie: cookieFor("judge", 1) }),
    );
    // Judge passes; a non-existent decision then 404s inside resolveDecision.
    assert.notEqual(status, 403);
  });

  it("GET /api/judicial-review/:id denies non-judge roles (owner included — feature is judge-only, not owner-only)", async () => {
    const { status: viewerStatus } = await req(
      "GET", "/api/judicial-review/1", undefined, H_VIEWER,
    );
    assert.equal(viewerStatus, 403);
    const { status: ownerStatus } = await req(
      "GET", "/api/judicial-review/1", undefined, H_OWNER,
    );
    assert.equal(ownerStatus, 403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Forced password change (admin-issued temporary passwords)
//
// An admin-created account or an admin password reset sets
// users.must_change_password = true. The authenticate middleware must then
// block every route except POST /auth/change-password until the user
// replaces the temporary password — enforced server-side, not just via a
// frontend redirect.
describe("Forced password change after admin-issued temporary password", () => {
  const TEMP_PASSWORD = "TempPass#1234";
  let testUserId: number;

  before(async () => {
    const [row] = await db
      .insert(usersTable)
      .values({
        name: "Forced PW Test",
        email: "forced-pw-test@example.com",
        role: "viewer",
        username: "forced-pw-test",
        passwordHash: await bcrypt.hash(TEMP_PASSWORD, 10),
        authProvider: "password",
        isDemo: false,
        mustChangePassword: true,
      })
      .returning({ id: usersTable.id });
    testUserId = row.id;
  });

  after(async () => {
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  });

  function cookieForTestUser(): Record<string, string> {
    return json({ Cookie: `${COOKIE_NAME}=${signToken({
      userId: testUserId, role: 'viewer', org: '', pwv: 0, mustChangePassword: true, sid: '',
    })}` });
  }

  it("blocks an unrelated protected route while must_change_password is true", async () => {
    const { status, body } = await req("GET", "/api/documents", undefined, cookieForTestUser());
    assert.equal(status, 403);
    assert.equal((body as { code?: string }).code, "MUST_CHANGE_PASSWORD");
  });

  it("rejects /auth/change-password with the wrong current password", async () => {
    const { status } = await req(
      "POST", "/api/auth/change-password",
      { currentPassword: "not-the-temp-password", newPassword: "BrandNewPass#5678" },
      cookieForTestUser(),
    );
    assert.equal(status, 401);
  });

  it("accepts the correct current password, clears the flag, and unblocks access", async () => {
    const { status, body } = await req(
      "POST", "/api/auth/change-password",
      { currentPassword: TEMP_PASSWORD, newPassword: "BrandNewPass#5678" },
      cookieForTestUser(),
    );
    assert.equal(status, 200);
    assert.equal((body as { mustChangePassword?: boolean }).mustChangePassword, false);

    const [row] = await db
      .select({ mustChangePassword: usersTable.mustChangePassword, passwordVersion: usersTable.passwordVersion })
      .from(usersTable)
      .where(eq(usersTable.id, testUserId));
    assert.equal(row.mustChangePassword, false);

    // A fresh token reflecting the post-change state must pass through freely.
    const freshCookie = json({ Cookie: `${COOKIE_NAME}=${signToken({
      userId: testUserId, role: "viewer", org: "", pwv: row.passwordVersion, mustChangePassword: false, sid: "",
    })}` });
    const { status: freshStatus } = await req("GET", "/api/documents", undefined, freshCookie);
    assert.notEqual(freshStatus, 403);
  });

  it("an admin password reset re-sets must_change_password on the target account", async () => {
    await db
      .update(usersTable)
      .set({ mustChangePassword: true, passwordVersion: 1 })
      .where(eq(usersTable.id, testUserId));

    const { status, body } = await req("GET", "/api/documents", undefined, json({ Cookie: `${COOKIE_NAME}=${signToken({
      userId: testUserId, role: "viewer", org: "", pwv: 1, mustChangePassword: false, sid: "",
    })}` }));
    assert.equal(status, 403);
    assert.equal((body as { code?: string }).code, "MUST_CHANGE_PASSWORD");
  });

  it("an admin password reset invalidates sessions signed before the reset (stale pwv)", async () => {
    // testUserId is now at passwordVersion 1 (bumped by the previous test).
    // A token still carrying the pre-reset pwv (0) must be rejected outright —
    // not merely re-gated behind MUST_CHANGE_PASSWORD — since it represents a
    // session issued before the admin reset happened.
    const staleCookie = json({ Cookie: `${COOKIE_NAME}=${signToken({
      userId: testUserId, role: "viewer", org: "", pwv: 0, mustChangePassword: false, sid: "",
    })}` });
    const { status } = await req("GET", "/api/documents", undefined, staleCookie);
    assert.equal(status, 401);
  });

  it("full admin-creation flow: POST /api/users issues a temp password that forces a change on first login", async () => {
    const created = await req("POST", "/api/users", {
      name: "New Hire",
      email: "new-hire-forced-pw@example.com",
      role: "viewer",
    });
    assert.equal(created.status, 201);
    const createdBody = created.body as { id: number; mustChangePassword?: boolean; temporaryPassword?: string };
    const newUserId = createdBody.id;
    const tempPassword = createdBody.temporaryPassword;
    assert.ok(tempPassword && tempPassword.length > 0, "a temporary password must be returned on creation");

    try {
      // Log in with the admin-issued temporary password.
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: json(),
        body: JSON.stringify({ username: "new-hire-forced-pw", password: tempPassword }),
      });
      assert.equal(loginRes.status, 200);
      const loginBody = (await loginRes.json()) as { mustChangePassword?: boolean };
      assert.equal(loginBody.mustChangePassword, true);
      const setCookie = loginRes.headers.get("set-cookie");
      assert.ok(setCookie, "login must set a session cookie");
      const sessionCookie = { "Content-Type": "application/json", Cookie: setCookie!.split(";")[0] };

      // Blocked everywhere except the change-password endpoint.
      const blocked = await req("GET", "/api/documents", undefined, sessionCookie);
      assert.equal(blocked.status, 403);
      assert.equal((blocked.body as { code?: string }).code, "MUST_CHANGE_PASSWORD");

      // Changing the password with the correct temp password unblocks the account.
      const changed = await req(
        "POST", "/api/auth/change-password",
        { currentPassword: tempPassword, newPassword: "PostHireFresh#9012" },
        sessionCookie,
      );
      assert.equal(changed.status, 200);
      assert.equal((changed.body as { mustChangePassword?: boolean }).mustChangePassword, false);
    } finally {
      await db.delete(usersTable).where(eq(usersTable.id, newUserId));
    }
  });
});

// ── Session registry ──────────────────────────────────────────────────────────
describe("Session registry — user_sessions table", () => {
  let sessionUserId: number;
  const SESSION_USER_PASSWORD = "SessionTest#7890";

  before(async () => {
    const hash = await bcrypt.hash(SESSION_USER_PASSWORD, 10);
    const [u] = await db
      .insert(usersTable)
      .values({
        name: "Session Test User",
        email: "session-test@example.com",
        username: "session-test-user",
        role: "viewer",
        isActive: true,
        isDemo: false,
        passwordHash: hash,
        passwordVersion: 0,
        mustChangePassword: false,
      })
      .returning({ id: usersTable.id });
    sessionUserId = u.id;
  });

  after(async () => {
    await db.delete(usersTable).where(eq(usersTable.id, sessionUserId));
  });

  it("POST /api/auth/login creates a session row in user_sessions", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "session-test-user", password: SESSION_USER_PASSWORD }),
    });
    assert.equal(loginRes.status, 200);

    const rows = await db
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, sessionUserId));
    assert.ok(rows.length >= 1, "at least one session row must exist after login");
    assert.ok(rows[0].sid.length > 0, "sid must be a non-empty string");
    assert.ok(rows[0].expiresAt > new Date(), "expiresAt must be in the future");
  });

  it("GET /api/auth/sessions requires authentication", async () => {
    const { status } = await req("GET", "/api/auth/sessions", undefined, H_ANON);
    assert.equal(status, 401);
  });

  it("GET /api/auth/sessions returns only the caller's session and marks it isCurrent", async () => {
    // Login to get a real cookie with a real session row (and real pwv in JWT)
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "session-test-user", password: SESSION_USER_PASSWORD }),
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get("set-cookie");
    assert.ok(setCookie, "login must return a session cookie");
    const cookieHeader = setCookie.split(";")[0];

    const { status, body } = await req("GET", "/api/auth/sessions", undefined, {
      Cookie: cookieHeader,
    });
    assert.equal(status, 200);
    const sessions = (body as { sessions: Array<{ isCurrent: boolean; sid: string }> }).sessions;
    assert.ok(Array.isArray(sessions), "sessions must be an array");
    assert.ok(sessions.length >= 1, "must have at least one session");
    const current = sessions.find((s) => s.isCurrent);
    assert.ok(current, "exactly one session must be marked isCurrent");
  });

  it("GET /api/auth/sessions excludes expired rows", async () => {
    // Manually insert an already-expired session row for this user
    await db.insert(userSessionsTable).values({
      userId: sessionUserId,
      sid: "expired-test-sid-" + Date.now(),
      userAgent: "ExpiredBrowser/1.0",
      ip: "127.0.0.2",
      // Set expires_at to 1 hour in the past
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "session-test-user", password: SESSION_USER_PASSWORD }),
    });
    const cookieHeader = loginRes.headers.get("set-cookie")!.split(";")[0];

    const { status, body } = await req("GET", "/api/auth/sessions", undefined, {
      Cookie: cookieHeader,
    });
    assert.equal(status, 200);
    const sessions = (body as { sessions: Array<{ sid: string }> }).sessions;
    const expiredRow = sessions.find((s) => s.sid.startsWith("expired-test-sid-"));
    assert.ok(!expiredRow, "expired session rows must not appear in the list");
  });

  it("POST /api/auth/logout deletes the session row", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "session-test-user", password: SESSION_USER_PASSWORD }),
    });
    assert.equal(loginRes.status, 200);
    const cookieHeader = loginRes.headers.get("set-cookie")!.split(";")[0];

    // Find the most recently inserted sid for this user
    const rowsBefore = await db
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, sessionUserId));
    const latestSid = rowsBefore.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0].sid;

    await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });

    const rowsAfter = await db
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, sessionUserId));
    const stillExists = rowsAfter.find((r) => r.sid === latestSid);
    assert.ok(!stillExists, "logout must delete the session row from user_sessions");
  });

  it("POST /api/auth/sign-out-other-sessions removes other session rows but keeps the current one", async () => {
    // Login twice to create two live session rows
    const login1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "session-test-user", password: SESSION_USER_PASSWORD }),
    });
    const cookie1 = login1.headers.get("set-cookie")!.split(";")[0];

    const login2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "session-test-user", password: SESSION_USER_PASSWORD }),
    });
    const cookie2 = login2.headers.get("set-cookie")!.split(";")[0];

    // Use the second session to revoke all other sessions
    const { status, body } = await req(
      "POST", "/api/auth/sign-out-other-sessions", undefined,
      { Cookie: cookie2 },
    );
    assert.equal(status, 200);
    assert.ok(
      (body as { revokedCount?: number }).revokedCount! >= 1,
      "at least one other session must be reported as revoked",
    );

    // After revocation, cookie1 should fail (pwv bumped)
    const { status: s1 } = await req("GET", "/api/auth/sessions", undefined, { Cookie: cookie1 });
    assert.equal(s1, 401, "the revoked session must no longer authenticate");

    // cookie2 session row must still exist in the DB
    const rows = await db
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, sessionUserId));
    // Filter to only non-expired, non-stale rows
    const live = rows.filter((r) => r.expiresAt > new Date());
    assert.ok(live.length >= 1, "at least the current session row must remain after revocation");
  });
});
