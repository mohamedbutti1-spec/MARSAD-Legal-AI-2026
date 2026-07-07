# MARSAD v1.0 — Field-Testing Checklist
**Release Branch:** `release/v1.0`  
**Tag:** `v1.0-certified`  
**Platform:** Intelligent Administrative Decision Platform (UAE)  
**Date:** 7 July 2026

---

## Instructions for Field Testers

Each tester is assigned a role and a set of test cases.  
For each case: complete the steps, observe the result, and mark **PASS** or **FAIL**.  
If FAIL, write a short description of what actually happened.  
Return completed checklists to the Release Manager.

**Login:** On the MARSAD platform, select your assigned role from the role picker in the top navigation bar.

**Support contact during field testing:** Release Manager / System Administrator

---

## Tester 1 — Judge

**Role:** `judge`  
**Module Focus:** Administrative Decision Lifecycle · JRE · JDC  
**Access Level:** Read all decisions, create JRE/JDC sessions, cannot create decisions

---

### T1-01 — View Administrative Decisions

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Log in as Judge. Navigate to **القرارات الإدارية** (Administrative Decisions) | List of decisions loads. Decision cards display reference number, subject, status, date | ☐ PASS ☐ FAIL | |
| 2 | Click on any decision card | Decision detail page opens. Shows all completed stage fields | ☐ PASS ☐ FAIL | |
| 3 | Verify "New Decision" button is **not visible** | Button should be absent for judge role | ☐ PASS ☐ FAIL | |
| 4 | Navigate to a decision at a stage not yet completed | Incomplete stage shows "pending" state. No data for future stages | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL (failures noted above)

---

### T1-02 — Judicial Reasoning Engine (JRE)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **محرك الاستدلال القضائي** (JRE) | Sessions list page loads. "New Session" button is visible | ☐ PASS ☐ FAIL | |
| 2 | Click "New Session". Select a decision from the dropdown. Select case type "Administrative". Submit | API returns immediately (< 2 seconds). Session appears in list with status "analyzing" | ☐ PASS ☐ FAIL | |
| 3 | Wait 30–90 seconds, then refresh the sessions list | Session status changes from "analyzing" to "complete" | ☐ PASS ☐ FAIL | |
| 4 | Click the completed session | Session detail shows: legal question, applicable articles, reasoning, conclusion | ☐ PASS ☐ FAIL | |
| 5 | Verify theory mode toggle (if present) | Switching theory mode changes reasoning display. No errors | ☐ PASS ☐ FAIL | |
| 6 | Create a second session using the same decision | Both sessions appear in list independently. No cross-contamination | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T1-03 — Judicial Deliberation Chamber (JDC)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **غرفة المداولة القضائية** (JDC) | Chambers list page loads | ☐ PASS ☐ FAIL | |
| 2 | Create a new chamber. Select a decision, panel configuration (3 judges), legal question. Submit | API returns immediately (< 2 seconds). Chamber appears with status "deliberating" | ☐ PASS ☐ FAIL | |
| 3 | Wait 60–120 seconds, then refresh | Chamber status becomes "complete". Shows majority ruling and dissenting opinions | ☐ PASS ☐ FAIL | |
| 4 | Open completed chamber | Shows each judge's vote, rationale, and final ruling synthesis. Vote IDs are unique | ☐ PASS ☐ FAIL | |
| 5 | Verify only your own chambers appear in the list | Another tester's chambers should not be visible | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T1-04 — ADKG 16-Pillar Analysis

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **ADKG** | Search page loads | ☐ PASS ☐ FAIL | |
| 2 | Search for any administrative term (e.g., "administrative decision") | Results list appears with relevant ADKG nodes | ☐ PASS ☐ FAIL | |
| 3 | Open a decision that has an ADKG analysis. View the 16-pillar tab | All 16 pillars are shown: 6 traditional + 10 AI pillars. Each has score and analysis | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

**TESTER 1 OVERALL: ☐ PASS ☐ FAIL**  
Tester name: ________________  Date: ________________  Signature: ________________

---
---

## Tester 2 — Prosecutor

**Role:** `legal_department`  
**Module Focus:** Knowledge Base · SPG · PGF · Administrative Decisions (read)  
**Access Level:** Read decisions, use all AI tools, cannot create decisions

---

