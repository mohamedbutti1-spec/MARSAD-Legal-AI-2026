# MARSAD — Product Architecture Report
## Government AI Legal Platform · Senior Architect Review
**Date:** 3 July 2026
**Prepared by:** Platform Architecture Review
**Classification:** Internal Product Planning
**Scope:** Full-stack audit — Frontend, API, Database, AI Layer, UX Flows, Legal Logic
**Governing Standard:** MARSAD Constitutional Standard v1.0

---

## Executive Summary

MARSAD is an institutional-grade AI platform for the complete lifecycle of the Intelligent Administrative Decision, built on the M. Al-Shamsi Framework™. The platform has achieved a strong foundation — a working AI assessment engine, bilingual PDF court packages, SHA-256 audit trail, and a coherent design system — but it is currently a **collection of capable features rather than a cohesive product**.

The critical gaps fall into four categories:

1. **Identity & Trust** — The platform operates on header-spoofable roles with no real authentication. For an institutional AI platform this is a structural risk, not a feature gap.
2. **Jurisdictional Coverage** — 5 of 7 GCC modules are empty stubs. The platform claims regional authority it does not yet have.
3. **User Journey Completeness** — Multiple journeys reach a terminal point (a PDF, a report) with no next step — no sharing, no appeals, no escalation, no downstream action.
4. **Platform Hygiene** — Legacy routes, duplicated pages, unindexed foreign keys, and a CORS policy open to all origins represent accumulated technical debt that will compound at scale.

---

## Mission

To make Intelligent Administrative Decisions more lawful, transparent, explainable, accountable and governable through a measurable legal framework.

---

## Constitutional Rule No. 1

MARSAD shall never adapt the law to fit Artificial Intelligence.
Artificial Intelligence shall always be adapted to fit the law.

---

## Framework Governance

| Field | Value |
|:------|:------|
| **Framework** | The M. Al-Shamsi Framework™ |
| **Status** | Research Framework |
| **Validation** | Under Continuous Academic Review |
| **Version** | 1.0 |
| **Maintained by** | MARSAD Research Team |

The M. Al-Shamsi Analytical Model is one analytical engine inside MARSAD. The platform is not defined by the theory — the theory powers the analysis engine only.

---

## Constitutional Acceptance Criteria

Every module within MARSAD shall satisfy **all** of the following criteria before release. Acceptance is constitutional — not numerical.

| Criterion | Description |
|:----------|:------------|
| Legal Value | Output directly serves the administrative decision lifecycle |
| Institutional Readiness | Suitable for presentation to a ministry, court, or oversight authority |
| Transparency | All AI reasoning is visible, auditable, and documented |
| Explainability | AI output is expressible in legal language a judge can act upon |
| Human Oversight | AI supports human judgment; every output has a named human author |
| Due Process | Procedural rights of affected parties are recognised and protected |
| Accountability | Every action is permanently attributed, timestamped, and immutable |
| Proportionality | Every decision is measured against proportionality of means to purpose |
| Judicial Reviewability | Every output remains subject to full review, appeal, and judicial oversight |
| Continuous Legitimacy | Legitimacy is measured permanently, not once at a threshold |

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
| Constitutional Principles Page | ✅ Complete (v1.0) |

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
| M-07 | **Data Retention Policy Engine** | No mechanism for scheduled deletion, archiving, or data expungement — a legal requirement for institutional platforms. |
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
| U-01 | **Decision OS — Terminal Dead End** | The journey ends at PDF download. There is no: Share to supervisor → Request review → File appeal → Track outcome. | Critical |
| U-02 | **No Role-Differentiated Dashboard** | Every user sees the same dashboard regardless of role. | High |
| U-03 | **No Onboarding Flow** | New government users land directly in a complex interface with no orientation or contextual help. | High |
| U-04 | **Settings Page Handles API Keys in Plaintext UI** | API keys (Claude, Perplexity) are editable through a standard form. | High |

#### IMPORTANT
| # | Flow | Problem |
|:--|:-----|:--------|
| U-05 | **Legal Research — No Result Ranking Signal** | Search returns results with no visible relevance score, recency weighting, or source authority indicator. |
| U-06 | **No Session History / Resume Flow** | Users cannot see past Decision OS sessions, resume incomplete ones, or compare two assessments over time. |
| U-07 | **No Inline Feedback Mechanism** | No way for a user to flag an AI assessment as incorrect, incomplete, or hallucinated. No correction loop. |
| U-08 | **Literature Review Has No Export** | The literature review generates analysis but offers no export to PDF, Word, or citation format. |
| U-09 | **Document Comparison Has No Annotation Layer** | Users can compare two documents but cannot annotate differences, flag clauses, or add commentary. |
| U-10 | **Personal Library Has No Folders / Collections** | Tags exist but no hierarchical organization. |

---

### 2.3 Duplicate Functionality

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

---

### 2.4 Missing Legal Workflows

