import React, { useState } from 'react';
import { useParams, useLocation, Redirect } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-fetch';
import {
  ArrowRight, AlertCircle, Loader2, ShieldCheck, Share2, Printer,
  Download, FileText, CheckCircle2, AlertTriangle, BookOpen,
} from 'lucide-react';
import type { SpgSession, SpgGuidanceOutput } from '@/types/spg';
import { loadResultMeta, type JourneyResultMeta } from '@/pages/journey-case';

// ─── النتيجة الذكية (المرفق ١ / الشاشة ٨) ──────────────────────────────────────
// مؤشر اكتمال الإجراءات + مستوى المخاطر + تبويبات (التحليل، الإجراءات المتبعة،
// الأخطاء المحتملة، المستندات والمخرجات) — المحتوى يأتي من محرك SPG الحالي
// كما هو، بلا أي تغيير في الأتمتة أو السرعة.

const TABS = [
  { id: 'analysis',  nameAr: 'التحليل' },
  { id: 'actions',   nameAr: 'الإجراءات المتبعة' },
  { id: 'mistakes',  nameAr: 'الأخطاء المحتملة' },
  { id: 'documents', nameAr: 'المستندات والمخرجات' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const RISK_STYLES: Record<string, string> = {
  'منخفض': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  'متوسط': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'مرتفع': 'bg-red-500/10 text-red-600 border-red-500/30',
};

function CompletionRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          className="stroke-emerald-500 transition-all duration-700"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-heading">
        {value}%
      </span>
    </div>
  );
}

// ─── Output documents (generated from the analysis output) ───────────────────

interface OutputDoc {
  id:      string;
  nameAr:  string;
  format:  string;
  build:   (output: SpgGuidanceOutput, meta: JourneyResultMeta | null) => string;
}

function listBlock(title: string, items: string[]): string {
  if (!items.length) return '';
  return `\n${title}\n${'-'.repeat(title.length)}\n${items.map((i, n) => `${n + 1}. ${i}`).join('\n')}\n`;
}

const OUTPUT_DOCS: OutputDoc[] = [
  {
    id: 'inspection-report', nameAr: 'محضر المعاينة / التقرير التنفيذي', format: 'PDF',
    build: (o, m) =>
      `محضر / تقرير — ${m?.serviceNameAr ?? ''}\nنوع ${m?.incidentLabelAr ?? 'الواقعة'}: ${m?.incidentNameAr ?? ''}\n\nالملخص التنفيذي\n${'-'.repeat(14)}\n${o.summary}\n` +
      listBlock('الإجراءات المطلوبة', o.requiredActions),
  },
  {
    id: 'evidence-report', nameAr: 'تقرير المستندات المطلوبة', format: 'DOCX',
    build: (o) => listBlock('المستندات المطلوبة', o.requiredDocuments) || 'لا توجد مستندات محددة.',
  },
  {
    id: 'legal-recommendations', nameAr: 'توصيات قانونية', format: 'PDF',
    build: (o) =>
      listBlock('المراجع القانونية', o.legalReferences.map((r) => `${r.title} — ${r.reference}${r.binding ? ' (ملزم)' : ' (استرشادي)'}`)) +
      listBlock('تحذيرات عملية', o.practicalWarnings) +
      (o.escalationRecommendation ? `\nتوصية التصعيد\n${'-'.repeat(12)}\n${o.escalationRecommendation}\n` : ''),
  },
  {
    id: 'checklist', nameAr: 'قائمة الخطوات التالية', format: 'PDF',
    build: (o) => listBlock('قائمة الخطوات التالية', o.nextStepChecklist.map((c) => `${c.step}${c.mandatory ? ' (إلزامي)' : ''}`)),
  },
  {
    id: 'mistakes', nameAr: 'الأخطاء الشائعة الواجب تجنبها', format: 'PDF',
    build: (o) => listBlock('الأخطاء الشائعة', o.commonMistakes),
  },
];

