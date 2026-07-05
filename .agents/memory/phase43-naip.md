---
name: Phase 43 — NAIP Architecture
description: National Administrative Intelligence Platform — 9 frontend pages, 8 API endpoints, 2 permission flags, critical scoping rule for /naip/stats/uae
---

## Permission Flags
Two new flags added to BOTH `lib/db/src/permissions.ts` AND `artifacts/legal-research/src/lib/permissions.ts`:
- `canViewNaipDashboard` — all roles except citizen = true
- `canViewNaipSearch` — all roles except citizen = true

Also exposed in `artifacts/legal-research/src/lib/user-context.tsx` (interface + value object).

## API Endpoints (artifacts/api-server/src/routes/naip.ts)
8 endpoints, all guarded by `requirePermission("canViewNaipDashboard")` or `canViewNaipSearch`:
- `GET /naip/overview` — aggregated stats, org+sealed scoped via `getAccessibleDecisionIds`
- `GET /naip/global-search?q=` — min 2 chars, ?domain= filter, 4 domains, cap 50 results
- `GET /naip/kpi` — 5 KPI scores: NRI/ALI/DCS from riskAssessmentsTable, CCS/JSP from constitutionalAssessmentsTable
- `GET /naip/stats/org` — grouped by full organizationUnit
- `GET /naip/stats/ministry` — grouped by `orgUnit.split(' — ')[0]`
- `GET /naip/stats/emirate` — parsed with extractEmirate helper (looks for "إمارة" keyword)
- `GET /naip/stats/uae` — **GATES org-scoped roles with e403** (perms.seeOwnOrgOnly → 403, use /stats/org instead)
- `GET /naip/executive-data/:dashboardType` — DASHBOARD_TYPE_ROLE_MAP enforces role match

## Critical Scoping Rule
`/naip/stats/uae` must check `perms.seeOwnOrgOnly` and return 403 if true.
Reason: director_general and department_director must not see UAE-wide aggregates.
This is different from other endpoints that apply org filtering — here the entire endpoint is forbidden for org-scoped roles.

## ID Safety
`getAccessibleDecisionIds` sanitizes returned IDs: `.map(r => Math.floor(Number(r.id))).filter(n => !isNaN(n) && n > 0)` before use in `sql.raw()`.

## Frontend Pages (9 total)
- `/naip` → naip-home.tsx — NAIP Executive Platform
- `/naip/dashboard` → naip-dashboard.tsx — National Intelligence Dashboard
- `/naip/kpi` → naip-kpi.tsx — National KPI Center (4 tabs: UAE/ministry/emirate/org)
- `/naip/search` → naip-search.tsx — Global Search
- `/naip/minister` → naip-minister.tsx — Minister Dashboard (role-gated)
- `/naip/undersecretary` → naip-undersecretary.tsx — Undersecretary Dashboard
- `/naip/director-general` → naip-director-general.tsx — Director General Dashboard
- `/naip/risk-officer` → naip-risk-officer.tsx — Risk Officer Dashboard
- `/naip/judge` → naip-judge.tsx — Judge Dashboard

## Sidebar Section
New "naip" section added between "main" and "research" sections in sidebar.tsx.
Imports: `Target` and `Cpu` icons added from lucide-react.

## Header Auth Warning
x-user-role/x-user-id/x-user-org are header-based (same as all other MARSAD routes).
This is a known Alpha 1.0 demo-mode constraint. Do not change this pattern — it would require modifying all existing routes.
