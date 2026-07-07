# MARSAD v1.0 — Rollback Plan
**Release:** `v1.0-certified`  
**Date:** 7 July 2026  
**Classification:** Internal — Release Management

---

## Purpose

This document defines the rollback procedure if a critical defect is discovered after production deployment of MARSAD v1.0. It covers service rollback, database state management, and communication steps.

---

## Rollback Decision Criteria

Initiate a rollback if **any** of the following occur within the first 72 hours after go-live:

| Trigger | Threshold |
|---------|-----------|
| API server exits or becomes unreachable | Any unplanned downtime > 5 minutes |
| Database corruption or data loss | Any confirmed instance |
| Security breach or IDOR vulnerability confirmed | Any confirmed instance |
| Critical AI pipeline failure rate | > 50% of sessions stuck in `analyzing` state for > 10 minutes |
| Stage gate bypass confirmed | Any confirmed instance |
| Frontend blank / unresponsive | Reproducible by > 2 users for > 10 minutes |

For non-critical defects (UI glitches, minor display issues, performance degradation), apply a hotfix instead of rolling back.

---

## Rollback Scope

### In-Scope for Rollback
- API server application code (to the last stable tag)
- Frontend application code
- Environment configuration

### Out-of-Scope for Rollback (data-preserving)
- Database schema changes: migrations are **additive** (new columns/tables only); rolling back code does not reverse migrations
- Audit trail events: audit log entries are append-only and must not be deleted
- Sealed decisions: sealed state is constitutional and must be preserved
- KB documents and collections: data is retained across code rollbacks

---

## Rollback Procedure

### Step 1 — Declare Rollback (< 5 minutes)

1. Release Manager confirms rollback decision.
2. Notify all active users: "MARSAD is undergoing emergency maintenance. Sessions will be briefly unavailable."
3. Record start time in the incident log.

---

### Step 2 — Identify Safe Target Tag (< 5 minutes)

```bash
# List available tags in reverse chronological order
git tag --sort=-creatordate | head -10

# Confirm the rollback target
git show v1.0-certified --stat
```

The rollback target is `v1.0-certified` (the current certified tag). If the defect exists in `v1.0-certified`, rollback to the last known good commit on `main` before the defect was introduced.

---

### Step 3 — Roll Back API Server (< 10 minutes)

```bash
# On the server environment:

# 1. Stop the API server workflow
#    (via Replit workflow controls or: kill the running process)

# 2. Check out the rollback target
git checkout v1.0-certified

# 3. Rebuild the API server
cd artifacts/api-server
pnpm run build

# 4. Restart the API server workflow
#    (via Replit workflow: artifacts/api-server: API Server)

# 5. Confirm health
curl http://localhost:8080/api/healthz
# → {"status":"ok"}
```

---

### Step 4 — Roll Back Frontend (< 5 minutes)

```bash
# 1. Stop the frontend workflow

# 2. Ensure working tree is on rollback commit (same as step 3)
git checkout v1.0-certified

# 3. Restart the frontend workflow
#    (via Replit workflow: artifacts/legal-research: web)

# 4. Confirm frontend loads
curl http://localhost:<FRONTEND_PORT>/ -w "%{http_code}"
# → 200
```

---

### Step 5 — Verify Rollback (< 10 minutes)

Run the Section E smoke test from the Deployment Checklist:

| Check | Expected |
|-------|----------|
| `GET /api/healthz` | 200 `{"status":"ok"}` |
| `GET /api/decisions` (owner) | 200 |
| `GET /api/decisions` (citizen) | 403 |
| Frontend root | 200 |
| Sidebar renders | No blank page |

If all checks pass, notify users that the platform has been restored.

---

### Step 6 — Preserve Evidence (< 30 minutes)

```bash
# Capture logs from failed deployment for post-incident analysis
cp /tmp/logs/artifactsapi-server_API_Server_*.log /tmp/incident-$(date +%Y%m%d-%H%M%S)-api.log
cp /tmp/logs/artifactslegal-research_web_*.log /tmp/incident-$(date +%Y%m%d-%H%M%S)-frontend.log

# Take a DB snapshot of affected tables if data integrity is in question
# (coordinate with DBA — do not run arbitrary DDL)
```

---

### Step 7 — Post-Rollback Report (< 24 hours)

Release Manager prepares a written incident report covering:

1. Defect description (what failed, when, how discovered)
2. Impact (affected users, affected data, duration)
3. Rollback steps taken and time taken
4. Root cause (preliminary)
5. Corrective action plan for re-release (hotfix or scheduled patch)

---

## Hotfix Path (Non-Critical Defects)

If the defect does not trigger a rollback but requires a fix:

```bash
# Create a hotfix branch from the certified tag
git checkout -b hotfix/v1.0.1 v1.0-certified

# Apply the fix
# ... edit files ...

# TypeScript check
cd artifacts/api-server && npx tsc --noEmit
cd artifacts/legal-research && npx tsc --noEmit

# Commit
git add -A && git commit -m "hotfix: <short description>"

# Create patch tag
git tag -a v1.0.1-hotfix -m "MARSAD v1.0.1 hotfix — <description>"

# Merge back to main and release/v1.0
git checkout main && git merge hotfix/v1.0.1
git checkout release/v1.0 && git merge hotfix/v1.0.1
```

---

## Database-Specific Rollback Notes

| Scenario | Approach |
|----------|----------|
| New column added but code reverted | Column remains. Old code ignores it. **No action needed.** |
| New table added but code reverted | Table persists in DB with whatever data it contains. Old code does not reference it. **No action needed** — data is preserved and harmless. |
| Data corruption in `decisions` table | Restore from database backup. Coordinate with Replit DB support. |
| Audit trail corruption | Audit log is append-only. Do not delete entries. Contact legal team. |
| KB documents corrupted | Re-run the KB ingestion seed runners (idempotent, safe to re-run). |
| NRME risk categories corrupted | NRME seed runs automatically and idempotently on every server startup via `seedDatabase()`. Restart the API Server workflow — categories will be re-seeded. |

---

## Escalation Contacts

| Role | Responsibility |
|------|---------------|
| Release Manager | Go/no-go decision on rollback; incident declaration |
| System Administrator | Execute rollback steps; service restart |
| Information Security Officer | Confirm if security breach triggered rollback; preserve evidence |
| Database Administrator | DB backup restore; schema verification |

---

## Recovery Time Objective (RTO)

| Scenario | Target RTO |
|----------|------------|
| Code rollback (no DB issues) | < 30 minutes |
| Code rollback + DB restore from backup | < 4 hours |
| Full rebuild from tag + DB restore | < 8 hours |

---

*Rollback plan version: 1.0*  
*Generated: 7 July 2026*  
*Review this document before every production deployment.*
