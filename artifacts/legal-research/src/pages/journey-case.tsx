import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-fetch';
import { ArrowRight, AlertCircle, Loader2, Sparkles, Paperclip, X } from 'lucide-react';
import {
  findService, incidentTypesFor, CASE_FORM_FIELDS, type JourneyFormField,
} from '@/lib/journey-catalog';

// ─── إدخال المعطيات التفصيلية (المرفق ١ / الشاشة ٧) ────────────────────────────
// نموذج المعطيات ثم زر «تحليل الواقعة» — ينشئ جلسة SPG ويشغّل التحليل عبر
// المحرك الحالي كما هو (نفس الأتمتة والسرعة)، ثم ينتقل لصفحة النتيجة الذكية.

type FormValues = Record<string, string | boolean>;

export interface JourneyResultMeta {
  pathId:        string;
  categoryId:    string;
  serviceId:     string;
  incidentId:    string;
  incidentNameAr: string;
  serviceNameAr: string;
  categoryNameAr: string;
  incidentLabelAr: string;
  completion:    number;
  riskLevelAr:   'منخفض' | 'متوسط' | 'مرتفع';
  values:        FormValues;
}

export function saveResultMeta(sessionId: number, meta: JourneyResultMeta) {
  try { sessionStorage.setItem(`journey-result-${sessionId}`, JSON.stringify(meta)); } catch { /* ignore */ }
}

export function loadResultMeta(sessionId: number): JourneyResultMeta | null {
  try {
    const raw = sessionStorage.getItem(`journey-result-${sessionId}`);
    return raw ? (JSON.parse(raw) as JourneyResultMeta) : null;
  } catch { return null; }
}

const HIGH_RISK_INCIDENTS = new Set(['fire', 'death', 'drugs', 'domestic', 'assault', 'emergency', 'criminal']);

function computeRisk(incidentId: string, values: FormValues): JourneyResultMeta['riskLevelAr'] {
  if (values.casualties === true) return 'مرتفع';
  if (HIGH_RISK_INCIDENTS.has(incidentId)) return 'متوسط';
  return 'منخفض';
}

function computeCompletion(values: FormValues): number {
  const total = CASE_FORM_FIELDS.length;
  const filled = CASE_FORM_FIELDS.filter((f) => {
    const v = values[f.id];
    if (f.type === 'boolean') return v === true || v === false;
    return typeof v === 'string' && v.trim().length > 0;
  }).length;
  return Math.round((filled / total) * 100);
}

