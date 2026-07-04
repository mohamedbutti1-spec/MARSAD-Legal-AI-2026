# MARSAD Alpha 1.0 — Architecture Specification

**Platform:** مرصد (MARSAD) — منصة القرارات الإدارية الذكية  
**Framework:** Al-Shamsi Constitutional Decision Framework™  
**Version:** Alpha 1.0  
**Build Date:** 2026-07-04  
**Status:** Architecture Freeze — Feature development locked

---

## 1. Executive Overview

MARSAD is a UAE-government-grade Arabic-first platform that operationalises the Al-Shamsi Framework™ for constitutional administrative decision-making. It guides civil servants through a 13-stage constitutional lifecycle, produces court-ready artefacts (DCI, JDP, CAR), maintains a cryptographically verified audit chain, and applies a 16-dimension AI constitutional review (Phase 5 — CJI).

---

## 2. Module Inventory (Phases 1–5)

| Phase | Name | Status | Key Screens |
|-------|------|--------|-------------|
| Phase 1 | Intelligent Administrative Decision Lifecycle | ✅ Complete | Decision Workspace, Decisions List |
| Phase 2 | Executive Governance Layer | ✅ Complete | Governance Hub, Citizen Portal |
| Phase 3 | Chain of Custody + Constitutional Memory | ✅ Complete | Embedded in Decision Workspace |
| Phase 4 | Evidence Ledger | ✅ Complete | Evidence tab in Decision Workspace |
| Phase 5 | Constitutional Judicial Intelligence (CJI) | ✅ Complete | Judge Dashboard → Judicial Intelligence tab |

**Frozen scope:** 10 modules total. No new modules. All future work must strengthen the Intelligent Administrative Decision lifecycle.

---

## 3. Repository Structure

```
/ (pnpm monorepo)
├── lib/
│   └── db/                      # @workspace/db — shared Drizzle ORM + services
│       ├── src/schema/          # All PostgreSQL table definitions
│       ├── src/judicial-review-service.ts
│       ├── src/constitutional-memory-service.ts
│       ├── src/custody-service.ts
│       ├── src/evidence-service.ts
│       └── drizzle/migrations/  # Auto-generated Drizzle migrations
├── artifacts/
│   ├── api-server/              # @workspace/api-server — Express API
│   │   ├── src/app.ts           # Helmet, CORS, Compression, Pino
│   │   ├── src/routes/          # 25 route files, ~130 endpoints
│   │   ├── src/middlewares/     # roleAuth, auditLog
│   │   ├── src/lib/sendError.ts # Standardised error response helper (Alpha 1.0)
│   │   └── src/ai/              # AI provider abstraction (Anthropic Claude)
│   └── legal-research/          # @workspace/legal-research — React + Vite frontend
│       ├── src/pages/           # All page components
│       ├── src/components/      # Layout, UI primitives
│       └── src/lib/             # permissions, api-client, user-context
└── .local/                      # Agent skills and memory
```

---

## 4. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20+ |
| Package manager | pnpm (workspace) | 9+ |
| API framework | Express | 4.x |
| ORM | Drizzle ORM | 0.39+ |
| Database | PostgreSQL (Replit managed) | 16 |
| AI | Anthropic Claude (claude-sonnet-4-6) | @anthropic-ai/sdk 0.109.1 |
| Frontend | React + Vite | React 19, Vite 6 |
| Styling | Tailwind CSS v4 | 4.x |
| Animation | Framer Motion | 11+ |
| HTTP security | Helmet | 8.x |
| Validation | Zod | 3.x |
| Logging | Pino | 9.x |

---

## 5. Database Schema Map

All tables live in the Replit-managed PostgreSQL database.  
Migrations managed by Drizzle Kit — apply with `pnpm --filter @workspace/db run db:migrate`.

