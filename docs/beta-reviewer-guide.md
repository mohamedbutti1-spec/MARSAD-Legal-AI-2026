# MARSAD — Private Beta Reviewer Guide

**Platform:** Intelligent Administrative Decision Platform  
**Access type:** Private (invited reviewers only)  
**Version:** v1.1 — JWT-secured private beta

---

## 1. Access

### URL
```
https://<deployment>.replit.app/?project-protection-bypass=<TOKEN>
```
> The access token and exact URL will be shared by the admin via a secure channel.
> **Keep this URL private — it contains your bypass token.**

### Two-layer security model
| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| 1 — Network gate | Replit external access token (in URL) | Blocks all anonymous traffic from reaching the app |
| 2 — Application auth | MARSAD JWT (username + password) | Role-scoped session; controls what you can see and do |

You must pass **both** layers to access the platform.

---

## 2. Reviewer accounts

Each reviewer is assigned a dedicated account matched to the role they are testing.

| Role | Username | Default password | Access level |
|------|----------|-----------------|--------------|
| Platform Owner / Admin | `admin` | `Admin@MARSAD2024` | Full access — all modules |
| Supervisor | `supervisor` | `Supervisor@MARSAD2024` | Create/mutate decisions |
| Judge | `judge` | `Judge@MARSAD2024` | Judicial modules (JRE, JDC) |
| Minister | `minister` | `Minister@MARSAD2024` | NAIP minister dashboard |
| Undersecretary | `undersecretary` | `Undersec@MARSAD2024` | NAIP undersecretary view |
| Director General | `dir_general` | `DirGeneral@MARSAD2024` | NAIP director-general view |
| Viewer (read-only) | `viewer` | `Viewer@MARSAD2024` | Read-only access |
| Risk Officer | `risk_officer` | `RiskOfficer@MARSAD2024` | Risk engine |
| Citizen Portal | `citizen` | `Citizen@MARSAD2024` | Public-facing portal only |

> If you need a role not listed here or need credentials reset, contact the admin.

---

## 3. Signing in

1. Open the reviewer URL (including `?project-protection-bypass=…`).
2. The MARSAD login page appears.
3. Enter your assigned **Username** and **Password**.
4. Click **تسجيل الدخول / Sign In**.
5. Your session persists for **8 hours** in a secure `HttpOnly` cookie. Closing and reopening the tab keeps you signed in.
6. To sign out: click your role badge in the top-right header → **Logout**.

---

## 4. Submitting feedback

A floating **amber chat button** is pinned to the bottom-right corner of every page.

### Feedback form fields

| Field | Options | Guidance |
|-------|---------|---------|
| **Category** | Bug · UI/UX · Performance · Feature Request · Security · Content/Data · Other | Pick the closest fit |
| **Severity** | Low · Medium · High · Critical | Use Critical only for data loss, security holes, or complete blockers |
| **Description** | Free text (min 5 chars) | Describe what happened, what you expected, and reproduction steps |

The form auto-captures:
- **Page path** — current URL within the app  
- **Browser info** — user-agent + viewport size (for reproduction)
- **Your role** — from your JWT session

Click **Submit Feedback** → confirmation appears → form resets.

### Severity guide

| Level | Use when |
|-------|---------|
| 🔴 Critical | Platform unusable, data corruption, security vulnerability exposed |
| 🟠 High | Major feature broken, significant UX blocker, misleading data |
| 🟡 Medium | Feature partially broken, confusing flow, missing validation |
| ⬜ Low | Minor copy errors, cosmetic issues, minor UX improvements |

---

## 5. Scope of review

### In scope ✅
- All 10 platform modules listed in the navigation
- End-to-end decision workflows (create → stage progression → seal)
- Role-specific dashboards (NAIP executive views)
- AI engines: JRE, JDC, ADKG 16-pillar, CIL, PCS, PGF, SPG
- Knowledge Base search and cross-reference traversal
- PDF export and audit trail
- Mobile responsiveness (test on phone/tablet if available)
- Arabic / English language consistency

### Out of scope ❌
- Performance under concurrent load (this is a single-user beta)
- Email notifications (not yet implemented)
- Third-party integrations beyond what's visible in the UI

---

## 6. Known limitations (beta)

- **Demo accounts only** — no real-user accounts provisioned yet
- **AI responses** use `claude-3-7-sonnet` with real Anthropic API calls — outputs are real but the underlying data is seeded/synthetic
- **Audit log** records all actions; reviewer activity will appear in production audit trails after final deployment
- The `department_director` role does not yet have a dedicated NAIP executive dashboard (deferred to v2)

---

## 7. Contact

Submit in-app feedback via the amber button. For urgent issues or account problems, contact the platform administrator directly.

---

*This document is confidential. Do not share the reviewer URL or credentials outside the review team.*
