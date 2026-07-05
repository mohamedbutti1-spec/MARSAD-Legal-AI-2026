/**
 * Administrative Decision Passport (ADP) Generator
 * ─────────────────────────────────────────────────
 * Produces an official UAE Government PDF audit document from a MARSAD decision.
 * Each ADP is generated fresh on demand — no DB state is written.
 *
 * Document sections:
 *   1  Cover Page            — UAE emblem, MARSAD header, QR, SHA-256 hash
 *   2  Executive Legal Summary — court-ready single page
 *   3  Decision Constitutional Identity (DCI)
 *   4  14-Stage Replay Timeline
 *   5+ Stage Detail Records  — one per completed stage
 *   N  Evidence Chain
 *   N  AI Reasoning Summary
 *   N  Al-Shamsi Theory Dimensions (16)
 *   N  Indices & Risk Assessment
 *   N  Constitutional Review Summary
 *   N  Digital Signature Block
 */

import { createHash } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionDciTable,
  decisionJdpTable,
  decisionReplayEventsTable,
  REPLAY_STAGE_KEYS,
  REPLAY_STAGE_LABELS_AR,
  judicialReviewsTable,
  decisionMemoryTable,
  evidenceLedgerTable,
} from "@workspace/db";
import type { JudicialDimension, ConstitutionalDefect } from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdpData {
  decision: typeof decisionsTable.$inferSelect;
  dci: typeof decisionDciTable.$inferSelect | null;
  jdp: typeof decisionJdpTable.$inferSelect | null;
  replayEvents: (typeof decisionReplayEventsTable.$inferSelect)[];
  judicialReview: typeof judicialReviewsTable.$inferSelect | null;
  memory: typeof decisionMemoryTable.$inferSelect | null;
  evidenceChain: (typeof evidenceLedgerTable.$inferSelect)[];
  generatedAt: string;
  docHash: string;
  qrDataUrl: string;
  docSerial: string;
}

// ─── Data Assembly ────────────────────────────────────────────────────────────

async function assembleAdpData(decisionId: number): Promise<AdpData> {
  const [
    decisionRows,
    dciRows,
    jdpRows,
    replayEvents,
    judicialReviewRows,
    memoryRows,
    evidenceChain,
  ] = await Promise.all([
    db.select().from(decisionsTable).where(eq(decisionsTable.id, decisionId)).limit(1),
    db.select().from(decisionDciTable).where(eq(decisionDciTable.decisionId, decisionId)).limit(1),
    db.select().from(decisionJdpTable).where(eq(decisionJdpTable.decisionId, decisionId)).limit(1),
    db.select().from(decisionReplayEventsTable).where(eq(decisionReplayEventsTable.decisionId, decisionId)),
    db.select().from(judicialReviewsTable).where(eq(judicialReviewsTable.decisionId, decisionId)).limit(1),
    db.select().from(decisionMemoryTable).where(eq(decisionMemoryTable.decisionId, decisionId)).orderBy(desc(decisionMemoryTable.decisionVersion)).limit(1),
    db.select().from(evidenceLedgerTable).where(eq(evidenceLedgerTable.decisionId, decisionId)),
  ]);

  const decision = decisionRows[0];
  if (!decision) throw new Error(`Decision ${decisionId} not found`);

  const dci = dciRows[0] ?? null;
  const jdp = jdpRows[0] ?? null;
  const judicialReview = judicialReviewRows[0] ?? null;
  const memory = memoryRows[0] ?? null;
  const generatedAt = new Date().toISOString();

  // Compute document hash over key fields (deterministic)
  const hashInput = JSON.stringify({
    decisionId,
    caseNumber: decision.caseNumber,
    titleAr: decision.titleAr,
    status: decision.status,
    updatedAt: decision.updatedAt,
    completeAuditHash: dci?.completeAuditHash ?? null,
    replayHashes: replayEvents.map((e) => e.auditHash).sort(),
    evidenceChainHash: evidenceChain[evidenceChain.length - 1]?.chainHash ?? null,
    generatedAt,
  });
  const docHash = createHash("sha256").update(hashInput).digest("hex");

  // QR code encodes: version, decision ID, case number, hash, timestamp
  const qrPayload = JSON.stringify({
    v: "1.0",
    sys: "MARSAD",
    case: decision.caseNumber,
    id: decisionId,
    hash: docHash,
    ts: generatedAt,
    env: process.env.NODE_ENV === "production" ? "PROD" : "ALPHA",
  });
  const qrDataUrl = await generateQrDataUrl(qrPayload);

  // Document serial: ADP-{caseNumber}-{YYYYMMDD}
  const datePart = generatedAt.slice(0, 10).replace(/-/g, "");
  const docSerial = `ADP-${decision.caseNumber}-${datePart}`;

  return {
    decision,
    dci,
    jdp,
    replayEvents,
    judicialReview,
    memory,
    evidenceChain,
    generatedAt,
    docHash,
    qrDataUrl,
    docSerial,
  };
}

async function generateQrDataUrl(text: string): Promise<string> {
  const qrcode = await import("qrcode").then((m) => m.default ?? m);
  return qrcode.toDataURL(text, {
    errorCorrectionLevel: "M",
    width: 160,
    margin: 1,
    color: { dark: "#0A1628", light: "#FFFFFF" },
  });
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function fmt(v: string | null | undefined, fallback = "—"): string {
  return v?.trim() ? esc(v.trim()) : fallback;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleDateString("ar-AE", {
      year: "numeric", month: "long", day: "numeric",
      timeZone: "Asia/Dubai",
    });
  } catch {
    return iso;
  }
}

function fmtDateEn(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleDateString("en-AE", {
      year: "numeric", month: "long", day: "numeric",
      timeZone: "Asia/Dubai",
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-AE", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Dubai",
    });
  } catch {
    return iso;
  }
}

function hashShort(h: string | null | undefined): string {
  if (!h) return "—";
  return h.slice(0, 8) + "…" + h.slice(-8);
}

function notProcessed(): string {
  return `<span class="not-processed">لم يُعالَج بعد / Not yet processed</span>`;
}

function badge(label: string, colour: "green" | "amber" | "red" | "blue" | "grey" | "navy"): string {
  return `<span class="badge badge-${colour}">${esc(label)}</span>`;
}

function riskBadge(level: string | null | undefined): string {
  if (!level) return badge("غير محدد", "grey");
  const map: Record<string, [string, "green"|"amber"|"red"|"grey"]> = {
    low:      ["منخفض / Low", "green"],
    moderate: ["متوسط / Moderate", "amber"],
    high:     ["عالٍ / High", "red"],
    critical: ["حرج / Critical", "red"],
  };
  const [label, colour] = map[level] ?? [`${level}`, "grey"];
  return badge(label, colour);
}

function statusBadge(status: string | null | undefined): string {
  if (!status) return badge("معلّق", "grey");
  const map: Record<string, [string, "green"|"amber"|"red"|"grey"|"blue"|"navy"]> = {
    complete:   ["مكتمل", "green"],
    completed:  ["مكتمل", "green"],
    pending:    ["معلّق", "grey"],
    passed:     ["اجتاز", "green"],
    failed:     ["لم يجتز", "red"],
    running:    ["جارٍ", "amber"],
    sealed:     ["مختوم", "navy"],
    signed:     ["موقّع", "navy"],
  };
  const [label, colour] = map[status] ?? [status, "grey"];
  return badge(label, colour);
}

function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return "—";
  const map: Record<string, string> = {
    likely_lawful:               "مشروع على الأرجح",
    likely_partially_unlawful:   "مشروع جزئياً على الأرجح",
    likely_void:                 "باطل على الأرجح",
    requires_further_review:     "يستلزم مراجعة إضافية",
  };
  return esc(map[outcome] ?? outcome);
}

function remedyLabel(remedy: string | null | undefined): string {
  if (!remedy) return "—";
  const map: Record<string, string> = {
    uphold:                    "التأييد",
    annul:                     "الإلغاء",
    partial_annulment:         "الإلغاء الجزئي",
    remit_for_reconsideration: "الإعادة للنظر",
    request_further_evidence:  "طلب أدلة إضافية",
  };
  return esc(map[remedy] ?? remedy);
}

function dimensionStatusBadge(status: string): string {
  const map: Record<string, [string, "green"|"amber"|"red"|"grey"]> = {
    compliant:           ["ممتثل", "green"],
    minor_concern:       ["ملاحظة بسيطة", "amber"],
    significant_concern: ["ملاحظة جوهرية", "amber"],
    deficient:           ["قاصر", "red"],
    not_assessed:        ["لم يُقيَّم", "grey"],
  };
  const [label, colour] = map[status] ?? [status, "grey"];
  return badge(label, colour);
}

