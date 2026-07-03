# MARSAD — Product Architecture Report
## Government AI Legal Platform · Senior Architect Review
**Date:** 3 July 2026  
**Prepared by:** Platform Architecture Review  
**Classification:** Internal Product Planning  
**Scope:** Full-stack audit — Frontend, API, Database, AI Layer, UX Flows, Legal Logic

---

## Executive Summary

MARSAD is a government-grade AI legal research and decision-support platform built around the Al-Shamsi Theory of Administrative Decision Legitimacy. The platform has achieved a strong foundation — a working AI assessment engine, bilingual PDF court packages, SHA-256 audit trail, and a coherent design system — but it is currently a **collection of capable features rather than a cohesive product**.

The critical gaps fall into four categories:

1. **Identity & Trust** — The platform operates on header-spoofable roles with no real authentication. For a government AI platform this is a structural risk, not a feature gap.
2. **Jurisdictional Coverage** — 5 of 7 GCC modules are empty stubs. The platform claims regional authority it does not yet have.
3. **User Journey Completeness** — Multiple journeys reach a terminal point (a PDF, a report) with no next step — no sharing, no appeals, no escalation, no downstream action.
4. **Platform Hygiene** — Legacy routes, duplicated pages, unindexed foreign keys, and a CORS policy open to all origins represent accumulated technical debt that will compound at scale.

The roadmap below addresses these in priority order.

---

## Section 1: Current State Map

### 1.1 What Is Working Well

| Capability | Quality |
|:-----------|:--------|
| Al-Shamsi 12-Dimension Assessment Engine | ✅ Strong — UAE + France fully populated |
| SHA-256 Audit Trail + Immutable Brief Hash | ✅ Complete |
| Bilingual PDF Court Package (Puppeteer) | ✅ Complete |
| AI Research Assistant (RAG + Chat History) | ✅ Functional |
| Legal Sources Browser (UAE + France) | ✅ Complete |
| Admin Scenario Builder | ✅ Complete |
| Compliance KPI Dashboard | ✅ Complete |
| Document Comparison Engine | ✅ Functional |
| Citation Generator | ✅ Functional |
| Personal Library + Bookmarks | ✅ Functional |
| Design System (RTL/LTR, Gold/Slate theme) | ✅ Highly consistent |
| Al-Shamsi Theory Reference Page | ✅ Complete |

### 1.2 Platform Topology (Current)

```
Browser (React + Wouter)
    └── artifacts/legal-research  [Port: $PORT]
            ↕ REST (Orval-generated hooks)
    └── artifacts/api-server       [Port: $PORT]
            ├── /routes/admin-os       ← Al-Shamsi Decision OS
            ├── /routes/legal-os       ← Legal OS Sessions
            ├── /routes/legal-os-admin ← Scenario Builder
            ├── /routes/ai             ← Research / Literature / Compare
            ├── /routes/assistant      ← Chat (RAG)
            ├── /routes/research       ← Document Search
            ├── /routes/legal-sources  ← Source Management
            ├── /routes/documents      ← Upload / Manage
            ├── /routes/users          ← User CRUD
            ├── /routes/audit          ← Log Viewer
            ├── /routes/settings       ← Platform Config
            └── /routes/citations      ← Citation Engine
            ↕ Drizzle ORM
    └── lib/db  [PostgreSQL]
            ├── users
            ├── documents / legal_sources / library_items
            ├── comparisons / citations_log
            ├── chat_sessions / chat_messages
            ├── admin_decision_types / roles / jurisdictions / sessions / briefs
            ├── legal_os_sessions / custom_roles / custom_scenarios
            ├── audit_logs
            └── settings
```

---

## Section 2: Gap Analysis

### 2.1 Missing Modules

#### CRITICAL
| # | Module | Impact | Evidence |
|:--|:-------|:-------|:---------|
| M-01 | **Real Authentication (JWT/Session)** | Platform security is theater. Any user can spoof an `x-user-role: owner` header and gain full admin access. | `roleAuth.ts` reads `req.headers['x-user-role']` with no verification |
| M-02 | **Multi-Tenancy / Organization Layer** | All users share one flat namespace. Two government departments cannot be isolated. | No `organization_id` or `tenant_id` in any schema table |
| M-03 | **Notification System** | No email, in-app, or webhook notifications. Actions have no downstream communication. | Entirely absent from backend |
| M-04 | **GCC Jurisdiction Modules (SA, QA, BH, KW, OM)** | Platform claims regional authority; 5/7 modules are empty stubs. | `ai/jurisdictions/sa.prompt.ts` et al. contain only TODO comments |
| M-05 | **Approval / Review Chain** | A generated legal brief has no path to supervisor review, electronic endorsement, or formal sign-off. | No `approval_workflows` table; no signature fields |

#### IMPORTANT
| # | Module | Impact |
|:--|:-------|:-------|
| M-06 | **E-Signature Integration** | Government decisions require legal attestation. PDFs cannot be officially filed without it. |
| M-07 | **Data Retention Policy Engine** | No mechanism for scheduled deletion, archiving, or data expungement — a legal requirement for government platforms. |
| M-08 | **Court Hierarchy / Organizational Chart Model** | `court_level` is a free-text string. No formal model of the UAE judicial structure. |
| M-09 | **Regulatory Calendar / Deadline Tracker** | No way to track compliance deadlines, legislative review dates, or appeal windows. |
| M-10 | **Backup / Restore Verified Flow** | `backup.ts` route exists but is untested in the audit. No restore endpoint found. |

