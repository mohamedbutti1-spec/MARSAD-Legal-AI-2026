import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gavel, Plus, Loader2, AlertCircle, Clock, CheckCircle2, XCircle,
  ChevronRight, Shield, Bot, Sparkles, Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  DISPUTE_TYPE_LABELS, THEORY_LENS_OPTIONS, getVisibleTheoryLensOptions, type JreSession,
} from '@/types/jre';
import { useUserContext } from '@/lib/user-context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending:   { label: 'في الانتظار', icon: <Clock className="w-3 h-3" />,        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  analyzing: { label: 'جارٍ التحليل', icon: <Loader2 className="w-3 h-3 animate-spin" />, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  complete:  { label: 'مكتمل',       icon: <CheckCircle2 className="w-3 h-3" />,  className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  error:     { label: 'خطأ',         icon: <XCircle className="w-3 h-3" />,       className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, onDelete }: { session: JreSession; onDelete: (id: number) => void }) {
  const [, navigate] = useLocation();
  const st     = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.pending;
  const dtConf = DISPUTE_TYPE_LABELS[session.disputeType] ?? DISPUTE_TYPE_LABELS.other;

  return (
    <div
      className="bg-card border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(`/jre/${session.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-foreground truncate text-right">{session.title}</h3>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3" dir="rtl">
            {/* Status */}
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.className}`}>
              {st.icon} {st.label}
            </span>
            {/* Dispute type */}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dtConf.color}`}>
              {dtConf.ar}
            </span>
            {/* AI involved */}
            {session.hasAiDecision === 'true' && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <Bot className="w-3 h-3" /> قرار رقمي
              </span>
            )}
            {/* Theory */}
            {session.theoryLensId && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold dark:bg-gold/30 dark:text-gold/80">
                <Sparkles className="w-3 h-3" /> {session.theoryLensName || 'نظرية'}
              </span>
            )}
          </div>

          {/* Scores + date */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground" dir="rtl">
            {session.legalityScore != null && (
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                مشروعية {session.legalityScore}%
              </span>
            )}
            <span>{formatDate(session.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
            title="حذف الجلسة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ─── New Session Form ─────────────────────────────────────────────────────────

interface NewSessionForm {
  title:            string;
  disputeSummary:   string;
  applicant:        string;
  applicantAr:      string;
  respondent:       string;
  respondentAr:     string;
  disputeType:      string;
  hasAiDecision:    boolean;
  theoryLensId:     string;
  customTheoryText: string;
}

const DEFAULT_FORM: NewSessionForm = {
  title:            '',
  disputeSummary:   '',
  applicant:        '',
  applicantAr:      '',
  respondent:       '',
  respondentAr:     '',
  disputeType:      'annulment',
  hasAiDecision:    false,
  theoryLensId:     '',
  customTheoryText: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JrePage() {
  const { canUseShamsiFramework } = useUserContext();
  const visibleTheoryLensOptions = getVisibleTheoryLensOptions(canUseShamsiFramework);
  const [, navigate]  = useLocation();
  const { toast }     = useToast();
  const qc            = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState<NewSessionForm>(DEFAULT_FORM);

  // Load sessions
  const { data, isLoading, error } = useQuery({
    queryKey: ['jre-sessions'],
    queryFn:  () => apiFetch('/api/jre/sessions').then((r) => r.json()) as Promise<{ sessions: JreSession[] }>,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/jre/sessions/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['jre-sessions'] }),
    onError:    () => toast({ title: 'تعذَّر الحذف', variant: 'destructive' }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch('/api/jre/sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Analysis failed');
        return d;
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['jre-sessions'] });
      setDialogOpen(false);
      setForm(DEFAULT_FORM);
      if (data.session?.id) navigate(`/jre/${data.session.id}`);
    },
    onError: (err: Error) => {
      toast({ title: 'تعذَّر إنشاء الجلسة', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.disputeSummary.trim().length < 50) {
      toast({ title: 'ملخص النزاع قصير جداً', description: 'يرجى إدخال 50 حرفاً على الأقل.', variant: 'destructive' });
      return;
    }
    if (!form.applicant && !form.applicantAr) {
      toast({ title: 'اسم المدعي مطلوب', variant: 'destructive' });
      return;
    }
    if (!form.respondent && !form.respondentAr) {
      toast({ title: 'اسم المدعى عليه مطلوب', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      title:           form.title || undefined,
      disputeSummary:  form.disputeSummary.trim(),
      parties: {
        applicant:    form.applicant,
        applicantAr:  form.applicantAr,
        respondent:   form.respondent,
        respondentAr: form.respondentAr,
      },
      disputeType:     form.disputeType,
      hasAiDecision:   form.hasAiDecision,
      theoryLensId:    form.theoryLensId || null,
      theoryLensName:  THEORY_LENS_OPTIONS.find((o) => o.value === form.theoryLensId)?.label || null,
      customTheoryText: form.theoryLensId === 'custom' ? form.customTheoryText : null,
    });
  };

  const sessions = data?.sessions ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="w-6 h-6 text-primary" />
            محرك التفكير القضائي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تحليل النزاعات الإدارية الإماراتية خطوة بخطوة وفق منهج المحكمة الإدارية الاتحادية
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          تحليل جديد
        </Button>
      </div>

      {/* ── Sessions list ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>جارٍ التحميل…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 py-10">
          <AlertCircle className="w-5 h-5" />
          تعذَّر تحميل الجلسات
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <Gavel className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <div>
            <p className="text-lg font-medium text-foreground">لا توجد جلسات بعد</p>
            <p className="text-sm text-muted-foreground mt-1">
              أنشئ تحليلاً قضائياً جديداً لنزاع إداري إماراتي
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> بدء تحليل جديد
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* ── New Analysis Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Gavel className="w-5 h-5 text-primary" />
              تحليل قضائي جديد
            </DialogTitle>
            <DialogDescription className="text-right">
              أدخل تفاصيل النزاع الإداري لبدء التحليل القضائي متعدد المراحل
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-right block">عنوان الجلسة (اختياري)</Label>
              <Input
                id="title"
                placeholder="مثال: طعن في قرار إنهاء الخدمة"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                dir="rtl"
              />
            </div>

            {/* Dispute summary */}
            <div className="space-y-1.5">
              <Label htmlFor="summary" className="text-right block">
                ملخص النزاع الإداري <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="summary"
                rows={5}
                placeholder="صِف النزاع بالتفصيل: ما هو القرار الإداري المطعون فيه؟ من أصدره؟ ما هو الضرر الذي لحق بالمدعي؟ ما هي الوقائع الجوهرية؟ (50 حرفاً على الأقل)"
                value={form.disputeSummary}
                onChange={(e) => setForm({ ...form, disputeSummary: e.target.value })}
                dir="rtl"
              />
              <div className={`text-xs text-left ${form.disputeSummary.length < 50 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {form.disputeSummary.length} / 50 حد أدنى
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-right block">
                  المدعي / المتظلم <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="الاسم بالعربية"
                  value={form.applicantAr}
                  onChange={(e) => setForm({ ...form, applicantAr: e.target.value })}
                  dir="rtl"
                />
                <Input
                  placeholder="Name in English"
                  value={form.applicant}
                  onChange={(e) => setForm({ ...form, applicant: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-right block">
                  المدعى عليه / الجهة الإدارية <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="الاسم بالعربية"
                  value={form.respondentAr}
                  onChange={(e) => setForm({ ...form, respondentAr: e.target.value })}
                  dir="rtl"
                />
                <Input
                  placeholder="Name in English"
                  value={form.respondent}
                  onChange={(e) => setForm({ ...form, respondent: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Dispute type */}
            <div className="space-y-1.5">
              <Label className="text-right block">نوع النزاع</Label>
              <Select value={form.disputeType} onValueChange={(v) => setForm({ ...form, disputeType: v })}>
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DISPUTE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI Decision */}
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <input
                id="aiDecision"
                type="checkbox"
                checked={form.hasAiDecision}
                onChange={(e) => setForm({ ...form, hasAiDecision: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <label htmlFor="aiDecision" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-violet-600" />
                  القرار المطعون فيه صادر عن نظام ذكاء اصطناعي أو خوارزمي
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  سيُفعِّل هذا الخيار مرحلة المراجعة الرقمية وفق الأبعاد السبعة لنظرية الشامسي
                </p>
              </div>
            </div>

            {/* Theory lens */}
            <div className="space-y-1.5">
              <Label className="text-right block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-gold" />
                التحليل النظري المقارن (اختياري — غير مُلزِم)
              </Label>
              <Select value={form.theoryLensId} onValueChange={(v) => setForm({ ...form, theoryLensId: v })}>
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="بدون تحليل نظري" />
                </SelectTrigger>
                <SelectContent>
                  {visibleTheoryLensOptions.map((o) => (
                    <SelectItem key={o.value || '__none'} value={o.value || '__none'}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.theoryLensId === 'custom' && (
                <Textarea
                  rows={3}
                  placeholder="صِف الإطار النظري المخصص الذي تريد تطبيقه…"
                  value={form.customTheoryText}
                  onChange={(e) => setForm({ ...form, customTheoryText: e.target.value })}
                  dir="rtl"
                  className="mt-2"
                />
              )}
              {form.theoryLensId && form.theoryLensId !== '__none' && (
                <p className="text-xs text-gold dark:text-gold/80 flex items-start gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  التحليل النظري غير مُلزِم قانونياً ولا يُشكِّل سلطة قضائية ملزمة. يُعرض منفصلاً عن الحكم دائماً.
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 gap-2"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جارٍ التحليل القضائي… (قد يستغرق 1-2 دقيقة)
                  </>
                ) : (
                  <>
                    <Gavel className="w-4 h-4" />
                    بدء التحليل القضائي
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setForm(DEFAULT_FORM); }}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
