---
name: API client codegen
description: How to regenerate @workspace/api-zod and @workspace/api-client-react after OpenAPI spec changes
---

## Command

```bash
pnpm --filter @workspace/api-spec run codegen
```

This runs orval against `lib/api-spec/openapi.yaml` and regenerates both `lib/api-zod/` and `lib/api-client-react/`, then runs `tsc --build` on the workspace libs to validate.

## When to run

- Any time `lib/api-spec/openapi.yaml` is changed (new endpoints, new/modified schemas).
- After running, check that `pnpm --filter @workspace/legal-research run typecheck` and `pnpm --filter @workspace/api-server exec tsc --noEmit` still pass.

## Key caveat

If a backend route accepts extra fields beyond the generated Zod schema (e.g. parsed ad hoc from `req.body`), update the OpenAPI spec first, then run codegen, so typed clients stay in sync.

**Why:** Skipping the spec update causes contract drift — the frontend hook won't include the new field in its type, breaking typed usage even if the backend accepts it.
