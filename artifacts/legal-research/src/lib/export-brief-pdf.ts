/**
 * export-brief-pdf.ts
 * Client-side PDF export for the Decision Brief.
 * Renders a styled off-screen sandboxed iframe → html2canvas → jsPDF (A4, RTL, Arabic-friendly).
 *
 * Security: ALL dynamic content is HTML-escaped before insertion. The iframe is sandboxed
 * with only allow-same-origin (no allow-scripts), so even if a value slips past escaping it
 * cannot execute as code.
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AnswerCategory = "mandatory" | "opinion" | "best_practice" | "optional";
type RiskLevel = "low" | "medium" | "high" | "critical";
type CanIssue = "yes" | "no" | "conditional";
type ActorType = "user" | "lawyer" | "court" | "authority";

interface AnswerItem { textAr: string; category: AnswerCategory; }
interface TimelineStep { step: number; titleAr: string; duration: string; actor: ActorType; }
interface DecisionBrief {
  riskLevel: RiskLevel;
  riskRationale: string;
  canIssueToday: CanIssue;
  canIssueTodayExplanation: string;
  canIssueTodayConditions: string[];
  finalRecommendation: AnswerItem[];
  missingRequirements: AnswerItem[];
  requiredDocuments: Array<{ nameAr: string; descriptionAr: string; where: string; processingTime: string }>;
  governmentAuthority: { nameAr: string; nameEn: string; department: string; website?: string | null; phone?: string | null; whatToBring: string };
  legalTimeline: TimelineStep[];
  draftLetter: { subjectAr: string; bodyAr: string };
  applicableLegislation: Array<{ token: string | null; articleAr: string; relevanceAr: string }>;
  courtPrecedents: Array<{ titleAr: string; ruling: string; year?: number | null }> | null;
  practicalNextSteps: Array<{ step: number; actionAr: string; actor: string; timeframe: string; category: AnswerCategory }>;
}

// ─── Security: HTML escaping ───────────────────────────────────────────────────

/**
 * Escapes a string so it is safe to interpolate as HTML text content.
 * Replaces & < > " ' with their entity equivalents.
 * Call this on EVERY piece of user/AI-supplied data before inserting into HTML.
 */