### 5.1 Core Decision Tables (Phase 1)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `decisions` | Master decision record | `id`, `case_number`, `title_ar`, `jurisdiction`, `decision_type`, `status`, `current_stage`, `stages_completed`, `created_by` |
| `decision_stages` | Per-stage JSON data + audit hash | `decision_id`, `stage_key`, `stage_number`, `stage_data` (JSONB), `validation_status`, `audit_hash`, `completed_at` |
| `decision_dci` | Decision Constitutional Identity | `decision_id`, `ai_participation_level`, `human_oversight_level`, `legality_status`, `al_shamsi_framework_compliance`, `human_influence_index`, `ai_actual_influence`, `is_sealed`, `seal_hash`, `current_version` |
| `decision_jdp` | Judicial Defense Package | `decision_id`, `status`, `proportionality_analysis` (JSONB), `ai_participation_explanation` (JSONB), `constitutional_validation_results` (JSONB) |
| `decision_car` | Constitutional Accountability Record (سجل المساءلة الدستورية) | `decision_id`, `status`, `facts_relied_upon`, `legal_basis_summary`, `reasons_for_decision`, `ai_role_summary` |

### 5.2 Constitutional Memory (Phase 3)

| Table | Purpose |
|-------|---------|
| `constitutional_memory` | One row per decision — version-aware constitutional record with `complete_audit_hash` (SHA-256 chain), `version_history` (JSONB) |
| `constitutional_memory_events` | Immutable append-only event log per decision — `event_type`, `actor_id`, `actor_role`, `payload` (JSONB) |
| `chain_of_custody` | Immutable custody chain — `action`, `previous_value`, `new_value`, `chain_hash` (SHA-256), `sequence_number` |

### 5.3 Evidence Ledger (Phase 4)

| Table | Purpose |
|-------|---------|
| `evidence_events` | Append-only evidence ledger — `action`, `event_category`, `actor`, `actor_role`, `evidence_summary_ar`, `affected_object`, `chain_hash`, `prev_current_hash`, `sequence_number` |

### 5.4 Judicial Intelligence (Phase 5 — CJI)

| Table | Purpose |
|-------|---------|
| `judicial_reviews` | One row per decision (upsert) — `status`, `review_version`, `constitutional_risk_score`, `risk_level`, `dimensions` (JSONB — 16), `detected_defects` (JSONB), `outcome_prediction` (JSONB), `remedy_recommendation` (JSONB), `triggered_by` |

### 5.5 Supporting Tables

| Table | Purpose |
|-------|---------|
| `audit_logs` | Platform-wide audit log — all mutating actions |
| `users` | User accounts (placeholder — no real auth in Alpha 1.0) |
| `settings` | Per-org platform configuration |
| `documents` | Uploaded legal documents |
| `legal_sources` | Legal source library (legislation + case law) |
| `chat_sessions` / `chat_messages` | AI assistant conversations |
| `comparisons` | Document comparison records (placeholder — UI incomplete) |
| `citations_log` | Citation generation history |
| `comments` | Annotation comments on decisions |
| `personal_library` | User-saved documents |
| `backup_records` | Platform backup metadata |
| `admin_decision_types` | Decision type definitions (LegalOS) |
| `admin_decision_roles` | Role templates for admin decisions |
| `admin_decision_sessions` | AI-OS interview sessions |
| `admin_decision_briefs` | Generated decision briefs |
| `admin_jurisdictions` | Jurisdiction registry |

---

## 6. API Map (130 Endpoints)

All endpoints served under `/api/` prefix. Auth is via request headers (demo scaffolding):  
`x-user-role`, `x-user-id`, `x-user-org`.

### 6.1 Health
```
GET  /healthz
```

