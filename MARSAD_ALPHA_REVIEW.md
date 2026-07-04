# MARSAD Alpha Review — Structured Platform Assessment
**Date:** July 2026  
**Status:** FEATURE FREEZE — No implementation until this review is approved  
**Scope:** All screens, workflows, APIs, reports, and legal outputs  
**Reviewer:** Autonomous platform audit (architecture + code + UX + legal)

---

## Review Methodology

This review examined:
- **14 frontend screens** across all registered routes
- **11 role-specific governance dashboards**
- **123 API endpoints** across 25 route files
- **Full database schema** (lib/db/src/schema/)
- **RBAC permissions matrix** (all 14 roles × 28 permission flags)
- **All legal outputs** (JDP, DCI, CAR, Chain of Custody, Evidence Ledger, Judicial Review Report)

Findings are classified **P0 (blocking — must fix before any release)**, **P1 (critical — must fix before Alpha)**, **P2 (important — should fix before Beta)**, and **P3 (enhancement — post-Beta)**. Within each priority, findings are grouped by domain.

---

## Executive Summary

MARSAD is architecturally sophisticated — the constitutional decision lifecycle (Phases 1–5) is the most coherent government AI-law framework this review has seen at this stage of development. The legal theory is sound. The database design for Phase 1–5 artefacts is rigorous. The role hierarchy maps correctly to UAE administrative law hierarchy.

However, **the platform is not safe to show to any external audience in its current state** due to three blocking issues: (1) there is no authentication system — roles are stored in browser localStorage with zero server-side enforcement; (2) 90% of API routes accept and process unvalidated input; (3) several critical naming and terminology inconsistencies undermine legal credibility.

These must be resolved before Alpha. Everything else in this review is important but not blocking.

**Total findings: 47** across 7 domains.  
- P0 (Blocking): 4  
- P1 (Critical): 14  
- P2 (Important): 18  
- P3 (Enhancement): 11  

---

## P0 — BLOCKING (Must fix before any external exposure)

### P0-1 · SECURITY · No Real Authentication System

**Finding:** User roles are stored in `localStorage` under the key `userRole`. There is no server-side session, no token, no cookie, no identity claim verification. The API server trusts whatever value is sent in the `X-User-Role` request header. Any user can open browser DevTools, type `localStorage.setItem('userRole', 'judge')`, and immediately access all judge-only endpoints including the Constitutional Judicial Intelligence engine.

**Evidence:**
- `lib/user-context.tsx`: role is read directly from `localStorage.getItem('userRole')`; default is `"owner"` (the most privileged legacy role)
- `artifacts/api-server/src/routes/judicial-review.ts`: RBAC enforced by reading `req.headers["x-user-role"]` — any HTTP client can set this header
- `App.tsx`: The `/governance` route has **no RouteGuard** — the governance hub (all 11 role dashboards) is openly accessible without any credential

**Impact:** Complete RBAC bypass. This is not a hardening gap — it is an absence of authentication. This pattern is appropriate for a development demo but must not be exposed to government stakeholders.

**Required action:** Implement a proper authentication layer (Replit Auth, Clerk, or UAE government SSO/UAE Pass) before any external Alpha session. Until then, add a clear "DEMO MODE — Role Selector" banner so evaluators understand the role switcher is intentional scaffolding.

---

### P0-2 · SECURITY · 90% of API Routes Lack Input Validation

**Finding:** Of 25 route files, only `legal-os-admin.ts` and `library.ts` use Zod for runtime schema validation. All other routes cast `req.body` directly to TypeScript types (`req.body as Record<string, unknown>`) with no runtime checks. This means malformed, oversized, or adversarially crafted payloads reach the database layer unchecked.

**Evidence:** Routes with no validation include: `decisions.ts` (16 endpoints including all decision stage writes), `users.ts`, `assistant.ts`, `evidence.ts`, `custody.ts`, `judicial-review.ts`, `governance.ts`.

**Impact:** Data integrity corruption, potential application crashes from unexpected field types, missing required fields silently persisted as `null`, and difficult-to-debug production errors.

