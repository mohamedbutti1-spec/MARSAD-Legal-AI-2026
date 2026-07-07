# MARSAD v1.0 — Deployment Checklist
**Release:** `v1.0-certified` on branch `release/v1.0`  
**Date:** 7 July 2026  
**Environment:** Replit Production (internal UAE government deployment)

---

> **Instructions:** Each step must be checked off by a named operator before proceeding to the next section.  
> Do not skip any step. If any step fails, halt and escalate to the Release Manager.

---

## Section A — Pre-Deployment Verification

| # | Step | Verified By | Timestamp | Status |
|---|------|-------------|-----------|--------|
| A1 | Confirm git branch is `release/v1.0` | | | ☐ |
| A2 | Confirm git tag `v1.0-certified` points to current HEAD | | | ☐ |
| A3 | Confirm working tree is clean (`git status` shows no uncommitted changes) | | | ☐ |
| A4 | Confirm `docs/v1-production-certification-report.md` exists and is up to date | | | ☐ |
| A5 | TypeScript check passes: `pnpm --filter @workspace/api-server run build` exits 0 | | | ☐ |
| A6 | TypeScript check passes: frontend `tsc --noEmit` exits 0 | | | ☐ |
| A7 | All UAT batch results reviewed and on file | | | ☐ |
| A8 | Field-testing checklist distributed and results collected (or waived with Release Manager sign-off) | | | ☐ |

**Section A Signed Off By:** ________________  Date: ________________

---

## Section B — Environment Variables

All variables must be set in the deployment environment **before** starting services. Do not deploy if any required variable is missing.

| # | Variable | Required | Description | Confirmed |
|---|----------|----------|-------------|-----------|
| B1 | `DATABASE_URL` | ✅ Required | PostgreSQL connection string | ☐ |
| B2 | `SESSION_SECRET` | ✅ Required | ≥ 32-char random secret for session signing | ☐ |
| B3 | `ANTHROPIC_API_KEY` | ✅ Required | Claude AI API key (Replit AI Integrations proxy) | ☐ |
| B4 | `PORT` | ✅ Required | API server port (set by Replit automatically) | ☐ |
| B5 | `NODE_ENV` | ✅ Required | Must be `production` in production | ☐ |
| B6 | `REPLIT_DEV_DOMAIN` | Auto-set | Replit proxy domain — set automatically | ☐ |

**Verification command (run on the server, observe no missing entries):**
```bash
for var in DATABASE_URL SESSION_SECRET ANTHROPIC_API_KEY PORT NODE_ENV; do
  [ -n "$(printenv $var)" ] && echo "✅ $var" || echo "❌ MISSING: $var"
done
```

**Section B Signed Off By:** ________________  Date: ________________

---

## Section C — Database

| # | Step | Command / Action | Status |
|---|------|------------------|--------|
| C1 | Confirm database is accessible from the server | `psql $DATABASE_URL -c "SELECT 1"` returns 1 | ☐ |
| C2 | Confirm migrations have run (seed tables exist) | `psql $DATABASE_URL -c "\dt" \| grep decisions` | ☐ |
| C3 | Confirm pgvector extension is installed | `psql $DATABASE_URL -c "SELECT extname FROM pg_extension WHERE extname='vector'"` | ☐ |
| C4 | Confirm KB collections are seeded (minimum 12) | `psql $DATABASE_URL -c "SELECT count(*) FROM kb_collections"` → ≥ 12 | ☐ |
| C5 | Confirm KB documents are seeded (minimum 22) | `psql $DATABASE_URL -c "SELECT count(*) FROM kb_documents"` → ≥ 22 | ☐ |
| C6 | Confirm NRME risk categories seeded (exactly 9) | `psql $DATABASE_URL -c "SELECT count(*) FROM nrme_risk_categories"` → 9 | ☐ |

**Section C Signed Off By:** ________________  Date: ________________

---

## Section D — Service Startup