### T2-01 — Knowledge Base Search

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **قاعدة المعرفة** (Knowledge Base) | KB Search page loads with search bar | ☐ PASS ☐ FAIL | |
| 2 | Search for "قانون الإجراءات الإدارية" (Administrative Procedures Law) | Results appear with title, source, relevance score | ☐ PASS ☐ FAIL | |
| 3 | Search for "federal decree" | English-language results appear | ☐ PASS ☐ FAIL | |
| 4 | Click on any result | Document detail page opens with full text, metadata, cross-references | ☐ PASS ☐ FAIL | |
| 5 | Search for a nonsense term (e.g., "zzznoresults") | Empty state shown gracefully. No error | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T2-02 — Smart Professional Guidance (SPG)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **الإرشاد المهني الذكي** (SPG) | Sector/role selection wizard loads | ☐ PASS ☐ FAIL | |
| 2 | Select sector: Legal. Select role: Legal Researcher. Submit | New guidance session created. Status "analyzing" | ☐ PASS ☐ FAIL | |
| 3 | Wait 30–60 seconds, refresh | Session status becomes "complete". Guidance output appears | ☐ PASS ☐ FAIL | |
| 4 | Verify guidance output contains: summary, recommended actions, relevant legislation | All three sections present | ☐ PASS ☐ FAIL | |
| 5 | Create a second session with a different sector (e.g., Administrative) | Both sessions are independent in the list | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T2-03 — Professional Guidance Framework (PGF)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **إطار التوجيه المهني** (PGF) | Profession catalogue loads | ☐ PASS ☐ FAIL | |
| 2 | Select profession: Legal Advisor. Start a new session | Session wizard appears. Stage 1 question is shown | ☐ PASS ☐ FAIL | |
| 3 | Answer each stage question and submit | Next stage advances after submission. Progress bar updates | ☐ PASS ☐ FAIL | |
| 4 | Complete all required stages | "Finalize" button becomes available | ☐ PASS ☐ FAIL | |
| 5 | Click "Finalize" | API returns 202 immediately. Status becomes "finalizing" | ☐ PASS ☐ FAIL | |
| 6 | Wait 30–60 seconds, refresh | Status becomes "complete". Assessment report is shown | ☐ PASS ☐ FAIL | |
| 7 | Attempt to finalize a session that is not fully completed | Error message shown: "not all stages completed". Session not finalized | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T2-04 — Citizen Role Isolation

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Switch role to **citizen** | Dashboard shows citizen-appropriate content | ☐ PASS ☐ FAIL | |
| 2 | Verify SPG, PGF, AI-fill chips are **not** visible on dashboard | Citizen sees only non-AI chips | ☐ PASS ☐ FAIL | |
| 3 | Verify "New Decision" button is absent | Not visible | ☐ PASS ☐ FAIL | |
| 4 | Navigate to **بوابة المواطن** (Citizen Portal) from sidebar | Citizen portal page loads correctly | ☐ PASS ☐ FAIL | |
| 5 | Switch back to Legal Department role | All AI tools visible again | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

**TESTER 2 OVERALL: ☐ PASS ☐ FAIL**  
Tester name: ________________  Date: ________________  Signature: ________________

---
---

## Tester 3 — Investigator / Decision Maker

**Role:** `supervisor`  
**Module Focus:** Decision Creation · Stage Lifecycle · Decision Replay · NRME  
**Access Level:** Full decision creation and management; all stages

---

