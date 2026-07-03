/**
 * Phase 5 — PDF Court Package Generator
 * Generates a bilingual (AR/EN) A4 PDF using Puppeteer/Chromium.
 * Falls back gracefully if Chromium is not yet available.
 */

import type { AdminDecisionBriefData, DimensionResult } from "./admin-os-evaluator";

interface SessionLike {
  id: number;
  decisionTypeAr: string | null;
  decisionTypeEn: string | null;
  role: string;
  jurisdiction: string;
  legalityScore: number | null;
  riskScore: number | null;
  canIssueToday: string | null;
  createdAt: Date;
}

const DIMENSION_META: Record<string, { ar: string; en: string }> = {
  jurisdiction:            { ar: "الاختصاص",                    en: "Jurisdiction" },
  cause:                   { ar: "السبب",                        en: "Cause" },
  form:                    { ar: "الشكل",                        en: "Form" },
  subjectMatter:           { ar: "المحل",                        en: "Subject Matter" },
  purpose:                 { ar: "الغاية",                       en: "Purpose" },
  humanWill:               { ar: "الإرادة البشرية",              en: "Human Will" },
  digitalWillFormation:    { ar: "تكوين الإرادة الرقمية",        en: "Digital Will Formation" },
  algorithmicWeight:       { ar: "الوزن الخوارزمي",              en: "Algorithmic Weight" },
  algorithmicBias:         { ar: "التحيز الخوارزمي",             en: "Algorithmic Bias" },
  explainability:          { ar: "قابلية التفسير",               en: "Explainability" },
  humanOversight:          { ar: "الرقابة البشرية",              en: "Human Oversight" },
  judicialReviewReadiness: { ar: "الجاهزية للمراجعة القضائية",   en: "Judicial Review Readiness" },
};

const DIMENSION_ORDER = [
  "jurisdiction", "cause", "form", "subjectMatter", "purpose",
  "humanWill", "digitalWillFormation", "algorithmicWeight",
  "algorithmicBias", "explainability", "humanOversight", "judicialReviewReadiness",
];

const ROLE_LABELS_AR: Record<string, string> = {
  government_official:  "المسؤول الحكومي",
  minister:             "الوزير",
  director_general:     "المدير العام",
  hr:                   "مسؤول الموارد البشرية",
  legal_department:     "الإدارة القانونية",
  administrative_court: "المحكمة الإدارية",
  citizen:              "المواطن / المتضرر",
};

const JURISDICTION_NAMES: Record<string, string> = {
  uae:     "دولة الإمارات العربية المتحدة",
  france:  "الجمهورية الفرنسية",
  gcc_sa:  "المملكة العربية السعودية",
  gcc_qa:  "دولة قطر",
  gcc_bh:  "مملكة البحرين",
  gcc_kw:  "دولة الكويت",
  gcc_om:  "سلطنة عُمان",
};

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function statusBadge(status: string): string {
  if (status === "compliant")     return `<span class="badge badge-green">ممتثل</span>`;
  if (status === "partial")       return `<span class="badge badge-amber">ممتثل جزئياً</span>`;
  if (status === "non-compliant") return `<span class="badge badge-red">غير ممتثل</span>`;
  return `<span class="badge badge-gray">غير محدد</span>`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#d97706";
  return "#dc2626";
}

function verdictConfig(canIssue: string | null): { text: string; bg: string; border: string; color: string } {
  if (canIssue === "yes")         return { text: "✓ يمكن إصدار القرار اليوم", bg: "#d1fae5", border: "#059669", color: "#065f46" };
  if (canIssue === "no")          return { text: "✗ لا يمكن إصدار القرار اليوم", bg: "#fee2e2", border: "#dc2626", color: "#991b1b" };
  if (canIssue === "conditional") return { text: "⚠ الإصدار مشروط بتصحيح الثغرات", bg: "#fef3c7", border: "#d97706", color: "#92400e" };
  return { text: "—", bg: "#f3f4f6", border: "#9ca3af", color: "#374151" };
}

