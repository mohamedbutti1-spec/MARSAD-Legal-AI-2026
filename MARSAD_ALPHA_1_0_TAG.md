# MARSAD Alpha 1.0 — Release Tag

**Tag:** `MARSAD-Alpha-1.0`  
**Date:** 2026-07-04  
**Status:** Architecture Freeze ✅

---

## What This Tag Represents

This is the first stable architecture freeze of the MARSAD platform. All five phases are built, integrated, TypeScript-clean, and constitute a complete working demonstration of the Al-Shamsi Constitutional Decision Framework™.

## Phase Completion Summary

| Phase | Name | Endpoints | Tables | Status |
|-------|------|-----------|--------|--------|
| 1 | Intelligent Administrative Decision Lifecycle | 16 | 5 (decisions, stages, dci, jdp, car) | ✅ |
| 2 | Executive Governance Layer | 7 | 0 (reads Phase 1 tables) | ✅ |
| 3 | Chain of Custody + Constitutional Memory | 10 | 3 (chain_of_custody, constitutional_memory, events) | ✅ |
| 4 | Evidence Ledger | 3 | 1 (evidence_events) | ✅ |
| 5 | Constitutional Judicial Intelligence (CJI) | 3 | 1 (judicial_reviews) | ✅ |

**Total endpoints:** ~130  
**Total DB tables:** ~30  
**Total frontend pages:** ~20  
**AI models used:** claude-sonnet-4-6

## Alpha 1.0 Fixes Applied (Architecture Freeze Session)

| ID | Fix | File(s) |
|----|-----|---------|
| P0-1 | DEMO MODE banner added | app-layout.tsx |
| P0-2 | Zod validation on POST /decisions | decisions.ts |
| P0-3 | CAR English name standardised to "Constitutional Accountability Record" | citizen-portal.tsx |
| P0-4 | Shamsi Theory page updated to document 16-dimension framework | shamsi-theory.tsx |
| P1-1 | CORS restricted to Replit/localhost origins | app.ts |
| P1-2 | CSP enabled (API: strict none; frontend: meta tag) | app.ts, index.html |
| P1-3 | constitutional_reviewer.canReadJdp fixed true | permissions.ts |
| P1-6 | Document comparison nav link hidden (placeholder screen) | sidebar.tsx |
| P1-11 | sendError() helper created — standard error shape | lib/sendError.ts |
| P1-12 | logAudit() added to CJI /run handler | judicial-review.ts |
| P1-14 | Platform name standardised to "مرصد (MARSAD)" | index.html, app-layout.tsx, governance-hub.tsx |

## Build Verification (All Pass ✅)

```
lib/db              → tsc --build     → OK (0 errors)
artifacts/api-server → tsc --noEmit  → OK (0 errors)
artifacts/legal-research → tsc --noEmit → OK (0 errors)
```

## Architecture Specification

See `MARSAD_Alpha_1.0_Architecture_Specification.md` for full documentation:
- Module inventory (Phases 1–5)
- Database schema map (all 30 tables)
- API map (all ~130 endpoints)
- Event flow (decision lifecycle)
- Security model (auth, CORS, CSP, hash chains)
- Permissions matrix (11 roles × 20 permissions)
- 16-dimension CJI map

## Known Limitations (Pre-Beta)

1. **Authentication** — header scaffolding only; UAE Pass / SSO required before government deployment
2. **Input validation** — Zod on create-decision; other write endpoints use manual checks
3. **Document comparison** — placeholder UI; no creation flow
4. **Streaming** — AI assistant responses not streamed (full response at once)
5. **Hijri calendar** — not yet on legal outputs

---

*مرصد (MARSAD) Alpha 1.0 · Al-Shamsi Constitutional Decision Framework™ · بناءً على مبادئ القانون الإداري الإماراتي*
