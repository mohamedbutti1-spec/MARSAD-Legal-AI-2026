---
name: Phase 60 — ADKG 16-Pillar Analyzer
description: How the 16-pillar evaluator was wired into ADKG decisions, weight distribution, and storage pattern.
---

# 16-Pillar Evaluator Architecture

## Pillar groups and weights (must sum to 100)
Traditional (6) = 55%: jurisdiction(14), competence(8), form(7), cause(12), subjectMatter(7), purpose(7)
AI/Digital (10) = 45%: humanWill(7), digitalWillFormation(5), algorithmicWeight(5), algorithmicBias(4), explainability(4), humanOversight(4), judicialReviewReadiness(4), proportionality(5), transparency(4), accountability(3)

**Why:** `competence` (issuer capacity, distinct from institutional jurisdiction) + `proportionality` + `transparency` + `accountability` are the 4 new pillars vs the old 12. This matches the full Al-Shamsi framework.

## Storage pattern
Pillar analysis result is stored in `adkg_decisions.metadata` JSON under key `pillarAnalysis`. `citedAuthorities` remains an array and is never mutated by the analyzer — this keeps export utilities working without changes.

**Why:** `citedAuthorities` is typed `unknown[]` in both the DB schema and frontend interface. Storing an object there breaks TypeScript (TS2352) and crashes `adkg-export.ts` which calls `.map()` unconditionally. `metadata` is `Record<string, unknown>` and designed for arbitrary extensions.

**How to apply:** Frontend reads `decision.metadata?.pillarAnalysis`. GET `/adkg/decisions/:id/analyze` selects `metadata` column only.

## Authority labelling
Every `applicableLaw` array entry must include `[UAE Binding]` or `[Comparative Persuasive]` inline. The prompt enforces this. The `AuthorityLabel` component in the Analysis tab renders these as colored badges.

## Separate prompt builder
`buildAdkgEvaluatorPrompt` in `admin-os-evaluator.ts` is for ADKG stored decisions (content-based). `buildEvaluatorPrompt` is for the interview-based Admin-OS flow. Do not mix them.

## Admin-OS compatibility
The `admin-os.ts` dims object was updated to include all 16 keys. Old sessions stored with 12 pillars will still compute scores correctly because `computeLegalityScore` skips missing keys gracefully.