### 6.2 Module 1 — Decisions (16 endpoints)
```
GET  /decisions                                    — list (owner sees all, others see own)
POST /decisions                                    — create [Zod validated]
GET  /decisions/:id                                — get with all stages
PUT  /decisions/:id/stages/:stageKey               — save stage data (draft)
GET  /decisions/:id/audit                          — full audit trail
POST /decisions/:id/stages/:stageKey/ai-assist     — AI assistance for stage
POST /decisions/:id/stages/:stageKey/validate      — supervisor validation
POST /decisions/:id/stages/:stageKey/complete      — complete stage [constitutional gate at 9]
GET  /decisions/:id/dci                            — get DCI
POST /decisions/:id/dci/amend                      — DCI amendment (sealed-document amendment pattern)
POST /decisions/:id/jdp/generate                   — generate Judicial Defense Package
GET  /decisions/:id/jdp                            — get JDP
GET  /decisions/:id/jdp/export                     — JDP export bundle
POST /decisions/:id/qva/run                        — run Quantitative Validity Assessment
POST /decisions/:id/car/generate                   — generate CAR
GET  /decisions/:id/car                            — get CAR
```

### 6.3 Phase 2 — Governance (7 endpoints)
```
GET  /governance/dashboard                         — executive dashboard stats
GET  /governance/decisions                         — all decisions (governance view)
GET  /governance/citizen/car                       — citizen CAR lookup (by case number)
GET  /governance/...                               — 4 additional governance views
POST /governance/...                               — 2 governance write operations
```

### 6.4 Phase 3 — Custody (6 endpoints)
```
GET  /custody/:decisionId                          — full chain
GET  /custody/:decisionId/verify                   — cryptographic integrity audit
GET  /custody/:decisionId/export                   — export bundle
GET  /custody/:decisionId/stats                    — summary statistics
POST /custody/test/tamper-detect                   — penetration test (dev only)
POST /custody/test/replay                          — replay verification (dev only)
```

### 6.5 Phase 3 — Constitutional Memory (4 endpoints)
```
GET  /memory/:decisionId
GET  /memory/:decisionId/events
POST /memory/:decisionId/archive
POST /memory/:decisionId/restore
```

### 6.6 Phase 4 — Evidence Ledger (3 endpoints)
```
GET  /evidence/:decisionId                         — full evidence chain
GET  /evidence/:decisionId/verify                  — integrity verification
GET  /evidence/:decisionId/export                  — court-ready judicial evidence package
```

### 6.7 Phase 5 — Constitutional Judicial Intelligence (3 endpoints)
```
GET  /judicial-review/:decisionId                  — latest review (judge only)
POST /judicial-review/:decisionId/run              — trigger AI constitutional review (judge only)
GET  /judicial-review/:decisionId/report           — court-ready judicial intelligence report (judge only)
```

### 6.8 AI & Research (6 endpoints)
```
POST /ai/search
POST /ai/literature-review
POST /ai/uae-france-compare
POST /assistant/sessions
POST /assistant/sessions/:id/messages
POST /assistant/cite
```

### 6.9 Supporting Services (25+ endpoints)
```
/documents, /citations, /comparisons, /comments
/legal-sources, /library, /export, /backup
/users, /settings, /audit, /dashboard/stats
/legal-os, /admin-os, /legal-os-admin
```

---

## 7. Decision Lifecycle (13-Stage Constitutional Flow)

```
Stage 1  administrative_request      → مرحلة الطلب الإداري
Stage 2  legal_basis                 → الأساس القانوني
Stage 3  facts_circumstances         → الوقائع والملابسات
Stage 4  affected_parties            → الأطراف المتأثرة
Stage 5  proportionality             → مبدأ التناسب
Stage 6  alternatives_considered     → البدائل المدروسة
Stage 7  ai_analysis                 → تحليل الذكاء الاصطناعي
Stage 8  human_review                → المراجعة البشرية
Stage 9  constitutional_gate         → ⛩ البوابة الدستورية [HARD GATE — blocks if ASLI < threshold]
Stage 10 decision_issuance           → إصدار القرار
Stage 11 notification_publication    → الإخطار والنشر
Stage 12 implementation_monitoring   → التنفيذ والرقابة
Stage 13 archiving                   → الأرشفة النهائية
```

**Constitutional Artefacts** are generated at specific stages:
- **DCI** (Decision Constitutional Identity) — auto-created at Stage 1, sealed at Stage 10
- **QVA** (Quantitative Validity Assessment) — run at Stage 8+
- **JDP** (Judicial Defense Package) — generated at Stage 9+
- **CAR** (Constitutional Accountability Record) — generated at Stage 10+

