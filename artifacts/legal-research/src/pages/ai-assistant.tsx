import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { useListDocuments } from '@workspace/api-client-react';
import {
  Bot, Plus, Trash2, Send, Loader2, MessageSquare, Sparkles,
  FileText, BookOpen, Copy, Check, ChevronDown, ChevronUp,
  Link, X, Pin, PinOff, Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session { id: number; title: string; updatedAt: string; }

interface Citation {
  token: string;
  title: string;
  type: 'document' | 'legal_source';
  sourceId: number;
  formats?: { harvard: string; apa: string; uaeGov: string };
}

interface MessageMeta {
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  citations?: Citation[];
}

interface Message {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  meta?: MessageMeta | null;
}

interface LegalSource { id: number; title: string; titleAr?: string | null; jurisdiction: string; docType: string; }

type CitFmt = 'harvard' | 'apa' | 'uaeGov';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FMT_LABELS: Record<CitFmt, { ar: string; en: string }> = {
  harvard: { ar: 'هارفرد', en: 'Harvard' },
  apa:     { ar: 'APA', en: 'APA' },
  uaeGov:  { ar: 'حكومة الإمارات', en: 'UAE Gov.' },
};

/** Parse [DOC:N] and [SRC:N] tokens from text and replace with <mark> placeholders */
function parseContent(text: string, citations: Citation[]): React.ReactNode[] {
  if (!citations || citations.length === 0) return [text];
  const pattern = /\[(DOC|SRC):\d+\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const cit = citations.find((c) => c.token === token);
    parts.push(
      <CitationChip key={`${token}-${match.index}`} token={token} citation={cit} />,
    );
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CitationChip({ token, citation }: { token: string; citation?: Citation }) {
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<CitFmt>('harvard');
  const [copied, setCopied] = useState(false);
  const isDoc = token.startsWith('[DOC:');
  const label = citation?.title ?? token;

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${
          isDoc
            ? 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/15'
            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
        }`}
        title={label}
      >
        {isDoc ? <FileText className="w-2.5 h-2.5" /> : <BookOpen className="w-2.5 h-2.5" />}
        <span className="max-w-[140px] truncate">{label}</span>
      </button>

      {open && citation?.formats && (
        <div className="absolute z-50 bottom-full mb-1 start-0 w-80 bg-card border border-border rounded-xl shadow-xl p-3 text-start" dir="rtl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground truncate">{label}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Format selector */}
          <div className="flex gap-1 mb-2">
            {(Object.keys(FMT_LABELS) as CitFmt[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFmt(f)}
                className={`flex-1 text-[10px] py-0.5 rounded font-medium transition-colors ${
                  fmt === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {FMT_LABELS[f].ar}
              </button>
            ))}
          </div>
          {/* Citation text */}
          <div className="bg-muted/40 rounded-lg p-2 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap mb-2" dir="auto">
            {citation.formats[fmt]}
          </div>
          <button
            type="button"
            onClick={() => copy(citation.formats![fmt])}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? 'تم النسخ' : 'نسخ'}
          </button>
        </div>
      )}
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const citations = (msg.meta?.citations ?? []) as Citation[];
  const [showSources, setShowSources] = useState(false);

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-4`} dir="rtl">
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-1 shrink-0">
          <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
        </div>
      )}

      <div className={`max-w-[82%] ${isUser ? 'order-first' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-muted border border-border text-foreground rounded-ss-none'
            : 'bg-primary text-primary-foreground rounded-se-none'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <p className="whitespace-pre-wrap leading-7">
              {parseContent(msg.content, citations)}
            </p>
          )}
        </div>

        {/* Sources panel (assistant only) */}
        {!isUser && citations.length > 0 && (
          <div className="mt-1.5 ms-1">
            <button
              type="button"
              onClick={() => setShowSources((s) => !s)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {citations.length} {citations.length === 1 ? 'مصدر' : 'مصادر'}
            </button>
            {showSources && (
              <div className="mt-1 space-y-1">
                {citations.map((c) => (
                  <div key={c.token} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {c.type === 'document' ? <FileText className="w-3 h-3 shrink-0" /> : <BookOpen className="w-3 h-3 shrink-0 text-amber-600" />}
                    <span className="truncate">{c.title}</span>
                    <span className="text-muted-foreground/50">{c.token}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meta */}
        {!isUser && msg.meta?.provider && (
          <p className="text-[9px] text-muted-foreground/50 mt-1 ms-1">
            {msg.meta.provider} · {msg.meta.model}
            {msg.meta.outputTokens ? ` · ${msg.meta.outputTokens} tokens` : ''}
          </p>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center ms-2 mt-1 shrink-0">
          <span className="text-xs font-bold text-muted-foreground">م</span>
        </div>
      )}
    </div>
  );
}

// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { ar: 'ما هي شروط إنهاء العقد في القانون الإماراتي؟', en: 'Contract termination conditions in UAE law?' },
  { ar: 'قارن بين قانون الشركات الإماراتي والفرنسي', en: 'Compare UAE and French company law' },
  { ar: 'ما هي حقوق العمال في تشريعات الاتحاد الأوروبي؟', en: 'EU worker rights legislation?' },
  { ar: 'المسؤولية المدنية والتعويض في القانون الإماراتي', en: 'Civil liability and compensation in UAE law' },
];

// ─── Document/Source pin panel ────────────────────────────────────────────────
function PinPanel({
  docs,
  sources,
  pinnedDocs,
  pinnedSrcs,
  onToggleDoc,
  onToggleSrc,
  onClose,
  t,
}: {
  docs: Array<{ id: number; originalName?: string; filename?: string }>;
  sources: LegalSource[];
  pinnedDocs: number[];
  pinnedSrcs: number[];
  onToggleDoc: (id: number) => void;
  onToggleSrc: (id: number) => void;
  onClose: () => void;
  t: (ar: string, en: string) => string;
}) {
  return (
    <div className="absolute bottom-full mb-2 start-0 end-0 bg-card border border-border rounded-xl shadow-xl z-40 max-h-72 overflow-hidden flex flex-col" dir="rtl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <p className="text-xs font-semibold text-foreground">{t('تثبيت مصادر للمحادثة', 'Pin sources for this conversation')}</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-border/30">
        {docs.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t('الوثائق', 'Documents')}</p>
            {docs.map((d) => (
              <label key={d.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer text-xs">
                <input type="checkbox" className="rounded" checked={pinnedDocs.includes(d.id)} onChange={() => onToggleDoc(d.id)} />
                <FileText className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">{d.originalName ?? d.filename}</span>
              </label>
            ))}
          </div>
        )}
        {sources.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t('المصادر القانونية', 'Legal Sources')}</p>
            {sources.map((s) => (
              <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer text-xs">
                <input type="checkbox" className="rounded" checked={pinnedSrcs.includes(s.id)} onChange={() => onToggleSrc(s.id)} />
                <BookOpen className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">{s.titleAr ?? s.title}</span>
              </label>
            ))}
          </div>
        )}
        {docs.length === 0 && sources.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">{t('لا توجد مصادر بعد', 'No sources yet')}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AiAssistant() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [pinnedDocs, setPinnedDocs] = useState<number[]>([]);
  const [pinnedSrcs, setPinnedSrcs] = useState<number[]>([]);
  const [legalSources, setLegalSources] = useState<LegalSource[]>([]);

  const { data: documents } = useListDocuments();

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    const r = await apiFetch('/api/assistant/sessions');
    if (r.ok) { const d = await r.json(); setSessions(d.sessions ?? []); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Lazy-load legal sources for pin panel
  useEffect(() => {
    apiFetch('/api/legal-sources?limit=80')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.sources) setLegalSources(d.sources); })
      .catch(() => {});
  }, []);

  // Fetch messages when session changes
  useEffect(() => {
    if (!activeSession) { setMessages([]); return; }
    setLoadingMessages(true);
    apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setMessages(d.messages ?? []); })
      .finally(() => setLoadingMessages(false));
  }, [activeSession]);

  // Auto-scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  async function createSession() {
    const r = await apiFetch('/api/assistant/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'محادثة جديدة' }),
    });
    if (r.ok) {
      const session = await r.json();
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
      setPinnedDocs([]);
      setPinnedSrcs([]);
    }
  }

  async function deleteSession(session: Session, e: React.MouseEvent) {
    e.stopPropagation();
    await apiFetch(`/api/assistant/sessions/${session.id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    if (activeSession?.id === session.id) { setActiveSession(null); setMessages([]); }
  }

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || !activeSession || sending) return;
    setInput('');
    setSending(true);

    // Optimistic user bubble
    const tempId = Date.now();
    const userMsg: Message = { id: tempId, sessionId: activeSession.id, role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const r = await apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          documentIds: pinnedDocs.length > 0 ? pinnedDocs : undefined,
          legalSourceIds: pinnedSrcs.length > 0 ? pinnedSrcs : undefined,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        // Replace optimistic message with server message, add assistant reply
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          { ...userMsg, id: tempId }, // keep user msg (optimistic is fine)
          data.message,
        ]);
        fetchSessions();
      } else {
        const errData = await r.json().catch(() => ({}));
        toast({ title: t('خطأ في الإرسال', 'Send failed'), description: (errData as { error?: string }).error, variant: 'destructive' });
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const toggleDoc = (id: number) =>
    setPinnedDocs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSrc = (id: number) =>
    setPinnedSrcs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const totalPinned = pinnedDocs.length + pinnedSrcs.length;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-5rem)] gap-4" dir="rtl">

        {/* ─── Sessions sidebar ──────────────────────────────────────── */}
        <div className="w-60 shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-foreground">{t('المحادثات', 'Conversations')}</h2>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={createSession} disabled={!canUseAi}>
              <Plus className="w-3.5 h-3.5" />
              {t('جديد', 'New')}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {sessions.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                {t('لا توجد محادثات بعد', 'No conversations yet')}
              </div>
            ) : sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setActiveSession(s); setPinnedDocs([]); setPinnedSrcs([]); }}
                className={`w-full text-start p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between group ${
                  activeSession?.id === s.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-transparent hover:border-border hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <span className="truncate font-medium">{s.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => deleteSession(s, e)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive p-0.5"
                  aria-label={t('حذف المحادثة', 'Delete conversation')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>

          {/* Pinned sources badge */}
          {totalPinned > 0 && (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
              <Pin className="w-3 h-3 shrink-0" />
              {t(`${totalPinned} مصدر مثبّت`, `${totalPinned} source(s) pinned`)}
            </div>
          )}
        </div>

        {/* ─── Chat area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden">

          {/* Header */}
          <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground">{t('المساعد القانوني الذكي', 'AI Legal Assistant')}</h2>
              <p className="text-[10px] text-muted-foreground">{t('بحث دلالي في مكتبتك ● القانون الإماراتي والفرنسي والأوروبي', 'Semantic RAG ● UAE · French · EU law')}</p>
            </div>
            {activeSession && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">
                <Scale className="w-3 h-3" />
                {activeSession.title.slice(0, 30)}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!activeSession ? (
              /* ─── Welcome state ─── */
              <div className="h-full flex flex-col items-center justify-center gap-6 text-center" dir="rtl">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-gold" aria-hidden />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1 text-lg">
                    {t('ابدأ محادثة قانونية', 'Start a legal conversation')}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {t(
                      'المساعد يبحث في مكتبتك الخاصة والمصادر القانونية ويستشهد بالمصادر مع كل إجابة.',
                      'The assistant searches your private library and legal sources, citing every reference.',
                    )}
                  </p>
                </div>
                {canUseAi && (
                  <>
                    <Button className="gap-1.5" onClick={createSession}>
                      <Plus className="w-4 h-4" />
                      {t('محادثة جديدة', 'New conversation')}
                    </Button>
                    {/* Suggested prompts */}
                    <div className="grid grid-cols-2 gap-2 w-full max-w-md mt-2">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={async () => { await createSession(); }}
                          className="text-start text-xs p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                        >
                          {t(s.ar, s.en)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              /* ─── Empty session — show prompts ─── */
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center" dir="rtl">
                <Bot className="w-10 h-10 text-muted-foreground/30" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {t('اطرح سؤالاً قانونياً للبدء', 'Ask a legal question to begin')}
                </p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(t(s.ar, s.en))}
                      className="text-start text-xs p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {t(s.ar, s.en)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
                {sending && (
                  <div className="flex justify-end mb-4" dir="rtl">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-1 shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
                    </div>
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-se-none px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* ─── Input bar ─────────────────────────────────────────── */}
          <div className="px-4 py-3 border-t border-border/50 relative" dir="rtl">
            {/* Pin panel */}
            {showPinPanel && (
              <PinPanel
                docs={(documents ?? []) as Array<{ id: number; originalName?: string; filename?: string }>}
                sources={legalSources}
                pinnedDocs={pinnedDocs}
                pinnedSrcs={pinnedSrcs}
                onToggleDoc={toggleDoc}
                onToggleSrc={toggleSrc}
                onClose={() => setShowPinPanel(false)}
                t={t}
              />
            )}

            <div className="flex items-end gap-2">
              {/* Pin button */}
              <button
                type="button"
                onClick={() => setShowPinPanel((s) => !s)}
                disabled={!activeSession}
                className={`shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40 ${
                  totalPinned > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
                title={t('تثبيت مصادر', 'Pin sources')}
              >
                {totalPinned > 0 ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>

              <label className="sr-only" htmlFor="assistant-input">{t('رسالتك', 'Your message')}</label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                className="flex-1 resize-none border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                placeholder={
                  !activeSession
                    ? t('أنشئ محادثة جديدة أولاً', 'Create a new conversation first')
                    : totalPinned > 0
                    ? t(`اكتب سؤالك… (${totalPinned} مصدر مثبّت)`, `Type your question… (${totalPinned} pinned)`)
                    : t('اكتب سؤالك القانوني…', 'Type your legal question…')
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={!activeSession || !canUseAi}
                style={{ minHeight: '2.5rem', maxHeight: '8rem' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
              />
              <Button
                size="sm"
                className="shrink-0 h-10 w-10 p-0 rounded-xl"
                onClick={() => sendMessage()}
                disabled={!input.trim() || !activeSession || sending || !canUseAi}
                aria-label={t('إرسال', 'Send')}
              >
                <Send className="w-4 h-4" aria-hidden />
              </Button>
            </div>

            {/* Pinned badges */}
            {totalPinned > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pinnedDocs.map((id) => {
                  const d = documents?.find((x) => x.id === id);
                  return d ? (
                    <span key={id} className="flex items-center gap-1 bg-primary/8 border border-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full">
                      <FileText className="w-2.5 h-2.5" />
                      <span className="max-w-[100px] truncate">{d.originalName ?? d.filename}</span>
                      <button type="button" onClick={() => toggleDoc(id)}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ) : null;
                })}
                {pinnedSrcs.map((id) => {
                  const s = legalSources.find((x) => x.id === id);
                  return s ? (
                    <span key={id} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2 py-0.5 rounded-full">
                      <BookOpen className="w-2.5 h-2.5" />
                      <span className="max-w-[100px] truncate">{s.titleAr ?? s.title}</span>
                      <button type="button" onClick={() => toggleSrc(id)}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