| # | Step | Expected Result | Status |
|---|------|-----------------|--------|
| D1 | Start API server workflow | `Server listening port: 8080` in logs (no ERROR lines on startup) | ☐ |
| D2 | Confirm all migration logs complete without error | `migration complete` lines present for all phases (57, 58, JRE, JDC, SPG, PGF, PCS, NRME) | ☐ |
| D3 | Start frontend workflow | `VITE vX.X.X  ready in …ms` in logs | ☐ |
| D4 | Health check passes | `curl /api/healthz` → `{"status":"ok"}` HTTP 200 | ☐ |

**Section D Signed Off By:** ________________  Date: ________________

---

## Section E — Route Smoke Test

Run these checks against the live deployment URL. All must return the expected HTTP status.

| # | Endpoint | Role Header | Expected | Actual | Status |
|---|----------|-------------|----------|--------|--------|
| E1 | `GET /api/healthz` | none | 200 | | ☐ |
| E2 | `GET /api/decisions` | owner | 200 | | ☐ |
| E3 | `GET /api/governance/dashboard` | owner | 200 | | ☐ |
| E4 | `GET /api/jre/sessions` | judge | 200 | | ☐ |
| E5 | `GET /api/jdc/chambers` | judge | 200 | | ☐ |
| E6 | `GET /api/spg/sessions` | legal_department | 200 | | ☐ |
| E7 | `GET /api/pgf/sessions` | legal_department | 200 | | ☐ |
| E8 | `GET /api/naip/overview` | undersecretary | 200 | | ☐ |
| E9 | `GET /api/kb/search?q=admin` | owner | 200 | | ☐ |
| E10 | `GET /api/adkg/search?q=admin` | judge | 200 | | ☐ |
| E11 | `GET /api/research/workspace/projects` | owner | 200 | | ☐ |
| E12 | `GET /api/decisions` | citizen | 403 | | ☐ |
| E13 | `POST /api/decisions` | judge (no body) | 403 | | ☐ |

**All 13 checks must pass before proceeding.**

**Section E Signed Off By:** ________________  Date: ________________

---

## Section F — Frontend Verification

| # | Page | URL | Expected | Status |
|---|------|-----|----------|--------|
| F1 | Root Dashboard | `/legal-research/` | Dashboard loads, no blank page, no console errors | ☐ |
| F2 | Administrative Decisions | `/legal-research/decisions` | Decision list renders | ☐ |
| F3 | Governance | `/legal-research/governance` | Governance KPIs visible | ☐ |
| F4 | JRE | `/legal-research/jre` | Sessions list loads | ☐ |
| F5 | JDC | `/legal-research/jdc` | Chambers list loads | ☐ |
| F6 | KB Search | `/legal-research/kb-search` | Search bar renders | ☐ |
| F7 | NAIP | `/legal-research/naip` | NAIP dashboard renders | ☐ |
| F8 | Citizen Portal | `/legal-research/citizen` | Citizen portal renders | ☐ |
| F9 | Sidebar — no duplicate links | All pages | Each sidebar href appears exactly once | ☐ |
| F10 | Role switch — citizen | Switch to citizen role | "New Decision" buttons absent; SPG/PGF chips absent | ☐ |

**Section F Signed Off By:** ________________  Date: ________________

---

## Section G — Security Spot Check

| # | Check | Expected | Status |
|---|-------|----------|--------|
| G1 | `POST /api/decisions` as `citizen` | 403 | ☐ |
| G2 | `POST /api/decisions` as `external_auditor` | 403 | ☐ |
| G3 | `GET /api/jre/sessions` with different userId — verify no other user's sessions in response | Empty array or own sessions only | ☐ |
| G4 | Invalid reference number format submitted to `POST /api/decisions` | 400 | ☐ |
| G5 | `GET /api/healthz` — confirm no internal stack trace in response | Only `{"status":"ok"}` | ☐ |

**Section G Signed Off By:** ________________  Date: ________________

---

## Section H — Final Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Release Manager | | | |
| System Administrator | | | |
| Information Security Officer | | | |

**All sections A–G must be checked before signatures are collected.**

> By signing this checklist, each signatory confirms that MARSAD v1.0 has met all pre-deployment requirements and is authorized for production activation.

---

*Checklist version: 1.0*  
*Generated: 7 July 2026*