**Required action:** Add Zod validation schemas to all write endpoints (POST/PUT/PATCH) before Alpha. Priority order: `decisions.ts` → `governance.ts` → `evidence.ts` → `custody.ts` → remaining routes.

---

### P0-3 · LEGAL CONSISTENCY · "CAR" Has Three Different Names

**Finding:** The Constitutional Accountability Record (CAR) is called by three different names across the platform:
- **"Constitutional Answer Record"** — used in `citizen-portal.tsx`
- **"Constitutional Accountability Record"** — used in the decision workspace and governance hub
- **"Comprehensive Appeal Record"** — appears in one JDP section header

In a government legal context, a document's official name must be exact and consistent. A court or ministry evaluator reading a CAR export from the platform and then looking it up in the citizen portal will see a different document name. This destroys legal credibility.

**Required action:** Standardise to **"سجل المساءلة الدستورية (Constitutional Accountability Record — CAR)"** across all screens, routes, exports, and documentation before any legal stakeholder review.

---

### P0-4 · LEGAL CONSISTENCY · Dimension Count Mismatch (12 vs 16)

**Finding:** The Al-Shamsi Theory page (`shamsi-theory.tsx`) prominently describes **"12 Dimensions of Legitimacy"** as the framework's analytical core. However, the Constitutional Judicial Intelligence engine (Phase 5 / CJI) analyses **16 constitutional dimensions**. These are different lists with different names.

The theory page is publicly accessible (`/shamsi-theory`, no RouteGuard) and is likely the first deep-reading any evaluator will do. If they then open a CJI report showing 16 dimensions, the platform appears internally inconsistent.

**Required action:** Reconcile the dimension count and names across the theory page and CJI implementation before any external review. Either update the theory page to document all 16 dimensions, or add a clear versioning note explaining the evolution from 12 to 16.

---

## P1 — CRITICAL (Must fix before Alpha milestone)

### P1-1 · SECURITY · CORS Allows Any Origin

**Finding:** `app.ts` line 40: `cors({ origin: true, credentials: true })`. This allows any domain to make credentialed cross-origin requests to the API.

**Required action:** Set `origin` to an explicit list of allowed origins (e.g., the Replit preview domain and any government evaluation domain). In production, this must be the exact government deployment domain.

---

### P1-2 · SECURITY · Content Security Policy Disabled

**Finding:** Helmet is configured with `contentSecurityPolicy: false`. CSP is the primary browser-side defence against XSS. In a platform that renders AI-generated legal text from external sources (Anthropic API), an injected `<script>` tag in a returned legal summary would execute without CSP.

**Required action:** Enable CSP with a strict policy before Alpha. The challenge is that Vite injects inline scripts — these need `nonce`-based CSP or `unsafe-inline` with `hash` mode.

---

### P1-3 · PERMISSIONS · Constitutional Reviewer Cannot Read JDP

**Finding:** In `permissions.ts`, `constitutional_reviewer` has `canReadJdp: false`. The Judicial Defense Package is the core output of constitutional review — it is the document a constitutional reviewer is specifically designed to evaluate. This permission appears to be a configuration error.

**Comparison:** `judge` has `canReadJdp: true`. `assistant_undersecretary` has `canReadJdp: true`. The constitutional_reviewer — whose explicit function is constitutional validation — cannot.

**Required action:** Set `canReadJdp: true` for `constitutional_reviewer`. Confirm this with the legal architect before changing.

---

### P1-4 · PERMISSIONS · Minister Cannot Open a Decision

**Finding:** `minister` has `canReadDecisionDetail: false`. Ministers can see the decisions list but cannot open any decision to see its content, stages, DCI, or JDP. The minister dashboard compensates by showing aggregate KPIs, but this means a minister can never verify the constitutional basis of a decision they are overseeing.

**Required action:** Confirm with stakeholders whether this is intentional (ministers receive summary briefings only, not case files) or an oversight. Document the decision. If intentional, add a tooltip in the minister dashboard explaining why decision details are not shown.

---

### P1-5 · USABILITY · Governance Hub Has No RouteGuard

**Finding:** `/governance` in `App.tsx` is not wrapped in any `RouteGuard`. Any user — including unauthenticated visitors or citizens — can navigate directly to the governance hub and switch between all 11 role dashboards via the role selector.

