---
name: Phase 58 — UAE Admin Law Corpus Expansion
description: New seed files and runner registrations for the comprehensive UAE administrative law corpus added in Phase 58.
---

# Phase 58 — UAE Administrative Law Corpus Expansion

## What was added

### New legislation seed file
- `artifacts/api-server/src/kb/ingestion/seeds/admin-disputes-law.ts`
  - Federal Decree-Law 21/2021 (Administrative Disputes before the Courts) — full 31-article text
  - Federal Law 10/1973 (Federal Supreme Court — administrative jurisdiction provisions)
  - Federal Law 6/2012 (Government Financial Transactions — admin financial decisions key provisions)

### Expanded existing seeds
- `seeds/cabinet-ministerial.ts` — added Cabinet Decision 9/2021 (implementing regs for Decree-Law 21/2021) and Cabinet Resolution 17/2023 (AI governance in government services — binding Level 3)
- `seeds/federal-decree-laws.ts` — added full disciplinary/grievance/appeal chapters of Decree-Law 49/2022 as a second entry (documentNumber: "49 of 2022 — Disciplinary Chapters")
- `seeds/case-law-federal-supreme-court.ts` — added Labour Chamber (6 principles) and Administrative/Public Law Chamber (20 principles) bringing total to 5 chambers

### New case law seed file
- `artifacts/api-server/src/kb/ingestion/seeds/case-law-federal-admin-expanded.ts`
  - 11 documents covering 60 structured principle digests across: nullification grounds, competence/jurisdiction, legitimate expectation, administrative silence, interim orders, civil service appeals, procurement disputes, proportionality, expropriation, administrative compensation, AI/digital government

### Runner registrations
- `runner.ts` — added `ADMIN_DISPUTES_LAW_SEED` at priority 3 (federal laws)
- `case-law-runner.ts` — added `CASE_LAW_FEDERAL_ADMIN_EXPANDED_SEED` at priority 7

## Key decisions
**Why:** Federal Decree-Law 21/2021 is the foundational statute for admin justice; without it the platform had no basis for analyzing administrative decision challenges. The AI governance resolution (Cabinet Resolution 17/2023) is directly relevant to the platform's AI decision pillar.

**Duplicate Decree-Law 49/2022:** Original entry has basic employment provisions; new entry ("49 of 2022 — Disciplinary Chapters") adds full disciplinary/appeal chapter. Both use `collectionId: "federal_decree_laws"` with different `documentNumber` strings so they won't be deduplicated.

**How to apply:** On next server start the ingestion runner auto-indexes all new seeds. Use `skipExisting: true` (default) to avoid re-indexing already-indexed documents.