#### FUTURE
| # | Module | Impact |
|:--|:-------|:-------|
| M-11 | **Blockchain Anchoring for Brief Hashes** | SHA-256 exists but is stored in the same database it audits. External anchoring provides true tamper-evidence. |
| M-12 | **Mobile Application** | Government officials operate in field environments. No mobile artifact exists. |
| M-13 | **Public Citizen Portal** | Separate from the internal tool — a citizen-facing interface for rights lookup and appeal submission. |
| M-14 | **Regulatory Intelligence Feed** | Automated ingestion of new legislation, gazette notices, and court decisions. |

---

### 2.2 Weak UX Flows

#### CRITICAL
| # | Flow | Problem | Severity |
|:--|:-----|:--------|:---------|
| U-01 | **Decision OS — Terminal Dead End** | The journey ends at PDF download. There is no: Share to supervisor → Request review → File appeal → Track outcome. Users complete the OS and then... nothing. | Critical |
| U-02 | **No Role-Differentiated Dashboard** | Every user sees the same dashboard regardless of role. An Owner sees what a Viewer sees. No contextual landing page. | High |
| U-03 | **No Onboarding Flow** | New government users land directly in a complex interface with no orientation, guided tour, or contextual help. | High |
| U-04 | **Settings Page Handles API Keys in Plaintext UI** | API keys (Claude, Perplexity) are editable through a standard form. This is a security and auditing concern. | High |

#### IMPORTANT
| # | Flow | Problem |
|:--|:-----|:--------|
| U-05 | **Legal Research — No Result Ranking Signal** | Search returns results with no visible relevance score, recency weighting, or source authority indicator. |
| U-06 | **No Session History / Resume Flow** | Users cannot see past Decision OS sessions, resume incomplete ones, or compare two assessments over time. |
| U-07 | **No Inline Feedback Mechanism** | No way for a user to flag an AI assessment as incorrect, incomplete, or hallucinated. No correction loop. |
| U-08 | **Literature Review Has No Export** | The literature review generates analysis but offers no export to PDF, Word, or citation format. |
| U-09 | **Document Comparison Has No Annotation Layer** | Users can compare two documents but cannot annotate differences, flag clauses, or add commentary. |
| U-10 | **Personal Library Has No Folders / Collections** | Tags exist but no hierarchical organization. At scale (hundreds of saved items), this becomes unusable. |

#### MODERATE
| # | Flow | Problem |
|:--|:-----|:--------|
| U-11 | **No Empty State Education** | GCC jurisdiction pages show blank/stub content with no explanation of what's coming or when. |
| U-12 | **AI Assistant Has No Suggested Questions** | The chat interface opens to a blank input. First-time users don't know what to ask. |
| U-13 | **Compliance Dashboard Has No Drill-Down** | KPI cards show numbers but clicking them does nothing. No path from metric to underlying records. |
| U-14 | **Citation Generator Has No Preview Before Export** | Users generate citations and download without seeing the formatted output first. |
| U-15 | **Mobile Responsiveness Not Verified** | RTL/LTR layout handling exists at the component level, but no mobile breakpoint audit has been performed. |

---

### 2.3 Duplicate Functionality

The following files represent technical debt that creates maintenance drift and user confusion:

| Legacy File | Replaced By | Action |
|:------------|:------------|:-------|
| `pages/ai-search.tsx` | `pages/legal-research.tsx` | Consolidate → Delete legacy |
| `pages/uae-france.tsx` | `pages/document-comparison.tsx` | Consolidate → Delete legacy |
| `pages/comparisons.tsx` | `pages/document-comparison.tsx` | Consolidate → Delete legacy |
| `pages/documents.tsx` | `pages/personal-library.tsx` | Consolidate → Delete legacy |
| `pages/upload.tsx` | `pages/personal-library.tsx` | Consolidate → Delete legacy |
| `pages/users.tsx` | `pages/user-management.tsx` | Consolidate → Delete legacy |
| `pages/analytics.tsx` | `pages/admin-os-compliance.tsx` | Consolidate → Delete legacy |
| `pages/audit-log.tsx` | `pages/admin-os-compliance.tsx` | Consolidate → Delete legacy |
| Legacy route aliases in `App.tsx` | Direct routes | Remove 8 legacy aliases |

**Impact of duplication:** 9 legacy files + 8 route aliases = 17 dead-weight artifacts that must be maintained, appear in search results, and confuse new contributors.

---

### 2.4 Missing Legal Workflows

The platform has an *assessment engine* but no *legal workflow engine*. Government legal practice involves structured processes with actors, stages, deadlines, and outcomes.