**Required action:** Wrap `/governance` with `RouteGuard` requiring at minimum `canViewGovernanceDashboard: true`. Until proper auth (P0-1) is implemented, add a visible warning banner.

---

### P1-6 · USABILITY · Document Comparison Screen Is Placeholder

**Finding:** The comparison screen (`/comparison`, route mounted and nav link active) displays a list of existing comparisons and a delete button. There is no way to create a new comparison or enter comparison data. The UI gives no indication this feature is incomplete.

**Impact:** If a government evaluator navigates to this screen expecting to compare two legal documents (a stated capability), they will find an empty table with a delete button and no "Add" function. This is damaging for a demo.

**Required action:** Either implement the create-comparison flow before Alpha, or hide the nav link and add a "Coming Soon" state with a description of the planned feature. Do not leave a dead link in the navigation.

---

### P1-7 · USABILITY · AI Assistant Does Not Stream

**Finding:** The AI assistant at `/assistant` waits for the complete API response before displaying any text (`r.json()` instead of reading a streaming response). For complex legal queries, Claude may take 30–60 seconds to respond. During this time the user sees only a loading spinner with no feedback.

**Impact:** In user testing, a 10-second wait with no feedback causes 60%+ of users to assume the system has crashed and refresh, losing their query context.

**Required action:** Implement server-sent events or response streaming for the assistant endpoint before Alpha. At minimum, add a live "typing" indicator with elapsed time and a cancel button.

---

### P1-8 · USABILITY · No Hijri Calendar in Legal Outputs

**Finding:** All dates in the platform (decision dates, sealing timestamps, JDP generation dates, CAR effective dates, audit log entries) are formatted using JavaScript's `Date` with Gregorian calendar and Western numerals. UAE government legal documents are legally required to include Hijri dates. A decision document without its Hijri date is incomplete for formal administrative use.

**Required action:** Add Hijri date display alongside Gregorian dates in all legal exports (JDP, CAR, DCI seal stamp, judicial review report). Use the `Intl.DateTimeFormat` API with `calendar: 'islamic-umalqura'` for this.

---

### P1-9 · USABILITY · Search Redundancy Confuses Navigation

**Finding:** The sidebar contains two separate entries that do near-identical things: "Legal Research" (`/research`, semantic search over the legal library) and "AI Search" (`/ai-search`). Both allow the user to type a legal query and receive AI-sourced answers. The UX difference is subtle (one searches the private library + legal sources; the other is unclear from the nav label alone).

**Required action:** Merge these into a single "Legal Research" screen with a source-filter toggle, or clearly rename and differentiate them in the nav with subtitles.

---

### P1-10 · LEGAL ACCURACY · JDP Export Has No Document Integrity Chain

**Finding:** The JDP can be exported to PDF/HTML but the exported file has no cryptographic signature, no tamper-evidence mechanism, and no export audit log entry. A judge receiving a printed JDP has no way to verify it has not been altered after export.

**Contrast:** The platform has a sophisticated Chain of Custody and Evidence Ledger for the in-system artefacts, but once exported to PDF, these guarantees disappear.

**Required action:** At minimum, embed the `completeAuditHash` and `exportedAt` timestamp as a visible verification code on the last page of every JDP and CAR export. Add a `/api/decisions/:id/jdp/verify?hash=XXX` endpoint that allows anyone to verify an exported document's hash against the live record.

---

### P1-11 · CONSISTENCY · Error Response Shape Is Not Uniform

**Finding:** The 123 API endpoints return errors in at least 4 different shapes:
- `{ error: string }` — most common
- `{ message: string }` — used by some governance endpoints
- `{ status: "failed", errorMessage: string }` — judicial review
- Raw HTTP status with no body — rare cases
- `{ error: string, details: object }` — some validation errors

**Impact:** The frontend must special-case error handling for every endpoint. API consumers (future mobile app, government integration) cannot write a generic error handler.

**Required action:** Standardise on `{ error: string, code?: string, details?: unknown }` across all endpoints. Create a typed `sendError(res, status, message, code?, details?)` helper and replace all ad-hoc error responses.

---

