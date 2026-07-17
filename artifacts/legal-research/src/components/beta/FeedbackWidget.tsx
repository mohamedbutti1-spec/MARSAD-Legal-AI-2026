/**
 * BetaFeedbackWidget
 * Floating reviewer feedback button — bottom-right of every authenticated page.
 * Sends structured reports to POST /api/beta/feedback.
 * Owner users also get a link to the admin inbox at GET /api/beta/feedback.
 */
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useUserContext } from '@/lib/user-context';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Category = 'bug' | 'ui_ux' | 'performance' | 'feature_request' | 'security' | 'content' | 'other';
type Severity  = 'low' | 'medium' | 'high' | 'critical';

const CATEGORY_LABELS: Record<Category, string> = {
  bug:             '🐛 Bug',
  ui_ux:           '🎨 UI / UX',
  performance:     '⚡ Performance',
  feature_request: '💡 Feature Request',
  security:        '🔒 Security',
  content:         '📄 Content / Data',
  other:           '💬 Other',
};

const SEVERITY_LABELS: Record<Severity, { label: string; colour: string }> = {
  low:      { label: 'Low',      colour: 'text-muted-foreground' },
  medium:   { label: 'Medium',   colour: 'text-gold/80' },
  high:     { label: 'High',     colour: 'text-gold/80' },
  critical: { label: 'Critical', colour: 'text-destructive' },
};

export function BetaFeedbackWidget() {
  const [location]         = useLocation();
  const { role }           = useUserContext();
  const [open, setOpen]    = useState(false);
  const [submitting, setSub] = useState(false);
  const [done, setDone]    = useState(false);
  const [error, setError]  = useState('');

  const [category,    setCategory]    = useState<Category>('bug');
  const [description, setDescription] = useState('');
  const [severity,    setSeverity]    = useState<Severity>('medium');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 5) {
      setError('Please write at least 5 characters.');
      return;
    }
    setSub(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/beta/feedback`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagePath:    location,
          pageTitle:   document.title,
          category,
          description: description.trim(),
          severity,
          browserInfo: `${navigator.userAgent} | ${window.innerWidth}×${window.innerHeight}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setDescription('');
        setCategory('bug');
        setSeverity('medium');
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed — please try again.');
    } finally {
      setSub(false);
    }
  }

  return (
    <>
      {/* ── Floating trigger ─────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* Beta badge */}
        <div className="bg-gold/10 border border-gold/30 text-gold/80 text-[10px] font-semibold
                        tracking-widest px-2 py-0.5 rounded-full uppercase select-none">
          BETA
        </div>

        <button
          onClick={() => { setOpen(true); setDone(false); setError(''); }}
          title="Submit reviewer feedback"
          className="w-12 h-12 rounded-full bg-gold hover:bg-gold/80
                     text-white shadow-lg shadow-gold/30
                     flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          {/* Bug / comment icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {/* ── Feedback modal ────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto
                          bg-card border border-border rounded-2xl shadow-2xl
                          p-6 mb-4 sm:mb-0">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Reviewer Feedback</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {location} · Role: <span className="font-medium text-gold/80">{role}</span>
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                           hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >✕</button>
            </div>

            {/* Success state */}
            {done ? (
              <div className="py-8 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-heading/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                       className="w-6 h-6 text-heading">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-foreground font-medium">Feedback recorded — thank you!</p>
                <p className="text-xs text-muted-foreground">Your report has been logged for the review team.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([k, v]) => (
                      <button
                        key={k} type="button"
                        onClick={() => setCategory(k)}
                        className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors
                          ${category === k
                            ? 'bg-gold/15 border-gold/50 text-gold/80 font-medium'
                            : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                          }`}
                      >{v}</button>
                    ))}
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Severity</label>
                  <div className="flex gap-2">
                    {(Object.entries(SEVERITY_LABELS) as [Severity, { label: string; colour: string }][]).map(([k, v]) => (
                      <button
                        key={k} type="button"
                        onClick={() => setSeverity(k)}
                        className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors
                          ${severity === k
                            ? `bg-muted border-border font-semibold ${v.colour}`
                            : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                      >{v.label}</button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Description <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what happened, what you expected, and any steps to reproduce…"
                    rows={4}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2
                               text-sm text-foreground placeholder:text-muted-foreground/50
                               resize-none focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 py-2 text-sm rounded-lg border border-border
                               text-muted-foreground hover:text-foreground transition-colors"
                  >Cancel</button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2 text-sm rounded-lg bg-gold hover:bg-gold/80
                               text-white font-medium transition-colors disabled:opacity-50"
                  >{submitting ? 'Sending…' : 'Submit Feedback'}</button>
                </div>

                {/* Admin link */}
                {role === 'owner' && (
                  <p className="text-center text-xs text-muted-foreground">
                    Admin:{' '}
                    <a
                      href="#"
                      onClick={async e => {
                        e.preventDefault();
                        const r = await fetch(`${BASE}/api/beta/feedback/stats`, { credentials: 'include' });
                        const d = await r.json() as { total: number; bySeverity: { severity: string; count: number }[] };
                        alert(
                          `Total: ${d.total}\n` +
                          d.bySeverity.map((x: { severity: string; count: number }) => `${x.severity}: ${x.count}`).join('\n')
                        );
                      }}
                      className="text-gold/80 hover:underline"
                    >View feedback stats</a>
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
