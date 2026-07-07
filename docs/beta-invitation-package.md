# MARSAD — Private Beta Reviewer Invitation Package

> **CONFIDENTIAL — INVITED REVIEWERS ONLY**  
> Do not forward, screenshot, or share this document outside the named review team.

**Platform:** MARSAD — منصة القرارات الإدارية الذكية  
**Release:** v1.1 — Private Beta  
**Date:** 7 July 2026  
**Access type:** Invitation-only. Two-layer authentication required.

---

## 1. Private Beta URL

```
https://<DEPLOYMENT_DOMAIN>/?project-protection-bypass=<BYPASS_TOKEN>
```

> **Admin action required before distribution:**  
> 1. Publish the project on Replit (Publishing → set visibility to **Private** → Publish).  
> 2. After the deployment is live, go to **Publishing → Adjust settings → Security → External access tokens** → create a token for the **Production** environment.  
> 3. Replace `<DEPLOYMENT_DOMAIN>` with the assigned `.replit.app` domain.  
> 4. Replace `<BYPASS_TOKEN>` with the token shown at creation (shown once — store it securely).  
> 5. Send each reviewer their individual copy of this document with the completed URL.

### How the two-layer security works

| Layer | Mechanism | What it does |
|-------|-----------|--------------|
| **1 — Network gate** | Replit external access token (in URL) | Blocks all anonymous internet traffic from reaching the app |
| **2 — Application auth** | MARSAD JWT cookie (username + password) | Role-scoped session with 8-hour expiry; enforced server-side |

Both layers must be passed to access any part of the platform. A reviewer who loses the URL cannot reach the login page. A reviewer who has the URL but wrong credentials cannot enter the platform.

---

## 2. Test Login Credentials

Each reviewer is assigned one account matched to the role they are evaluating. Use only your assigned account.

| Reviewer role | Username | Password | Access level |
|---------------|----------|----------|--------------|
| Platform Owner / Admin | `admin` | `Admin@MARSAD2024` | Full access — all modules, feedback admin |
| Supervisor | `supervisor` | `Supervisor@MARSAD2024` | Create and mutate decisions; all stages |
| Viewer (read-only) | `viewer` | `Viewer@MARSAD2024` | Read-only across all modules |
| Judge | `judge` | `Judge@MARSAD2024` | Judicial modules: JRE, JDC, ADKG |
| Minister | `minister` | `Minister@MARSAD2024` | NAIP minister executive dashboard |
| Undersecretary | `undersecretary` | `Undersec@MARSAD2024` | NAIP undersecretary view |
| Assistant Undersecretary | `asst_undersec` | `AsstUndersec@MARSAD2024` | NAIP assistant-undersecretary view |
| Director General | `dir_general` | `DirGeneral@MARSAD2024` | NAIP director-general view |
| Department Director | `dept_director` | `DeptDir@MARSAD2024` | NAIP department-level view |
| Legal Department | `legal_dept` | `LegalDept@MARSAD2024` | Legal review, knowledge base |
| Constitutional Reviewer | `const_reviewer` | `ConstRev@MARSAD2024` | Constitutional analysis, CIL |
| Internal Auditor | `int_auditor` | `IntAudit@MARSAD2024` | Audit trail, evidence ledger |
| External Auditor | `ext_auditor` | `ExtAudit@MARSAD2024` | Read audit trail, chain of custody |
| Citizen / Affected Party | `citizen` | `Citizen@MARSAD2024` | Public-facing portal, decision transparency |

> **Sessions last 8 hours.** Closing and reopening the browser tab keeps you signed in. To sign out, click your role badge in the top-right header → **Logout**.

---

## 3. دليل المراجع — Short Reviewer Guide (Arabic)

---

### مرحباً بك في النسخة التجريبية الخاصة من منصة مرصاد

منصة **مرصاد** هي منصة ذكاء اصطناعي متخصصة في دعم القرارات الإدارية الحكومية وفق المنظومة القانونية لدولة الإمارات العربية المتحدة.

---

### كيفية الوصول إلى المنصة

