/**
 * TheoryLensSelector — compact pill selector for the AI Legal Assistant.
 *
 * Renders below the research query input area. Default: "UAE Law Only" (no overlay).
 * Selecting Al-Shamsi or Comparative activates that theory overlay.
 * Selecting Custom shows a short text field for a user-defined framework.
 *
 * This component is pure UI — all state is lifted to the parent (ai-assistant.tsx).
 */
import React, { useState } from 'react';
import { FlaskConical, Scale, BookOpen, Pencil, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TheoryLensId = 'uae_only' | 'shamsi' | 'french_admin' | 'custom';

export interface TheoryLensState {
  lensId: TheoryLensId;
  customText: string;
}

// ─── Lens options ─────────────────────────────────────────────────────────────

interface LensOption {
  id: TheoryLensId;
  labelAr: string;
  labelEn: string;
  icon: React.ElementType;
  badgeClass: string;   // applied when active
  ringClass: string;    // border colour when active
}

const LENS_OPTIONS: LensOption[] = [
  {
    id: 'uae_only',
    labelAr: 'الإمارات فقط',
    labelEn: 'UAE Law Only',
    icon: Scale,
    badgeClass: 'bg-primary/10 text-primary',
    ringClass: 'border-primary/40',
  },
  {
    id: 'shamsi',
    labelAr: 'نظرية الشامسي',
    labelEn: 'Al-Shamsi',
    icon: FlaskConical,
    badgeClass: 'bg-violet-100 text-violet-700',
    ringClass: 'border-violet-400',
  },
  {
    id: 'french_admin',
    labelAr: 'القانون الفرنسي',
    labelEn: 'French Admin',
    icon: BookOpen,
    badgeClass: 'bg-blue-100 text-blue-700',
    ringClass: 'border-blue-400',
  },
  {
    id: 'custom',
    labelAr: 'نظرية مخصصة',
    labelEn: 'Custom Theory',
    icon: Pencil,
    badgeClass: 'bg-gold/15 text-gold',
    ringClass: 'border-gold/80',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface TheoryLensSelectorProps {
  value: TheoryLensState;
  onChange: (next: TheoryLensState) => void;
  /** Render Arabic labels when true. */
  arabic?: boolean;
  disabled?: boolean;
  /** Al-Shamsi is owner-only — hide the pill entirely for non-owner roles. */
  hideShamsi?: boolean;
}

export function TheoryLensSelector({
  value,
  onChange,
  arabic = true,
  disabled = false,
  hideShamsi = false,
}: TheoryLensSelectorProps) {
  const [customDraft, setCustomDraft] = useState(value.customText);
  const visibleOptions = hideShamsi ? LENS_OPTIONS.filter((o) => o.id !== 'shamsi') : LENS_OPTIONS;

  function selectLens(id: TheoryLensId) {
    if (disabled) return;
    onChange({ lensId: id, customText: id === 'custom' ? customDraft : value.customText });
  }

  function commitCustomText() {
    onChange({ lensId: 'custom', customText: customDraft.trim() });
  }

  return (
    <div className="flex flex-col gap-1.5" dir={arabic ? 'rtl' : 'ltr'}>
      {/* Pill row */}
      <div className="flex items-center flex-wrap gap-1.5">
        {/* Label */}
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          {arabic ? 'الإطار التحليلي' : 'Theory Lens'}
        </span>

        {visibleOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = value.lensId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => selectLens(opt.id)}
              disabled={disabled}
              className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                border transition-all select-none
                disabled:opacity-40
                ${isActive
                  ? `${opt.badgeClass} ${opt.ringClass} border shadow-sm`
                  : 'bg-muted/40 text-muted-foreground border-border/60 hover:border-border hover:bg-muted/70'}
              `}
              title={arabic ? opt.labelEn : opt.labelAr}
            >
              <Icon className="w-2.5 h-2.5 shrink-0" />
              {arabic ? opt.labelAr : opt.labelEn}
            </button>
          );
        })}

        {/* Clear to UAE-only when a non-default lens is active */}
        {value.lensId !== 'uae_only' && (
          <button
            type="button"
            onClick={() => { setCustomDraft(''); onChange({ lensId: 'uae_only', customText: '' }); }}
            disabled={disabled}
            className="inline-flex items-center text-[10px] text-muted-foreground hover:text-foreground gap-0.5 disabled:opacity-40"
            title={arabic ? 'إعادة التعيين' : 'Reset'}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Custom theory text field (shown only when 'custom' is selected) */}
      {value.lensId === 'custom' && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onBlur={commitCustomText}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            placeholder={arabic ? 'أدخل وصف النظرية المخصصة…' : 'Describe your custom theory…'}
            className="flex-1 text-xs px-2.5 py-1.5 border border-gold/40 rounded-lg bg-gold/10 focus:outline-none focus:ring-1 focus:ring-gold/80 placeholder:text-muted-foreground"
            disabled={disabled}
            maxLength={300}
            dir="auto"
          />
        </div>
      )}

      {/* Active lens badge (non-UAE-only) */}
      {value.lensId !== 'uae_only' && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {arabic
            ? 'كل رد سيتضمن قسمين: التحليل الإماراتي الملزم + التحليل النظري'
            : 'Each reply will include: UAE Binding Analysis + Theory Lens section'}
        </div>
      )}
    </div>
  );
}

// ─── Compact inline badge (shown in message bubble header) ────────────────────

export function TheoryLensBadge({ lensId, hideShamsi = false }: { lensId: TheoryLensId | string; hideShamsi?: boolean }) {
  const opt = LENS_OPTIONS.find((o) => o.id === lensId);
  if (!opt || lensId === 'uae_only') return null;
  if (hideShamsi && lensId === 'shamsi') return null;
  const Icon = opt.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${opt.badgeClass} ${opt.ringClass}`}>
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {opt.labelEn}
    </span>
  );
}
