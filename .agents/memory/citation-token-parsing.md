---
name: Citation token parsing
description: How to correctly parse [DOC:N] and [SRC:N] citation tokens from AI responses
---

## Rule

Always use a capturing regex to extract citation tokens, never `split(":")`.

```typescript
// CORRECT
const pattern = /\[(DOC|SRC):(\d+)\]/g;
let match: RegExpExecArray | null;
while ((match = pattern.exec(text)) !== null) {
  const prefix = match[1];   // "DOC" or "SRC"
  const id     = parseInt(match[2], 10);
}

// BROKEN — split produces ["[DOC", "12]"]
const [prefix, idStr] = token.split(":");
// prefix === "[DOC" — not "DOC" — branch never executes
```

**Why:** The token format is `[DOC:12]`. `"[DOC:12]".split(":")` returns `["[DOC", "12]"]` — the prefix includes the opening bracket, so all `if (prefix === "DOC")` checks silently fail and documents never get citation formats.

**How to apply:** Any time AI-generated text needs to be parsed for `[TYPE:id]` tokens, use the regex pattern above. The `extractCitationTokens` helper in `artifacts/api-server/src/routes/assistant.ts` implements this correctly.
