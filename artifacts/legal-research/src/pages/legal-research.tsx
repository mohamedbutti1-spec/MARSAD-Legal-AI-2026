import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { Search, Loader2, FileText, BookOpen, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-boundary';

interface SearchResult {
  ref: string;
  relevanceScore: number;
  excerpt: string;
  reason: string;
  meta: { title?: string; type: 'document' | 'legal_source'; id: number } | null;
}

interface SearchResponse {
  query: string;
  summary: string;
  results: SearchResult[];
  _meta: { provider: string; model: string } | null;
}

const JURISDICTION_OPTIONS = [
  { value: '',                labelAr: 'جميع الولايات', labelEn: 'All jurisdictions' },
  { value: 'uae_legislation', labelAr: 'التشريعات الإماراتية', labelEn: 'UAE Legislation' },
  { value: 'uae_caselaw',     labelAr: 'الاجتهاد القضائي', labelEn: 'UAE Case Law' },
  { value: 'france',          labelAr: 'القانون الفرنسي', labelEn: 'French Law' },
  { value: 'eu',              labelAr: 'القانون الأوروبي', labelEn: 'EU Law' },
];

export default function LegalResearch() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const [query, setQuery] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeLegalSources, setIncludeLegalSources] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  // Pick up quick search from dashboard
  useEffect(() => {
    const q = sessionStorage.getItem('quickSearchQuery');
    if (q) { setQuery(q); sessionStorage.removeItem('quickSearchQuery'); }
  }, []);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim() || !canUseAi) return;
    setLoading(true); setError(null); setResults(null);
    const sourceTypes: string[] = [];
    if (includeDocuments)    sourceTypes.push('documents');
    if (includeLegalSources) sourceTypes.push('legal_sources');
    try {
      const r = await apiFetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sourceTypes,
          jurisdiction: jurisdiction || undefined,
          yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
          yearTo: yearTo ? parseInt(yearTo) : undefined,
          limit: 8,
        }),
      });
      if (r.ok) { setResults(await r.json()); }
      else      { const d = await r.json().catch(() => ({})); setError(d.error ?? t('فشل البحث', 'Search failed')); }
    } catch {
      setError(t('خطأ في الاتصال بالخادم', 'Server connection error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Search className="w-5 h-5 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('البحث القانوني', 'Legal Research')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('بحث دلالي موحّد عبر الوثائق المرفوعة والمصادر القانونية بتقنية الذكاء الاصطناعي.', 'Unified AI semantic search across uploaded documents and legal sources.')}
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden />
            <input
              type="text"
              className="w-full border-2 border-border rounded-2xl ps-12 pe-4 py-3.5 text-base bg-background focus:outline-none focus:border-primary placeholder:text-muted-foreground shadow-sm"
              placeholder={t('ما هي شروط إنهاء عقد العمل وفق القانون الإماراتي؟', 'What are the conditions for terminating an employment contract under UAE law?')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!canUseAi}
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => setShowFilters(f => !f)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('فلاتر', 'Filters')}
            </button>
            <Button type="submit" className="gap-1.5" disabled={!query.trim() || loading || !canUseAi}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-gold" />}
              {loading ? t('جارٍ البحث...', 'Searching...') : t('بحث ذكي', 'AI Search')}
            </Button>
          </div>

          {showFilters && (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={includeDocuments} onChange={e => setIncludeDocuments(e.target.checked)} className="rounded" />
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    {t('وثائقي', 'My Documents')}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={includeLegalSources} onChange={e => setIncludeLegalSources(e.target.checked)} className="rounded" />
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    {t('المصادر القانونية', 'Legal Sources')}
                  </label>
                  <select
                    className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={jurisdiction}
                    onChange={e => setJurisdiction(e.target.value)}
                  >
                    {JURISDICTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{t(o.labelAr, o.labelEn)}</option>
                    ))}
                  </select>

                  {/* Date range — wraps on mobile */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">{t('من سنة', 'From year')}</label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      placeholder={t('مثلاً 2010', 'e.g. 2010')}
                      value={yearFrom}
                      onChange={e => setYearFrom(e.target.value)}
                      className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <label className="text-xs text-muted-foreground shrink-0">{t('إلى', 'to')}</label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      placeholder={t('مثلاً 2024', 'e.g. 2024')}
                      value={yearTo}
                      onChange={e => setYearTo(e.target.value)}
                      className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </form>

        {/* Error */}
        {error && <ErrorMessage message={error} />}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {/* AI Summary */}
            <Card className="bg-primary/5 border-primary/15">
              <CardContent className="p-5">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-gold shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">{t('ملخص الذكاء الاصطناعي', 'AI Summary')}</p>
                    <p className="text-sm text-foreground leading-relaxed">{results.summary}</p>
                    {results._meta && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {results._meta.provider} · {results._meta.model}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Result items */}
            {results.results.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {t(`${results.results.length} مصادر ذات صلة`, `${results.results.length} relevant sources`)}
                </h3>
                {results.results.map((r, i) => (
                  <Card key={i} className="border-border hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                          {Math.round((r.relevanceScore ?? 0) * 100)}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {r.meta?.type === 'document'
                              ? <FileText className="w-3.5 h-3.5 text-primary" aria-hidden />
                              : <BookOpen className="w-3.5 h-3.5 text-amber-600" aria-hidden />}
                            <span className="text-sm font-semibold truncate">
                              {r.meta?.title ?? r.ref}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                              r.meta?.type === 'document'
                                ? 'bg-primary/5 text-primary border-primary/20'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {t(
                                r.meta?.type === 'document' ? 'وثيقة' : 'مصدر قانوني',
                                r.meta?.type === 'document' ? 'Document' : 'Legal Source',
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{r.excerpt}</p>
                          {r.reason && (
                            <p className="text-xs text-muted-foreground/70 mt-1 italic">{r.reason}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!results && !loading && !error && (
          <div className="flex flex-col items-center gap-3 text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Search className="w-6 h-6 text-muted-foreground/40" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('ابحث في وثائقك والمصادر القانونية باستخدام الذكاء الاصطناعي.', 'Search your documents and legal sources using AI.')}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