| # | Workflow | Priority |
|:--|:---------|:---------|
| W-01 | **Administrative Decision Appeals** | Critical |
| W-02 | **Internal Legal Opinion Request** | Critical |
| W-03 | **Supervisor Review / Brief Endorsement** | Critical |
| W-04 | **Regulatory Compliance Audit** | High |
| W-05 | **Cross-Department Consultation** | High |
| W-06 | **Legislative Amendment Tracking** | High |
| W-07 | **Public Procurement Legal Review** | Important |
| W-08 | **Employment / Civil Service Dispute** | Important |
| W-09 | **Disciplinary Committee Proceeding** | Important |
| W-10 | **Contract Lifecycle Management** | Future |

---

### 2.5 Missing AI Capabilities

| # | Capability | Gap |
|:--|:-----------|:----|
| A-01 | **Streaming Responses** | Decision OS interview + assessment do not stream |
| A-02 | **Assessment Caching** | Identical fact patterns re-run full Claude inference |
| A-03 | **AI Feedback / Correction Loop** | No mechanism to flag hallucinations or incorrect citations |
| A-04 | **Multi-Document Synthesis** | Max 2 documents; legal analysis often requires 5–10 |
| A-05 | **Automatic AR↔EN Translation** | Cannot translate found texts in-platform |
| A-06 | **Legal Entity Extraction (NER)** | No extraction of parties, dates, provision numbers |
| A-07 | **Precedent Matching Engine** | No factually-similar case retrieval |
| A-08 | **Contradiction Detection** | No detection of conflict between cited instruments |
| A-09 | **Risk Scoring / Probability** | No quantitative litigation risk score |
| A-10 | **Voice Input for Interviews** | Text-only; Arabic voice input not available |
| A-11 | **Semantic Document Chunking** | Basic 500-word fixed chunks — destroys legal article structure |
| A-12 | **Jurisdiction Auto-Detection** | Manual jurisdiction selection; AI should detect from document |

---

### 2.6 Missing Judicial Scenarios

| # | Scenario | Jurisdiction |
|:--|:---------|:------------|
| J-01 | Digital / AI-Generated Decision Challenge | UAE |
| J-02 | Algorithmic Bias Claim in Government Service | UAE / EU |
| J-03 | Emergency Administrative Decision (Crisis Powers) | UAE |
| J-04 | Cross-Border Administrative Decision | Multi-jurisdiction |
| J-05 | Government Employee Termination Appeal | UAE |
| J-06 | Public Land / Property Expropriation | UAE |
| J-07 | Business License Revocation | UAE |
| J-08 | Environmental Compliance Enforcement | UAE |
| J-09 | Data Protection Breach Response | UAE |
| J-10 | Diwan al-Mazalim Administrative Complaint | Saudi Arabia |
| J-11 | French Administrative Court (CAA) Appeal | France |
| J-12 | EU AI Act Compliance Assessment | EU / Multi |

---

### 2.7 Missing Government User Journeys

| # | Persona | Journey | Status |
|:--|:--------|:--------|:-------|
| G-01 | **Department Head** | Review subordinate's brief → Add comments → Approve or return → Issue signed final brief | Missing |
| G-02 | **Ministry Legal Counsel** | Receive legal opinion request → Research → Draft → Route for senior review → Publish internally | Missing |
| G-03 | **Policy Analyst** | Upload draft regulation → AI impact assessment → Conflict detection → Recommendation report | Missing |
| G-04 | **Compliance Officer** | Schedule quarterly audit → AI-generated checklist → Upload evidence → Generate certificate | Missing |
| G-05 | **New Government Employee** | Onboarding → Guided tour → First Decision OS session with walkthrough | Missing |
| G-06 | **Senior Legal Advisor** | View all assessments across department → Filter by risk level → Export aggregate report | Missing |
| G-07 | **Secretary General** | System-wide KPIs → Decision velocity → Compliance rates → AI cost per department | Missing |
| G-08 | **IT Administrator** | Manage user accounts → Set data retention policies → Monitor system health | Partial |

---

### 2.8 Missing Administration Tools

| # | Tool | Impact |
|:--|:-----|:-------|
| AD-01 | **AI Cost Dashboard** | No visibility into Claude API spend per user, feature, or department |
| AD-02 | **System Health Monitor** | No uptime, response time, error rate, or queue depth visibility |
| AD-03 | **Bulk Legal Source Import** | Cannot onboard a new jurisdiction's full legal corpus efficiently |
| AD-04 | **Permission Matrix Editor** | Admins cannot adjust role permissions without code changes |
| AD-05 | **Notification Configuration** | No email templates, notification triggers, or delivery preferences |
| AD-06 | **Scheduled Report Delivery** | No auto-generated daily/weekly compliance reports to supervisors |
| AD-07 | **RAG Index Management** | Admins cannot inspect the vector index, re-index a document, or clear stale chunks |
| AD-08 | **API Rate Limit Manager** | Differentiated rate limits per user tier are not possible |
| AD-09 | **Data Export / Portability** | `export.ts` route exists but is untested; no UI surface |
| AD-10 | **Feature Flag System** | New features cannot be toggled on per-department without a deployment |

