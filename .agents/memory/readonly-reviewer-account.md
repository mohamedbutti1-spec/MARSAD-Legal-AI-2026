---
name: Read-only reviewer/guest-login account pattern
description: How to add a permanent, zero-mutation evaluation account plus a one-click guest login, and the gotchas found enforcing true read-only access.
---

Pattern for a permanent read-only account (e.g. external reviewer/QA/AI-testing access):

- Put it in `PERMANENT_ACCOUNTS`, not `DEMO_ACCOUNTS`, in `seed.ts`. Demo accounts (`is_demo=true`) are blocked from logging in on production — this is why a naive "guest" account fails in prod.
- A password-less "guest login" endpoint that looks up the fixed account server-side (never accepts a client-supplied username) must still hard-verify the account's role and `isDemo` flag before issuing a token. Without that invariant check, a DB misconfiguration or future edit silently turns "guest login" into "login as whatever role that row now has."
- `requireAnyRole`-style middleware is NOT sufficient to guarantee read-only behavior. It only gates "is any authenticated non-citizen role," so a supposedly read-only role can still hit POST/PUT/PATCH/DELETE routes guarded only by it. True read-only enforcement needs a dedicated `requireWriteRole`-style middleware (all roles except viewer/citizen) applied explicitly to every mutating route — this requires an exhaustive grep sweep across all route files, not just the ones flagged in one review pass.
- Route-level ad-hoc role checks (`req.headers["x-user-role"] === "owner"`) are spoofable by any authenticated client and must be replaced with the trusted session role (`req.user.role` / a `getValidatedRole(req)` helper backed by the JWT), never a header.
- After adding a strict write-only middleware, watch for read/formatting endpoints that get incorrectly swept into it (e.g. a POST-based "format this citation" endpoint is a read action, not a write) — verify by intent, not HTTP verb alone.
- Expect multiple code-review passes to be needed: each pass tends to surface a new instance of the same underlying gotcha (spoofable header, missed route, misclassified endpoint) rather than all issues appearing at once.