function scoreBar(score: number | null | undefined, max = 100): string {
  if (score === null || score === undefined) return "<span class='score-na'>—</span>";
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const colour = pct <= 33 ? "#10b981" : pct <= 66 ? "#f59e0b" : "#ef4444";
  return `
    <div class="score-bar-wrap">
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${pct.toFixed(1)}%;background:${colour};"></div>
      </div>
      <span class="score-label">${score.toFixed(1)}</span>
    </div>`;
}

function indexBar(value: number | null | undefined, label: string): string {
  if (value === null || value === undefined) return `<div class="index-row"><span class="index-label">${label}</span><span class="not-processed">—</span></div>`;
  const pct = Math.min(100, Math.max(0, value));
  const colour = pct >= 66 ? "#10b981" : pct >= 33 ? "#f59e0b" : "#ef4444";
  return `
    <div class="index-row">
      <span class="index-label">${label}</span>
      <div class="index-bar-wrap">
        <div class="index-bar-track">
          <div class="index-bar-fill" style="width:${pct.toFixed(1)}%;background:${colour};"></div>
        </div>
        <span class="index-value">${pct.toFixed(1)}</span>
      </div>
    </div>`;
}

function tableRow(...cells: string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

function headerRow(...cells: string[]): string {
  return `<tr>${cells.map((c) => `<th>${c}</th>`).join("")}</tr>`;
}

function sectionTitle(ar: string, en: string, extra = ""): string {
  return `<div class="section-title${extra ? " " + extra : ""}">
    <span class="section-ar">${ar}</span>
    <span class="section-en">${en}</span>
  </div>`;
}

function fieldRow(labelAr: string, labelEn: string, value: string): string {
  return `
    <div class="field-row">
      <div class="field-label"><span class="label-ar">${labelAr}</span><span class="label-en">${labelEn}</span></div>
      <div class="field-value">${value}</div>
    </div>`;
}

// ─── UAE Government Emblem SVG ────────────────────────────────────────────────

const UAE_EMBLEM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="80" height="80">
  <circle cx="60" cy="60" r="58" fill="none" stroke="#C8A951" stroke-width="2"/>
  <circle cx="60" cy="60" r="50" fill="#0A1628"/>
  <!-- Stylised falcon body -->
  <ellipse cx="60" cy="62" rx="18" ry="26" fill="#C8A951"/>
  <!-- Wings -->
  <path d="M42 62 Q20 48 18 35 Q28 40 42 50Z" fill="#C8A951"/>
  <path d="M78 62 Q100 48 102 35 Q92 40 78 50Z" fill="#C8A951"/>
  <!-- Head -->
  <circle cx="60" cy="36" r="10" fill="#C8A951"/>
  <!-- Beak -->
  <path d="M60 43 L55 50 L65 50Z" fill="#0A1628"/>
  <!-- Eye -->
  <circle cx="56" cy="35" r="2" fill="#0A1628"/>
  <!-- Shield (flag representation) -->
  <rect x="50" y="60" width="20" height="22" rx="3" fill="#FFF"/>
  <rect x="50" y="60" width="5" height="22" rx="1" fill="#009900"/>
  <rect x="55" y="60" width="10" height="22" fill="#FFFFFF"/>
  <rect x="65" y="60" width="5" height="22" rx="1" fill="#000000"/>
  <rect x="50" y="60" width="20" height="6" rx="0" fill="#CC0000"/>
  <!-- Talons -->
  <path d="M50 88 Q42 94 40 100" stroke="#C8A951" stroke-width="2" fill="none"/>
  <path d="M70 88 Q78 94 80 100" stroke="#C8A951" stroke-width="2" fill="none"/>
  <text x="60" y="116" text-anchor="middle" font-size="6" fill="#C8A951" font-family="serif">دولة الإمارات العربية المتحدة</text>
</svg>`;

// ─── CSS Styles ───────────────────────────────────────────────────────────────

const ADP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Sans:wght@400;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    direction: rtl;
    font-family: 'Noto Naskh Arabic', 'Arial Unicode MS', Tahoma, sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #1a1a2e;
    background: #fff;
  }

  /* ── Page breaks ── */
  .page-break { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }

  /* ── Cover page ── */
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #fff;
    position: relative;
  }
  .cover-header {
    background: #0A1628;
    color: #fff;
    padding: 20px 30px 16px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .cover-header-text { flex: 1; }
  .cover-header-text .marsad-ar {
    font-size: 22pt;
    font-weight: 700;
    color: #C8A951;
    letter-spacing: 1px;
  }
  .cover-header-text .marsad-en {
    font-size: 9pt;
    color: #cbd5e1;
    font-family: 'Noto Sans', sans-serif;
    font-weight: 600;
    letter-spacing: 2px;
    direction: ltr;
    text-align: left;
  }
  .cover-header-text .marsad-sub {
    font-size: 8pt;
    color: #94a3b8;
    font-family: 'Noto Sans', sans-serif;
    direction: ltr;
    text-align: left;
  }

  .classification-banner {
    background: #7f1d1d;
    color: #fee2e2;
    text-align: center;
    padding: 5px 0;
    font-size: 9pt;
    font-family: 'Noto Sans', sans-serif;
    font-weight: 700;
    letter-spacing: 3px;
    direction: ltr;
  }

  .cover-body {
    padding: 40px 50px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .doc-type-line {
    border-top: 3px solid #C8A951;
    border-bottom: 1px solid #C8A951;
    padding: 12px 0;
    margin-bottom: 30px;
    text-align: center;
  }
  .doc-type-ar {
    font-size: 20pt;
    font-weight: 700;
    color: #0A1628;
  }
  .doc-type-en {
    font-size: 10pt;
    color: #64748b;
    font-family: 'Noto Sans', sans-serif;
    font-weight: 600;
    letter-spacing: 1px;
    direction: ltr;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 30px;
    margin-bottom: 30px;
  }
  .cover-meta-item { }
  .cover-meta-label {
    font-size: 7.5pt;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: 'Noto Sans', sans-serif;
  }
  .cover-meta-value {
    font-size: 10pt;
    color: #0A1628;
    font-weight: 600;
    margin-top: 2px;
  }
  .cover-meta-value.case-number {
    font-size: 13pt;
    font-family: 'Noto Sans', monospace;
    color: #C8A951;
    font-weight: 700;
    direction: ltr;
  }

  .cover-title-box {
    background: #f8fafc;
    border-right: 4px solid #0A1628;
    padding: 14px 18px;
    margin-bottom: 30px;
  }
  .cover-title-ar {
    font-size: 14pt;
    font-weight: 700;
    color: #0A1628;
  }
  .cover-title-en {
    font-size: 9pt;
    color: #64748b;
    margin-top: 4px;
    direction: ltr;
    font-family: 'Noto Sans', sans-serif;
  }

  .cover-footer {
    margin-top: auto;
    padding: 20px 50px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 2px solid #0A1628;
  }
  .cover-qr { text-align: center; }
  .cover-qr img { width: 120px; height: 120px; display: block; margin-bottom: 6px; }
  .cover-qr .qr-label {
    font-size: 7pt;
    color: #64748b;
    font-family: 'Noto Sans', sans-serif;
    direction: ltr;
  }
  .cover-hash-block { text-align: left; direction: ltr; }
  .cover-hash-block .hash-title {
    font-size: 7.5pt;
    font-weight: 700;
    color: #0A1628;
    font-family: 'Noto Sans', sans-serif;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .cover-hash-block .hash-value {
    font-size: 7pt;
    font-family: monospace;
    color: #334155;
    word-break: break-all;
    max-width: 260px;
    background: #f1f5f9;
    padding: 4px 6px;
    border-radius: 3px;
  }
  .cover-hash-block .serial-value {
    font-size: 8pt;
    font-family: 'Noto Sans', monospace;
    font-weight: 700;
    color: #C8A951;
    margin-top: 6px;
  }

  /* ── Section layouts ── */
  .section {
    padding: 24px 40px;
  }
  .section-title {
    display: flex;
    flex-direction: column;
    border-bottom: 2px solid #0A1628;
    padding-bottom: 8px;
    margin-bottom: 18px;
  }
  .section-ar {
    font-size: 14pt;
    font-weight: 700;
    color: #0A1628;
  }
  .section-en {
    font-size: 8pt;
    font-family: 'Noto Sans', sans-serif;
    color: #64748b;
    direction: ltr;
  }

  .section-header-bar {
    background: #0A1628;
    color: #fff;
    padding: 10px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .section-header-bar .num {
    font-size: 20pt;
    font-weight: 700;
    color: #C8A951;
    font-family: 'Noto Sans', monospace;
    direction: ltr;
  }
  .section-header-bar .title-ar {
    font-size: 12pt;
    font-weight: 700;
    color: #fff;
  }
  .section-header-bar .title-en {
    font-size: 8pt;
    font-family: 'Noto Sans', sans-serif;
    color: #94a3b8;
    direction: ltr;
  }

  /* ── Field rows ── */
  .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .field-row {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 0;
    gap: 12px;
    align-items: flex-start;
  }
  .field-label {
    min-width: 140px;
    max-width: 160px;
    flex-shrink: 0;
  }
  .label-ar { display: block; font-size: 8.5pt; font-weight: 600; color: #334155; }
  .label-en { display: block; font-size: 7pt; color: #94a3b8; font-family: 'Noto Sans', sans-serif; direction: ltr; }
  .field-value { font-size: 9.5pt; color: #1a1a2e; flex: 1; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: #0A1628; color: #C8A951; padding: 6px 8px; text-align: right; font-weight: 600; border: 1px solid #1e3a5f; }
  td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr.status-complete td { border-right: 3px solid #10b981; }
  tr.status-pending td { border-right: 3px solid #94a3b8; }
  tr.status-virtual td { border-right: 3px solid #C8A951; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 3px;
    font-size: 7.5pt;
    font-weight: 600;
    font-family: 'Noto Sans', sans-serif;
    direction: ltr;
  }
  .badge-green  { background: #dcfce7; color: #166534; }
  .badge-amber  { background: #fef9c3; color: #854d0e; }
  .badge-red    { background: #fee2e2; color: #991b1b; }
  .badge-blue   { background: #dbeafe; color: #1e40af; }
  .badge-grey   { background: #f1f5f9; color: #64748b; }
  .badge-navy   { background: #0A1628; color: #C8A951; }

  /* ── Score bars ── */
  .score-bar-wrap { display: flex; align-items: center; gap: 6px; }
  .score-bar-track { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
  .score-bar-fill  { height: 100%; border-radius: 3px; }
  .score-label { font-size: 7.5pt; font-family: monospace; color: #334155; min-width: 28px; direction: ltr; }
  .score-na { color: #94a3b8; font-size: 8pt; }

  /* ── Index bars ── */
  .index-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .index-label { min-width: 120px; font-size: 8.5pt; font-weight: 600; color: #334155; }
  .index-bar-wrap { display: flex; align-items: center; gap: 8px; flex: 1; }
  .index-bar-track { flex: 1; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
  .index-bar-fill  { height: 100%; border-radius: 5px; }
  .index-value { font-size: 9pt; font-weight: 700; font-family: monospace; color: #0A1628; min-width: 36px; direction: ltr; }

  /* ── Not processed placeholder ── */
  .not-processed {
    color: #94a3b8;
    font-style: italic;
    font-size: 8.5pt;
  }

  /* ── Stage detail card ── */
  .stage-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .stage-card-header {
    background: #1e3a5f;
    color: #fff;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .stage-card-header .stage-num {
    font-family: 'Noto Sans', monospace;
    font-size: 9pt;
    color: #C8A951;
    direction: ltr;
  }
  .stage-card-header .stage-name { font-size: 10pt; font-weight: 700; }
  .stage-card-body { padding: 12px 16px; }
  .stage-sub-section { margin-bottom: 10px; }
  .stage-sub-label {
    font-size: 8pt;
    font-weight: 700;
    color: #0A1628;
    border-bottom: 1px solid #C8A951;
    padding-bottom: 2px;
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
  }
  .stage-sub-label .en { font-family: 'Noto Sans', sans-serif; font-size: 7pt; color: #94a3b8; direction: ltr; }
  .stage-sub-content { font-size: 8.5pt; color: #334155; }

  /* ── Evidence chain ── */
  .evidence-entry {
    border-right: 3px solid #C8A951;
    padding: 6px 12px;
    margin-bottom: 8px;
    background: #f8fafc;
    font-size: 8.5pt;
  }
  .evidence-entry .seq { font-family: monospace; color: #C8A951; font-weight: 700; font-size: 9pt; direction: ltr; }
  .evidence-entry .action { font-weight: 600; color: #0A1628; }
  .evidence-entry .hash { font-family: monospace; font-size: 7pt; color: #64748b; direction: ltr; word-break: break-all; }

  /* ── Dimension rows ── */
  .dim-row {
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 0;
    display: grid;
    grid-template-columns: 30px 160px 80px 80px 1fr;
    gap: 8px;
    align-items: start;
  }
  .dim-num  { font-family: monospace; font-size: 8pt; color: #C8A951; font-weight: 700; direction: ltr; }
  .dim-name { font-size: 8.5pt; font-weight: 600; color: #0A1628; }
  .dim-status { }
  .dim-risk { }
  .dim-finding { font-size: 8pt; color: #334155; }
  .cji-group-header {
    background: #f1f5f9;
    padding: 5px 8px;
    margin: 10px 0 4px;
    font-size: 8pt;
    font-weight: 700;
    color: #0A1628;
    border-right: 3px solid #C8A951;
  }

  /* ── Signature block ── */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig-box {
    border: 1px solid #0A1628;
    border-radius: 4px;
    overflow: hidden;
    text-align: center;
  }
  .sig-box-header {
    background: #0A1628;
    color: #C8A951;
    padding: 6px;
    font-size: 8pt;
    font-weight: 700;
  }
  .sig-box-body {
    padding: 12px 8px;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }
  .sig-line { border-top: 1px dashed #0A1628; width: 80%; margin-top: 30px; }
  .sig-name { font-size: 7.5pt; color: #64748b; }

  /* ── Integrity table ── */
  .integrity-row {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    padding: 5px 0;
    gap: 12px;
  }
  .integrity-key { min-width: 180px; font-size: 8pt; font-weight: 600; color: #334155; }
  .integrity-val { font-size: 7.5pt; font-family: monospace; color: #0A1628; word-break: break-all; flex: 1; direction: ltr; }

  /* ── Executive summary special styles ── */
  .exec-summary-box {
    border: 2px solid #0A1628;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .exec-summary-header {
    background: #0A1628;
    color: #C8A951;
    padding: 8px 16px;
    font-size: 11pt;
    font-weight: 700;
  }
  .exec-summary-body { padding: 16px; }

  .risk-block {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    flex-wrap: wrap;
  }
  .risk-item {
    flex: 1;
    min-width: 120px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 10px;
    text-align: center;
  }
  .risk-item-label { font-size: 7.5pt; color: #64748b; font-weight: 600; margin-bottom: 4px; }
  .risk-item-value { font-size: 11pt; font-weight: 700; color: #0A1628; }

  /* ── Footer on every page ── */
  @page { margin: 16mm; }
`;

// ─── Section Builders ─────────────────────────────────────────────────────────

function buildCoverPage(d: AdpData): string {
  const dec = d.decision;
  return `
  <div class="cover">
    <div class="cover-header">
      <div>${UAE_EMBLEM_SVG}</div>
      <div class="cover-header-text">
        <div class="marsad-ar">مرصد (MARSAD)</div>
        <div class="marsad-en">MARSAD — Intelligent Administrative Decision Platform</div>
        <div class="marsad-sub">M. Al-Shamsi Framework for Constitutional Administrative Decision-Making · Alpha 1.0</div>
      </div>
    </div>
    <div class="classification-banner">OFFICIAL — FOR ADMINISTRATIVE AND JUDICIAL USE ONLY — رسمي — للاستخدام الإداري والقضائي فقط</div>

    <div class="cover-body">
      <div class="doc-type-line">
        <div class="doc-type-ar">جواز القرار الإداري</div>
        <div class="doc-type-en">Administrative Decision Passport (ADP)</div>
      </div>

      <div class="cover-title-box">
        <div class="cover-title-ar">${fmt(dec.titleAr)}</div>
        ${dec.titleEn ? `<div class="cover-title-en">${esc(dec.titleEn)}</div>` : ""}
      </div>

      <div class="cover-meta-grid">
        <div class="cover-meta-item">
          <div class="cover-meta-label">رقم القضية / Case Number</div>
          <div class="cover-meta-value case-number">${esc(dec.caseNumber)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">الرقم التسلسلي للجواز / Passport Serial</div>
          <div class="cover-meta-value case-number">${esc(d.docSerial)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">جهة الإصدار / Issuing Authority</div>
          <div class="cover-meta-value">${fmt(dec.issuingAuthority)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">الوحدة التنظيمية / Organizational Unit</div>
          <div class="cover-meta-value">${fmt(dec.organizationUnit)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">نوع القرار / Decision Type</div>
          <div class="cover-meta-value">${fmt(dec.decisionType)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">الاختصاص القضائي / Jurisdiction</div>
          <div class="cover-meta-value">${fmt(dec.jurisdiction)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">الحالة / Status</div>
          <div class="cover-meta-value">${statusBadge(dec.status)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">تاريخ الإنشاء / Created</div>
          <div class="cover-meta-value">${fmtDate(dec.createdAt?.toString())}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">تاريخ الإصدار / Generated</div>
          <div class="cover-meta-value">${fmtDate(d.generatedAt)}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">الإصدار / Platform Version</div>
          <div class="cover-meta-value">MARSAD Alpha 1.0</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div class="cover-qr">
        <img src="${d.qrDataUrl}" alt="QR Verification Code" />
        <div class="qr-label">Scan to verify document integrity</div>
        <div class="qr-label">امسح لتحقق من سلامة الوثيقة</div>
      </div>
      <div class="cover-hash-block">
        <div class="hash-title">SHA-256 DOCUMENT INTEGRITY HASH</div>
        <div class="hash-value">${esc(d.docHash)}</div>
        <div class="serial-value">${esc(d.docSerial)}</div>
        <div class="qr-label" style="margin-top:6px;font-family:'Noto Sans',sans-serif;font-size:7pt;color:#64748b;direction:ltr;">
          Generated: ${fmtDateEn(d.generatedAt)} · MARSAD Alpha 1.0
        </div>
      </div>
    </div>
  </div>`;
}

function buildExecutiveSummary(d: AdpData): string {
  const dec = d.decision;
  const jr = d.judicialReview;
  const mem = d.memory;
  const dci = d.dci;

  const riskScore = jr?.constitutionalRiskScore;
  const riskLevel = jr?.riskLevel ?? null;
  const lsi = mem?.lsi ?? null;
  const hii = mem?.humanInfluenceIndex ?? null;
  const outcome = jr?.outcomePrediction;
  const remedy = jr?.remedyRecommendation;

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div>
        <div class="title-ar">الملخص القانوني التنفيذي</div>
        <div class="title-en">Executive Legal Summary</div>
      </div>
      <div class="num">02</div>
    </div>
    <div class="section">
      <p style="font-size:7.5pt;color:#64748b;font-family:'Noto Sans',sans-serif;direction:ltr;margin-bottom:16px;">
        Prepared for submission to courts, administrative appeal committees, and audit authorities.
        This summary reflects the decision record as at the time of ADP generation.
      </p>

      <div class="exec-summary-box">
        <div class="exec-summary-header">بيانات القرار الأساسية / Core Decision Data</div>
        <div class="exec-summary-body">
          ${fieldRow("عنوان القرار", "Decision Title", fmt(dec.titleAr))}
          ${fieldRow("رقم القضية", "Case Number", `<span style="font-family:monospace;direction:ltr;">${esc(dec.caseNumber)}</span>`)}
          ${fieldRow("جهة الإصدار", "Issuing Authority", fmt(dec.issuingAuthority))}
          ${fieldRow("نوع القرار", "Decision Type", fmt(dec.decisionType))}
          ${fieldRow("الاختصاص", "Jurisdiction", fmt(dec.jurisdiction))}
          ${fieldRow("الحالة", "Status", statusBadge(dec.status))}
          ${fieldRow("تاريخ الإنشاء", "Created Date", fmtDate(dec.createdAt?.toString()))}
          ${dci ? fieldRow("السند القانوني", "Legal Basis", dci.applicableLegalBasis?.length ? dci.applicableLegalBasis.map(esc).join(" · ") : notProcessed()) : ""}
          ${dci ? fieldRow("الغاية من القرار", "Purpose of Decision", fmt(dci.purposeOfDecision)) : ""}
          ${dci ? fieldRow("المسؤول عن القرار", "Human Decision Owner", fmt(dci.humanDecisionOwner)) : ""}
        </div>
      </div>

      <div class="exec-summary-box avoid-break">
        <div class="exec-summary-header">الامتثال الدستوري والقانوني / Constitutional & Legal Compliance</div>
        <div class="exec-summary-body">
          ${dci ? fieldRow("التحقق الدستوري", "Constitutional Validation", statusBadge(dci.constitutionalValidationStatus)) : ""}
          ${dci ? fieldRow("امتثال إطار الشامسي", "Al-Shamsi Framework", badge(dci.alShamsiFrameworkCompliance, "navy")) : ""}
          ${dci ? fieldRow("الشرعية القانونية", "Legality Status", statusBadge(dci.legalityStatus)) : ""}
          ${dci ? fieldRow("التناسب", "Proportionality", statusBadge(dci.proportionalityStatus)) : ""}
          ${dci ? fieldRow("مستوى المراقبة البشرية", "Human Oversight Level", badge(dci.humanOversightLevel, "blue")) : ""}
          ${dci ? fieldRow("مستوى مشاركة الذكاء الاصطناعي", "AI Participation Level", badge(dci.aiParticipationLevel, "grey")) : ""}
          ${dci ? fieldRow("مؤشر الأثر البشري", "Human Influence Index", badge(dci.humanInfluenceIndex, "navy")) : ""}
        </div>
      </div>

      <div class="risk-block avoid-break">
        <div class="risk-item">
          <div class="risk-item-label">درجة الخطورة الدستورية<br/>Constitutional Risk Score</div>
          <div class="risk-item-value">${riskScore !== null && riskScore !== undefined ? `${riskScore}<small style="font-size:8pt">/100</small>` : "—"}</div>
          ${riskBadge(riskLevel)}
        </div>
        <div class="risk-item">
          <div class="risk-item-label">مؤشر الشرعية (LSI)<br/>Legitimacy Score Index</div>
          <div class="risk-item-value">${lsi !== null && lsi !== undefined ? lsi.toFixed(1) : "—"}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">مؤشر الأثر البشري<br/>Human Influence Index</div>
          <div class="risk-item-value">${hii !== null && hii !== undefined ? (hii as number).toFixed(1) : "—"}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">مرحلة التقدم<br/>Progress</div>
          <div class="risk-item-value">${dec.stagesCompleted ? (dec.stagesCompleted as string[]).length : 0}<small style="font-size:8pt">/11</small></div>
        </div>
      </div>

      ${outcome ? `
      <div class="exec-summary-box avoid-break" style="margin-top:16px;">
        <div class="exec-summary-header">نتيجة المراجعة القضائية / Judicial Review Outcome</div>
        <div class="exec-summary-body">
          ${fieldRow("النتيجة المتوقعة", "Predicted Outcome", `${outcomeLabel(outcome.outcome)} — ${badge(`${outcome.confidencePercentage}%`, "navy")}`)}
          ${fieldRow("الأساس", "Reasoning", fmt(outcome.reasoning))}
          ${outcome.primaryRisk ? fieldRow("المخاطر الرئيسية", "Primary Risk", fmt(outcome.primaryRisk)) : ""}
          ${remedy ? fieldRow("التوصية", "Recommendation", remedyLabel(remedy.remedy) + " — " + badge(remedy.urgency, remedy.urgency === "immediate" ? "red" : "amber")) : ""}
        </div>
      </div>` : ""}

      <div class="exec-summary-box avoid-break" style="margin-top:16px;">
        <div class="exec-summary-header">إشعار الامتثال للجهات القضائية / Compliance Notice for Judicial Authorities</div>
        <div class="exec-summary-body" style="font-size:8pt;color:#334155;line-height:1.7;">
          <p>يُفيد هذا الجواز بأن القرار الإداري المُشار إليه قد مرّ عبر منظومة مرصد (MARSAD) للقرارات الإدارية الذكية،
          وفق أحكام إطار الشامسي للقرار الإداري الدستوري. جميع مراحل صنع القرار مُوثَّقة ومُدقَّقة رقمياً.
          وقد احتفظ المسؤول البشري المختص بالسلطة التقديرية النهائية طوال دورة حياة القرار.</p>
          <p style="margin-top:8px;direction:ltr;font-family:'Noto Sans',sans-serif;">
          This passport certifies that the referenced administrative decision was processed through the MARSAD
          Intelligent Administrative Decision Platform in accordance with the M. Al-Shamsi Constitutional
          Administrative Decision Framework. All decision stages are digitally audited and immutably recorded.
          The competent human official retained final discretionary authority throughout the decision lifecycle.</p>
        </div>
      </div>
    </div>
  </div>`;
}

function buildDciSection(d: AdpData): string {
  const dci = d.dci;
  if (!dci) {
    return `
    <div class="page-break">
      <div class="section-header-bar">
        <div><div class="title-ar">الهوية الدستورية للقرار DCI</div><div class="title-en">Decision Constitutional Identity (DCI)</div></div>
        <div class="num">03</div>
      </div>
      <div class="section"><p class="not-processed">لم يُعالَج بعد / Not yet processed</p></div>
    </div>`;
  }

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">الهوية الدستورية للقرار DCI</div><div class="title-en">Decision Constitutional Identity (DCI)</div></div>
      <div class="num">03</div>
    </div>
    <div class="section">
      <div style="margin-bottom:16px;" class="avoid-break">
        ${sectionTitle("بيانات القرار", "Decision Data")}
        ${fieldRow("نوع القرار", "Decision Type", fmt(dci.decisionType))}
        ${fieldRow("السلطة المختصة", "Competent Authority", fmt(dci.competentAuthority))}
        ${fieldRow("السند القانوني المطبّق", "Applicable Legal Basis", dci.applicableLegalBasis?.length ? dci.applicableLegalBasis.map(esc).join("<br/>") : notProcessed())}
        ${fieldRow("غاية القرار", "Purpose of Decision", fmt(dci.purposeOfDecision))}
        ${fieldRow("مالك القرار البشري", "Human Decision Owner", fmt(dci.humanDecisionOwner))}
      </div>

      <div style="margin-bottom:16px;" class="avoid-break">
        ${sectionTitle("تقييمات المشاركة", "Participation Assessments")}
        ${fieldRow("مستوى مشاركة الذكاء الاصطناعي", "AI Participation Level", badge(dci.aiParticipationLevel, "grey"))}
        ${fieldRow("مستوى الرقابة البشرية", "Human Oversight Level", badge(dci.humanOversightLevel, "blue"))}
        ${fieldRow("مستوى التفسيرية", "Explainability Level", badge(dci.explainabilityLevel, "blue"))}
        ${fieldRow("مستوى الشفافية", "Transparency Level", badge(dci.transparencyLevel, "blue"))}
        ${fieldRow("اكتمال الأدلة", "Evidence Completeness", badge(dci.evidenceCompleteness, "grey"))}
        ${fieldRow("مؤشر الأثر البشري HII", "Human Influence Index (HII)", badge(dci.humanInfluenceIndex, "navy"))}
        ${fieldRow("الأثر الفعلي للذكاء الاصطناعي", "AI Actual Influence", badge(dci.aiActualInfluence, "grey"))}
      </div>

      <div style="margin-bottom:16px;" class="avoid-break">
        ${sectionTitle("المؤشرات الدستورية", "Constitutional Indicators")}
        ${fieldRow("التناسب", "Proportionality", badge(dci.proportionalityStatus, dci.proportionalityStatus === "proportionate" ? "green" : dci.proportionalityStatus === "disproportionate" ? "red" : "amber"))}
        ${fieldRow("الشرعية", "Legality", badge(dci.legalityStatus, dci.legalityStatus === "confirmed" ? "green" : dci.legalityStatus === "violated" ? "red" : "amber"))}
        ${fieldRow("التحقق الدستوري", "Constitutional Validation", badge(dci.constitutionalValidationStatus, dci.constitutionalValidationStatus === "passed" ? "green" : dci.constitutionalValidationStatus === "failed" ? "red" : "grey"))}
        ${fieldRow("امتثال إطار الشامسي", "Al-Shamsi Framework Compliance", badge(dci.alShamsiFrameworkCompliance, dci.alShamsiFrameworkCompliance === "full" ? "green" : dci.alShamsiFrameworkCompliance === "non_compliant" ? "red" : "amber"))}
        ${fieldRow("مؤشر الاستقرار القانوني LSI", "Legal Stability Index (LSI)", badge(dci.lsiStatus, dci.lsiStatus === "stable" ? "green" : dci.lsiStatus === "highly_variable" ? "red" : "amber"))}
        ${fieldRow("مستوى تباين QVA", "QVA Variance Level", badge(dci.qvaVarianceLevel, dci.qvaVarianceLevel === "low" ? "green" : dci.qvaVarianceLevel === "high" ? "red" : "amber"))}
        ${fieldRow("عدد تشغيلات QVA", "QVA Run Count", `${dci.qvaRunCount}`)}
      </div>

      <div class="avoid-break">
        ${sectionTitle("سلامة البيانات", "Data Integrity")}
        ${fieldRow("الإصدار الحالي", "Current Version", `${dci.currentVersion}`)}
        ${fieldRow("تاريخ الختم", "Sealed At", dci.isSealed ? fmtDate(dci.sealedAt?.toISOString()) : badge("غير مختوم", "grey"))}
        ${fieldRow("بصمة التدقيق الكاملة", "Complete Audit Hash", dci.completeAuditHash ? `<span style="font-family:monospace;font-size:7.5pt;direction:ltr;word-break:break-all;">${esc(dci.completeAuditHash)}</span>` : notProcessed())}
      </div>
    </div>
  </div>`;
}

function buildReplayTimeline(d: AdpData): string {
  const eventsMap = new Map(d.replayEvents.map((e) => [e.replayStageKey, e]));

  const rows = REPLAY_STAGE_KEYS.map((key, idx) => {
    const event = eventsMap.get(key);
    const isVirtual = ["replay_03_data_validation", "replay_10_legal_weight", "replay_11_algorithmic_bias", "replay_12_legitimacy_index"].includes(key);
    const statusClass = event ? "status-complete" : isVirtual ? "status-virtual" : "status-pending";
    const statusLabel = event ? badge("مكتمل", "green") : isVirtual ? badge("مُشتَق", "amber") : badge("معلّق", "grey");

    return `<tr class="${statusClass}">
      <td style="font-family:monospace;direction:ltr;font-weight:700;">${String(idx + 1).padStart(2, "0")}</td>
      <td style="font-weight:600;">${esc(REPLAY_STAGE_LABELS_AR[key])}</td>
      <td>${event ? fmtDateTime(event.recordedAt?.toISOString()) : "—"}</td>
      <td>${event ? fmt(event.actor) : "—"}</td>
      <td style="font-size:7.5pt;font-family:'Noto Sans',sans-serif;direction:ltr;">${event ? fmt(event.aiModelName) : "—"}</td>
      <td>${event ? (event.confidenceScore !== null && event.confidenceScore !== undefined ? scoreBar(event.confidenceScore, 1) : "—") : "—"}</td>
      <td>${statusLabel}</td>
    </tr>`;
  });

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">الجدول الزمني لإعادة التشغيل — 14 مرحلة</div><div class="title-en">14-Stage Replay Timeline</div></div>
      <div class="num">04</div>
    </div>
    <div class="section">
      <table>
        <thead>${headerRow("#", "المرحلة", "التوقيت", "الجهة المنفّذة", "نموذج الذكاء الاصطناعي", "درجة الثقة", "الحالة")}</thead>
        <tbody>${rows.join("")}</tbody>
      </table>
      <p style="margin-top:10px;font-size:7.5pt;color:#64748b;font-family:'Noto Sans',sans-serif;direction:ltr;">
        <strong>Legend:</strong> ■ Complete — stage executed and immutably recorded
        · ■ Derived — assembled from related data sources (virtual stage)
        · ■ Pending — stage not yet reached
      </p>
    </div>
  </div>`;
}

function buildStageDetails(d: AdpData): string {
  const eventsMap = new Map(d.replayEvents.map((e) => [e.replayStageKey, e]));
  const completedEvents = REPLAY_STAGE_KEYS
    .map((key) => eventsMap.get(key))
    .filter((e): e is NonNullable<typeof e> => !!e);

  if (completedEvents.length === 0) {
    return `
    <div class="page-break">
      <div class="section-header-bar">
        <div><div class="title-ar">سجلات تفصيل المراحل</div><div class="title-en">Stage Detail Records</div></div>
        <div class="num">05</div>
      </div>
      <div class="section"><p class="not-processed">لا توجد مراحل مكتملة بعد / No completed stages yet</p></div>
    </div>`;
  }

  const cards = completedEvents.map((event, idx) => {
    const labelAr = REPLAY_STAGE_LABELS_AR[event.replayStageKey as keyof typeof REPLAY_STAGE_LABELS_AR] ?? event.replayStageKey;
    const stageNum = REPLAY_STAGE_KEYS.indexOf(event.replayStageKey as typeof REPLAY_STAGE_KEYS[number]) + 1;
    const refs = (event.legalReferences ?? []).concat(event.constitutionalReferences ?? []).concat(event.adminLawReferences ?? []);
    const dims = event.alShamsiDimensions as Record<string, unknown> | null;
    const risks = event.riskIndicators ?? [];
    const hi = event.humanInterventionRecord as Record<string, unknown> | null;

    return `
    <div class="stage-card avoid-break">
      <div class="stage-card-header">
        <div class="stage-num">${String(stageNum).padStart(2, "0")} / ${String(REPLAY_STAGE_KEYS.length).padStart(2, "0")}</div>
        <div class="stage-name">${esc(labelAr)}</div>
        <div>${fmtDateTime(event.recordedAt?.toISOString())}</div>
      </div>
      <div class="stage-card-body">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <span class="label-ar">الجهة المنفّذة</span>
            <div class="field-value">${fmt(event.actor)} ${event.actorRole ? badge(event.actorRole, "grey") : ""}</div>
          </div>
          <div>
            <span class="label-ar">نموذج الذكاء الاصطناعي</span>
            <div class="field-value" style="direction:ltr;font-family:'Noto Sans',sans-serif;">${fmt(event.aiModelName)}</div>
          </div>
          <div>
            <span class="label-ar">درجة الثقة</span>
            <div>${event.confidenceScore !== null && event.confidenceScore !== undefined ? scoreBar(event.confidenceScore, 1) : "—"}</div>
          </div>
          <div>
            <span class="label-ar">الثقل القانوني المطبَّق</span>
            <div class="field-value">${event.appliedLegalWeight !== null && event.appliedLegalWeight !== undefined ? event.appliedLegalWeight.toFixed(3) : "—"}</div>
          </div>
        </div>

        <div class="stage-sub-section">
          <div class="stage-sub-label">الحجج القانونية المُستند إليها <span class="en">Legal & Constitutional References</span></div>
          <div class="stage-sub-content">${refs.length ? refs.map(esc).join("<br/>") : notProcessed()}</div>
        </div>

        <div class="stage-sub-section">
          <div class="stage-sub-label">التحليل والتعليل <span class="en">Reasoning Narrative</span></div>
          <div class="stage-sub-content">${fmt(event.reasoningNarrative)}</div>
        </div>

        <div class="stage-sub-section">
          <div class="stage-sub-label">الأدلة المستخدمة <span class="en">Evidence Used</span></div>
          <div class="stage-sub-content">
            ${(event.evidenceSnapshot ?? []).length > 0
              ? (event.evidenceSnapshot as Record<string, unknown>[]).slice(0, 5).map((e) => `<div style="font-size:7.5pt;border-bottom:1px solid #f1f5f9;padding:3px 0;">${esc(String(e.action ?? e.evidenceSummaryAr ?? JSON.stringify(e)).slice(0, 200))}</div>`).join("")
              : notProcessed()
            }
          </div>
        </div>

        ${dims && Object.keys(dims).length > 0 ? `
        <div class="stage-sub-section">
          <div class="stage-sub-label">أبعاد الشامسي المطبَّقة <span class="en">Applied Al-Shamsi Dimensions</span></div>
          <div class="stage-sub-content" style="font-size:7.5pt;">${Object.entries(dims).slice(0, 4).map(([k, v]) => `<span style="margin-left:10px;"><strong>${esc(k)}:</strong> ${esc(String(v))}</span>`).join("  ·  ")}</div>
        </div>` : ""}

        ${risks.length > 0 ? `
        <div class="stage-sub-section">
          <div class="stage-sub-label">مؤشرات المخاطر <span class="en">Risk Indicators</span></div>
          <div class="stage-sub-content">${risks.map((r) => `${badge(esc(r), "amber")}`).join("  ")}</div>
        </div>` : ""}

        ${hi && Object.keys(hi).length > 0 ? `
        <div class="stage-sub-section">
          <div class="stage-sub-label">سجل التدخل البشري <span class="en">Human Intervention Record</span></div>
          <div class="stage-sub-content" style="font-size:7.5pt;">${esc(JSON.stringify(hi, null, 1).slice(0, 400))}</div>
        </div>` : ""}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0;font-size:7.5pt;">
          <div>
            <span class="label-ar">بصمة التدقيق</span>
            <div style="font-family:monospace;direction:ltr;color:#64748b;word-break:break-all;">${hashShort(event.auditHash)}</div>
          </div>
          <div>
            <span class="label-ar">رمز التوثيق الثابت</span>
            <div style="font-family:monospace;direction:ltr;color:#64748b;">${event.immutableLogId ?? "—"}</div>
          </div>
          <div>
            <span class="label-ar">بصمة الطلب</span>
            <div style="font-family:monospace;direction:ltr;color:#64748b;">${event.promptHash ? hashShort(event.promptHash) : "—"}</div>
          </div>
        </div>

      </div>
    </div>`;
  });

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">سجلات تفصيل المراحل (${completedEvents.length} من ${REPLAY_STAGE_KEYS.length})</div><div class="title-en">Stage Detail Records</div></div>
      <div class="num">05</div>
    </div>
    <div class="section">${cards.join("")}</div>
  </div>`;
}

function buildEvidenceChain(d: AdpData): string {
  const chain = d.evidenceChain;
  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">سلسلة الأدلة</div><div class="title-en">Evidence Chain</div></div>
      <div class="num">06</div>
    </div>
    <div class="section">
      ${chain.length === 0 ? `<p class="not-processed">لم تُسجَّل أدلة بعد / No evidence recorded yet</p>` : chain.map((ev) => `
        <div class="evidence-entry avoid-break">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span class="seq">#${ev.sequenceNumber}</span>
            <span>${fmtDateTime(ev.timestamp?.toISOString())}</span>
          </div>
          <div class="action">${fmt(ev.evidenceSummaryAr ?? ev.action)}</div>
          ${ev.actor ? `<div style="font-size:7.5pt;color:#64748b;">المنفّذ: ${esc(ev.actor)} ${ev.actorRole ? `(${esc(ev.actorRole)})` : ""}</div>` : ""}
          <div class="hash">Hash: ${ev.currentHash} · Chain: ${hashShort(ev.chainHash)}</div>
        </div>`).join("")
      }
      ${chain.length > 0 ? `
      <div style="margin-top:12px;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:7.5pt;">
        <strong>بصمة السلسلة النهائية / Final Chain Hash:</strong>
        <span style="font-family:monospace;direction:ltr;word-break:break-all;">${chain[chain.length - 1]?.chainHash ?? "—"}</span>
      </div>` : ""}
    </div>
  </div>`;
}

function buildAiReasoningSummary(d: AdpData): string {
  const jdp = d.jdp;
  const aiSection = jdp?.aiParticipationExplanation as Record<string, unknown> | null | undefined;
  const humanSection = jdp?.humanOversightRecord as Record<string, unknown> | null | undefined;

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">ملخص التعليل الذكي</div><div class="title-en">AI Reasoning Summary</div></div>
      <div class="num">07</div>
    </div>
    <div class="section">
      ${!jdp || jdp.status !== "ready" ? `<p class="not-processed">لم تُولَّد الحزمة الدفاعية القضائية بعد / Judicial Defense Package not yet generated</p>` : `
        <div class="avoid-break" style="margin-bottom:16px;">
          ${sectionTitle("مشاركة الذكاء الاصطناعي", "AI Participation")}
          ${fieldRow("نظرة عامة", "Overview", fmt(aiSection?.overview as string))}
          ${fieldRow("عدد المراحل بمساعدة الذكاء الاصطناعي", "Stages With AI Assistance", aiSection?.totalStagesWithAiAssistance !== undefined ? `${aiSection.totalStagesWithAiAssistance}` : "—")}
          ${fieldRow("مستوى المشاركة", "Participation Level", aiSection?.participationLevel ? badge(String(aiSection.participationLevel), "grey") : "—")}
          ${fieldRow("التقييم العام", "Overall Assessment", fmt(aiSection?.overallAssessment as string))}
        </div>

        ${Array.isArray(aiSection?.stageContributions) && (aiSection.stageContributions as unknown[]).length > 0 ? `
        <div class="avoid-break" style="margin-bottom:16px;">
          ${sectionTitle("مساهمات المراحل", "Stage Contributions")}
          <table>
            <thead>${headerRow("المرحلة", "مساهمة الذكاء الاصطناعي", "التحقق البشري")}</thead>
            <tbody>
              ${(aiSection.stageContributions as Record<string,string>[]).slice(0, 11).map((s) =>
                tableRow(esc(s.stageName ?? s.stage ?? "—"), esc(s.contribution ?? "—"), esc(s.humanVerification ?? "—"))
              ).join("")}
            </tbody>
          </table>
        </div>` : ""}

        ${humanSection ? `
        <div class="avoid-break" style="margin-bottom:16px;">
          ${sectionTitle("سجل الرقابة البشرية", "Human Oversight Record")}
          ${fieldRow("المسؤول المخوَّل", "Authorized Officer", fmt(humanSection?.authorizedOfficer as string))}
          ${fieldRow("المنصب", "Position", fmt(humanSection?.position as string))}
          ${fieldRow("مستوى الرقابة", "Oversight Level", humanSection?.oversightLevel ? badge(String(humanSection.oversightLevel), "blue") : "—")}
          ${fieldRow("الاستنتاج", "Conclusion", fmt(humanSection?.conclusion as string))}
        </div>` : ""}
      `}
    </div>
  </div>`;
}

function buildAlShamsiDimensions(d: AdpData): string {
  const jr = d.judicialReview;
  const dims = jr?.dimensions as JudicialDimension[] | null | undefined;

  const originalDims = ["jurisdiction", "procedure", "form", "cause", "subject", "purpose",
    "human_influence", "ai_influence", "constitutional_compliance", "transparency", "explainability", "proportionality"];
  const cjiDims = ["algorithmic_bias", "due_process", "equality", "fundamental_rights"];

  function renderDims(keys: string[], all: JudicialDimension[]): string {
    return keys.map((key, i) => {
      const dim = all.find((d) => d.dimension === key);
      if (!dim) return `
        <div class="dim-row">
          <span class="dim-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="dim-name">${esc(key)}</span>
          <span>${badge("لم يُقيَّم", "grey")}</span>
          <span class="dim-risk">—</span>
          <span class="dim-finding not-processed">لم يُعالَج بعد</span>
        </div>`;
      return `
        <div class="dim-row">
          <span class="dim-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="dim-name">${esc(dim.labelAr)}<br/><span style="font-size:7pt;color:#94a3b8;font-family:'Noto Sans',sans-serif;direction:ltr;">${esc(dim.labelEn)}</span></span>
          <span class="dim-status">${dimensionStatusBadge(dim.status)}</span>
          <span class="dim-risk">${scoreBar(dim.riskScore, 100)}</span>
          <span class="dim-finding">${fmt(dim.finding)}</span>
        </div>`;
    }).join("");
  }

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">أبعاد نظرية الشامسي — 16 بُعداً</div><div class="title-en">Al-Shamsi Theory Dimensions (16)</div></div>
      <div class="num">08</div>
    </div>
    <div class="section">
      ${!dims || dims.length === 0 ? `<p class="not-processed">لم تُجرَ المراجعة القضائية الدستورية بعد / Constitutional judicial review not yet run</p>` : `
        <div class="cji-group-header">الأبعاد الأصلية — الأبعاد الـ 12 لنظرية الشامسي / Original 12 Theory Dimensions</div>
        ${renderDims(originalDims, dims)}

        <div class="cji-group-header" style="margin-top:16px;">امتدادات الذكاء القضائي الدستوري (CJI) — 4 أبعاد / CJI Extension Dimensions (4)</div>
        ${renderDims(cjiDims, dims)}

        <div style="margin-top:12px;display:flex;gap:20px;font-size:8pt;padding-top:8px;border-top:1px solid #e2e8f0;">
          <span>${badge("ممتثل", "green")} = 0–20 خطر</span>
          <span>${badge("ملاحظة بسيطة", "amber")} = 21–40 خطر</span>
          <span>${badge("ملاحظة جوهرية", "amber")} = 41–60 خطر</span>
          <span>${badge("قاصر", "red")} = 61–100 خطر</span>
        </div>
      `}
    </div>
  </div>`;
}

function buildIndicesAndRisk(d: AdpData): string {
  const jr = d.judicialReview;
  const mem = d.memory;
  const defects = jr?.detectedDefects as ConstitutionalDefect[] | null | undefined;

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">المؤشرات وتقييم المخاطر</div><div class="title-en">Indices &amp; Risk Assessment</div></div>
      <div class="num">09</div>
    </div>
    <div class="section">
      <div class="avoid-break" style="margin-bottom:16px;">
        ${sectionTitle("المؤشرات الكمية", "Quantitative Indices")}
        ${indexBar(mem?.lsi ?? null, "مؤشر الشرعية (LSI)")}
        ${indexBar(mem?.humanInfluenceIndex ?? null, "مؤشر الأثر البشري (HII)")}
        ${indexBar(mem?.qva ?? null, "تقييم التباين الكمي (QVA)")}
        ${indexBar(mem?.aiActualInfluence ?? null, "الأثر الفعلي للذكاء الاصطناعي")}
      </div>

      <div class="avoid-break" style="margin-bottom:16px;">
        ${sectionTitle("الخطورة الدستورية", "Constitutional Risk")}
        ${fieldRow("درجة الخطورة", "Risk Score", jr?.constitutionalRiskScore !== null && jr?.constitutionalRiskScore !== undefined ? `${jr.constitutionalRiskScore}/100 — ${riskBadge(jr.riskLevel)}` : notProcessed())}
        ${fieldRow("مستوى الخطورة", "Risk Level", riskBadge(jr?.riskLevel))}
        ${jr?.constitutionalRiskScore !== null && jr?.constitutionalRiskScore !== undefined ? `
        <div style="margin-top:8px;">
          <div class="index-bar-track" style="height:16px;border-radius:6px;">
            <div class="index-bar-fill" style="width:${jr.constitutionalRiskScore}%;background:${jr.constitutionalRiskScore <= 33 ? "#10b981" : jr.constitutionalRiskScore <= 66 ? "#f59e0b" : "#ef4444"};height:100%;border-radius:6px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8;margin-top:2px;direction:ltr;"><span>0 (No Risk)</span><span>50 (Moderate)</span><span>100 (Critical)</span></div>
        </div>` : ""}
      </div>

      ${defects && defects.length > 0 ? `
      <div class="avoid-break">
        ${sectionTitle("العيوب الدستورية المُكتَشفة", "Detected Constitutional Defects")}
        <table>
          <thead>${headerRow("النوع", "الخطورة", "العنوان", "التوصية")}</thead>
          <tbody>
            ${defects.map((def) => tableRow(
              esc(def.defectType),
              badge(def.severity, def.severity === "critical" || def.severity === "major" ? "red" : "amber"),
              esc(def.titleAr),
              esc(def.remedyHint ?? "—"),
            )).join("")}
          </tbody>
        </table>
      </div>` : ""}

      ${mem ? `
      <div class="avoid-break" style="margin-top:16px;">
        ${sectionTitle("بيانات الذاكرة الدستورية", "Constitutional Memory Data")}
        ${fieldRow("المسؤول عن القرار البشري", "Human Decision Maker", fmt(mem.humanDecisionMaker))}
        ${fieldRow("محرك الذكاء الاصطناعي", "AI Engine", fmt(mem.aiEngine))}
        ${fieldRow("إصدار الإطار الدستوري", "Constitutional Framework Version", fmt(mem.constitutionalFrameworkVersion))}
        ${fieldRow("حالة الامتثال", "Compliance Status", fmt(mem.complianceStatus))}
        ${fieldRow("الحالة الدستورية", "Constitutional Status", fmt(mem.constitutionalStatus))}
        ${fieldRow("حالة الاستئناف", "Appeal Status", fmt(mem.appealStatus))}
        ${fieldRow("بصمة التدقيق الكاملة", "Complete Audit Hash", mem.completeAuditHash ? `<span style="font-family:monospace;font-size:7.5pt;direction:ltr;word-break:break-all;">${esc(mem.completeAuditHash)}</span>` : notProcessed())}
      </div>` : ""}
    </div>
  </div>`;
}

function buildConstitutionalReviewSummary(d: AdpData): string {
  const jr = d.judicialReview;
  const outcome = jr?.outcomePrediction as { outcome: string; confidencePercentage: number; reasoning: string; primaryRisk: string | null } | null | undefined;
  const remedy = jr?.remedyRecommendation as { remedy: string; urgency: string; explanation: string; conditions: string[] } | null | undefined;

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">ملخص المراجعة الدستورية</div><div class="title-en">Constitutional Review Summary</div></div>
      <div class="num">10</div>
    </div>
    <div class="section">
      ${!jr || jr.status !== "completed" ? `<p class="not-processed">لم تُجرَ المراجعة القضائية الدستورية بعد / Constitutional judicial review not yet completed</p>` : `

        <div class="avoid-break" style="margin-bottom:16px;">
          ${sectionTitle("نتيجة التوقع القضائي", "Judicial Outcome Prediction")}
          ${fieldRow("النتيجة المتوقعة", "Predicted Outcome", outcomeLabel(outcome?.outcome))}
          ${fieldRow("نسبة الثقة", "Confidence", outcome?.confidencePercentage !== undefined ? `${badge(`${outcome.confidencePercentage}%`, "navy")}` : notProcessed())}
          ${fieldRow("الأساس المنطقي", "Reasoning", fmt(outcome?.reasoning))}
          ${outcome?.primaryRisk ? fieldRow("المخاطر الرئيسية", "Primary Risk", fmt(outcome.primaryRisk)) : ""}
        </div>

        ${remedy ? `
        <div class="avoid-break" style="margin-bottom:16px;">
          ${sectionTitle("التوصية القضائية", "Judicial Remedy Recommendation")}
          ${fieldRow("التوصية", "Remedy", remedyLabel(remedy.remedy))}
          ${fieldRow("الاستعجال", "Urgency", badge(remedy.urgency, remedy.urgency === "immediate" ? "red" : "amber"))}
          ${fieldRow("الشرح", "Explanation", fmt(remedy.explanation))}
          ${remedy.conditions?.length > 0 ? fieldRow("الشروط", "Conditions", remedy.conditions.map((c) => `• ${esc(c)}`).join("<br/>")) : ""}
        </div>` : ""}

        ${jr.findingsOfFact && (jr.findingsOfFact as string[]).length > 0 ? `
        <div class="avoid-break" style="margin-bottom:16px;">
          ${sectionTitle("النتائج الواقعية", "Findings of Fact")}
          <ul style="padding-right:20px;font-size:8.5pt;color:#334155;">
            ${(jr.findingsOfFact as string[]).map((f) => `<li style="margin-bottom:4px;">${esc(f)}</li>`).join("")}
          </ul>
        </div>` : ""}

        ${jr.findingsOfLaw && (jr.findingsOfLaw as string[]).length > 0 ? `
        <div class="avoid-break" style="margin-bottom:16px;">
          ${sectionTitle("النتائج القانونية", "Findings of Law")}
          <ul style="padding-right:20px;font-size:8.5pt;color:#334155;">
            ${(jr.findingsOfLaw as string[]).map((f) => `<li style="margin-bottom:4px;">${esc(f)}</li>`).join("")}
          </ul>
        </div>` : ""}

        ${jr.constitutionalObservations && (jr.constitutionalObservations as string[]).length > 0 ? `
        <div class="avoid-break">
          ${sectionTitle("الملاحظات الدستورية", "Constitutional Observations")}
          <ul style="padding-right:20px;font-size:8.5pt;color:#334155;">
            ${(jr.constitutionalObservations as string[]).map((f) => `<li style="margin-bottom:4px;">${esc(f)}</li>`).join("")}
          </ul>
        </div>` : ""}

        ${jr.suggestedJudicialReasoning ? `
        <div class="avoid-break" style="margin-top:16px;">
          ${sectionTitle("التعليل القضائي المقترح", "Suggested Judicial Reasoning")}
          <div style="font-size:8.5pt;color:#334155;line-height:1.7;">${fmt(jr.suggestedJudicialReasoning)}</div>
        </div>` : ""}
      `}
    </div>
  </div>`;
}

function buildSignatureBlock(d: AdpData): string {
  const dec = d.decision;
  const dci = d.dci;

  const integrityRows = [
    ["رقم القضية / Case Number", dec.caseNumber],
    ["الرقم التسلسلي للجواز / Document Serial", d.docSerial],
    ["بصمة SHA-256 للوثيقة / Document SHA-256 Hash", d.docHash],
    ["بصمة التدقيق الكاملة / Complete Audit Hash", dci?.completeAuditHash ?? "لم يُعالَج بعد"],
    ["تاريخ ووقت الإصدار / Generated At", d.generatedAt],
    ["حالة القرار / Decision Status", dec.status],
    ["إصدار المنصة / Platform Version", "MARSAD Alpha 1.0 · M. Al-Shamsi Framework"],
  ];

  return `
  <div class="page-break">
    <div class="section-header-bar">
      <div><div class="title-ar">كتلة التوقيع الرقمي وسلامة الوثيقة</div><div class="title-en">Digital Signature Block &amp; Document Integrity</div></div>
      <div class="num">11</div>
    </div>
    <div class="section">
      <p style="font-size:8pt;color:#64748b;font-family:'Noto Sans',sans-serif;direction:ltr;margin-bottom:16px;">
        NOTICE: Digital signatures in this section are reserved placeholders for PKI-based electronic signing
        in future production deployments. This document is authenticated by its SHA-256 integrity hash and
        immutable audit chain recorded in the MARSAD platform.
      </p>

      <div class="avoid-break">
        ${sectionTitle("سلامة الوثيقة / Document Integrity", "")}
        ${integrityRows.map(([k, v]) => `
          <div class="integrity-row">
            <span class="integrity-key">${esc(k)}</span>
            <span class="integrity-val">${esc(v ?? "—")}</span>
          </div>`).join("")}
      </div>

      <div style="margin-top:24px;" class="avoid-break">
        ${sectionTitle("كتل التوقيع / Signature Blocks", "")}
        <div class="sig-grid">
          <div class="sig-box">
            <div class="sig-box-header">المسؤول المُصدِر<br/><span style="font-size:7pt;font-family:'Noto Sans',sans-serif;">Issuing Officer</span></div>
            <div class="sig-box-body">
              <div class="sig-line"></div>
              <div class="sig-name">الاسم / Name: ___________________</div>
              <div class="sig-name">المنصب / Position: ________________</div>
              <div class="sig-name">التاريخ / Date: __________________</div>
            </div>
          </div>
          <div class="sig-box">
            <div class="sig-box-header">المراجع الدستوري<br/><span style="font-size:7pt;font-family:'Noto Sans',sans-serif;">Constitutional Reviewer</span></div>
            <div class="sig-box-body">
              <div class="sig-line"></div>
              <div class="sig-name">الاسم / Name: ___________________</div>
              <div class="sig-name">المنصب / Position: ________________</div>
              <div class="sig-name">التاريخ / Date: __________________</div>
            </div>
          </div>
          <div class="sig-box">
            <div class="sig-box-header">الشاهد<br/><span style="font-size:7pt;font-family:'Noto Sans',sans-serif;">Witness</span></div>
            <div class="sig-box-body">
              <div class="sig-line"></div>
              <div class="sig-name">الاسم / Name: ___________________</div>
              <div class="sig-name">المنصب / Position: ________________</div>
              <div class="sig-name">التاريخ / Date: __________________</div>
            </div>
          </div>
        </div>

        <div style="margin-top:24px;border:2px dashed #C8A951;padding:16px;text-align:center;">
          <div style="font-size:9pt;font-weight:700;color:#0A1628;margin-bottom:6px;">مكان الختم الرسمي / Official Seal Placement</div>
          <div style="width:100px;height:100px;border:2px dashed #C8A951;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:7pt;color:#C8A951;text-align:center;">OFFICIAL<br/>SEAL</span>
          </div>
        </div>
      </div>

      <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;font-size:7.5pt;color:#64748b;" class="avoid-break">
        <p style="font-family:'Noto Sans',sans-serif;direction:ltr;margin-bottom:6px;">
          <strong>Document Classification:</strong> OFFICIAL — For administrative and judicial use only.
          This document was generated by the MARSAD Intelligent Administrative Decision Platform (Alpha 1.0),
          implementing the M. Al-Shamsi Framework for Constitutional Administrative Decision-Making.
          Any reproduction must preserve the SHA-256 integrity hash for authenticity verification.
        </p>
        <p>
          <strong>تصنيف الوثيقة:</strong> رسمي — للاستخدام الإداري والقضائي حصراً.
          أُصدرت هذه الوثيقة عبر منظومة مرصد للقرارات الإدارية الذكية (إصدار ألفا 1.0)،
          المستندة إلى إطار الشامسي للقرار الإداري الدستوري.
          يجب الحفاظ على بصمة SHA-256 عند أي نسخ للتحقق من المصداقية.
        </p>
      </div>
    </div>
  </div>`;
}

// ─── HTML Document Builder ────────────────────────────────────────────────────

function buildHtml(data: AdpData): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>جواز القرار الإداري — ${esc(data.decision.caseNumber)}</title>
  <style>${ADP_CSS}</style>
</head>
<body>
  ${buildCoverPage(data)}
  ${buildExecutiveSummary(data)}
  ${buildDciSection(data)}
  ${buildReplayTimeline(data)}
  ${buildStageDetails(data)}
  ${buildEvidenceChain(data)}
  ${buildAiReasoningSummary(data)}
  ${buildAlShamsiDimensions(data)}
  ${buildIndicesAndRisk(data)}
  ${buildConstitutionalReviewSummary(data)}
  ${buildSignatureBlock(data)}
</body>
</html>`;
}

// ─── PDF Renderer ─────────────────────────────────────────────────────────────

async function renderPdf(html: string, docHash: string): Promise<Buffer> {
  // Dynamic import so the server starts even if Puppeteer isn't fully configured
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
    // waitUntil: 'networkidle0' removed in puppeteer 25 — use domcontentloaded + delay for fonts
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // Allow time for Google Fonts (Noto Naskh Arabic) to load before rendering
    await new Promise((r) => setTimeout(r, 2_500));
    const hashFragment = docHash.slice(0, 16) + "…";
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `<div style="width:100%;font-family:sans-serif;font-size:7pt;color:#9ca3af;padding:0 16mm;display:flex;justify-content:space-between;direction:ltr;">
        <span>MARSAD Alpha 1.0 · ADP</span>
        <span style="font-family:monospace;">${hashFragment}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a complete Administrative Decision Passport PDF for the given decision.
 * Returns a PDF Buffer ready to stream to the client.
 * Throws if the decision does not exist.
 */
export async function generateAdpPdf(decisionId: number): Promise<{ pdf: Buffer; filename: string; docHash: string }> {
  const data = await assembleAdpData(decisionId);
  const html = buildHtml(data);
  const pdf = await renderPdf(html, data.docHash);
  const datePart = data.generatedAt.slice(0, 10);
  const filename = `ADP-${data.decision.caseNumber}-${datePart}.pdf`;
  return { pdf, filename, docHash: data.docHash };
}