---

## 8. Security Model (Alpha 1.0)

### 8.1 Authentication
**⚠️ ALPHA LIMITATION:** Authentication in Alpha 1.0 uses request header scaffolding (`x-user-role`, `x-user-id`, `x-user-org`). Role is selected via localStorage in the frontend demo UI.

**Production Requirement (Pre-Beta):**  
- UAE Pass integration (OpenID Connect) for government staff  
- Enterprise SSO (SAML 2.0 / Azure AD) for institutional deployment  
- Session management with signed JWT or server-side session store

### 8.2 CORS Policy (Alpha 1.0)
Restricted to Replit preview domains (`*.replit.dev`, `*.repl.co`, `*.kirk.replit.dev`) and localhost. Set `ALLOWED_ORIGIN` environment variable to lock to a specific production domain.

### 8.3 Security Headers (Helmet)
- CSP: `default-src 'none'` on API responses; frontend has `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `X-DNS-Prefetch-Control: off`

### 8.4 Input Validation
- **Decisions create endpoint**: Zod schema validation (Alpha 1.0)
- **LegalOS admin endpoints**: Zod validation (pre-existing)
- **All other write endpoints**: runtime validation via conditional checks (upgrade to Zod in Beta)

### 8.5 Cryptographic Integrity
- **Evidence Ledger**: SHA-256 chain hash — each event hashes its own data + previous event's hash. Advisory lock `0x4556_4944` prevents concurrent writes.
- **Chain of Custody**: SHA-256 chain hash — same tamper-detection pattern; `prevChainHash` + `chainHash` verified on each record
- **DCI Seal**: SHA-256 of the complete DCI JSON at time of sealing; stored in `seal_hash`
- **Constitutional Memory**: `complete_audit_hash` (SHA-256) chains all memory events into a verifiable audit record

---

## 9. Permissions Matrix (Full)

| Permission | owner | supervisor | decision_maker | reviewer | legal_advisor | judge | constitutional_reviewer | external_auditor | citizen | minister | viewer |
|-----------|:-----:|:----------:|:--------------:|:--------:|:-------------:|:-----:|:-----------------------:|:----------------:|:-------:|:--------:|:------:|
| canCreateDecision | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| canReadDecisionList | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| canReadDecisionDetail | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| canReadStageData | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| canEditStageData | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| canValidateStages | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| canReadAiAnalysis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| canReadJdp | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| canReadDci | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| canReadCar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅† | ❌ | ❌ |
| canRunHashVerification | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| canReadAuditLog | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| canViewGovernanceDashboard | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| canViewJdp | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| canManageUsers | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| canManageSettings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| canUpload | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| canUseAi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| canUseJudicialIntelligence | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

† Citizens can access CAR only via the Citizen Portal (`/citizen`) with a sealed case number — `external_auditor` sees only `sealedOnly: true` records.

---

## 10. Al-Shamsi Framework — 16-Dimension Map (CJI)

The Constitutional Judicial Intelligence engine assesses all 16 dimensions simultaneously:

**Original 12 Dimensions (Al-Shamsi Theory v1):**

| # | Dimension Key | Arabic | Concept |
|---|--------------|--------|---------|
| 1 | `jurisdiction` | الاختصاص | Competence & authority |
| 2 | `cause` | السبب | Factual & legal cause |
| 3 | `form` | الشكل | Formal requirements |
| 4 | `procedure` | الإجراءات | Procedural compliance |
| 5 | `subject` | المحل | Subject matter legality |
| 6 | `purpose` | الغاية | Legitimate purpose |
| 7 | `digital_legitimacy` | المشروعية الرقمية | Digital compliance |
| 8 | `legal_effect` | الأثر القانوني | Proportionate legal effect |
| 9 | `administrative_will` | الإرادة الإدارية | Human will in decision-making |
| 10 | `legal_protection` | الحماية القانونية | Rights protection guarantees |
| 11 | `judicial_review` | الرقابة القضائية | Judicial reviewability |
| 12 | `legislative_compliance` | الامتثال التشريعي | Legislative alignment |

**4 CJI Extension Dimensions (Phase 5 — Alpha 1.0):**

| # | Dimension Key | Arabic | Concept |
|---|--------------|--------|---------|
| 13 | `algorithmic_bias` | التحيز الخوارزمي | Algorithmic bias detection |
| 14 | `due_process` | الإجراءات القانونية الواجبة | Due process protections |
| 15 | `equality` | المساواة | Equal treatment principle |
| 16 | `fundamental_rights` | الحقوق الأساسية | Fundamental rights compliance |

---

## 11. Event Flow — Decision Lifecycle

```
[POST /decisions]
    │
    ├─→ INSERT decisions (status: in_progress)
    ├─→ INSERT decision_dci (all fields: pending)
    ├─→ recordCustodyEvent(decision.created)         ← Phase 3
    ├─→ createOrUpdateMemory(decisionStatus: draft)  ← Phase 3
    └─→ recordEvidenceEvent(decision.created)        ← Phase 4