| # | Workflow | Description | Priority |
|:--|:---------|:------------|:---------|
| W-01 | **Administrative Decision Appeals** | After a decision is assessed, a structured appeal path: submission → review period → hearing → outcome. | Critical |
| W-02 | **Internal Legal Opinion Request** | Department submits a question → Legal department drafts opinion → Senior counsel reviews → Opinion published internally. | Critical |
| W-03 | **Supervisor Review / Brief Endorsement** | Generated brief routed to supervisor → Comments added → Approved or returned with notes → Signed PDF issued. | Critical |
| W-04 | **Regulatory Compliance Audit** | Scheduled compliance check for a department → Checklist generated → Evidence uploaded → Compliance score computed → Report filed. | High |
| W-05 | **Cross-Department Consultation** | Legal question requires input from multiple departments → Parallel consultation tracks → Consolidated response. | High |
| W-06 | **Legislative Amendment Tracking** | A law is amended → All assessments referencing that law are flagged for re-evaluation → Users notified. | High |
| W-07 | **Public Procurement Legal Review** | Procurement above threshold triggers legal review → Contract terms assessed against UAE Federal Law → Risk flagged. | Important |
| W-08 | **Employment / Civil Service Dispute** | Employee files grievance → HR assessment → Legal OS interview → Decision brief → Appeal window. | Important |
| W-09 | **Disciplinary Committee Proceeding** | Committee convened → Evidence presented → Deliberation recorded → Decision logged with full audit trail. | Important |
| W-10 | **Contract Lifecycle Management** | Draft → Review → Legal clearance → Execution → Performance monitoring → Renewal/Termination. | Future |

---

### 2.5 Missing AI Capabilities

| # | Capability | Current State | Gap |
|:--|:-----------|:-------------|:----|
| A-01 | **Streaming Responses** | Implemented for some endpoints | Decision OS interview + assessment do not stream; users wait in silence for 20–40 seconds |
| A-02 | **Assessment Caching** | Absent | Identical fact patterns re-run full Claude inference. Cost and latency waste. |
| A-03 | **AI Feedback / Correction Loop** | Absent | No mechanism to flag hallucinations, incorrect citations, or wrong jurisdiction assignments |
| A-04 | **Multi-Document Synthesis** | Max 2 documents in comparison | Legal analysis often requires synthesizing 5–10 instruments simultaneously |
| A-05 | **Automatic AR↔EN Translation** | Absent | Users cannot translate a found Arabic legal text to English in-platform, or vice versa |
| A-06 | **Legal Entity Extraction (NER)** | Absent | No extraction of parties, dates, provision numbers, monetary amounts from uploaded documents |
| A-07 | **Precedent Matching Engine** | Absent | No capability to find court decisions that are factually similar to a current scenario |
| A-08 | **Contradiction Detection** | Absent | No capability to detect when two cited legal instruments conflict with each other |
| A-09 | **Risk Scoring / Probability** | Absent | Assessment produces qualitative recommendations; no quantitative litigation risk score |
| A-10 | **Voice Input for Interviews** | Absent | Decision OS interviews are text-only; voice input would serve field officials and Arabic-first users |
| A-11 | **Semantic Document Chunking** | Basic (500-word fixed chunks) | Legal documents have semantic structure (articles, clauses) that fixed chunking destroys |
| A-12 | **Jurisdiction Auto-Detection** | Absent | User must manually select jurisdiction. AI should detect likely jurisdiction from document content |

---

### 2.6 Missing Judicial Scenarios

The Decision OS has generic administrative decision scenarios. The following judicial scenario types are absent:

| # | Scenario | Legal Basis | Jurisdiction |
|:--|:---------|:------------|:-------------|
| J-01 | **Digital / AI-Generated Decision Challenge** | UAE Law 8/2011 + Al-Shamsi Theory Core | UAE |
| J-02 | **Algorithmic Bias Claim in Government Service** | GDPR Art. 22 analogue + DIFC Data Law | UAE / EU |
| J-03 | **Emergency Administrative Decision (Crisis Powers)** | UAE Constitution Art. 120 | UAE |
| J-04 | **Cross-Border Administrative Decision** | UAE-GCC bilateral frameworks | Multi-jurisdiction |
| J-05 | **Government Employee Termination Appeal** | UAE Federal HR Law (Decree-Law 49/2022) | UAE |
| J-06 | **Public Land / Property Expropriation** | UAE Land Law | UAE |
| J-07 | **Business License Revocation** | UAE Commercial License Law | UAE |
| J-08 | **Environmental Compliance Enforcement** | UAE Federal Law 24/1999 | UAE |
| J-09 | **Data Protection Breach Response** | UAE Personal Data Protection Law | UAE |
| J-10 | **Diwan al-Mazalim Administrative Complaint** | Saudi Board of Grievances Law | Saudi Arabia |
| J-11 | **French Administrative Court (CAA) Appeal** | Code de Justice Administrative | France |
| J-12 | **EU AI Act Compliance Assessment** | EU AI Act 2024 | EU / Multi |

---

### 2.7 Missing Government User Journeys

