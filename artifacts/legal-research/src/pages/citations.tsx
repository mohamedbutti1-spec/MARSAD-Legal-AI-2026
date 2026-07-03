import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { Quote, Copy, Check, Loader2, History, FileText, BookOpen, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useListDocuments } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

interface LegalSource { id: number; title: string; jurisdiction: string; docType: string; year: number | null; }

interface CitationResult { harvard: string; apa: string; uaeGov: string; title: string; year: number; author: string; }
interface HistoryItem { id: number; sourceType: string; rawText?: string; harvard?: string; apa?: string; uaeGov?: string; createdAt: string; }

type SourceType = 'document' | 'legal_source' | 'manual';
type Format = 'harvard' | 'apa' | 'uaeGov';

const FORMAT_LABELS = {
  harvard: { ar: 'هارفرد', en: 'Harvard' },
  apa:     { ar: 'APA', en: 'APA' },
  uaeGov:  { ar: 'حكومة الإمارات', en: 'UAE Gov.' },
};

export default function Citations() {
  const t = useT();
  const { toast } = useToast();
  const { data: documents } = useListDocuments();

  const [sourceType, setSourceType] = useState<SourceType>('document');
  const [sourceId, setSourceId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const [publisher, setPublisher] = useState('');
  const [url, setUrl] = useState('');
  const [activeFormat, setActiveFormat] = useState<Format>('harvard');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CitationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [legalSources, setLegalSources] = useState<LegalSource[]>([]);

  useEffect(() => {
    apiFetch('/api/legal-sources?limit=100')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.sources) setLegalSources(data.sources); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch('/api/citations/history')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.items) setHistory(data.items); })
      .catch(() => {});
  }, [result]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const body: Record<string, unknown> = { sourceType, authorName: author || undefined, publicationYear: year || undefined, publisher: publisher || undefined, url: url || undefined };
      if (sourceType === 'document')     body.sourceId = sourceId;
      if (sourceType === 'legal_source') body.sourceId = sourceId;
      if (sourceType === 'manual')       body.title = manualTitle;

      const r = await apiFetch('/api/citations/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (r.ok) setResult(await r.json());
      else toast({ title: t('فشل توليد الاستشهاد', 'Citation generation failed'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: t('تم النسخ', 'Copied!') });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Quote className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('مولّد الاستشهادات', 'Citation Generator')}</h1>
            <p className="text-sm text-muted-foreground">{t('أنشئ استشهادات أكاديمية بصيغ متعددة من وثائقك أو المصادر القانونية.', 'Generate academic citations in multiple formats from your documents or legal sources.')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Form */}
          <Card className="border-border">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm">{t('بيانات المصدر', 'Source Details')}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleGenerate} className="space-y-4">
                {/* Source type tabs */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {([
                    { value: 'document',     labelAr: 'وثيقة', labelEn: 'Document', icon: FileText },
                    { value: 'legal_source', labelAr: 'مصدر', labelEn: 'Source', icon: BookOpen },
                    { value: 'manual',       labelAr: 'يدوي', labelEn: 'Manual', icon: Pencil },
                  ] as const).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setSourceType(opt.value); setSourceId(''); setResult(null); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${sourceType === opt.value ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted/30'}`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden />
                        {t(opt.labelAr, opt.labelEn)}
                      </button>
                    );
                  })}
                </div>

                {/* Source picker */}
                {sourceType === 'document' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الوثيقة', 'Document')}</label>
                    <select
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      value={sourceId}
                      onChange={e => setSourceId(e.target.value)}
                      required
                    >
                      <option value="">{t('اختر وثيقة...', 'Select a document...')}</option>
                      {documents?.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.originalName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {sourceType === 'legal_source' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('المصدر القانوني', 'Legal Source')}</label>
                    <select
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      value={sourceId}
                      onChange={e => setSourceId(e.target.value)}
                      required
                    >
                      <option value="">{t('اختر مصدراً قانونياً...', 'Select a legal source...')}</option>
                      {legalSources.map(src => (
                        <option key={src.id} value={src.id}>
                          {src.title} {src.year ? `(${src.year})` : ''} — {src.jurisdiction}
                        </option>
                      ))}
                    </select>
                    {legalSources.length === 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">{t('لا توجد مصادر قانونية في المكتبة بعد.', 'No legal sources in the library yet.')}</p>
                    )}
                  </div>
                )}

                {sourceType === 'manual' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('عنوان المصدر', 'Source title')}</label>
                    <input
                      type="text"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={t('أدخل عنوان المصدر', 'Enter source title')}
                      value={manualTitle}
                      onChange={e => setManualTitle(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Common fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('المؤلف', 'Author')}</label>
                    <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Al Shamsi, M." value={author} onChange={e => setAuthor(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('السنة', 'Year')}</label>
                    <input type="number" min="1000" max="2099" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder={String(new Date().getFullYear())} value={year} onChange={e => setYear(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الناشر', 'Publisher')}</label>
                  <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Ministry of Justice" value={publisher} onChange={e => setPublisher(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الرابط (اختياري)', 'URL (optional)')}</label>
                  <input type="url" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
                </div>

                <Button type="submit" className="w-full gap-1.5" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('توليد الاستشهاد', 'Generate Citation')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Result */}
          <div className="space-y-4">
            {result ? (
              <Card className="border-border">
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{t('الاستشهاد', 'Citation')}</CardTitle>
                    {/* Format tabs */}
                    <div className="flex gap-1">
                      {(Object.keys(FORMAT_LABELS) as Format[]).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setActiveFormat(fmt)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${activeFormat === fmt ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/60'}`}
                        >
                          {t(FORMAT_LABELS[fmt].ar, FORMAT_LABELS[fmt].en)}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="bg-muted/30 border border-border rounded-lg p-3 mb-3">
                    <p className="text-sm leading-relaxed text-foreground">{result[activeFormat]}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 w-full"
                    onClick={() => copyToClipboard(result[activeFormat])}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t('تم النسخ!', 'Copied!') : t('نسخ', 'Copy')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="h-48 flex items-center justify-center border border-dashed border-border rounded-xl">
                <div className="text-center">
                  <Quote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('سيظهر الاستشهاد هنا', 'Citation will appear here')}</p>
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <Card className="border-border">
                <CardHeader className="px-4 pt-4 pb-2">
                  <button type="button" onClick={() => setShowHistory(h => !h)} className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <History className="w-4 h-4 text-muted-foreground" />
                    {t('السجل', 'History')}
                    <span className="text-xs text-muted-foreground ms-1">({history.length})</span>
                  </button>
                </CardHeader>
                {showHistory && (
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {history.slice(0, 10).map((item) => (
                        <div key={item.id} className="p-2 rounded border border-border/50 hover:bg-muted/20 transition-colors">
                          <p className="text-xs font-medium text-foreground truncate">{item.rawText ?? '—'}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.harvard}</p>
                          <p className="text-[10px] text-muted-foreground/60">
                            {new Date(item.createdAt).toLocaleDateString('ar-AE')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
