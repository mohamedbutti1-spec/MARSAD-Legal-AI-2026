import React, { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGenerateLiteratureReview, useListDocuments } from '@workspace/api-client-react';
import { apiFetch } from '@/lib/api-fetch';
import {
  BookOpenText, FileText, BookOpen, CheckCircle2, Download,
  Sparkles, Loader2, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserContext, useT } from '@/lib/user-context';
import { useToast } from '@/hooks/use-toast';
import { RouteGuard } from '@/components/ui/route-guard';

interface LegalSource {
  id: number;
  title: string;
  titleAr: string | null;
  jurisdiction: string;
  docType: string;
  year: number | null;
}

interface ReviewResult {
  topic: string;
  review: string;
  sources: Array<{ name: string; relevance: string }>;
  wordCount: number;
  generatedAt: string;
  _meta: { provider: string; model: string } | null;
}

export default function LiteratureReview() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const { toast } = useToast();

  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('Arabic');
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [legalSources, setLegalSources] = useState<LegalSource[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: documents } = useListDocuments();

  const reviewMutation = useGenerateLiteratureReview();
  const outputRef = useRef<HTMLDivElement>(null);

  // Lazily load legal sources on first expand
  async function loadLegalSources() {
    if (legalSources !== null) return;
    setSourcesLoading(true);
    try {
      const r = await apiFetch('/api/legal-sources?limit=60');
      if (r.ok) { const d = await r.json(); setLegalSources(d.sources ?? []); }
    } catch { setLegalSources([]); } finally { setSourcesLoading(false); }
  }

  const toggleDoc = (id: number) =>
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSource = (id: number) =>
    setSelectedSources(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  async function handleGenerate() {
    if (!topic.trim() || (selectedDocs.length === 0 && selectedSources.length === 0)) return;
    setGenerating(true);
    setResult(null);
    try {
      const r = await apiFetch('/api/ai/literature-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: selectedDocs,
          legalSourceIds: selectedSources,
          topic,
          language,
        }),
      });
      if (r.ok) {
        const data: ReviewResult = await r.json();
        setResult(data);
      } else {
        const d = await r.json().catch(() => ({}));
        toast({ title: t('فشل التوليد', 'Generation failed'), description: d.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection error'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const lines = [
      `مراجعة الأدبيات — ${result.topic}`,
      `التاريخ: ${new Date(result.generatedAt).toLocaleDateString('ar-AE')}`,
      result._meta ? `المزوّد: ${result._meta.provider} · ${result._meta.model}` : '',
      '',
      '─'.repeat(60),
      '',
      result.review,
      '',
      '─'.repeat(60),
      t('المصادر:', 'Sources:'),
      ...result.sources.map((s, i) => `${i + 1}. ${s.name} — ${s.relevance}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `literature-review-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalSelected = selectedDocs.length + selectedSources.length;
  const canGenerate = topic.trim().length > 0 && totalSelected > 0 && !generating;

  return (
    <RouteGuard allow={canUseAi}>
      <AppLayout>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <BookOpenText className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t('مراجعة الأدبيات القانونية', 'Legal Literature Review')}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  'اختر وثائقك والمصادر القانونية وسيُنشئ الذكاء الاصطناعي مراجعة أدبية أكاديمية منظّمة.',
                  'Select your documents and legal sources and AI will generate a structured academic review.',
                )}
              </p>
            </div>
            {result && (
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2 shrink-0">
                <Download className="w-4 h-4" />
                {t('تصدير النص', 'Export')}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ─── Left: Source selectors ──────────────────────────────── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Uploaded documents */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {t('الوثائق المرفوعة', 'Uploaded Documents')}
                    {selectedDocs.length > 0 && (
                      <span className="ms-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                        {selectedDocs.length}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1 max-h-52 overflow-y-auto">
                  {!documents || documents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {t('لا توجد وثائق مرفوعة', 'No uploaded documents')}
                    </p>
                  ) : documents.map(doc => (
                    <label key={doc.id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm ${selectedDocs.includes(doc.id) ? 'bg-primary/8 border border-primary/20' : 'hover:bg-muted/40 border border-transparent'}`}>
                      <input type="checkbox" className="rounded shrink-0" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)} />
                      <span className="truncate font-medium">{doc.originalName ?? doc.filename}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Legal sources */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gold" />
                      {t('المصادر القانونية', 'Legal Sources')}
                      {selectedSources.length > 0 && (
                        <span className="ms-auto text-xs bg-gold/15 text-gold px-2 py-0.5 rounded-full font-semibold">
                          {selectedSources.length}
                        </span>
                      )}
                    </CardTitle>
                    {legalSources === null && (
                      <button
                        type="button"
                        onClick={loadLegalSources}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('تحميل', 'Load')}
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1 max-h-52 overflow-y-auto">
                  {legalSources === null ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {t('انقر "تحميل" لاستعراض المصادر القانونية', 'Click "Load" to browse legal sources')}
                    </p>
                  ) : sourcesLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : legalSources.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {t('لا توجد مصادر قانونية', 'No legal sources')}
                    </p>
                  ) : legalSources.map(src => (
                    <label key={src.id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm ${selectedSources.includes(src.id) ? 'bg-gold/10 border border-gold/25' : 'hover:bg-muted/40 border border-transparent'}`}>
                      <input type="checkbox" className="rounded shrink-0" checked={selectedSources.includes(src.id)} onChange={() => toggleSource(src.id)} />
                      <span className="truncate">{src.titleAr ?? src.title}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Topic + language */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">
                    {t('موضوع المراجعة', 'Review Topic')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <textarea
                    className="w-full min-h-[90px] bg-background border border-input rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    placeholder={t('أدخل موضوع البحث أو السؤال القانوني…', 'Enter the research topic or legal question…')}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                  <select
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="Arabic">{t('العربية', 'Arabic')}</option>
                    <option value="English">{t('الإنجليزية', 'English')}</option>
                    <option value="French">{t('الفرنسية', 'French')}</option>
                  </select>

                  {totalSelected === 0 && (
                    <div className="flex items-center gap-2 text-xs text-gold bg-gold/10 border border-gold/25 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {t('اختر مصدراً واحداً على الأقل', 'Select at least one source')}
                    </div>
                  )}

                  <Button
                    className="w-full gap-2"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                  >
                    {generating
                      ? <><Loader2 className="w-4 h-4 animate-spin" />{t('جارٍ التوليد…', 'Generating…')}</>
                      : <><Sparkles className="w-4 h-4 text-gold" />{t('توليد المراجعة', 'Generate Review')}</>
                    }
                  </Button>
                  {totalSelected > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      {t(`${totalSelected} مصدر محدد`, `${totalSelected} source(s) selected`)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ─── Right: Output ────────────────────────────────────────── */}
            <div className="lg:col-span-2">
              <Card className="h-full min-h-[560px] border-primary/15">
                <CardHeader className="bg-muted/20 border-b px-5 py-4">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <BookOpenText className="w-5 h-5 text-primary" />
                    {t('المراجعة المُنشأة', 'Generated Review')}
                    {result?._meta && (
                      <span className="ms-auto text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
                        {result._meta.provider} · {result._meta.model}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 relative" ref={outputRef}>
                  {generating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm z-10 rounded-b-xl">
                      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                      <p className="font-semibold text-foreground">
                        {t('جارٍ تركيب المراجعة…', 'Synthesising review…')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('قد يستغرق ذلك لحظات', 'This may take a moment')}
                      </p>
                    </div>
                  )}

                  {!result && !generating && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20 text-center">
                      <BookOpenText className="w-14 h-14 mb-4 opacity-20" />
                      <p className="text-sm max-w-xs">
                        {t(
                          'اختر مصادرك وأدخل موضوع البحث ثم اضغط "توليد المراجعة".',
                          'Select your sources, enter the research topic, then click "Generate Review".',
                        )}
                      </p>
                    </div>
                  )}

                  {result && (
                    <div className="animate-in fade-in duration-500 space-y-6">
                      {/* Title + sources chips */}
                      <div className="border-b border-border/50 pb-5">
                        <h2 className="text-xl font-bold font-serif mb-3">{result.topic}</h2>
                        <div className="flex flex-wrap gap-2">
                          {result.sources.map((s, i) => (
                            <span key={i} className="flex items-center gap-1 bg-primary/5 border border-primary/15 text-primary px-2.5 py-1 rounded-full text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              {s.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          {result.wordCount > 0 && <span>{t(`${result.wordCount} كلمة تقريباً`, `~${result.wordCount} words`)}</span>}
                          <span>·</span>
                          <span>{new Date(result.generatedAt).toLocaleDateString('ar-AE')}</span>
                        </div>
                      </div>

                      {/* Review body */}
                      <div className="prose prose-sm max-w-none font-serif leading-loose whitespace-pre-wrap text-foreground">
                        {result.review}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppLayout>
    </RouteGuard>
  );
}
