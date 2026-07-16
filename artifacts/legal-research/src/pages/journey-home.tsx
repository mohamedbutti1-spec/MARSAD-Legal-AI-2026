import React from 'react';
import { Link, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { Lock, ChevronLeft, Bell, Users, ShieldCheck } from 'lucide-react';
import {
  JOURNEY_PATHS, NEW_IN_MARSAD, MARSAD_SERVICES,
  NAFE_ALERTS, COMMUNITY_FEATURES, COMMUNITY_POSTS, SHAMSI_PILLARS,
} from '@/lib/journey-catalog';

// ─── الصفحة الرئيسية — مرحباً بك في مرصد (المرفق ١ / الشاشة ٢) ────────────────
// ترتيب المسارات والعناصر هنا يطابق ترتيب المرفق حرفياً — لا تعد ترتيبها.

function PathTile({ icon, nameAr, href }: { icon: string; nameAr: string; href: string }) {
  return (
    <Link href={href}>
      <div className="moj-card rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer border border-border hover:border-gold/50 hover:shadow-lg transition-all min-h-[110px] group">
        <span className="text-3xl group-hover:scale-110 transition-transform" aria-hidden>{icon}</span>
        <span className="text-sm font-bold text-heading leading-snug">{nameAr}</span>
      </div>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg sm:text-xl font-bold text-heading flex items-center gap-2 mb-4">
      <span className="w-1.5 h-6 rounded-full bg-gold inline-block" aria-hidden />
      {children}
    </h2>
  );
}

export default function JourneyHome() {
  const { canUseShamsiFramework } = useUserContext();
  const [, navigate] = useLocation();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10" dir="rtl">

        {/* ── Hero ── */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            مرحباً بك في مرصد
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium">
            اختر مسارك المهني لبدء تجربتك
          </p>
        </div>

        {/* ── المسارات المهنية (بترتيب المرفق) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {JOURNEY_PATHS.map((p) => (
            <PathTile key={p.id} icon={p.icon} nameAr={p.nameAr} href={`/journey/${p.id}`} />
          ))}
          {/* خدمات مرصد — البلاطة الثامنة */}
          <PathTile icon="🧰" nameAr="خدمات مرصد" href="/journey-services" />
        </div>

        {/* ── جديد في مرصد ── */}
        <div className="moj-card rounded-xl p-4 sm:p-5 border border-gold/20">
          <p className="text-xs font-bold text-gold mb-3 text-center">جديد في مرصد</p>
          <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
            {NEW_IN_MARSAD.map((item) => (
              <Link key={item.id} href={item.href}>
                <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gold/10 cursor-pointer transition-colors min-w-[92px]">
                  <span className="text-xl" aria-hidden>{item.icon}</span>
                  <span className="text-[11px] font-medium text-foreground text-center leading-tight">{item.nameAr}</span>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-3 select-none">
            من في مجتمع مرصد لحفظ الوطن
          </p>
        </div>

        {/* ── نظرية الشامسي — الميزان الأساسي في القرارات الذكية ── */}
        <section>
          <SectionTitle>نظرية الشامسي — الميزان الأساسي في القرارات الذكية</SectionTitle>
          <div className="moj-card rounded-xl border border-border p-5 sm:p-6 relative overflow-hidden">
            {!canUseShamsiFramework && (
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold text-red-500/90 bg-red-500/10 px-2 py-1 rounded-full">
                <Lock className="w-3 h-3" /> لا يظهر إلا للمصرح لهم
              </span>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-3xl">
              نظرية الشامسي — الميزان العلمي الذي يُقيّم مدى مشروعية القرار الإداري الرقمي الذكي وفق سبعة
              أركان أساسية لضمان العدالة التقنية والشفافية والمساءلة القانونية.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {SHAMSI_PILLARS.map((pillar) => (
                <div key={pillar.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 flex flex-col items-center gap-1.5 text-center">
                  <span className="text-lg" aria-hidden>{pillar.icon}</span>
                  <span className="text-[11px] font-semibold text-foreground leading-tight">{pillar.nameAr}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-center">
              {canUseShamsiFramework ? (
                <button
                  type="button"
                  onClick={() => navigate('/shamsi-theory')}
                  className="gold-hover-glow inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-background text-sm font-bold hover:opacity-90 transition-all"
                >
                  فتح النظرية الكاملة <ChevronLeft className="w-4 h-4" aria-hidden />
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground select-none">
                  <Lock className="w-4 h-4" /> دخول مخوّل
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 text-center mt-4">
              تطبيق النظرية على القرارات الذكية لضمان الموازنة بين الكفاءة التقنية والعدالة القانونية.
            </p>
          </div>
        </section>

        {/* ── خدمة نافع — التوعية والتحذير من الجرم الحديث ── */}
        <section>
          <SectionTitle>
            <Bell className="w-5 h-5 text-gold" aria-hidden />
            خدمة نافع — التوعية والتحذير من الجرم الحديث
          </SectionTitle>
          <div className="grid sm:grid-cols-3 gap-3">
            {NAFE_ALERTS.slice(0, 3).map((alert) => (
              <div key={alert.id} className="moj-card rounded-xl border border-border p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-gold">{alert.sourceAr}</span>
                  <span dir="ltr">{new Date(alert.date).toLocaleDateString('ar-AE')}</span>
                </div>
                <p className="text-sm font-bold text-heading leading-snug flex-1">{alert.titleAr}</p>
                <Link href="/nafe">
                  <span className="text-xs text-gold font-semibold cursor-pointer hover:underline">اقرأ المزيد</span>
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <Link href="/nafe">
              <span className="gold-hover-glow inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-background text-sm font-bold cursor-pointer hover:opacity-90 transition-all">
                <ShieldCheck className="w-4 h-4" aria-hidden /> أبلغ عن حالة مشبوهة
              </span>
            </Link>
          </div>
        </section>

        {/* ── المجتمع المهني ── */}
        <section>
          <SectionTitle>
            <Users className="w-5 h-5 text-gold" aria-hidden />
            المجتمع المهني
          </SectionTitle>
          <div className="moj-card rounded-xl border border-border p-5">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-5">
              {COMMUNITY_FEATURES.map((f) => (
                <div key={f.id} className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg bg-muted/20 min-w-[88px]">
                  <span className="text-lg" aria-hidden>{f.icon}</span>
                  <span className="text-[11px] font-medium text-foreground">{f.nameAr}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-muted-foreground mb-3">آخر المشاركات</p>
            <div className="space-y-2">
              {COMMUNITY_POSTS.slice(0, 2).map((post) => (
                <div key={post.id} className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{post.titleAr}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
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
            <div className="mt-4 text-center">
              <Link href="/community">
                <span className="text-sm text-gold font-bold cursor-pointer hover:underline">عرض المزيد من المشاركات</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── من في مجتمع مرصد لحفظ الوطن ── */}
        <section className="moj-card rounded-xl border border-gold/25 p-6 text-center space-y-2">
          <p className="text-lg font-bold text-heading" style={{ fontFamily: 'var(--app-font-serif)' }}>
            من في مجتمع مرصد لحفظ الوطن 🇦🇪
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            نجتمع على هدف واحد: صناعة عدالة ذكية، وحماية المجتمع، وتعزيز الأمن القانوني.
          </p>
        </section>

      </div>
    </AppLayout>
  );
}

// ─── خدمات مرصد — صفحة روابط الوحدات القائمة ─────────────────────────────────

export function MarsadServicesPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-heading">خدمات مرصد</h1>
          <p className="text-sm text-muted-foreground">وحدات المنصة الأساسية — كما هي، بكامل أتمتتها</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {MARSAD_SERVICES.map((s) => (
            <Link key={s.id} href={s.href}>
              <div className="moj-card rounded-xl border border-border p-5 flex items-center gap-4 cursor-pointer hover:border-gold/50 hover:shadow-lg transition-all">
                <span className="text-3xl" aria-hidden>{s.icon}</span>
                <div className="min-w-0">
                  <p className="font-bold text-heading">{s.nameAr}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.descAr}</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground mr-auto shrink-0" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