| # | Persona | Journey | Status |
|:--|:--------|:--------|:-------|
| G-01 | **Department Head** | Review a subordinate's generated brief → Add comments → Approve or return for revision → Issue signed final brief | Missing |
| G-02 | **Ministry Legal Counsel** | Receive a legal opinion request → Research across jurisdictions → Draft opinion using AI → Route for senior review → Publish internally | Missing |
| G-03 | **Policy Analyst** | Upload a draft regulation → AI impact assessment against existing laws → Conflict detection → Recommendation report | Missing |
| G-04 | **Compliance Officer** | Schedule quarterly compliance audit → AI-generated checklist per department → Upload evidence → Generate compliance certificate | Missing |
| G-05 | **New Government Employee** | Complete onboarding → Learn platform capabilities via guided tour → Complete first Decision OS session with walkthrough | Missing |
| G-06 | **Senior Legal Advisor** | View all assessments across the department → Filter by risk level → Prioritize interventions → Export aggregate report | Missing |
| G-07 | **Secretary General** | See system-wide KPIs → Decision velocity → Compliance rates → AI cost per department → Export executive summary | Missing |
| G-08 | **IT Administrator** | Manage user accounts → Assign department → Set data retention policies → Monitor system health → Configure integrations | Partial |

---

### 2.8 Missing Citizen Journeys

The platform is currently 100% internal-government-facing. A government legal platform at this tier should include:

| # | Persona | Journey | Priority |
|:--|:--------|:--------|:---------|
| C-01 | **Individual Citizen** | Understand their rights in plain Arabic → Ask a legal question about a government decision that affected them → Receive a plain-language explanation (not a legal brief) | High |
| C-02 | **Business Owner** | Check regulatory compliance before launching a business → UAE + relevant GCC jurisdiction checklist → Risk flags | High |
| C-03 | **Foreign Investor** | Compare investment regulations across GCC jurisdictions → Understand required approvals → Generate a pre-investment compliance summary | High |
| C-04 | **Appeal Filer** | Submit an administrative appeal online → Receive case reference number → Track appeal status → Receive outcome notification | Medium |
| C-05 | **Legal Aid Recipient** | Low-income individual seeks legal rights explanation → Simplified AI-guided interview → Plain-language summary of their options | Future |

---

### 2.9 Missing Administration Tools

| # | Tool | Current State | Impact |
|:--|:-----|:-------------|:-------|
| AD-01 | **AI Cost Dashboard** | Absent | No visibility into Claude API spend per user, per feature, or per department. Cost management is blind. |
| AD-02 | **System Health Monitor** | Absent | No uptime, response time, error rate, or queue depth visibility for administrators. |
| AD-03 | **Bulk Legal Source Import** | Manual one-by-one only | Cannot onboard a new jurisdiction's full legal corpus efficiently. |
| AD-04 | **Permission Matrix Editor** | Role names exist; permissions are hardcoded | Admins cannot adjust what each role can access without code changes. |
| AD-05 | **Notification Configuration** | Absent | No way to configure email templates, notification triggers, or delivery preferences. |
| AD-06 | **Scheduled Report Delivery** | Absent | No mechanism to auto-generate and email daily/weekly compliance reports to supervisors. |
| AD-07 | **RAG Index Management** | Absent | Admins cannot inspect the vector index, re-index a document, or clear stale chunks. |
| AD-08 | **API Rate Limit Manager** | Hardcoded (15/min) | Different user tiers or departments cannot have differentiated rate limits. |
| AD-09 | **Data Export / Portability** | `export.ts` route exists | Untested; no UI surface. Format unknown. |
| AD-10 | **Feature Flag System** | Absent | New features (e.g., GCC modules) cannot be toggled on per-department without a deployment. |

---

### 2.10 Performance Issues

| # | Issue | Location | Risk |
|:--|:------|:---------|:-----|
| P-01 | **No database indexes on foreign keys** | `lib/db/src/schema/*` | Full table scans on `user_id`, `session_id`, `document_id` joins at scale |
| P-02 | **Fixed 500-word RAG chunking** | `api-server/src/utils/rag.ts` | Legal article boundaries ignored; retrieval precision degrades on structured legislation |
| P-03 | **Synchronous PDF generation** | `utils/admin-brief-pdf.ts` (Puppeteer) | Blocks the HTTP request thread for 3–8 seconds per export; no queue |
| P-04 | **No response caching layer** | Entire API | Identical research queries re-run full vector search + LLM inference |
| P-05 | **CORS allows all origins** | `app.ts` | Not a performance issue, but a security posture that will block compliance certification |
| P-06 | **No connection pool configuration** | `lib/db/src/index.ts` | Default Drizzle/pg pool settings may exhaust connections under concurrent load |
| P-07 | **No CDN / static asset caching** | Legal source documents | Large PDFs and legal texts re-served from the API server on every request |
| P-08 | **Rate limiter is global (15/min AI)** | `routes/ai.ts` | A power user exhausts the limit and blocks all other users on the same IP |
| P-09 | **Chat history loaded in full** | `routes/assistant.ts` | Full chat history loaded per request; no pagination or summarization for long sessions |
| P-10 | **No background job queue** | Entire API | Long-running tasks (PDF generation, bulk import, scheduled reports) run in the request cycle |

---

## Section 3: Roadmap

---

### ◼ PHASE 1 — Critical Foundation
**Objective:** Make the platform trustworthy, secure, and complete enough to deploy in a real government environment.  
**Timeframe:** 8–12 weeks  
**Principle:** Fix what breaks at the seams before adding what shines at the surface.

---