function downloadDoc(doc: OutputDoc, output: SpgGuidanceOutput, meta: JourneyResultMeta | null) {
  const content = `${doc.nameAr}\n${'='.repeat(doc.nameAr.length)}\n${doc.build(output, meta)}\n\n— أُنشئ عبر منصة مرصد — ${new Date().toLocaleDateString('ar-AE')}\n${output.disclaimer ?? ''}`;
  const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.nameAr}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JourneyResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>('analysis');
  const id = parseInt(sessionId ?? '0', 10);
  const meta = loadResultMeta(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['journey-result', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/spg/sessions/${id}`);
      if (!res.ok) throw new Error('not found');
      return res.json() as Promise<{ session: SpgSession }>;
    },
    enabled: !!id && !!meta,
    // استمر بالاستطلاع حتى اكتمال التحليل الخلفي — نفس آلية SPG الحالية
    refetchInterval: (query) =>
      query.state.data?.session.status === 'analyzing' || query.state.data?.session.status === 'draft'
        ? 2500
        : false,
  });

  const session = data?.session;
  const output = session?.output ?? null;

  // الشاشة ٨ لا تُفتح مباشرة أبداً: بدون سياق رحلة جارية (يُخزَّن عند الشاشة ٧)
  // يعاد التوجيه إلى الصفحة الرئيسية العامة (الشاشة ٢).
  if (!meta || !id) {
    return <Redirect to="/" />;
  }

  const handleShare = async () => {
    const text = output ? `النتيجة الذكية — ${meta?.serviceNameAr ?? 'مرصد'}\n\n${output.summary}` : '';
    try {
      if (navigator.share) await navigator.share({ title: 'النتيجة الذكية — مرصد', text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'تم نسخ الملخص إلى الحافظة' });
      }
    } catch { /* user cancelled */ }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !session) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground" dir="rtl">
          <AlertCircle className="w-10 h-10" />
          <p>لم يتم العثور على نتيجة التحليل</p>
          <Button variant="outline" onClick={() => navigate('/')}>الصفحة الرئيسية</Button>
        </div>
      </AppLayout>
    );
  }

  // ── جارٍ التحليل ──
  if (session.status === 'analyzing' || session.status === 'draft') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground" dir="rtl">
          <Loader2 className="w-10 h-10 animate-spin text-gold" />
          <p className="font-semibold text-foreground">جارٍ تحليل {meta?.incidentLabelAr ?? 'الواقعة'} بالذكاء الاصطناعي…</p>
          <p className="text-xs">تُحدَّث هذه الصفحة تلقائياً فور اكتمال التحليل</p>
        </div>
      </AppLayout>
    );
  }

  if (session.status === 'error' || !output) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground" dir="rtl">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p>تعذّر إكمال التحليل — حاول مجدداً</p>
          <Button variant="outline" onClick={() => navigate(meta ? `/journey/${meta.pathId}/${meta.categoryId}` : '/')}>رجوع</Button>
        </div>
      </AppLayout>
    );
  }

  const completion = meta?.completion ?? 100;
  const risk = meta?.riskLevelAr ?? 'منخفض';

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 print:py-2" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-xl sm:text-2xl font-bold text-heading">النتيجة الذكية</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            الصفحة الرئيسية <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Completion + risk row */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="moj-card rounded-xl border border-border p-4 flex items-center gap-4">
            <CompletionRing value={completion} />
            <div>
              <p className="text-sm font-bold text-heading">مؤشر اكتمال الإجراءات</p>
              <p className="text-xs text-muted-foreground mt-1">
                {meta ? `${meta.serviceNameAr} — ${meta.incidentNameAr}` : session.title}
              </p>
            </div>
          </div>
          <div className="moj-card rounded-xl border border-border p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-heading">مستوى المخاطر</p>
              <p className="text-xs text-muted-foreground mt-1">تقدير أولي وفق المعطيات المدخلة</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold ${RISK_STYLES[risk]}`}>
              <ShieldCheck className="w-4 h-4" aria-hidden /> {risk}
            </span>
          </div>
        </div>

        {/* Tabs — order matches the mockup */}
        <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap border transition-all ${
                tab === t.id
                  ? 'bg-gold text-background border-gold'
                  : 'border-border text-muted-foreground hover:border-gold/40'
              }`}
            >
              {t.nameAr}
            </button>
          ))}
        </div>

        {/* ── التحليل ── */}
        {tab === 'analysis' && (
          <div className="space-y-4">
            <div className="moj-card rounded-xl border border-border p-5">
              <p className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gold" aria-hidden /> التحليل وفق أفضل الممارسات والإطار القانوني
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{output.summary}</p>
            </div>
            {output.legalReferences.length > 0 && (
              <div className="moj-card rounded-xl border border-border p-5">
                <p className="text-sm font-bold text-heading mb-3">المراجع القانونية</p>
                <ul className="space-y-2">
                  {output.legalReferences.map((r, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-gold mt-0.5" aria-hidden>§</span>
                      <span>
                        <span className="font-semibold">{r.title}</span> — {r.reference}{' '}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.binding ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                          {r.binding ? 'ملزم' : 'استرشادي'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {output.escalationRecommendation && (
              <div className="moj-card rounded-xl border border-amber-500/30 p-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" aria-hidden />
                <p className="text-sm text-foreground leading-relaxed">{output.escalationRecommendation}</p>
              </div>
            )}
          </div>
        )}

        {/* ── الإجراءات المتبعة ── */}
        {tab === 'actions' && (
          <div className="space-y-4">
            <div className="moj-card rounded-xl border border-border p-5">
              <p className="text-sm font-bold text-heading mb-3">الإجراءات المطلوبة</p>
              <ol className="space-y-2.5">
                {output.requiredActions.map((a, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2.5 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-gold/15 text-gold text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
            {output.nextStepChecklist.length > 0 && (
              <div className="moj-card rounded-xl border border-border p-5">
                <p className="text-sm font-bold text-heading mb-3">قائمة الخطوات التالية</p>
                <ul className="space-y-2">
                  {output.nextStepChecklist.map((c, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden />
                      <span>
                        {c.step}{' '}
                        {c.mandatory && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">إلزامي</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── الأخطاء المحتملة ── */}
        {tab === 'mistakes' && (
          <div className="space-y-4">
            {output.commonMistakes.length > 0 && (
              <div className="moj-card rounded-xl border border-border p-5">
                <p className="text-sm font-bold text-heading mb-3">الأخطاء الشائعة الواجب تجنبها</p>
                <ul className="space-y-2.5">
                  {output.commonMistakes.map((m, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2.5 leading-relaxed">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" aria-hidden />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {output.practicalWarnings.length > 0 && (
              <div className="moj-card rounded-xl border border-red-500/25 p-5">
                <p className="text-sm font-bold text-heading mb-3">تحذيرات عملية</p>
                <ul className="space-y-2.5">
                  {output.practicalWarnings.map((w, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2.5 leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── المستندات والمخرجات ── */}
        {tab === 'documents' && (
          <div className="space-y-4">
            {output.requiredDocuments.length > 0 && (
              <div className="moj-card rounded-xl border border-border p-5">
                <p className="text-sm font-bold text-heading mb-3">المستندات المطلوبة</p>
                <ul className="space-y-2">
                  {output.requiredDocuments.map((d, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-gold mt-0.5 shrink-0" aria-hidden />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="moj-card rounded-xl border border-border p-5">
              <p className="text-sm font-bold text-heading mb-3">المخرجات القابلة للتنزيل</p>
              <div className="space-y-2">
                {OUTPUT_DOCS.map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-border/60 p-3 flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gold shrink-0" aria-hidden />
                    <span className="text-sm font-semibold text-foreground flex-1">{doc.nameAr}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{doc.format}</span>
                    <button
                      type="button"
                      onClick={() => downloadDoc(doc, output, meta)}
                      className="inline-flex items-center gap-1 text-xs text-gold font-bold hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden /> تحميل
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        {output.disclaimer && (
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{output.disclaimer}</p>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
          <Button variant="outline" className="gap-2" onClick={handleShare}>
            <Share2 className="w-4 h-4" aria-hidden /> مشاركة
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" aria-hidden /> طباعة
          </Button>
          <Button
            className="gold-hover-glow bg-gold text-background font-bold hover:opacity-90 gap-2"
            onClick={() => navigate(meta ? `/journey/${meta.pathId}/${meta.categoryId}` : '/')}
          >
            خدمة جديدة
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
