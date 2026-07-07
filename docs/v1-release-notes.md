# MARSAD v1.0 — Release Notes
**Release Date:** 7 July 2026  
**Release Branch:** `release/v1.0`  
**Tag:** `v1.0-certified`  
**Platform:** MARSAD — Intelligent Administrative Decision Platform (UAE)

---

## Release Overview

MARSAD v1.0 is the first production-certified release of the Intelligent Administrative Decision Platform for UAE government legal institutions. It delivers a complete 10-module lifecycle platform supporting the creation, evaluation, governance, and audit of administrative decisions, backed by a constitutional AI layer and a UAE legal knowledge base.

---

## What's Included in v1.0

### Module 1 — Administrative Decision Lifecycle
- Full 7-stage constitutional lifecycle: Foundation → Legal Basis → Impact → Risk → Compliance → CIL Assessment → Seal
- Sequential stage gate enforcement (422 on skip attempt)
- AI-assisted stage drafting with validation pass/fail
- Decision Constitutional Identity (DCI) auto-created on decision creation
- Sealed-state source of truth via DCI (not `decisions.status`)
- Reference number format: UAE/YYYY/NNN
- Audit hash chain integrity on every stage mutation

### Module 2 — Executive Governance Layer
- Governance dashboard: KPIs, compliance distribution, attention decisions
- Role-based permission matrix (14 roles, 13 non-citizen professional roles)
- Org-scoped governance statistics for minister/undersecretary
- Constitutional Reviewer access to all CIL warnings

### Module 3 — Chain of Custody + Constitutional Memory
- Hash-chained custody events on every decision state change
- Constitutional Memory: principle mappings preserved across decision lifecycle
- Nested transaction fix; hash normalization across chain

### Module 4 — Evidence Ledger
- Evidence attachments with content-addressed hash
- Advisory lock `0x4556_4944` ("EVID") prevents concurrent evidence corruption
- Chain hash re-validated on every ledger read

### Module 5 — Constitutional Judicial Intelligence (CIL)
- 12-principle AI assessor running post-seal
- Warning tracking: unresolved/resolved per principle
- Dashboard scoped by org and sealed state
- Replay stage 15 (virtual): CIL Assessment recorded in timeline

### Module 6 — Decision Replay Engine
- 14-stage timeline (stages 3, 10, 11, 12 are virtual — auto-computed)
- Replay failures are non-fatal; timeline degrades gracefully
- Direct DB insert for virtual stage events

### Module 7 — National Risk Modeling Engine (NRME)
- 3 aggregate scores: NRI (National Risk Index), ALI (Administrative Liability Index), DCS (Decision Compliance Score)
- 9 UAE government risk categories
- Lazy score calculation on first access; sealedOnly enforcement

### Module 8 — NAIP (National Administrative Intelligence Platform)
- 9 dashboard pages, 8 API endpoints, 2 permission flags
- Org-scoped role gating with 403 on unauthorized org access
- UAE performance indicators, risk heat maps, compliance analytics

### Module 9 — Knowledge Base + Retrieval
- 22 seeded documents across 12 collections
- UAE Case Law corpus: Federal Supreme Court administrative chamber decisions
- Legislation seeded: Decree-Law 21/2021, Cabinet Decision 9/2021, Cabinet Resolution 17/2023
- 60 administrative judiciary principles
- Cross-reference graph: amendment chains, citation networks
- Vector search with FTS fallback; fabrication filter strips uncited tags

### Module 10 — Professional Intelligence Suite
- **JRE** (Judicial Reasoning Engine): 6-stage pipeline, theory mode, KB-backed citation
- **JDC** (Judicial Deliberation Chamber): 4-phase parallel panel deliberation, majority ruling synthesis
- **SPG** (Smart Professional Guidance): 9 sectors, config-driven wizard
- **PGF** (Professional Guidance Framework): 20 professions, decision-tree routing, stage-by-stage assessment
- **PME** (Professional Mentor Engine): 11 optional stage fields, expert actions
- **PCS** (Professional Case Simulator): scenario-based sessions, server-side critical error scoring
- **ADKG** (Administrative Decision Knowledge Graph): 16-pillar analysis, graph enrichment, IDOR-safe
- **JDT** (Judicial Dimension Taxonomy): 16 Shamsi dimensions, per-stage theory mode
- **Research Workspace**: project-based document management, FTS, owner-scoped IDOR protection

---

