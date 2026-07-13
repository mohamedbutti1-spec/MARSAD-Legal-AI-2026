---
name: MLOS Restructured Legal Analysis Flow
description: ai-assistant.tsx pre-analysis panel model — legal domain/branch, law source, answer format, training scenarios
---

The AI assistant's pre-analysis panel (`ai-assistant.tsx`) drives every request through explicit
selectors rather than free-form chat-mode chips: المجال القانوني (public/private/criminal) →
conditional الفرع القانوني sub-list → مصدر القانون (uae_law/french_law/egyptian_law/comparative_law)
→ question box → شكل الإجابة (urgent_brief_answer/specialized_legal_analysis) → an independent
training-scenario card (6 output types, own textarea, own state) → one submit action.

**Why:** the product spec explicitly requires every selector's value to reach the AI request (not
just be visually present), and explicitly bans legacy per-message mode chips (old
`ResponseModeSelector`/`TheoryLensSelector` rows, the 9-option `CONFIG_ANSWER_MODE_CFG` chip row,
Al-Shamsi/"other" as a law source) as "duplicate response-type controls."

**How to apply:**
- `مصدر القانون` (`LawSource`) is intentionally mapped onto the pre-existing `Jurisdiction`/
  `comparativeMode` fields (`uae_law→uae`, `french_law→france`, `egyptian_law→egypt`,
  `comparative_law→comparative+comparativeMode`) instead of introducing a parallel field — this
  reuses `buildConfigPrefix`'s existing jurisdiction-driven prompt engineering with zero backend
  risk. Keep this mapping if you touch law-source options again.
- `legalDomain`/`legalBranch`/`lawSource`/`answerFormat` live on `SessionConfig` and are rendered
  into every outgoing request via `buildGeneralRequestContent`/`buildTrainingRequestContent`
  (passed as `sendMessage`'s new `contentOverride` param) — not via the old mode-prefix switch.
  Selecting a new legal domain always clears the previously-chosen branch; criminal domain has no
  sub-list and auto-sets `legalBranch = 'criminal_law'`.
- `ResponseModeSelector`, `TheoryLensSelector`, and the old 9-chip answer-mode row still exist in
  code but are now gated behind `SHOW_LEGACY_CHAT_UI` (already `false`) — do not re-enable them
  without re-checking this spec's explicit removal list first.
- The training-scenario textbox (`trainingText`) must stay a fully separate state from the main
  question box (`input`) — never merge them, per an explicit spec requirement.
