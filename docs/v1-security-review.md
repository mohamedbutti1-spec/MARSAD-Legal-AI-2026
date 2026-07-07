# MARSAD v1.0 — Production Security Review
**Date:** 7 July 2026  
**Reviewer:** Automated Security Audit (code inspection + live probing)  
**Branch:** `release/v1.0` / tag `v1.0-certified`  
**Scope:** Internet exposure readiness — public production deployment

---

## ⛔ OVERALL VERDICT

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   NOT SAFE FOR PUBLIC PRODUCTION                                 ║
║                                                                  ║
║   Safe for: Private staging / internal UAE government network    ║
║   Blocked by: 3 critical vulnerabilities (C1, C2, C3)           ║
║               2 high-severity findings (H1, H2)                 ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

Do not publish this application to a public URL until all Critical findings
are resolved and re-audited. Medium and Low findings should be addressed
before or shortly after public launch.

---

## Live Proof-of-Exploit (run during this review)

The following curl commands were executed against the running server during
this review. They required no browser, no cookies, no prior login:

```bash
# Attacker reads all governance data — no credentials needed
curl https://<production-url>/api/governance/dashboard \
  -H "x-user-role: owner" -H "x-user-id: 1"
# → HTTP 200  ← Full governance statistics returned

# Attacker creates a decision as any user — no credentials needed
curl -X POST https://<production-url>/api/decisions \
  -H "x-user-role: supervisor" -H "x-user-id: 9999" \
  -H "Content-Type: application/json" \
  -d '{"referenceNumber":"UAE/2026/SEC","titleAr":"...","jurisdiction":"federal",...}'
# → HTTP 201  ← Record written to production database (createdBy: 9999)

# Attacker reads decisions with no headers at all
curl https://<production-url>/api/decisions
# → HTTP 200  ← Data returned (defaults to viewer role)
```

These three probes succeeded during live testing. A threat actor with
internet access and knowledge of the API schema can read all data,
write arbitrary records, and impersonate any user or role.

---

## Security Checklist

### Section 1 — Authentication

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1.1 | Identity is established via a cryptographically verified mechanism (JWT, session token, OAuth) | ❌ **FAIL** | Identity read from `x-user-role` / `x-user-id` HTTP headers — see `roleAuth.ts:13`, `route-helpers.ts:20` |
| 1.2 | Unauthenticated requests cannot reach protected data | ❌ **FAIL** | `GET /api/decisions` with no headers → HTTP 200 (defaults to `viewer` role, data returned) |
| 1.3 | A user cannot impersonate another user or a higher-privilege role | ❌ **FAIL** | `POST /api/decisions` with spoofed `x-user-role: supervisor` → HTTP 201, decision created as user 9999 |
| 1.4 | Session tokens are invalidatable (logout, expiry, revocation) | ❌ **FAIL** | No sessions exist — no mechanism to invalidate |
| 1.5 | Token/credential is never stored in a location readable by JavaScript (localStorage XSS risk) | ❌ **FAIL** | `roleAuth.ts` comment: "stored in localStorage" — XSS readable |

**Section verdict: ❌ CRITICAL FAIL (C1)**

---

### Section 2 — Session Management

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 2.1 | Session middleware is configured (express-session or equivalent) | ❌ **FAIL** | No session middleware in `app.ts` |
| 2.2 | Session cookies are `HttpOnly` | ❌ **FAIL** | No session cookies |
| 2.3 | Session cookies are `Secure` (HTTPS-only) | ❌ **FAIL** | No session cookies |
| 2.4 | Session cookies are `SameSite=Strict` or `SameSite=Lax` | ❌ **FAIL** | No session cookies |
| 2.5 | Sessions expire after inactivity | ❌ **FAIL** | No sessions — role is re-read from header on every request |
| 2.6 | SESSION_SECRET is set and used | ✅ **PASS** | `SESSION_SECRET` env var is set; logger redacts cookies |

**Section verdict: ❌ CRITICAL FAIL (C2)**  
*Note: 2.6 passes but has no effect — the secret is set but not used by any middleware.*