## Bugs Fixed Before Release (14 Total)

| # | Severity | Defect | Fix |
|---|----------|--------|-----|
| 1 | High | `requireAnyRole` allowed only 3 roles — professional roles blocked | Expanded to all 13 non-citizen roles |
| 2 | High | JRE `POST /sessions` synchronous — AI blocked HTTP response | `setImmediate` async pattern — 201 immediately |
| 3 | High | JDC `POST /chambers` synchronous AI hang | `setImmediate` async — 201 immediately |
| 4 | High | SPG `POST /sessions/:id/run` synchronous AI hang | `setImmediate` async — 202 immediately |
| 5 | High | PGF `POST /sessions/:id/finalize` synchronous AI hang | `setImmediate` async — 202 immediately |
| 6 | High | `canUseAi` only `owner\|supervisor` — professionals blocked from AI | Changed to `role !== 'citizen'` |
| 7 | Medium | No `canCreateDecision` flag — decision form accessible to all roles | Added `owner\|supervisor` only; RouteGuard applied |
| 8 | Medium | "New Decision" buttons visible to all roles in UI | Gated by `{canCreateDecision && ...}` |
| 9 | Medium | "New Decision" links in NAIP executive dashboard | Removed |
| 10 | Medium | Dashboard AI chips (SPG/PGF/AI-fill) shown to citizen | Filtered by `requiresAi` flag + `canUseAi` guard |
| 11 | Low | Citizen portal (`/citizen`) existed but had no sidebar nav item | Added "بوابة المواطن" entry |
| 12 | Low | Duplicate `/decisions` link in JDT sidebar section | Removed the duplicate |
| 13 | Low | No global `process.on('unhandledRejection')` handler | Added — background AI failures logged, server stays up |
| 14 | Low | Workspace/ADKG/KB router guard too narrow | Changed to `requireAnyRole` |

---

## Platform Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite 7 + Wouter + TailwindCSS |
| Backend | Node.js + Express + Drizzle ORM |
| Database | PostgreSQL (Replit-managed) |
| AI | Anthropic Claude (via Replit AI Integrations proxy) |
| Vector Search | pgvector + pg_trgm |
| Auth | Header-based role simulation (internal deployment) |
| Async Jobs | `setImmediate` pattern (JRE, JDC, SPG, PGF) |

---

## API Surface

- **223 registered API routes** across 20+ route files
- **58 registered frontend routes** across 10 modules
- Rate limits: AI sessions (10/min), AI analysis (30/min), KB search (60/min)
- Health check: `GET /api/healthz` → `{"status":"ok"}`

---

## Security Posture

| Area | Status |
|------|--------|
| IDOR protection | ✅ All resources owner-scoped |
| Permission escalation | ✅ Blocked at middleware + route level |
| Stage gate integrity | ✅ Sequential enforcement with 422 |
| Data isolation | ✅ Cross-user contamination blocked |
| Input validation | ✅ 400 on all malformed inputs |
| Rate limiting | ✅ 429 on limit (never 500) |
| Unhandled rejections | ✅ Global handler installed |
| **Auth identity model** | ⚠️ **Header-trust (V2 priority 1 — JWT/session auth)** |

---

## Known Limitations in v1.0

1. **Header-based auth**: Role and user identity are read from `x-user-role` and `x-user-id` HTTP headers. Acceptable for internal network deployment. Must be replaced with verified session/JWT before internet-facing production.
2. **AI latency variability**: AI pipeline completion time varies from 15–120 seconds depending on model load. Clients must poll for completion status.
3. **PDF export**: Not available in v1.0. Deferred to v2.0.
4. **Streaming AI output**: Not available in v1.0. Full content delivered on poll completion.
5. **Document comparison UI**: Screen placeholder only.
6. **Admin users REST API**: No `GET /api/admin/users` endpoint — user management is UI-only in this release.

---

## Deferred to v2.0

See `docs/v1-production-certification-report.md` §5 for full list.

Top V2 priorities:
1. Replace header-trust auth with JWT/session identity verification
2. PDF brief export for JRE, JDC, SPG, PGF
3. Streaming AI output (section-by-section rendering)
4. Session history with search (JRE, KB queries)
5. ADKG 16-pillar comparison between decisions
6. Dark mode toggle
7. Assessment caching to avoid duplicate AI calls

---

*Release notes version: 1.0-final*  
*Generated: 7 July 2026*
