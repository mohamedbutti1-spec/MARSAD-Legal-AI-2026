import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Compass, Plus, Loader2, AlertCircle, Clock, CheckCircle2,
  XCircle, ChevronRight, ChevronDown, Trash2, FileText,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch }  from '@/lib/api-fetch';
import { Button }    from '@/components/ui/button';
import { Badge }     from '@/components/ui/badge';
import { useToast }  from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  SPG_SECTORS, type SpgSector, type SpgRole, type SpgSession,
} from '@/types/spg';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  draft:     { label: 'مسودة',       icon: <FileText className="w-3 h-3" />,   className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  analyzing: { label: 'جارٍ التحليل', icon: <Loader2 className="w-3 h-3 animate-spin" />, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  complete:  { label: 'مكتمل',       icon: <CheckCircle2 className="w-3 h-3" />, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  error:     { label: 'خطأ',         icon: <XCircle className="w-3 h-3" />,     className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, onDelete }: { session: SpgSession; onDelete: (id: number) => void }) {
  const [, navigate] = useLocation();
  const st = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.draft;
  const sector = SPG_SECTORS.find(s => s.id === session.sectorId);

  return (
    <div
      className="bg-card border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(`/spg/${session.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{sector?.icon ?? '🧭'}</span>
            <h3 className="font-semibold text-foreground truncate text-right">{session.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3" dir="rtl">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.className}`}>
              {st.icon} {st.label}
            </span>
            <Badge variant="outline" className="text-xs">{session.sectorNameAr}</Badge>
            <Badge variant="secondary" className="text-xs">{session.roleNameAr}</Badge>
          </div>
          <p className="text-xs text-muted-foreground" dir="rtl">{formatDate(session.createdAt)}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

// ─── Role Selector Dialog ─────────────────────────────────────────────────────

function RoleSelectorDialog({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (sector: SpgSector, role: SpgRole) => void;
}) {
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Compass className="w-5 h-5 text-primary" />
            الإرشاد المهني الذكي — اختر قطاعك ودورك
          </DialogTitle>
          <DialogDescription className="text-right">
            حدّد قطاعك المهني ودورك الوظيفي لتلقي إرشاد مهني مخصص ومنظّم.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {SPG_SECTORS.map((sector) => (
            <div key={sector.id} className="border rounded-xl overflow-hidden">
              {/* Sector header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedSector(expandedSector === sector.id ? null : sector.id)}
              >
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedSector === sector.id ? 'rotate-180' : ''}`} />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{sector.nameAr}</span>
                  <span className="text-lg">{sector.icon}</span>
                </div>
              </button>

              {/* Role list */}
              {expandedSector === sector.id && (
                <div className="border-t bg-muted/20 p-3 grid grid-cols-2 gap-2">
                  {sector.roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => onCreate(sector, role)}
                      className="text-right px-3 py-2 rounded-lg border bg-card hover:bg-primary/5 hover:border-primary/40 transition-all text-sm font-medium"
                    >
                      {role.nameAr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SpgPage() {
  const [, navigate]   = useLocation();
  const queryClient    = useQueryClient();
  const { toast }      = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch sessions
  const { data, isLoading, isError } = useQuery({
    queryKey: ['spg-sessions'],
    queryFn:  async () => {
      const res = await apiFetch('/api/spg/sessions');
      if (!res.ok) throw new Error('Failed to load sessions');
      return res.json() as Promise<{ sessions: SpgSession[] }>;
    },
  });

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: async (params: { sectorId: string; sectorNameAr: string; roleId: string; roleNameAr: string }) => {
      const res = await apiFetch('/api/spg/sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to create session');
      return res.json() as Promise<{ session: SpgSession }>;
    },
    onSuccess: ({ session }) => {
      queryClient.invalidateQueries({ queryKey: ['spg-sessions'] });
      setDialogOpen(false);
      navigate(`/spg/${session.id}`);
    },
    onError: () => toast({ title: 'تعذّر إنشاء الجلسة', variant: 'destructive' }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/spg/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spg-sessions'] }),
    onError:   () => toast({ title: 'تعذّر الحذف', variant: 'destructive' }),
  });

  const handleCreate = (sector: SpgSector, role: SpgRole) => {
    createMutation.mutate({
      sectorId:     sector.id,
      sectorNameAr: sector.nameAr,
      roleId:       role.id,
      roleNameAr:   role.nameAr,
    });
  };

  const sessions = data?.sessions ?? [];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Compass className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">الإرشاد المهني الذكي</h1>
              <p className="text-sm text-muted-foreground">Smart Professional Guidance</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> جلسة جديدة
          </Button>
        </div>

        {/* Disclaimer banner */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>تنبيه: </strong>
          هذه الأداة تُقدّم إرشاداً مهنياً استرشادياً فقط. لا تُصدر قرارات قانونية ملزمة ولا تحلّ محل الجهة المختصة أو المستشار القانوني المعتمد.
        </div>

        {/* Sessions list */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin ml-2" /> جارٍ التحميل…
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-xl">
            <AlertCircle className="w-5 h-5" /> تعذّر تحميل الجلسات
          </div>
        )}
        {!isLoading && !isError && sessions.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Compass className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">لا توجد جلسات بعد</p>
            <p className="text-sm mb-6">أنشئ جلسة جديدة واختر قطاعك ودورك المهني للبدء.</p>
            <Button onClick={() => setDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> ابدأ الآن
            </Button>
          </div>
        )}
        {sessions.length > 0 && (
          <div className="grid gap-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onDelete={(id) => deleteMutation.mutate(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Role selector dialog */}
      <RoleSelectorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </AppLayout>
  );
}
