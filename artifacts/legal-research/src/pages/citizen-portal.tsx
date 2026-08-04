/**
 * Citizen Portal — بوابة المواطن
 *
 * Public-facing Arabic-first page. Citizens enter a decision case number and
 * receive the Constitutional Accountability Record (CAR — سجل المساءلة الدستورية) for that decision.
 * No authentication required — only sealed decisions are served.
 * Completely standalone layout (no sidebar, no main app header).
 */
import React, { useState } from 'react';
import { Link } from 'wouter';
import { Scale, Search, ChevronRight, AlertTriangle, Shield, FileText, PhoneCall, ArrowLeft, Hash, CheckCircle2, XCircle, Link2 } from 'lucide-react';
import { Gavel } from '@/components/icons/gavel';
import { apiFetch as libApiFetch } from '@/lib/api-fetch';

// ─── API helper (no auth header needed for citizen endpoint) ──────────────────

interface CustodySummary {
  recordCount: number;
  valid: boolean;
  latestChainHash: string | null;
  genesisTimestamp: string | null;
  latestTimestamp: string | null;
}

interface CarResult {
  decision: { caseNumber: string; titleAr: string };
  car: Record<string, unknown>;
  custodySummary: CustodySummary | null;
}

function fetchCar(caseNumber: string) {
  const base = (import.meta.env.BASE_URL ?? '').replace(/\/$/, '');
  return libApiFetch(`${base}/api/governance/citizen/car?caseNumber=${encodeURIComponent(caseNumber)}`)
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error || r.statusText);
      return data as CarResult;
    });
}

// ─── CAR section display ──────────────────────────────────────────────────────

interface CarSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

const CAR_SECTIONS: CarSection[] = [
  { key: 'decisionSummary',         label: 'ملخص القرار الإداري',            icon: <FileText className="w-5 h-5" />, highlight: true },
  { key: 'rightsAffected',          label: 'الحقوق والمصالح المتأثرة',       icon: <Shield className="w-5 h-5" /> },
  { key: 'legalJustification',      label: 'المبرر والأساس القانوني',         icon: <Scale className="w-5 h-5" /> },
  { key: 'constitutionalBasis',     label: 'الأساس الدستوري للقرار',          icon: <Shield className="w-5 h-5" /> },
  { key: 'proceduresFollowed',      label: 'الإجراءات والضمانات المتبعة',     icon: <ChevronRight className="w-5 h-5" /> },
  { key: 'aiRoleDisclosure',        label: 'دور الذكاء الاصطناعي في القرار', icon: <Scale className="w-5 h-5" /> },
  { key: 'appealInformation',       label: 'حق الطعن والتظلم',               icon: <Gavel className="w-5 h-5" />, highlight: true },
  { key: 'contactInformation',      label: 'للتواصل والاستفسار',             icon: <PhoneCall className="w-5 h-5" /> },
];

