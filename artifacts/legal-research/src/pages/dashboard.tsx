import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetDocumentStats, useListDocuments } from '@workspace/api-client-react';
import { apiFetch } from '@/lib/api-fetch';
import {
  Library, FileText, UploadCloud, BrainCircuit, Search,
  ArrowUpRight, Scale, ScrollText, Gavel, Bot,
  GitCompareArrows, Quote, Globe, Landmark,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserContext, useT } from '@/lib/user-context';
import { useLocation } from 'wouter';
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { LoadingGrid } from '@/components/ui/loading-card';
import { ErrorMessage } from '@/components/ui/error-boundary';
import { StatusBadge } from '@/components/ui/status-badge';

interface AuditEntry {
  id: number;
  action: string;
  entityType: string | null;
  userRole: string | null;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { labelAr: string; labelEn: string; colorClass: string }> = {
  'document.upload':       { labelAr: 'رفع وثيقة',       labelEn: 'Document upload',   colorClass: 'text-emerald-600' },
  'document.delete':       { labelAr: 'حذف وثيقة',       labelEn: 'Document deleted',  colorClass: 'text-red-500' },
  'ai.search':             { labelAr: 'بحث ذكي',          labelEn: 'AI search',         colorClass: 'text-primary' },
  'ai.literature-review':  { labelAr: 'مراجعة أدبية',     labelEn: 'Literature review', colorClass: 'text-primary' },
  'ai.uae-france-compare': { labelAr: 'مقارنة قانونية',   labelEn: 'Law comparison',    colorClass: 'text-amber-600' },
  'settings.update':       { labelAr: 'تحديث الإعدادات',  labelEn: 'Settings updated',  colorClass: 'text-muted-foreground' },
};

/* Chart colours drawn from CSS vars so they respect the theme */
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--gold))',
  'hsl(197 55% 35%)',
  'hsl(142 45% 40%)',
];

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetDocumentStats();
  const { data: documents } = useListDocuments();
  const { canUseAi, canManageUsers, canViewAudit, role } = useUserContext();
  const t = useT();
  const [, navigate] = useLocation();
  const [quickQuery, setQuickQuery] = useState('');
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);
  const [dashStats, setDashStats] = useState<{ legalSourcesCount: number; aiQueriesThisMonth: number; activeUsers: number; totalUsers: number } | null>(null);

  useEffect(() => {
    if (!canViewAudit) return;
    apiFetch('/api/audit?limit=8')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.logs) setRecentActivity(data.logs); })
      .catch(() => {});
  }, [canViewAudit]);

  useEffect(() => {
    apiFetch('/api/dashboard/stats')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setDashStats(data); })
      .catch(() => {});
  }, []);

  const uploadTrendData = React.useMemo(() => {
    const s = stats as (typeof stats & { uploadsByDay?: Record<string, number> }) | undefined;
    if (!s?.uploadsByDay) return [];
    return Object.entries(s.uploadsByDay as Record<string, number>)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('ar-AE', { weekday: 'short' }),
        count,
      }));
  }, [stats]);

  const fileTypeData = React.useMemo(() => {
    if (!stats?.byType?.length) return [];
    return stats.byType.map((ft: { type: string; count: number }) => ({
      name: ft.type.toUpperCase(),
      value: ft.count,
    }));
  }, [stats]);

  // Quick links filtered by permission
  const quickLinks = [
    { href: '/research',        icon: Search,           labelAr: 'بحث قانوني',          labelEn: 'Legal Research',    show: canUseAi,      className: 'bg-primary/8 text-primary border-primary/15 hover:bg-primary/12' },
    { href: '/assistant',       icon: Bot,              labelAr: 'المساعد الذكي',        labelEn: 'AI Assistant',      show: canUseAi,      className: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
    { href: '/legislation/uae', icon: ScrollText,       labelAr: 'التشريعات الإماراتية', labelEn: 'UAE Legislation',   show: true,          className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
    { href: '/caselaw/uae',     icon: Gavel,            labelAr: 'الاجتهاد القضائي',    labelEn: 'UAE Case Law',      show: true,          className: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
    { href: '/law/france',      icon: Landmark,         labelAr: 'القانون الفرنسي',      labelEn: 'French Law',        show: true,          className: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' },
    { href: '/law/eu',          icon: Globe,            labelAr: 'القانون الأوروبي',     labelEn: 'EU Law',            show: true,          className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
    { href: '/citations',       icon: Quote,            labelAr: 'مولّد الاستشهادات',    labelEn: 'Citation Generator', show: true,         className: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
    { href: '/comparison',      icon: GitCompareArrows, labelAr: 'مقارنة الوثائق',       labelEn: 'Comparison',        show: true,          className: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  ].filter((l) => l.show);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ─── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('لوحة القيادة', 'Dashboard')}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t('مرحباً بك في مرصد — منصة البحث القانوني المتكاملة', 'Welcome to Marsad — Integrated Legal Research Platform')}
            </p>
          </div>
          {canUseAi && (
            <Button
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => navigate('/assistant')}
            >
              <Bot className="w-4 h-4" />
              {t('المساعد الذكي', 'AI Assistant')}
            </Button>
          )}
        </div>

        {/* ─── KPI Cards ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <LoadingGrid count={4} />
        ) : error ? (
          <ErrorMessage message={t('تعذّر تحميل الإحصائيات', 'Failed to load statistics')} />
        ) : stats ? (
          <>
            {/* Row 1 — Document KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                type="button"
                className="text-start moj-card p-5 hover:shadow-md transition-all hover:-translate-y-0.5 group cursor-pointer"
                onClick={() => navigate('/library')}
              >
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('إجمالي الوثائق', 'Total Documents')}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
                    <Library className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mt-1">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {t('وثيقة في المكتبة', 'documents in library')}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </button>

              {/* Legal sources indexed */}
              <button
                type="button"
                className="text-start moj-card p-5 hover:shadow-md transition-all hover:-translate-y-0.5 group cursor-pointer"
                onClick={() => navigate('/legislation/uae')}
              >
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('المصادر القانونية', 'Legal Sources')}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Scale className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {dashStats?.legalSourcesCount ?? <span className="text-muted-foreground text-base">—</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {t('مصدر مفهرس', 'indexed sources')}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </button>

              {/* AI queries this month */}
              <div className="moj-card p-5">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('استعلامات الذكاء الاصطناعي', 'AI Queries')}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <BrainCircuit className="w-4 h-4 text-violet-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {dashStats?.aiQueriesThisMonth ?? <span className="text-muted-foreground text-base">—</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('هذا الشهر', 'this month')}</p>
              </div>

              {/* Active users */}
              <div className="moj-card p-5">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('المستخدمون النشطون', 'Active Users')}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {dashStats?.activeUsers ?? <span className="text-muted-foreground text-base">—</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashStats
                    ? t(`من أصل ${dashStats.totalUsers}`, `of ${dashStats.totalUsers} total`)
                    : t('جارٍ التحميل…', 'loading…')}
                </p>
              </div>
            </div>

            {/* Row 2 — Storage + Recent uploads */}
            <div className="grid grid-cols-2 gap-4">
              <div className="moj-card p-5">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('حجم التخزين', 'Storage Used')}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {(stats.totalSize / 1024 / 1024).toFixed(1)}
                  <span className="text-base text-muted-foreground ms-1">MB</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('مساحة مستخدمة', 'space used')}</p>
              </div>

              <div className="moj-card p-5">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('رفع حديث', 'Recent Uploads')}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mt-1">{stats.recentUploads}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('في آخر 7 أيام', 'in last 7 days')}</p>
              </div>
            </div>
          </>
        ) : null}

        {/* ─── Charts + Activity ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2 border-border">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                {t('اتجاه رفع الوثائق — آخر 7 أيام', 'Upload Trend — Last 7 Days')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {uploadTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={uploadTrendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={24} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                      formatter={(v: number) => [v, t('وثائق', 'docs')]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name={t('وثائق', 'docs')}
                      stroke="hsl(var(--primary))"
                      fill="url(#uploadGrad)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-36 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground">
                    {t('لا توجد بيانات رفع بعد', 'No upload data yet')}
                  </span>
                </div>
              )}

              {fileTypeData.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    {t('توزيع الأنواع', 'By File Type')}
                  </p>
                  <ResponsiveContainer width="100%" height={60}>
                    <BarChart data={fileTypeData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={24} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="value" name={t('عدد', 'count')} radius={[4, 4, 0, 0]}>
                        {fileTypeData.map((_: unknown, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card className="border-border">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                {t('النشاط الأخير', 'Recent Activity')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {canViewAudit && recentActivity.length > 0 ? (
                <div className="space-y-1">
                  {recentActivity.slice(0, 8).map((entry) => {
                    const ac = ACTION_CONFIG[entry.action];
                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-2.5 py-2 border-b border-border/40 last:border-0"
                      >
                        <span className={`text-xs mt-0.5 shrink-0 ${ac?.colorClass ?? 'text-muted-foreground'}`}>●</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {ac ? t(ac.labelAr, ac.labelEn) : entry.action}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(entry.createdAt).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}
                            {entry.userRole && ` · ${entry.userRole}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground text-center px-4">
                    {!canViewAudit
                      ? t('سجل النشاط متاح للمشرفين والمالكين', 'Activity log available for supervisors and owners')
                      : t('لا توجد عمليات حديثة بعد', 'No recent activity yet')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Quick Navigation (permission-gated) ─────────────────────────── */}
        {quickLinks.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              {t('الوصول السريع', 'Quick Access')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => navigate(link.href)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 text-center ${link.className}`}
                  >
                    <Icon className="w-5 h-5" aria-hidden />
                    <span className="text-xs font-medium leading-tight">
                      {t(link.labelAr, link.labelEn)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Quick AI Search (canUseAi only) ─────────────────────────────── */}
        {canUseAi && (
          <Card className="bg-primary text-primary-foreground border-0 shadow-md overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-5 h-5 text-gold" aria-hidden />
                    <h3 className="font-bold text-lg">
                      {t('بحث قانوني سريع', 'Quick Legal Search')}
                    </h3>
                  </div>
                  <p className="text-sm text-primary-foreground/75">
                    {t(
                      'اطرح سؤالاً قانونياً وسيبحث الذكاء الاصطناعي في مكتبتك والمصادر القانونية.',
                      'Ask a legal question and AI will search your library and legal sources.',
                    )}
                  </p>
                </div>
                <div className="w-full sm:w-80 flex gap-2">
                  <label className="sr-only" htmlFor="quick-search-input">
                    {t('مربع البحث القانوني السريع', 'Quick legal search input')}
                  </label>
                  <input
                    id="quick-search-input"
                    type="text"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
                    placeholder={t('ما هي شروط إنهاء العقد؟', 'What are the contract termination conditions?')}
                    value={quickQuery}
                    onChange={(e) => setQuickQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickQuery.trim()) {
                        sessionStorage.setItem('quickSearchQuery', quickQuery);
                        navigate('/research');
                      }
                    }}
                  />
                  <Button
                    className="bg-gold text-gold-foreground hover:bg-gold/90 shrink-0 gap-1.5 font-semibold"
                    onClick={() => {
                      if (quickQuery.trim()) {
                        sessionStorage.setItem('quickSearchQuery', quickQuery);
                        navigate('/research');
                      }
                    }}
                    disabled={!quickQuery.trim()}
                    aria-label={t('تنفيذ البحث', 'Execute search')}
                  >
                    <Search className="w-4 h-4" aria-hidden />
                    {t('بحث', 'Search')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Recent Documents ─────────────────────────────────────────────── */}
        {documents && documents.length > 0 && (
          <Card className="border-border">
            <CardHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">
                {t('آخر الوثائق المرفوعة', 'Recently Uploaded')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/library')} className="text-xs gap-1">
                {t('عرض الكل', 'View all')}
                <ArrowUpRight className="w-3 h-3" aria-hidden />
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.slice(0, 6).map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors text-start"
                    onClick={() => navigate('/library')}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0" aria-hidden>
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-sm font-medium truncate">{doc.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.fileType.toUpperCase()} · {(doc.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