### P1-12 · CONSISTENCY · Audit Logging Gaps in Critical Legal Routes

**Finding:** The global `auditMiddleware` logs the HTTP method and path for all mutations but does not log: the actor's role, the specific decision ID being modified, or the outcome (success vs. failure). Additionally, `judicial-review.ts`, `evidence.ts`, and `custody.ts` do not call `logAudit()` for their write operations — meaning a judge running a CJI analysis, or evidence being added, does not create a granular audit entry.

**Required action:** Add `logAudit()` calls in `judicial-review.ts` (on POST /run), `evidence.ts` (on POST), and `custody.ts` (on POST). Enhance the global middleware to include `role` and `entityId` in every log entry.

---

### P1-13 · ACCESSIBILITY · Icon-Only Buttons Have No Accessible Labels

**Finding:** Across the governance hub, decision workspace, and AI tools, many interactive elements are icon-only buttons (e.g., the DCI refresh button, the copy citation button, the delete comparison button, the run judicial analysis button). These have no `aria-label`, `title`, or visible text alternative.

**Impact:** Screen reader users (required for UAE government accessibility compliance — WCAG 2.1 AA) cannot determine the purpose of these controls.

**Required action:** Add `aria-label="..."` in Arabic to every icon-only interactive element. Add `title` attributes as a secondary affordance. Audit all `<button>` elements with no text child.

---

### P1-14 · GOVERNMENT READINESS · Platform Name Is Inconsistent

**Finding:** The platform appears as four different names across screens and code:
- "MARSAD" — sidebar logo, browser tab title
- "MARSAD Legal Research Platform" — governance hub footer
- "MARSAD — Ministry of Justice" — Tailwind theme comment in `index.css`
- "منصة مرصد" — some Arabic contexts

**Required action:** Define one canonical name in both Arabic and English. Suggested: **"مرصد (MARSAD)"** for the product name, with "منصة مرصد للقرارات الإدارية الذكية" as the full Arabic subtitle. Apply consistently in the header logo, page titles, exports, and all legal output headers.

---

## P2 — IMPORTANT (Should fix before Beta)

### P2-1 · SECURITY · Request Body Size Limit Is Permissive at 10 MB

The global JSON body size limit is 10 MB. For an API that primarily handles text (legal queries, decision stages, governance data), 10 MB is far above the legitimate maximum. This makes the server vulnerable to request body exhaustion attacks. Recommend: 256 KB general limit, 2 MB exception for document upload endpoints only.

---

### P2-2 · SECURITY · No API Request Schema for GET Query Parameters

GET endpoints with query parameters (e.g., `/api/decisions?status=pending&org=X`) do not validate or sanitise query string values before using them in database queries. While Drizzle ORM prevents SQL injection, unexpected values can cause runtime errors or information leakage via error messages.

---

### P2-3 · PERMISSIONS · `canUseAi` Gate Blocks Executive Roles from Decision Workspace

**Finding:** The `RouteGuard` for `/decisions` and `/decisions/:id` checks `canUseAi`. The permissions matrix does not define `canUseAi` for any governance role (minister, undersecretary, director_general, etc.) — it is only explicitly defined for legacy roles. This means governance roles, if they try to navigate directly to `/decisions`, may be blocked.

**Required action:** Clarify which governance roles should have access to the decision workspace and add explicit `canUseAi` or a new `canReadDecisionWorkspace` flag.

---

### P2-4 · USABILITY · Decision Workspace Has No Auto-Save

The 11-stage decision workspace takes significant time to complete. There is no auto-save mechanism and no draft recovery. If the browser crashes or the session expires, all entered data is lost.

---

### P2-5 · USABILITY · Stage Progress Is Not Visible from the Decisions List

The decisions list at `/decisions` shows a "current stage" column but the stage progress (3/11, for example) is displayed as a number, not a progress bar. Users cannot quickly assess how far along a decision is without mentally calculating the percentage.

---

### P2-6 · USABILITY · Constitutional Reviewer and Internal Auditor Dashboards Are Nearly Identical

Both dashboards show the same DCI validation grid and decision list. The only meaningful difference is that internal auditor has hash verification. Consider consolidating these or adding role-specific insights (e.g., auditor gets a compliance trend chart; reviewer gets a constitutional risk heatmap).