### T3-01 — Create a New Administrative Decision

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Log in as Supervisor. Navigate to **القرارات** | "New Decision" button is visible | ☐ PASS ☐ FAIL | |
| 2 | Click "New Decision". Fill in: Title, Subject, Reference Number (UAE/YYYY/NNN format), Description | Form accepts all inputs | ☐ PASS ☐ FAIL | |
| 3 | Submit the form | Decision is created. Redirected to decision detail page. Stage 1 (Foundation) is active | ☐ PASS ☐ FAIL | |
| 4 | Verify DCI record is automatically created | "Decision Identity" or DCI section shows on detail page | ☐ PASS ☐ FAIL | |
| 5 | Verify audit trail shows "created" event | Audit log section (if visible) or governance audit shows creation event | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T3-02 — Stage Progression

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | With the new decision open, navigate to Stage 1 (Foundation). Fill all required fields. Save draft | Stage saved. Fields persist on refresh | ☐ PASS ☐ FAIL | |
| 2 | Click "Validate Stage" | AI validation runs. Result shown (pass/fail with details) | ☐ PASS ☐ FAIL | |
| 3 | If validation passes, click "Complete Stage" | Stage marked complete. Stage 2 becomes active | ☐ PASS ☐ FAIL | |
| 4 | Attempt to skip to Stage 3 without completing Stage 2 | System prevents it. Error: "complete current stage first" | ☐ PASS ☐ FAIL | |
| 5 | Complete Stage 2 and proceed to Stage 3 | Each stage advances correctly | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T3-03 — Decision Replay Engine

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Find a decision with several completed stages. Open the Replay tab | 14-stage timeline is shown. Completed stages have timestamps and descriptions | ☐ PASS ☐ FAIL | |
| 2 | Verify virtual stages are present (stages that have no manual input but appear in timeline) | Stage 3 (Context Scan), Stage 10 (Risk Signal), Stage 11 (Compliance Overlay) visible | ☐ PASS ☐ FAIL | |
| 3 | Verify timestamps are chronological | No out-of-order timestamps | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T3-04 — National Risk Modeling Engine (NRME)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **محرك نمذجة المخاطر** (Risk Engine) | Risk dashboard loads with NRI, ALI, DCS indicators | ☐ PASS ☐ FAIL | |
| 2 | View a decision that has had stages completed | Risk scores populate. Three aggregate scores are shown | ☐ PASS ☐ FAIL | |
| 3 | Verify risk categories are UAE government categories (9 total) | Category list matches UAE government risk taxonomy | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

**TESTER 3 OVERALL: ☐ PASS ☐ FAIL**  
Tester name: ________________  Date: ________________  Signature: ________________

---
---

## Tester 4 — Admin Decision Maker (Minister / Undersecretary)

**Role:** `undersecretary` (then also test as `minister`)  
**Module Focus:** NAIP · Governance Dashboard · Executive Overview  
**Access Level:** Governance read, NAIP org-scoped, no decision creation

---

### T4-01 — Executive Governance Dashboard

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Log in as Undersecretary. Navigate to **لوحة الحوكمة** | Governance dashboard loads. Shows KPIs: total decisions, sealed count, pending stages | ☐ PASS ☐ FAIL | |
| 2 | Verify compliance distribution chart | Chart shows full/partial/pending breakdown | ☐ PASS ☐ FAIL | |
| 3 | Switch role to **Minister** and reload governance page | Same governance dashboard loads. Data is consistent | ☐ PASS ☐ FAIL | |
| 4 | Verify "New Decision" button is **not present** on governance page | Ministers and Undersecretaries are read-only | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T4-02 — NAIP (National Administrative Intelligence Platform)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **NAIP** | NAIP dashboard loads. Org-scoped statistics are shown | ☐ PASS ☐ FAIL | |
| 2 | View the decisions page under NAIP | List of decisions scoped to this undersecretary's organization | ☐ PASS ☐ FAIL | |
| 3 | View risk heat map (if available) | Heat map or risk overview renders without error | ☐ PASS ☐ FAIL | |
| 4 | View constitutional compliance section | Compliance indicators shown for org decisions | ☐ PASS ☐ FAIL | |
| 5 | Navigate to NAIP Analytics | Analytics page loads. Charts and tables render | ☐ PASS ☐ FAIL | |
| 6 | Verify KPI values are non-null | All KPI cells show a value (number or "0"), not null or blank | ☐ PASS ☐ FAIL | |
| 7 | Switch role to **Minister** and re-test NAIP | Same NAIP pages load without error | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T4-03 — Constitutional Intelligence Layer (CIL)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to a decision that has a completed CIL assessment | CIL tab shows 12-principle evaluation | ☐ PASS ☐ FAIL | |
| 2 | Verify each principle shows: name, score, finding, citations | All four fields present per principle | ☐ PASS ☐ FAIL | |
| 3 | Verify overall constitutional compliance score is shown | Aggregate score is displayed | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

**TESTER 4 OVERALL: ☐ PASS ☐ FAIL**  
Tester name: ________________  Date: ________________  Signature: ________________

---
---

