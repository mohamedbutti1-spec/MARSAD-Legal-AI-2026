---
name: DCI — Decision Constitutional Identity
description: Design decisions, constraints, and gotchas for the DCI system (constitutional passport attached to every administrative decision).
---

## What it is
The DCI is an auto-generated, auto-updated record that accumulates constitutional indicators as each of the 11 stages completes. It is sealed (immutable except via recorded amendment) when `constitutional_validation` passes.

## DB
- Table: `decision_dci` in `lib/db/src/schema/decisions.ts`
- FK: `decisionId` references `decisionsTable.id` with `onDelete: "cascade"`
- All status fields are unconstrained `text` (valid values are enforced at the API layer via `AMENDABLE_FIELDS`)
- `versionHistory` is a JSON column typed `DciVersion[]` — append-only; never truncated
- `isSealed` + `sealedAt` + `sealedBy` are set atomically inside `updateDciFromStage` when `constitutional_validation` passes

## Stage → DCI field mappings
| Stage | Fields updated |
|---|---|
| `legal_authority` | `competentAuthority` |
| `facts_evidence` | `evidenceCompleteness` (mapped from `aiAnalysis.evidenceQuality`) |
| `legal_basis` | `applicableLegalBasis`, `legalityStatus` |
| `administrative_objective` | `purposeOfDecision` |
| `proportionality` | `proportionalityStatus` |
| `human_oversight` | `humanDecisionOwner`, `aiParticipationLevel` (always "comprehensive"), `humanOversightLevel` |
| `constitutional_validation` | `constitutionalValidationStatus`, `explainabilityLevel`, `transparencyLevel`, `alShamsiFrameworkCompliance`; also seals + sets `completeAuditHash` |

## Hash design
- `completeAuditHash` = SHA-256 over all stage `auditHash` values joined by `|` (set at seal time)
- After each amendment: new hash = SHA-256(`prevHash|amendment:` + canonical JSON of `{ reason, changedAt, changedBy, changes }`)
- This gives a cryptographic chain: every amendment is attested including its content

## Amendment endpoint rules
- Endpoint: `POST /decisions/:id/dci/amend` — `requireSupervisorOrOwner` only
- Only sealed DCIs may be amended
- Explicit `AMENDABLE_FIELDS` allowlist: status fields validated against Set of permitted values; text fields accept any string/null
- Read-modify-write runs in a drizzle `.transaction()` with `.for("update")` row lock to prevent concurrent amendment races
- Each amendment appends to `versionHistory` and increments `currentVersion`

## Non-fatal DCI update pattern
`updateDciFromStage` is called inside a try/catch in the `complete` handler. DCI update failure must never block stage completion — it logs `[dci.update.failed]` but the stage succeeds.

## Frontend
- DCI tab added to decision workspace (between header and two-column layout)
- `DciPanel` polls every 8s via React Query `refetchInterval` while stages are completing
- TypeScript narrowing: after compound null guards, add `if (!dci) return null;` to give the compiler a clear narrowing point — otherwise TS18047 errors cascade

**Why:** Constitutional identity must be immutable and auditable; the transaction + hash chain + allowlist together enforce this without needing a separate audit service.
