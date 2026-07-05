---
name: Phase 57 — Legal Research Workspace
description: Architecture decisions, security rules, and patterns for the Research Workspace feature (projects, folders, items, versioning, citation staleness, export).
---

## DB Tables (6 new, all additive)
- `research_projects` — ownerId FK to users; status active|archived
- `research_folders`  — projectId FK, parentFolderId self-ref nullable
- `research_items`    — projectId FK, folderId nullable, item_type VARCHAR(30), content/metadata as TEXT JSON strings, search_vector TSVECTOR, versionNumber int
- `research_item_versions` — itemId FK, snapshot of content+metadata per save
- `research_answer_metadata` — itemId UNIQUE FK, Phase 56 provenance fields (citedAuthorities/verificationReport/retrievalInventory as TEXT JSON, confidenceLevel REAL)
- `citation_refresh_status` — itemId UNIQUE FK, kbDocumentIds TEXT JSON, isStale BOOLEAN, cooldown 5min

## Migration
`artifacts/api-server/src/research-workspace/migration.ts` — called from `seedDatabase()` in seed.ts at startup; all CREATE TABLE IF NOT EXISTS; GIN index on search_vector.

## Security rules (CRITICAL)
- All item-specific endpoints (versions, review) must check BOTH project ownership AND item-to-project membership via `where(and(eq(id, itemId), eq(projectId, projectId)))` query before acting. Checking project ownership alone is insufficient — IDOR via itemId.
- All projects scoped to `ownerId = getUserId(req)`.
- Silent catches on background ops (search vector, citation registration) must use `req.log.warn` not `() => {}`.

## FTS
Stored `search_vector TSVECTOR` column, updated on item create/update via `to_tsvector('simple', title || content)`. GIN index. Query uses `plainto_tsquery('simple', q)` + ILIKE fallback.

## Export
`artifacts/api-server/src/utils/research-export.ts` — PDF (Puppeteer same as admin-brief-pdf.ts), DOCX (docx npm), Markdown. Download via blob URL in frontend.

## Citation staleness
`artifacts/api-server/src/utils/citation-refresh.ts` — poll-on-open, 5min cooldown, compares `kb_documents.updated_at` against `citation_refresh_status.last_checked_at`. Raw KB doc IDs stored (no offset).

## Routes
`artifacts/api-server/src/routes/workspace.ts` — all under `/research/workspace/*` to avoid collision with existing `POST /research/search`.

## Frontend
- Pages: `workspace-dashboard`, `workspace-project`, `workspace-item` (in `artifacts/legal-research/src/pages/`)
- Components: `stale-citation-banner`, `answer-provenance`, `item-editor-dialog`, `search-panel` (in `src/components/workspace/`)
- Routed under `/workspace`, `/workspace/:projectId`, `/workspace/:projectId/items/:itemId`
- Sidebar nav item added to 'research' section with `FolderOpen` icon

**Why:** `docx` installed in `artifacts/api-server` package; `content`/`metadata` stored as TEXT JSON strings not JSONB (matches existing pattern in kb tables).