## Tester 5 — Auditor (Internal / External)

**Role:** `internal_auditor` (then also test as `external_auditor`)  
**Module Focus:** Audit Trail · Constitutional Memory · Chain of Custody  
**Access Level:** Read all governance data, audit logs; cannot create or modify decisions

---

### T5-01 — Audit Trail Access

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Log in as Internal Auditor. Navigate to any decision | Decision detail opens. Audit log / event timeline is visible | ☐ PASS ☐ FAIL | |
| 2 | Verify audit events include: creation, stage updates, validation events | All event types present for a decision with multiple completed stages | ☐ PASS ☐ FAIL | |
| 3 | Verify audit events are immutable (no edit/delete buttons) | Read-only view — no modification controls visible | ☐ PASS ☐ FAIL | |
| 4 | Navigate to governance audit log (if available at /governance or /audit) | Org-level audit log loads with paged events | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T5-02 — Chain of Custody

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to a decision and open the Chain of Custody tab | Timeline shows custody events with hash signatures | ☐ PASS ☐ FAIL | |
| 2 | Verify hash chain integrity indicator | "Verified" or green status shown. No broken chain indicator | ☐ PASS ☐ FAIL | |
| 3 | Attempt to access another user's decision by typing the URL directly with a different ID | Either 403 (no access) or 404 (not found). Never see another user's private data | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T5-03 — Evidence Ledger (if visible to auditor role)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to Evidence Ledger section | Evidence items listed for the decision | ☐ PASS ☐ FAIL | |
| 2 | Verify each evidence item shows: type, hash, timestamp, custody chain | All metadata fields visible | ☐ PASS ☐ FAIL | |
| 3 | Verify no add/edit/delete buttons present for auditor | Read-only — modification controls absent | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T5-04 — Cross-Role Permission Boundary

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | As Internal Auditor, attempt to POST to create a new decision (via developer tools or direct API call) | API returns 403 Insufficient Permissions | ☐ PASS ☐ FAIL | |
| 2 | Switch to **External Auditor** role. Verify same read access applies | Governance and audit data visible. No write controls | ☐ PASS ☐ FAIL | |
| 3 | Verify AI tool chips (SPG, PGF) are visible on dashboard (auditors are non-citizen professionals) | AI chips are accessible since `canUseAi = role !== 'citizen'` | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

**TESTER 5 OVERALL: ☐ PASS ☐ FAIL**  
Tester name: ________________  Date: ________________  Signature: ________________

---
---

## Tester 6 — Quality Manager

**Role:** `constitutional_reviewer`  
**Module Focus:** Constitutional Memory · CIL · JDT (Judicial Dimension Taxonomy)  
**Access Level:** Full read of all AI analyses; no decision creation

---

### T6-01 — Constitutional Memory

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Log in as Constitutional Reviewer. Navigate to a sealed decision | Decision shows as sealed. Sealed badge/indicator visible | ☐ PASS ☐ FAIL | |
| 2 | Open Constitutional Memory tab | Memory records are listed with principle mappings and timestamps | ☐ PASS ☐ FAIL | |
| 3 | Verify memory entries reference the correct decision | Each memory entry links to the expected decision | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T6-02 — Judicial Dimension Taxonomy (JDT)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **JDT** section | JDT dimensions list loads | ☐ PASS ☐ FAIL | |
| 2 | View a decision with a completed JDT analysis | 16 Shamsi dimensions are shown (فقه قضائي / judicial jurisprudence dimensions) | ☐ PASS ☐ FAIL | |
| 3 | Verify each dimension shows a score and narrative | All 16 dimensions have content | ☐ PASS ☐ FAIL | |
| 4 | Verify no duplicate decisions link appears in the sidebar when viewing JDT | Only one "/decisions" link visible in the sidebar | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T6-03 — CIL Warning Review

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to a decision with unresolved CIL warnings | Warnings listed under CIL tab | ☐ PASS ☐ FAIL | |
| 2 | Attempt to resolve a warning | Warning status updates. Resolve action is available for constitutional reviewer | ☐ PASS ☐ FAIL | |
| 3 | Verify resolved warning no longer appears in "unresolved" filter | Warning removed from unresolved view | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

**TESTER 6 OVERALL: ☐ PASS ☐ FAIL**  
Tester name: ________________  Date: ________________  Signature: ________________

