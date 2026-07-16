import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { findPath } from '@/lib/journey-catalog';
import { PathIcon } from '@/components/icons/prosecution-emblem';

// ─── اختيار الفئة التفصيلية (المرفق ١ / الشاشة ٣) ─────────────────────────────
// بعد اختيار المسار المهني يختار المستخدم فئته التفصيلية، وتظهر رسالة ترحيب
// مخصصة للفئة قبل «متابعة» إلى مسار الخدمة التشعبي.

export default function JourneyCategoryPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const [, navigate] = useLocation();
  const path = findPath(pathId ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!path) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground" dir="rtl">
          <AlertCircle className="w-10 h-10" />
          <p>المسار غير موجود</p>
          <Button variant="outline" onClick={() => navigate('/')}>رجوع</Button>
        </div>
      </AppLayout>
    );
  }

  const selected = path.categories.find((c) => c.id === selectedId) ?? null;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-heading flex items-center gap-2">
              اختيار الفئة: {path.nameAr}
              <PathIcon path={path} className="w-8 h-8 text-gold inline-block" />
            </h1>
            <p className="text-sm text-muted-foreground mt-1">اختر فئتك التفصيلية</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            رجوع <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Category grid — ordered exactly as in the catalogue */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {path.categories.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`moj-card rounded-xl p-4 flex flex-col items-center gap-2 text-center border transition-all min-h-[104px] ${
                  active
                    ? 'border-gold shadow-lg ring-1 ring-gold/40'
                    : 'border-border hover:border-gold/40'
                }`}
              >
                <span className="text-2xl" aria-hidden>{c.icon}</span>
                <span className="text-sm font-bold text-heading leading-snug">{c.nameAr}</span>
              </button>
            );
          })}
        </div>

        {/* Welcome card + متابعة */}
        {selected && (
          <div className="moj-card rounded-xl border border-gold/25 p-5 sm:p-6 space-y-4">
            <p className="text-sm sm:text-base text-foreground leading-relaxed text-center font-medium">
              {selected.welcomeAr}
            </p>
            <div className="flex justify-center">
              <Button
                className="gold-hover-glow bg-gold text-background font-bold hover:opacity-90 px-8"
                onClick={() => navigate(`/journey/${path.id}/${selected.id}`)}
              >
                متابعة
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
