import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { useToast } from '@/hooks/use-toast';
import { addToArchive, isArchived } from '@/lib/marsad-local-store';
import { exportTextToPdf, exportTextToWord } from '@/lib/export-simple-doc';
import {
  Loader2, FileText, Scale, BookOpenText, ShieldCheck, Gauge,
  AlertTriangle, ScrollText, Archive as ArchiveIcon, Download,
  Copy, Share2, Pencil, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Citation {
  token: string;
  title: string;
  type: 'document' | 'legal_source';
  sourceId: number;
  formats?: { harvard: string; apa: string; uaeGov: string };
}
interface MessageMeta {
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
interface Session { id: number; title: string; updatedAt: string; }

// ─── Best-effort section splitter ──────────────────────────────────────────────
// The AI's markdown answer is not guaranteed to use any particular heading
// scheme, so this never discards content: anything it can't confidently map
// to النتيجة / الوقائع / التحليل القانوني is kept, labelled, under "تفاصيل إضافية".
function parseAnswer(content: string): {
  result: string; facts: string; legalAnalysis: string; extra: { title: string; body: string }[];
} {
  const lines = content.split(/\r?\n/);
  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,4}\s+(.+)$/) ?? line.match(/^\*\*(.+)\*\*$/);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { title: headerMatch[1].trim(), body: [] };
    } else {
      if (!current) current = { title: '', body: [] };
      current.body.push(line);
    }
  }
  if (current) sections.push(current);

  if (sections.length <= 1) {
    return { result: content.trim(), facts: '', legalAnalysis: '', extra: [] };
  }

  let result = '', facts = '', legalAnalysis = '';
  const extra: { title: string; body: string }[] = [];
  for (const s of sections) {
    const body = s.body.join('\n').trim();
    if (!body) continue;
    const t = s.title;
    if (!t) { result += (result ? '\n\n' : '') + body; continue; }
    if (/نتيجة|خلاصة|إجابة مباشرة/.test(t)) result += (result ? '\n\n' : '') + body;
    else if (/وقائع/.test(t)) facts += (facts ? '\n\n' : '') + body;
    else if (/تحليل|أساس قانوني|تكييف/.test(t)) legalAnalysis += (legalAnalysis ? '\n\n' : '') + body;
    else extra.push({ title: t, body });
  }
  if (!result) result = content.trim();
  return { result: result.trim(), facts: facts.trim(), legalAnalysis: legalAnalysis.trim(), extra };
}