---

### 2.9 Performance Issues

| # | Issue | Location | Risk |
|:--|:------|:---------|:-----|
| P-01 | **No database indexes on foreign keys** | `lib/db/src/schema/*` | Full table scans on joins at scale |
| P-02 | **Fixed 500-word RAG chunking** | `api-server/src/utils/rag.ts` | Legal article boundaries ignored |
| P-03 | **Synchronous PDF generation** | `utils/admin-brief-pdf.ts` | Blocks HTTP request thread for 3–8 seconds |
| P-04 | **No response caching layer** | Entire API | Identical queries re-run full vector search + LLM inference |
| P-05 | **CORS allows all origins** | `app.ts` | Security posture blocks compliance certification |
| P-06 | **No connection pool configuration** | `lib/db/src/index.ts` | Default pool may exhaust connections under concurrent load |
| P-07 | **No CDN / static asset caching** | Legal source documents | Large PDFs re-served from API server on every request |
| P-08 | **Rate limiter is global (15/min AI)** | `routes/ai.ts` | Power user exhausts limit and blocks all others |
| P-09 | **Chat history loaded in full** | `routes/assistant.ts` | No pagination for long sessions |
| P-10 | **No background job queue** | Entire API | Long-running tasks run in the request cycle |

---

## Section 3: Roadmap

---

### ◼ PHASE 1 — Critical Foundation (8–12 weeks)

**Principle:** Fix what breaks at the seams before adding what shines at the surface.

1. **Real Authentication** — Replace header spoofing with session-based auth
2. **Dead Code Consolidation** — Delete 9 legacy pages, remove 8 route aliases
3. **Decision OS Journey Completion** — Add post-brief flow: share → supervisor review → endorsement → signed final
4. **Database Index Coverage** — FK indexes on all join columns before any scale
5. **Saudi Arabia + Qatar Modules** — The two largest GCC legal systems must be complete
6. **Streaming AI Responses** — Decision OS cannot ask users to wait 40 seconds in silence
7. **PDF Background Queue** — Move Puppeteer off the request thread
8. **Assessment Caching** — Hash inputs, cache 24h, eliminate redundant Claude calls

---

### ◼ PHASE 2 — Important Capabilities (12–20 weeks)

**Principle:** Add the workflow layers, AI depth, and user journeys that make the platform indispensable.

1. Multi-Tenancy / Organization Model
2. Legal Workflow Engine (brief endorsement, opinion request, compliance audit, appeal)
3. Role-Differentiated Dashboard
4. Judicial Scenario Library — Phase 1 (9 new scenario types)
5. AI Feedback & Correction Loop
6. Multi-Document Synthesis
7. Semantic RAG Chunking
8. AI Cost & Usage Dashboard
9. Department Head + Legal Counsel Journeys
10. Remaining GCC Modules (BH, KW, OM)
11. Notification System
12. PDF Enhancements — Cover Page + Table of Contents

---

### ◼ PHASE 3 — Future Vision (20–36 weeks)

**Principle:** Platform network effects, citizen access, and institutional knowledge accumulation.

1. Citizen-Facing Portal
2. E-Signature Integration
3. Regulatory Intelligence Feed
4. Blockchain Brief Anchoring
5. Precedent Matching Engine
6. Voice Interface for Interviews (Arabic-first)
7. Executive Intelligence Layer (Secretary General view)
8. Data Retention & Expungement Engine
9. Jurisdiction Auto-Detection
10. MARSAD Certification Program

---

## Section 4: Architecture Principles for All Future Work

Every improvement must answer: **"Does this make the Intelligent Administrative Decision more lawful, transparent, explainable, or governable?"**

1. **Journey-first, feature-second.** No capability without a defined end-to-end journey.
2. **No new legacy.** Every new page replaces or extends an existing canonical page.
3. **Security by default.** All routes authenticated. All tables scoped to `organization_id`. All AI outputs logged.
4. **Streaming as standard.** All new AI endpoints stream. Synchronous AI responses are not acceptable.
5. **Audit everything.** Every state change is recorded in `audit_logs` with actor, timestamp, and before/after state.
6. **Arabic first.** All new UI is designed in Arabic and adapted to English, not the reverse.
7. **Jurisdiction completeness before breadth.** Do not add an 8th jurisdiction until the existing 7 are fully populated.

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
| Blockchain Anchoring | 3 | Medium | Medium | On-chain verification adds trust |
| Precedent Matching | 3 | High | High | Transforms tool into legal intelligence |
| Voice Interface | 3 | High | Medium | Arabic-first accessibility multiplier |

---

*MARSAD Constitutional Standard v1.0 · M. Al-Shamsi Framework™ · MARSAD Research Team*
*This document supersedes all prior feature planning. No implementation begins without a corresponding user journey defined in writing.*
