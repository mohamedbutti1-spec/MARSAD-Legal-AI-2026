---
name: Theory Mode Inline Refactor
description: JRE Stage 5 produces per-stage JreStageTheory objects; Stage 6 receives zero theory; JDC runs a separate post-Phase-3 enrichment step.
---

## Rule
Theory Mode must NEVER influence the legal conclusion. Two hard guarantees:
1. **JRE**: Stage 6 synthesis prompt receives no theory input at all. Theory is generated in Stage 5 as a separate structured call and stored in `JudgmentOutput.stageTheory[]`.
2. **JDC**: Judge binding analysis (Phase 3) has NO `theoryNote` in its prompt schema; it is forced `null`. Theory enrichment (`enrichJudgeWithTheory`) runs in Phase 3b via `Promise.all` after all binding analyses complete and stores `JudgeAnalysis.stageTheory[]`.

## JreStageTheory shape
```typescript
{ stageId, stageNameAr, uaeBindingAnalysis, theoryLensAnalysis, frenchComparative, agreement, difference, addedValue, disclaimer }
```
stageId values: `"legislation" | "precedents" | "principles" | "proportionality" | "ai_review"`

## Backward compat
- `JudgmentOutput.theoryAnalysis` is still derived from `stageTheory` (aggregated text), never left empty for sessions with theory lens.
- `JudgeAnalysis.theoryNote` is always `null` for new sessions; kept in type for old sessions.
- Frontend shows old single-block theory tab for sessions where `stageTheory` is missing/empty.

## Frontend rendering
- `InlineTheorySection` (jre-session.tsx) and `InlineJudgeTheory` (jdc-chamber.tsx) are collapsible, closed by default.
- UAE binding analysis shown FIRST (emerald border), then theory lens (amber border), then French comparative (blue border, optional), then agreement/difference/addedValue grid.
- Theory tab kept as overview/navigation guide; inline sections appear in each analytical tab.

## Why
Keeps theory analytically separate so it can never silently modify the holding, order, or binding reasons — critical for legal correctness and user trust.

## How to apply
Any future change to the theory pipeline: check that Stage 6 / synthesis prompt receives no `theoryAnalysis` or `stageTheory` content. Check that judge binding analysis prompt has no theory generation fields.
