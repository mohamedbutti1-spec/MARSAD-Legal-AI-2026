---
name: Shamsi replay endpoint field-strip gap
description: A tier-2 field-strip that only nulls the "named" sensitive field can still leak the same data through sibling fields sourced from the same underlying row.
---

`GET /decisions/:id/replay` nulled `alShamsiDimensions` for non-owners but the raw
Al-Shamsi principle-scoring data (identical content, different keys) still passed
through unredacted via that stage's `inputs`/`outputs`/`auditHash`/
`reasoningNarrative`/`evidenceUsed` — all sourced from the same
`decision_replay_events` row / `decision_stages.aiAnalysis` blob as the dimension
data itself.

**Why:** Field-strip defenses (three-tier pattern in `shamsi-owner-lock-pattern.md`)
are easy to apply to the one field named after the sensitive concept and miss
raw source data duplicated under generic field names (`inputs`, `outputs`,
`metadata`, etc.) on the same record.

**How to apply:** When adding or auditing a tier-2 field-strip, redact **every**
field derived from the same underlying row/blob for the locked stage/section —
not just the field with the sensitive name. Prefer redacting the whole
record/stage's generic fields (inputs/outputs/hash/narrative) to null when the
stage *is* the sensitive feature, rather than trying to enumerate every
sensitive key inside a loosely-typed JSON blob.
