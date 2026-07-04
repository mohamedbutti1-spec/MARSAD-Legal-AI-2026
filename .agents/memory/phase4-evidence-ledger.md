---
name: Phase 4 — Evidence Ledger
description: Constitutional Chain of Custody and Evidence Ledger — DB schema, service, routes, hooks, verifier design, and a critical verifier bug found during code review.
---

## Table
`evidence_ledger` — append-only, one row per constitutional event per decision.
Key columns: `previous_hash` (prior event's `currentHash`), `current_hash` (SHA-256 of this event's fields), `chain_hash` (cumulative), `digital_signature_placeholder`.

## Advisory lock
Scope: `0x4556_4944` ("EVID") — distinct from CMEM (`0x434d_454d`) and CMTL (`0x434d_544c`).

## Hash design
- `previousHash` = prior event's `currentHash` (NOT prior event's `chainHash`)
- `currentHash` = SHA-256(null-byte-separated field list, fixed order)
- `chainHash` = SHA-256(`(prevCurrentHash ?? "GENESIS")` + `"\x00"` + `currentHash`)
- `digitalSignaturePlaceholder` = `PKI-PLACEHOLDER:<currentHash[:16]>`

## Critical verifier bug (fixed)
**Bug**: original verifier compared `ev.previousHash` against `prevChainHash` — wrong because `previousHash` stores the prior event's `currentHash`, not `chainHash`. This caused false `brokenLinks` on multi-event chains (reported `valid: false` for any chain with ≥ 2 events).

**Fix**: track two separate variables in the loop:
- `prevCurrentHash` — compare to `ev.previousHash` to detect chain breaks
- use `prevCurrentHash` in chainHash recomputation: `SHA256((prevCurrentHash ?? "GENESIS") + "\x00" + expectedCurrentHash)`

Also added `chainHash` recomputation and validation — previously the cumulative hash was never verified.

**Why this matters**: Any future verifier or porting must be careful to distinguish `currentHash` (field hash) from `chainHash` (cumulative chain hash). They are different and serve different purposes.

## Routes
All at `/evidence/*` (NOT `/api/evidence/*` — app mounts at `/api`):
- `GET /evidence/:id` — full chain + verification
- `GET /evidence/:id/verify` — integrity engine (missing events, broken links, score)
- `GET /evidence/:id/export` — court-ready judicial package (fetches all artefacts in parallel)

## Integrity score
`score = max(0, min(100, 100 - 20*hashErrors - 10*brokenLinks))`

## Hooks wired (fire-and-forget, all with .catch())
- decisions.ts: decision.created, stage.completed, dci.amended, qva.executed, car.generated
- governance.ts: decision.delegated, decision.undelegated

## RBAC
- Read (GET /evidence/:id, /verify): `canReadAuditLog` OR `canRunHashVerification` OR role==judge
- Export (GET /evidence/:id/export): `canRunHashVerification` OR role==judge

## Frontend
`EvidenceLedgerTab` component in governance-hub.tsx — 8th tab in JudgeDashboard ("🔐 سجل الأدلة"):
- Integrity badge (score 0-100, color-coded emerald/amber/red)
- Verify button → GET /evidence/:id/verify, displays live result
- Export button → GET /evidence/:id/export, downloads JSON
- Chain graph (vertical timeline with colored nodes by event category)
- Event inspector (expandable cards with hash viewer, metadata, chain links)
- Append-only notice footer
