import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, AlertCircle, Search } from 'lucide-react';
import { findService, incidentTypesFor } from '@/lib/journey-catalog';

// ─── تحديد نوع الواقعة (المرفق ١ / الشاشة ٦) ───────────────────────────────────
// شبكة أنواع الوقائع بترتيب المرفق مع بحث نصي، ثم «متابعة» إلى إدخال المعطيات.

export default function JourneyIncidentPage() {
  const { pathId, categoryId, serviceId } =
    useParams<{ pathId: string; categoryId: string; serviceId: string }>();
  const [, navigate] = useLocation();
  const found = findService(pathId ?? '', categoryId ?? '', serviceId ?? '');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const types = incidentTypesFor(path);
  const filtered = query.trim()
    ? types.filter((t) => t.nameAr.includes(query.trim()))
    : types;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-heading">
              تحديد نوع {path.incidentLabelAr}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {service.nameAr} — اختر نوع {path.incidentLabelAr}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/journey/${path.id}/${category.id}/${service.id}`)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            رجوع <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`ابحث عن نوع ${path.incidentLabelAr}…`}
            className="pr-9"
          />
        </div>

        {/* Types grid — ordered as in the catalogue */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {filtered.map((t) => {
            const active = t.id === selectedId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`moj-card rounded-xl p-4 flex flex-col items-center gap-2 text-center border transition-all min-h-[96px] ${
                  active
                    ? 'border-gold shadow-lg ring-1 ring-gold/40'
                    : 'border-border hover:border-gold/40'
                }`}
              >
                <span className="text-2xl" aria-hidden>{t.icon}</span>
                <span className="text-sm font-bold text-heading leading-snug">{t.nameAr}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-8">
              لا توجد نتائج مطابقة
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => navigate(`/journey/${path.id}/${category.id}/${service.id}`)}>
            رجوع
          </Button>
          <Button
            className="gold-hover-glow bg-gold text-background font-bold hover:opacity-90 px-8"
            disabled={!selectedId}
            onClick={() =>
              navigate(`/journey/${path.id}/${category.id}/${service.id}/incident/${selectedId}`)
            }
          >
            متابعة
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
