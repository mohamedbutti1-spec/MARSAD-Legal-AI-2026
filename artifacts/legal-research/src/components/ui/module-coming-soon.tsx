import React from 'react';
import { Construction } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';

interface ModuleComingSoonProps {
  iconAr?: string;
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  featureListAr?: string[];
  featureListEn?: string[];
}

export function ModuleComingSoon({
  icon,
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  featureListAr = [],
  featureListEn = [],
}: ModuleComingSoonProps) {
  const { lang } = useUserContext();
  const isAr = lang === 'ar';

  return (
    <AppLayout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        {/* Status badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold mb-8">
          <Construction className="w-3.5 h-3.5" />
          {isAr ? 'قيد الإنشاء' : 'Under Development'}
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-primary/8 border-2 border-primary/15 flex items-center justify-center text-primary mb-6">
          <div className="w-10 h-10 [&>svg]:w-10 [&>svg]:h-10">{icon}</div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {isAr ? titleAr : titleEn}
        </h1>
        {isAr && (
          <p className="text-sm text-muted-foreground mb-2 font-medium">{titleEn}</p>
        )}

        {/* Description */}
        <p className="text-base text-muted-foreground max-w-lg leading-relaxed mb-8">
          {isAr ? descriptionAr : descriptionEn}
        </p>

        {/* Feature list */}
        {(isAr ? featureListAr : featureListEn).length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-sm text-start">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {isAr ? 'الميزات القادمة' : 'Coming Features'}
            </p>
            <ul className="space-y-2.5">
              {(isAr ? featureListAr : featureListEn).map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="text-gold mt-0.5 shrink-0">◆</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gold decorative bar */}
        <div className="mt-10 w-24 h-1 gold-bar rounded-full opacity-60" />
      </div>
    </AppLayout>
  );
}
