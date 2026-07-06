---
name: SPG — Smart Professional Guidance
description: Architecture decisions, DB schema, AI engine contract, and validation rules for the SPG module.
---

## Module summary
9 professional sectors × multiple roles → 7-question wizard → AI generates structured GuidanceOutput.

## DB table
`spg_sessions`: id, user_id, title, sector_id, sector_name_ar, role_id, role_name_ar, status (draft|analyzing|complete|error), answers (TEXT JSON), output (TEXT JSON)

## API routes
- GET/POST /api/spg/sessions
- GET/POST /api/spg/sessions/:id/run
- DELETE /api/spg/sessions/:id

## AI engine pattern
- Uses `TaskType.RAG` (not ANALYSIS — that TaskType does not exist)
- `systemPrompt` field (not `system`)
- `raw.text` field (not `raw.content`)
- `parseModelJson` returns `{ok, data}` or `{ok: false, raw}` — must check `ok` before using `data`

## Sector/role validation
Server-side `VALID_SECTORS` map in routes/spg.ts enforces that sectorId + roleId match the allowed catalogue. Rejects invalid pairs with 400.

**Why:** Prevents arbitrary sector/role strings from polluting the DB and ensures AI prompt context is always coherent.

## Wizard answers shape
`{ incident, stage, documents, action, risks, nextStep }` — `incident` min 20 chars enforced server-side.

## GuidanceOutput shape
`{ summary, requiredActions[], requiredDocuments[], legalReferences[{title,type,reference,binding}], practicalWarnings[], commonMistakes[], nextStepChecklist[{step,priority,mandatory}], escalationRecommendation|null, disclaimer }`

## Key rule
Disclaimer must always be present. AI prompt explicitly forbids fabricating law/article numbers. Every legal reference must be marked `binding: true` (legal requirement) or `binding: false` (best practice).
