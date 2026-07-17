import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Users } from 'lucide-react';
import { COMMUNITY_FEATURES, COMMUNITY_POSTS } from '@/lib/journey-catalog';

// ─── المجتمع المهني (المرفق ١) ─────────────────────────────────────────────────
// مشاركة خبرات، نقاشات مهنية، استشارات، فعاليات وورش، موارد معرفية + آخر المشاركات.

export default function CommunityPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20">
            <Users className="w-7 h-7 text-gold" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-heading">المجتمع المهني</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            نجتمع على هدف واحد: صناعة عدالة ذكية، وحماية المجتمع، وتعزيز الأمن القانوني.
          </p>
        </div>

        {/* Features — ordered per the mockup */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {COMMUNITY_FEATURES.map((f) => (
            <div key={f.id} className="moj-card flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border border-border min-w-[100px]">
              <span className="text-xl" aria-hidden>{f.icon}</span>
              <span className="text-xs font-semibold text-foreground">{f.nameAr}</span>
            </div>
          ))}
        </div>

        {/* Latest posts */}
        <section>
          <h2 className="text-lg font-bold text-heading mb-3 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-gold inline-block" aria-hidden />
            آخر المشاركات
          </h2>
          <div className="space-y-3">
            {COMMUNITY_POSTS.map((post) => (
              <div key={post.id} className="moj-card rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-heading leading-snug">{post.titleAr}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {post.authorAr} · {new Date(post.date).toLocaleDateString('ar-AE')}
                  </p>
                </div>
                <div className="shrink-0 text-[11px] text-muted-foreground flex items-center gap-3">
                  <span>💬 {post.replies}</span>
                  <span>👍 {post.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
          ميزات النشر والتفاعل الكاملة قيد التفعيل التدريجي — المحتوى الحالي عرض تعريفي لتجربة المجتمع المهني.
        </p>

        <p className="text-[10px] text-muted-foreground/60 text-center select-none">
          من في مجتمع مرصد لحفظ الوطن 🇦🇪
        </p>
      </div>
    </AppLayout>
  );
}
