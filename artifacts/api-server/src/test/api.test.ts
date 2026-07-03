/**
 * Integration tests for the Legal Research API.
 * Run: pnpm --filter @workspace/api-server run test
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app";

let server: http.Server;
let baseUrl: string;

const OWNER_HEADERS = {
  "Content-Type": "application/json",
  "x-user-role": "owner",
  "x-user-id": "1",
};

const SUPERVISOR_HEADERS = {
  "Content-Type": "application/json",
  "x-user-role": "supervisor",
  "x-user-id": "2",
};

async function req(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = OWNER_HEADERS,
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

before(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("Health", () => {
  it("GET /api/health returns 200", async () => {
    const { status } = await req("GET", "/api/health", undefined, {});
    assert.equal(status, 200);
  });
});

describe("Role-based access control", () => {
  it("GET /api/documents returns 200 for owner", async () => {
    const { status } = await req("GET", "/api/documents");
    assert.equal(status, 200);
  });

  it("GET /api/documents returns 200 for viewer", async () => {
    const { status } = await req("GET", "/api/documents", undefined, {
      "x-user-role": "viewer",
      "x-user-id": "3",
    });
    assert.equal(status, 200);
  });

  it("POST /api/users returns 403 for supervisor", async () => {
    const { status } = await req(
      "POST",
      "/api/users",
      { name: "Test", email: "test@x.com", role: "viewer" },
      SUPERVISOR_HEADERS,
    );
    assert.equal(status, 403);
  });

  it("POST /api/users returns 403 for viewer", async () => {
    const { status } = await req(
      "POST",
      "/api/users",
      { name: "Test", email: "test@x.com", role: "viewer" },
      { "Content-Type": "application/json", "x-user-role": "viewer", "x-user-id": "3" },
    );
    assert.equal(status, 403);
  });

  it("GET /api/users returns 403 for supervisor", async () => {
    const { status } = await req("GET", "/api/users", undefined, SUPERVISOR_HEADERS);
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
      SUPERVISOR_HEADERS,
    );
    assert.equal(status, 403);
  });

  it("PATCH /api/settings returns 403 for viewer", async () => {
    const { status } = await req(
      "PATCH",
      "/api/settings",
      { aiEnabled: true },
      { "Content-Type": "application/json", "x-user-role": "viewer", "x-user-id": "3" },
    );
    assert.equal(status, 403);
  });

  it("Rejects request with invalid role", async () => {
    const { status } = await req("GET", "/api/documents", undefined, {
      "x-user-role": "superadmin",
      "x-user-id": "99",
    });
    assert.equal(status, 401);
  });
});

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

describe("Citations", () => {
  it("POST /api/citations generates citation", async () => {
    const { status, body } = await req("POST", "/api/citations", {
      type: "book",
      author: "حمدان المرشد",
      title: "القانون المدني الإماراتي",
      year: 2020,
      publisher: "دار الثقافة",
    });
    assert.equal(status, 200);
    assert.ok(typeof (body as Record<string, unknown>).citation === "string");
  });
});

describe("Audit Log", () => {
  it("GET /api/audit returns logs for owner", async () => {
    const { status, body } = await req("GET", "/api/audit");
    assert.equal(status, 200);
    assert.ok(Array.isArray((body as Record<string, unknown>).logs));
  });

  it("GET /api/audit returns 403 for viewer", async () => {
    const { status } = await req("GET", "/api/audit", undefined, {
      "x-user-role": "viewer",
      "x-user-id": "3",
    });
    assert.equal(status, 403);
  });
});

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

describe("Rate limiting", () => {
  it("Returns 200 for normal request frequency", async () => {
    const { status } = await req("GET", "/api/healthz", undefined, {});
    assert.equal(status, 200);
  });
});

describe("AI provider abstraction — security invariants", () => {
  it("GET /api/settings never exposes raw API key values", async () => {
    const { status, body } = await req("GET", "/api/settings");
    assert.equal(status, 200);
    const text = JSON.stringify(body);
    // Raw key fields must not appear in the response
    assert.ok(!text.includes("claudeApiKey"), "claudeApiKey field must not be in response");
    assert.ok(!text.includes("perplexityApiKey"), "perplexityApiKey field must not be in response");
    // Only boolean availability flags should be present
    assert.ok(typeof (body as Record<string, unknown>).claude === "boolean", "claude flag must be boolean");
    assert.ok(typeof (body as Record<string, unknown>).perplexity === "boolean", "perplexity flag must be boolean");
  });

  it("PATCH /api/settings/api-keys requires owner role", async () => {
    const { status } = await req(
      "PATCH",
      "/api/settings/api-keys",
      { claudeApiKey: "evil-key" },
      SUPERVISOR_HEADERS,
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
    // Response must contain keyStatus booleans
    assert.ok(text.includes("keyStatus"), "response must include keyStatus");
    // But must NEVER echo back the raw key value
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
    // This test only passes when a Claude key is configured.
    // Skip gracefully if the service returns 503.
    const { status, body } = await req("POST", "/api/ai/search", {
      query: "test query for provider verification",
      limit: 1,
    });
    if (status === 503) return; // No key configured in CI — acceptable
    assert.equal(status, 200);
    const meta = (body as Record<string, unknown>)._meta as Record<string, unknown> | undefined;
    assert.ok(meta, "_meta field must be present");
    assert.equal(meta.provider, "claude", "DOCUMENT_SEARCH must route to claude");
  });
});

describe("Admin Decision OS — Al-Shamsi endpoints", () => {
  it("GET /api/admin-os/decision-types returns seeded UAE catalog", async () => {
    const { status, body } = await req("GET", "/api/admin-os/decision-types?jurisdiction=uae", undefined, {
      "x-user-role": "viewer",
      "x-user-id": "1",
    });
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
    const { status, body } = await req("GET", "/api/admin-os/decision-types?jurisdiction=uae&domain=procurement", undefined, {
      "x-user-role": "viewer",
      "x-user-id": "1",
    });
    assert.equal(status, 200);
    const types = (body as Record<string, unknown>).decisionTypes as Array<Record<string, unknown>>;
    assert.ok(types.length > 0, "procurement domain must have entries");
    assert.ok(types.every((t) => t.domain === "procurement"), "all returned types must be procurement");
  });

  it("GET /api/admin-os/sessions returns empty array for new user", async () => {
    const { status, body } = await req("GET", "/api/admin-os/sessions", undefined, {
      "x-user-role": "viewer",
      "x-user-id": "99999",
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray((body as Record<string, unknown>).sessions), "sessions must be an array");
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
    const { status, body } = await req("GET", "/api/admin-os/decision-types?jurisdiction=uae", undefined, {
      "x-user-role": "viewer",
      "x-user-id": "1",
    });
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
