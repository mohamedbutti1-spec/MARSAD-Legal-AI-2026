/**
 * Phase 57 — Research Workspace Export Service
 *
 * Exports a complete research project as PDF, DOCX, or Markdown.
 * Each format includes a cover page, table of contents, and one section per
 * folder/item. Answer items include the Phase 56 authority inventory and
 * verification report as an appendix.
 *
 * DO NOT modify existing prompts, routes, or DB tables.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from "docx";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ExportFolder {
  id: number | null;       // null = root
  name: string;
  items: ExportItem[];
}

export interface ExportItem {
  id: number;
  itemType: string;
  title: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  answerMeta?: ExportAnswerMeta;
}

export interface ExportAnswerMeta {
  citedAuthorities: unknown[];
  verificationReport: Record<string, unknown>;
  confidenceLevel: number | null;
  retrievalInventory: Record<string, unknown>;
  generationTimestamp: Date | null;
  modelVersion: string | null;
}

export interface ExportProject {
  id: number;
  title: string;
  description: string | null;
  ownerName: string;
  exportDate: Date;
  folders: ExportFolder[];
}

// ─── Markdown export ──────────────────────────────────────────────────────────

export function exportProjectAsMarkdown(project: ExportProject): string {
  const lines: string[] = [];
  const d = project.exportDate.toLocaleDateString("ar-AE");

  lines.push(`# ${project.title}`);
  if (project.description) lines.push(`\n> ${project.description}`);
  lines.push(`\n**المالك:** ${project.ownerName}  `);
  lines.push(`**تاريخ التصدير:** ${d}\n`);
  lines.push("---\n");

  // Table of contents
  lines.push("## فهرس المحتويات\n");
  let tocIdx = 1;
  for (const folder of project.folders) {
    lines.push(`${tocIdx}. **${folder.name || "الجذر"}**`);
    for (const item of folder.items) {
      lines.push(`   - ${item.title} _(${item.itemType})_`);
    }
    tocIdx++;
  }
  lines.push("\n---\n");

  // Content sections
  for (const folder of project.folders) {
    lines.push(`## ${folder.name || "الجذر"}\n`);

    for (const item of folder.items) {
      lines.push(`### ${item.title}`);
      lines.push(`_النوع: ${item.itemType} · ${new Date(item.createdAt).toLocaleDateString("ar-AE")}_\n`);

      const body = (item.content.text as string) || (item.content.body as string) || "";
      if (body) lines.push(body + "\n");

      // Answer provenance appendix
      if (item.itemType === "answer" && item.answerMeta) {
        const am = item.answerMeta;
        lines.push("\n#### مصادر الاستشهاد\n");
        const authorities = am.citedAuthorities as Array<Record<string, unknown>>;
        for (const auth of authorities) {
          const cls = auth.authorityClass as string ?? "persuasive";
          const conf = typeof auth.confidenceScore === "number"
            ? `${Math.round(auth.confidenceScore * 100)}%`
            : "—";
          lines.push(`- **${auth.titleAr as string}** | ${cls} | ثقة ${conf}`);
        }
        if (am.modelVersion) {
          lines.push(`\n_النموذج: ${am.modelVersion}_`);
        }
        if (am.generationTimestamp) {
          lines.push(`_وقت التوليد: ${new Date(am.generationTimestamp).toISOString()}_`);
        }
      }

      lines.push("\n---\n");
    }
  }

  return lines.join("\n");
}

// ─── DOCX export ──────────────────────────────────────────────────────────────

export async function exportProjectAsDocx(project: ExportProject): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  const d = project.exportDate.toLocaleDateString("ar-AE");

  // Cover
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: project.title, bold: true, size: 52 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 400 },
    }),
  );
  if (project.description) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: project.description, italics: true, size: 28 })],
        alignment: AlignmentType.CENTER,
      }),
    );
  }
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: `المالك: ${project.ownerName}   |   تاريخ التصدير: ${d}`, size: 22, color: "666666" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 2000 },
    }),
  );

  // Separator line
  paragraphs.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1E3A5F" } },
    spacing: { after: 800 },
  }));

  // Table of contents heading
  paragraphs.push(new Paragraph({
    text: "فهرس المحتويات",
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.RIGHT,
  }));

  let tocIdx = 1;
  for (const folder of project.folders) {
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: `${tocIdx}. `, bold: true }),
        new TextRun({ text: folder.name || "الجذر", bold: true }),
      ],
      alignment: AlignmentType.RIGHT,
      indent: { left: 200 },
    }));
    for (const item of folder.items) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `    • ${item.title} `, italics: true }),
          new TextRun({ text: `(${item.itemType})`, color: "888888", italics: true }),
        ],
        alignment: AlignmentType.RIGHT,
        indent: { left: 600 },
      }));
    }
    tocIdx++;
  }

  paragraphs.push(new Paragraph({ text: "", pageBreakBefore: true }));

  // Content
  for (const folder of project.folders) {
    paragraphs.push(new Paragraph({
      text: folder.name || "الجذر",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.RIGHT,
    }));

    for (const item of folder.items) {
      paragraphs.push(new Paragraph({
        text: item.title,
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.RIGHT,
      }));
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `النوع: ${item.itemType}  ·  التاريخ: ${new Date(item.createdAt).toLocaleDateString("ar-AE")}`, color: "888888", italics: true, size: 18 }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
      }));

      const body = (item.content.text as string) || (item.content.body as string) || "";
      if (body) {
        for (const line of body.split("\n").filter(Boolean)) {
          paragraphs.push(new Paragraph({
            text: line,
            alignment: AlignmentType.RIGHT,
          }));
        }
      }

      // Answer provenance
      if (item.itemType === "answer" && item.answerMeta) {
        const am = item.answerMeta;
        paragraphs.push(new Paragraph({
          text: "مصادر الاستشهاد",
          heading: HeadingLevel.HEADING_3,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 400 },
        }));
        const authorities = am.citedAuthorities as Array<Record<string, unknown>>;
        for (const auth of authorities) {
          const cls   = auth.authorityClass as string ?? "persuasive";
          const conf  = typeof auth.confidenceScore === "number"
            ? `${Math.round(auth.confidenceScore * 100)}%`
            : "—";
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({ text: `• ${auth.titleAr as string}`, bold: true }),
              new TextRun({ text: `  |  ${cls}  |  ثقة ${conf}`, color: "555555" }),
            ],
            alignment: AlignmentType.RIGHT,
            indent: { left: 400 },
          }));
        }
        if (am.modelVersion || am.generationTimestamp) {
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({
                text: [
                  am.modelVersion ? `النموذج: ${am.modelVersion}` : "",
                  am.generationTimestamp ? `وقت التوليد: ${new Date(am.generationTimestamp).toISOString()}` : "",
                ].filter(Boolean).join("  ·  "),
                color: "888888",
                italics: true,
                size: 18,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }));
        }
      }

      paragraphs.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "E5E7EB" } },
        spacing: { before: 300, after: 300 },
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
    styles: {
      default: {
        document: {
          run: { rightToLeft: true, font: "Arial" },
        },
      },
    },
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function itemTypeLabel(type: string): string {
  const map: Record<string, string> = {
    question:       "سؤال",
    answer:         "جواب",
    authority:      "سلطة قانونية",
    document:       "وثيقة",
    note:           "ملاحظة",
    highlight:      "تظليل",
    bookmark:       "إشارة مرجعية",
    timeline_entry: "إدخال جدول زمني",
  };
  return map[type] ?? type;
}

function buildProjectHtml(project: ExportProject): string {
  const d = project.exportDate.toLocaleDateString("ar-AE");

  let folderSections = "";
  let tocRows = "";
  let secIdx = 1;

  for (const folder of project.folders) {
    tocRows += `<tr><td>${secIdx}</td><td>${escHtml(folder.name || "الجذر")}</td><td>${folder.items.length} عناصر</td></tr>`;

    let itemsHtml = "";
    for (const item of folder.items) {
      const body = (item.content.text as string) || (item.content.body as string) || "";
      let provenanceHtml = "";

      if (item.itemType === "answer" && item.answerMeta) {
        const am = item.answerMeta;
        const authorities = am.citedAuthorities as Array<Record<string, unknown>>;
        const authRows = authorities.map((a) => {
          const cls  = a.authorityClass as string ?? "persuasive";
          const conf = typeof a.confidenceScore === "number"
            ? `${Math.round(a.confidenceScore * 100)}%`
            : "—";
          const clsBadge = cls === "binding"     ? `<span class="badge badge-green">ملزم</span>`
                         : cls === "persuasive"  ? `<span class="badge badge-blue">إرشادي</span>`
                         :                         `<span class="badge badge-gray">غير ملزم</span>`;
          return `<tr><td>${escHtml(a.titleAr as string)}</td><td>${clsBadge}</td><td>${conf}</td></tr>`;
        }).join("");

        provenanceHtml = `
<div class="provenance">
  <div class="prov-title">📋 مصادر الاستشهاد</div>
  <table>
    <thead><tr><th>المصدر</th><th>الطبيعة</th><th>الثقة</th></tr></thead>
    <tbody>${authRows || '<tr><td colspan="3" style="color:#9ca3af;text-align:center;">لا توجد مصادر</td></tr>'}</tbody>
  </table>
  ${am.modelVersion ? `<div class="prov-meta">النموذج: ${escHtml(am.modelVersion)}</div>` : ""}
  ${am.generationTimestamp ? `<div class="prov-meta">وقت التوليد: ${new Date(am.generationTimestamp).toISOString()}</div>` : ""}
</div>`;
      }

      itemsHtml += `
<div class="item-card">
  <div class="item-header">
    <strong>${escHtml(item.title)}</strong>
    <span class="type-badge">${itemTypeLabel(item.itemType)}</span>
    <span class="item-date">${new Date(item.createdAt).toLocaleDateString("ar-AE")}</span>
  </div>
  ${body ? `<div class="item-body">${escHtml(body)}</div>` : ""}
  ${provenanceHtml}
</div>`;
    }

    folderSections += `
<div class="section page-break">
  <h2>${secIdx}. ${escHtml(folder.name || "الجذر")}</h2>
  ${itemsHtml || '<p style="color:#9ca3af;">لا توجد عناصر في هذا المجلد</p>'}
</div>`;
    secIdx++;
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { direction:rtl; font-family:'Amiri','Arial',serif; font-size:11pt; line-height:1.8; color:#1a1a2e; background:white; }
.cover { min-height:25cm; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:2cm 3cm; page-break-after:always; background:linear-gradient(160deg,#0f172a 0%,#1e3a5f 100%); color:white; }
.cover h1 { font-size:28pt; margin-bottom:0.4cm; }
.cover .meta { opacity:0.65; font-size:10pt; margin-top:1cm; }
.section { margin-bottom:1cm; }
.page-break { page-break-before:always; padding-top:0.5cm; }
h2 { font-size:16pt; color:#1e3a5f; border-bottom:3px solid #1e3a5f; padding-bottom:0.2cm; margin-bottom:0.5cm; }
.item-card { border:1px solid #e5e7eb; border-radius:6px; padding:0.4cm; margin:0.3cm 0; }
.item-header { display:flex; align-items:center; gap:0.4cm; margin-bottom:0.25cm; flex-wrap:wrap; }
.type-badge { background:#eff6ff; color:#1e40af; padding:2px 8px; border-radius:4px; font-size:9pt; }
.item-date { color:#9ca3af; font-size:9pt; margin-right:auto; }
.item-body { color:#374151; font-size:10.5pt; margin:0.2cm 0; white-space:pre-wrap; }
.provenance { background:#f9fafb; border-radius:4px; padding:0.3cm; margin-top:0.3cm; font-size:10pt; }
.prov-title { font-weight:bold; color:#1e3a5f; margin-bottom:0.2cm; }
.prov-meta { color:#6b7280; font-size:9pt; margin-top:0.1cm; }
table { width:100%; border-collapse:collapse; margin:0.2cm 0; font-size:10pt; }
th { background:#1e3a5f; color:white; padding:0.15cm 0.3cm; text-align:right; }
td { padding:0.15cm 0.3cm; border-bottom:1px solid #e5e7eb; vertical-align:top; }
.badge { display:inline-block; padding:1px 6px; border-radius:4px; font-size:9pt; font-weight:bold; }
.badge-green { background:#d1fae5; color:#065f46; }
.badge-blue  { background:#dbeafe; color:#1e40af; }
.badge-gray  { background:#f3f4f6; color:#374151; }
@media print { .page-break { page-break-before:always; } }
</style>
</head>
<body>
<div class="cover">
  <div style="font-size:10pt;opacity:0.6;margin-bottom:0.4cm;">منصة مرصد للبحث القانوني</div>
  <h1>${escHtml(project.title)}</h1>
  ${project.description ? `<div style="opacity:0.75;font-size:12pt;max-width:15cm;">${escHtml(project.description)}</div>` : ""}
  <div class="meta">
    المالك: ${escHtml(project.ownerName)} &nbsp;|&nbsp; تاريخ التصدير: ${d}
  </div>
</div>
<div class="section">
  <h2>📋 فهرس المحتويات</h2>
  <table>
    <thead><tr><th style="width:1.5cm;">#</th><th>المجلد</th><th style="width:3cm;">عدد العناصر</th></tr></thead>
    <tbody>${tocRows || '<tr><td colspan="3" style="color:#9ca3af;text-align:center;">لا توجد مجلدات</td></tr>'}</tbody>
  </table>
</div>
${folderSections}
</body>
</html>`;
}

export async function exportProjectAsPdf(project: ExportProject): Promise<Buffer> {
  const html = buildProjectHtml(project);
  const puppeteer = await import("puppeteer").then((m) => m.default ?? m);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await new Promise((r) => setTimeout(r, 1500));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", bottom: "2cm", left: "2cm", right: "2cm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
