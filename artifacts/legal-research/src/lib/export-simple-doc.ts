/**
 * export-simple-doc.ts
 * Lightweight Word/PDF export for plain structured text (used by the results
 * page — src/pages/result.tsx). Unlike export-brief-pdf.ts (which renders a
 * fixed DecisionBrief shape), this accepts any Arabic/RTL title + body text,
 * so it can export whatever the AI assistant actually returned.
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function safeFileName(title: string): string {
  const cleaned = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^؀-ۿa-zA-Z0-9\-]/g, '');
  return cleaned || 'مرصد-نتيجة';
}

/** Downloads a .doc file (HTML wrapped with a Word-compatible MIME type) — opens natively in MS Word. */
export function exportTextToWord(title: string, bodyText: string): void {
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" />
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; font-size: 14px; line-height: 1.8; }
  h1 { font-size: 20px; }
  pre { white-space: pre-wrap; font-family: inherit; }
</style></head>
<body dir="rtl">
  <h1>${escapeHtml(title)}</h1>
  <pre>${escapeHtml(bodyText)}</pre>
</body></html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(title)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a print-ready PDF of the given Arabic/RTL title + body text.
 *
 * jsPDF's built-in fonts (Helvetica/Times/Courier) have no Arabic glyph
 * coverage and jsPDF does not shape or bidi-reorder Arabic text on its own,
 * so drawing the text directly with pdf.text() renders Arabic as blank or
 * garbled. Instead — the same proven technique already used by
 * export-brief-pdf.ts — this renders real HTML (with an embedded Arabic web
 * font, RTL direction) in a sandboxed off-screen iframe, rasterizes it with
 * html2canvas, and slices the result into A4 pages.
 */
export async function exportTextToPdf(title: string, bodyText: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Arial, sans-serif;
    background: #ffffff;
    color: #1e293b;
    direction: rtl;
    font-size: 13px;
    line-height: 1.9;
    width: 794px;
    padding: 48px 52px;
  }
  h1 {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 20px;
    border-bottom: 2px solid #1d4ed8;
    padding-bottom: 14px;
  }
  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.9;
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <pre>${escapeHtml(bodyText)}</pre>
</body>
</html>`;

  // Sandboxed off-screen iframe — allow-same-origin (needed by html2canvas)
  // but NOT allow-scripts, so any <script> that slipped past escaping is inert.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.style.cssText = `
    position:fixed;left:-9999px;top:0;
    width:794px;height:1px;
    border:none;visibility:hidden;
  `;
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for the Arabic web font to load before rasterizing.
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const body = doc.body;
    iframe.style.height = `${body.scrollHeight}px`;
    await new Promise((resolve) => setTimeout(resolve, 200));

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      logging: false,
    });

    const A4_W_PT = 595.28;
    const A4_H_PT = 841.89;
    const IMG_W_PX = canvas.width;
    const PAGE_H_PX = Math.floor((A4_H_PT / A4_W_PT) * IMG_W_PX);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    let yOffset = 0;
    let pageIndex = 0;

    while (yOffset < canvas.height) {
      const sliceH = Math.min(PAGE_H_PX, canvas.height - yOffset);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = IMG_W_PX;
      pageCanvas.height = PAGE_H_PX;
      const ctx = pageCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, IMG_W_PX, PAGE_H_PX);
      ctx.drawImage(canvas, 0, yOffset, IMG_W_PX, sliceH, 0, 0, IMG_W_PX, sliceH);

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_PT, A4_H_PT);

      yOffset += PAGE_H_PX;
      pageIndex++;
    }

    pdf.save(`${safeFileName(title)}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