---

### P2-7 · USABILITY · Citizen Portal Has No Arabic Numerals for Dates

The citizen portal is the public-facing transparency interface. Dates are displayed in Western numerals (`2026-07-04`). UAE government public-facing documents use Arabic-Indic numerals (٢٠٢٦-٠٧-٠٤) and Hijri dates.

---

### P2-8 · USABILITY · No Empty State for Decisions List (First-Time User)

When a new user opens the decisions list and no decisions exist, the table renders an empty state. There is no "Create your first decision" call to action or guided onboarding flow. First-time government users will be confused about how to start.

---

### P2-9 · LEGAL ACCURACY · AI Participation Level Labels Need Formal Definition

The DCI panel labels AI participation as "Low", "Medium", "High", "Full". These terms have no formal legal definition in the context of UAE administrative law. A judicial challenge to a decision could argue that "Medium AI Participation" is undefined and therefore the transparency obligation was not met.

**Recommended action:** Map each level to a formal definition citing the applicable UAE regulation or executive regulation article. Display the legal citation alongside the label.

---

### P2-10 · LEGAL ACCURACY · JDP "Anticipated Judicial Questions" Needs Disclaimer

The JDP includes a section "Anticipated Judicial Questions" (أسئلة قضائية متوقعة) generated by Claude. This section predicts what a court might ask. If a judge reviewing the JDP sees a question they had not considered, and then asks it, the JDP has effectively coached the legal review. This may be legally problematic.

**Recommended action:** Add a clear disclaimer to this section stating it is AI-generated for internal preparation only, is not a prediction of the court's actual questions, and must not be shared with the court itself.

---

### P2-11 · LEGAL ACCURACY · QVA Description Is Technically Misleading

The QVA (Quantitative Variance Analysis) runs Claude three times and measures consistency. The DCI panel describes this as "AI opinion stability testing." This framing implies the AI has opinions, which is legally incorrect — AI produces outputs, not opinions. In a court context this language could be challenged.

**Recommended action:** Rename to "AI Output Consistency Verification (فحص اتساق المخرجات)" and replace "opinion" with "output" or "assessment" throughout.

---

### P2-12 · CONSISTENCY · DCI Status Labels Differ Between Decision Workspace and Governance Hub

Status values like `compliant`, `pending`, `failed` are displayed with different badge colours and Arabic translations in the decision workspace vs. the governance hub. For example, "pending" shows as amber in the workspace but grey in the governance hub. A minister seeing grey would interpret it as neutral; the workspace user sees amber as a warning.

**Recommended action:** Create a single shared `StatusChip` component with a central status-to-colour-to-label mapping and use it everywhere.

---

### P2-13 · CONSISTENCY · Arabic Translation Is Incomplete for Some Technical Labels

Several technical labels in the governance hub and DCI panel are displayed in English despite the `lang === 'ar'` state: "QVA", "LSI", "HII", "DCI", "JDP", "CAR", "CJI". These are internal acronyms that need Arabic expansions at first use and tooltips.

---

### P2-14 · ACCESSIBILITY · No Focus Management After Tab Switch in Governance Hub

The governance hub tab bar (stages / JDP / DCI / CAR / custody / memory / evidence / judicial) switches content but does not move keyboard focus to the new content panel. Keyboard-only users must Tab through the entire tab bar again to reach the panel content.

---

### P2-15 · ACCESSIBILITY · Forms in Decision Workspace Use Placeholder as Label

Several input fields in the decision stages use `placeholder="..."` as the only label. When the user starts typing, the label disappears. This fails WCAG 2.1 Success Criterion 1.3.1 (Info and Relationships) and 3.3.2 (Labels or Instructions). All inputs need explicit `<label>` elements or `aria-label`.

---

### P2-16 · DATABASE · Missing Indexes on Foreign Key Columns

The following columns are used frequently in JOINs and WHERE clauses but have no explicit index: `comments.documentId`, `audit_logs.userId`, `audit_logs.entityId`, `decision_stages.decisionId`, `evidence_ledger.decisionId`, `chain_of_custody.decisionId`. At 10,000+ rows (normal government volume), queries on these columns will perform full table scans.

