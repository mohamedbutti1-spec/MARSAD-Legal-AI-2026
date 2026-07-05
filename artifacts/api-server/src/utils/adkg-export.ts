/**
 * Phase 58 — ADKG Export Utilities
 * Exports a single administrative decision as PDF, DOCX, or Markdown.
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AdkgExportDecision {
  decisionNumber: string;
  title: string;
  titleAr: string;
  issuerOrg?: string | null;
  issuerOrgAr?: string | null;
  subject?: string | null;
  subjectAr?: string | null;
  status: string;
  issuedDate?: string | null;
  effectiveDate?: string | null;
  content: Record<string, unknown>;
  citedAuthorities: unknown[];
}

export interface AdkgExportLink {
  linkType: string;
  linkedEntityType: string;
  titleAr?: string | null;
  titleEn?: string | null;
  linkedEntityRef?: string | null;
  authorityClass: string;
  notes?: string | null;
}

export interface AdkgExportEvent {
  eventType: string;
  eventDate: string;
  descriptionAr?: string | null;
  description?: string | null;
}

export interface AdkgExportData {
  decision: AdkgExportDecision;
  links: AdkgExportLink[];
  timeline: AdkgExportEvent[];
  exportDate: Date;
}

// ─── Markdown ─────────────────────────────────────────────────────────────────
export function exportAdkgAsMarkdown(data: AdkgExportData): string {
  const { decision, links, timeline, exportDate } = data;
  const lines: string[] = [];

  lines.push(`# ${decision.titleAr}`);
  lines.push(`> ${decision.title}`);
  lines.push(`\n**رقم القرار:** ${decision.decisionNumber}`);
  lines.push(`**الحالة:** ${decision.status}`);
  if (decision.issuedDate)   lines.push(`**تاريخ الإصدار:** ${decision.issuedDate}`);
  if (decision.effectiveDate) lines.push(`**تاريخ النفاذ:** ${decision.effectiveDate}`);
  if (decision.issuerOrgAr || decision.issuerOrg) lines.push(`**الجهة المصدرة:** ${decision.issuerOrgAr ?? decision.issuerOrg}`);
  if (decision.subjectAr || decision.subject)     lines.push(`**الموضوع:** ${decision.subjectAr ?? decision.subject}`);
  lines.push(`\n_تصدير بتاريخ: ${exportDate.toLocaleDateString("ar-AE")}_`);
  lines.push("\n---\n");

  const body = (decision.content.bodyAr as string) || (decision.content.body as string) || "";
  if (body) {
    lines.push("## نص القرار\n");
    lines.push(body + "\n");
    lines.push("---\n");
  }

  if (links.length > 0) {
    lines.push("## المصادر القانونية والروابط\n");
    for (const l of links) {
      const lbl = l.titleAr || l.titleEn || l.linkedEntityRef || l.linkedEntityType;
      const cls = l.authorityClass === "binding" ? "ملزم" : l.authorityClass === "persuasive" ? "إرشادي" : "غير ملزم";
      lines.push(`- **${lbl}** | ${l.linkType.replace(/_/g, " ")} | ${cls}`);
      if (l.notes) lines.push(`  > ${l.notes}`);
    }
    lines.push("");
  }

  if (timeline.length > 0) {
    lines.push("## المسار الزمني للقرار\n");
    for (const ev of timeline) {
      lines.push(`- **${ev.eventDate}** — ${ev.eventType}${ev.descriptionAr ? ": " + ev.descriptionAr : ""}`);
    }
    lines.push("");
  }

  const authorities = decision.citedAuthorities as Array<Record<string, unknown>>;
  if (authorities.length > 0) {
    lines.push("## مصادر الاستشهاد\n");
    for (const a of authorities) {
      const cls = a.authorityClass as string ?? "persuasive";
      const conf = typeof a.confidenceScore === "number" ? `${Math.round((a.confidenceScore as number) * 100)}%` : "—";
      lines.push(`- **${a.titleAr as string}** | ${cls} | ثقة ${conf}`);
    }
  }

  return lines.join("\n");
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────
export async function exportAdkgAsDocx(data: AdkgExportData): Promise<Buffer> {
  const { decision, links, timeline, exportDate } = data;
  const paragraphs: Paragraph[] = [];

  paragraphs.push(new Paragraph({ children: [new TextRun({ text: decision.titleAr, bold: true, size: 48 })], alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 300 } }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: decision.title, italics: true, size: 28, color: "666666" })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: `${decision.decisionNumber}  ·  ${decision.status}  ·  ${exportDate.toLocaleDateString("ar-AE")}`, size: 20, color: "888888" })], alignment: AlignmentType.CENTER, spacing: { after: 1000 } }));
  paragraphs.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1E3A5F" } }, spacing: { after: 600 } }));

  if (decision.issuerOrgAr || decision.issuedDate) {
    const meta: string[] = [];
    if (decision.issuerOrgAr) meta.push(`الجهة المصدرة: ${decision.issuerOrgAr}`);
    if (decision.issuedDate)  meta.push(`تاريخ الإصدار: ${decision.issuedDate}`);
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: meta.join("   |   "), size: 22, color: "555555" })], alignment: AlignmentType.RIGHT }));
  }

  const body = (decision.content.bodyAr as string) || (decision.content.body as string) || "";
  if (body) {
    paragraphs.push(new Paragraph({ text: "نص القرار", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT, spacing: { before: 400 } }));
    for (const line of body.split("\n").filter(Boolean)) {
      paragraphs.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT }));
    }
  }

  if (links.length > 0) {
    paragraphs.push(new Paragraph({ text: "المصادر القانونية والروابط", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT, spacing: { before: 400 } }));
    for (const l of links) {
      const lbl = l.titleAr || l.titleEn || l.linkedEntityRef || l.linkedEntityType;
      const cls = l.authorityClass === "binding" ? "ملزم" : l.authorityClass === "persuasive" ? "إرشادي" : "غير ملزم";
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `• ${lbl}`, bold: true }), new TextRun({ text: `  (${l.linkType.replace(/_/g, " ")}) — ${cls}`, color: "555555" })], alignment: AlignmentType.RIGHT, indent: { left: 400 } }));
    }
  }

  if (timeline.length > 0) {
    paragraphs.push(new Paragraph({ text: "المسار الزمني", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT, spacing: { before: 400 } }));
    for (const ev of timeline) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `${ev.eventDate}  —  ${ev.eventType}`, bold: true }), ev.descriptionAr ? new TextRun({ text: `: ${ev.descriptionAr}`, color: "555555" }) : new TextRun("")], alignment: AlignmentType.RIGHT, indent: { left: 300 } }));
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }], styles: { default: { document: { run: { rightToLeft: true, font: "Arial" } } } } });
  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── PDF ──────────────────────────────────────────────────────────────────────
function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", issued: "#059669", challenged: "#d97706", suspended: "#dc2626",
  amended: "#7c3aed", revoked: "#991b1b", annulled: "#450a0a", executed: "#0369a1",
};
const EVENT_COLORS: Record<string, string> = {
  draft: "#94a3b8", issued: "#22c55e", challenged: "#f59e0b", suspended: "#ef4444",
  amended: "#a855f7", revoked: "#dc2626", annulled: "#7f1d1d", executed: "#3b82f6",
  appeal_filed: "#f97316", appeal_dismissed: "#6b7280", appeal_upheld: "#10b981",
  court_referral: "#8b5cf6", publication: "#06b6d4", custom: "#64748b",
};

function buildAdkgHtml(data: AdkgExportData): string {
  const { decision, links, timeline, exportDate } = data;
  const statusColor = STATUS_COLORS[decision.status] ?? "#6b7280";
  const d = exportDate.toLocaleDateString("ar-AE");

  const body = (decision.content.bodyAr as string) || (decision.content.body as string) || "";

  const linkRows = links.map((l) => {
    const lbl = l.titleAr || l.titleEn || l.linkedEntityRef || l.linkedEntityType;
    const cls = l.authorityClass === "binding" ? `<span class="badge badge-green">ملزم</span>` : l.authorityClass === "persuasive" ? `<span class="badge badge-blue">إرشادي</span>` : `<span class="badge badge-gray">غير ملزم</span>`;
    return `<tr><td>${escHtml(lbl)}</td><td>${escHtml(l.linkType.replace(/_/g, " "))}</td><td>${cls}</td><td>${escHtml(l.notes ?? "")}</td></tr>`;
  }).join("");

  const timelineHtml = timeline.map((ev) => {
    const dot = EVENT_COLORS[ev.eventType] ?? "#94a3b8";
    const desc = ev.descriptionAr || ev.description || "";
    return `<div class="tl-row"><div class="tl-date">${escHtml(ev.eventDate)}</div><div class="tl-line"><div class="tl-dot" style="background:${dot}"></div></div><div class="tl-body"><strong>${escHtml(ev.eventType)}</strong>${desc ? `<p class="tl-desc">${escHtml(desc)}</p>` : ""}</div></div>`;
  }).join("");

  const authorities = decision.citedAuthorities as Array<Record<string, unknown>>;
  const authRows = authorities.map((a) => {
    const cls = a.authorityClass as string ?? "persuasive";
    const conf = typeof a.confidenceScore === "number" ? `${Math.round((a.confidenceScore as number) * 100)}%` : "—";
    const badge = cls === "binding" ? `<span class="badge badge-green">ملزم</span>` : cls === "persuasive" ? `<span class="badge badge-blue">إرشادي</span>` : `<span class="badge badge-gray">غير ملزم</span>`;
    return `<tr><td>${escHtml(a.titleAr as string)}</td><td>${badge}</td><td>${conf}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{direction:rtl;font-family:'Amiri','Arial',serif;font-size:11pt;line-height:1.9;color:#1a1a2e;background:white}
.cover{min-height:22cm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2cm 3cm;page-break-after:always;background:linear-gradient(160deg,#0f172a,#1e3a5f);color:white}
.cover h1{font-size:26pt;margin-bottom:.3cm}
.cover .sub{opacity:.75;font-size:13pt;margin-bottom:.8cm}
.status-badge{display:inline-block;padding:4px 16px;border-radius:20px;font-size:10pt;font-weight:bold;background:${statusColor}22;color:${statusColor};border:2px solid ${statusColor};margin-bottom:.6cm}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:.3cm;text-align:right;opacity:.8;font-size:10pt}
section{margin-bottom:.8cm}
h2{font-size:15pt;color:#1e3a5f;border-bottom:3px solid #1e3a5f;padding-bottom:.15cm;margin-bottom:.4cm}
.body-text{color:#374151;white-space:pre-wrap;font-size:11pt;line-height:2}
table{width:100%;border-collapse:collapse;font-size:10pt;margin:.2cm 0}
th{background:#1e3a5f;color:white;padding:.15cm .3cm;text-align:right}
td{padding:.12cm .3cm;border-bottom:1px solid #e5e7eb;vertical-align:top}
.badge{display:inline-block;padding:1px 6px;border-radius:4px;font-size:9pt;font-weight:bold}
.badge-green{background:#d1fae5;color:#065f46}
.badge-blue{background:#dbeafe;color:#1e40af}
.badge-gray{background:#f3f4f6;color:#374151}
.tl-row{display:flex;gap:.4cm;margin-bottom:.5cm}
.tl-date{width:2.5cm;text-align:left;font-size:9pt;color:#6b7280;padding-top:.1cm;flex-shrink:0}
.tl-line{width:.4cm;display:flex;flex-direction:column;align-items:center;flex-shrink:0}
.tl-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.tl-body{flex:1}
.tl-desc{font-size:10pt;color:#4b5563;margin-top:.1cm}
.pb{page-break-before:always;padding-top:.5cm}
@media print{.pb{page-break-before:always}}
</style></head><body>
<div class="cover">
  <div style="font-size:9pt;opacity:.5;margin-bottom:.3cm">منصة مرصد — سجل القرارات الإدارية</div>
  <h1>${escHtml(decision.titleAr)}</h1>
  <div class="sub">${escHtml(decision.title)}</div>
  <div class="status-badge">${escHtml(decision.status)}</div>
  <div class="meta-grid">
    <div>رقم القرار: ${escHtml(decision.decisionNumber)}</div>
    ${decision.issuedDate ? `<div>تاريخ الإصدار: ${escHtml(decision.issuedDate)}</div>` : "<div></div>"}
    ${decision.issuerOrgAr ? `<div>الجهة المصدرة: ${escHtml(decision.issuerOrgAr)}</div>` : "<div></div>"}
    ${decision.effectiveDate ? `<div>تاريخ النفاذ: ${escHtml(decision.effectiveDate)}</div>` : "<div></div>"}
    <div colspan="2" style="grid-column:span 2;text-align:center;margin-top:.3cm">تصدير: ${d}</div>
  </div>
</div>

${body ? `<section><h2>نص القرار</h2><div class="body-text">${escHtml(body)}</div></section>` : ""}

${links.length > 0 ? `<section class="pb"><h2>المصادر القانونية والروابط</h2><table><thead><tr><th>المصدر</th><th>النوع</th><th>الطبيعة</th><th>ملاحظات</th></tr></thead><tbody>${linkRows}</tbody></table></section>` : ""}

${timeline.length > 0 ? `<section class="${links.length > 0 ? "" : "pb"}"><h2>المسار الزمني</h2>${timelineHtml}</section>` : ""}

${authorities.length > 0 ? `<section><h2>مصادر الاستشهاد (الفحص الآلي)</h2><table><thead><tr><th>المصدر</th><th>الطبيعة</th><th>الثقة</th></tr></thead><tbody>${authRows}</tbody></table></section>` : ""}

</body></html>`;
}

export async function exportAdkgAsPdf(data: AdkgExportData): Promise<Buffer> {
  const html = buildAdkgHtml(data);
  const puppeteer = await import("puppeteer").then((m) => m.default ?? m);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await new Promise((r) => setTimeout(r, 1200));
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "2cm", bottom: "2cm", left: "2cm", right: "2cm" } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
