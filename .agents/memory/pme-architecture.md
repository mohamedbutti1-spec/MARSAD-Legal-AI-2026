---
name: PME — Professional Mentor Engine
description: Additive mentor layer on top of PGF v2; 11 optional stage fields + 2 assessment output fields + expert-actions endpoint + frontend panels
---

## What PME adds

- **11 optional fields on `PgfWorkflowStage`** (all optional — backward compatible): `mentorPrompt`, `expertReasoning`, `whyThisMatters`, `commonMistakesAtStage`, `warningSigns`, `escalationTriggers`, `expertFirstActions`, `doNotDo`, `bestPracticeNotes`, `professionalJudgmentNotes`, `requiredDocumentsAtStage`
- **2 new fields on `PgfAssessmentOutput`**: `expertReasoning?` (string) and `verificationStatus?` (strict enum: `"verified" | "needs_review" | "flagged"`)
- **New route**: `GET /api/pgf/professions/:sectorId/:professionId/stages/:stageId/expert-actions` — reads from static config, no AI call. Returns `expertFirstActions`, `mentorPrompt`, `whyThisMatters`.
- **Frontend**: `MentorPanel` (7 accordion sections below stage card) + `ExpertActionsPanel` (slide-in triggered by "ماذا سيفعل الخبير؟" button)

## verificationStatus contract (critical — fixes code-review finding)

The AI prompt must emit **one of three exact string values**: `verified`, `needs_review`, or `flagged`. The frontend renders each with a distinct colour badge. Any free-text value produces a silent empty render. The prompt in `engine.ts` enforces this by explicitly listing the three allowed values.

**Why:** Initial implementation left the AI prompt asking for free text ("كيف يستطيع المهني التحقق…") while the frontend compared against the enum values — the mismatch caused the verification banner to silently empty in all sessions.

**How to apply:** Always keep the AI prompt schema for `verificationStatus` as an explicit enum description, not a descriptive question. Never change this to free text.

## Config factory pattern

Three shared stage factories accept a `mentor` param:
- `govStages(roleAr, mentor?)` — governance professions
- `financeStages(roleAr, mentor?)` — finance professions  
- `techStages(roleAr, mentor?)` — quality/tech professions

Each applies `...mentor[stageId]` spread into the matching stage object. The default `{}` keeps existing configs unchanged.

`RISK_MANAGER`, `CYBERSECURITY_OFFICER`, and `AI_GOVERNANCE_OFFICER` define their own custom stages (not shared factories) because their workflows differ fundamentally from the shared 3-stage pattern.

## Route registration order

The expert-actions route (`/pgf/professions/:sectorId/:professionId/stages/:stageId/expert-actions`) is registered **before** the profession detail route (`/pgf/professions/:sectorId/:professionId`) in `routes/pgf.ts`. This prevents Express from swallowing the more-specific path. Never move it below the profession detail route.

## Covered professions with mentor content

- law-enforcement.ts: JUDGE (5 stages), PROSECUTOR (3 stages), POLICE_OFFICER (3 stages)
- academics.ts: ACADEMIC_RESEARCHER (4 stages)
- government.ts: ADMIN_DECISION_MAKER (4 stages), LEGAL_AFFAIRS (3 stages), HR_OFFICER (3 stages)
- governance.ts: INTERNAL_AUDITOR, GOVERNANCE_OFFICER, COMPLIANCE_OFFICER (govStages factory); RISK_MANAGER (3 own stages)
- strategy.ts: STRATEGY_OFFICER (3 stages), PERFORMANCE_MANAGER (3 stages)
- finance.ts: PROCUREMENT_OFFICER, FINANCE_OFFICER, TAX_OFFICER (financeStages factory)
- quality-tech.ts: QUALITY_MANAGER, ISO_COORDINATOR (techStages factory); CYBERSECURITY_OFFICER (3 own stages); AI_GOVERNANCE_OFFICER (3 own stages)