function BooleanField({ field, value, onChange }: {
  field: JourneyFormField;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <span className="text-sm text-foreground">{field.labelAr}</span>
      <div className="flex gap-2">
        {[{ v: true, l: 'نعم' }, { v: false, l: 'لا' }].map(({ v, l }) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              value === v
                ? 'bg-gold text-background border-gold'
                : 'border-border text-muted-foreground hover:border-gold/40'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function JourneyCasePage() {
  const { pathId, categoryId, serviceId, incidentId } =
    useParams<{ pathId: string; categoryId: string; serviceId: string; incidentId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const found = findService(pathId ?? '', categoryId ?? '', serviceId ?? '');
  const [values, setValues] = useState<FormValues>({});
  // مرفقات اختيارية (صور/مستندات) — تُدرج أسماؤها ضمن معطيات التحليل
  const [attachments, setAttachments] = useState<File[]>([]);

  const incident = found ? incidentTypesFor(found.path).find((t) => t.id === incidentId) : undefined;

  // إنشاء جلسة SPG وتشغيل التحليل — نفس نقاط النهاية الحالية بلا أي تعديل خلفي.
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!found || !incident) throw new Error('invalid');
      const { path, category, service } = found;

      const createRes = await apiFetch('/api/spg/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorId:     category.spg.sectorId,
          sectorNameAr: category.spg.sectorNameAr,
          roleId:       category.spg.roleId,
          roleNameAr:   category.spg.roleNameAr,
        }),
      });
      if (!createRes.ok) throw new Error('create failed');
      const { session } = (await createRes.json()) as { session: { id: number } };

      const boolAr = (v: unknown) => (v === true ? 'نعم' : v === false ? 'لا' : 'غير محدد');
      const answers = {
        incident:
          `نوع ${path.incidentLabelAr}: ${incident.nameAr}. ` +
          `التاريخ والوقت: ${values.datetime || 'غير محدد'}. المكان: ${values.location || 'غير محدد'}. ` +
          `الوصف: ${values.description || 'غير محدد'}.`,
        stage:
          `الخدمة: ${service.nameAr} (${service.descAr}) — الفئة المهنية: ${category.nameAr} ضمن مسار ${path.nameAr}.`,
        documents:
          `وجود وفيات أو إصابات: ${boolAr(values.casualties)}. وجود شهود: ${boolAr(values.witnesses)}. ` +
          `وجود كاميرات مراقبة: ${boolAr(values.cameras)}. الجهات المنفذة/الحاضرة: ${values.agencies || 'غير محدد'}. ` +
          `المرفقات: ${attachments.length > 0 ? attachments.map((f) => f.name).join('، ') : 'لا توجد'}.`,
        action:
          `المطلوب: تحليل ${path.incidentLabelAr} وفق أفضل الممارسات والإطار القانوني، وبيان الإجراءات الواجبة والمستندات والمخرجات المطلوبة لخدمة ${service.nameAr}.`,
        risks: `ملاحظات أولية: ${values.notes || 'لا توجد'}.`,
        nextStep: 'بيان الخطوات التالية والأخطاء المحتملة الواجب تجنبها والمخرجات المستندية النهائية.',
      };

      const runRes = await apiFetch(`/api/spg/sessions/${session.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!runRes.ok) throw new Error('run failed');

      saveResultMeta(session.id, {
        pathId: path.id, categoryId: category.id, serviceId: service.id,
        incidentId: incident.id, incidentNameAr: incident.nameAr,
        serviceNameAr: service.nameAr, categoryNameAr: category.nameAr,
        incidentLabelAr: path.incidentLabelAr,
        completion: computeCompletion(values),
        riskLevelAr: computeRisk(incident.id, values),
        values,
      });
      return session.id;
    },
    onSuccess: (sessionId) => navigate(`/journey/result/${sessionId}`),
    onError: () => toast({ title: 'تعذّر بدء التحليل. حاول مجدداً.', variant: 'destructive' }),
  });

  if (!found || !incident) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground" dir="rtl">
          <AlertCircle className="w-10 h-10" />
          <p>المسار غير مكتمل</p>
          <Button variant="outline" onClick={() => navigate('/')}>رجوع</Button>
        </div>
      </AppLayout>
    );
  }

  const { path, category, service } = found;
  const descriptionOk = typeof values.description === 'string' && values.description.trim().length >= 10;
  const canAnalyze = descriptionOk && !analyzeMutation.isPending;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-heading">إدخال المعطيات التفصيلية</h1>
            <p className="text-sm text-muted-foreground mt-1">
              تفاصيل {path.incidentLabelAr}: {incident.nameAr} {incident.icon} — {service.nameAr}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/journey/${path.id}/${category.id}/${service.id}/incident`)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            رجوع <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Form — field order matches the mockup */}
        <div className="moj-card rounded-xl border border-border p-5 space-y-4">
          {CASE_FORM_FIELDS.map((field) => {
            if (field.type === 'boolean') {
              return (
                <BooleanField
                  key={field.id}
                  field={field}
                  value={values[field.id] as boolean | undefined}
                  onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
                />
              );
            }
            const common = {
              id: field.id,
              value: (values[field.id] as string) ?? '',
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setValues((prev) => ({ ...prev, [field.id]: e.target.value })),
              placeholder: field.placeholder,
            };
            return (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id} className="text-sm font-medium">
                  {field.labelAr}
                  {field.required && <span className="text-red-500 mr-1">*</span>}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea {...common} rows={3} />
                ) : (
                  <Input {...common} type={field.type === 'datetime' ? 'datetime-local' : 'text'} />
                )}
              </div>
            );
          })}

          {/* مرفقات اختيارية — صور أو مستندات (البند ٧ من المواصفة المعتمدة) */}
          <div className="space-y-1.5">
            <Label htmlFor="attachments" className="text-sm font-medium">
              إرفاق ملفات أو صور أو مستندات (اختياري)
            </Label>
            <label
              htmlFor="attachments"
              className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 cursor-pointer hover:border-gold/40 transition-colors text-sm text-muted-foreground"
            >
              <Paperclip className="w-4 h-4 text-gold shrink-0" aria-hidden />
              اضغط لاختيار الملفات (صور، PDF، مستندات)
            </label>
            <input
              id="attachments"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length) setAttachments((prev) => [...prev, ...picked]);
                e.target.value = '';
              }}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attachments.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1 text-[11px] bg-muted/30 border border-border rounded-full px-2.5 py-1 text-foreground"
                  >
                    {f.name}
                    <button
                      type="button"
                      aria-label={`إزالة ${f.name}`}
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="hover:text-destructive"
                    >
                      <X className="w-3 h-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/journey/${path.id}/${category.id}/${service.id}/incident`)}
          >
            رجوع
          </Button>
          <Button
            className="gold-hover-glow bg-gold text-background font-bold hover:opacity-90 px-8 gap-2"
            disabled={!canAnalyze}
            onClick={() => analyzeMutation.mutate()}
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> جارٍ بدء التحليل…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" aria-hidden /> تحليل {path.incidentLabelAr}
              </>
            )}
          </Button>
        </div>
        {!descriptionOk && (
          <p className="text-[11px] text-muted-foreground text-center">
            أدخل وصف {path.incidentLabelAr} (10 أحرف على الأقل) لتفعيل التحليل.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