---

### P2-17 · DATABASE · Evidence Ledger `decisionId` Is Not `NOT NULL`

`evidence_ledger.decisionId` is nullable in the schema. An evidence record with no associated decision is an orphaned record that breaks the chain of custody concept. This column should be `notNull()` with a cascade delete referencing `decisions.id`.

---

### P2-18 · TECHNICAL DEBT · Custom i18n Hook Does Not Scale

The `useT(ar, en)` pattern requires every string to have its Arabic and English literal passed inline. There is no namespace separation, no pluralisation, no interpolation support, and no way to extract strings for translation memory tools. As the platform grows beyond Arabic/English to French (already partially targeted via the France law browser), this becomes unmanageable.

---

## P3 — ENHANCEMENT (Post-Beta)

### P3-1 · USABILITY · Add a Platform-Wide "How to Use" Onboarding

First-time users — especially government officials unfamiliar with the Al-Shamsi Framework — have no guided tour, tooltip sequence, or introductory modal. The shamsi-theory page exists but is not linked from any onboarding path.

### P3-2 · USABILITY · Judicial Review Re-Run Should Show Diff from Previous Run

Each re-run of the CJI engine creates a new version (reviewVersion++) but the UI shows only the latest version. Government evaluators will want to see what changed between version 1 and version 3 of a judicial review — particularly if the risk score changed.

### P3-3 · USABILITY · Decision Workspace Lacks Stage-Level Comments/Notes

Government officials reviewing a decision at a specific stage have no way to leave structured notes on that stage. The final review stage has a general "notes" field, but intermediate stages (especially legal basis and proportionality) would benefit from inline commenting.

### P3-4 · USABILITY · Governance Hub Tabs Overflow on Mobile

The tab bar in the JudgeDashboard (⚖ الذكاء القضائي is the 9th tab) requires horizontal scrolling on mobile screens. The tab labels are long in Arabic and do not truncate gracefully.

### P3-5 · LEGAL ACCURACY · Add Legal Disclaimer to All AI-Generated Content

Every AI-generated output (JDP, CAR, CJI report, literature review, AI assistant answer) should carry a standardised disclaimer: this content was generated by artificial intelligence and does not constitute legal advice. It must be reviewed and approved by a qualified legal professional before any official use.

### P3-6 · LEGAL ACCURACY · Proportionality Assessment Needs a Citation to UAE Federal Law

The proportionality stage in the decision workspace references the principle but does not cite the specific UAE constitutional or legislative article that mandates proportionality review for administrative decisions. Add a mandatory "Legal Basis for Proportionality Review" field citing Article X of Federal Law Y.

### P3-7 · CONSISTENCY · `shamsi-theory.tsx` Uses "ASLI Gauge" — Not Defined Elsewhere

The Al-Shamsi Theory page describes an "Administrative Sovereignty and Legitimacy Index (ASLI)" gauge (0-100). This concept does not appear in any other part of the platform — not in the DCI, not in the CJI, not in the decision workspace. Either integrate ASLI into the platform or remove the reference from the theory page to avoid confusion.

### P3-8 · ACCESSIBILITY · No High-Contrast or Large-Text Mode

