/**
 * KB Search — UAE Legal Knowledge Base Search
 * Phase 59 · Cross-Reference Graph Traversal
 *
 * Full-text and semantic search across 17 indexed KB collections.
 * Each result card has a collapsible "Legal Context" panel showing
 * the one-hop cross-reference graph for that document.
 */
import React, { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Search, Loader2, BookOpen, Scale, ChevronDown, ChevronRight,
  ArrowRight, ArrowLeft, AlertCircle, Link2, GitBranch,
  FileText, Shield, Star,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrossRefNeighbour {
  neighbourDocumentId: number;
  titleAr: string;
  titleEn: string;
  hierarchyLevel: string;
  bindingStatus: string;
  jurisdiction: string;
  documentNumber: string | null;
  year: number | null;
  isRepealed: boolean;
  referenceType: string;
  direction: 'outbound' | 'inbound';
  description: string | null;
}

interface AmendingInstrument {
  amendingDocId: number;
  titleAr: string;
  documentNumber: string | null;
  year: number | null;
}

interface KbHit {
  documentId: number;
  titleAr: string;
  titleEn: string;
  authorityAr: string;
  hierarchyLevel: string;
  bindingStatus: string;
  jurisdiction: string;
  documentNumber?: string;
  year?: number;
  isRepealed: boolean;
  isAmended: boolean;
  snippet: string;
  combinedScore: number;
  crossRefs: CrossRefNeighbour[];
  amendments: AmendingInstrument[];
  ragTag: string;
}

interface SearchResponse {
  hits: KbHit[];
  totalCandidates: number;
  strategy: 'semantic' | 'keyword' | 'hybrid';
  durationMs: number;
  query: string;
}

interface ContextChainResponse {
  document: { id: number; titleAr: string; hierarchyLevel: string; bindingStatus: string };
  contextChain: {
    neighbours: CrossRefNeighbour[];
    byRelationshipType: Record<string, CrossRefNeighbour[]>;
    amendments: AmendingInstrument[];
    totalNeighbours: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REL_LABELS: Record<string, { label: string; color: string }> = {
  implements:     { label: 'Implements →',    color: 'text-blue-600 bg-blue-50' },
  amends:         { label: 'Amends →',        color: 'text-orange-600 bg-orange-50' },
  repeals:        { label: 'Repeals',          color: 'text-red-600 bg-red-50' },
  cites:          { label: 'Cited in',         color: 'text-purple-600 bg-purple-50' },
  interpreted_by: { label: 'Interpreted by',  color: 'text-teal-600 bg-teal-50' },
  supplements:    { label: 'Supplements',      color: 'text-green-600 bg-green-50' },
  related:        { label: 'Related',          color: 'text-gray-600 bg-gray-100' },
  appealed_from:  { label: 'Appealed from',   color: 'text-yellow-600 bg-yellow-50' },
};

const BINDING_BADGE: Record<string, string> = {
  constitutional: 'bg-amber-100 text-amber-800 border border-amber-300',
  binding:        'bg-green-100 text-green-800 border border-green-300',
  persuasive:     'bg-blue-100 text-blue-800 border border-blue-300',
  advisory:       'bg-slate-100 text-slate-700 border border-slate-300',
  informational:  'bg-slate-100 text-slate-700 border border-slate-300',
};

const LEVEL_LABEL: Record<string, string> = {
  '1':  'Constitutional',
  '2':  'Federal Law',
  '3':  'Decree-Law',
  '4':  'Executive Regulation',
  '5':  'Cabinet Decision',
  '6':  'Ministerial Decision',
  '7a': 'Supreme Court',
  '7b': 'Federal Court',
  '7c': 'Local Court',
  '8':  'Guidance',
};

// ─── Legal Context Panel ──────────────────────────────────────────────────────

function LegalContextPanel({ documentId }: { documentId: number }) {
  const { data, isLoading, error } = useQuery<ContextChainResponse>({
    queryKey: ['kb-context-chain', documentId],
    queryFn: async () => {
      const res = await apiFetch(`/api/kb/document/${documentId}/context-chain`);
      if (!res.ok) throw new Error('Failed to fetch context chain');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading legal context…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-destructive">
        <AlertCircle className="w-3.5 h-3.5" />
        Failed to load context chain.
      </div>
    );
  }

  const { contextChain } = data;

  if (contextChain.totalNeighbours === 0 && contextChain.amendments.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground italic">
        No cross-references found for this document.
      </p>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Amendment chain */}
      {contextChain.amendments.length > 0 && (
        <div className="rounded border border-orange-200 bg-orange-50 p-2">
          <p className="text-xs font-semibold text-orange-700 mb-1.5">⚠ Amendment History</p>
          <ul className="space-y-1">
            {contextChain.amendments.map((a) => (
              <li key={a.amendingDocId} className="text-xs text-orange-800">
                <span className="font-medium">{a.titleAr}</span>
                {a.documentNumber && <span className="text-orange-600"> (رقم {a.documentNumber})</span>}
                {a.year && <span className="text-orange-500">، {a.year}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cross-reference neighbours grouped by type */}
      {Object.entries(contextChain.byRelationshipType).map(([relType, neighbours]) => {
        const meta = REL_LABELS[relType] ?? { label: relType, color: 'text-gray-600 bg-gray-100' };
        return (
          <div key={relType}>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 ${meta.color}`}>
              {neighbours[0]?.direction === 'outbound' ? (
                <ArrowRight className="w-3 h-3" />
              ) : (
                <ArrowLeft className="w-3 h-3" />
              )}
              {meta.label}
            </span>
            <ul className="space-y-1 pl-2">
              {neighbours.map((n) => (
                <li key={`${n.neighbourDocumentId}-${n.referenceType}`} className="text-xs">
                  <div className="flex items-start gap-1.5">
                    <FileText className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{n.titleAr}</span>
                      {n.documentNumber && (
                        <span className="text-muted-foreground"> (رقم {n.documentNumber})</span>
                      )}
                      {n.year && <span className="text-muted-foreground">، {n.year}</span>}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-muted-foreground">
                          {LEVEL_LABEL[n.hierarchyLevel] ?? `Level ${n.hierarchyLevel}`}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${BINDING_BADGE[n.bindingStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                          {n.bindingStatus}
                        </span>
                        {n.isRepealed && (
                          <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                            Repealed
                          </span>
                        )}
                      </div>
                      {n.description && (
                        <p className="text-muted-foreground mt-0.5 italic">{n.description}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Search Result Card ───────────────────────────────────────────────────────

function ResultCard({ hit }: { hit: KbHit }) {
  const [contextOpen, setContextOpen] = useState(false);
  const hasContext = hit.crossRefs.length > 0 || hit.amendments.length > 0;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BINDING_BADGE[hit.bindingStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                {hit.bindingStatus === 'constitutional' && <Star className="w-3 h-3 inline mr-0.5" />}
                {hit.bindingStatus}
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {LEVEL_LABEL[hit.hierarchyLevel] ?? `Level ${hit.hierarchyLevel}`}
              </span>
              {hit.isRepealed && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
                  Repealed
                </span>
              )}
              {hit.isAmended && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 border border-orange-200">
                  Amended
                </span>
              )}
            </div>
            <h3 className="font-semibold text-base leading-snug mb-0.5" dir="rtl">
              {hit.titleAr}
            </h3>
            {hit.titleEn && (
              <p className="text-sm text-muted-foreground">{hit.titleEn}</p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {hit.documentNumber && <span>رقم {hit.documentNumber}</span>}
              {hit.year && <span>{hit.year}</span>}
              <span>{hit.jurisdiction}</span>
              {hit.authorityAr && <span>· {hit.authorityAr}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-muted-foreground">
              {(hit.combinedScore * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Snippet */}
        {hit.snippet && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed" dir="rtl">
            {hit.snippet}
          </p>
        )}

        {/* Amendment inline note */}
        {hit.amendments.length > 0 && (
          <div className="mt-2 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1 border border-orange-200">
            <span className="font-medium">النص الحالي المعدَّل بواسطة: </span>
            {hit.amendments.map((a, i) => (
              <span key={a.amendingDocId}>
                {i > 0 && '؛ '}
                {a.titleAr}
                {a.documentNumber && ` (رقم ${a.documentNumber})`}
                {a.year && `، ${a.year}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Legal Context toggle */}
      <button
        className="w-full flex items-center justify-between px-4 py-2 border-t bg-muted/40 hover:bg-muted/70 transition-colors text-xs font-medium text-foreground"
        onClick={() => setContextOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5" />
          Legal Context
          {hasContext && (
            <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
              {hit.crossRefs.length + hit.amendments.length}
            </span>
          )}
        </span>
        {contextOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {contextOpen && (
        <div className="border-t bg-muted/20">
          <LegalContextPanel documentId={hit.documentId} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KbSearch() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(() => {
    const q = query.trim();
    if (q) setSubmittedQuery(q);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const { data, isFetching, error } = useQuery<SearchResponse>({
    queryKey: ['kb-search', submittedQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ q: submittedQuery, topK: '10' });
      const res = await apiFetch(`/api/kb/search?${params}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!submittedQuery,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            UAE Legal Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            قاعدة المعرفة القانونية — Search across legislation, case law, and regulatory instruments
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search laws, decrees, judgments… (Arabic or English)"
              className="w-full pl-9 pr-4 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              dir="auto"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isFetching}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        {/* Results */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Search failed. Please try again.
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {data.hits.length} result{data.hits.length !== 1 ? 's' : ''} from {data.totalCandidates} candidates
                · {data.strategy} search · {data.durationMs}ms
              </span>
              {data.hits.some((h) => h.crossRefs.length > 0 || h.amendments.length > 0) && (
                <span className="flex items-center gap-1 text-primary">
                  <Link2 className="w-3 h-3" />
                  Cross-references available
                </span>
              )}
            </div>

            {data.hits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No results found</p>
                <p className="text-sm mt-1">Try different keywords or broaden your search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.hits.map((hit) => (
                  <ResultCard key={hit.documentId} hit={hit} />
                ))}
              </div>
            )}
          </>
        )}

        {!submittedQuery && (
          <div className="text-center py-16 text-muted-foreground">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-base">Search the UAE Legal Knowledge Base</p>
            <p className="text-sm mt-2 max-w-sm mx-auto">
              Each result shows its cross-reference graph — implementing regulations,
              amending instruments, and interpreting judgments.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