---

### Section 3 — CORS

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 3.1 | CORS restricts browser-origin requests to known domains | ✅ **PASS** | `app.ts:74–85`: allowlist with regex; unknown browser origins blocked |
| 3.2 | Origin-less requests (curl, Postman, scripts) are blocked | ❌ **FAIL** | `app.ts:77`: `if (!origin) return cb(null, true)` — always allowed; live probe confirmed |
| 3.3 | `credentials: true` is not combined with a wildcard origin | ✅ **PASS** | No wildcard (`*`) used; origin is an allowlist |
| 3.4 | CORS errors return 4xx (not 500) | ❌ **FAIL** | Browser request with unknown origin → HTTP 500 (CORS Error swallowed by global handler instead of returning 403) |
| 3.5 | Production mode does not allow localhost/dev origins | ✅ **PASS** | Dev origins gated: `if (!IS_PRODUCTION)` |

**Section verdict: ❌ CRITICAL FAIL (C3)**  
*The no-origin bypass means CORS provides no protection against direct API access from any IP. Combined with header-trust auth, this is the primary internet-exposure vector.*

---

### Section 4 — Authorization

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 4.1 | Role-based permission checks are enforced server-side | ✅ **PASS** | `requireRole`, `requirePermission`, `requireSupervisorOrOwner` in every route |
| 4.2 | Role values are validated against an allowlist | ✅ **PASS** | `getValidatedRole` checks against `ALL_ROLES`; unknown roles → `citizen` |
| 4.3 | Citizen role cannot access internal routes | ✅ **PASS** | `requireAnyRole` excludes citizen; returns 403 |
| 4.4 | Only owner/supervisor can create or mutate decisions | ✅ **PASS** | `requireSupervisorOrOwner` on all mutation routes |
| 4.5 | IDOR: private resources are scoped to the requesting user | ✅ **PASS** | JRE/JDC/SPG/workspace all filter by `userId`; cross-user probes return empty |
| 4.6 | Role cannot be escalated by the client | ❌ **FAIL** | Follows from C1 — any client can supply any role header |

**Section verdict: ⚠️ CONDITIONALLY PASS**  
*Authorization logic is correctly implemented — the checks are sound. But they only gate by role, and role is unverified (see C1). Fix C1 and authorization becomes fully effective.*

---

### Section 5 — Rate Limiting

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 5.1 | Rate limits are applied to all API endpoints | ✅ **PASS** | Global 200/min limiter in `app.ts:91`; AI-specific limits in `rateLimits.ts` |
| 5.2 | AI endpoints have tighter limits | ✅ **PASS** | `aiSessionLimit` 10/min, `aiAnalysisLimit` 30/min, KB 60/min |
| 5.3 | Rate limits survive server restart | ❌ **FAIL** | Memory store resets on every restart; `rateLimits.ts:7` explicitly notes: "add Redis as the store" |
| 5.4 | Rate limits cannot be bypassed by spoofing `X-Forwarded-For` | ❌ **FAIL** | `trust proxy` is not configured in `app.ts`; `X-Forwarded-For: 1.2.3.4` was accepted; attacker can rotate fake IPs per request |
| 5.5 | Rate limits are per-user, not per-IP only | ❌ **FAIL** | Per-IP only; comment: "Per-user limiting is a v2.0 enhancement" |
| 5.6 | 429 responses contain Retry-After header | ✅ **PASS** | `standardHeaders: true` sets `RateLimit-*` headers |

**Section verdict: ⚠️ PARTIAL FAIL (H1)**  
*Rate limiting exists and works for basic protection but is IP-only, memory-based, and bypassable via header spoofing on internet-facing deployment.*

---