1. افتح الرابط الخاص بك (يحتوي الرابط على رمز الوصول — لا تشاركه).
2. ستظهر لك صفحة تسجيل الدخول.
3. أدخل **اسم المستخدم** و**كلمة المرور** المخصصَين لك.
4. اضغط على زر **تسجيل الدخول**.
5. تبقى جلستك نشطة لمدة **8 ساعات**. يمكنك إغلاق المتصفح وإعادة فتحه دون الحاجة لتسجيل الدخول مجدداً.
6. لتسجيل الخروج: اضغط على شارة دورك في أعلى يمين الشاشة ← **Logout**.

---

### الوحدات الرئيسية في المنصة

| الوحدة | الوصف |
|--------|-------|
| **القرارات الإدارية** | إنشاء القرارات وإدارة مراحلها وختمها رقمياً |
| **محرك التفكير القضائي (JRE)** | تحليل قانوني مدعوم بالذكاء الاصطناعي لدعم القضاة |
| **غرفة المداولة القضائية (JDC)** | محاكاة هيئة قضائية متعددة القضاة للبت في القضايا |
| **محلل الأعمدة الستة عشر (ADKG)** | تقييم القرارات وفق 16 ركيزة قانونية وذكاء اصطناعي |
| **طبقة الذكاء الدستوري (CIL)** | مراجعة دستورية مبنية على 12 مبدأً دستورياً |
| **قاعدة المعرفة القانونية (KB)** | بحث في التشريعات والسوابق القضائية الإماراتية |
| **محرك نمذجة المخاطر (NRME)** | تقييم المخاطر الوطنية وتصنيف الأولويات |
| **منصة الاستخبارات الإدارية (NAIP)** | لوحات تحكم تنفيذية للوزراء وكبار المسؤولين |
| **دليل التوجيه المهني (PGF + SPG)** | توجيه الممارسين القانونيين في 20 مهنة |
| **محاكي القضايا (PCS)** | تدريب تفاعلي على السيناريوهات الإدارية |

---

### ما الذي نطلب منك تقييمه؟

- **الوظائف الأساسية:** هل تعمل الأدوات كما هو متوقع؟
- **تجربة المستخدم:** هل واجهت صعوبات في التنقل أو استخدام الواجهة؟
- **دقة المحتوى:** هل الترجمات العربية والإنجليزية دقيقة ومتسقة؟
- **الأداء:** هل تلاحظ بطئاً أو توقفاً في أي مرحلة؟
- **الأمان:** هل يمكنك الوصول إلى بيانات أو وظائف تتجاوز صلاحية دورك؟

---

### إرسال ملاحظاتك

ابحث عن **الزر العنبري العائم** في أسفل يمين كل صفحة. اضغط عليه لفتح نموذج الملاحظات وإرسال تقريرك مباشرةً إلى فريق التطوير.

---

### تنبيه مهم

🔒 **هذا الرابط وبيانات الدخول سرية للغاية. لا تشاركها مع أي شخص خارج فريق المراجعة.**

---

## 4. Feedback Form Instructions

### How to submit feedback

An **amber circular button** is pinned to the bottom-right corner of every authenticated page. Click it to open the feedback form.

### Form fields

| Field | Options | How to fill |
|-------|---------|-------------|
| **Category** | Bug · UI/UX · Performance · Feature Request · Security · Content / Data · Other | Select the closest match |
| **Severity** | Low · Medium · High · Critical | See severity guide below |
| **Description** | Free text (minimum 5 characters) | State what happened, what you expected, and exact reproduction steps |

The form automatically captures:
- **Current page path** — the exact page you were on when you opened the form
- **Your reviewer role** — from your authenticated session
- **Browser info** — user-agent and viewport (for reproduction by the dev team)

Click **Submit Feedback** → a confirmation appears → the form resets. You can submit as many reports as needed.

### Severity guide

| Level | Use when |
|-------|---------|
| 🔴 **Critical** | Platform is completely unusable, data is corrupted or lost, a security vulnerability is exposed, or another user's data is visible |
| 🟠 **High** | A primary feature is broken or produces wrong results, a major UX blocker exists, or data shown is clearly incorrect |
| 🟡 **Medium** | A feature works partially but with errors, a flow is confusing, or validation is missing |
| ⬜ **Low** | Minor copy errors, cosmetic defects, minor UX polish suggestions |

### Tips for useful bug reports

- **Be specific about reproduction steps.** "It crashes" is not actionable. "I clicked Save on a decision with 3 interview answers, then navigated back, and the answers were lost" is.
- **Note your role.** Some bugs are role-specific. Your role is always captured automatically, but mentioning it in the description speeds up investigation.
- **Submit one issue per report.** Do not bundle multiple problems into one form submission.
- **For security concerns:** use Category = Security and Severity = Critical. The dev team is notified immediately.

