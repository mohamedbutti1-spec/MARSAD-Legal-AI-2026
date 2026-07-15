import React, { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Megaphone, PlusCircle, ShieldAlert, X } from 'lucide-react';
import { useUserContext } from '@/lib/user-context';

// ─── نافع — المنصة الوطنية للتوعية والتحذير ────────────────────────────────────
// Standalone awareness service per the V2 workflow spec: categorized public
// warnings sourced from ministries / government bodies / security agencies /
// official news. Government-role users (governance roles + owner) can publish
// advisories; in this phase publications are stored client-side
// (localStorage) as the editorial pipeline backend is a later stage —
// clearly labeled as such for reviewers.

interface NafeSection {
  id: string;
  ar: string;
  emoji: string;
}

const NAFE_SECTIONS: NafeSection[] = [
  { id: 'financial_fraud',  ar: 'الاحتيال المالي',            emoji: '💰' },
  { id: 'cyber_fraud',      ar: 'الاحتيال الإلكتروني',        emoji: '💻' },
  { id: 'extortion',        ar: 'الابتزاز',                   emoji: '🕸️' },
  { id: 'account_theft',    ar: 'سرقة الحسابات',              emoji: '🔓' },
  { id: 'banking_fraud',    ar: 'الاحتيال البنكي',            emoji: '🏦' },
  { id: 'child_crimes',     ar: 'الجرائم الواقعة على الأطفال', emoji: '🧒' },
  { id: 'elderly_crimes',   ar: 'الجرائم الواقعة على كبار السن', emoji: '👴' },
  { id: 'property_crimes',  ar: 'الجرائم الواقعة على الأموال', emoji: '💼' },
  { id: 'bodily_crimes',    ar: 'الجرائم الواقعة على البدن',   emoji: '🩹' },
  { id: 'home_safety',      ar: 'السلامة المنزلية',           emoji: '🏠' },
  { id: 'fires',            ar: 'الحرائق',                    emoji: '🔥' },
  { id: 'digital_attacks',  ar: 'الهجمات الرقمية',            emoji: '🛡️' },
];

const NAFE_SOURCES = ['الوزارات', 'الهيئات الحكومية', 'الجهات الأمنية', 'الأخبار الرسمية', 'الصحف المعتمدة'];

interface NafeAdvisory {
  id: string;
  sectionId: string;
  title: string;
  body: string;
  source: string;
  date: string;
  /** True for the built-in illustrative samples. */
  sample?: boolean;
}

// Illustrative seed advisories — clearly labeled samples until the
// government editorial pipeline is connected.
const SAMPLE_ADVISORIES: NafeAdvisory[] = [
  {
    id: 'sample-1',
    sectionId: 'cyber_fraud',
    title: 'تنبيه: أسلوب جديد لسرقة البيانات عبر رموز QR مزيفة',
    body: 'رُصد تداول ملصقات تحمل رموز QR مزيفة توهم الضحية بأنها بوابات دفع رسمية. لا تمسح أي رمز غير موثوق المصدر، وتحقق دائماً من عنوان الموقع قبل إدخال أي بيانات.',
    source: 'الجهات الأمنية',
    date: '2026-05-14',
    sample: true,
  },
  {
    id: 'sample-2',
    sectionId: 'extortion',
    title: 'ارتفاع حالات الابتزاز الإلكتروني باستخدام صور ومقاطع مولدة',
    body: 'تلجأ عصابات إلى تركيب صور ومقاطع مولّدة بالذكاء الاصطناعي لابتزاز الضحايا. لا تستجب للمبتز ولا تحوّل أي مبالغ، واحتفظ بالأدلة وبادر بالإبلاغ فوراً عبر القنوات الرسمية.',
    source: 'وزارة الداخلية',
    date: '2026-05-13',
    sample: true,
  },
  {
    id: 'sample-3',
    sectionId: 'financial_fraud',
    title: 'تحذير من عمليات الاحتيال عبر تطبيقات استثمار زائفة',
    body: 'تنتحل تطبيقات زائفة صفة شركات استثمار مرخصة وتعد بأرباح سريعة. تحقق من ترخيص أي جهة استثمارية لدى الجهات الرقابية قبل تحويل الأموال.',
    source: 'الصحف المعتمدة',
    date: '2026-05-12',
    sample: true,
  },
];

const PUBLISHED_KEY = 'nafePublishedAdvisories';

function readPublished(): NafeAdvisory[] {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NafeAdvisory[]) : [];
  } catch {
    return [];
  }
}