function renderDimension(key: string, dim: DimensionResult, index: number): string {
  const meta = DIMENSION_META[key] ?? { ar: key, en: key };
  const sc = scoreColor(dim.score ?? 0);
  const missing = (dim.missingRequirements ?? []).length > 0
    ? `<div class="missing-list"><strong>المتطلبات الناقصة:</strong><ul>${(dim.missingRequirements ?? []).map(r => `<li>${escHtml(r)}</li>`).join("")}</ul></div>`
    : "";
  const laws = (dim.applicableLaw ?? []).length > 0
    ? `<div class="law-list"><strong>المواد القانونية:</strong> ${escHtml((dim.applicableLaw ?? []).join(" ، "))}</div>`
    : "";
  return `
<div class="section dim-card" id="dim-${index}">
  <div class="dim-header">
    <div>
      <span class="dim-num">${index}</span>
      <strong>${escHtml(meta.ar)}</strong>
      <span style="font-size:9pt;color:#6b7280;margin-right:0.3cm;">${escHtml(meta.en)}</span>
      ${statusBadge(dim.status ?? "unknown")}
    </div>
    <div style="font-size:22pt;font-weight:bold;color:${sc};">${dim.score ?? 0}<span style="font-size:10pt;color:#9ca3af;">/100</span></div>
  </div>
  <p class="dim-explanation">${escHtml(dim.explanationAr)}</p>
  ${missing}
  ${laws}
</div>`;
}

function buildToc(brief: AdminDecisionBriefData): string {
  const sections = [
    "الملخص التنفيذي",
    ...DIMENSION_ORDER.map((k, i) => `${i + 2}. ${DIMENSION_META[k]?.ar ?? k}`),
    "التشريعات المنطبقة",
    "السوابق القضائية",
    "قائمة المستندات المطلوبة",
    "السلطة الحكومية المختصة",
    "الجدول الزمني",
    "استراتيجية الطعن والاستئناف",
    "شرح الخوارزمية ونقاط التدخل البشري",
  ];
  return sections.map((s, i) => `<tr><td>${i + 1}</td><td>${escHtml(s)}</td></tr>`).join("");
}