### Section 6 — Input Validation

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 6.1 | `POST /api/decisions` validates body with a schema | ✅ **PASS** | Zod schema enforced; invalid input → 400 with field-level errors |
| 6.2 | `POST /api/jre/sessions` validates body | ❌ **FAIL** | `req.body as { decisionId?: number; ... }` — TypeScript cast only; no runtime validation |
| 6.3 | `POST /api/jdc/chambers` validates body | ❌ **FAIL** | `req.body as { decisionId?: number; ... }` — TypeScript cast only |
| 6.4 | `POST /api/spg/sessions` validates body | ❌ **FAIL** | `req.body as { sectorId?: string; ... }` — TypeScript cast only |
| 6.5 | `POST /api/pgf/sessions` validates body | ❌ **FAIL** | TypeScript cast only (same pattern) |
| 6.6 | URL path parameters are validated (isNaN guards) | ✅ **PASS** | All `:id` params use `parseInt` + `isNaN` check → 400 |
| 6.7 | JSON body size is limited | ✅ **PASS** | `app.ts:87`: `limit: "256kb"` for JSON bodies |
| 6.8 | Prompt injection (user content injected into AI prompts) | ⚠️ **PARTIAL** | User-supplied text is included in AI prompts; no explicit sanitisation of prompt-injection sequences. Risk is AI output quality, not data exfiltration — low severity for this architecture |

**Section verdict: ⚠️ PARTIAL FAIL (M1)**  
*Core routes use proper validation; AI session creation routes do not. A malformed body won't cause SQL injection (ORM-protected) but could crash a handler or produce unexpected AI behaviour.*

---

### Section 7 — Secrets Management

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 7.1 | API keys and secrets are read from environment variables | ✅ **PASS** | `ANTHROPIC_API_KEY`, `DATABASE_URL`, `SESSION_SECRET` all from `process.env` |
| 7.2 | Secrets are never logged | ✅ **PASS** | `logger.ts` redacts `authorization`, `cookie`, `set-cookie` |
| 7.3 | Secrets are never included in API responses | ✅ **PASS** | No `process.env` serialisation found in any response path |
| 7.4 | No secrets hard-coded in source | ✅ **PASS** | grep confirms no keys in source |
| 7.5 | `.env` file is not committed to git | ✅ **PASS** | No `.env` file in repository |
| 7.6 | Error messages do not reveal internal paths or configuration | ✅ **PASS** | Global handler returns only `{"error":"Internal server error"}` |

**Section verdict: ✅ PASS**

---

### Section 8 — Security Headers

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 8.1 | `Content-Security-Policy` is set | ✅ **PASS** | Helmet CSP: `default-src 'none'`, `script-src 'none'`, `connect-src 'self'` |
| 8.2 | `X-Frame-Options` / `frame-ancestors` is set | ✅ **PASS** | `frameAncestors: ["'none'"]` — clickjacking blocked |
| 8.3 | `X-Content-Type-Options: nosniff` is set | ✅ **PASS** | Helmet sets this by default |
| 8.4 | `Strict-Transport-Security` (HSTS) is set | ✅ **PASS** | Helmet sets HSTS by default |
| 8.5 | `Referrer-Policy` is set | ✅ **PASS** | Helmet sets `no-referrer` by default |
| 8.6 | `Permissions-Policy` is set | ✅ **PASS** | Helmet sets this by default |
| 8.7 | `Server` header is not revealing | ✅ **PASS** | Helmet removes/obscures `X-Powered-By` |

**Section verdict: ✅ PASS**

---

### Section 9 — File Upload Security

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 9.1 | File size limit is enforced | ✅ **PASS** | `multer limits: { fileSize: 100MB }` |
| 9.2 | Allowed file types are restricted | ⚠️ **PARTIAL** | Extension check only: `.pdf`, `.docx`, `.txt` — MIME type not validated; attacker can rename `evil.php` → `evil.txt` |
| 9.3 | Uploaded files are not served from a web-accessible path | ✅ **PASS** | Files stored in `uploads/` dir; served via controlled Express route with filename sanitisation |
| 9.4 | Upload filename is sanitised (path traversal prevention) | ✅ **PASS** | `documents.ts:74`: regex `^[a-zA-Z0-9\-_.]+\.xlsx$` blocks traversal |
| 9.5 | 100 MB limit is appropriate for public internet | ❌ **FAIL** | 100 MB is excessive for a public API — enables storage exhaustion DoS |
| 9.6 | Uploaded files are scanned for malicious content | ❌ **FAIL** | No antivirus / content scanning; PDFs with embedded scripts are parsed |

