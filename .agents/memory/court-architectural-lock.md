---
name: Court Architectural Lock
description: Mandatory ASEP + Al-Shamsi Matrix lock in the court simulator — validation contracts, bypass fixes, and JWT test auth pattern
---

## Architectural Lock — court/simulate

Three mandatory components that must complete for `complete:true`:
1. **Al-Shamsi Matrix** (`shamsiOk`) — 11 canonical principles with required fields
2. **ASEP** (`asepOk`) — 10 answers with required fields
3. **Digital Will Engine** — pure-frontend derived from session state, no server tracking

### Shamsi Validation (`validateShamsiMatrix`)
Requires ALL of the following:
- `shamsi.length >= 11`
- All 11 canonical IDs present: `human_will`, `digital_will`, `algo_weight`, `explainability`, `legitimate_bias`, `graded_compliance`, `human_supervision`, `procedural`, `accountability`, `judicial_review`, `final_legality`
- Each principle: `status ∈ {مُستوفى, جزئي, مخفق}`, non-empty `evidence`, non-empty `humanOversightNote`

### ASEP Validation (`validateAsepReport`)
Requires: `answers.length >= 10`, numeric `overallExplainability`, non-empty string `conclusion`, each answer has `question` (string), `answer` (non-empty string), `confidence` (number).

### Terminal Exit Rule
ALL error paths (Phase 1–4 catch blocks and parse failures) MUST call `terminalExit()` OR continue to the next phase. No `res.end()` without a `done` event. Phase 3/4 failures are non-fatal (continue to next phase); Phase 1/2 failures are fatal (call `terminalExit` which emits `done` + ends stream).

### Token Budgets (current)
- Phase 1 (facts+issues): 3500
- Phase 2 (claimant+admin defenses): 5500 — increased, Arabic content long
- Phase 3 (commissioner+shamsi 11 principles): 10000 — increased for 11 × 7 fields
- Phase 4 (judgment+operative+appeal+scores): 4500
- Phase 5 (ASEP 10 Q&A): 4000

**Why:** Phase 2 and 3 were truncating large Arabic legal JSON; 3500 was insufficient.

### JWT Test Auth Pattern
Test suite uses `signToken({ userId, role, org })` from `lib/jwt` (not legacy headers).
- `SESSION_SECRET` must be set in environment (available in Replit secrets)
- `cookieFor(role, userId)` helper returns `marsad_session=<jwt>`
- `H_BAD_ROLE` signs a token with role `"superadmin"` (not in ALL_ROLES) → `requireAnyRole` returns 401
- Demo credentials: admin/7KW@ltkOeo3Qc6Ys (owner role, userId=1)

**How to apply:** Any new test that hits authenticated endpoints must set the `Cookie` header using `cookieFor()`. Never use `x-user-role`/`x-user-id` — they are stripped by `app.ts`.