---

## 5. Known Limitations (Beta)

These are documented constraints, not bugs. Do not raise them as issues.

| Area | Limitation |
|------|-----------|
| **Accounts** | All 14 accounts are demo accounts with seeded data. No real user data is present. |
| **AI outputs** | All AI engines (`claude-3-7-sonnet`) make real API calls and produce real analysis, but the underlying decisions, documents, and cases are synthetic test data. Do not treat AI outputs as legal advice. |
| **Department Director NAIP dashboard** | The `dept_director` role does not yet have a dedicated executive dashboard. Navigating to the NAIP executive section returns a 400 response. Deferred to v2.0. |
| **Email notifications** | Not yet implemented. No outbound emails are sent by any action in this beta. |
| **Concurrent load** | This is a single-user beta. Performance under simultaneous multi-user load has not been tested. |
| **PDF export** | The export feature produces real PDFs. Exported files contain synthetic data — do not use them outside the review context. |
| **Audit trail** | All reviewer actions are recorded in the audit trail. Reviewer activity will appear in production audit records after final deployment — this is expected and intentional. |
| **Demo credentials in login UI** | The login page includes a collapsible "Demo accounts" panel pre-filled with credentials. This is intentional for review convenience and will be removed before customer hand-off. |
| **`xlsx` library CVEs** | Two known HIGH-severity CVEs (Prototype Pollution, ReDoS) exist in the `xlsx` dependency. These affect only the document import feature, not core platform functionality. Replacement with `exceljs` is scheduled for v1.2. |

---

## 6. Do-Not-Share Notice

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONFIDENTIAL — PRIVATE BETA

  This document, the reviewer URL, and the login credentials
  contained herein are strictly confidential and intended
  solely for the named reviewer.

  DO NOT:
  • Forward this document by email, messaging app, or any
    other channel to any person not on the review team
  • Post the URL, bypass token, or credentials publicly or
    in any shared workspace (Slack, Notion, GitHub, etc.)
  • Screenshot or screen-record credential fields
  • Share your session with another person (shared browser
    sessions bypass role isolation and contaminate audit logs)

  The reviewer URL contains a cryptographic bypass token.
  If this token is compromised, the private beta access gate
  can no longer be trusted. Report suspected leaks to the
  admin immediately.

  Violation of this notice may result in immediate revocation
  of beta access and removal from the review programme.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**تنبيه السرية — بالعربية**

هذه الوثيقة والرابط وبيانات الدخول سرية ومخصصة للمراجع المُسمَّى فقط. يُحظر مشاركة أي منها مع أي شخص خارج فريق المراجعة بأي وسيلة كانت. في حال الاشتباه في تسرب الرابط، يُرجى إخطار المسؤول فوراً.

---

## 7. Support & Contact

### In-app feedback (preferred)
Use the **amber button** at the bottom-right of every page. All submissions reach the dev team directly with full context (your role, the page, your browser).

### Urgent issues
For issues that block access entirely — you cannot log in, the bypass token does not work, the platform is down — contact the platform administrator through the secure channel used to deliver this document.

### What to include when contacting support
1. Your assigned reviewer role
2. Exact URL you were on (copy from the browser address bar)
3. What you did immediately before the problem
4. What you expected to happen
5. What actually happened (include any error text verbatim)
6. Screenshot if possible (blur any sensitive data)

### Response time
The review team monitors feedback continuously during the beta period. Expect a response within one business day for Medium/Low issues and same-day for Critical/High.

---

## Quick-reference card (print or pin)

| Item | Value |
|------|-------|
| **Beta URL** | `https://<DEPLOYMENT_DOMAIN>/?project-protection-bypass=<BYPASS_TOKEN>` |
| **Your username** | *(filled in by admin before sending)* |
| **Your password** | *(filled in by admin before sending)* |
| **Session length** | 8 hours |
| **Feedback button** | Amber circle, bottom-right of every page |
| **Urgent contact** | *(secure channel used to deliver this document)* |

---

*MARSAD v1.1 — Private Beta Invitation Package — 7 July 2026*  
*This document is confidential. Distribution outside the named review team is prohibited.*