**Section verdict: ⚠️ PARTIAL FAIL (M2)**

---

### Section 10 — SQL Injection

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 10.1 | All database queries use parameterized queries | ✅ **PASS** | Drizzle ORM throughout; no string-concatenated SQL found |
| 10.2 | `sql.raw()` is used only with safe values | ✅ **PASS** | `sql.raw()` calls use integer IDs sanitised to `parseInt` before injection |
| 10.3 | User input is never directly interpolated into query strings | ✅ **PASS** | All user strings go through Drizzle's `eq()`, `like()`, `ilike()` helpers |

**Section verdict: ✅ PASS**

---

### Section 11 — Error Handling

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 11.1 | Stack traces are never returned to the client | ✅ **PASS** | Global handler: `res.status(500).json({ error: "Internal server error" })` |
| 11.2 | Internal error details are logged server-side only | ✅ **PASS** | `logger.error({ err }, "Unhandled error")` — server log only |
| 11.3 | 4xx errors include useful but non-revealing messages | ✅ **PASS** | Errors reference the permission flag name (e.g., `canReadAuditLog not granted`) but no stack |
| 11.4 | CORS errors return 4xx (not 5xx) | ❌ **FAIL** | A browser request with disallowed origin returns HTTP 500 — CORS middleware throws, caught by global error handler, which returns 500. Should be 403. |
| 11.5 | Unhandled promise rejections are caught | ✅ **PASS** | Global `process.on('unhandledRejection')` handler installed in `index.ts` |

**Section verdict: ⚠️ PARTIAL FAIL (L1)**

---

### Section 12 — Dependency Vulnerabilities

| # | Package | Severity | CVE / Advisory | Status |
|---|---------|----------|----------------|--------|
| 12.1 | `xlsx@0.18.5` | 🔴 **HIGH** | [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) — Prototype Pollution | ❌ **FAIL** — No patched version (`<0.0.0`); SheetJS moved to commercial model |
| 12.2 | `xlsx@0.18.5` | 🔴 **HIGH** | [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) — ReDoS | ❌ **FAIL** — No patched version |
| 12.3 | `esbuild@0.27.3` | 🟡 **LOW** | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) — Arbitrary file read (Windows, dev server only) | ⚠️ **INFORMATIONAL** — Dev dependency only; not in production bundle; Linux host |

**Section verdict: ❌ FAIL (H2)**  
*`xlsx` is used in `export.ts` to generate XLSX exports. The prototype pollution CVE can corrupt the Node.js prototype object. The ReDoS can cause CPU exhaustion on crafted input. Both are triggered through the xlsx parsing/generation API. No upstream fix is available — replacement is required.*

---

### Section 13 — TLS / Transport Security

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 13.1 | Traffic is encrypted in transit (TLS) | ✅ **PASS** | Replit handles TLS termination; all public endpoints served over HTTPS |
| 13.2 | Application does not accept plain HTTP on the public interface | ✅ **PASS** | Replit proxy enforces HTTPS; internal port 8080 is not externally exposed |
| 13.3 | HSTS header is set | ✅ **PASS** | Helmet sets HSTS by default |

**Section verdict: ✅ PASS**

---

### Section 14 — CSRF

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 14.1 | State-changing endpoints are protected against CSRF | ✅ **CONTEXTUAL PASS** | No session cookies exist — CSRF attack requires cookie-based state that this app does not have. The custom `x-user-role`/`x-user-id` headers cannot be set by cross-origin form submissions (browsers block setting custom headers from HTML forms). |
| 14.2 | If cookies are introduced (after auth fix), CSRF tokens or `SameSite=Strict` must be added | ⚠️ **PRE-CONDITION** | When session cookies are introduced (required fix), CSRF protection must be added simultaneously |

**Section verdict: ✅ CONTEXTUAL PASS** *(becomes a required action when auth is fixed)*

