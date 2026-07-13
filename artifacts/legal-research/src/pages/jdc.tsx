import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, Loader2, AlertCircle, Clock, CheckCircle2, XCircle,
  ChevronRight, Gavel, Scale, Bot, Sparkles, Trash2, User,
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
import { DISPUTE_TYPE_LABELS, THEORY_LENS_OPTIONS } from '@/types/jre';
import {
  PANEL_SIZE_CONFIG, DISPOSAL_POSITION_CONFIG, STATUS_CONFIG,
  type JdcChamber, type PanelSize,
} from '@/types/jdc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function PanelIcon({ size }: { size: PanelSize }) {
  if (size === 1) return <User className="w-4 h-4" />;
  if (size === 3) return <Users className="w-4 h-4" />;
  return <Scale className="w-4 h-4" />;
}

// ─── Chamber Card ─────────────────────────────────────────────────────────────

function ChamberCard({ chamber, onDelete }: { chamber: JdcChamber; onDelete: (id: number) => void }) {
  const [, navigate] = useLocation();
  const panelConf = PANEL_SIZE_CONFIG[chamber.panelSize as PanelSize] ?? PANEL_SIZE_CONFIG[3];
  const stConf    = STATUS_CONFIG[chamber.status] ?? STATUS_CONFIG.deliberating;
  const dtConf    = DISPUTE_TYPE_LABELS[chamber.disputeType] ?? DISPUTE_TYPE_LABELS.other;

  const deliberation = chamber.deliberation;
  const majorityPos  = deliberation?.majorityPosition;
  const dispConf     = majorityPos ? DISPOSAL_POSITION_CONFIG[majorityPos] : null;

  return (
    <div
      className="bg-card border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(`/jdc/${chamber.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-foreground truncate text-right">{chamber.title}</h3>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3" dir="rtl">
            <Badge className={`text-xs ${stConf.color} border-0`}>
              {chamber.status === 'deliberating' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {chamber.status === 'complete'     && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {chamber.status === 'error'        && <XCircle className="w-3 h-3 mr-1" />}
              {stConf.labelAr}
            </Badge>
            <Badge className={`text-xs ${panelConf.color} border-0 flex items-center gap-1`}>
              <PanelIcon size={chamber.panelSize as PanelSize} />
              {panelConf.labelAr}
            </Badge>
            <Badge className={`text-xs ${dtConf.color} border-0`}>
              {dtConf.ar}
            </Badge>
            {dispConf && (
              <Badge className={`text-xs ${dispConf.color} border-0`}>
                {dispConf.icon} {dispConf.labelAr}
              </Badge>
            )}
            {chamber.hasAiDecision === 'true' && (
              <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0 flex items-center gap-1">
                <Bot className="w-3 h-3" /> قرار رقمي
              </Badge>
            )}
            {chamber.theoryLensId && (
              <Badge className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> نظري
              </Badge>
            )}
          </div>

          {/* Scores row */}
          {deliberation && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground" dir="rtl">
              {deliberation.legalityScore != null && (
                <span>المشروعية: <span className="font-medium text-foreground">{deliberation.legalityScore}٪</span></span>
              )}
              {deliberation.riskScore != null && (
                <span>المخاطر: <span className="font-medium text-foreground">{deliberation.riskScore}٪</span></span>
              )}
              <span>القضاة: <span className="font-medium text-foreground">{deliberation.judges?.length ?? chamber.panelSize}</span></span>
              {deliberation.dissentingJudgeIds?.length > 0 && (
                <span className="text-gold">
                  معارض: {deliberation.dissentingJudgeIds.length}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">{formatDate(chamber.createdAt)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(chamber.id); }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: {
    title: string;
    disputeSummary: string;
    parties: { applicantAr: string; respondentAr: string };
    disputeType: string;
    panelSize: PanelSize;
    hasAiDecision: boolean;
    theoryLensId: string | null;
  }) => void;
  isLoading: boolean;
}

function CreateDialog({ open, onOpenChange, onSubmit, isLoading }: CreateDialogProps) {
  const [form, setForm] = useState({
    title:          '',
    disputeSummary: '',
    applicantAr:    '',
    respondentAr:   '',
    disputeType:    'annulment',
    panelSize:      '3' as string,
    hasAiDecision:  false,
    theoryLensId:   '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title:         form.title,
      disputeSummary: form.disputeSummary,
      parties: { applicantAr: form.applicantAr, respondentAr: form.respondentAr },
      disputeType:   form.disputeType,
      panelSize:     parseInt(form.panelSize) as PanelSize,
      hasAiDecision: form.hasAiDecision,
      theoryLensId:  form.theoryLensId || null,
    });
  };

  const upd = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Gavel className="w-5 h-5 text-primary" />
            إنشاء دائرة مداولة قضائية جديدة
          </DialogTitle>
          <DialogDescription>
            يُحاكي هذا النظام هيئة قضاء إدارية إماراتية. كل قاضٍ يُحلِّل القضية باستقلالية تامة.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Panel size */}
          <div className="space-y-1.5">
            <Label>حجم الهيئة القضائية *</Label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 3, 5] as const).map((sz) => {
                const conf = PANEL_SIZE_CONFIG[sz];
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => upd('panelSize', String(sz))}
                    className={`rounded-lg border p-3 text-right transition-all ${
                      form.panelSize === String(sz)
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <PanelIcon size={sz} />
                      <span className="font-medium text-sm">{conf.labelAr}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{conf.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>عنوان الجلسة (اختياري)</Label>
            <Input
              value={form.title}
              onChange={(e) => upd('title', e.target.value)}
              placeholder="سيُولَّد تلقائياً إن تُرك فارغاً"
              className="text-right"
            />
          </div>

          {/* Dispute type */}
          <div className="space-y-1.5">
            <Label>نوع النزاع *</Label>
            <Select value={form.disputeType} onValueChange={(v) => upd('disputeType', v)}>
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISPUTE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>المدعي (المتظلم) *</Label>
              <Input
                value={form.applicantAr}
                onChange={(e) => upd('applicantAr', e.target.value)}
                placeholder="مثال: محمد سالم الكعبي"
                className="text-right"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>المدعى عليه (الجهة الإدارية) *</Label>
              <Input
                value={form.respondentAr}
                onChange={(e) => upd('respondentAr', e.target.value)}
                placeholder="مثال: وزارة الموارد البشرية"
                className="text-right"
                required
              />
            </div>
          </div>

          {/* Dispute summary */}
          <div className="space-y-1.5">
            <Label>ملخص النزاع الإداري * <span className="text-muted-foreground text-xs">(50 حرف على الأقل)</span></Label>
            <Textarea
              value={form.disputeSummary}
              onChange={(e) => upd('disputeSummary', e.target.value)}
              placeholder="صِف النزاع الإداري بتفصيل كافٍ: طبيعة القرار المطعون فيه، وقائع القضية، الأثر على المدعي، الأساس القانوني المطالب به..."
              className="min-h-[120px] text-right"
              dir="rtl"
              required
            />
            <p className="text-xs text-muted-foreground text-left">{form.disputeSummary.length} حرف</p>
          </div>

          {/* AI decision toggle */}
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="flex-1 text-right">
              <p className="text-sm font-medium">قرار مُتَّخَذ بنظام رقمي / ذكاء اصطناعي</p>
              <p className="text-xs text-muted-foreground">يُفعِّل تحليل الأبعاد السبعة للقرارات الخوارزمية</p>
            </div>
            <button
              type="button"
              onClick={() => upd('hasAiDecision', !form.hasAiDecision)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.hasAiDecision ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
                form.hasAiDecision ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Theory lens */}
          <div className="space-y-1.5">
            <Label>التحليل النظري المقارن (غير مُلزِم — اختياري)</Label>
            <Select value={form.theoryLensId} onValueChange={(v) => upd('theoryLensId', v)}>
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEORY_LENS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">يُضاف كتحليل نظري منفصل لكل قاضٍ — القانون الإماراتي الملزم يسود دائماً</p>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  جارٍ تداول القضية بين القضاة...
                </>
              ) : (
                <>
                  <Gavel className="w-4 h-4 ml-2" />
                  بدء المداولة القضائية
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              إلغاء
            </Button>
          </div>

          {isLoading && (
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              {form.panelSize === '1' ? 'يُحلِّل القاضي المنفرد القضية...' :
               form.panelSize === '3' ? 'يتداول ثلاثة قضاة في آراء مستقلة...' :
               'يتداول خمسة قضاة في آراء مستقلة — قد يستغرق هذا وقتاً أطول...'}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JdcPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast }   = useToast();
  const qc          = useQueryClient();

  const { data, isLoading, isError } = useQuery<JdcChamber[]>({
    queryKey: ['jdc-chambers'],
    queryFn:  () => apiFetch('/api/jdc/chambers').then((r) => r.json()).then((d: { chambers: JdcChamber[] }) => d.chambers),
  });

  const createMutation = useMutation<{ chamber: JdcChamber }, Error, Record<string, unknown>>({
    mutationFn: (body) =>
      apiFetch('/api/jdc/chambers', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['jdc-chambers'] });
      setCreateOpen(false);
      navigate(`/jdc/${res.chamber.id}`);
    },
    onError: (err: Error) => {
      toast({ title: 'فشل إنشاء الدائرة', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id) =>
      apiFetch(`/api/jdc/chambers/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jdc-chambers'] });
      toast({ title: 'تمَّ حذف الدائرة بنجاح' });
    },
  });

  const chambers = data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            غرفة المداولة القضائية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            محاكاة هيئات قضاء إدارية إماراتية — آراء مستقلة لكل قاضٍ • أغلبية • خلاف
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          دائرة جديدة
        </Button>
      </div>

      {/* Panel size explainer */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {([1, 3, 5] as const).map((sz) => {
          const conf  = PANEL_SIZE_CONFIG[sz];
          const count = chambers.filter((c: JdcChamber) => c.panelSize === sz).length;
          return (
            <div key={sz} className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <PanelIcon size={sz} />
                <span className="font-medium text-sm">{conf.labelAr}</span>
                {count > 0 && (
                  <Badge className="text-xs ml-auto">{count}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{conf.description}</p>
            </div>
          );
        })}
      </div>

      {/* List */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive py-8 justify-center">
          <AlertCircle className="w-5 h-5" />
          <span>تعذَّر تحميل الدوائر القضائية</span>
        </div>
      )}

      {!isLoading && !isError && chambers.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Gavel className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-1">لا توجد جلسات مداولة بعد</h3>
          <p className="text-muted-foreground text-sm mb-4">
            أنشئ أولى دوائرك القضائية لبدء محاكاة المداولة
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            إنشاء دائرة أولى
          </Button>
        </div>
      )}

      {!isLoading && !isError && chambers.length > 0 && (
        <div className="space-y-3">
          {chambers.map((c: JdcChamber) => (
            <ChamberCard
              key={c.id}
              chamber={c}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => createMutation.mutate(data as Record<string, unknown>)}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
