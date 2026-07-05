# MARSAD — منصة القرار الإداري الذكي
## Intelligent Administrative Decision Platform · Version 1.0

MARSAD is a comprehensive AI-powered platform for UAE administrative decision governance, built for محمد الشامسي. It enforces constitutional integrity, produces court-ready documentation, and simulates judicial outcomes before decisions are issued.

---

## Quick Start

```bash
# Start both services (handled automatically by Replit workflows)
pnpm --filter @workspace/api-server run dev     # API server
pnpm --filter @workspace/legal-research run dev # Frontend

# Full typecheck across all packages
pnpm run typecheck

# Build all packages
pnpm run build

# Push DB schema changes (dev only — never run against production without backup)
pnpm --filter @workspace/db run push
```

---

## Required Secrets

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-provisioned by Replit) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key — **server-side only, never sent to browser** |
| `SESSION_SECRET` | Session signing secret |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9 |
| Monorepo | pnpm workspaces |
| Frontend | React 18 + Vite 7 + TanStack Query + Wouter + Tailwind CSS |
| API | Express 5 + Pino logger + Helmet + rate-limit |
| Database | PostgreSQL + Drizzle ORM |
| AI | Anthropic Claude (claude-opus-4-5) — server-side only |
| Auth | Header-based RBAC (`X-User-Role` / `X-User-Id` / `X-User-Org`) |

---

## Monorepo Structure

```
lib/
  db/                   Drizzle schema, migrations, service layer
  api-spec/             OpenAPI 3.1 spec + Orval codegen
artifacts/
  api-server/           Express API (all routes)
  legal-research/       React frontend (all pages, components)
  mockup-sandbox/       Vite component preview server (dev only)
```

---

## Platform Modules (Version 1.0 — Feature Frozen)

### Core Decision Lifecycle
| Module | Route Prefix | Description |
|---|---|---|
| Decision Workspace | `/decisions` | 10-stage administrative decision workflow |
| Decision Constitutional Identity (DCI) | `/api/dci` | Immutable constitutional passport per decision |
| Judicial Defense Package (JDP) | `/api/jdp` | AI-generated litigation strategy document |
| Constitutional Answer Record (CAR) | `/api/car` | Citizen-facing transparency document |

### Governance & Oversight
| Module | Route Prefix | Description |
|---|---|---|
| Executive Governance Dashboard | `/governance` | Cross-org decision monitoring (Phase 2) |
| Chain of Custody | `/api/custody` | SHA-256 hash chain of all decision delegations |
| Constitutional Memory | `/api/memory` | Decision history and institutional memory |
| Evidence Ledger | `/api/evidence` | Immutable evidence chain with advisory lock |

### Intelligence & Analysis
| Module | Route Prefix | Description |
|---|---|---|
| Decision Replay Engine | `/api/replay` | 16-stage timeline reconstruction |
| NRME — National Risk Modeling Engine | `/api/risk` | 9-category risk scoring (NRI / ALI / DCS) |
| CIL — Constitutional Intelligence Layer | `/api/cil` | 12-principle constitutional AI assessment |
| JDT — Judicial Digital Twin | `/api/jdt` | 8-stage judicial simulation + 16 Al-Shamsi dimensions |

### NAIP — National Administrative Intelligence Platform
| Module | Route Prefix | Description |
|---|---|---|
| NAIP Executive Homepage | `/naip` | Cross-module unified overview |
| National Intelligence Dashboard | `/naip/dashboard` | 5 national KPI gauges |
| National KPI Center | `/naip/kpi` | UAE / Ministry / Emirate / Org breakdowns |
| Global Search | `/naip/search` | Cross-module federated search |
| Role Dashboards | `/naip/minister` etc. | Role-specific governance views |

### Reference & Research
| Module | Route Prefix | Description |
|---|---|---|
| Legal Source Library | `/sources` | UAE/France legal documents, articles |
| Al-Shamsi Theory Reference | `/alshamsi` | 16-dimension administrative law framework |
| Legal Research AI | `/research` | Claude-powered legal research assistant |
| Comparative Law | `/compare` | UAE vs France side-by-side analysis |
| PDF Export / ADP | `/api/adp` | Court-ready Administrative Decision Package |

---

## Role Permissions (RBAC)

Roles are set via `X-User-Role` header. The permission matrix lives in `lib/db/src/permissions.ts` (source of truth) and is mirrored in `artifacts/legal-research/src/lib/permissions.ts` (frontend copy).

