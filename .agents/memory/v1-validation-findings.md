---
name: V1.0 Validation Findings
description: Security and null-safety bugs found and fixed during V1.0 validation — auth middleware gaps, Object.values null crashes, NAIP role-map mismatch, legal-os unguarded buildContext
---

## Auth Middleware Gaps (Fixed)
workspace.ts, adkg.ts, kb.ts had zero auth middleware — any caller could access all research data.
**Fix:** `router.use(requireSupervisorOrOwner)` as first statement after router creation.
**Why:** requireSupervisorOrOwner matches the frontend canUseAi gate; governance roles access owner-scoped data and should not be added without RBAC redesign.

## Null-Safety Pattern: Object.values() on API Response Sub-Objects
naip-kpi.tsx, naip-dashboard.tsx, constitutional-intelligence.tsx all crashed with "Cannot convert undefined or null to object" when API fields like `risk`, `byStatus`, `byRiskLevel`, `constitutional` were null/undefined in the API response.
**Fix:** Always guard: `Object.values(field ?? {})` — never assume sub-objects in API responses are non-null even if the TypeScript interface says required.
**How to apply:** Any time a component calls Object.values/entries/keys on a field from a useQuery response.

## NAIP Executive Dashboard Role-Map Mismatch
Frontend naip-minister, naip-undersecretary, naip-director-general, naip-judge all allow owner+supervisor.
DASHBOARD_TYPE_ROLE_MAP in naip.ts only allowed the specific executive role → 403 console errors.
**Fix:** Add "owner" and "supervisor" to all four entries in DASHBOARD_TYPE_ROLE_MAP.
**Why:** owner/supervisor are platform-level admins expected to have oversight of all executive views.

## legal-os.ts: buildContext() Must Be Wrapped in Try/Catch
Both /legal-os/assess and /legal-os/followup called buildContext() outside try/catch.
If KB retrieval fails, the request handler crashes silently.
**Fix:** Wrap in try/catch, properly type sourceIndex as Map<string, { title: string; type: "document" | "legal_source" }> (not unknown — resolveCitations requires this exact type).
**How to apply:** Any route that calls buildContext() must guard it separately from the AI call since they have different failure modes.

## Known Deferred (Non-Fatal)
- search_vector GIN index missing on research_items and adkg_decisions (FTS degraded to LIKE)
- PGF DO $ migration syntax error (constraint not applied; runtime OK)
- parseInt without isNaN guard in decisions.ts (protected by assertDecisionAccess downstream)
- No rate limiting on AI routes (acceptable for demo/alpha)
