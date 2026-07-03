import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { useLocation } from 'wouter';
import { Search, Filter, BookOpen, Bookmark, BookmarkCheck, Loader2, ChevronRight, ChevronLeft, Sparkles, Scale, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { LoadingGrid } from '@/components/ui/loading-card';

interface LegalSource {
  id: number;
  jurisdiction: string;
  docType: string;
  title: string;
  titleAr?: string | null;
  referenceNumber?: string | null;
  year?: number | null;
  subject?: string | null;
  subjectAr?: string | null;
  content: string;
  summary?: string | null;
  summaryAr?: string | null;
  language?: string | null;
  courtLevel?: string | null;
}

interface Props {
  jurisdiction: string;
  pageTitle: string;
  pageTitleAr: string;
  pageSubtitleAr: string;
  pageSubtitleEn: string;
  icon: React.ReactNode;
  docTypeOptions: Array<{ value: string; labelAr: string; labelEn: string }>;
  yearMin?: number;
  yearMax?: number;
}

const DOC_TYPE_COLORS: Record<string, string> = {
  law:        'bg-blue-50 text-blue-700 border-blue-200',
  decree:     'bg-amber-50 text-amber-700 border-amber-200',
  regulation: 'bg-purple-50 text-purple-700 border-purple-200',
  code:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  directive:  'bg-rose-50 text-rose-700 border-rose-200',
  judgment:   'bg-orange-50 text-orange-700 border-orange-200',
};

export function LegalSourcesBrowser({
  jurisdiction, pageTitle, pageTitleAr, pageSubtitleAr, pageSubtitleEn, icon, docTypeOptions, yearMin = 1971, yearMax = new Date().getFullYear(),
}: Props) {
  const t = useT();
  const { canUseAi, canManageSettings } = useUserContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Filters
  const [query, setQuery] = useState('');
  const [docType, setDocType] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  // Data
  const [sources, setSources] = useState<LegalSource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<LegalSource | null>(null);
  const [summarising, setSummarising] = useState(false);

  // Library state
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ jurisdiction, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (query)   params.set('q', query);
      if (docType) params.set('docType', docType);
      if (year)    params.set('year', year);
      const r = await apiFetch(`/api/legal-sources?${params}`);
      if (r.ok) {
        const data = await r.json();
        setSources(data.sources ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [jurisdiction, query, docType, year, page]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [query, docType, year]);

  async function handleSummarise(src: LegalSource) {
    setSummarising(true);
    try {
      const lang = t('ar', 'en');
      const r = await apiFetch(`/api/legal-sources/${src.id}/summarise?lang=${lang}`, { method: 'POST' });
      if (r.ok) {
        const data = await r.json();
        setSelected((prev) => prev ? {
          ...prev,
          summaryAr: lang === 'ar' ? data.summary : prev.summaryAr,
          summary: lang === 'en' ? data.summary : prev.summary,
        } : null);
        toast({ title: t('تم التلخيص', 'Summary generated') });
      }
    } finally {
      setSummarising(false);
    }
  }

  async function handleSaveToLibrary(src: LegalSource) {
    if (savedIds.has(src.id)) return;
    const r = await apiFetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceType: 'legal_source', legalSourceId: src.id }),
    });
    if (r.ok) {
      setSavedIds((prev) => new Set([...prev, src.id]));
      toast({ title: t('تمت الإضافة إلى المكتبة', 'Saved to library') });
    }
  }

  const displaySummary = selected
    ? (t('ar', 'en') === 'ar' ? selected.summaryAr ?? selected.summary : selected.summary ?? selected.summaryAr)
    : null;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t(pageTitleAr, pageTitle)}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t(pageSubtitleAr, pageSubtitleEn)}</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-52">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
                <input
                  type="text"
                  className="w-full border border-border rounded-lg ps-9 pe-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={t('ابحث في العنوان أو الموضوع...', 'Search title or subject...')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Doc Type */}
              {docTypeOptions.length > 0 && (
                <select
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  <option value="">{t('جميع الأنواع', 'All types')}</option>
                  {docTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.labelAr, o.labelEn)}</option>
                  ))}
                </select>
              )}

              {/* Year */}
              <select
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                <option value="">{t('جميع السنوات', 'All years')}</option>
                {Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMax - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {(query || docType || year) && (
                <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setDocType(''); setYear(''); }}>
                  {t('مسح', 'Clear')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results + Viewer */}
        <div className="flex gap-4">
          {/* Results list */}
          <div className={`flex-1 space-y-2 ${selected ? 'lg:max-w-sm' : ''}`}>
            {loading ? (
              <LoadingGrid count={4} />
            ) : sources.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t('لا توجد نتائج مطابقة للفلاتر المحددة', 'No results match the selected filters')}
                </p>
              </div>
            ) : (
              sources.map((src) => {
                const docTypeColor = DOC_TYPE_COLORS[src.docType] ?? 'bg-muted text-muted-foreground border-border';
                const isSelected = selected?.id === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : src)}
                    className={`w-full text-start p-4 rounded-xl border transition-all hover:shadow-sm ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:bg-muted/20'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${docTypeColor}`}>
                            {t(
                              docTypeOptions.find(o => o.value === src.docType)?.labelAr ?? src.docType,
                              docTypeOptions.find(o => o.value === src.docType)?.labelEn ?? src.docType,
                            )}
                          </span>
                          {src.year && <span className="text-xs text-muted-foreground">{src.year}</span>}
                          {src.referenceNumber && (
                            <span className="text-xs text-muted-foreground font-mono">{src.referenceNumber}</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {t(src.titleAr ?? src.title, src.title)}
                        </p>
                        {(src.subjectAr ?? src.subject) && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {t(src.subjectAr ?? src.subject!, src.subject ?? src.subjectAr!)}
                          </p>
                        )}
                        {src.courtLevel && (
                          <p className="text-xs text-muted-foreground mt-0.5">{src.courtLevel}</p>
                        )}
                      </div>
                      <ChevronLeft className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isSelected ? 'rotate-180' : ''}`} aria-hidden />
                    </div>
                  </button>
                );
              })
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  {t('السابق', 'Previous')}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t(`${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} من ${total}`, `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`)}
                </span>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>
                  {t('التالي', 'Next')}
                </Button>
              </div>
            )}
          </div>

          {/* Viewer panel */}
          {selected && (
            <Card className="flex-1 border-border sticky top-4 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-border/50">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    {t(selected.titleAr ?? selected.title, selected.title)}
                  </CardTitle>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => setSelected(null)}
                    aria-label={t('إغلاق', 'Close')}
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {selected.year && <span className="text-xs text-muted-foreground">{selected.year}</span>}
                  {selected.referenceNumber && <span className="text-xs font-mono text-muted-foreground">{selected.referenceNumber}</span>}
                </div>
                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => handleSaveToLibrary(selected)}
                    disabled={savedIds.has(selected.id)}
                  >
                    {savedIds.has(selected.id)
                      ? <><BookmarkCheck className="w-3.5 h-3.5" />{t('محفوظ', 'Saved')}</>
                      : <><Bookmark className="w-3.5 h-3.5" />{t('حفظ', 'Save')}</>}
                  </Button>
                  {canUseAi && !displaySummary && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleSummarise(selected)}
                      disabled={summarising}
                    >
                      {summarising
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('جارٍ التلخيص...', 'Summarising...')}</>
                        : <><Sparkles className="w-3.5 h-3.5 text-gold" />{t('تلخيص ذكي', 'AI Summary')}</>}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-4 space-y-4">
                {/* AI Summary */}
                {displaySummary && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-gold" aria-hidden />
                      <span className="text-xs font-semibold text-primary">{t('ملخص ذكي', 'AI Summary')}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{displaySummary}</p>
                  </div>
                )}
                {/* Content */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {t('النص الكامل', 'Full Text')}
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.content || t('(لا يوجد نص)', '(No text available)')}</p>
                </div>
                {canUseAi && (
                  <Button size="sm" className="w-full gap-1.5" onClick={() => navigate('/research')}>
                    <Scale className="w-3.5 h-3.5" />
                    {t('بحث مرتبط', 'Related Research')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
