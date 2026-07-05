---
name: Phase 58 — Administrative Decision Knowledge Graph (ADKG)
description: Architecture decisions, security rules, and patterns for the ADKG feature (decisions, polymorphic links, timeline events, decision-to-decision graph edges, SVG graph viz, PDF/DOCX/MD export).
---

## DB Tables (4 new, additive)
- `adkg_decisions` — core record: decisionNumber, title/titleAr, issuerOrg, subject, status (8-value lifecycle), issuedDate/effectiveDate/expiryDate as TEXT ISO, content/metadata as TEXT JSON, citedAuthorities/verificationReport as TEXT JSON, ownerId, search_vector TSVECTOR
- `adkg_decision_links` — polymorphic link to any entity (10 linkTypes × 6 entityTypes); titleAr/titleEn/linkedEntityRef; authorityClass (binding/persuasive/non_binding)
- `adkg_timeline_events` — lifecycle events with eventType (14 values), eventDate as TEXT ISO, status-events auto-update decision.status
- `adkg_graph_edges` — directed decision-to-decision edges (10 relationship types); fromDecisionId owner must be caller

## Security Rules (CRITICAL)
- **Graph node enrichment MUST be owner-scoped**: `GET /adkg/decisions/:id/graph` fetches connected decision metadata — MUST add `eq(ownerId, userId)` to that query or cross-user decision titles leak.
- **Child-entity DELETE** pattern: verify `assertDecisionOwner(decisionId, userId)` THEN verify child `WHERE id=childId AND decision_id=decisionId`. Both required.
- **POST /adkg/graph-edges**: only requires ownership of `fromDecisionId` (by design — can point to any target). But `/graph` must not expose the target's data if not owned by caller.
- All search (`/adkg/search`) and export endpoints are owner-scoped in SQL.

## Route Prefix
All endpoints under `/adkg/*` — additive, no collision with existing `/research/*` routes.

## FTS
Same pattern as Phase 57: `to_tsvector('simple', number || title || titleAr || subject || subjectAr)`, GIN index, `plainto_tsquery('simple', q)` + ILIKE fallback.

## Timeline Auto-Status
`POST /adkg/decisions/:id/timeline` — if eventType is one of the 8 lifecycle statuses, automatically updates `adkg_decisions.status`. No need to separately PATCH the decision.

## Export
`artifacts/api-server/src/utils/adkg-export.ts` — three functions: `exportAdkgAsMarkdown`, `exportAdkgAsDocx`, `exportAdkgAsPdf` (same Puppeteer launch as admin-brief-pdf.ts). DOCX uses existing `docx` npm package.

## Graph Visualization
`artifacts/legal-research/src/components/adkg/decision-graph.tsx` — pure SVG radial layout, no external library. Central node at (cx,cy), peripheral nodes at radius R = min(200, 80 + n*15). NODE_COLORS keyed by type; status dot overlay on decisions; edge labels from LINK_TYPE_LABELS map.

## Frontend
- Pages: `adkg-dashboard.tsx` (list + search + status filter), `adkg-detail.tsx` (4 tabs: Overview/Relationships/Timeline/Graph)
- Components: `decision-graph.tsx`, `decision-timeline.tsx`, `create-decision-dialog.tsx`, `add-link-dialog.tsx`
- Routed under `/adkg` and `/adkg/:id`
- Sidebar: "Decision Knowledge Graph" nav item with `Network` icon, badge 'جديد'

**Why additive**: mounted via `adkgRouter` in routes/index.ts, separate migration called from seed.ts. Zero changes to existing route files except registration lines.