function e(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<AnswerCategory, { label: string; dot: string; bg: string; color: string }> = {
  mandatory:     { label: "إلزامي",       dot: "🔴", bg: "#fef2f2", color: "#b91c1c" },
  opinion:       { label: "رأي قانوني",   dot: "🟡", bg: "#fffbeb", color: "#b45309" },
  best_practice: { label: "ممارسة مثلى", dot: "🟢", bg: "#f0fdf4", color: "#15803d" },
  optional:      { label: "اختياري",      dot: "⚪", bg: "#f8fafc", color: "#64748b" },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; emoji: string; bg: string; color: string; border: string }> = {
  low:      { label: "منخفض",    emoji: "✅", bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  medium:   { label: "متوسط",    emoji: "⚠️", bg: "#fffbeb", color: "#b45309", border: "#fcd34d" },
  high:     { label: "مرتفع",    emoji: "⚠️", bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
  critical: { label: "حرج جداً", emoji: "❌", bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
};

const CAN_ISSUE_CONFIG: Record<CanIssue, { label: string; emoji: string; bg: string; color: string; border: string }> = {
  yes:         { label: "يمكن اتخاذ القرار اليوم",   emoji: "✅", bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  no:          { label: "لا يمكن اتخاذ القرار اليوم", emoji: "❌", bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
  conditional: { label: "يمكن اتخاذ القرار بشروط",   emoji: "⚠️", bg: "#fffbeb", color: "#b45309", border: "#fcd34d" },
};

const ACTOR_LABELS: Record<string, string> = {
  user: "المستخدم", lawyer: "المحامي", court: "المحكمة", authority: "الجهة الحكومية",
};

// ─── HTML builder helpers ──────────────────────────────────────────────────────

function pill(category: AnswerCategory): string {
  const c = CATEGORY_LABELS[category] ?? CATEGORY_LABELS.optional;
  // c.label and c.dot are static constants from our code, not user input — no escaping needed
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;
    padding:2px 8px;border-radius:999px;background:${c.bg};color:${c.color};
    border:1px solid ${c.color}40;white-space:nowrap;flex-shrink:0;">${c.dot} ${c.label}</span>`;
}

function section(title: string, icon: string, content: string): string {
  // title and icon are static constants from our code, not user input
  return `
  <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px;">
    <div style="background:#f8fafc;padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0;">
      <span style="font-size:16px;">${icon}</span>
      <span style="font-weight:700;font-size:13px;color:#1e293b;">${title}</span>
    </div>
    <div style="padding:14px 16px;">${content}</div>
  </div>`;
}

// ─── Main HTML builder ─────────────────────────────────────────────────────────

function buildPdfHtml(brief: DecisionBrief, scenarioTitleAr: string, roleTitle: string): string {
  const risk = RISK_CONFIG[brief.riskLevel] ?? RISK_CONFIG.medium;
  const canIssue = CAN_ISSUE_CONFIG[brief.canIssueToday] ?? CAN_ISSUE_CONFIG.conditional;

  // 1. Final Recommendation
  const recItems = (brief.finalRecommendation ?? []).map((item) =>
    `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
      ${pill(item.category)}
      <p style="margin:0;font-size:13px;line-height:1.7;color:#1e293b;flex:1;">${e(item.textAr)}</p>
    </div>`
  ).join("");

  // 2. Missing Requirements
  const missingItems = (brief.missingRequirements ?? []).map((item) =>
    `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
      ${pill(item.category)}
      <p style="margin:0;font-size:13px;line-height:1.7;color:#1e293b;flex:1;">${e(item.textAr)}</p>
    </div>`
  ).join("");

  // 3. Required Documents
  const docItems = (brief.requiredDocuments ?? []).map((doc) =>
    `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
      <p style="margin:0 0 4px;font-weight:700;font-size:13px;color:#1e293b;">${e(doc.nameAr)}</p>
      ${doc.descriptionAr ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b;line-height:1.6;">${e(doc.descriptionAr)}</p>` : ""}
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${doc.where ? `<span style="font-size:11px;color:#64748b;">📍 ${e(doc.where)}</span>` : ""}
        ${doc.processingTime ? `<span style="font-size:11px;color:#64748b;">⏱ ${e(doc.processingTime)}</span>` : ""}
      </div>
    </div>`
  ).join("");

  // 4. Government Authority
  const auth = brief.governmentAuthority;
  const authContent = auth?.nameAr ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;">
      <p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#1e3a8a;">${e(auth.nameAr)}</p>
      ${auth.nameEn ? `<p style="margin:0 0 6px;font-size:12px;color:#1d4ed8;">${e(auth.nameEn)}</p>` : ""}
      ${auth.department ? `<p style="margin:0 0 4px;font-size:13px;color:#1e40af;">📋 ${e(auth.department)}</p>` : ""}
      ${auth.website ? `<p style="margin:0 0 4px;font-size:12px;color:#1d4ed8;">🌐 ${e(auth.website)}</p>` : ""}
      ${auth.phone ? `<p style="margin:0 0 4px;font-size:12px;color:#1d4ed8;">📞 ${e(auth.phone)}</p>` : ""}
      ${auth.whatToBring ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #bfdbfe;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1e3a8a;">ما تحتاج إحضاره:</p>
        <p style="margin:0;font-size:12px;color:#1e40af;line-height:1.6;">${e(auth.whatToBring)}</p>
      </div>` : ""}
    </div>` : "";

  // 5. Legal Timeline
  const timelineItems = (brief.legalTimeline ?? []).map((step, i, arr) =>
    `<div style="display:flex;gap:12px;">
      <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
        <div style="width:28px;height:28px;border-radius:50%;background:#1d4ed8;color:#fff;
          display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${e(step.step)}</div>
        ${i < arr.length - 1 ? `<div style="width:2px;flex:1;background:#e2e8f0;margin:4px 0;min-height:20px;"></div>` : ""}
      </div>
      <div style="flex:1;padding-bottom:${i < arr.length - 1 ? "16px" : "0"};">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">${e(step.titleAr)}</span>
          <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;background:#dbeafe;color:#1d4ed8;">
            ${e(ACTOR_LABELS[step.actor] ?? step.actor)}
          </span>
        </div>
        ${step.duration ? `<span style="font-size:11px;color:#64748b;">⏱ ${e(step.duration)}</span>` : ""}
      </div>
    </div>`
  ).join("");

  // 6. Draft Letter — use <pre> with white-space:pre-wrap so the body is text, never markup
  const letterContent = brief.draftLetter?.bodyAr ? `
    ${brief.draftLetter.subjectAr ? `<p style="font-weight:700;font-size:13px;color:#1e293b;margin:0 0 12px;">الموضوع: ${e(brief.draftLetter.subjectAr)}</p>` : ""}
    <pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;
      font-family:'Courier New',monospace;font-size:12px;line-height:1.8;color:#1e293b;
      white-space:pre-wrap;word-wrap:break-word;margin:0;">${e(brief.draftLetter.bodyAr)}</pre>` : "";

  // 7. Applicable Legislation
  const legItems = (brief.applicableLegislation ?? []).map((item) =>
    `<div style="border-bottom:1px solid #f1f5f9;padding-bottom:12px;margin-bottom:12px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1e293b;">📖 ${e(item.articleAr)}</p>
      ${item.relevanceAr ? `<p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">${e(item.relevanceAr)}</p>` : ""}
    </div>`
  ).join("");

  // 8. Court Precedents
  const precedentsContent = (brief.courtPrecedents ?? []).map((p) =>
    `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
      <p style="margin:0 0 4px;font-weight:700;font-size:13px;color:#1e293b;">${e(p.titleAr)}${p.year ? ` (${e(p.year)})` : ""}</p>
      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">${e(p.ruling)}</p>
    </div>`
  ).join("");

  // 9. Practical Next Steps
  const stepsItems = (brief.practicalNextSteps ?? []).map((step) =>
    `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
      <div style="width:24px;height:24px;border-radius:50%;background:#f1f5f9;border:1px solid #e2e8f0;
        display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${e(step.step)}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">
          ${pill(step.category)}
          <span style="font-size:11px;color:#64748b;">${e(step.actor)}</span>
          ${step.timeframe ? `<span style="font-size:11px;color:#64748b;">⏱ ${e(step.timeframe)}</span>` : ""}
        </div>
        <p style="margin:0;font-size:13px;color:#1e293b;line-height:1.6;">${e(step.actionAr)}</p>
      </div>
    </div>`
  ).join("");

  const today = new Date().toLocaleDateString("ar-AE");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Arial, sans-serif;
    background: #ffffff;
    color: #1e293b;
    direction: rtl;
    font-size: 13px;
    line-height: 1.6;
    width: 794px;
    padding: 48px 52px;
  }
  p { margin: 0; }
</style>
</head>
<body>
  <!-- Cover header -->
  <div style="border-bottom:2px solid #1d4ed8;padding-bottom:20px;margin-bottom:24px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
      <div>
        <p style="font-size:11px;color:#64748b;margin-bottom:6px;">${e(roleTitle)} · ${e(scenarioTitleAr)}</p>
        <h1 style="font-size:24px;font-weight:800;color:#1e293b;line-height:1.2;">التقييم القانوني</h1>
        <p style="font-size:11px;color:#94a3b8;margin-top:6px;">تاريخ الإصدار: ${e(today)}</p>
      </div>
      <div style="text-align:center;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 16px;flex-shrink:0;">
        <p style="font-size:10px;color:#0369a1;font-weight:600;margin-bottom:4px;">نظام القانوني الذكي</p>
        <p style="font-size:10px;color:#64748b;">AI Legal OS</p>
      </div>
    </div>
  </div>

  <!-- Risk + Can Issue -->
  <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
    <div style="flex:1;min-width:200px;border:2px solid ${risk.border};background:${risk.bg};border-radius:10px;padding:12px 16px;">
      <p style="font-size:12px;font-weight:700;color:${risk.color};">${risk.emoji} مستوى الخطر: ${risk.label}</p>
      ${brief.riskRationale ? `<p style="font-size:11px;color:${risk.color};opacity:0.85;margin-top:4px;line-height:1.5;">${e(brief.riskRationale)}</p>` : ""}
    </div>
    <div style="flex:1;min-width:200px;border:2px solid ${canIssue.border};background:${canIssue.bg};border-radius:10px;padding:12px 16px;">
      <p style="font-size:13px;font-weight:800;color:${canIssue.color};">${canIssue.emoji} ${canIssue.label}</p>
      ${brief.canIssueTodayExplanation ? `<p style="font-size:11px;color:${canIssue.color};opacity:0.85;margin-top:4px;line-height:1.5;">${e(brief.canIssueTodayExplanation)}</p>` : ""}
      ${(brief.canIssueTodayConditions ?? []).length ? `<ul style="margin-top:8px;padding-right:16px;">
        ${brief.canIssueTodayConditions.map((c) => `<li style="font-size:11px;color:${canIssue.color};margin-bottom:2px;">${e(c)}</li>`).join("")}
      </ul>` : ""}
    </div>
  </div>

  ${recItems ? section("التوصية القانونية النهائية", "⭐", recItems) : ""}
  ${missingItems ? section("المتطلبات الناقصة", "🛡️", missingItems) : ""}
  ${docItems ? section("الوثائق المطلوبة", "📄", docItems) : ""}
  ${authContent ? section("الجهة الحكومية المختصة", "🏛️", authContent) : ""}
  ${timelineItems ? section("الجدول الزمني القانوني", "⏱️", timelineItems) : ""}
  ${letterContent ? section("مسودة الخطاب / الطلب / الشكوى", "✍️", letterContent) : ""}
  ${legItems ? section("التشريعات المنطبقة", "📖", legItems) : ""}
  ${precedentsContent ? section("السوابق القضائية", "⚖️", precedentsContent) : ""}
  ${stepsItems ? section("الخطوات العملية الفورية", "✅", stepsItems) : ""}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:10px;color:#94a3b8;">
      هذا التقييم صادر عن نظام المكتب القانوني الذكي · للاستخدام المرجعي فقط · يُنصح بمراجعة محامٍ مرخص قبل اتخاذ أي قرار قانوني
    </p>
  </div>
</body>
</html>`;
}

// ─── Main export function ──────────────────────────────────────────────────────

export async function exportBriefToPdf(
  brief: DecisionBrief,
  scenarioTitleAr: string,
  roleTitle: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  onProgress?.("جارٍ تحضير مستند PDF...");

  // Build the HTML document string
  const html = buildPdfHtml(brief, scenarioTitleAr, roleTitle);

  // Create a sandboxed off-screen iframe.
  // - `sandbox="allow-same-origin"` permits DOM access (needed by html2canvas) but
  //   BLOCKS script execution entirely — so injected <script> tags cannot run.
  // - Positioned off-screen so it has no visual effect.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.style.cssText = `
    position:fixed;left:-9999px;top:0;
    width:794px;height:1px;
    border:none;visibility:hidden;
  `;
  document.body.appendChild(iframe);

  try {
    // Write HTML into the sandboxed document.
    // Because sandbox="allow-same-origin" does NOT include allow-scripts,
    // any <script> tag (even inline) is inert.
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for web fonts to load (IBM Plex Sans Arabic via Google Fonts)
    onProgress?.("جارٍ تحميل الخطوط العربية...");
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const body = doc.body;
    const fullHeight = body.scrollHeight;
    iframe.style.height = `${fullHeight}px`;

    onProgress?.("جارٍ تصيير المحتوى...");
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Capture with html2canvas — renders the sandboxed iframe body
    const canvas = await html2canvas(body, {
      scale: 2,           // retina quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      logging: false,
    });

    // Slice the canvas into A4 pages and assemble the PDF
    onProgress?.("جارٍ إنشاء ملف PDF...");
    const A4_W_PT = 595.28;
    const A4_H_PT = 841.89;
    const IMG_W_PX = canvas.width;                          // 794 * scale
    const PAGE_H_PX = Math.floor((A4_H_PT / A4_W_PT) * IMG_W_PX);

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    let yOffset = 0;
    let pageIndex = 0;

    while (yOffset < canvas.height) {
      const sliceH = Math.min(PAGE_H_PX, canvas.height - yOffset);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = IMG_W_PX;
      pageCanvas.height = PAGE_H_PX;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, IMG_W_PX, PAGE_H_PX);
      ctx.drawImage(canvas, 0, yOffset, IMG_W_PX, sliceH, 0, 0, IMG_W_PX, sliceH);

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, A4_W_PT, A4_H_PT);

      yOffset += PAGE_H_PX;
      pageIndex++;
    }

    // Derive a safe filename from the Arabic scenario title
    const safeName = scenarioTitleAr
      .replace(/\s+/g, "-")
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, "");
    pdf.save(`${safeName || "التقييم-القانوني"}.pdf`);
    onProgress?.("تم تنزيل PDF بنجاح ✅");
  } finally {
    document.body.removeChild(iframe);
  }
}