---
---

## Tester 7 — Strategy Officer

**Role:** `director_general`  
**Module Focus:** Governance Overview · NAIP · NRME · Research Workspace · KB  
**Access Level:** All governance reads; AI tools; research workspace creation

---

### T7-01 — Research Workspace (KB-backed)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Log in as Director General. Navigate to **مساحة البحث** (Research Workspace) | Projects list loads | ☐ PASS ☐ FAIL | |
| 2 | Create a new research project. Give it a title and description | Project created. Appears in list | ☐ PASS ☐ FAIL | |
| 3 | Open the project. Add a research item (document, note, or query) | Item appears inside the project | ☐ PASS ☐ FAIL | |
| 4 | Open another user's project by guessing/typing a URL with a different project ID | 403 or 404 returned. Cannot access another user's workspace | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T7-02 — Cross-Jurisdiction KB Search

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to KB Search. Search for "Federal Supreme Court" | UAE case law results appear | ☐ PASS ☐ FAIL | |
| 2 | Search for "Cabinet Decision" | Legislation results appear (Cabinet Decisions seeded) | ☐ PASS ☐ FAIL | |
| 3 | Open a document. View cross-reference graph (if available) | Related legislation and citations shown | ☐ PASS ☐ FAIL | |
| 4 | Verify knowledge base returns results from UAE Case Law corpus | At least one result with collection type "uae_case_law" | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T7-03 — Governance Strategic View

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to Governance dashboard | KPIs: total decisions, seal rate, attention decisions visible | ☐ PASS ☐ FAIL | |
| 2 | View the "attention decisions" list | Shows decisions requiring intervention | ☐ PASS ☐ FAIL | |
| 3 | Navigate to NAIP → UAE Performance | National performance indicators render | ☐ PASS ☐ FAIL | |
| 4 | Verify all NAIP KPI values are non-null | No blank or null cells in any KPI table | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

### T7-04 — Professional Case Simulator (PCS)

| Step | Action | Expected Result | Pass / Fail | Notes |
|------|--------|-----------------|-------------|-------|
| 1 | Navigate to **PCS** (Professional Case Simulator) | Case selection or session start screen loads | ☐ PASS ☐ FAIL | |
| 2 | Start a new simulation session. Select a sector and scenario | Session created. First case stage shown | ☐ PASS ☐ FAIL | |
| 3 | Answer the first stage question | Next stage presented. Progress tracked | ☐ PASS ☐ FAIL | |
| 4 | Verify critical error is computed server-side (not self-reported) | No input for "did you make a critical error?" — it is derived | ☐ PASS ☐ FAIL | |

**Section Result:** ☐ PASS ☐ FAIL

---

**TESTER 7 OVERALL: ☐ PASS ☐ FAIL**  
Tester name: ________________  Date: ________________  Signature: ________________

---
---

## Summary Sheet — Return to Release Manager

| Tester | Role | Sections | Overall | Signature |
|--------|------|----------|---------|-----------|
| Tester 1 — Judge | `judge` | T1-01 T1-02 T1-03 T1-04 | ☐ PASS ☐ FAIL | |
| Tester 2 — Prosecutor | `legal_department` | T2-01 T2-02 T2-03 T2-04 | ☐ PASS ☐ FAIL | |
| Tester 3 — Investigator | `supervisor` | T3-01 T3-02 T3-03 T3-04 | ☐ PASS ☐ FAIL | |
| Tester 4 — Admin Decision Maker | `undersecretary` | T4-01 T4-02 T4-03 | ☐ PASS ☐ FAIL | |
| Tester 5 — Auditor | `internal_auditor` | T5-01 T5-02 T5-03 T5-04 | ☐ PASS ☐ FAIL | |
| Tester 6 — Quality Manager | `constitutional_reviewer` | T6-01 T6-02 T6-03 | ☐ PASS ☐ FAIL | |
| Tester 7 — Strategy Officer | `director_general` | T7-01 T7-02 T7-03 T7-04 | ☐ PASS ☐ FAIL | |

**Field-Testing Gate: All 7 testers must PASS before production deployment proceeds.**

---

*Checklist version: v1.0*  
*Generated: 7 July 2026*  
*Platform: MARSAD Intelligent Administrative Decision Platform*
