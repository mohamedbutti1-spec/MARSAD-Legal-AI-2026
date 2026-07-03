import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { apiFetch } from '@/lib/api-fetch';
import { Shield, Search, Trash2, RefreshCw, Activity, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface AuditEntry {
  id: number;
  action: string;
  entityType: string | null;
  entityId: number | null;
  userId: number | null;
  userRole: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  'document.upload': 'bg-blue-100 text-blue-800',
  'document.delete': 'bg-red-100 text-red-800',
  'ai.search': 'bg-purple-100 text-purple-800',
  'ai.literature-review': 'bg-indigo-100 text-indigo-800',
  'ai.uae-france-compare': 'bg-violet-100 text-violet-800',
  'backup.create': 'bg-green-100 text-green-800',
  'post:/comparisons': 'bg-orange-100 text-orange-800',
  'delete:/comparisons/:id': 'bg-red-100 text-red-800',
  'post:/users': 'bg-teal-100 text-teal-800',
  'delete:/users/:id': 'bg-red-100 text-red-800',
  'patch:/settings': 'bg-yellow-100 text-yellow-800',
};

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-700';
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'document.upload': 'رفع وثيقة',
    'document.delete': 'حذف وثيقة',
    'ai.search': 'بحث ذكي',
    'ai.literature-review': 'مراجعة أدبية',
    'ai.uae-france-compare': 'مقارنة قانونية',
    'backup.create': 'نسخة احتياطية',
  };
  return labels[action] ?? action;
}

export default function AuditLog() {
  const { canManageUsers } = useUserContext();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  const role = localStorage.getItem('userRole') || 'viewer';

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', offset: '0' });
      if (actionFilter) params.set('action', actionFilter);
      const res = await apiFetch(`/api/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setLoaded(true);
    } catch (err) {
      toast({ title: 'خطأ', description: 'تعذّر تحميل سجل العمليات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function purgeLogs() {
    if (!window.confirm('هل أنت متأكد من حذف السجلات الأقدم من 90 يومًا؟')) return;
    try {
      const res = await apiFetch('/api/audit?olderThanDays=90', {
        method: 'DELETE',
      });
      const data = await res.json();
      toast({ title: 'تم الحذف', description: `حُذف ${data.deleted} سجل قديم` });
      fetchLogs();
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر حذف السجلات القديمة', variant: 'destructive' });
    }
  }

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.action.toLowerCase().includes(q) ||
      (l.entityType ?? '').toLowerCase().includes(q) ||
      (l.userRole ?? '').toLowerCase().includes(q) ||
      (l.ipAddress ?? '').includes(q)
    );
  });

  if (!canManageUsers && role !== 'supervisor') {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold">غير مصرح / Access Denied</h2>
          <p className="text-muted-foreground mt-2">يتطلب هذا القسم دور المشرف أو أعلى.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">
              Audit Log{' '}
              <span className="text-muted-foreground font-sans font-normal text-xl ml-2">
                / سجل العمليات
              </span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              سجل كامل لجميع العمليات المنفّذة على المنصة — {total} entries total
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            {canManageUsers && (
              <Button variant="destructive" size="sm" onClick={purgeLogs}>
                <Trash2 className="w-4 h-4 mr-2" />
                حذف القديم
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="بحث في السجل..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <select
                  className="bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                >
                  <option value="">كل العمليات</option>
                  <option value="document.upload">رفع وثيقة</option>
                  <option value="document.delete">حذف وثيقة</option>
                  <option value="ai.search">بحث ذكي</option>
                  <option value="ai.literature-review">مراجعة أدبية</option>
                  <option value="ai.uae-france-compare">مقارنة قانونية</option>
                  <option value="backup.create">نسخة احتياطية</option>
                </select>
              </div>
              {!loaded && (
                <Button onClick={fetchLogs} disabled={loading}>
                  <Activity className="w-4 h-4 mr-2" />
                  تحميل السجل
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {loaded ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-base">
                {filtered.length} نتيجة {search && `لـ "${search}"`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  لا توجد نتائج
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-3 font-medium">التاريخ والوقت</th>
                        <th className="text-left px-4 py-3 font-medium">العملية</th>
                        <th className="text-left px-4 py-3 font-medium">الكيان</th>
                        <th className="text-left px-4 py-3 font-medium">الدور</th>
                        <th className="text-left px-4 py-3 font-medium">التفاصيل</th>
                        <th className="text-left px-4 py-3 font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((log) => {
                        let detailObj: Record<string, unknown> = {};
                        try {
                          if (log.details) detailObj = JSON.parse(log.details);
                        } catch {}
                        return (
                          <tr key={log.id} className="border-b border-border/40 hover:bg-muted/10">
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                              {new Date(log.createdAt).toLocaleString('ar-AE', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getActionColor(log.action)}`}>
                                {getActionLabel(log.action)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {log.entityType && (
                                <span>
                                  {log.entityType}
                                  {log.entityId && <span className="ml-1 text-foreground font-mono">#{log.entityId}</span>}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-secondary px-2 py-0.5 rounded capitalize">
                                {log.userRole ?? '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                              {Object.keys(detailObj).length > 0
                                ? Object.entries(detailObj)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(' · ')
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                              {log.ipAddress ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-20 text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">اضغط "تحميل السجل" لعرض سجل العمليات</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