[PUT /decisions/:id/stages/:stageKey]
    └─→ UPSERT decision_stages (validationStatus: pending)

[POST /decisions/:id/stages/:stageKey/validate]
    ├─→ AI validates stage data (Claude)
    ├─→ UPDATE decision_stages (validationStatus: passed/failed, auditHash: SHA-256)
    └─→ recordCustodyEvent(stage.validated)

[POST /decisions/:id/stages/:stageKey/complete]
    ├─→ CONSTITUTIONAL GATE at Stage 9: if HII + ASLI < threshold → BLOCKED
    ├─→ UPDATE decisions (stagesCompleted: [...], currentStage: next)
    ├─→ UPDATE decision_dci (relevant fields per stage)
    ├─→ recordCustodyEvent(stage.completed)
    └─→ recordEvidenceEvent(stage.completed)

[POST /decisions/:id/qva/run]
    ├─→ AI runs 3 parallel QVA validity probes (Claude)
    └─→ UPDATE decision_dci (qvaResults, qvaVarianceLevel, lsiStatus)

[POST /decisions/:id/jdp/generate]
    ├─→ AI generates 5 JDP sections (Claude)
    └─→ UPSERT decision_jdp (status: ready)

[POST /decisions/:id/car/generate]
    ├─→ AI generates CAR (Claude)
    └─→ UPSERT decision_car (status: ready)

[POST /judicial-review/:id/run]       ← Judge only
    ├─→ UPSERT judicial_reviews (status: running)
    ├─→ collectDecisionData (20k char budget, trimDecisionData)
    ├─→ Claude constitutional review (16 dimensions, max_tokens: 8192)
    ├─→ UPSERT judicial_reviews (status: completed, all fields)
    └─→ logAudit(judicial_review.run)