#### 1.1 Authentication & Identity (M-01, U-04)
**What:** Replace header-based role spoofing with proper session-based authentication using Replit Auth or Clerk. Implement secure session tokens, password-based login, and role assignment by administrators — not by the client.  
**Why:** A government AI platform that can be compromised by adding a browser extension header is not deployable. This is the single highest-risk item in the entire codebase.  
**Deliverables:**
- Login / logout flow
- Session middleware replacing `x-user-role` header checks  
- Role assignment stored in `users.role` column (already exists)
- All routes protected at the middleware layer

#### 1.2 Codebase Consolidation — Dead Code Removal (2.3)
**What:** Delete 9 legacy pages and remove 8 route aliases. Merge their functionality into the canonical pages.  
**Why:** Legacy pages confuse new contributors, appear in navigation logic, and create maintenance drift. Every feature added in the future risks being accidentally added to the wrong file.  
**Deliverables:**
- `pages/` reduced from ~20 files to ~11 canonical files  
- `App.tsx` route count reduced by 8 aliases  
- No broken internal navigation links

#### 1.3 Decision OS — Journey Completion (U-01, W-03)
**What:** After the generated brief, add the missing downstream flow: Share Brief → Route to Supervisor → Supervisor Reviews → Endorses or Returns → Final Signed Brief.  
**Why:** The most powerful feature of the platform (the Decision OS) currently ends at a PDF. This is the equivalent of a courtroom with no verdict delivery mechanism.  
**Deliverables:**
- Brief sharing via email or internal link  
- Supervisor review queue (list of briefs awaiting action)  
- Comment/annotation layer on a brief  
- Approval or return-for-revision action  
- Signed PDF issued after approval

#### 1.4 Database Index Coverage (P-01)
**What:** Add explicit B-tree indexes on all foreign key columns: `user_id`, `session_id`, `document_id`, `legal_source_id`, `entity_id`.  
**Why:** The platform has no production users yet. This is the correct time to index. At 10,000+ records, unindexed foreign key joins will cause 10–100× query time degradation.  
**Deliverables:**
- Drizzle migration adding indexes to all FK columns  
- Query plan verification on the three most expensive joins

#### 1.5 GCC Jurisdiction Modules — Phase 1 (M-04, Task #29)
**What:** Fully implement Saudi Arabia and Qatar jurisdiction modules (the two largest GCC legal systems). Each requires: specific primary legislation, court hierarchy, assessment prompts for all 12 dimensions, and a jurisdiction-specific legal sources page.  
**Why:** UAE + France is insufficient for a platform that positions itself as the GCC regional standard. Saudi Arabia's Diwan al-Mazalim and Qatar's State Shura Council are essential.  
**Deliverables:**
- `sa.prompt.ts` — Saudi Administrative Law (Royal Decrees, Board of Grievances Law)  
- `qa.prompt.ts` — Qatari Administrative Law (State Shura Council, QFC framework)  
- Two new legal source pages (Saudi Legislation, Qatar Legislation)  
- Assessment engine activated for both jurisdictions

#### 1.6 Streaming AI Responses (A-01, Task #25)
**What:** Stream Decision OS assessment output section-by-section as the AI generates it. Users currently wait 20–40 seconds for a silent screen.  
**Why:** This is the single biggest UX degradation point in the primary journey. A government official who waits 40 seconds in silence concludes the system is broken.  
**Deliverables:**
- Server-sent events (SSE) or chunked transfer on `/admin-os/assess`  
- Frontend renders each assessment dimension as it arrives  
- Progress indicator showing which dimension is being evaluated

#### 1.7 PDF Generation — Background Queue (P-03)
**What:** Move Puppeteer PDF generation to a background job. Return a job ID immediately; poll for completion; deliver download link when ready.  
**Why:** Synchronous Puppeteer blocks the Node.js request thread for 3–8 seconds. Under concurrent load, this will cause request timeouts and thread exhaustion.  
**Deliverables:**
- Simple in-memory queue (BullMQ or similar) for PDF jobs  
- `GET /admin-os/pdf-status/:jobId` polling endpoint  
- Frontend download flow updated to async pattern

#### 1.8 Assessment Caching (A-02, Task #24)
**What:** Hash the canonical inputs (jurisdiction, role, scenario, answers) and cache the AI response for 24 hours. Return cache hit immediately; show cache indicator to user.  
**Why:** Government officials frequently run identical or near-identical fact patterns (same department, same scenario, same decision type). Re-running full Claude inference for every identical case wastes API cost and time.  
**Deliverables:**
- Input hash function in `admin-os-evaluator.ts`  
- Cache storage in existing `settings` table or a new `assessment_cache` table  
- Cache hit/miss indicator in the assessment UI  
- Admin control to invalidate cache per jurisdiction

---

### ◼ PHASE 2 — Important Capabilities
**Objective:** Elevate the platform from a capable tool to a complete government workflow system.  
**Timeframe:** 12–20 weeks  
**Principle:** Add the workflow layers, AI depth, and user journeys that make the platform indispensable — not just useful.

---

