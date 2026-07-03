import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetDocumentStats, useAiSearch, useListDocuments } from '@workspace/api-client-react';
import { apiFetch } from '@/lib/api-fetch';
import { BookOpen, FileText, UploadCloud, Library, BrainCircuit, Search, Activity, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/lib/user-context';
import { useLocation } from 'wouter';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface AuditEntry {
  id: number;
  action: string;
  entityType: string | null;
  userRole: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  'document.upload': '📤 رفع وثيقة',
  'document.delete': '🗑️ حذف وثيقة',
  'ai.search': '🔍 بحث ذكي',
  'ai.literature-review': '📚 مراجعة أدبية',
  'ai.uae-france-compare': '⚖️ مقارنة قانونية',
  'backup.create': '💾 نسخة احتياطية',
};

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetDocumentStats();
  const { data: documents } = useListDocuments();
  const { canUseAi, role } = useUserContext();
  const [, navigate] = useLocation();
  const [quickQuery, setQuickQuery] = useState('');
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);

  const searchMutation = useAiSearch();

  // Load recent audit activity
  useEffect(() => {
    const userRole = localStorage.getItem('userRole') || 'owner';
    if (userRole === 'viewer') return;
    apiFetch('/api/audit?limit=8')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.logs) setRecentActivity(data.logs); })
      .catch(() => {});
  }, []);

  const handleQuickSearch = () => {
    if (!quickQuery.trim()) return;
    navigate('/ai-search');
  };

  // Upload trend for chart
  const uploadTrendData = React.useMemo(() => {
    const s = stats as (typeof stats & { uploadsByDay?: Record<string, number> }) | undefined;
    if (!s?.uploadsByDay) return [];
    const entries = Object.entries(s.uploadsByDay as Record<string, number>)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('ar-AE', { weekday: 'short' }),
        عدد: count,
      }));
    return entries;
  }, [stats]);

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Dashboard{' '}
            <span className="text-muted-foreground font-sans font-normal text-xl ml-2">
              / لوحة القيادة
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 font-serif">
            مرحباً بك في منصة البحث القانوني — مكتبتك الخاصة جاهزة.
          </p>
        </div>

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-16 bg-muted/20" />
                <CardContent className="h-16" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-destructive/10 text-destructive rounded border border-destructive/20">
            تعذّر تحميل الإحصائيات.
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/documents')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  إجمالي الوثائق
                </CardTitle>
                <Library className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold text-foreground">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">وثيقة في المكتبة</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  حجم التخزين
                </CardTitle>
                <FileText className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold text-foreground">
                  {(stats.totalSize / 1024 / 1024).toFixed(1)}{' '}
                  <span className="text-xl text-muted-foreground">MB</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">مساحة مستخدمة</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  رفع حديث
                </CardTitle>
                <UploadCloud className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold text-foreground">{stats.recentUploads}</div>
                <p className="text-xs text-muted-foreground mt-1">في آخر 7 أيام</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  أنواع الملفات
                </CardTitle>
                <BookOpen className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1.5 mt-2">
                  {stats.byType.map((t: { type: string; count: number }) => (
                    <div key={t.type} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-muted-foreground">{t.type.toUpperCase()}</span>
                      <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground font-bold">
                        {t.count}
                      </span>
                    </div>
                  ))}
                  {stats.byType.length === 0 && (
                    <span className="text-sm text-muted-foreground">لا توجد وثائق</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Activity + Quick Search */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                نشاط المنصة{' '}
                <span className="font-sans font-normal text-muted-foreground text-sm ml-2">
                  / Platform Activity
                </span>
              </CardTitle>
              {uploadTrendData.length > 0 && (
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              {uploadTrendData.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">اتجاه الرفع — آخر 7 أيام</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={uploadTrendData}>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={20} />
                      <Tooltip />
                      <Area type="monotone" dataKey="عدد" stroke="var(--primary)" fill="url(#grad)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {recentActivity.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {recentActivity.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/20 text-sm"
                    >
                      <span className="text-foreground">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded capitalize">
                          {entry.userRole ?? 'system'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleTimeString('ar-AE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center border border-dashed border-border rounded bg-muted/5">
                  <span className="text-muted-foreground text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    {role === 'viewer'
                      ? 'سجل النشاط متاح للمشرفين والمالكين'
                      : 'لا توجد عمليات حديثة بعد'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick AI Search */}
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="font-serif text-primary-foreground flex items-center gap-2">
                <BrainCircuit className="w-5 h-5" />
                بحث سريع{' '}
                <span className="font-sans font-normal text-primary-foreground/70 text-sm ml-1">
                  / Quick AI Search
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-primary-foreground/80 mb-4">
                اسأل سؤالاً قانونياً وسيبحث الذكاء الاصطناعي في وثائقك.
              </p>
              {canUseAi ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full bg-primary-foreground/10 border border-primary-foreground/20 rounded p-3 text-primary-foreground placeholder:text-primary-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary-foreground/50"
                    rows={3}
                    placeholder="مثال: ما هي شروط إنهاء العقد في قانون الإمارات؟"
                    value={quickQuery}
                    onChange={(e) => setQuickQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleQuickSearch();
                    }}
                  />
                  <Button
                    className="w-full bg-primary-foreground text-primary py-2 font-bold shadow-sm hover:opacity-90 transition-opacity"
                    onClick={() => {
                      if (quickQuery.trim()) {
                        sessionStorage.setItem('quickSearchQuery', quickQuery);
                        navigate('/ai-search');
                      }
                    }}
                    disabled={!quickQuery.trim()}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    بحث في المكتبة
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-primary-foreground/70 py-4 text-center">
                  ميزة الذكاء الاصطناعي محدودة بصلاحيتك الحالية (مشاهد).
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent documents quick view */}
        {documents && documents.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-base">
                آخر الوثائق المرفوعة{' '}
                <span className="font-sans font-normal text-muted-foreground text-sm ml-2">
                  / Recent Documents
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
                عرض الكل →
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.slice(0, 6).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-md border border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{doc.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.fileType.toUpperCase()} · {(doc.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