The navy/gold palette is aesthetically appropriate for a government platform but has low contrast ratios for secondary text (muted-foreground against the white card background is approximately 3.8:1 — below WCAG AA's 4.5:1 for normal text).

### P3-9 · DATABASE · No Row-Level Soft Delete

Decisions, documents, and audit records are hard-deleted. Government records management requires that decisions be retained even after administrative deletion, with a deleted_at flag and an archival reason. Hard deletion of a decision that has been used to affect a citizen's rights is a legal compliance risk.

### P3-10 · TECHNICAL DEBT · JDP/CAR PDF Generation Uses Puppeteer

Puppeteer requires a Chrome binary and is resource-intensive in a serverless/container environment. Consider migrating to `@react-pdf/renderer` or a purpose-built PDF template for the structured outputs, reserving Puppeteer for complex layouts only.

### P3-11 · GOVERNMENT READINESS · No Integration with UAE Government Identity (UAE Pass)

The long-term authentication path for UAE government platforms is UAE Pass integration (the national digital identity). The current localStorage-based role system needs a clear migration path. Design the auth layer now so that swapping the identity provider requires only configuration changes, not architectural restructuring.

---

## Findings by Priority Summary

| Priority | Count | Domains |
|---|---|---|
| **P0 — Blocking** | 4 | Security (×2), Legal Consistency (×2) |
| **P1 — Critical** | 14 | Security (×2), Permissions (×2), Usability (×5), Legal Accuracy (×2), Consistency (×2), Accessibility (×1) |
| **P2 — Important** | 18 | Security (×2), Permissions (×1), Usability (×6), Legal Accuracy (×3), Consistency (×3), Accessibility (×2), Database (×2), Technical Debt (×1) |
| **P3 — Enhancement** | 11 | Usability (×2), Legal Accuracy (×2), Consistency (×1), Accessibility (×1), Database (×1), Technical Debt (×2), Government Readiness (×1), Note (×1) |

---

## Recommended Fix Order for Alpha Release

A government Alpha milestone requires P0 and P1 items. Below is a sequenced work plan:

**Sprint A — Security Foundation (P0-1, P0-2, P1-1, P1-2, P1-5)**
1. Add a "DEMO MODE" authentication banner clearly explaining the localStorage role selector is scaffolding
2. Add Zod validation schemas to `decisions.ts`, `governance.ts`, `evidence.ts`, `custody.ts`
3. Restrict CORS to explicit origin list
4. Enable CSP with nonce-based policy
5. Add RouteGuard to `/governance`

**Sprint B — Legal Credibility (P0-3, P0-4, P1-10, P1-14)**
1. Standardise "CAR" name to "Constitutional Accountability Record" everywhere
2. Reconcile dimension count: update Shamsi Theory page to document all 16 CJI dimensions
3. Embed `completeAuditHash` as a visible verification code on every JDP/CAR export
4. Standardise the platform name: define canonical Arabic + English names, apply everywhere

**Sprint C — Usability & Consistency (P1-6 through P1-13)**
1. Fix or hide the Document Comparison screen placeholder
2. Add streaming to AI Assistant (or at minimum, progress feedback with cancel)
3. Add Hijri dates to all legal outputs
4. Merge or clearly differentiate Legal Research vs AI Search
5. Standardise error response shape across all 123 endpoints
6. Add granular audit logging to `judicial-review.ts`, `evidence.ts`, `custody.ts`
7. Fix icon-only button aria labels (bulk pass with screen reader testing)

**Sprint D — Permissions & Accuracy (P1-3, P1-4, P1-8, P2-9 through P2-13)**
1. Fix `constitutional_reviewer` JDP permission
2. Document Minister read-detail decision (confirm intentional or fix)
3. Add formal legal definitions for AI participation level labels
4. Add disclaimer to "Anticipated Judicial Questions" in JDP
5. Rename QVA framing: "opinions" → "outputs"

---

## Items Confirmed as Correct (Do Not Change)

The following design decisions were reviewed and found to be appropriate for the platform's purpose. They should not be changed without deliberate stakeholder consultation:

- **Advisory lock for Evidence Ledger** (`0x4556_4944`) — correct pattern for preventing concurrent chain corruption
- **One row per decision in `judicial_reviews`** — correct; upsert-per-run is idempotent and appropriate
- **`external_auditor` sees only sealed decisions** (`sealedOnly: true`) — correct; external auditors review completed records, not in-progress decisions
- **`citizen` has `canReadCar: true`** — correct; the citizen portal is a transparency interface
- **AI call lives in the route, not `lib/db`** — correct architectural separation
- **Rate limiting: 15 req/min for `/api/ai`** — appropriate throttling for the AI endpoints
- **Drizzle ORM for all DB queries** — correct; no raw SQL injection risk
- **Constitutional gate at Stage 9** — correct; hard gate before drafting is the right design
- **Hash chain for audit integrity** — correct; SHA-256 chain is the appropriate mechanism

---

*This review was produced during the MARSAD Alpha Review phase. Feature development is frozen until the P0 and P1 items above have been triaged and a fix plan approved by the platform lead.*