```

---

## 12. Frontend Architecture

**Stack:** React 19 + Vite 6 + Tailwind CSS v4 + Wouter (routing) + TanStack Query

### 12.1 Page Map

| Path | Component | Guard | Notes |
|------|-----------|-------|-------|
| `/` | Dashboard | None | Welcome + stats |
| `/decisions` | Decisions | canUseAi | Decision list |
| `/decisions/new` | DecisionWorkspace | canUseAi | Full 13-stage workspace |
| `/decisions/:id` | DecisionWorkspace | canUseAi | |
| `/governance` | GovernanceHub | None | Phase 2 (guard is internal) |
| `/citizen` | CitizenPortal | None | Public CAR lookup |
| `/shamsi-theory` | ShamsiTheory | None | 16-dimension reference |
| `/assistant` | AiAssistant | canUseAi | |
| `/research` | LegalResearch | canUseAi | |
| `/literature-review` | LiteratureReview | canUseAi | |
| `/admin-os` | AdminOs | canUseAi | AI-OS decision briefing |
| `/legal-os` | LegalOs | canUseAi | LegalOS interview engine |
| `/audit` | AuditLog | canViewAudit | |
| `/users` | UserManagement | canManageUsers | |
| `/settings` | Settings | canManageSettings | |
| `/upload` | UploadPage | canUpload | |

### 12.2 Governance Hub Tabs (Phase 2 + 5)

1. لوحة التحكم (Dashboard)
2. قرار إداري (Decisions)
3. مؤشرات الشرعية (ASLI Metrics)
4. السجل القضائي (JDP)
5. سجل المساءلة (CAR)
6. رقابة التدقيق (Audit Control)
7. إدارة المستخدمين (Users)
8. نظام الحوكمة (Governance System)
9. ⚖️ الذكاء القضائي (Judicial Intelligence — CJI, judge-only)

---

## 13. Known Alpha 1.0 Limitations

| ID | Issue | Planned Resolution |
|----|-------|-------------------|
| P0-1 | Authentication is header scaffolding (demo mode) | UAE Pass / Enterprise SSO in Beta |
| P0-2 | Zod validation only on create-decision endpoint; other write routes use manual checks | Comprehensive Zod coverage in Beta |
| P1-6 | Document comparison screen (/comparison) is a placeholder | Full comparison engine in next release |
| P1-7 | AI assistant responses not streamed | SSE streaming in next release |
| P1-8 | No Hijri calendar on legal outputs | Moment Hijri integration in next release |
| P1-13 | Some icon-only buttons missing aria-label | Accessibility pass in next release |
| GEO | Saudi Arabia, Qatar, Bahrain, Kuwait, Oman legal modules incomplete | Separate task |

---

## 14. Deployment Notes

- **Environment:** Replit (pnpm monorepo)
- **Frontend port:** Reads from `PORT` env var (Replit assigns per-artifact)
- **API port:** Reads from `PORT` env var
- **Database:** Replit PostgreSQL (`DATABASE_URL` secret)
- **AI key:** `ANTHROPIC_API_KEY` secret
- **Session secret:** `SESSION_SECRET` secret
- **ALLOWED_ORIGIN:** Set to production domain to restrict CORS

### Build Commands
```bash
pnpm --filter @workspace/db run build      # lib/db TypeScript compile
pnpm --filter @workspace/api-server exec tsc --noEmit   # API type check
pnpm --filter @workspace/legal-research exec tsc --noEmit # Frontend type check
pnpm --filter @workspace/db run db:migrate  # Apply DB migrations
```

---

## 15. Architectural Decisions Log

| Decision | Rationale |
|---------|-----------|
| AI call in route, not lib/db | Keeps DB layer dependency-free from Anthropic SDK |
| One-row-per-decision in judicial_reviews (upsert) | Simpler than append-only; version tracked via reviewVersion |
| 409 instead of advisory lock on CJI /run | Sufficient for single-instance deployment; advisory lock is on Evidence Ledger (multi-write risk) |
| Evidence Ledger advisory lock `0x4556_4944` | Only ledger with high concurrent write risk (many stage events per decision) |
| `trimDecisionData` 20k char hard cap | Claude output truncated at 37,258 chars without it; 20k safely within 8192 output token budget |
| `String(req.params.decisionId)` cast | Express types `req.params` as `string | string[]` in this version |
| `constitutional_reviewer.canReadJdp: true` | JDP is the primary artefact of constitutional review; false was an oversight |
| CORS restricted to Replit domains | Prevents cross-origin abuse; `ALLOWED_ORIGIN` env var for production lock |
| CAR = "سجل المساءلة الدستورية" (Constitutional Accountability Record) | Arabic name is canonical; English name standardised to "Constitutional Accountability Record" in Alpha 1.0 |
| 16-dimension CJI extends original 12-dimension theory | Dimensions 13–16 operationalise UAE 2026 AI law requirements not in original Shamsi theory |

---

*Generated 2026-07-04 · مرصد (MARSAD) Alpha 1.0 · Al-Shamsi Constitutional Decision Framework™*
