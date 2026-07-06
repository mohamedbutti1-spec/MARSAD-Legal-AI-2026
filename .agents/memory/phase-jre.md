---
name: JRE — Judicial Reasoning Engine
description: Architecture, key decisions, and gotchas for the JRE feature (6-stage AI pipeline, UAE admin court simulation).
---

## Schema
`jre_sessions` table in `lib/db/src/schema/jre-sessions.ts`. Migration via `migrateJre()` in `artifacts/api-server/src/jre/migration.ts`, registered in `seed.ts` after `migrateAdkg`.

## Engine — `artifacts/api-server/src/utils/judicial-reasoning-engine.ts`
6-stage AI pipeline. Exports `runJudicialAnalysis()` and all TS interfaces.

**Key: RAG retrieval** uses `buildKbContext()` (not `retrieveLegislation`/`retrieveCaseLaw` — those are not separately exported from `retrieval.ts`).

**Key: Citation filtering** — `resolveCitations()` returns verified tokens; fabricated tags are built into a `fabricatedTagSet` and stripped from `reasons`/`holding`/`order`/`orderEn` via regex, and authority hierarchy entries with fabricated ragTags are excluded before persistence. The message correctly says "filtered" because they are actually removed.

**Key: Theory Mode isolation** — Stage 5 is a completely separate AI call; Stage 6 prompt explicitly forbids merging theory into binding reasons. `theoryAnalysis.disclaimer` is always populated.

**Key: AI-decision review (Stage 4)** — runs when `hasAiDecision=true` OR `s1.facts.hasAiSystemInvolved=true`. Frontend shows the tab when `session.hasAiDecision === 'true' || judgment.aiDecisionReview.applicable`.

**Key: sourceIndex key format** — unbracketed, e.g. `"SRC:100034"` (matches rag.ts convention). ragTag in authority entries may be bracketed (`[SRC:N]`) or unbracketed; strip `[]` before comparing with fabricatedTagSet.

## Routes — `artifacts/api-server/src/routes/jre.ts`
5 endpoints: `GET /jre/sessions`, `GET /jre/sessions/:id`, `POST /jre/sessions`, `POST /jre/sessions/:id/follow-up`, `DELETE /jre/sessions/:id`.
Uses `requireAnyRole` + `getUserId(req)` — same pattern as admin-os.

## Frontend
- Session list: `pages/jre.tsx`
- Session detail (9 tabs): `pages/jre-session.tsx`
- Components: `components/jre/stage-progress.tsx`, `judgment-view.tsx`, `authority-hierarchy.tsx`
- Types: `types/jre.ts` — keep in sync with engine interfaces

**Why:**
Theory Mode must never influence the binding legal reasons. The separate stage + explicit Stage 6 prohibition guards against accidental merging. The permanent disclaimer on the Theory tab reinforces this to the user.
