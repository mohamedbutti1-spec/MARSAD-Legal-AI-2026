import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronLeft, Loader2, Download, Network, Link2,
  Clock, BarChart3, FileText, Plus, Trash2, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { DecisionGraph } from '@/components/adkg/decision-graph';
import { DecisionTimeline } from '@/components/adkg/decision-timeline';
import { AddLinkDialog, type LinkFormData } from '@/components/adkg/add-link-dialog';
import {
  TRADITIONAL_PILLARS,
  AI_DECISION_PILLARS,
  PILLAR_STATUS_COLORS,
  AUTHORITY_LABEL_COLORS,
  type PillarMeta,
} from '@/components/adkg/pillar-constants';

interface Decision {
  id: number; decisionNumber: string; title: string; titleAr: string;
  issuerOrg?: string | null; issuerOrgAr?: string | null;
  subject?: string | null; subjectAr?: string | null;
  status: string; issuedDate?: string | null; effectiveDate?: string | null; expiryDate?: string | null;
  content: Record<string, unknown>;
  citedAuthorities: unknown[];
  metadata: Record<string, unknown>;
}
interface Link {
  id: number; linkType: string; linkedEntityType: string;
  titleAr?: string | null; titleEn?: string | null; linkedEntityRef?: string | null;
  authorityClass: string; notes?: string | null;
}
interface TimelineEvent {
  id: number; decisionId: number; eventType: string; eventDate: string;
  description?: string | null; descriptionAr?: string | null;
}
interface GraphData {
  centralId: number;
  nodes: Array<{ id: string; type: string; label: string; labelAr: string; status?: string; authorityClass?: string; linkType?: string }>;
  edges: Array<{ source: string; target: string; type: string; label: string }>;
}
interface PillarResult {
  status: 'compliant' | 'partial' | 'non-compliant' | 'unknown';
  score: number;
  explanationAr: string;
  explanationEn: string;
  missingRequirements: string[];
  applicableLaw: string[];
}
interface PillarAnalysis {
  legalityScore: number;
  riskScore: number;
  canIssueToday: 'yes' | 'no' | 'conditional';
  canIssueTodayRationale: string;
  analyzedAt?: string;
  [key: string]: unknown;
}

type TabId = 'overview' | 'relationships' | 'timeline' | 'graph' | 'analysis';

const STATUS_STYLES: Record<string, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  draft:{ bg:'#f1f5f9',text:'#475569',labelAr:'مسودة',labelEn:'Draft' },
  issued:{ bg:'#f0fdf4',text:'#15803d',labelAr:'صادر',labelEn:'Issued' },
  challenged:{ bg:'#fffbeb',text:'#92400e',labelAr:'مطعون فيه',labelEn:'Challenged' },
  suspended:{ bg:'#fef2f2',text:'#991b1b',labelAr:'موقوف',labelEn:'Suspended' },
  amended:{ bg:'#faf5ff',text:'#6d28d9',labelAr:'معدّل',labelEn:'Amended' },
  revoked:{ bg:'#fef2f2',text:'#7f1d1d',labelAr:'ملغى',labelEn:'Revoked' },
  annulled:{ bg:'#fff1f2',text:'#450a0a',labelAr:'مُبطل',labelEn:'Annulled' },
  executed:{ bg:'#eff6ff',text:'#1e40af',labelAr:'منفّذ',labelEn:'Executed' },
};

const AUTH_COLORS: Record<string, string> = {
  binding:'bg-heading/15 text-heading/75',
  persuasive:'bg-blue-100 text-blue-800',
  non_binding:'bg-gray-100 text-gray-700',
};
const LINK_LABELS: Record<string, string> = {
  legislation:'تشريع', exec_regulation:'لائحة تنفيذية', cabinet_decision:'قرار مجلس الوزراء',
  ministerial_decision:'قرار وزاري', case_law:'قضاء', legal_principle:'مبدأ قانوني',
  legal_opinion:'رأي قانوني', research_project:'مشروع بحثي', other_decision:'قرار آخر', other:'أخرى',
};

const EVENT_TYPES = ['draft','issued','challenged','suspended','amended','revoked','annulled','executed','appeal_filed','appeal_dismissed','appeal_upheld','court_referral','publication','custom'];
const REL_TYPES = ['amends','challenged_by','suspended_by','revoked_by','annulled_by','executes','references','replaces','implements','appeals'];