export default function Nafe() {
  const { isGovernanceRole, isOwner } = useUserContext();
  const canPublish = isGovernanceRole || isOwner;

  const [activeSection, setActiveSection] = useState<string>('all');
  const [published, setPublished] = useState<NafeAdvisory[]>(() => readPublished());
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formSection, setFormSection] = useState<string>(NAFE_SECTIONS[0].id);
  const [formSource, setFormSource] = useState<string>(NAFE_SOURCES[0]);

  const advisories = useMemo(() => {
    const all = [...published, ...SAMPLE_ADVISORIES];
    return activeSection === 'all' ? all : all.filter((a) => a.sectionId === activeSection);
  }, [published, activeSection]);

  const publish = () => {
    const title = formTitle.trim();
    const body = formBody.trim();
    if (!title || !body) return;
    const advisory: NafeAdvisory = {
      id: `pub-${Date.now()}`,
      sectionId: formSection,
      title,
      body,
      source: formSource,
      date: new Date().toISOString().slice(0, 10),
    };
    const next = [advisory, ...published];
    setPublished(next);
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(next));
    setFormTitle('');
    setFormBody('');
    setShowForm(false);
  };

  const sectionName = (id: string) => NAFE_SECTIONS.find((s) => s.id === id)?.ar ?? id;
  const sectionEmoji = (id: string) => NAFE_SECTIONS.find((s) => s.id === id)?.emoji ?? '📢';

  return (
    <AppLayout>
      <div dir="rtl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/10 border border-gold/25 mb-3">
            <Megaphone className="w-7 h-7 text-gold" aria-hidden />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading mb-1" style={{ fontFamily: 'var(--app-font-serif)' }}>
            نافع
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            منصة وطنية للتوعية والتحذير من الجرائم والأساليب الحديثة — محتوى من
            الوزارات والهيئات الحكومية والجهات الأمنية والأخبار الرسمية والصحف المعتمدة.
          </p>
          {canPublish && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="gold-hover-glow inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-gold text-background text-xs font-bold hover:opacity-90 transition-all"
            >
              {showForm ? <X className="w-3.5 h-3.5" aria-hidden /> : <PlusCircle className="w-3.5 h-3.5" aria-hidden />}
              {showForm ? 'إغلاق نموذج النشر' : 'نشر تحذير / مادة توعوية (للجهات الحكومية)'}
            </button>
          )}
        </div>

        {/* Publish form — government roles only */}
        {canPublish && showForm && (
          <div className="moj-card rounded-xl p-5 mb-6 border-gold/40">
            <p className="text-[13px] font-bold text-heading mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-gold" aria-hidden />
              نشر تحذير جديد
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="nafe-section" className="text-[10px] font-semibold text-muted-foreground block mb-1">القسم</label>
                <select
                  id="nafe-section"
                  value={formSection}
                  onChange={(e) => setFormSection(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  style={{ direction: 'rtl' }}
                >
                  {NAFE_SECTIONS.map((s) => (
                    <option key={s.id} value={s.id}>{s.emoji} {s.ar}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="nafe-source" className="text-[10px] font-semibold text-muted-foreground block mb-1">المصدر</label>
                <select
                  id="nafe-source"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  style={{ direction: 'rtl' }}
                >
                  {NAFE_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="nafe-title" className="text-[10px] font-semibold text-muted-foreground block mb-1">عنوان التحذير</label>
            <input
              id="nafe-title"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="مثال: تحذير من أسلوب احتيال جديد عبر..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gold/40"
              dir="rtl"
            />
            <label htmlFor="nafe-body" className="text-[10px] font-semibold text-muted-foreground block mb-1">نص التحذير / المادة التوعوية</label>
            <textarea
              id="nafe-body"
              rows={3}
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="وصف الأسلوب الإجرامي وسبل الوقاية وقنوات الإبلاغ..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gold/40 leading-relaxed"
              dir="rtl"
            />
            <button
              type="button"
              onClick={publish}
              disabled={!formTitle.trim() || !formBody.trim()}
              className="px-5 py-2 rounded-xl bg-gold text-background text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-all"
            >
              نشر
            </button>
            <p className="text-[9px] text-muted-foreground/60 mt-2">
              ملاحظة تشغيلية: في هذه المرحلة يُحفظ المنشور محلياً على هذا الجهاز لحين ربط
              خط النشر الحكومي المركزي.
            </p>
          </div>
        )}

        {/* Section filter grid */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-colors ${
              activeSection === 'all'
                ? 'bg-gold text-background border-gold'
                : 'border-border text-muted-foreground hover:border-gold/40 hover:text-foreground'
            }`}
          >
            الكل
          </button>
          {NAFE_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-colors ${
                activeSection === s.id
                  ? 'bg-gold text-background border-gold'
                  : 'border-border text-muted-foreground hover:border-gold/40 hover:text-foreground'
              }`}
            >
              <span aria-hidden>{s.emoji}</span> {s.ar}
            </button>
          ))}
        </div>

        {/* Advisory feed */}
        <div className="space-y-3">
          {advisories.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              لا توجد تحذيرات منشورة في هذا القسم بعد.
            </p>
          )}
          {advisories.map((a) => (
            <article key={a.id} className="moj-card rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold">
                  {sectionEmoji(a.sectionId)} {sectionName(a.sectionId)}
                </span>
                <span className="text-[10px] text-muted-foreground">{a.source}</span>
                <span className="text-[10px] text-muted-foreground/60" dir="ltr">{a.date}</span>
                {a.sample && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground/70">
                    نموذج توضيحي
                  </span>
                )}
              </div>
              <h2 className="text-[14px] font-bold text-heading mb-1.5">{a.title}</h2>
              <p className="text-[12px] text-muted-foreground leading-relaxed">{a.body}</p>
            </article>
          ))}
        </div>

        {/* Report CTA */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-muted-foreground">
            هل تعرضت لإحدى هذه الأساليب؟ بادر بالإبلاغ عبر القنوات الرسمية للجهات الأمنية فوراً.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
