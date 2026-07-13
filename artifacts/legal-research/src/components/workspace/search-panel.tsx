import React, { useState, useCallback } from 'react';
import { Search, Loader2, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';

interface SearchResult {
  id: number;
  project_id: number;
  folder_id: number | null;
  item_type: string;
  title: string;
  content: Record<string, unknown>;
  created_at: string;
  rank: number;
}

interface SearchPanelProps {
  projectId?: number;
  onResultClick?: (result: SearchResult) => void;
  placeholder?: string;
}

const TYPE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  question:       { ar: 'سؤال',          en: 'Question',        color: 'bg-purple-100 text-purple-800' },
  answer:         { ar: 'جواب',          en: 'Answer',          color: 'bg-blue-100 text-blue-800' },
  authority:      { ar: 'سلطة قانونية', en: 'Authority',       color: 'bg-heading/15 text-heading/75' },
  document:       { ar: 'وثيقة',         en: 'Document',        color: 'bg-gold/15 text-gold/75' },
  note:           { ar: 'ملاحظة',        en: 'Note',            color: 'bg-gray-100 text-gray-800' },
  highlight:      { ar: 'تظليل',         en: 'Highlight',       color: 'bg-gold/15 text-gold/75' },
  bookmark:       { ar: 'إشارة مرجعية', en: 'Bookmark',        color: 'bg-red-100 text-red-800' },
  timeline_entry: { ar: 'إدخال زمني',   en: 'Timeline Entry',  color: 'bg-indigo-100 text-indigo-800' },
};

export function SearchPanel({ projectId, onResultClick, placeholder }: SearchPanelProps) {
  const t = useT();
  const [q, setQ]             = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);


  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query });
      if (projectId) params.set('projectId', String(projectId));
      const r = await apiFetch(`/api/research/workspace/search?${params.toString()}`);
      if (r.ok) {
        const data = await r.json() as { results: SearchResult[]; total: number };
        setResults(data.results ?? []);
      }
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [projectId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') runSearch(q);
  }

  function handleClick(result: SearchResult) {
    if (onResultClick) {
      onResultClick(result);
    } else {
      window.location.href = `/workspace/${result.project_id}/items/${result.id}`;
    }
  }

  const typeInfo = (type: string) => TYPE_LABELS[type] ?? { ar: type, en: type, color: 'bg-gray-100 text-gray-700' };

  return (
    <div className="w-full">
      <div className="relative">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('ابحث في مساحة البحث…', 'Search workspace…')}
          className="pe-10"
          dir="auto"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">
          {t('لا توجد نتائج', 'No results found')}
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-2 space-y-1.5 max-h-80 overflow-y-auto">
          {results.map((result) => {
            const info = typeInfo(result.item_type);
            const snippet = (result.content?.text as string | undefined) ?? '';
            return (
              <li key={result.id}>
                <button
                  onClick={() => handleClick(result)}
                  className="w-full text-start rounded-md border border-transparent hover:border-blue-200 hover:bg-blue-50 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900 truncate">{result.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${info.color}`}>
                      {t(info.ar, info.en)}
                    </span>
                  </div>
                  {snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2 ms-5">{snippet}</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