| Role | Access Level |
|---|---|
| `owner` | Full platform access |
| `supervisor` | Full platform access |
| `minister` | Cross-ministry, all decisions, JDT, CIL |
| `undersecretary` | Ministry-wide, all decisions |
| `assistant_undersecretary` | Ministry-wide, most features |
| `director_general` | Org-scoped only (`seeOwnOrgOnly`) |
| `department_director` | Org-scoped, limited AI access |
| `legal_department` | Legal docs, JDP, JDT, CIL |
| `constitutional_reviewer` | CIL, JDT, sealed decisions |
| `internal_auditor` | Read-only audit + CIL |
| `external_auditor` | Sealed decisions only (`sealedOnly`) |
| `judge` | Full judicial access, JDT, CIL |
| `viewer` | Read-only, no AI |
| `citizen` | CAR only |

---

## Database Schema

All tables in `lib/db/src/schema/`:

| File | Tables |
|---|---|
| `decisions.ts` | `decisions`, `decision_stages`, `decision_dci`, `decision_jdp`, `decision_car` |
| `audit-logs.ts` | `audit_logs` |
| `custody.ts` | `decision_custody_chain` |
| `memory.ts` | `decision_memory`, `decision_memory_events` |
| `evidence.ts` | `evidence_ledger` |
| `replay.ts` | `decision_replay_events` (16 stages including virtual CIL + JDT) |
| `risk.ts` | `risk_assessments`, `risk_categories`, `risk_scenarios`, `risk_treatments`, `risk_history`, `risk_indicators`, `risk_mitigations`, `risk_compliance`, `risk_audits` |
| `cil.ts` | `constitutional_assessments`, `constitutional_warnings` |
| `jdt.ts` | `jdt_simulations` |
| `documents.ts` | `documents`, `users`, `comparisons`, `comments`, `settings` |

---

## AI Integration

All AI calls go through `artifacts/api-server/src/ai/index.ts`:
- **`aiRouter.routeFor(taskType)`** — routes to correct Anthropic model
- **`TaskType`** — typed task categories controlling model selection and token limits
- **`parseModelJson(text)`** — safely parses AI JSON, strips `<think>` tags
- Claude API key is server-side only — never exposed to the browser

---

## Key Architecture Decisions

1. **Header-based auth** (`X-User-Role`, `X-User-Id`, `X-User-Org`) — Alpha 1.0 constraint. Replace with UAE Pass / JWT for Version 2.0.
2. **Dual permissions file** — `lib/db/src/permissions.ts` (server + DB) mirrors `artifacts/legal-research/src/lib/permissions.ts` (frontend). Both must be updated together when adding flags.
3. **Virtual replay stages** — Stages `replay_15_cil_assessment` and `replay_16_jdt_simulation` are written by direct `db.insert(decisionReplayEventsTable)` — not through `recordReplayEvent()` which uses `STAGE_KEY_TO_REPLAY_STAGE` and exits early for unmapped keys.
4. **Sealed state** — `decisions.status` has no `"sealed"` value. All sealed checks must use `decisionDci.isSealed` via DCI lookup.
5. **Org-scoped access** — Roles with `seeOwnOrgOnly: true` (director_general, department_director) can only see decisions matching their `X-User-Org` header. `GET /naip/stats/uae` returns HTTP 403 for these roles.
6. **AI prompt field names** — JDT prompt uses exact schema field names (`reasoning`, `outcome`, `uaeLegalReferences: string[]`). Never use aliased names like `reasoningAr` or `isDeficient` — the AI output is stored raw and rendered by the frontend without transformation.
7. **`tsc --build`** — Always run `pnpm --filter @workspace/db exec tsc --build` before checking API server types when `lib/db` schema changes.

---

## Gotchas

- Run `pnpm run typecheck:libs` before leaf package checks when changing `lib/*` packages
- `uploadsByDay` in dashboard stats uses `sql<number>` cast — do not change to string
- `GET /api/health` is mounted **before** auth middleware — do not move it
- The ADP/PDF endpoint uses Puppeteer with a pre-installed Chromium binary — `PUPPETEER_EXECUTABLE_PATH` must be set for deployment
- Evidence ledger uses advisory lock `0x4556_4944` ("EVID") — never remove it
- `constitutionalOutcome` in JDT uses `"pass"|"partial"|"fail"|"not_assessed"` — not CIL-style `"compliant"|"minor_concern"` etc.

---

## User Preferences

- Owner: محمد الشامسي (m.alshamsi@legal.ae)
- UI is bilingual Arabic/English; Arabic is default (`dir="rtl"`)
- AI features must never expose the API key to the browser
- All new features (Version 2.0+) must be scheduled via task queue — Version 1.0 is frozen

---

## Version History

| Version | Status | Description |
|---|---|---|
| 1.0 | **FROZEN** | Full MARSAD platform: 10 modules, 44 phases, 16-stage replay, JDT, CIL, NRME, NAIP |
| 2.0 | Planned | TBD — requires new task proposals |
