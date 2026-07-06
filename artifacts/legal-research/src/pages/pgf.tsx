/**
 * PGF — Professional Guidance Framework
 * List page + Profession Selector
 */
import React, { useState } from 'react';
import { useLocation }   from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Plus, Loader2, AlertCircle, CheckCircle2,
  XCircle, ChevronRight, ChevronDown, Trash2, FileText, Clock,
} from 'lucide-react';
import { AppLayout }   from '@/components/layout/app-layout';
import { apiFetch }    from '@/lib/api-fetch';
import { Button }      from '@/components/ui/button';
import { Badge }       from '@/components/ui/badge';
import { useToast }    from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type {
  PgfSectorSummary, PgfProfessionSummary,
} from '@/types/pgf';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PgfSessionListItem {
  id:               number;
  title:            string;
  sectorId:         string;
  sectorNameAr:     string;
  professionId:     string;
  professionNameAr: string;
  status:           string;
  currentStageId:   string | null;
  completedStages:  string[];
  createdAt:        string;
  updatedAt:        string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  draft:      { label: 'جارٍ الاستبيان', icon: <Clock className="w-3 h-3" />,           className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  finalizing: { label: 'جارٍ التقييم',   icon: <Loader2 className="w-3 h-3 animate-spin" />, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  complete:   { label: 'مكتمل',          icon: <CheckCircle2 className="w-3 h-3" />,    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  error:      { label: 'خطأ',            icon: <XCircle className="w-3 h-3" />,         className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session, onDelete,
}: { session: PgfSessionListItem; onDelete: (id: number) => void }) {
  const [, navigate] = useLocation();
  const st = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.draft;

  return (
    <div
      className="bg-card border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(`/pgf/${session.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate text-right mb-2">
            {session.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mb-2" dir="rtl">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.className}`}>
              {st.icon} {st.label}
            </span>
            <Badge variant="outline" className="text-xs">{session.sectorNameAr}</Badge>
            <Badge variant="secondary" className="text-xs">{session.professionNameAr}</Badge>
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

// ─── Profession Selector Dialog ───────────────────────────────────────────────

function ProfessionSelectorDialog({
  open, onClose, onCreate,
}: {
  open:     boolean;
  onClose:  () => void;
  onCreate: (sector: PgfSectorSummary, profession: PgfProfessionSummary) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pgf-catalogue'],
    queryFn:  async () => {
      const res = await apiFetch('/api/pgf/catalogue');
      if (!res.ok) throw new Error('Failed to load catalogue');
      return res.json() as Promise<{ sectors: PgfSectorSummary[] }>;
    },
    enabled: open,
  });

  const sectors = data?.sectors ?? [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <BookOpen className="w-5 h-5 text-primary" />
            الإطار الاحترافي الموجَّه — اختر قطاعك ومهنتك
          </DialogTitle>
          <DialogDescription className="text-right">
            حدد قطاعك المهني ودورك لتلقي تقييم احترافي خطوة بخطوة.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        <div className="space-y-2 mt-2">
          {sectors.map((sector) => (
            <div key={sector.sectorId} className="border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                onClick={() => setExpanded(expanded === sector.sectorId ? null : sector.sectorId)}
              >
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === sector.sectorId ? 'rotate-180' : ''}`} />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{sector.sectorNameAr}</span>
                  <span className="text-lg">{sector.icon}</span>
                </div>
              </button>
              {expanded === sector.sectorId && (
                <div className="border-t bg-muted/20 p-3 grid grid-cols-2 gap-2">
                  {sector.professions.map((prof) => (
                    <button
                      key={prof.professionId}
                      onClick={() => onCreate(sector, prof)}
                      className="text-right px-3 py-2 rounded-lg border bg-card hover:bg-primary/5 hover:border-primary/40 transition-all text-sm"
                    >
                      <div className="font-medium">{prof.professionNameAr}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{prof.description}</div>
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

export default function PgfPage() {
  const [, navigate]   = useLocation();
  const queryClient    = useQueryClient();
  const { toast }      = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pgf-sessions'],
    queryFn:  async () => {
      const res = await apiFetch('/api/pgf/sessions');
      if (!res.ok) throw new Error('Failed to load sessions');
      return res.json() as Promise<{ sessions: PgfSessionListItem[] }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (params: { sectorId: string; professionId: string }) => {
      const res = await apiFetch('/api/pgf/sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to create session');
      return res.json() as Promise<{ session: { id: number } }>;
    },
    onSuccess: ({ session }) => {
      queryClient.invalidateQueries({ queryKey: ['pgf-sessions'] });
      setDialogOpen(false);
      navigate(`/pgf/${session.id}`);
    },
    onError: () => toast({ title: 'تعذّر إنشاء الجلسة', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/pgf/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pgf-sessions'] }),
    onError:   () => toast({ title: 'تعذّر الحذف', variant: 'destructive' }),
  });

  const handleCreate = (sector: PgfSectorSummary, prof: PgfProfessionSummary) => {
    createMutation.mutate({ sectorId: sector.sectorId, professionId: prof.professionId });
  };

  const sessions = data?.sessions ?? [];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">الإطار الاحترافي الموجَّه</h1>
              <p className="text-sm text-muted-foreground">Professional Guidance Framework · {20} قطاعاً · {data ? sessions.length : '…'} جلسة</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> جلسة جديدة
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>تنبيه: </strong>
          هذا الإطار يُقدم إرشاداً مهنياً استرشادياً فقط. لا يُصدر قرارات ملزمة ولا يحلّ محل الجهة المختصة.
        </div>

        {/* Sessions */}
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
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">لا توجد جلسات بعد</p>
            <p className="text-sm mb-6">اختر مهنتك وابدأ الاستبيان المهني الموجَّه.</p>
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

      <ProfessionSelectorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </AppLayout>
  );
}
