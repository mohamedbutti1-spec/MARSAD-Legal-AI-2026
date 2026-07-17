import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Loader2, Network, Trash2, Download } from 'lucide-react';
import { CreateDecisionDialog, type DecisionFormData } from '@/components/adkg/create-decision-dialog';

interface Decision {
  id: number;
  decisionNumber: string;
  title: string;
  titleAr: string;
  issuerOrg?: string | null;
  issuerOrgAr?: string | null;
  status: string;
  issuedDate?: string | null;
  effectiveDate?: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  draft:      { bg: '#f1f5f9', text: '#475569', labelAr: 'مسودة',       labelEn: 'Draft' },
  issued:     { bg: '#f0fdf4', text: '#15803d', labelAr: 'صادر',        labelEn: 'Issued' },
  challenged: { bg: '#fffbeb', text: '#92400e', labelAr: 'مطعون فيه',   labelEn: 'Challenged' },
  suspended:  { bg: '#fef2f2', text: '#991b1b', labelAr: 'موقوف',       labelEn: 'Suspended' },
  amended:    { bg: '#faf5ff', text: '#6d28d9', labelAr: 'معدّل',        labelEn: 'Amended' },
  revoked:    { bg: '#fef2f2', text: '#7f1d1d', labelAr: 'ملغى',        labelEn: 'Revoked' },
  annulled:   { bg: '#fff1f2', text: '#450a0a', labelAr: 'مُبطل',       labelEn: 'Annulled' },
  executed:   { bg: '#eff6ff', text: '#1e40af', labelAr: 'منفّذ',        labelEn: 'Executed' },
};

const ALL_STATUSES = ['draft','issued','challenged','suspended','amended','revoked','annulled','executed'];

export default function AdkgDashboard() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQ, setSearchQ]           = useState('');
  const [searchActive, setSearchActive] = useState(false);

  // List decisions
  const { data, isLoading } = useQuery({
    queryKey: ['adkg.decisions', filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      return apiFetch(`/api/adkg/decisions?${params.toString()}`).then((r) => r.json()) as Promise<{ decisions: Decision[] }>;
    },
    enabled: canUseAi && !searchActive,
  });

  // Search decisions
  const { data: searchData, isFetching: searchLoading } = useQuery({
    queryKey: ['adkg.search', searchQ, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams({ q: searchQ });
      if (filterStatus) params.set('status', filterStatus);
      return apiFetch(`/api/adkg/search?${params.toString()}`).then((r) => r.json()) as Promise<{ results: Decision[]; total: number }>;
    },
    enabled: canUseAi && searchActive && searchQ.trim().length > 0,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/adkg/decisions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adkg.decisions'] }),
  });

  const createMut = useMutation({
    mutationFn: (body: DecisionFormData) =>
      apiFetch('/api/adkg/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['adkg.decisions'] });
      if (res.decision?.id) navigate(`/adkg/${res.decision.id}`);
    },
  });

  const decisions: Decision[] = searchActive && searchQ.trim()
    ? (searchData?.results ?? [])
    : (data?.decisions ?? []);

  function handleSearch(q: string) {
    setSearchQ(q);
    setSearchActive(q.trim().length > 0);
  }

  function StatusBadge({ status }: { status: string }) {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>
        {t(s.labelAr, s.labelEn)}
      </span>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-heading flex items-center gap-2">
            <Network className="w-6 h-6" />
            {t('سجل القرارات الإدارية', 'Administrative Decision Knowledge Graph')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('إنشاء وإدارة القرارات الإدارية مع ربطها بالتشريعات والقضاء', 'Create and manage administrative decisions linked to legislation and case law')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary hover:opacity-90 text-white gap-2">
          <Plus className="w-4 h-4" />
          {t('قرار جديد', 'New Decision')}
        </Button>
      </div>

      {/* Search + Status Filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-52 max-w-xs">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQ}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('ابحث في القرارات…', 'Search decisions…')}
            className="pe-9"
            dir="auto"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: '', labelAr: 'الكل', labelEn: 'All' }, ...ALL_STATUSES.map((s) => ({
            value: s, labelAr: STATUS_STYLES[s]?.labelAr ?? s, labelEn: STATUS_STYLES[s]?.labelEn ?? s,
          }))].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === opt.value ? 'bg-primary text-primary-foreground border-primary/50' : 'bg-card text-muted-foreground border-border hover:border-primary/60'}`}
            >
              {t(opt.labelAr, opt.labelEn)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {(isLoading || searchLoading) && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !searchLoading && decisions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/10">
          <Network className="w-12 h-12 text-muted-foreground/25 mb-4" />
          <p className="text-muted-foreground text-sm">
            {searchActive ? t('لا توجد قرارات تطابق البحث', 'No decisions match your search') : t('لا توجد قرارات إدارية بعد', 'No administrative decisions yet')}
          </p>
        </div>
      )}

      {decisions.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">{t('رقم القرار', 'Decision No.')}</th>
                <th className="text-right px-4 py-3 font-semibold">{t('العنوان', 'Title')}</th>
                <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">{t('الجهة المصدرة', 'Issuer')}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('الحالة', 'Status')}</th>
                <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">{t('تاريخ الإصدار', 'Issued')}</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {decisions.map((d, i) => (
                <tr
                  key={d.id}
                  className={`cursor-pointer hover:bg-heading/10 transition-colors group ${i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`}
                  onClick={() => navigate(`/adkg/${d.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-heading font-semibold">{d.decisionNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground line-clamp-1">{d.titleAr}</p>
                    <p className="text-xs text-muted-foreground">{d.title}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{d.issuerOrgAr ?? d.issuerOrg ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{d.issuedDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(t('حذف هذا القرار؟', 'Delete this decision?'))) deleteMut.mutate(d.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDecisionDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={async (form) => { await createMut.mutateAsync(form); }}
      />
    </AppLayout>
  );
}