function buildHtml(session: SessionLike, brief: AdminDecisionBriefData, briefHash: string): string {
  const roleAr = ROLE_LABELS_AR[session.role] ?? session.role;
  const jurisdictionNameAr = JURISDICTION_NAMES[session.jurisdiction] ?? session.jurisdiction;
  const vc = verdictConfig(session.canIssueToday);
  const legalityScore = session.legalityScore ?? 0;
  const riskScore = session.riskScore ?? 0;
  const dateStr = new Date(session.createdAt).toLocaleDateString("ar-AE");
  const hashShort = briefHash.slice(-8);

  const dimensionSections = DIMENSION_ORDER.map((key, i) => {
    const dim = (brief as unknown as Record<string, unknown>)[key] as DimensionResult | undefined;
    if (!dim) return "";
    return renderDimension(key, dim, i + 2);
  }).join("\n");

  const legislation = (brief.applicableLegislation ?? []).map(item =>
    `<tr><td>${escHtml(item.token ?? "")}</td><td>${escHtml(item.articleAr)}</td><td>${escHtml(item.relevanceAr)}</td></tr>`
  ).join("") || `<tr><td colspan="3" style="color:#9ca3af;text-align:center;">لا توجد تشريعات مُدرجة</td></tr>`;

  const precedents = (brief.courtPrecedents ?? []).map(p =>
    `<tr><td>${escHtml(p.caseRef)}</td><td>${escHtml(p.courtAr)}</td><td>${escHtml(p.yearAr)}</td><td>${escHtml(p.principleAr)}</td></tr>`
  ).join("") || `<tr><td colspan="4" style="color:#9ca3af;text-align:center;">لا توجد سوابق قضائية مُدرجة</td></tr>`;

  const docs = (brief.requiredDocuments ?? []).map(d =>
    `<div class="doc-item">
      <div class="checkbox"></div>
      <div><strong>${escHtml(d.nameAr)}</strong>${d.mandatory ? ' <span class="badge badge-red" style="font-size:8pt;">إلزامي</span>' : ''}
        <p style="font-size:9pt;color:#6b7280;margin-top:0.1cm;">${escHtml(d.descriptionAr)}</p>
      </div>
    </div>`
  ).join("") || `<p style="color:#9ca3af;">لم تُحدَّد مستندات</p>`;

  const auth = brief.governmentAuthority;
  const authHtml = auth ? `
    <table>
      <tr><th>الجهة الحكومية</th><td>${escHtml(auth.nameAr)} (${escHtml(auth.nameEn)})</td></tr>
      <tr><th>القسم</th><td>${escHtml(auth.department)}</td></tr>
      <tr><th>الأساس القانوني</th><td>${escHtml(auth.competenceBasis)}</td></tr>
      ${auth.website ? `<tr><th>الموقع</th><td>${escHtml(auth.website)}</td></tr>` : ""}
      ${auth.phone ? `<tr><th>الهاتف</th><td dir="ltr" style="text-align:right;">${escHtml(auth.phone)}</td></tr>` : ""}
    </table>` : `<p style="color:#9ca3af;">لم تُحدَّد السلطة الحكومية</p>`;

  const timeline = (brief.timeline?.steps ?? []).map(step =>
    `<tr><td>${step.step}</td><td>${escHtml(step.titleAr)}</td><td>${escHtml(step.duration)}</td><td>${escHtml(step.actor)}</td></tr>`
  ).join("") || `<tr><td colspan="4" style="color:#9ca3af;text-align:center;">لم تُحدَّد مراحل</td></tr>`;

  const appealRoutes = (brief.appealStrategy?.routes ?? []).map(r =>
    `<tr><td>${escHtml(r.routeAr)}</td><td>${escHtml(r.deadlineAr)}</td><td>${escHtml(r.procedureAr)}</td></tr>`
  ).join("") || `<tr><td colspan="3" style="color:#9ca3af;text-align:center;">لا توجد مسارات استئناف</td></tr>`;

  const algoPoints = (brief.humanInterventionPoints ?? []).map(p =>
    `<li>${escHtml(p)}</li>`
  ).join("") || `<li style="color:#9ca3af;">لم تُحدَّد نقاط</li>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  direction:rtl;
  font-family:'Amiri','Noto Naskh Arabic','Scheherazade New','Arial',serif;
  font-size:11pt; line-height:1.75; color:#1a1a2e; background:white;
}
.cover {
  min-height:27cm; display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center;
  padding:2cm 3cm; page-break-after:always;
  background:linear-gradient(160deg,#0f172a 0%,#1e3a5f 100%); color:white;
}
.section { margin-bottom:1cm; }
.page-break { page-break-before:always; padding-top:0.5cm; }
h2 {
  font-size:15pt; font-weight:bold; color:#1e3a5f;
  border-bottom:3px solid #1e3a5f; padding-bottom:0.2cm; margin-bottom:0.4cm;
  display:flex; align-items:center; gap:0.3cm;
}
h3 { font-size:12pt; font-weight:bold; color:#2d5986; margin:0.4cm 0 0.2cm; }
p { margin-bottom:0.2cm; }
.badge { display:inline-block; padding:1px 6px; border-radius:4px; font-size:9pt; font-weight:bold; }
.badge-green { background:#d1fae5; color:#065f46; }
.badge-amber { background:#fef3c7; color:#92400e; }
.badge-red   { background:#fee2e2; color:#991b1b; }
.badge-gray  { background:#f3f4f6; color:#374151; }
.verdict-box {
  border-radius:8px; padding:0.4cm 0.8cm; margin:0.4cm 0;
  border-width:2px; border-style:solid;
}
.score-row { display:flex; gap:2cm; justify-content:center; margin:0.6cm 0; }
.score-item { text-align:center; }
.score-num { font-size:32pt; font-weight:bold; }
.score-lbl { font-size:9pt; opacity:0.7; }
table { width:100%; border-collapse:collapse; margin:0.3cm 0; font-size:10pt; }
th { background:#1e3a5f; color:white; padding:0.2cm 0.3cm; text-align:right; }
td { padding:0.2cm 0.3cm; border-bottom:1px solid #e5e7eb; vertical-align:top; }
tr:nth-child(even) td { background:#f9fafb; }
.dim-card { border:1px solid #e5e7eb; border-radius:6px; padding:0.4cm; margin:0.3cm 0; }
.dim-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.25cm; flex-wrap:wrap; gap:0.2cm; }
.dim-num { display:inline-flex; align-items:center; justify-content:center; width:1.4em; height:1.4em; border-radius:50%; background:#1e3a5f; color:white; font-size:9pt; font-weight:bold; margin-left:0.3cm; }
.dim-explanation { font-size:10.5pt; color:#374151; margin-bottom:0.15cm; }
.missing-list { background:#fef9ec; border-right:3px solid #d97706; padding:0.2cm 0.4cm; margin:0.2cm 0; border-radius:0 4px 4px 0; font-size:10pt; }
.missing-list ul { padding-right:1.2em; }
.law-list { background:#eff6ff; border-right:3px solid #3b82f6; padding:0.2cm 0.4cm; margin:0.2cm 0; border-radius:0 4px 4px 0; font-size:10pt; }
.doc-item { display:flex; align-items:flex-start; gap:0.3cm; margin:0.25cm 0; }
.checkbox { width:0.5cm; height:0.5cm; border:1.5px solid #6b7280; flex-shrink:0; margin-top:0.2cm; border-radius:2px; }
.toc-table td:first-child { width:1cm; color:#6b7280; font-size:9pt; }
@media print {
  .page-break { page-break-before:always; }
}
</style>
</head>
<body>

<!-- ═══ COVER PAGE ═══ -->
<div class="cover">
  <div style="font-size:11pt;opacity:0.6;margin-bottom:0.4cm;">منصة مرصد للبحث القانوني — MARSAD</div>
  <div style="font-size:26pt;font-weight:bold;margin-bottom:0.1cm;">نظام القرارات الإدارية</div>
  <div style="font-size:13pt;opacity:0.65;margin-bottom:1cm;">Al-Shamsi Administrative Decision OS</div>
  <div style="font-size:18pt;font-weight:bold;margin-bottom:0.2cm;">${escHtml(session.decisionTypeAr)}</div>
  <div style="font-size:11pt;opacity:0.75;margin-bottom:0.8cm;">${escHtml(session.decisionTypeEn)}</div>
  <div style="opacity:0.65;font-size:10pt;margin-bottom:0.8cm;">
    الدور: ${escHtml(roleAr)} &nbsp;|&nbsp; ${escHtml(jurisdictionNameAr)} &nbsp;|&nbsp; ${dateStr}
  </div>
  <div class="verdict-box" style="background:${vc.bg};border-color:${vc.border};color:${vc.color};max-width:12cm;">
    <div style="font-size:17pt;font-weight:bold;">${vc.text}</div>
    <div style="font-size:9.5pt;margin-top:0.3cm;line-height:1.5;">${escHtml(brief.canIssueTodayRationale?.slice(0, 200))}</div>
  </div>
  <div class="score-row" style="margin-top:0.8cm;">
    <div class="score-item">
      <div class="score-num" style="color:${scoreColor(legalityScore)};">${legalityScore}</div>
      <div class="score-lbl">درجة المشروعية / 100</div>
    </div>
    <div class="score-item">
      <div class="score-num" style="color:${scoreColor(100 - riskScore)};">${riskScore}</div>
      <div class="score-lbl">درجة الخطورة / 100</div>
    </div>
  </div>
  <div style="margin-top:1.2cm;font-size:8pt;opacity:0.45;font-family:monospace;">
    الجلسة #${session.id} &nbsp;·&nbsp; رمز التحقق: ${briefHash.slice(0, 8)}…${briefHash.slice(-8)}
  </div>
</div>

<!-- ═══ TABLE OF CONTENTS ═══ -->
<div class="section">
  <h2>📋 فهرس المحتويات</h2>
  <table class="toc-table">
    <tbody>${buildToc(brief)}</tbody>
  </table>
</div>

<!-- ═══ SECTION 1: EXECUTIVE SUMMARY ═══ -->
<div class="section page-break">
  <h2>1. الملخص التنفيذي</h2>
  <div class="verdict-box" style="background:${vc.bg};border-color:${vc.border};color:${vc.color};">
    <strong>${vc.text}</strong>
    <p style="margin-top:0.2cm;font-size:10.5pt;">${escHtml(brief.canIssueTodayRationale)}</p>
  </div>
  <table>
    <tr><th style="width:6cm;">البند</th><th>التفاصيل</th></tr>
    <tr><td>نوع القرار</td><td>${escHtml(session.decisionTypeAr)} (${escHtml(session.decisionTypeEn)})</td></tr>
    <tr><td>الدور</td><td>${escHtml(roleAr)}</td></tr>
    <tr><td>النطاق القضائي</td><td>${escHtml(jurisdictionNameAr)}</td></tr>
    <tr><td>تاريخ التقييم</td><td>${dateStr}</td></tr>
    <tr><td>درجة المشروعية</td><td style="font-weight:bold;color:${scoreColor(legalityScore)};">${legalityScore}/100</td></tr>
    <tr><td>درجة الخطورة</td><td style="font-weight:bold;color:${scoreColor(100 - riskScore)};">${riskScore}/100</td></tr>
  </table>
</div>

<!-- ═══ SECTIONS 2-13: 12 DIMENSIONS ═══ -->
<div class="section page-break">
  <h2>2–13. التحليل الشامل — 12 أبعاد نظرية الشامسي</h2>
  ${dimensionSections}
</div>

<!-- ═══ SECTION 14: LEGISLATION ═══ -->
<div class="section page-break">
  <h2>14. التشريعات الإماراتية المنطبقة</h2>
  <table>
    <thead><tr><th style="width:3cm;">الرمز</th><th>نص المادة / القانون</th><th>أهمية الصلة</th></tr></thead>
    <tbody>${legislation}</tbody>
  </table>
</div>

<!-- ═══ SECTION 15: COURT PRECEDENTS ═══ -->
<div class="section">
  <h2>15. السوابق القضائية</h2>
  <table>
    <thead><tr><th style="width:3cm;">رقم الطعن</th><th>المحكمة</th><th style="width:2cm;">السنة</th><th>المبدأ القانوني</th></tr></thead>
    <tbody>${precedents}</tbody>
  </table>
</div>

<!-- ═══ SECTION 16: REQUIRED DOCUMENTS ═══ -->
<div class="section page-break">
  <h2>16. قائمة المستندات المطلوبة</h2>
  <p style="font-size:9pt;color:#6b7280;margin-bottom:0.3cm;">ضع علامة (✓) بجانب كل مستند تم تجهيزه وتوثيقه.</p>
  ${docs}
</div>

<!-- ═══ SECTION 17: AUTHORITY ═══ -->
<div class="section">
  <h2>17. السلطة الحكومية وسلسلة التفويض</h2>
  ${authHtml}
</div>

<!-- ═══ SECTION 18: TIMELINE ═══ -->
<div class="section page-break">
  <h2>18. الجدول الزمني — المراحل والمواعيد القانونية</h2>
  <table>
    <thead><tr><th style="width:1.5cm;">المرحلة</th><th>البند</th><th style="width:3cm;">المدة القانونية</th><th style="width:3cm;">الجهة المسؤولة</th></tr></thead>
    <tbody>${timeline}</tbody>
  </table>
</div>

<!-- ═══ SECTION 19: APPEAL STRATEGY ═══ -->
<div class="section">
  <h2>19. استراتيجية الطعن والاستئناف</h2>
  ${brief.appealStrategy?.recommendationAr ? `<div class="verdict-box" style="background:#eff6ff;border-color:#3b82f6;color:#1e40af;"><strong>التوصية:</strong> ${escHtml(brief.appealStrategy.recommendationAr)}</div>` : ""}
  <table>
    <thead><tr><th>مسار الطعن</th><th style="width:4cm;">المهلة القانونية</th><th>الإجراءات</th></tr></thead>
    <tbody>${appealRoutes}</tbody>
  </table>
</div>

<!-- ═══ SECTION 20: ALGORITHM ═══ -->
<div class="section page-break">
  <h2>20. شرح الخوارزمية ونقاط التدخل البشري</h2>
  <h3>توصيف النظام الخوارزمي</h3>
  <p>${escHtml(brief.algorithmExplanation)}</p>
  <h3>نقاط التدخل البشري الإلزامية</h3>
  <ul style="padding-right:1.2em;margin-top:0.2cm;">
    ${algoPoints}
  </ul>
</div>

<!-- ═══ INTEGRITY SECTION ═══ -->
<div class="section" style="margin-top:1cm;border-top:2px solid #e5e7eb;padding-top:0.5cm;">
  <h3 style="color:#6b7280;font-size:10pt;">التحقق من سلامة التقرير</h3>
  <table>
    <tr><td style="width:4cm;color:#6b7280;">رقم الجلسة</td><td dir="ltr" style="font-family:monospace;">#${session.id}</td></tr>
    <tr><td style="color:#6b7280;">تاريخ الإنشاء</td><td>${dateStr}</td></tr>
    <tr><td style="color:#6b7280;">البصمة الرقمية (SHA-256)</td><td dir="ltr" style="font-family:monospace;font-size:9pt;word-break:break-all;">${briefHash}</td></tr>
    <tr><td style="color:#6b7280;">للتحقق</td><td style="font-size:9pt;">احسب SHA-256 لمحتوى التقرير JSON وقارنه بالبصمة أعلاه</td></tr>
  </table>
</div>

</body>
</html>`;
}

export async function generateAdminBriefPdf(
  session: SessionLike,
  brief: AdminDecisionBriefData,
  briefHash: string,
): Promise<Buffer> {
  const html = buildHtml(session, brief, briefHash);

  // Dynamic import so server starts even if puppeteer isn't fully configured yet
  const puppeteer = await import("puppeteer").then((m) => m.default ?? m);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    // waitUntil: 'networkidle0' removed in puppeteer 25; use domcontentloaded + extra delay for fonts
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    // Allow time for Google Fonts to load before rendering
    await new Promise((r) => setTimeout(r, 2000));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2.5cm", bottom: "2.5cm", left: "2.5cm", right: "2.5cm" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `<div style="width:100%;font-family:serif;font-size:7pt;color:#9ca3af;padding:0 2.5cm;text-align:center;">
        الجلسة #${session.id} · ${new Date(session.createdAt).toLocaleDateString("ar-AE")} · رمز التحقق: ${briefHash.slice(-8)}
      </div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
