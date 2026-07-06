---
name: Phase 60 — ADKG 16-Pillar Analyzer
description: Architecture, token limits, storage pattern, and integration details for the 16-pillar Al-Shamsi administrative decision evaluator.
---

## Pillar Groups
- 6 traditional admin law pillars: jurisdiction (14%), competence (8%), form (7%), cause (12%), subjectMatter (7%), purpose (7%)
- 10 AI/digital pillars: humanWill (7%), digitalWillFormation (5%), algorithmicWeight (5%), algorithmicBias (4%), explainability (4%), humanOversight (4%), judicialReviewReadiness (4%), proportionality (5%), transparency (4%), accountability (3%)
- Total: 100%

## Storage Pattern
- `pillarAnalysis` is stored inside `adkgDecisionsTable.metadata` (JSON field) — NOT in `citedAuthorities`
- Retrieve via GET /adkg/decisions/:id/analyze → returns `{ pillarAnalysis: {...} }`
- POST /adkg/decisions/:id/analyze → returns `{ ok, legalityScore, riskScore, analysis: pillarAnalysis }`

## Critical: Token Limit
- maxTokens must be **16000** (not 9000). The Arabic 16-pillar response fills ~12-15K tokens per decision.
- A truncation-repair fallback was added in the analyze route: walks the JSON character-by-character tracking stack depth, then closes open `{`/`[` brackets if truncated. Logs "ADKG: repaired truncated JSON response".

## Prompt
- `buildAdkgEvaluatorPrompt` in `admin-os-evaluator.ts` — ADKG-specific (different from `buildEvaluatorPrompt` which is for interview/admin-os flows)
- Source tagging: `[UAE Binding]` = UAE binding sources; `[Comparative Persuasive]` = comparative/French doctrine
- Optional schema fields (slimmed to reduce token use): timeline steps have `titleAr`+`duration` only; requiredDocuments have `nameAr`+`mandatory` only

## Validation
- `validateAdminBrief()` checks all 16 dimension keys + `canIssueToday` + `canIssueTodayRationale` + `algorithmExplanation` + `humanInterventionPoints` + `requiredDocuments` + `applicableLegislation` + `governmentAuthority.nameAr`
- `computeLegalityScore()` / `computeRiskScore()` use the same `DIMENSION_WEIGHTS` map for both ADKG and JRE

## JRE Integration
- `legalityScore`/`riskScore` on JRE sessions are ONLY populated when `hasAiDecision=true` (Stage 4 runs AI dimension review). For traditional admin decisions, these fields are null by design.
- ADKG scores are always computed from all 16 pillars regardless of hasAiSystem.

**Why:**
The 9000-token limit was set before the full Arabic bilingual schema was tested at scale. Raising to 16000 and adding repair ensures deterministic pillar output even on very detailed decisions.
