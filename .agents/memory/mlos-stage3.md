---
name: MLOS Stage 3 — Production Intelligence Layer
description: Stage 3 architecture decisions for streaming, 11 engines, comparative law, and Shamsi native integration in ai-assistant.tsx
---

## Stage 3 Completed Modules

### 11 Professional Role Engines (ROLE_ENGINES map)
- Stage 1+2: judge, prosecutor, legislator, legislative_committee, researcher, graduate_student, legal_author, professor
- Stage 3 additions: lawyer, admin_law_specialist, constitutional_specialist, criminal_specialist, civil_specialist
- Each engine has `reasoningSequenceAr` encoding the legal reasoning pipeline: الوقائع → المسائل القانونية → القانون الواجب التطبيق → التحليل → الحجج المضادة → الاستنتاج → التوصيات
- `buildEngineBlock()` uses `engine.nameAr` directly — never reads from USER_TYPE_CONFIG

### 4 New UserTypes (Stage 3)
- `admin_law_specialist | constitutional_specialist | criminal_specialist | civil_specialist`
- Added group `التخصصات القانونية` to USER_TYPE_GROUPS between المهن القانونية and المستخدمون العامون

### Streaming — NDJSON (backend + frontend)
- **Backend**: `POST /assistant/sessions/:id/messages` checks `Accept: application/x-ndjson`
  - Emits `{"delta":"..."}` lines in real-time via `provider.streamChunks()`
  - Post-stream phase (citation resolve, DB insert, session update, audit, final emit) is wrapped in its own try/catch with `res.end()` in finally — headers already flushed so HTTP status codes are not available after streaming starts
  - Error line format: `{"error":"..."}` ; done line: `{"done":true,"message":{...},"citations":[...]}`
- **Frontend**: `sendMessage` tries NDJSON first, falls back to non-streaming
  - `streamingMsgId` state tracks which placeholder is active
  - Reader is explicitly released via `reader.releaseLock()` in finally
  - Placeholder removed on server-emitted `{error}`, reader failure, or EOF without `{done}`
  - Partial content on EOF-without-done is left in place (user can see what arrived)
  - `StreamingCursor` component: pulsing vertical bar appended to StructuredBody plain text

### Comparative Law Mode — UAE ↔ France
- `comparativeMode: boolean` in SessionConfig + DEFAULT_SESSION_CONFIG
- `buildConfigPrefix` emits a full comparative instruction block when enabled
- Requires structured output: الموقف الإماراتي / الموقف الفرنسي / أوجه التشابه / التوجه المرجَّح / حكم القانون المقارن
- Badge shown in SessionConfigBar: `🇦🇪↔🇫🇷 مقارنة إماراتي–فرنسي`
- Toggle in PreAnalysisPanel (indigo styling to distinguish from Shamsi blue)

### Shamsi Theory — 11 Dimensions (Enhanced)
- `buildConfigPrefix` now enumerates all 11 Shamsi dimensions explicitly (numbered ١–١١)
- Concludes with: مؤشر امتثال الشامسي (نسبة مئوية مع تفسير تفصيلي لكل بُعد)
- AnswerStrengthIndicator is suppressed while `streamingCursor` is active (avoids premature scoring)

### Action Buttons / Recommended Actions
- `!isStreaming` guard added on RecommendedActionsBlock, ReliabilityBlock, ActionButtons, ShamsiTheoryCard
- These components never render on the incomplete streaming message

## Key Invariants
- `provider.streamChunks` is optional on the AI interface — always check `typeof provider.streamChunks === 'function'`
- `setMessages` functional updater inside streaming read loop is acceptable React pattern (batches via React scheduler)
- Non-streaming fallback path is unchanged from Stage 2
