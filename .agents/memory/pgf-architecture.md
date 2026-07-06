---
name: PGF — Professional Guidance Framework
description: Config-driven 20-profession guidance framework; wiring pattern, security fixes, API shape
---

## Architecture
- 20 professions across 7 sector groups: judiciary, public_prosecution, police, gov_admin, legal_affairs, human_resources, internal_audit, governance, compliance, risk_management, strategy, performance_management, procurement, finance, taxation, quality, iso, cybersecurity, ai_governance, academic_research
- Every profession is a `ProfessionConfig` TypeScript object in `artifacts/api-server/src/pgf/config/professions/` — adding a new profession requires only a new config entry, no route/engine changes
- Registry in `artifacts/api-server/src/pgf/config/index.ts` — `findProfession(sectorId, professionId)`, `getSectorSummaries()`, `resolveNextStage()`
- Decision tree routing: each stage has `defaultNextStageId`; `DecisionNode` entries override routing for specific answers and optionally add a `flag` to `triggeredFlags`
- Confidence score (0–100) is AI-generated in `runPgfAssessment()` in engine.ts

## DB schema
- Table: `pgf_sessions` — `answers/flags/output/completedStages` stored as TEXT JSON; `currentStageId` tracks progress
- Schema export: `lib/db/src/schema/pgf-sessions.ts` (already exported from index)

## API shape
- `GET /api/pgf/catalogue` — all sectors/professions (no auth token, just requireAnyRole)
- `GET /api/pgf/professions/:sectorId/:professionId` — profession detail + full stage config
- `POST /api/pgf/sessions` — requires `{ sectorId, professionId }` (both params needed)
- `POST /api/pgf/sessions/:id/answer` — requires `{ stageId, stageAnswers }`
- `POST /api/pgf/sessions/:id/finalize` — triggers AI assessment; idempotent for `complete` sessions
- `GET/DELETE /api/pgf/sessions`, `GET /api/pgf/sessions/:id`

## Security fixes applied (post code-review)
1. **Answer endpoint**: validates `stageId === row.currentStageId` — rejects arbitrary stage advancement
2. **Finalize endpoint**: 
   - Returns cached output if `status === 'complete'` (idempotent)
   - Rejects if status is not `draft`
   - Requires all workflow stages completed before AI run

## AI engine
- Uses `TaskType.RAG`, field `systemPrompt`, result is `raw.text`, `parseModelJson` returns `{ok, data}` — same pattern as SPG
- maxTokens: 6000; confidence score clamped 0–100

## Frontend routes
- `/pgf` → `pgf.tsx` (list page + profession selector fetching catalogue)
- `/pgf/:id` → `pgf-session.tsx` (stage-by-stage workflow + assessment output)
- Sidebar section: 'spg' group, icon `BookOpenText`, badge 'جديد'
- Dashboard chip: `BookOpen` icon, navigate action

**Why:** Configuration-driven so adding professions requires zero code changes; decision tree enables branching without hardcoded conditionals.
