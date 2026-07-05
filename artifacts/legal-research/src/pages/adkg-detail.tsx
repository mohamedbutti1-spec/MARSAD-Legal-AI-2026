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
  Clock, BarChart3, FileText, Plus, Trash2,
} from 'lucide-react';
import { DecisionGraph } from '@/components/adkg/decision-graph';
import { DecisionTimeline } from '@/components/adkg/decision-timeline';
import { AddLinkDialog, type LinkFormData } from '@/components/adkg/add-link-dialog';

interface Decision {
  id: number; decisionNumber: string; title: string; titleAr: string;
  issuerOrg?: string | null; issuerOrgAr?: string | null;
  subject?: string | null; subjectAr?: string | null;
  status: string; issuedDate?: string | null; effectiveDate?: string | null; expiryDate?: string | null;
  content: Record<string, unknown>; citedAuthorities: unknown[];
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

type TabId = 'overview' | 'relationships' | 'timeline' | 'graph';

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

const AUTH_COLORS: Record<string, string> = { binding:'bg-green-100 text-green-800', persuasive:'bg-blue-100 text-blue-800', non_binding:'bg-gray-100 text-gray-700' };
const LINK_LABELS: Record<string, string> = { legislation:'تشريع', exec_regulation:'لائحة تنفيذية', cabinet_decision:'قرار مجلس الوزراء', ministerial_decision:'قرار وزاري', case_law:'قضاء', legal_principle:'مبدأ قانوني', legal_opinion:'رأي قانوني', research_project:'مشروع بحثي', other_decision:'قرار آخر', other:'أخرى' };

const EVENT_TYPES = ['draft','issued','challenged','suspended','amended','revoked','annulled','executed','appeal_filed','appeal_dismissed','appeal_upheld','court_referral','publication','custom'];
const REL_TYPES = ['amends','challenged_by','suspended_by','revoked_by','annulled_by','executes','references','replaces','implements','appeals'];

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

  const TABS: { id: TabId; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    { id: 'overview',       labelAr: 'نظرة عامة',     labelEn: 'Overview',       icon: <FileText className="w-4 h-4" /> },
    { id: 'relationships',  labelAr: 'العلاقات',      labelEn: 'Relationships',   icon: <Link2 className="w-4 h-4" /> },
    { id: 'timeline',       labelAr: 'الجدول الزمني', labelEn: 'Timeline',        icon: <Clock className="w-4 h-4" /> },
    { id: 'graph',          labelAr: 'الرسم البياني', labelEn: 'Graph',           icon: <Network className="w-4 h-4" /> },
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
            {authorities.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">{t('مصادر الاستشهاد الآلية', 'AI-Verified Cited Authorities')}</h3>
                <ul className="space-y-1.5">
                  {authorities.map((a, i) => {
                    const cls = a.authorityClass as string ?? 'persuasive';
                    const conf = typeof a.confidenceScore === 'number' ? `${Math.round(a.confidenceScore * 100)}%` : '—';
                    return (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 text-gray-800">{a.titleAr as string}</span>
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
