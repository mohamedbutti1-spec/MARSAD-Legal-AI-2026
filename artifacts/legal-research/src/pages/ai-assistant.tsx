import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { Bot, Plus, Trash2, Send, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Session { id: number; title: string; updatedAt: string; }
interface Message { id: number; sessionId: number; role: 'user' | 'assistant'; content: string; createdAt: string; meta?: Record<string, unknown> | null; }

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

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    const r = await apiFetch('/api/assistant/sessions');
    if (r.ok) { const data = await r.json(); setSessions(data.sessions ?? []); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Fetch messages when session changes
  useEffect(() => {
    if (!activeSession) { setMessages([]); return; }
    setLoadingMessages(true);
    apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMessages(data.messages ?? []); })
      .finally(() => setLoadingMessages(false));
  }, [activeSession]);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function createSession() {
    const r = await apiFetch('/api/assistant/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'محادثة جديدة' }) });
    if (r.ok) {
      const session = await r.json();
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
    }
  }

  async function deleteSession(session: Session, e: React.MouseEvent) {
    e.stopPropagation();
    await apiFetch(`/api/assistant/sessions/${session.id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== session.id));
    if (activeSession?.id === session.id) { setActiveSession(null); setMessages([]); }
  }

  async function sendMessage() {
    if (!input.trim() || !activeSession || sending) return;
    const userText = input.trim();
    setInput('');
    setSending(true);

    // Optimistic user bubble
    const tempId = Date.now();
    const userMsg: Message = { id: tempId, sessionId: activeSession.id, role: 'user', content: userText, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const r = await apiFetch(`/api/assistant/sessions/${activeSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userText }),
      });
      if (r.ok) {
        const data = await r.json();
        setMessages(prev => [...prev, data.message]);
        // Refresh session title
        fetchSessions();
      } else {
        toast({ title: t('خطأ في الإرسال', 'Send failed'), variant: 'destructive' });
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const Bubble = ({ msg }: { msg: Message }) => (
    <div className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} mb-3`}>
      {msg.role === 'assistant' && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-0.5 shrink-0">
          <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        msg.role === 'user'
          ? 'bg-muted border border-border text-foreground rounded-ss-none'
          : 'bg-primary text-primary-foreground rounded-se-none'
      }`}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.meta != null && typeof msg.meta === 'object' && 'provider' in (msg.meta as object) && (
          <p className="text-[10px] opacity-60 mt-1">
            {String((msg.meta as Record<string, string>).provider)} · {String((msg.meta as Record<string, string>).model ?? '')}
          </p>
        )}
      </div>
      {msg.role === 'user' && (
        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center ms-2 mt-0.5 shrink-0">
          <span className="text-xs font-bold text-muted-foreground">م</span>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-5rem)] gap-4">
        {/* Sessions sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
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
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSession(s)}
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
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    aria-label={t('حذف المحادثة', 'Delete conversation')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{t('المساعد الذكي', 'AI Assistant')}</h2>
              <p className="text-[10px] text-muted-foreground">{t('مدعوم بـ Claude Opus', 'Powered by Claude Opus')}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!activeSession ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-gold" aria-hidden />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">
                    {t('ابدأ محادثة جديدة', 'Start a new conversation')}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {t('اضغط على "جديد" لبدء محادثة مع المساعد القانوني الذكي.', 'Click "New" to start a conversation with the AI legal assistant.')}
                  </p>
                </div>
                {canUseAi && (
                  <Button className="gap-1.5" onClick={createSession}>
                    <Plus className="w-4 h-4" />
                    {t('محادثة جديدة', 'New conversation')}
                  </Button>
                )}
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <Bot className="w-10 h-10 text-muted-foreground/40" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {t('اطرح سؤالاً قانونياً للبدء', 'Ask a legal question to begin')}
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
                {sending && (
                  <div className="flex justify-end mb-3">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center me-2 mt-0.5 shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" aria-hidden />
                    </div>
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-se-none px-4 py-2.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border/50 flex items-end gap-2">
            <label className="sr-only" htmlFor="assistant-input">
              {t('رسالتك', 'Your message')}
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              className="flex-1 resize-none border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              placeholder={t('اكتب سؤالك القانوني هنا...', 'Type your legal question here...')}
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
              className="shrink-0 h-10 w-10 p-0 gap-0"
              onClick={sendMessage}
              disabled={!input.trim() || !activeSession || sending || !canUseAi}
              aria-label={t('إرسال', 'Send')}
            >
              <Send className="w-4 h-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
