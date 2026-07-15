import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { ArrowRight, Check, GraduationCap, Lightbulb, Megaphone, RefreshCw, Send } from 'lucide-react';
import { useUserContext } from '@/lib/user-context';
import {
  PERSONA_CATEGORIES,
  getPersonaCategory,
  getPersonaGreeting,
  getStoredPersona,
  setStoredPersona,
  stageAssistantPrompt,
  type PersonaCategory,
  type StoredPersona,
} from '@/lib/marsad-personas';

// ─── المرحلة الثانية — اختيار الفئة + الترحيب الذكي + الحزم المهنية ────────────
// The persona is a presentation preference layered over the JWT/RBAC role:
// it tailors the greeting, the visible service package, and the assistant's
// smart-question placeholder. Permissions are still enforced by RouteGuard
// and the backend exactly as before.

export default function PersonaSelect() {
  const [, navigate] = useLocation();
  const { canUseAi } = useUserContext();
  const [persona, setPersona] = useState<StoredPersona | null>(() => getStoredPersona());
  const [choosing, setChoosing] = useState<boolean>(() => getStoredPersona() === null);
  /** Category tapped but sub-role not confirmed yet. */
  const [pendingCategory, setPendingCategory] = useState<PersonaCategory | null>(null);
  const [question, setQuestion] = useState('');

  const category = getPersonaCategory(persona?.categoryId);
  const greeting = getPersonaGreeting(persona);

  const confirmSubRole = (cat: PersonaCategory, subRoleId: string) => {
    const next: StoredPersona = { categoryId: cat.id, subRoleId };
    setStoredPersona(next);
    setPersona(next);
    setPendingCategory(null);
    setChoosing(false);
  };

  const askQuestion = () => {
    const q = question.trim();
    if (!q) return;
    stageAssistantPrompt(q);
    navigate('/assistant');
  };

  // ── Step 1 — category cards ─────────────────────────────────────────────────
  if (choosing || !persona || !category) {
    return (
      <AppLayout>
        <div dir="rtl">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-heading mb-2" style={{ fontFamily: 'var(--app-font-serif)' }}>
              مرحباً بك في مرصد
            </h1>
            <p className="text-sm text-muted-foreground">
              اختر مسارك المهني لبدء تجربتك — تُخصَّص الأدوات والحزم المهنية تلقائياً حسب فئتك
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERSONA_CATEGORIES.map((cat) => {
              const isPending = pendingCategory?.id === cat.id;
              return (
                <div
                  key={cat.id}
                  className={`moj-card rounded-xl p-5 transition-all ${
                    isPending ? 'border-gold/60 ring-1 ring-gold/40' : 'hover:border-gold/40'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-start"
                    onClick={() => setPendingCategory(isPending ? null : cat)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center text-xl shrink-0">
                        <span aria-hidden>{cat.emoji}</span>
                      </div>
                      <h2 className="text-sm font-bold text-heading leading-snug">{cat.ar}</h2>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{cat.descAr}</p>
                  </button>

                  {/* Sub-role picker — revealed on tap */}
                  {isPending && (
                    <div className="mt-4 pt-3 border-t border-border/60">
                      <p className="text-[10px] font-bold text-gold/80 mb-2">اختر فئتك التفصيلية</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.subRoles.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => confirmSubRole(cat, sub.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-border bg-background/60 text-[11px] font-semibold text-foreground hover:border-gold/50 hover:bg-gold/10 transition-colors"
                          >
                            {sub.ar}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Step 2 — smart greeting + professional package ─────────────────────────
  const subRole = category.subRoles.find((s) => s.id === persona.subRoleId);

  return (
    <AppLayout>
      <div dir="rtl">
        {/* الترحيب الذكي */}
        <div className="moj-card rounded-xl px-6 py-8 text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/25 flex items-center justify-center text-2xl mx-auto mb-3">
            <span aria-hidden>{category.emoji}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading mb-2" style={{ fontFamily: 'var(--app-font-serif)' }}>
            {greeting}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            بما أنكم ضمن فئة ({subRole ? `${category.ar} — ${subRole.ar}` : category.ar}) فقد قمنا
            بتخصيص الأدوات والحزم المهنية والخدمات المناسبة لكم.
          </p>
          <button
            type="button"
            onClick={() => { setChoosing(true); setPendingCategory(null); }}
            className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-semibold text-gold/80 hover:text-gold transition-colors"
          >
            <RefreshCw className="w-3 h-3" aria-hidden />
            تغيير الفئة
          </button>
        </div>

        {/* الحزمة المهنية المتخصصة */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-gold" aria-hidden />
            الحزمة المهنية المتخصصة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {category.services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => {
                  if (svc.prompt) stageAssistantPrompt(svc.prompt);
                  navigate(svc.href.replace(/^\//, '/'));
                }}
                className="moj-card rounded-xl p-4 text-start hover:border-gold/40 transition-all group"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="text-lg" aria-hidden>{svc.emoji}</span>
                  <span className="text-[13px] font-bold text-heading group-hover:text-gold transition-colors">
                    {svc.ar}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 ms-auto rotate-180 group-hover:text-gold transition-colors" aria-hidden />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{svc.descAr}</p>
              </button>
            ))}
          </div>
        </div>

        {/* مربع السؤال الذكي */}
        {canUseAi && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-gold" aria-hidden />
              السؤال الذكي
            </h2>
            <div className="relative bg-card border-2 border-gold/25 rounded-2xl focus-within:border-gold/50 transition-colors">
              <textarea
                rows={3}
                dir="rtl"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); }
                }}
                placeholder={category.questionPlaceholderAr}
                className="w-full resize-none rounded-2xl bg-transparent px-4 py-4 pe-14 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none leading-relaxed"
              />
              <button
                type="button"
                onClick={askQuestion}
                disabled={!question.trim()}
                aria-label="إرسال السؤال"
                className="absolute bottom-3 start-3 h-9 w-9 rounded-xl bg-gold text-background flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <Send className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {/* مسارات إضافية */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => navigate('/academy')}
            className="moj-card rounded-xl p-4 text-start hover:border-gold/40 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-gold" aria-hidden />
              <span className="text-[13px] font-bold text-heading group-hover:text-gold transition-colors">أكاديمية مرصد للمحاكاة المهنية</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">تدريب تفاعلي خطوة بخطوة على المواقف المهنية الحقيقية</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/scenarios')}
            className="moj-card rounded-xl p-4 text-start hover:border-gold/40 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-4 h-4 text-gold" aria-hidden />
              <span className="text-[13px] font-bold text-heading group-hover:text-gold transition-colors">محرك السيناريوهات</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">ماذا لو؟ غرفة الأزمات، إدارة المخاطر، وتوقع النتائج القانونية</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/nafe')}
            className="moj-card rounded-xl p-4 text-start hover:border-gold/40 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-gold" aria-hidden />
              <span className="text-[13px] font-bold text-heading group-hover:text-gold transition-colors">خدمة نافع</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">المنصة الوطنية للتوعية والتحذير من الجرائم والأساليب الحديثة</p>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