function confidenceFromCitations(count: number): { labelAr: string; color: string } {
  if (count >= 4) return { labelAr: 'مرتفعة', color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' };
  if (count >= 1) return { labelAr: 'متوسطة', color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' };
  return { labelAr: 'منخفضة — بلا مراجع مستخرجة', color: 'text-rose-400 border-rose-400/30 bg-rose-400/10' };
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="moj-card rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-gold shrink-0">{icon}</div>
        <h3 className="font-bold text-heading text-sm sm:text-base">{title}</h3>
      </div>
      <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

export default function ResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const t = useT();
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [assistantMsg, setAssistantMsg] = useState<Message | null>(null);
  const [userMsg, setUserMsg] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await apiFetch(`/api/assistant/sessions/${sessionId}/messages`);
      if (!r.ok || cancelled) { setLoading(false); return; }
      const d = await r.json();
      const msgs: Message[] = d.messages ?? [];
      const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant') ?? null;
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user') ?? null;
      if (!cancelled) {
        setAssistantMsg(lastAssistant);
        setUserMsg(lastUser);
        setSession({ id: Number(sessionId), title: lastUser?.content.slice(0, 60) ?? 'طلب محفوظ', updatedAt: lastAssistant?.createdAt ?? new Date().toISOString() });
        setArchived(isArchived(Number(sessionId)));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const parsed = useMemo(
    () => (assistantMsg ? parseAnswer(assistantMsg.content) : null),
    [assistantMsg],
  );
  const citations = assistantMsg?.meta?.citations ?? [];
  const confidence = confidenceFromCitations(citations.length);

  const fullText = useMemo(() => {
    if (!parsed) return '';
    const parts = [parsed.result];
    if (parsed.facts) parts.push(`الوقائع:\n${parsed.facts}`);
    if (parsed.legalAnalysis) parts.push(`التحليل القانوني:\n${parsed.legalAnalysis}`);
    for (const ex of parsed.extra) parts.push(`${ex.title}:\n${ex.body}`);
    return parts.join('\n\n');
  }, [parsed]);

  const title = session?.title ? `مرصد — ${session.title}` : 'مرصد — نتيجة';

  const handleSaveArchive = () => {
    if (!session) return;
    addToArchive({ sessionId: session.id, title: session.title, savedAt: new Date().toISOString() });
    setArchived(true);
    toast({ title: t('تم الحفظ في الأرشيف', 'Saved to archive') });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast({ title: t('تم نسخ النتيجة', 'Result copied') });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('تعذّر النسخ', 'Copy failed'), variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, text: fullText.slice(0, 300), url: shareUrl }); return; } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: t('تم نسخ رابط المشاركة', 'Share link copied') });
    } catch {
      toast({ title: t('تعذّرت المشاركة', 'Sharing failed'), variant: 'destructive' });
    }
  };

  const handleRequestEdit = () => {
    navigate(`/assistant`);
  };

  const handleDownloadPdf = async () => {
    try {
      await exportTextToPdf(title, fullText);
    } catch {
      toast({ title: t('تعذّر إنشاء ملف PDF', 'PDF export failed'), variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      </AppLayout>
    );
  }

  if (!assistantMsg || !parsed) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto text-center py-20">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-foreground/80 mb-1">{t('لا توجد نتيجة لهذا الطلب بعد', 'No result available for this request yet')}</p>
          <Link href="/" className="text-gold text-sm underline">{t('العودة إلى الرئيسية', 'Back to home')}</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4 pb-10" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-heading">{t('صفحة النتيجة', 'Result')}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleSaveArchive} disabled={archived} data-testid="button-save-archive">
              <ArchiveIcon className="w-3.5 h-3.5 me-1.5" />
              {archived ? t('محفوظ في الأرشيف', 'Archived') : t('حفظ في الأرشيف', 'Save to archive')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportTextToWord(title, fullText)} data-testid="button-download-word">
              <Download className="w-3.5 h-3.5 me-1.5" />Word
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPdf} data-testid="button-download-pdf">
              <Download className="w-3.5 h-3.5 me-1.5" />PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy} data-testid="button-copy-result">
              {copied ? <Check className="w-3.5 h-3.5 me-1.5" /> : <Copy className="w-3.5 h-3.5 me-1.5" />}
              {t('نسخ', 'Copy')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare} data-testid="button-share-result">
              <Share2 className="w-3.5 h-3.5 me-1.5" />{t('مشاركة', 'Share')}
            </Button>
            <Button size="sm" onClick={handleRequestEdit} className="bg-gold text-background hover:opacity-90" data-testid="button-request-edit">
              <Pencil className="w-3.5 h-3.5 me-1.5" />{t('طلب تعديل', 'Request edit')}
            </Button>
          </div>
        </div>

        {userMsg && (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground/70">{t('السؤال: ', 'Question: ')}</span>
            {userMsg.content}
          </div>
        )}

        {/* النتيجة */}
        <SectionCard icon={<FileText className="w-4 h-4" />} title={t('النتيجة', 'Result')}>
          {parsed.result || t('لا يوجد نص نتيجة منفصل — انظر الإجابة الكاملة أدناه.', 'No separate result text — see the full answer below.')}
        </SectionCard>

        {/* الوقائع */}
        <SectionCard icon={<ScrollText className="w-4 h-4" />} title={t('الوقائع', 'Facts')}>
          {parsed.facts || t('لم يستخرج المساعد قسم وقائع منفصلاً لهذه الإجابة.', 'The assistant did not produce a separate facts section for this answer.')}
        </SectionCard>

        {/* التحليل القانوني */}
        <SectionCard icon={<Scale className="w-4 h-4" />} title={t('التحليل القانوني', 'Legal Analysis')}>
          {parsed.legalAnalysis || t('لم يستخرج المساعد قسم تحليل قانوني منفصلاً لهذه الإجابة.', 'The assistant did not produce a separate legal-analysis section for this answer.')}
        </SectionCard>

        {parsed.extra.map((ex) => (
          <SectionCard key={ex.title} icon={<BookOpenText className="w-4 h-4" />} title={ex.title}>
            {ex.body}
          </SectionCard>
        ))}

        {/* النصوص والمراجع */}
        <SectionCard icon={<BookOpenText className="w-4 h-4" />} title={t('النصوص والمراجع', 'Texts & References')}>
          {citations.length === 0 ? (
            t('لا توجد مراجع مستخرجة لهذه الإجابة.', 'No references were extracted for this answer.')
          ) : (
            <ul className="space-y-1.5 list-disc ps-5">
              {citations.map((c) => (
                <li key={c.token}>{c.title}</li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ملاحظات التدقيق */}
        <SectionCard icon={<ShieldCheck className="w-4 h-4" />} title={t('ملاحظات التدقيق', 'Review Notes')}>
          {t(
            'هذه الإجابة مُولَّدة بمساعدة الذكاء الاصطناعي. تحقق دائمًا من صحة النصوص القانونية المذكورة ومن مطابقتها لآخر التعديلات التشريعية قبل الاعتماد عليها في أي إجراء رسمي.',
            'This answer is AI-generated. Always verify the cited legal texts and confirm they reflect the latest legislative amendments before relying on them for any official action.',
          )}
        </SectionCard>

        {/* درجة الثقة */}
        <SectionCard icon={<Gauge className="w-4 h-4" />} title={t('درجة الثقة', 'Confidence')}>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold ${confidence.color}`}>
            {confidence.labelAr}
          </span>
          <p className="text-xs text-muted-foreground mt-2">
            {t(
              'مؤشر أولي غير رسمي مبني على عدد المراجع المستخرجة تلقائيًا — وليس تقييمًا قانونيًا نهائيًا.',
              'A non-binding preliminary indicator based on the number of auto-extracted references — not a final legal assessment.',
            )}
          </p>
        </SectionCard>

        {/* ما يحتاج إلى تحقق بشري */}
        <SectionCard icon={<AlertTriangle className="w-4 h-4" />} title={t('ما يحتاج إلى تحقق بشري', 'Needs Human Verification')}>
          {t(
            'يُنصح بمراجعة بشرية متخصصة قبل اعتماد هذه النتيجة في أي قرار أو إجراء رسمي أو مذكرة تُقدَّم لجهة رسمية.',
            'Specialist human review is recommended before this result is relied on for any official decision, filing, or memorandum.',
          )}
        </SectionCard>

        {/* سجل الأسباب */}
        <SectionCard icon={<ScrollText className="w-4 h-4" />} title={t('سجل الأسباب', 'Reasoning Log')}>
          {citations.length === 0
            ? t('لا يتوفر سجل أسباب/مصادر منفصل لهذه الإجابة.', 'No separate reasoning/sources log is available for this answer.')
            : (
              <ul className="space-y-1 text-xs text-muted-foreground list-disc ps-5">
                {citations.map((c) => (<li key={c.token}>{c.token} — {c.title}</li>))}
              </ul>
            )}
        </SectionCard>
      </div>
    </AppLayout>
  );
}
