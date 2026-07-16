import React from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertCircle, ChevronLeft, ShieldCheck } from 'lucide-react';
import { findCategory } from '@/lib/journey-catalog';

// ─── مسار الخدمة التشعبي (المرفق ١ / الشاشة ٤) ─────────────────────────────────
// قائمة الخدمات المرتبطة بالفئة المختارة، مرقّمة وبنفس ترتيب المرفق،
// مع شريط «خدمة نافع» في الأسفل.

export default function JourneyServicesPage() {
  const { pathId, categoryId } = useParams<{ pathId: string; categoryId: string }>();
  const [, navigate] = useLocation();
  const found = findCategory(pathId ?? '', categoryId ?? '');

  if (!found) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground" dir="rtl">
          <AlertCircle className="w-10 h-10" />
          <p>الفئة غير موجودة</p>
          <Button variant="outline" onClick={() => navigate('/')}>رجوع</Button>
        </div>
      </AppLayout>
    );
  }

  const { path, category } = found;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-heading">مسار الخدمة التشعبي</h1>
            <p className="text-sm text-muted-foreground mt-1">
              اختر الخدمة التي تحتاجها — {category.nameAr} {category.icon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/journey/${path.id}`)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            رجوع <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Numbered branching list — order comes from the catalogue */}
        <div className="relative space-y-3">
          {/* vertical connector */}
          <span className="absolute top-4 bottom-4 right-[18px] w-px bg-gold/30 hidden sm:block" aria-hidden />
          {category.services.map((s, idx) => (
            <div key={s.id} className="relative flex items-stretch gap-3">
              <div className="hidden sm:flex flex-col items-center justify-center shrink-0 w-9">
                <span className="w-7 h-7 rounded-full bg-gold/15 border border-gold/40 text-gold text-xs font-bold flex items-center justify-center z-10">
                  {idx + 1}
                </span>
              </div>
              <Link href={s.href ?? `/journey/${path.id}/${category.id}/${s.id}`} className="flex-1">
                <div className="moj-card rounded-xl border border-border p-4 flex items-center gap-3 cursor-pointer hover:border-gold/50 hover:shadow-lg transition-all">
                  <span className="text-2xl shrink-0" aria-hidden>{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-heading text-sm sm:text-base">{s.nameAr}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.descAr}</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* خدمة نافع strip */}
        <Link href="/nafe">
          <div className="moj-card rounded-xl border border-gold/30 p-4 flex items-center gap-3 cursor-pointer hover:shadow-lg transition-all">
            <ShieldCheck className="w-5 h-5 text-gold shrink-0" aria-hidden />
            <p className="text-sm font-bold text-heading flex-1">
              خدمة نافع — التوعية والتحذير من الجرم الحديث
            </p>
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
          </div>
        </Link>
      </div>
    </AppLayout>
  );
}