#### 2.1 Multi-Tenancy / Organization Model (M-02)
**What:** Introduce an `organizations` table. Every user belongs to an organization (ministry, department, authority). Data is scoped by organization. Cross-organization sharing requires explicit grants.  
**Why:** The platform is currently a single shared namespace. The Ministry of Justice and the Abu Dhabi Judiciary Department cannot both use this platform without seeing each other's briefs.  
**Deliverables:**
- `organizations` table with name, type, parent_organization  
- `user.organization_id` FK  
- All data queries scoped to `organization_id`  
- Organization management in admin panel  
- Cross-organization data sharing grants table

#### 2.2 Legal Workflow Engine (W-01 through W-09)
**What:** A generic workflow model: a workflow has stages, each stage has actors, deadlines, and required actions. Instantiated for: Brief Endorsement, Legal Opinion Request, Compliance Audit, and Administrative Appeal.  
**Why:** The platform generates legal documents but has no mechanism for those documents to move through organizational processes. This is the gap between a legal *tool* and a legal *operating system*.  
**Schema additions:**
```
workflows: id, type, title, status, created_by, organization_id, due_at
workflow_stages: id, workflow_id, stage_name, assigned_to, status, completed_at, notes
workflow_attachments: id, workflow_id, stage_id, document_ref, uploaded_by
```
**Initial workflow types:**
- `brief_endorsement` — Decision OS brief → Supervisor → Signed PDF  
- `legal_opinion` — Request → Research → Draft → Review → Publish  
- `compliance_audit` — Schedule → Checklist → Evidence → Report  
- `administrative_appeal` — Submission → Review → Hearing → Outcome

#### 2.3 Role-Differentiated Dashboard (U-02)
**What:** Dashboard content is personalized by role. Owner sees system-wide KPIs + cost. Supervisor sees team briefs awaiting review + recent sessions. Viewer sees their own sessions + quick-start actions.  
**Why:** A dashboard that shows the same thing to everyone gives nobody useful information. Role differentiation is the minimum expected behavior for a multi-role platform.  
**Deliverables:**
- Three distinct dashboard layouts (Owner / Supervisor / Viewer)  
- Quick action cards relevant to each role  
- Real-time brief queue for supervisors  
- Executive summary panel for owners

#### 2.4 Judicial Scenario Library — Phase 1 (J-01 through J-09)
**What:** Add 9 new judicial scenario types to the Decision OS scenario library, with jurisdiction-appropriate interview questions, legal references, and assessment rubrics.  
**Why:** The current scenario library covers generic administrative decisions. Real government legal work centers on specific proceeding types (appeal, termination, procurement, data breach) that each require specialized question trees and legal frameworks.  
**Deliverables:**
- 9 new scenario definitions in the database  
- Jurisdiction-appropriate interview question sets per scenario  
- Legal reference mappings (articles, decrees, regulations)  
- Assessment prompt additions for each scenario type

#### 2.5 AI Feedback & Correction Loop (A-03)
**What:** After any AI output (assessment, research result, literature review), users can: flag as inaccurate, suggest correction, rate relevance. Feedback stored and surfaced to administrators.  
**Why:** LLMs hallucinate. On a government legal platform, an incorrect citation to a law that does not exist is a professional and legal liability. Users need a correction mechanism; administrators need visibility into error patterns.  
**Deliverables:**
- Thumbs up/down + flag button on every AI output  
- Free-text correction field  
- `ai_feedback` table: session_id, output_type, rating, correction_text, reviewed  
- Admin feedback dashboard with unreviewed items queue

#### 2.6 Multi-Document Synthesis (A-04)
**What:** Allow users to select up to 10 documents/legal sources and request a synthesized AI analysis across all of them simultaneously.  
**Why:** Legal analysis rarely involves two documents. A cross-jurisdictional opinion requires synthesizing the primary law, implementing regulations, judicial interpretations, and comparative foreign law simultaneously.  
**Deliverables:**
- Multi-select on Personal Library and Legal Sources pages  
- Synthesis prompt architecture (hierarchical RAG across multiple corpora)  
- Synthesis output with source-attributed citations  
- Export to PDF with source appendix

#### 2.7 Semantic RAG Chunking (A-11, P-02)
**What:** Replace fixed 500-word chunking with article/section-aware chunking. Legal texts have explicit structural markers (Article N, Section M, Clause K). Respect these boundaries during indexing.  
**Why:** Fixed chunking splits mid-article, destroying the legal meaning of provisions. A chunk that starts at word 450 of Article 5 and ends at word 50 of Article 6 is meaningless to a retrieval system.  
**Deliverables:**
- Regex-based legal structure parser (Arabic + English patterns)  
- Chunk boundaries at article/section level  
- Chunk metadata: article number, section, source document, jurisdiction  
- Re-indexing pipeline for existing documents

#### 2.8 AI Cost & Usage Dashboard (AD-01)
**What:** Real-time dashboard showing Claude API token consumption by user, by feature, by organization, and by date. With projected monthly cost and budget alert thresholds.  
**Why:** The platform has no cost management. An unlimited-access government deployment could accumulate thousands of dollars in unexpected API charges with no visibility.  
**Deliverables:**
- `ai_usage_log` table: endpoint, user_id, tokens_in, tokens_out, model, cost_usd, created_at  
- Usage dashboard in admin panel with charts by feature and user  
- Monthly budget threshold with email alert  
- Per-user and per-organization rate limit configuration