---

## Summary Table

| ID | Category | Severity | Finding | Verdict |
|----|----------|----------|---------|---------|
| **C1** | Authentication | 🔴 Critical | No auth — identity from unverified HTTP headers; any IP can impersonate any role | ❌ FAIL |
| **C2** | Session Management | 🔴 Critical | No sessions, no cookies, SESSION_SECRET unused | ❌ FAIL |
| **C3** | CORS | 🔴 Critical | No-Origin requests always allowed; any curl/script from internet bypasses CORS | ❌ FAIL |
| **H1** | Rate Limiting | 🟠 High | Memory store (resets on restart); no trust proxy; X-Forwarded-For spoofable | ❌ FAIL |
| **H2** | Dependencies | 🟠 High | `xlsx@0.18.5` — Prototype Pollution + ReDoS; no patched version available | ❌ FAIL |
| **M1** | Input Validation | 🟡 Medium | JRE/JDC/SPG/PGF session create routes use TypeScript casts, not runtime validation | ⚠️ PARTIAL |
| **M2** | File Upload | 🟡 Medium | Extension-only MIME check; 100 MB limit; no content scanning | ⚠️ PARTIAL |
| **L1** | Error Handling | 🔵 Low | CORS error returns HTTP 500 instead of 403 | ⚠️ PARTIAL |
| — | Authorization Logic | — | Role checks are correctly implemented (blocked by C1 from being effective) | ✅ PASS |
| — | Security Headers | — | Helmet with strict CSP, HSTS, frame-ancestors:none | ✅ PASS |
| — | Secrets Management | — | No leakage; all secrets in env vars; logger redacts headers | ✅ PASS |
| — | SQL Injection | — | Drizzle ORM throughout; sql.raw only on sanitised integers | ✅ PASS |
| — | TLS/Transport | — | Replit handles TLS; HTTPS enforced | ✅ PASS |
| — | CSRF | — | No session cookies = no CSRF surface (must revisit when auth is fixed) | ✅ CONTEXTUAL |

---

## Required Fixes Before Public Production

### C1 — Replace Header-Trust Authentication *(blocking)*

**What:** Replace `x-user-role` / `x-user-id` header reading with a verified identity mechanism.  
**Recommended approach:** Replit Auth (built-in OpenID Connect + PKCE) or Clerk.  
**Effect:** Fixes C1 entirely. Makes C2 and the authorization section fully effective.

```typescript
// CURRENT (insecure):
const role = (req.headers["x-user-role"] as string) || "viewer";

// REQUIRED: derive identity server-side from verified session/token
const user = req.user; // populated by auth middleware after token verification
const role = user.role;
const userId = user.id;
```

When implementing:
- Add CSRF protection simultaneously (pre-condition from Section 14)
- Session cookies must use `HttpOnly`, `Secure`, `SameSite=Strict`
- `SESSION_SECRET` is already set — it can be used immediately with `express-session`

---

### C2 — Block No-Origin Requests *(blocking)*

**What:** The current CORS config passes requests with no `Origin` header unconditionally. This is the primary internet bypass vector — it allows any HTTP client (curl, scripts, Postman, server-side attack tools) to call any API endpoint regardless of CORS rules.

**Fix:**

```typescript
// CURRENT (insecure):
origin: (origin, cb) => {
  if (!origin) return cb(null, true); // ← remove this line for public internet
  ...
}

// REQUIRED for internet exposure:
origin: (origin, cb) => {
  if (!origin) {
    // Allow only in development or from known server-to-server contexts
    if (!IS_PRODUCTION) return cb(null, true);
    return cb(new Error("CORS: direct server requests are not permitted"));
  }
  const allowed = ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
  if (allowed) return cb(null, true);
  return cb(new Error(`CORS: origin '${origin}' is not allowed`));
},
```

Also set `ALLOWED_ORIGIN` env var in production to the exact deployment domain.

---

### C3 — Fix CORS Error Returns 500 *(blocking)*

**What:** CORS rejection errors propagate to the global error handler, returning HTTP 500. Should return 403.