// ── Pillar analysis sub-components ───────────────────────────────────────────

function ScoreBar({ score, colorClass }: { score: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600 w-8 text-right">{score}</span>
    </div>
  );
}

function AuthorityLabel({ text }: { text: string }) {
  for (const [tag, colors] of Object.entries(AUTHORITY_LABEL_COLORS)) {
    if (text.includes(tag)) {
      return (
        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border"
          style={{ background: colors.bg, color: colors.text }}>
          {tag}
        </span>
      );
    }
  }
  return null;
}

function PillarCard({ pillar, result, t }: { pillar: PillarMeta; result: PillarResult; t: (ar: string, en: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const style = PILLAR_STATUS_COLORS[result.status] ?? PILLAR_STATUS_COLORS.unknown;
  const barColor = result.status === 'compliant' ? 'bg-heading'
    : result.status === 'partial' ? 'bg-gold/80'
    : result.status === 'non-compliant' ? 'bg-red-500'
    : 'bg-gray-300';

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: style.border }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 text-right hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{t(pillar.labelAr, pillar.labelEn)}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
              style={{ background: style.bg, color: style.text, borderColor: style.border }}>
              {t(style.labelAr, style.label)}
            </span>
            <span className="text-[10px] text-gray-400">{pillar.weight}%</span>
          </div>
          <ScoreBar score={result.score} colorClass={barColor} />
        </div>
        <span className="text-gray-400 text-xs mt-1 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t bg-white">
          <p className="text-sm text-gray-700 mt-3 leading-relaxed" dir="rtl">{result.explanationAr}</p>
          <p className="text-xs text-gray-500 italic">{result.explanationEn}</p>

          {result.applicableLaw.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">{t('الأسس القانونية', 'Legal Basis')}</p>
              <ul className="space-y-1">
                {result.applicableLaw.map((law, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                    <span className="flex-1">{law.replace(/\[(UAE Binding|Comparative Persuasive)\]/g, '').trim()}</span>
                    <AuthorityLabel text={law} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.missingRequirements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1.5">{t('متطلبات مفقودة', 'Missing Requirements')}</p>
              <ul className="space-y-1">
                {result.missingRequirements.map((req, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">⚠</span>{req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdkgDetail() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const decisionId = parseInt(params.id, 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showAddLink, setShowAddLink]   = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddEdge, setShowAddEdge]   = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Add event form state
  const [evType, setEvType]   = useState('issued');
  const [evDate, setEvDate]   = useState('');
  const [evDescAr, setEvDescAr] = useState('');
  const [evSaving, setEvSaving] = useState(false);

  // Add edge form state
  const [edgeTo, setEdgeTo]       = useState('');
  const [edgeRel, setEdgeRel]     = useState('references');
  const [edgeNotes, setEdgeNotes] = useState('');
  const [edgeSaving, setEdgeSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['adkg.decision', decisionId],
    queryFn: () => apiFetch(`/api/adkg/decisions/${decisionId}`).then((r) => r.json()) as Promise<{ decision: Decision; links: Link[]; timeline: TimelineEvent[] }>,
  });

  const { data: graphData } = useQuery({
    queryKey: ['adkg.graph', decisionId],
    queryFn: () => apiFetch(`/api/adkg/decisions/${decisionId}/graph`).then((r) => r.json()) as Promise<GraphData>,
    enabled: activeTab === 'graph' || activeTab === 'relationships',
  });

  const { data: analysisData, refetch: refetchAnalysis } = useQuery({
    queryKey: ['adkg.analysis', decisionId],
    queryFn: () => apiFetch(`/api/adkg/decisions/${decisionId}/analyze`).then((r) => r.json()) as Promise<{ analysis: PillarAnalysis | null }>,
    enabled: activeTab === 'analysis',
  });

  const [analyzing, setAnalyzing] = useState(false);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const r = await apiFetch(`/api/adkg/decisions/${decisionId}/analyze`, { method: 'POST' });
      if (r.ok) {
        await refetchAnalysis();
        qc.invalidateQueries({ queryKey: ['adkg.decision', decisionId] });
      }
    } finally {
      setAnalyzing(false);
    }
  }

  const addLinkMut = useMutation({
    mutationFn: (body: LinkFormData) => apiFetch(`/api/adkg/decisions/${decisionId}/links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adkg.decision', decisionId] }); qc.invalidateQueries({ queryKey: ['adkg.graph', decisionId] }); },
  });

  const deleteLinkMut = useMutation({
    mutationFn: (linkId: number) => apiFetch(`/api/adkg/decisions/${decisionId}/links/${linkId}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adkg.decision', decisionId] }); qc.invalidateQueries({ queryKey: ['adkg.graph', decisionId] }); },
  });

  const deleteEventMut = useMutation({
    mutationFn: (eventId: number) => apiFetch(`/api/adkg/decisions/${decisionId}/timeline/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adkg.decision', decisionId] }),
  });

  async function handleAddEvent() {
    if (!evDate) return;
    setEvSaving(true);
    try {
      const r = await apiFetch(`/api/adkg/decisions/${decisionId}/timeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: evType, eventDate: evDate, descriptionAr: evDescAr || undefined }) });
      if (r.ok) { qc.invalidateQueries({ queryKey: ['adkg.decision', decisionId] }); setShowAddEvent(false); setEvDate(''); setEvDescAr(''); }
    } finally { setEvSaving(false); }
  }

  async function handleAddEdge() {
    const toId = parseInt(edgeTo, 10);
    if (!toId || !edgeRel) return;
    setEdgeSaving(true);
    try {
      const r = await apiFetch('/api/adkg/graph-edges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromDecisionId: decisionId, toDecisionId: toId, relationshipType: edgeRel, notes: edgeNotes || undefined }) });
      if (r.ok) { qc.invalidateQueries({ queryKey: ['adkg.graph', decisionId] }); setShowAddEdge(false); setEdgeTo(''); setEdgeNotes(''); }
    } finally { setEdgeSaving(false); }
  }

  async function handleExport(format: string) {
    setExportLoading(true);
    try {
      const r = await apiFetch(`/api/adkg/decisions/${decisionId}/export?format=${format}`);
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `decision-${decisionId}.${format}`; a.click(); URL.revokeObjectURL(url);
      }
    } finally { setExportLoading(false); }
  }

  if (isLoading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!data) return <AppLayout><p className="text-muted-foreground py-20 text-center">{t('القرار غير موجود', 'Decision not found')}</p></AppLayout>;

  const { decision, links, timeline } = data;
  const status = STATUS_STYLES[decision.status] ?? STATUS_STYLES.draft;
  const authorities = decision.citedAuthorities as Array<Record<string, unknown>>;
  const body = (decision.content.bodyAr as string) || (decision.content.body as string) || '';

  // Pillar analysis is stored in metadata.pillarAnalysis (not citedAuthorities)
  const cachedAnalysis: PillarAnalysis | undefined = decision.metadata?.pillarAnalysis as PillarAnalysis | undefined;

  const TABS: { id: TabId; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    { id: 'overview',       labelAr: 'نظرة عامة',     labelEn: 'Overview',       icon: <FileText className="w-4 h-4" /> },
    { id: 'relationships',  labelAr: 'العلاقات',      labelEn: 'Relationships',   icon: <Link2 className="w-4 h-4" /> },
    { id: 'timeline',       labelAr: 'الجدول الزمني', labelEn: 'Timeline',        icon: <Clock className="w-4 h-4" /> },
    { id: 'graph',          labelAr: 'الرسم البياني', labelEn: 'Graph',           icon: <Network className="w-4 h-4" /> },
    { id: 'analysis',       labelAr: 'تحليل الأعمدة', labelEn: 'Pillar Analysis', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back */}
        <button onClick={() => navigate('/adkg')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[#1e3a5f] transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" />{t('القرارات الإدارية', 'Administrative Decisions')}
        </button>

        {/* Header */}
        <div className="rounded-xl border bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] text-white p-5 mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs opacity-70">{decision.decisionNumber}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: status.bg, color: status.text }}>
                  {t(status.labelAr, status.labelEn)}
                </span>
                {/* Score badge if analysis exists */}
                {cachedAnalysis && (
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors border border-white/20"
                    title={t('انتقل إلى تحليل الأعمدة', 'Go to Pillar Analysis')}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span className="text-heading/40">{t('المشروعية', 'Legality')} {cachedAnalysis.legalityScore}</span>
                    <span className="text-white/40">|</span>
                    <span className="text-gold/40">{t('الخطر', 'Risk')} {cachedAnalysis.riskScore}</span>
                  </button>
                )}
              </div>
              <h1 className="text-xl font-bold leading-snug">{decision.titleAr}</h1>
              <p className="text-sm opacity-70 mt-0.5">{decision.title}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs opacity-65">
                {decision.issuerOrgAr && <span>{t('الجهة:', 'Issuer:')} {decision.issuerOrgAr}</span>}
                {decision.issuedDate   && <span>{t('الإصدار:', 'Issued:')} {decision.issuedDate}</span>}
                {decision.effectiveDate && <span>{t('النفاذ:', 'Effective:')} {decision.effectiveDate}</span>}
                {decision.subjectAr    && <span>{t('الموضوع:', 'Subject:')} {decision.subjectAr}</span>}
              </div>
            </div>
            {/* Export */}
            <div className="flex items-center gap-2 shrink-0">
              {(['pdf','docx','md'] as const).map((fmt) => (
                <button key={fmt} onClick={() => handleExport(fmt)} disabled={exportLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  {exportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}>
              {tab.icon}{t(tab.labelAr, tab.labelEn)}
              {tab.id === 'relationships' && links.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">{links.length}</span>}
              {tab.id === 'timeline' && timeline.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">{timeline.length}</span>}
              {tab.id === 'analysis' && cachedAnalysis && (
                <span className="text-xs bg-heading/15 text-heading rounded-full px-1.5 py-0.5">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {body ? (
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('نص القرار', 'Decision Body')}</h3>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap" dir="auto">{body}</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                {t('لا يوجد نص محتوى بعد', 'No body content yet')}
              </div>
            )}
            {Array.isArray(authorities) && authorities.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">{t('مصادر الاستشهاد الآلية', 'AI-Verified Cited Authorities')}</h3>
                <ul className="space-y-1.5">
                  {authorities.map((a, i) => {
                    const cls = (a as Record<string, unknown>).authorityClass as string ?? 'persuasive';
                    const conf = typeof (a as Record<string, unknown>).confidenceScore === 'number' ? `${Math.round(((a as Record<string, unknown>).confidenceScore as number) * 100)}%` : '—';
                    return (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 text-gray-800">{(a as Record<string, unknown>).titleAr as string}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${AUTH_COLORS[cls] ?? AUTH_COLORS.persuasive}`}>{cls}</span>
                        <span className="text-muted-foreground">{conf}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab: Relationships */}
        {activeTab === 'relationships' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{t('الروابط القانونية', 'Legal Links')}</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowAddEdge(true)}>
                  <Plus className="w-3.5 h-3.5 ml-1" />{t('ربط قرار', 'Link Decision')}
                </Button>
                <Button size="sm" onClick={() => setShowAddLink(true)} className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white gap-1">
                  <Plus className="w-3.5 h-3.5" />{t('إضافة رابط', 'Add Link')}
                </Button>
              </div>
            </div>

            {links.length === 0 ? (
              <div className="rounded-lg border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                {t('لا توجد روابط قانونية بعد', 'No legal links yet')}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600 text-xs">{t('العنوان', 'Title')}</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600 text-xs">{t('النوع', 'Type')}</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600 text-xs">{t('الطبيعة', 'Class')}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {links.map((lnk) => (
                      <tr key={lnk.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{lnk.titleAr ?? lnk.titleEn ?? lnk.linkedEntityRef ?? '—'}</p>
                          {lnk.notes && <p className="text-xs text-muted-foreground mt-0.5">{lnk.notes}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{LINK_LABELS[lnk.linkType] ?? lnk.linkType}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${AUTH_COLORS[lnk.authorityClass] ?? AUTH_COLORS.persuasive}`}>{lnk.authorityClass}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => deleteLinkMut.mutate(lnk.id)} className="text-muted-foreground hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {graphData && (graphData.nodes.length > 1 || graphData.edges.length > 0) && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('مخطط العلاقات', 'Relationship Map')}</h3>
                <DecisionGraph nodes={graphData.nodes} edges={graphData.edges} centralId={decisionId} />
              </div>
            )}
          </div>
        )}

        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <DecisionTimeline
            events={timeline}
            canEdit
            onAddEvent={() => setShowAddEvent(true)}
            onDeleteEvent={(id) => deleteEventMut.mutate(id)}
          />
        )}

        {/* Tab: Graph */}
        {activeTab === 'graph' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">{t('مخطط المعرفة', 'Knowledge Graph')}</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddEdge(true)}>
                <Plus className="w-3.5 h-3.5 ml-1" />{t('ربط قرار', 'Link Decision')}
              </Button>
            </div>
            {graphData ? (
              <DecisionGraph nodes={graphData.nodes} edges={graphData.edges} centralId={decisionId} />
            ) : (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            )}
          </div>
        )}

        {/* Tab: Pillar Analysis */}
        {activeTab === 'analysis' && (
          <PillarAnalysisTab
            decisionId={decisionId}
            cachedAnalysis={cachedAnalysis ?? analysisData?.analysis ?? null}
            analyzing={analyzing}
            onRunAnalysis={runAnalysis}
            t={t}
          />
        )}
      </div>

      {/* Add Link Dialog */}
      <AddLinkDialog open={showAddLink} onClose={() => setShowAddLink(false)} onSave={async (data) => { await addLinkMut.mutateAsync(data); setShowAddLink(false); }} />

      {/* Add Timeline Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={(o) => { if (!o) { setShowAddEvent(false); setEvDate(''); setEvDescAr(''); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{t('إضافة حدث زمني', 'Add Timeline Event')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('نوع الحدث', 'Event Type')}</label>
              <select value={evType} onChange={(e) => setEvType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {EVENT_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('التاريخ', 'Date')} *</label>
              <Input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('الوصف', 'Description')}</label>
              <Input value={evDescAr} onChange={(e) => setEvDescAr(e.target.value)} dir="auto" placeholder={t('وصف الحدث…', 'Event description…')} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddEvent(false)} disabled={evSaving}>{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleAddEvent} disabled={evSaving || !evDate} className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white">
              {evSaving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}{t('إضافة', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Graph Edge Dialog */}
      <Dialog open={showAddEdge} onOpenChange={(o) => { if (!o) { setShowAddEdge(false); setEdgeTo(''); setEdgeNotes(''); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{t('ربط بقرار آخر', 'Link to Another Decision')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('معرّف القرار المستهدف', 'Target Decision ID')} *</label>
              <Input type="number" value={edgeTo} onChange={(e) => setEdgeTo(e.target.value)} placeholder="123" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('نوع العلاقة', 'Relationship Type')}</label>
              <select value={edgeRel} onChange={(e) => setEdgeRel(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {REL_TYPES.map((rt) => <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('ملاحظات', 'Notes')}</label>
              <Input value={edgeNotes} onChange={(e) => setEdgeNotes(e.target.value)} dir="auto" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddEdge(false)} disabled={edgeSaving}>{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleAddEdge} disabled={edgeSaving || !edgeTo || !edgeRel} className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white">
              {edgeSaving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}{t('ربط', 'Link')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ── Pillar Analysis Tab ───────────────────────────────────────────────────────

function PillarAnalysisTab({
  decisionId,
  cachedAnalysis,
  analyzing,
  onRunAnalysis,
  t,
}: {
  decisionId: number;
  cachedAnalysis: PillarAnalysis | null;
  analyzing: boolean;
  onRunAnalysis: () => void;
  t: (ar: string, en: string) => string;
}) {
  const analysis = cachedAnalysis;

  const canIssueBadge = analysis?.canIssueToday === 'yes'
    ? { bg: '#f0fdf4', text: '#15803d', label: t('يمكن إصداره', 'Can Issue') }
    : analysis?.canIssueToday === 'no'
    ? { bg: '#fef2f2', text: '#991b1b', label: t('لا يمكن إصداره', 'Cannot Issue') }
    : { bg: '#fffbeb', text: '#92400e', label: t('مشروط', 'Conditional') };

  return (
    <div className="space-y-5">
      {/* Header / action row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            {t('تحليل الأعمدة القانونية الستة عشر', '16-Pillar Legal Analysis')}
          </h3>
          {analysis?.analyzedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('آخر تحليل:', 'Last analyzed:')} {new Date(analysis.analyzedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          onClick={onRunAnalysis}
          disabled={analyzing}
          className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white gap-2"
          size="sm"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {analyzing
            ? t('جارٍ التحليل…', 'Analyzing…')
            : analysis
            ? t('إعادة التحليل', 'Re-analyze')
            : t('تشغيل التحليل', 'Run Analysis')}
        </Button>
      </div>

      {/* No analysis yet */}
      {!analysis && !analyzing && (
        <div className="rounded-xl border bg-muted/10 p-10 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-gray-700">
            {t('لم يتم تحليل هذا القرار بعد', 'This decision has not been analyzed yet')}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t(
              'اضغط "تشغيل التحليل" لتقييم القرار عبر الستة عشر عموداً القانونية لنظرية الشامسي.',
              'Click "Run Analysis" to evaluate this decision across the 16 Al-Shamsi pillars.',
            )}
          </p>
        </div>
      )}

      {/* Loading state */}
      {analyzing && (
        <div className="rounded-xl border bg-blue-50/50 p-10 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin" />
          <p className="text-sm font-medium text-gray-700">{t('جارٍ تقييم الأعمدة القانونية…', 'Evaluating legal pillars…')}</p>
          <p className="text-xs text-muted-foreground">{t('قد يستغرق التحليل دقيقة واحدة.', 'Analysis may take about a minute.')}</p>
        </div>
      )}

      {/* Results */}
      {analysis && !analyzing && (
        <>
          {/* Score summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('درجة المشروعية', 'Legality Score')}</p>
              <p className={`text-3xl font-bold ${analysis.legalityScore >= 70 ? 'text-heading' : analysis.legalityScore >= 50 ? 'text-gold' : 'text-red-600'}`}>
                {analysis.legalityScore}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">/100</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('درجة الخطر', 'Risk Score')}</p>
              <p className={`text-3xl font-bold ${analysis.riskScore <= 30 ? 'text-heading' : analysis.riskScore <= 60 ? 'text-gold' : 'text-red-600'}`}>
                {analysis.riskScore}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">/100</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('إمكانية الإصدار', 'Can Issue?')}</p>
              <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mt-1"
                style={{ background: canIssueBadge.bg, color: canIssueBadge.text }}>
                {canIssueBadge.label}
              </span>
            </div>
          </div>

          {analysis.canIssueTodayRationale && (
            <div className="rounded-lg border p-4 bg-slate-50">
              <p className="text-xs font-semibold text-gray-500 mb-1">{t('المبرر القانوني', 'Legal Rationale')}</p>
              <p className="text-sm text-gray-800 leading-relaxed" dir="rtl">{analysis.canIssueTodayRationale as string}</p>
            </div>
          )}

          {/* Traditional pillars */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-[#1e3a5f]" />
              <h4 className="text-sm font-semibold text-gray-800">
                {t('الأعمدة التقليدية للقانون الإداري', 'Traditional Administrative Law Pillars')}
                <span className="ml-2 text-xs font-normal text-muted-foreground">(6 {t('أعمدة', 'pillars')} • 55%)</span>
              </h4>
            </div>
            <div className="space-y-2">
              {TRADITIONAL_PILLARS.map((pillar) => {
                const result = analysis[pillar.key] as PillarResult | undefined;
                if (!result) return null;
                return <PillarCard key={pillar.key} pillar={pillar} result={result} t={t} />;
              })}
            </div>
          </div>

          {/* AI/Digital pillars */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-purple-600" />
              <h4 className="text-sm font-semibold text-gray-800">
                {t('أعمدة القرارات الرقمية والذكاء الاصطناعي', 'AI & Digital Decision Pillars')}
                <span className="ml-2 text-xs font-normal text-muted-foreground">(10 {t('أعمدة', 'pillars')} • 45%)</span>
              </h4>
            </div>
            <div className="space-y-2">
              {AI_DECISION_PILLARS.map((pillar) => {
                const result = analysis[pillar.key] as PillarResult | undefined;
                if (!result) return null;
                return <PillarCard key={pillar.key} pillar={pillar} result={result} t={t} />;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