#### 2.9 Government User Journeys — Department Head + Legal Counsel (G-01, G-02)
**What:** Build out the two highest-value government user journeys end-to-end.  
**Department Head:** Receives brief for review → Reads assessment → Adds inline comments → Approves or returns → Final brief issued with approval stamp.  
**Legal Counsel:** Opens Opinion Request workspace → Searches across jurisdictions → AI drafts opinion structure → Counsel refines → Routes for senior review → Opinion published to organizational knowledge base.  
**Deliverables:**
- Brief review interface with inline commenting  
- Opinion Request workspace (new page)  
- Knowledge base section (published internal opinions)  
- Notification triggers at each workflow stage

#### 2.10 Remaining GCC Modules — Bahrain, Kuwait, Oman (M-04, Task #29 Part 2)
**What:** Complete the remaining three GCC jurisdiction modules with the same depth as UAE and France.  
**Why:** After Saudi Arabia and Qatar (Phase 1), the GCC coverage is complete. The platform can legitimately claim regional authority.  
**Deliverables:**
- `bh.prompt.ts` — Bahraini Administrative Law  
- `kw.prompt.ts` — Kuwaiti Administrative Law (Fatwa & Legislation State Council)  
- `om.prompt.ts` — Omani Administrative Law (Administrative Court)  
- Three new legal source pages  
- Assessment engine activated for all three

#### 2.11 Notification System (M-03)
**What:** Email notifications for: brief approved/returned, workflow stage completed, compliance deadline approaching, new legal source added in a subscribed jurisdiction, AI feedback reviewed.  
**Why:** The platform currently requires users to actively check it. A government official will not log in daily to check if their brief was approved. Push communication is required for workflow adoption.  
**Deliverables:**
- Email notification service (transactional email via SMTP or provider)  
- Notification preferences per user  
- Notification log (audit trail of all sent notifications)  
- In-app notification bell with unread count

#### 2.12 PDF Enhancements — Cover Page + Table of Contents (Task #17)
**What:** Add a professional cover page (ministry logo placeholder, brief reference number, date, classification level) and a hyperlinked table of contents to all exported PDFs.  
**Why:** Government court packages require a formal cover page and navigable structure. The current PDF is a single-column report without these standard legal document features.  
**Deliverables:**
- Cover page template with configurable ministry branding  
- Auto-generated TOC with section page numbers  
- Classification level field (Confidential / Internal / Public)  
- Brief reference number in the format: MARSAD-{YEAR}-{SEQUENCE}

---

### ◼ PHASE 3 — Future Vision
**Objective:** Transform MARSAD from a government productivity tool into the authoritative AI legal intelligence infrastructure for the GCC.  
**Timeframe:** 20–36 weeks  
**Principle:** Platform network effects, citizen access, and institutional knowledge accumulation.

---

#### 3.1 Citizen-Facing Portal (C-01 through C-04)
**What:** A separate, simplified public-facing interface under a distinct URL. Citizens can: understand their rights in plain Arabic, submit administrative appeals, track appeal status, and check business compliance requirements.  
**Why:** A government AI legal platform that serves only government officials misses the downstream population it governs. Citizen access is the legitimacy multiplier.  
**Architecture:** Separate frontend artifact + restricted API surface (read-only legal data + appeal submission only). No access to government internal briefs or sessions.

#### 3.2 E-Signature Integration (M-06)
**What:** Integrate with a UAE-certified e-signature provider (Emirates ID-based signature or DocuSign UAE). Signed briefs carry a legally valid electronic signature.  
**Why:** Without e-signature, every generated brief must be printed and physically signed before it has legal effect. This negates the efficiency gains of the entire platform.

#### 3.3 Regulatory Intelligence Feed (M-14)
**What:** Automated daily ingestion of: UAE Official Gazette (Al-Jarida Al-Rasmiya), Saudi Umm Al-Qura Gazette, Qatar Official Gazette, EU Official Journal. New legislation auto-indexed into RAG, with affected assessment sessions flagged for re-evaluation.  
**Why:** Legal research is only as good as its currency. A legal OS that operates on documents from 2023 when new regulations were issued in 2025 is producing flawed assessments without users knowing.

#### 3.4 Blockchain Brief Anchoring (M-11)
**What:** Anchor the SHA-256 hash of every signed brief to a public blockchain (Ethereum or UAE-specific ledger). The on-chain transaction ID is recorded alongside the brief.  
**Why:** The current audit trail is stored in the same PostgreSQL database that it audits. A motivated actor with database access can alter both the brief and its audit record simultaneously. An on-chain anchor is independently verifiable by any party, including courts.

#### 3.5 Precedent Matching Engine (A-07)
**What:** For a given set of facts (extracted from a Decision OS interview), the system retrieves the 5 most factually similar past court decisions from the indexed caselaw corpus. Match score and distinguishing factors presented alongside the assessment.  
**Why:** Legal decision-making is inherently precedent-based. The assessment engine currently applies the Al-Shamsi 12-dimension framework in isolation. Connecting it to factually similar precedents transforms it from a compliance checklist into a true legal intelligence tool.

