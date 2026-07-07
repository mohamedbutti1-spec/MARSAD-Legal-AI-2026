---
name: Express 5 — router.use() global middleware bleed
description: In Express 5, router.use(requireAnyRole) without a path prefix runs for ALL requests entering that router, including paths no specific route in that router handles. This blocks citizen (and other excluded roles) from routes in later routers.
---

## The Rule
In Express 5, `router.use(someMiddleware)` (no path) is a catch-all that runs for **every** request dispatched to that router — even if no route inside the router matches. This is true even when the middleware returns 403/401 and the request was destined for a completely different router mounted later.

**Why:** Express dispatches each request to each mounted sub-router in registration order. If a sub-router has a global `router.use(requireAnyRole)` before its routes, that middleware runs first for every inbound request (path matching is `/`). If it returns a response (e.g. 403), Express stops — the next sub-router never runs.

**How to apply:**
1. Any router that uses `router.use(requireAnyRole)` (without a path prefix) will block **all** roles excluded from `requireAnyRole` from ever reaching routers registered AFTER it in routes/index.ts.
2. `citizen` is excluded from `requireAnyRole`. Three routers apply it globally: `workspace.ts`, `kb.ts`, `adkg.ts`.
3. Routes that must be accessible to citizen (e.g. beta feedback) **must be registered BEFORE** workspace/kb/adkg in routes/index.ts, or given an explicit path prefix in their `router.use` registration.
4. The fix applied: `router.use(betaRouter)` was moved above `router.use(workspaceRouter)` in routes/index.ts.
5. If new citizen-accessible routes are added in the future, register them before the workspace/kb/adkg block.

**Lesson from debugging:** The 403 appeared even after removing all `requireRole` calls from beta.ts, because the middleware block happened in a completely different router that ran first. `grep -rn "router.use(require"` across all route files is the diagnostic command.
