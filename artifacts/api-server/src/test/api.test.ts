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
    const { status } = await req("GET", "/api/health", undefined, {});
    assert.equal(status, 200);
  });
});
