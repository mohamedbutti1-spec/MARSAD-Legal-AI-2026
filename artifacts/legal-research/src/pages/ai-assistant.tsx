import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { useListDocuments } from '@workspace/api-client-react';
import {
  Bot, Plus, Trash2, Send, Loader2, MessageSquare, Sparkles,
  FileText, BookOpen, Copy, Check, ChevronDown, ChevronUp,
  X, Pin, PinOff, Scale, Menu, ChevronRight,
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

interface LegalSource { id: number; title: string; titleAr?: string | null; jurisdiction: string; }

type CitFmt = 'harvard' | 'apa' | 'uaeGov';

// ─── Citation chip ────────────────────────────────────────────────────────────

const FMT_LABELS: Record<CitFmt, { ar: string; en: string }> = {
  harvard: { ar: 'هارفرد', en: 'Harvard' },
  apa:     { ar: 'APA',    en: 'APA' },
  uaeGov:  { ar: 'إماراتي', en: 'UAE Gov.' },
};

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
    <span className="relative inline-block align-baseline">
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
        {isDoc ? <FileText className="w-2.5 h-2.5 shrink-0" /> : <BookOpen className="w-2.5 h-2.5 shrink-0" />}
        <span className="max-w-[120px] truncate">{label}</span>
      </button>

      {open && citation?.formats && (
        <div
          className="absolute z-50 bottom-full mb-1 start-0 w-72 sm:w-80 bg-card border border-border rounded-xl shadow-xl p-3 text-start"
          dir="rtl"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground truncate">{label}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground ms-2 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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

// ─── Message content renderer ─────────────────────────────────────────────────

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
    parts.push(<CitationChip key={`${token}-${match.index}`} token={token} citation={cit} />);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const citations = (msg.meta?.citations ?? []) as Citation[];
  const [showSources, setShowSources] = useState(false);

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-3 sm:mb-4`} dir="rtl">
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-1 shrink-0">
          <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
        </div>
      )}

      <div className={`max-w-[88%] sm:max-w-[82%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-muted border border-border text-foreground rounded-ss-none'
              : 'bg-primary text-primary-foreground rounded-se-none'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <p className="whitespace-pre-wrap break-words leading-7">
              {parseContent(msg.content, citations)}
            </p>
          )}
        </div>

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
                    {c.type === 'document'
                      ? <FileText className="w-3 h-3 shrink-0" />
                      : <BookOpen className="w-3 h-3 shrink-0 text-amber-600" />}
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
  { ar: 'ما هي شروط إنهاء العقد في القانون الإماراتي؟', en: 'Contract termination under UAE law?' },
  { ar: 'قارن بين قانون الشركات الإماراتي والفرنسي', en: 'Compare UAE & French company law' },
  { ar: 'حقوق العمال في تشريعات الاتحاد الأوروبي', en: 'EU worker rights legislation' },
  { ar: 'المسؤولية المدنية والتعويض في القانون الإماراتي', en: 'Civil liability & compensation UAE' },
];

// ─── Sessions drawer (mobile) ─────────────────────────────────────────────────

function SessionsDrawer({
  open,
  sessions,
  activeId,
  onSelect,
  onDelete,
  onCreate,
  onClose,
  canUseAi,
  t,
}: {
  open: boolean;
  sessions: Session[];
  activeId?: number;
  onSelect: (s: Session) => void;
  onDelete: (s: Session, e: React.MouseEvent) => void;
  onCreate: () => void;
  onClose: () => void;
  canUseAi: boolean;
  t: (ar: string, en: string) => string;
}) {
  return (
    <>
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-2xl transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70dvh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border/50">
          <h3 className="font-semibold text-sm text-foreground">{t('المحادثات', 'Conversations')}</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={onCreate} disabled={!canUseAi}>
              <Plus className="w-3.5 h-3.5" />
              {t('جديد', 'New')}
            </Button>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-3 py-2 space-y-1" style={{ maxHeight: 'calc(70dvh - 5rem)' }}>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('لا توجد محادثات', 'No conversations yet')}</p>
          ) : sessions.map((s) => (
            /* Plain div wrapper — two sibling buttons, no nesting */
            <div
              key={s.id}
              className={`flex items-center rounded-xl border text-xs transition-all group ${
                activeId === s.id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent hover:border-border hover:bg-muted/30'
              }`}
            >
              <button
                type="button"
                onClick={() => { onSelect(s); onClose(); }}
                className={`flex-1 text-start px-3 py-2.5 flex items-center gap-2 min-w-0 ${
                  activeId === s.id ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-medium">{s.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(s, e); }}
                className="shrink-0 pe-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive p-0.5"
                aria-label={t('حذف المحادثة', 'Delete conversation')}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Pin panel ────────────────────────────────────────────────────────────────

function PinPanel({
  docs, sources, pinnedDocs, pinnedSrcs, onToggleDoc, onToggleSrc, onClose, t,
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
    <div
      className="absolute bottom-full mb-2 start-0 end-0 bg-card border border-border rounded-xl shadow-xl z-40 max-h-64 overflow-hidden flex flex-col"
      dir="rtl"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0">
        <p className="text-xs font-semibold text-foreground">{t('تثبيت مصادر', 'Pin sources')}</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-border/30">
        {docs.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t('الوثائق', 'Documents')}</p>
            {docs.map((d) => (
              <label key={d.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer text-xs">
                <input type="checkbox" className="rounded shrink-0" checked={pinnedDocs.includes(d.id)} onChange={() => onToggleDoc(d.id)} />
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
                <input type="checkbox" className="rounded shrink-0" checked={pinnedSrcs.includes(s.id)} onChange={() => onToggleSrc(s.id)} />
                <BookOpen className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">{s.titleAr ?? s.title}</span>
              </label>
            ))}
          </div>
        )}
        {docs.length === 0 && sources.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">{t('لا توجد مصادر', 'No sources yet')}</p>
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
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [pinnedDocs, setPinnedDocs] = useState<number[]>([]);
  const [pinnedSrcs, setPinnedSrcs] = useState<number[]>([]);
  const [legalSources, setLegalSources] = useState<LegalSource[]>([]);

  const { data: documents } = useListDocuments();

  const fetchSessions = useCallback(async () => {
    const r = await apiFetch('/api/assistant/sessions');
    if (r.ok) { const d = await r.json(); setSessions(d.sessions ?? []); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    apiFetch('/api/legal-sources?limit=80')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.sources) setLegalSources(d.sources); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeSession) { setMessages([]); return; }
    setLoadingMessages(true);
    apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setMessages(d.messages ?? []); })
      .finally(() => setLoadingMessages(false));
  }, [activeSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

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

    const tempId = Date.now();
    const userMsg: Message = {
      id: tempId, sessionId: activeSession.id, role: 'user',
      content: text, createdAt: new Date().toISOString(),
    };
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
        setMessages((prev) => [...prev.filter((m) => m.id !== tempId), userMsg, data.message]);
        fetchSessions();
      } else {
        const errData = await r.json().catch(() => ({}));
        toast({
          title: t('خطأ في الإرسال', 'Send failed'),
          description: (errData as { error?: string }).error,
          variant: 'destructive',
        });
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
    <AppLayout variant="chat">
      {/* Mobile sessions drawer */}
      <SessionsDrawer
        open={showSessionsDrawer}
        sessions={sessions}
        activeId={activeSession?.id}
        onSelect={(s) => { setActiveSession(s); setPinnedDocs([]); setPinnedSrcs([]); }}
        onDelete={deleteSession}
        onCreate={async () => { await createSession(); setShowSessionsDrawer(false); }}
        onClose={() => setShowSessionsDrawer(false)}
        canUseAi={canUseAi}
        t={t}
      />

      {/* ─── Main flex layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden" dir="rtl">

        {/* ─── Desktop sessions sidebar ───────────────────────────────── */}
        <div className="hidden md:flex md:w-52 lg:w-60 shrink-0 flex-col gap-2 p-3 lg:p-4 border-e border-border bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-foreground">{t('المحادثات', 'Conversations')}</h2>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={createSession} disabled={!canUseAi}>
              <Plus className="w-3.5 h-3.5" />
              {t('جديد', 'New')}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {t('لا توجد محادثات', 'No conversations yet')}
              </p>
            ) : sessions.map((s) => (
              /* Plain div wrapper — two sibling buttons, no nesting */
              <div
                key={s.id}
                className={`flex items-center rounded-lg border text-xs transition-all group ${
                  activeSession?.id === s.id
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:border-border hover:bg-muted/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => { setActiveSession(s); setPinnedDocs([]); setPinnedSrcs([]); }}
                  className={`flex-1 text-start px-2.5 py-2 flex items-center gap-2 min-w-0 ${
                    activeSession?.id === s.id ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">{s.title}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => deleteSession(s, e)}
                  className="shrink-0 pe-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive p-0.5"
                  aria-label={t('حذف', 'Delete')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {totalPinned > 0 && (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shrink-0">
              <Pin className="w-3 h-3 shrink-0" />
              {t(`${totalPinned} مثبّت`, `${totalPinned} pinned`)}
            </div>
          )}
        </div>

        {/* ─── Chat column ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

          {/* Chat header */}
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border/50 flex items-center gap-2.5 shrink-0 bg-card">
            {/* Mobile: sessions menu button */}
            <button
              type="button"
              onClick={() => setShowSessionsDrawer(true)}
              className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted/30 transition-colors shrink-0"
              aria-label={t('قائمة المحادثات', 'Sessions menu')}
            >
              <Menu className="w-3.5 h-3.5" />
              <span className="max-w-[100px] truncate">
                {activeSession ? activeSession.title : t('المحادثات', 'Sessions')}
              </span>
            </button>

            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hidden md:flex">
              <Bot className="w-4 h-4 text-primary" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground leading-tight">
                {t('المساعد القانوني الذكي', 'AI Legal Assistant')}
              </h2>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                {t('القانون الإماراتي · الفرنسي · الأوروبي', 'UAE · French · EU law')}
              </p>
            </div>
            {activeSession && (
              <button
                type="button"
                onClick={createSession}
                className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors shrink-0"
                aria-label={t('محادثة جديدة', 'New conversation')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4">
            {!activeSession ? (
              /* Welcome / landing state */
              <div className="h-full flex flex-col items-center justify-center gap-4 sm:gap-6 text-center" dir="rtl">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary/70" aria-hidden />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1 text-base sm:text-lg">
                    {t('ابدأ محادثة قانونية', 'Start a legal conversation')}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm px-4">
                    {t(
                      'المساعد يبحث في مكتبتك والمصادر القانونية ويستشهد بكل مصدر.',
                      'Searches your library and legal sources, citing every reference.',
                    )}
                  </p>
                </div>
                {canUseAi && (
                  <>
                    <Button className="gap-1.5 text-sm" onClick={createSession}>
                      <Plus className="w-4 h-4" />
                      {t('محادثة جديدة', 'New conversation')}
                    </Button>
                    {/* Suggested prompts — horizontal scroll on mobile, grid on sm+ */}
                    <div className="w-full max-w-md px-2">
                      <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden" style={{ scrollbarWidth: 'none' }}>
                        {SUGGESTIONS.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => createSession()}
                            className="flex-none text-start text-xs px-3 py-2.5 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground whitespace-nowrap"
                          >
                            {t(s.ar, s.en)}
                          </button>
                        ))}
                      </div>
                      <div className="hidden sm:grid grid-cols-2 gap-2">
                        {SUGGESTIONS.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => createSession()}
                            className="text-start text-xs p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                          >
                            {t(s.ar, s.en)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              /* Empty session prompt chips */
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center" dir="rtl">
                <Bot className="w-10 h-10 text-muted-foreground/30" aria-hidden />
                <p className="text-sm text-muted-foreground px-4">
                  {t('اطرح سؤالاً قانونياً للبدء', 'Ask a legal question to begin')}
                </p>
                {/* Horizontal scroll on mobile, grid on sm+ */}
                <div className="w-full max-w-md px-2">
                  <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden" style={{ scrollbarWidth: 'none' }}>
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendMessage(t(s.ar, s.en))}
                        className="flex-none text-start text-xs px-3 py-2.5 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground whitespace-nowrap"
                      >
                        {t(s.ar, s.en)}
                      </button>
                    ))}
                  </div>
                  <div className="hidden sm:grid grid-cols-2 gap-2">
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
              </div>
            ) : (
              <>
                {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
                {sending && (
                  <div className="flex justify-end mb-3" dir="rtl">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-1 shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
                    </div>
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-se-none px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="w-1.5 h-1.5 rounded-full bg-primary-foreground/60 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* ─── Composer / input bar ──────────────────────────────── */}
          <div className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border/50 bg-card relative" dir="rtl">
            {/* Pin panel popup */}
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

            {/* Pinned badges */}
            {totalPinned > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pinnedDocs.map((id) => {
                  const d = documents?.find((x) => x.id === id);
                  return d ? (
                    <span key={id} className="flex items-center gap-1 bg-primary/8 border border-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full">
                      <FileText className="w-2.5 h-2.5 shrink-0" />
                      <span className="max-w-[80px] sm:max-w-[120px] truncate">{d.originalName ?? d.filename}</span>
                      <button type="button" onClick={() => toggleDoc(id)} className="shrink-0"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ) : null;
                })}
                {pinnedSrcs.map((id) => {
                  const s = legalSources.find((x) => x.id === id);
                  return s ? (
                    <span key={id} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2 py-0.5 rounded-full">
                      <BookOpen className="w-2.5 h-2.5 shrink-0" />
                      <span className="max-w-[80px] sm:max-w-[120px] truncate">{s.titleAr ?? s.title}</span>
                      <button type="button" onClick={() => toggleSrc(id)} className="shrink-0"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2">
              {/* Pin button */}
              <button
                type="button"
                onClick={() => setShowPinPanel((s) => !s)}
                disabled={!activeSession}
                className={`shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40 ${
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
                className="flex-1 resize-none border border-border rounded-xl px-3 py-2 sm:py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground min-w-0"
                placeholder={
                  !activeSession
                    ? t('أنشئ محادثة أولاً', 'Create a conversation first')
                    : totalPinned > 0
                    ? t('اكتب سؤالك...', 'Type your question...')
                    : t('اكتب سؤالك القانوني…', 'Type your legal question…')
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={!activeSession || !canUseAi}
                style={{ minHeight: '2.25rem', maxHeight: '7rem' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
                }}
              />
              <Button
                size="sm"
                className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl"
                onClick={() => sendMessage()}
                disabled={!input.trim() || !activeSession || sending || !canUseAi}
                aria-label={t('إرسال', 'Send')}
              >
                <Send className="w-4 h-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
