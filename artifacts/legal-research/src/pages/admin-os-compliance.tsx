/**
 * Phase 5 — Legal Compliance Dashboard
 * Shows aggregate statistics for all administrative decision assessments.
 * Intended for Legal Department and Administrative Court roles.
 */

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { Loader2, BarChart3, TrendingUp, FileCheck2, AlertTriangle, Scale, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CanIssueBreakdown {
  value: string;
  labelAr: string;
  count: number;
}

interface AvgByDay {
  date: string;
  avgScore: number;
  count: number;
}

interface DimensionCompliance {
  key: string;
  labelAr: string;
  nonCompliantCount: number;
}

interface HighRiskType {
  decisionTypeAr: string;
  avgRiskScore: number;
  sessionCount: number;
}

interface RecentExport {
  sessionId: number;
  decisionTypeAr: string;
  exportedAt: string;
}

interface ComplianceStats {
  totalSessions: number;
  avgLegalityScore: number;
  totalPdfExports: number;
  canIssueTodayBreakdown: CanIssueBreakdown[];
  avgLegalityByDay: AvgByDay[];
  mostNonCompliantDimensions: DimensionCompliance[];
  highRiskDecisionTypes: HighRiskType[];
  recentPdfExports: RecentExport[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS: Record<string, string> = {
  yes:         '#059669',
  no:          '#dc2626',
  conditional: '#d97706',
};

const PIE_LABELS: Record<string, string> = {
  yes:         'يمكن الإصدار',
  no:          'لا يمكن الإصدار',
  conditional: 'مشروط',
};

// ─── Shared sub-components ───────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = 'primary' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    green:   'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    blue:    'bg-blue-50 text-blue-700',
  };
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color] ?? colors.primary}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-black text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOsCompliance() {
  const t = useT();
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch('/api/admin-os/stats');
      if (!r.ok) { setError('فشل تحميل البيانات'); return; }
      setStats(await r.json());
    } catch { setError('خطأ في الاتصال بالخادم'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchStats(); }, []);

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto" dir="rtl">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-black text-foreground">لوحة الامتثال القانوني</h1>
                <p className="text-xs text-muted-foreground">إحصائيات تقييمات نظام القرارات الإدارية</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="gap-1.5 text-xs">
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('تحديث', 'Refresh')}
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {stats && !loading && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  icon={<BarChart3 className="w-5 h-5" />}
                  label="إجمالي التقييمات"
                  value={stats.totalSessions}
                  color="primary"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="متوسط درجة المشروعية"
                  value={`${stats.avgLegalityScore}/100`}
                  color={stats.avgLegalityScore >= 80 ? 'green' : stats.avgLegalityScore >= 60 ? 'amber' : 'primary'}
                />
                <StatCard
                  icon={<FileCheck2 className="w-5 h-5" />}
                  label="ملفات PDF مُصدَّرة"
                  value={stats.totalPdfExports}
                  color="blue"
                />
              </div>

              {/* Row 1: Pie + Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Pie: canIssueToday */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-primary">●</span> توزيع قرارات الإصدار
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={stats.canIssueTodayBreakdown}
                        dataKey="count"
                        nameKey="labelAr"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ value }) => value}
                      >
                        {stats.canIssueTodayBreakdown.map((entry) => (
                          <Cell key={entry.value} fill={PIE_COLORS[entry.value] ?? '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, _n, p) => [v, p.payload?.labelAr]} />
                      <Legend
                        formatter={(_, entry) => (entry as { payload?: { labelAr: string } }).payload?.labelAr ?? ''}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar: non-compliant dimensions */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-destructive">●</span> أكثر الأبعاد عدم امتثالاً
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.mostNonCompliantDimensions} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="labelAr" width={100} tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="nonCompliantCount" name="حالات عدم الامتثال" fill="#dc2626" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="nonCompliantCount" position="right" style={{ fontSize: 9 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

              </div>

              {/* Row 2: Line chart (full width) */}
              {stats.avgLegalityByDay.length > 1 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-primary">●</span> تطور درجة المشروعية — آخر 30 يوماً
                  </h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.avgLegalityByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="avgScore"
                        name="متوسط المشروعية"
                        stroke="#1e3a5f"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Row 3: High-risk table */}
              {stats.highRiskDecisionTypes.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      أنواع القرارات ذات الخطر المرتفع
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/20 text-muted-foreground text-xs">
                          <th className="text-right px-4 py-2 font-semibold">نوع القرار</th>
                          <th className="text-right px-4 py-2 font-semibold">متوسط الخطر</th>
                          <th className="text-right px-4 py-2 font-semibold">عدد التقييمات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.highRiskDecisionTypes.map((dt, i) => (
                          <tr key={i} className="border-t border-border/40 hover:bg-muted/10">
                            <td className="px-4 py-2.5 text-foreground">{dt.decisionTypeAr}</td>
                            <td className="px-4 py-2.5">
                              <span className={`font-bold ${dt.avgRiskScore >= 70 ? 'text-red-600' : dt.avgRiskScore >= 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {dt.avgRiskScore}/100
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{dt.sessionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Row 4: Recent PDF exports */}
              {stats.recentPdfExports.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-blue-500" />
                      آخر ملفات PDF مُصدَّرة للمراجعة
                    </h2>
                  </div>
                  <div className="divide-y divide-border/40">
                    {stats.recentPdfExports.map((e, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-sm text-foreground">{e.decisionTypeAr}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">الجلسة #{e.sessionId}</span>
                          <span className="text-xs text-muted-foreground">{new Date(e.exportedAt).toLocaleDateString('ar-AE')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.totalSessions === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">لا توجد تقييمات حتى الآن.</p>
                  <p className="text-xs mt-1">ابدأ بتقييم قرار إداري من نظام القرارات الإدارية.</p>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
