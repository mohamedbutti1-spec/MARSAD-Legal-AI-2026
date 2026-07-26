import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { findService, type JourneyStageInteractive } from '@/lib/journey-catalog';

// ─── تفصيل الخدمة (المرفق ١ / الشاشة ٥) ────────────────────────────────────────
// مراحل الخدمة مرقّمة (تختلف بحسب السيناريو) مع قائمة فحص لكل مرحلة وأدوات
// مساعدة، ثم «متابعة». بعض المراحل تحمل أيضًا عنصرًا تفاعليًا (JourneyStage.
// interactive) — مثل إخطار النيابة العامة في مرحلة «قبل الانتقال» لسيناريو
// مسرح الجريمة — يُعرض أعلى قائمة الفحص فقط عند وجوده، بلا أي أثر على بقية
// المراحل أو الخدمات التي لا تحمله.

/** عنصر تفاعلي خاص بمرحلة واحدة: أسئلة بخيارات، مع حقول تظهر عند اختيار محدد. */
function StageInteractive({ interactive, stageId }: { interactive: JourneyStageInteractive; stageId: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  return (
    <div className="moj-card rounded-xl border border-gold/30 bg-gold/5 p-5 space-y-5" dir="rtl">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4.5 h-4.5 text-gold mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-bold text-heading">{interactive.titleAr}</p>
          {interactive.noteAr && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{interactive.noteAr}</p>
          )}
        </div>
      </div>

      {interactive.questions.map((q) => {
        const answerKey = `${stageId}:${q.id}`;
        const selected = answers[answerKey];
        const showFields = Boolean(q.revealFieldsOnOption && selected === q.revealFieldsOnOption && q.fields?.length);

        return (
          <div key={q.id} className="space-y-2.5">
            <p className="text-sm font-semibold text-foreground">{q.promptAr}</p>
            <div className="flex flex-col gap-1.5">
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                    selected === opt
                      ? 'border-gold bg-gold/10 text-heading'
                      : 'border-border text-foreground hover:border-gold/40'
                  }`}
                >
                  <input
                    type="radio"
                    name={answerKey}
                    className="accent-gold shrink-0"
                    checked={selected === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [answerKey]: opt }))}
                  />
                  {opt}
                </label>
              ))}
            </div>

            {showFields && (
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {q.fields!.map((f) => {
                  const fieldKey = `${stageId}:${f.id}`;
                  const value = fieldValues[fieldKey] ?? '';
                  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setFieldValues((prev) => ({ ...prev, [fieldKey]: e.target.value }));
                  return (
                    <div key={f.id} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <label htmlFor={fieldKey} className="block text-xs font-medium text-muted-foreground mb-1">
                        {f.labelAr}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          id={fieldKey}
                          rows={2}
                          value={value}
                          onChange={onChange}
                          placeholder={f.placeholder}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
                        />
                      ) : (
                        <input
                          id={fieldKey}
                          type="text"
                          value={value}
                          onChange={onChange}
                          placeholder={f.placeholder}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function JourneyServiceDetailPage() {
  const { pathId, categoryId, serviceId } =
    useParams<{ pathId: string; categoryId: string; serviceId: string }>();
  const [, navigate] = useLocation();
  const found = findService(pathId ?? '', categoryId ?? '', serviceId ?? '');
  const [stageIdx, setStageIdx] = useState(0);

  if (!found) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground" dir="rtl">
          <AlertCircle className="w-10 h-10" />
          <p>الخدمة غير موجودة</p>
          <Button variant="outline" onClick={() => navigate('/')}>رجوع</Button>
        </div>
      </AppLayout>
    );
  }

  const { path, category, service } = found;
  const stage = service.stages[stageIdx];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-heading">
              تفصيل الخدمة: {service.nameAr} {service.icon}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {category.nameAr} — {service.descAr}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/journey/${path.id}/${category.id}`)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            رجوع <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="grid sm:grid-cols-[200px_1fr] gap-4">
          {/* Stage stepper — numbered, ordered */}
          <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible pb-1">
            {service.stages.map((s, idx) => {
              const active = idx === stageIdx;
              const done = idx < stageIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStageIdx(idx)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'border-gold bg-gold/10 text-heading'
                      : done
                        ? 'border-emerald-500/40 bg-emerald-500/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-gold/40'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      active ? 'bg-gold text-background' : done ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  {s.nameAr}
                </button>
              );
            })}
          </div>

          {/* Stage detail: optional interactive block, then checklist */}
          <div className="space-y-4">
            {stage.interactive && (
              <StageInteractive interactive={stage.interactive} stageId={stage.id} />
            )}
            <div className="moj-card rounded-xl border border-border p-5">
              <p className="font-bold text-heading mb-4">{stage.nameAr}</p>
              <ul className="space-y-2.5">
                {stage.checklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Helper tools */}
        <div className="moj-card rounded-xl border border-border p-4">
          <p className="text-xs font-bold text-muted-foreground mb-3">أدوات مساعدة</p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {service.tools.map((tool) => (
              <div key={tool.id} className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg bg-muted/20 min-w-[88px]">
                <span className="text-lg" aria-hidden>{tool.icon}</span>
                <span className="text-[11px] font-medium text-foreground">{tool.nameAr}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/journey/${path.id}/${category.id}`)}
          >
            رجوع
          </Button>
          {stageIdx < service.stages.length - 1 ? (
            <Button
              className="gold-hover-glow bg-gold text-background font-bold hover:opacity-90 px-8"
              onClick={() => setStageIdx(stageIdx + 1)}
            >
              المرحلة التالية
            </Button>
          ) : (
            <Button
              className="gold-hover-glow bg-gold text-background font-bold hover:opacity-90 px-8"
              onClick={() => navigate(`/journey/${path.id}/${category.id}/${service.id}/incident`)}
            >
              متابعة
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