#### 3.6 Voice Interface for Interviews (A-10)
**What:** Arabic-first voice input for Decision OS interviews. The interviewer reads the question aloud; the official responds verbally; transcript auto-populated into the answer field; final review before submission.  
**Why:** Many government officials, particularly those in field environments or senior positions, are more comfortable speaking than typing. Arabic voice recognition eliminates a significant friction point.

#### 3.7 Executive Intelligence Layer (G-07)
**What:** A Secretary General / Minister-level view: across all departments, what is the decision compliance rate? What percentage of decisions are algorithmically generated vs human? What is the average assessment time? Where are the legal risk hotspots by jurisdiction and decision type?  
**Why:** Platform ROI to senior government leadership is measured in aggregate outcomes, not individual brief quality. This dashboard turns MARSAD into a governance visibility tool, not just a legal productivity tool.

#### 3.8 Data Retention & Expungement Engine (M-07)
**What:** Configurable retention policies per data type and per organization. Automatic archiving of sessions older than N years. Scheduled data expungement with audit confirmation. GDPR/UAE PDPL compliance reporting.  
**Why:** Government platforms are subject to data retention regulations. Without a retention engine, MARSAD accumulates data indefinitely, creating legal liability and storage costs.

#### 3.9 Jurisdiction Auto-Detection (A-12)
**What:** On document upload, the AI scans for jurisdiction signals (decree numbers, court names, legal codes, language patterns) and auto-suggests the applicable jurisdiction and document type. User confirms or overrides.  
**Why:** Manual jurisdiction selection requires legal knowledge the user may not have. Auto-detection reduces mis-categorized documents and improves RAG retrieval accuracy.

#### 3.10 MARSAD Certification Program
**What:** A structured completion pathway: complete N assessments → pass a knowledge quiz on the Al-Shamsi Theory → receive a MARSAD Certified Government Legal Analyst certificate (PDF, signed, with MARSAD reference number).  
**Why:** Certification creates user engagement, institutional buy-in, and a network effect — certified analysts advocate for platform adoption across departments. It also creates a training pathway for onboarding new government legal staff.

---

## Section 4: Architecture Principles for All Future Work

These principles should govern every feature addition from this point forward:

1. **Journey-first, feature-second.** Before adding any capability, define the user journey it serves, end to end. A feature without a journey is a dead end.

2. **No new legacy.** Every new page must replace or extend an existing canonical page. No new pages alongside existing ones doing similar things.

3. **Security by default.** All new routes are authenticated. All new tables include `organization_id`. All new AI outputs are logged to `ai_usage_log`.

4. **Streaming as standard.** All new AI endpoints stream. Synchronous AI responses are not acceptable on a government platform where officials will interpret silence as failure.

5. **Audit everything.** Every state change (workflow stage advance, brief approval, user role change, legal source addition) is recorded in `audit_logs` with actor, timestamp, and before/after state.

6. **Arabic first.** All new UI is designed in Arabic and adapted to English, not the reverse. RTL is the default layout direction.

7. **Jurisdiction completeness before jurisdiction breadth.** Do not add a 8th jurisdiction until the existing 7 are fully populated. A stub jurisdiction damages the platform's credibility more than its absence.

---

## Section 5: Priority Matrix

| Item | Phase | Effort | Impact | Risk if Deferred |
|:-----|:------|:-------|:-------|:----------------|
| Real Authentication | 1 | Medium | Critical | Platform is compromisable today |
| Dead Code Consolidation | 1 | Low | High | Maintenance drift compounds |
| Decision OS Journey Completion | 1 | High | Critical | Primary journey has no outcome |
| Database Index Coverage | 1 | Low | High | Performance cliff at scale |
| Streaming AI Responses | 1 | Medium | High | Users perceive the platform as broken |
| Saudi Arabia + Qatar Modules | 1 | High | High | Platform cannot claim GCC coverage |
| PDF Background Queue | 1 | Medium | Medium | Thread exhaustion under load |
| Assessment Caching | 1 | Low | Medium | Unnecessary API cost accumulation |
| Multi-Tenancy | 2 | High | Critical | Cannot deploy to multiple departments |
| Workflow Engine | 2 | High | Critical | Platform remains a dead-end tool |
| Role-Differentiated Dashboard | 2 | Medium | High | Platform feels generic to every user |
| AI Feedback Loop | 2 | Low | High | Hallucinations have no correction path |
| Judicial Scenario Library | 2 | Medium | High | Coverage is too generic |
| AI Cost Dashboard | 2 | Medium | High | Blind API spend at scale |
| Semantic RAG Chunking | 2 | Medium | High | Retrieval quality degrades |
| Notification System | 2 | Medium | High | Workflows die without push communication |
| Citizen Portal | 3 | High | High | Platform serves officials only |
| E-Signature | 3 | High | Critical | Briefs cannot be legally filed |
| Regulatory Intelligence Feed | 3 | High | High | Legal corpus becomes stale |
| Blockchain Anchoring | 3 | Medium | Medium | On-chain verification adds trust but is not blocking |
| Precedent Matching | 3 | High | High | Transforms tool into legal intelligence |
| Voice Interface | 3 | High | Medium | Arabic-first accessibility multiplier |

---

*End of Architecture Report. This document supersedes all prior feature planning. No implementation should begin without a corresponding user journey defined in writing.*
