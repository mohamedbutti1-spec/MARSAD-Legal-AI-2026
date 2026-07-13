/**
 * NAIP Global Search — البحث الوطني الموحد
 * ──────────────────────────────────────────
 * Unified search across all NAIP platform domains.
 * Phase 43 · نظرية الشامسي™ · MARSAD NAIP v1.0
 */
import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Scale, Shield, ShieldAlert, RefreshCw, Search, Loader2,
  ChevronRight, ArrowUpRight, AlertCircle,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchDomain = 'all' | 'decisions' | 'risk' | 'constitutional' | 'replay';

interface SearchResult {
  id: number | string;
  type: 'decision' | 'risk' | 'constitutional' | 'replay';
  title: string;
  caseNumber?: string;
  subtitle?: string;
  href?: string;
  riskLevel?: string;
  org?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  domain: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHeaders(role: string, userId: number, org: string) {
  return {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-id': String(userId),
    'x-user-org': org,
  };
}

function typeConfig(type: SearchResult['type']) {
  switch (type) {
    case 'decision':
      return {
        icon: <Scale className="w-4 h-4" />,
        badge: 'قرار',
        badgeEn: 'Decision',
        bg: 'bg-blue-100 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800/40',
        iconBg: 'bg-blue-100 dark:bg-blue-950/40',
        iconColor: 'text-blue-600 dark:text-blue-400',
      };
    case 'risk':
      return {
        icon: <ShieldAlert className="w-4 h-4" />,
        badge: 'مخاطر',
        badgeEn: 'Risk',
        bg: 'bg-gold/15 dark:bg-gold/40',
        text: 'text-gold dark:text-gold/80',
        border: 'border-gold/25 dark:border-gold/40',
        iconBg: 'bg-gold/15 dark:bg-gold/40',
        iconColor: 'text-gold dark:text-gold/80',
      };
    case 'constitutional':
      return {
        icon: <Shield className="w-4 h-4" />,
        badge: 'دستوري',
        badgeEn: 'Constitutional',
        bg: 'bg-purple-100 dark:bg-purple-950/40',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800/40',
        iconBg: 'bg-purple-100 dark:bg-purple-950/40',
        iconColor: 'text-purple-600 dark:text-purple-400',
      };
    case 'replay':
      return {
        icon: <RefreshCw className="w-4 h-4" />,
        badge: 'إعادة تشغيل',
        badgeEn: 'Replay',
        bg: 'bg-slate-100 dark:bg-slate-800/40',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-700',
        iconBg: 'bg-slate-100 dark:bg-slate-800/40',
        iconColor: 'text-slate-600 dark:text-slate-400',
      };
  }
}

// ─── Domain Pill ──────────────────────────────────────────────────────────────

function DomainPill({
  label, labelEn, value, active, onClick,
}: {
  label: string; labelEn: string; value: SearchDomain; active: boolean; onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-card text-muted-foreground border-border hover:border-border/60 hover:text-foreground'
      }`}
    >
      {t(label, labelEn)}
    </button>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  const t = useT();
  const conf = typeConfig(result.type);

  const inner = (
    <div className={`bg-card border rounded-xl p-4 hover:border-gold/40 hover:bg-gold/5 transition-all cursor-pointer group ${conf.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${conf.iconBg} ${conf.iconColor}`}>
          {conf.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${conf.bg} ${conf.text} ${conf.border}`}>
              {t(conf.badge, conf.badgeEn)}
            </span>
            {result.caseNumber && (
              <span className="text-[10px] font-mono text-muted-foreground">{result.caseNumber}</span>
            )}
          </div>
          <div className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-gold transition-colors">
            {result.title}
          </div>
          {result.subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{result.subtitle}</div>
          )}
        </div>
        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors shrink-0 mt-0.5" />
      </div>
    </div>
  );

  if (result.href) {
    return <Link href={result.href}>{inner}</Link>;
  }
  return inner;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ searched }: { searched: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
      <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
        <Search className="w-7 h-7 opacity-40" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          {searched
            ? t('لا توجد نتائج مطابقة لبحثك', 'No results match your search')
            : t('ابدأ بكتابة ما تبحث عنه', 'Start typing to search across all modules')
          }
        </p>
        <p className="text-xs mt-1 opacity-60">
          {searched
            ? t('حاول استخدام كلمات بحث مختلفة', 'Try different search terms')
            : t('يمكنك البحث في القرارات والمخاطر والتقييمات الدستورية', 'Search decisions, risks, and constitutional assessments')
          }
        </p>
      </div>
    </div>
  );
}

// ─── Main Search Page ─────────────────────────────────────────────────────────