**Fix in `app.ts`:**

```typescript
// Add before the global error handler:
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err.message?.startsWith("CORS:")) {
    res.status(403).json({ error: "Forbidden: origin not allowed" });
    return;
  }
  next(err);
});
```

---

### H1 — Rate Limiting: Trust Proxy + Redis Store *(required before public launch)*

**What:** Rate limits use a memory store (lost on restart) and trust the client-supplied `X-Forwarded-For` header.

**Fix:**

```typescript
// Add to app.ts, before middleware stack:
app.set("trust proxy", 1); // trust first hop (Replit load balancer)

// Replace memory store with Redis (or use a Replit-compatible persistent store):
import { RedisStore } from "rate-limit-redis";
const store = new RedisStore({ /* Redis connection */ });
const globalLimiter = rateLimit({ ..., store });
```

**Interim mitigation:** If Redis is not immediately available, `app.set("trust proxy", 1)` alone closes the X-Forwarded-For spoofing gap by trusting only the first-hop IP from Replit's proxy.

---

### H2 — Replace `xlsx` Package *(required before public launch)*

**What:** `xlsx@0.18.5` has two HIGH CVEs with no upstream fix available (SheetJS is now commercial-only for security patches).

**Recommended replacement:** `exceljs` (actively maintained, no known CVEs, compatible API).

```bash
pnpm --filter @workspace/api-server remove xlsx
pnpm --filter @workspace/api-server add exceljs
```

Then update `export.ts` to use the `exceljs` API (similar worksheet/workbook model).

---

### M1 — Runtime Input Validation on AI Session Routes *(high priority)*

**What:** JRE, JDC, SPG, PGF session-creation routes use TypeScript type casts (`req.body as { ... }`) without runtime validation. A malformed request body reaches the handler.

**Fix pattern (apply to `jre.ts`, `jdc.ts`, `spg.ts`, `pgf.ts`):**

```typescript
import { z } from "zod";

const CreateSessionSchema = z.object({
  decisionId: z.number().int().positive(),
  caseType:   z.string().min(1).max(100).optional(),
});

const parsed = CreateSessionSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  return;
}
const { decisionId, caseType } = parsed.data;
```

---

### M2 — File Upload Hardening *(medium priority)*

**What:** Extension-only MIME check; 100 MB limit too large for public internet.

**Fixes:**
1. Validate MIME type using `file-type` or `mmmagic` in addition to extension
2. Reduce limit to 10 MB for public deployment
3. Add content scanning or sandboxed parsing for uploaded PDFs

---

## Verdict by Deployment Target

| Deployment Target | Verdict |
|-------------------|---------|
| Internal UAE government network (air-gapped or VPN) | ✅ **SAFE** — network perimeter compensates for C1/C2/C3 |
| Replit private deployment (access restricted by Replit auth) | ✅ **SAFE** — Replit auth layer compensates |
| Public internet (anyone can access the URL) | ❌ **NOT SAFE** — C1, C2, C3 must be resolved first |

---

## Remediation Priority Order

```
IMMEDIATE (before any public URL goes live):
  1. C1 — Implement verified authentication (Replit Auth or Clerk)
  2. C2 — Block no-Origin CORS bypass
  3. C3 — Return 403 on CORS rejection (not 500)

BEFORE PUBLIC LAUNCH:
  4. H1 — Add app.set("trust proxy", 1); add Redis rate-limit store
  5. H2 — Replace xlsx with exceljs

WITHIN 30 DAYS OF LAUNCH:
  6. M1 — Add Zod validation to JRE/JDC/SPG/PGF session routes
  7. M2 — Add MIME validation to file upload; reduce to 10 MB limit

LOW PRIORITY:
  8. esbuild dev dependency (upgrade to >=0.28.1 when build pipeline allows)
```

---

*Security review conducted: 7 July 2026*  
*Method: Static code analysis + live adversarial probing against running server*  
*Findings based on: `release/v1.0` branch, tag `v1.0-certified`*  
*This report expires 90 days from date or upon any significant code change.*