function CarSectionCard({ section, car }: { section: CarSection; car: Record<string, unknown> }) {
  const value = car[section.key] as string | undefined;
  if (!value) return null;
  return (
    <div className={`rounded-2xl border p-5 ${section.highlight ? 'border-[#00563F]/30 bg-[#00563F]/5' : 'border-[#C4A24E]/20 bg-white'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${section.highlight ? 'bg-[#00563F] text-white' : 'bg-[#C4A24E]/20 text-[#C4A24E]'}`}>
          {section.icon}
        </div>
        <h3 className="font-bold text-[#1A1A2E] text-base">{section.label}</h3>
      </div>
      <p className="text-[#3D3D5C] leading-[1.9] text-[15px]">{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CitizenPortal() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CarResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchCar(q);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير معروف');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #F8F6F0 0%, #FDFCF8 50%, #F0F4F8 100%)' }}
      dir="rtl"
      lang="ar"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-[#00563F] text-white px-6 py-4 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">بوابة المواطن القانونية</h1>
              <p className="text-xs text-white/70">منصة مرصد — الاطلاع على القرارات الإدارية</p>
            </div>
          </div>
          <Link href="/governance">
            <button className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              العودة للمنصة
            </button>
          </Link>
        </div>
      </header>

      {/* ── Hero search area ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#C4A24E]/20 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00563F]/10 text-[#00563F] text-xs font-bold rounded-full mb-4">
              <Shield className="w-3.5 h-3.5" />
              سجل المساءلة الدستورية
            </div>
            <h2 className="text-2xl font-black text-[#1A1A2E] mb-2">حقك في معرفة أسباب القرار</h2>
            <p className="text-[#5C5C7A] text-sm leading-relaxed max-w-xl mx-auto">
              يحق لكل مواطن متأثر بقرار إداري الاطلاع على مسوّغاته القانونية والدستورية وأدوار الذكاء الاصطناعي فيه، وفق إطار الشامسي للقرار الإداري الذكي.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#9B9BB4]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="أدخل رقم القضية — مثال: MARSAD-2026-0147"
                className="w-full pe-11 ps-4 py-3.5 rounded-xl border-2 border-[#C4A24E]/30 bg-[#FAFAF8] text-[#1A1A2E] placeholder-[#9B9BB4] text-sm focus:outline-none focus:border-[#00563F] transition-colors font-mono"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#00563F] text-white font-bold text-sm hover:bg-[#004834] disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              بحث
            </button>
          </form>

          {/* Example hint */}
          <p className="text-center text-xs text-[#9B9BB4] mt-3">
            رقم القضية يبدأ بـ MARSAD ويوجد في أعلى وثيقة القرار الرسمية
          </p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Error state */}
        {error && !loading && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="font-bold text-red-700 text-base mb-1">لم يُعثر على سجل</p>
            <p className="text-red-600 text-sm">{error}</p>
            <div className="mt-4 p-3 rounded-xl bg-red-100/50 text-xs text-red-600">
              <p className="font-semibold mb-1">أسباب محتملة:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>رقم القضية غير صحيح أو يحتوي على خطأ إملائي</li>
                <li>القرار لم يُختم بعد ولم يُنشر في السجل العام</li>
                <li>القرار قيد المراجعة الداخلية</li>
              </ul>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-[#00563F]/20 border-t-[#00563F] rounded-full animate-spin" />
            <p className="text-sm text-[#5C5C7A]">جارٍ البحث في سجلات القرارات المختومة…</p>
          </div>
        )}

        {/* CAR result */}
        {result && !loading && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Decision identity banner */}
            <div className="rounded-2xl bg-[#00563F] text-white p-5 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Scale className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono bg-white/15 px-2 py-0.5 rounded-full">{result.decision.caseNumber}</span>
                    <span className="text-xs bg-[#C4A24E] px-2 py-0.5 rounded-full font-semibold">مُختوم ومنشور</span>
                  </div>
                  <h3 className="font-bold text-lg leading-snug">{result.decision.titleAr}</h3>
                  <p className="text-xs text-white/70 mt-1">سجل المساءلة الدستورية — متاح للعموم بموجب مبدأ الشفافية</p>
                </div>
              </div>
            </div>

            {/* AI disclosure banner */}
            <div className="rounded-2xl border border-[#C4A24E]/30 bg-[#C4A24E]/5 p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#C4A24E] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#7A5C00]">إفصاح عن دور الذكاء الاصطناعي</p>
                <p className="text-xs text-[#7A5C00]/80 mt-0.5 leading-relaxed">
                  هذا القرار أُعدَّ بمساعدة منظومة الذكاء الاصطناعي التابعة لمنصة مرصد. جميع القرارات النهائية اتخذها مسؤولون بشريون معيّنون قانونياً. يُرجى الاطلاع على بند "دور الذكاء الاصطناعي" أدناه.
                </p>
              </div>
            </div>

            {/* CAR sections */}
            <div className="space-y-4">
              {CAR_SECTIONS.map((section) => (
                <CarSectionCard key={section.key} section={section} car={result.car} />
              ))}
            </div>

            {/* Integrity stamp */}
            <div className="rounded-2xl border border-[#00563F]/20 bg-[#00563F]/5 p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-[#00563F]" />
                <span className="font-bold text-[#00563F]">قرار مُعتمد دستورياً</span>
              </div>
              <p className="text-xs text-[#3D3D5C] leading-relaxed">
                تم التحقق من هذا القرار واعتماده وفق إطار الشامسي للقرار الإداري الذكي.
                رقم السجل المرجعي: <span className="font-mono font-semibold">{result.decision.caseNumber}</span>
              </p>
              <p className="text-[11px] text-[#9B9BB4] mt-2">Powered by the M. Al-Shamsi Framework™</p>
            </div>

            {/* Phase 3 — Chain of Custody Attestation */}
            {result.custodySummary ? (
              <div className={`rounded-2xl border p-4 ${result.custodySummary.valid ? 'border-[#00563F]/30 bg-[#00563F]/5' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="w-4 h-4 text-[#00563F] shrink-0" />
                  <span className="text-sm font-bold text-[#1A1A2E]">سلسلة الحيازة القانونية — المرحلة 3</span>
                  {result.custodySummary.valid ? (
                    <span className="mr-auto flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />سلسلة سليمة
                    </span>
                  ) : (
                    <span className="mr-auto flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" />تحذير: عُبث كُشف
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#5C5C7A]">
                  <span>عدد سجلات الحيازة: <span className="font-bold text-[#1A1A2E]">{result.custodySummary.recordCount}</span></span>
                  {result.custodySummary.latestChainHash && (
                    <span className="truncate">هاش السلسلة: <span className="font-mono">{result.custodySummary.latestChainHash}</span></span>
                  )}
                </div>
                <p className="text-[10px] text-[#9B9BB4] mt-2 leading-relaxed">
                  كل إجراء على هذا القرار مُسجَّل في سلسلة حيازة مُشفَّرة وغير قابلة للتعديل، مع تحقق SHA-256 وتوقيع رقمي HMAC-SHA-256 لكل سجل.
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Link2 className="w-3 h-3 text-[#9B9BB4]" />
                  <span className="text-[10px] text-[#9B9BB4]">مُلحق فقط — لا حذف ولا تعديل ممكن بموجب إطار الشامسي™</span>
                </div>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-[#00563F] text-[#00563F] font-bold text-sm hover:bg-[#00563F] hover:text-white transition-colors"
              >
                <FileText className="w-4 h-4" />
                طباعة السجل
              </button>
              <button
                onClick={() => { setResult(null); setQuery(''); setError(null); }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#C4A24E]/40 text-[#5C5C7A] font-semibold text-sm hover:bg-[#C4A24E]/10 transition-colors"
              >
                <Search className="w-4 h-4" />
                بحث جديد
              </button>
            </div>
          </div>
        )}

        {/* Initial empty state */}
        {!result && !error && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-[#00563F]/10 flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-[#00563F]" />
            </div>
            <h3 className="font-bold text-[#1A1A2E] text-lg mb-2">ابدأ بالبحث عن قرار</h3>
            <p className="text-sm text-[#5C5C7A] max-w-sm mx-auto leading-relaxed">
              أدخل رقم القضية للاطلاع على سجل المساءلة الدستورية. يتوفر السجل فقط للقرارات المُكتملة والمُختومة.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
              {[
                { icon: <Search className="w-5 h-5" />, title: 'أدخل رقم القضية', desc: 'ابحث برقم القضية الرسمي' },
                { icon: <Shield className="w-5 h-5" />, title: 'اطلع على المسوّغات', desc: 'الأسباب والأساس القانوني' },
                { icon: <Gavel className="w-5 h-5" />, title: 'حق الطعن', desc: 'معلومات الاعتراض والتظلم' },
              ].map((step, i) => (
                <div key={i} className="p-4 rounded-xl bg-white border border-[#C4A24E]/20 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[#00563F]/10 flex items-center justify-center mx-auto mb-2 text-[#00563F]">
                    {step.icon}
                  </div>
                  <p className="font-bold text-[#1A1A2E] text-sm mb-1">{step.title}</p>
                  <p className="text-xs text-[#5C5C7A]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#C4A24E]/20 bg-white mt-auto">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#00563F]" />
            <span className="text-xs font-bold text-[#1A1A2E]">منصة مرصد القانونية</span>
          </div>
          <p className="text-[11px] text-[#9B9BB4]">Powered by the M. Al-Shamsi Framework™ — بوابة المواطن</p>
        </div>
      </footer>
    </div>
  );
}
