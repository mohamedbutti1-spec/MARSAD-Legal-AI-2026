---
name: JDC — Judicial Deliberation Chamber
description: Architecture, correctness rules, and gotchas for the v2.0 JDC feature (multi-judge panel deliberation engine)
---

## Architecture

- **4-phase pipeline:** intake (AI) → KB retrieval (shared) → parallel judge analyses (Promise.all) → synthesis (AI)
- **Panel sizes:** 1 / 3 / 5 judges; majority thresholds are 1 / 2 / 3
- **5 judge personas** defined in `ALL_JUDGES[]` in `judicial-deliberation-chamber.ts`
- **DB table:** `jdc_chambers` (raw SQL, no Drizzle schema file) — created by `migrateJdc()` in `jdc/migration.ts`
- **Route prefix:** `/jdc/chambers` — mounted after JRE router in `routes/index.ts`
- **Migration called from:** `seed.ts` after `migrateJre()`
- **Frontend routes:** `/jdc` (list page) and `/jdc/:id` (detail page), both guarded by `canUseAi`
- **Sidebar entry:** in the `jdt` section (`titleAr: 'التحليل القانوني'`), after JRE entry

## Critical Correctness Rules

### Vote IDs are always from `determineMajority()` — never from synthesis AI
The synthesis response includes `majorityJudgeIds / dissentingJudgeIds / concurringJudgeIds` but these MUST be ignored; only the deterministic vote-math values are used in the final return. Synthesis JSON vote fields were removed from the final assembly in the correctness fix.

**Why:** AI synthesis output can hallucinate or reclassify judges inconsistently, producing legally incorrect chamber records.

### Authority hierarchy ragTags must be included in synthText for citation verification
`synthText` (the string passed to `extractCitationTokens`) must include `_hierarchyTags` from `authorityHierarchy` entries, not just the opinion/reasons text fields.

**Why:** `filterByRagTag` only strips tags already detected in `synthText`; fabricated `[SRC:N]` tags appearing only in `authorityHierarchy.ragTag` would survive undetected without this.

### Tie-break in majority determination is alphabetic by position name
When two disposal positions have equal vote counts, `sort` uses `a[0].localeCompare(b[0])` as deterministic tie-break.

**Why:** JS sort is not stable for equal values across all runtimes; without a secondary key, majority can depend on insertion order, producing non-deterministic outcomes.

## Frontend Patterns

### apiFetch does NOT accept type generics
`apiFetch` returns `Promise<Response>` — no type parameter. Correct pattern:
```typescript
apiFetch('/api/jdc/chambers')
  .then((r) => r.json())
  .then((d: { chambers: JdcChamber[] }) => d.chambers)
```
Using `apiFetch<T>` causes a TS error `Expected 0 type arguments`.

### useQuery with explicit type parameter
```typescript
const { data } = useQuery<JdcChamber[]>({
  queryKey: ['jdc-chambers'],
  queryFn: () => apiFetch(...).then(r => r.json()).then((d: { chambers: JdcChamber[] }) => d.chambers),
});
```

### Array callbacks need explicit types when deliberation is typed as unknown
When iterating over `del.judges`, `del.verificationReport.perJudge`, etc., annotate the callback parameter as `(j: JudgeAnalysis)` or the relevant type to avoid implicit `any` errors.

## Auth Pattern (Platform Standard)
`getUserId(req)` reads `x-user-id` header — same as JRE and all other v1.0 routes. This is the established platform auth mechanism, not a new bug.
