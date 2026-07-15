// ─── Legal-context selection store ─────────────────────────────────────────────
// Per the approved dashboard-workflow redesign, the legal selectors (التصنيف
// القانوني الرئيسي → الفرع → التخصص الدقيق، مصدر القانون، شكل الإجابة) live in
// the sidebar menu. The assistant's PreAnalysisPanel keeps reading/writing the
// same fields, so both surfaces share this small localStorage-backed store:
// the sidebar writes a selection, the assistant seeds its session config from
// it (and mirrors any edits back), and a window event keeps mounted listeners
// in sync. Pure UI state — no backend contract is touched.
import { useCallback, useEffect, useState } from 'react';
import type { AnswerFormat, LawSource, LegalDomain } from '@/lib/legal-taxonomy';
import { LEGAL_TAXONOMY, getLegalBranchDef, LAW_SOURCE_CFG, ANSWER_FORMAT_CFG } from '@/lib/legal-taxonomy';

export interface LegalContextSelection {
  legalDomain: LegalDomain | '';
  legalBranch: string;
  legalSpecialization: string;
  lawSource: LawSource | '';
  answerFormat: AnswerFormat | '';
}

export const EMPTY_LEGAL_CONTEXT: LegalContextSelection = {
  legalDomain: '', legalBranch: '', legalSpecialization: '', lawSource: '', answerFormat: '',
};

const STORAGE_KEY = 'marsad_legal_context_v1';
const CHANGE_EVENT = 'marsad:legal-context-changed';

/** Validate a raw parsed object against the taxonomy — never trust storage. */
function sanitize(raw: unknown): LegalContextSelection {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LEGAL_CONTEXT };
  const r = raw as Partial<Record<keyof LegalContextSelection, unknown>>;

  const domain: LegalDomain | '' =
    typeof r.legalDomain === 'string' && r.legalDomain in LEGAL_TAXONOMY ? (r.legalDomain as LegalDomain) : '';
  const branchId = typeof r.legalBranch === 'string' ? r.legalBranch : '';
  const branch = getLegalBranchDef(domain, branchId);
  const specId = typeof r.legalSpecialization === 'string' ? r.legalSpecialization : '';
  const spec = branch?.specializations.find((s) => s.id === specId);

  return {
    legalDomain: domain,
    legalBranch: branch ? branchId : '',
    legalSpecialization: spec ? specId : '',
    lawSource:
      typeof r.lawSource === 'string' && r.lawSource in LAW_SOURCE_CFG ? (r.lawSource as LawSource) : '',
    answerFormat:
      typeof r.answerFormat === 'string' && r.answerFormat in ANSWER_FORMAT_CFG ? (r.answerFormat as AnswerFormat) : '',
  };
}

export function loadLegalContextSelection(): LegalContextSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_LEGAL_CONTEXT };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...EMPTY_LEGAL_CONTEXT };
  }
}

export function saveLegalContextSelection(next: LegalContextSelection): void {
  const clean = sanitize(next);
  const prev = loadLegalContextSelection();
  const changed = (Object.keys(clean) as (keyof LegalContextSelection)[]).some((k) => clean[k] !== prev[k]);
  if (!changed) return; // avoid event loops between the sidebar and the assistant
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch { /* storage full/blocked — selection just won't persist */ }
  window.dispatchEvent(new CustomEvent<LegalContextSelection>(CHANGE_EVENT, { detail: clean }));
}

/** Subscribe to selection changes made anywhere in the app (sidebar or assistant). */
export function onLegalContextChange(handler: (sel: LegalContextSelection) => void): () => void {
  const listener = (e: Event) => handler(sanitize((e as CustomEvent<LegalContextSelection>).detail));
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

/** React hook — current selection + updater, kept in sync across components. */
export function useLegalContextSelection(): [LegalContextSelection, (next: LegalContextSelection) => void] {
  const [selection, setSelection] = useState<LegalContextSelection>(loadLegalContextSelection);
  useEffect(() => onLegalContextChange(setSelection), []);
  const update = useCallback((next: LegalContextSelection) => {
    setSelection(sanitize(next));
    saveLegalContextSelection(next);
  }, []);
  return [selection, update];
}