export default function NaipSearch() {
  const {
    role, userId, userOrg,
    canViewNaipSearch,
    canViewGovernanceDashboard,
  } = useUserContext() as any;
  const t = useT();
  const headers = getHeaders(role, userId, userOrg);

  const hasAccess = (canViewNaipSearch ?? false) || canViewGovernanceDashboard;

  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<SearchDomain>('all');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const canSearch = submittedQuery.trim().length >= 2;

  const { data, isLoading, isError } = useQuery<SearchResponse>({
    queryKey: ['naip-search', submittedQuery, domain],
    queryFn: async () => {
      const params = new URLSearchParams({ q: submittedQuery, domain });
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/global-search?${params}`, { headers });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: canSearch,
    staleTime: 60_000,
  });

  const handleSearch = useCallback(() => {
    const q = query.trim();
    if (q.length >= 2) setSubmittedQuery(q);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const domains: { key: SearchDomain; label: string; labelEn: string }[] = [
    { key: 'all',            label: 'الكل',             labelEn: 'All' },
    { key: 'decisions',      label: 'القرارات',          labelEn: 'Decisions' },
    { key: 'risk',           label: 'المخاطر',           labelEn: 'Risk' },
    { key: 'constitutional', label: 'الدستوري',          labelEn: 'Constitutional' },
    { key: 'replay',         label: 'إعادة التشغيل',     labelEn: 'Replay' },
  ];

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-muted-foreground">
          <Shield className="w-14 h-14 opacity-20" />
          <p className="text-sm font-medium">{t('غير مصرح بالوصول', 'Access not authorised')}</p>
        </div>
      </AppLayout>
    );
  }

  const results = data?.results ?? [];
  const totalCount = data?.total ?? 0;
  const hasSearched = submittedQuery.trim().length >= 2;

  // Group results by type
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const typeOrder: SearchResult['type'][] = ['decision', 'risk', 'constitutional', 'replay'];
  const groupLabels: Record<string, { ar: string; en: string }> = {
    decision:       { ar: 'القرارات الإدارية',      en: 'Administrative Decisions' },
    risk:           { ar: 'تقييمات المخاطر',         en: 'Risk Assessments' },
    constitutional: { ar: 'التقييمات الدستورية',     en: 'Constitutional Assessments' },
    replay:         { ar: 'سجلات إعادة التشغيل',     en: 'Replay Records' },
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Link href="/naip"><span className="hover:text-foreground cursor-pointer transition-colors">NAIP</span></Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{t('البحث الوطني', 'Global Search')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center">
              <Search className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {t('البحث الوطني الموحد', 'Unified National Search')}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('بحث شامل عبر جميع وحدات NAIP', 'Comprehensive search across all NAIP modules')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Domain Filters ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {domains.map((d) => (
            <DomainPill
              key={d.key}
              label={d.label}
              labelEn={d.labelEn}
              value={d.key}
              active={domain === d.key}
              onClick={() => setDomain(d.key)}
            />
          ))}
        </div>

        {/* ── Search Bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('ابحث في جميع وحدات NAIP…', 'Search all NAIP modules…')}
              className="w-full bg-card border border-border rounded-xl ps-12 pe-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/40 transition-all"
              autoFocus
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={query.trim().length < 2}
            className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3.5 rounded-xl text-sm font-medium transition-all shrink-0"
          >
            {t('بحث', 'Search')}
          </button>
        </div>

        {/* Minimum characters hint */}
        {query.length > 0 && query.length < 2 && (
          <p className="text-xs text-muted-foreground -mt-4">
            {t('أدخل حرفين على الأقل للبدء', 'Enter at least 2 characters to search')}
          </p>
        )}

        {/* ── Results ─────────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">{t('جارٍ البحث…', 'Searching…')}</span>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{t('حدث خطأ أثناء البحث، يرجى المحاولة مجدداً', 'An error occurred during search, please try again')}</span>
          </div>
        )}

        {!isLoading && !isError && hasSearched && (
          <>
            {/* Total count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground tabular-nums">{totalCount}</span>
                {' '}{t('نتيجة', totalCount === 1 ? 'result' : 'results')}
                {submittedQuery && (
                  <span> {t('لـ', 'for')} "<span className="text-foreground font-medium">{submittedQuery}</span>"</span>
                )}
              </p>
            </div>

            {results.length === 0 ? (
              <EmptyState searched />
            ) : (
              <div className="space-y-8">
                {typeOrder.map((type) => {
                  const group = grouped[type];
                  if (!group || group.length === 0) return null;
                  const conf = typeConfig(type);
                  const glabel = groupLabels[type];
                  return (
                    <div key={type} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${conf.iconBg} ${conf.iconColor}`}>
                          {conf.icon}
                        </div>
                        <h2 className="text-sm font-bold text-foreground">
                          {t(glabel.ar, glabel.en)}
                        </h2>
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold">
                          {group.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.map((result, i) => (
                          <ResultCard key={`${result.type}-${result.id}-${i}`} result={result} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!hasSearched && !isLoading && <EmptyState searched={false} />}

      </div>
    </AppLayout>
  );
}
