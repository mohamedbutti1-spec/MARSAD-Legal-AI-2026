import React, { useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetDocumentStats, useListDocuments, useListComparisons } from '@workspace/api-client-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BarChart2, PieChart as PieIcon, TrendingUp, Database, Layers } from 'lucide-react';

const COLORS = ['#1e3a5f', '#2d5a9e', '#4a7fc1', '#6fa3d8', '#9ec5e8', '#c4dcf0'];

export default function Analytics() {
  const { data: stats, isLoading: statsLoading } = useGetDocumentStats();
  const { data: documents } = useListDocuments();
  const { data: comparisons } = useListComparisons();

  // Upload trend — last 30 days
  const uploadTrendData = useMemo(() => {
    const s = stats as (typeof stats & { uploadsByDay?: Record<string, number> }) | undefined;
    if (!s?.uploadsByDay) return [];
    const entries = Object.entries(s.uploadsByDay as Record<string, number>)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('ar-AE', { month: 'short', day: 'numeric' }),
        uploads: count,
      }));
    return entries;
  }, [stats]);

  // File type distribution
  const typeData = useMemo(() => {
    if (!stats?.byType) return [];
    return stats.byType.map((t: { type: string; count: number }) => ({
      name: t.type.toUpperCase(),
      value: t.count,
    }));
  }, [stats]);

  // Size distribution
  const sizeData = useMemo(() => {
    if (!documents) return [];
    const buckets: Record<string, number> = {
      '< 100 KB': 0,
      '100 KB–1 MB': 0,
      '1–10 MB': 0,
      '> 10 MB': 0,
    };
    documents.forEach((d) => {
      const kb = d.fileSize / 1024;
      if (kb < 100) buckets['< 100 KB']++;
      else if (kb < 1024) buckets['100 KB–1 MB']++;
      else if (kb < 10240) buckets['1–10 MB']++;
      else buckets['> 10 MB']++;
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [documents]);

  if (statsLoading) {
    return (
      <AppLayout>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse h-64" />
          ))}
        </div>
      </AppLayout>
    );
  }

  const totalSizeMB = ((stats?.totalSize ?? 0) / 1024 / 1024).toFixed(2);

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Analytics{' '}
            <span className="text-muted-foreground font-sans font-normal text-xl ml-2">
              / لوحة المؤشرات
            </span>
          </h1>
          <p className="text-muted-foreground mt-2">
            مؤشرات الأداء الرئيسية لمنصة البحث القانوني — Real-time KPIs for your legal library.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                إجمالي الوثائق
              </CardTitle>
              <FileText className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{stats?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Total documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                حجم التخزين
              </CardTitle>
              <Database className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{totalSizeMB}</div>
              <p className="text-xs text-muted-foreground mt-1">MB storage used</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                رفع حديث
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{stats?.recentUploads ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Uploads in 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                جداول المقارنة
              </CardTitle>
              <Layers className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{comparisons?.length ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Comparison tables</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" />
                اتجاه الرفع — Upload Trend (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {uploadTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={uploadTrendData}>
                    <defs>
                      <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="uploads" stroke="#1e3a5f" fill="url(#uploadGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  ارفع وثائق لرؤية اتجاه النشاط — Upload documents to see the trend
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-primary" />
                توزيع أنواع الملفات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {typeData.map((_entry: unknown, index: number) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend formatter={(val) => <span className="text-xs">{val}</span>} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  لا توجد وثائق بعد
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Size Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">توزيع الأحجام — File Size Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sizeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2d5a9e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Document Types Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">الوثائق حسب النوع — Documents by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={typeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {typeData.map((_: unknown, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  ارفع وثائق لرؤية التوزيع
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent documents table */}
        {documents && documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">أحدث الوثائق — Recent Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="text-left py-2 pr-4 font-medium">الوثيقة</th>
                      <th className="text-left py-2 pr-4 font-medium">النوع</th>
                      <th className="text-left py-2 pr-4 font-medium">الحجم</th>
                      <th className="text-left py-2 font-medium">تاريخ الرفع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, 8).map((doc) => (
                      <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">{doc.originalName}</td>
                        <td className="py-2.5 pr-4">
                          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-bold">
                            {doc.fileType.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {(doc.fileSize / 1024).toFixed(0)} KB
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {new Date(doc.uploadedAt).toLocaleDateString('ar-AE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
