import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, History, ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { StaleCitationBanner } from '@/components/workspace/stale-citation-banner';
import { AnswerProvenance } from '@/components/workspace/answer-provenance';

interface Item {
  id: number;
  projectId: number;
  folderId: number | null;
  itemType: string;
  title: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface AnswerMeta {
  citedAuthorities: Array<Record<string, unknown>>;
  verificationReport: Record<string, unknown>;
  confidenceLevel: number | null;
  retrievalInventory: Record<string, unknown>;
  generationTimestamp: string | null;
  modelVersion: string | null;
}

interface Staleness {
  isStale: boolean;
  reason: string | null;
  lastCheckedAt: string | null;
  checkedNow: boolean;
}

interface Version {
  id: number;
  versionNumber: number;
  content: Record<string, unknown>;
  changedAt: string;
}

const ITEM_TYPE_COLORS: Record<string, string> = {
  question:       'bg-purple-100 text-purple-800',
  answer:         'bg-blue-100 text-blue-800',
  authority:      'bg-green-100 text-green-800',
  document:       'bg-amber-100 text-amber-800',
  note:           'bg-gray-100 text-gray-800',
  highlight:      'bg-yellow-100 text-yellow-800',
  bookmark:       'bg-red-100 text-red-800',
  timeline_entry: 'bg-indigo-100 text-indigo-800',
};
const ITEM_TYPE_AR: Record<string, string> = {
  question: 'سؤال', answer: 'جواب', authority: 'سلطة قانونية', document: 'وثيقة',
  note: 'ملاحظة', highlight: 'تظليل', bookmark: 'إشارة مرجعية', timeline_entry: 'إدخال زمني',
};

export default function WorkspaceItem() {
  const t = useT();
  const params = useParams<{ projectId: string; itemId: string }>();
  const projectId = parseInt(params.projectId, 10);
  const itemId    = parseInt(params.itemId, 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [showHistory, setShowHistory]   = useState(false);
  const [editing, setEditing]           = useState(false);
  const [editTitle, setEditTitle]       = useState('');
  const [editBody, setEditBody]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [staleSuppressed, setStaleSuppressed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workspace.item', projectId, itemId],
    queryFn: () =>
      apiFetch(`/api/research/workspace/projects/${projectId}/items/${itemId}`).then((r) => r.json()) as Promise<{
        item: Item; answerMeta: AnswerMeta | null; staleness: Staleness | null;
      }>,
  });

  const { data: versionsData } = useQuery({
    queryKey: ['workspace.item.versions', projectId, itemId],
    queryFn: () =>
      apiFetch(`/api/research/workspace/projects/${projectId}/items/${itemId}/versions`).then((r) => r.json()) as Promise<{ versions: Version[] }>,
    enabled: showHistory,
  });

  const updateMut = useMutation({
    mutationFn: (body: { title: string; content: Record<string, unknown> }) =>
      apiFetch(`/api/research/workspace/projects/${projectId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace.item', projectId, itemId] });
      setEditing(false);
    },
  });

  function startEdit() {
    if (!data?.item) return;
    setEditTitle(data.item.title);
    setEditBody((data.item.content.text as string) || '');
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateMut.mutateAsync({ title: editTitle, content: { text: editBody } });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const { item, answerMeta, staleness } = data ?? {};

  if (!item) {
    return (
      <AppLayout>
        <p className="text-muted-foreground py-20 text-center">{t('العنصر غير موجود', 'Item not found')}</p>
      </AppLayout>
    );
  }

  const showStale = staleness?.isStale && !staleSuppressed;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        {/* Back navigation */}
        <button
          onClick={() => navigate(`/workspace/${projectId}`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[#1e3a5f] transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('العودة إلى المشروع', 'Back to Project')}
        </button>

        {/* Stale citation banner */}
        {showStale && (
          <StaleCitationBanner
            projectId={projectId}
            itemId={itemId}
            reason={staleness?.reason ?? null}
            onReviewed={() => {
              setStaleSuppressed(true);
              qc.invalidateQueries({ queryKey: ['workspace.item', projectId, itemId] });
            }}
          />
        )}

        {/* Item header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xl font-bold text-[#1e3a5f] border-b-2 border-blue-300 bg-transparent focus:outline-none pb-1"
                dir="auto"
              />
            ) : (
              <h1 className="text-xl font-bold text-[#1e3a5f] leading-tight">{item.title}</h1>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge className={`text-xs ${ITEM_TYPE_COLORS[item.itemType] ?? 'bg-gray-100 text-gray-700'}`}>
                {t(ITEM_TYPE_AR[item.itemType] ?? item.itemType, item.itemType)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t('النسخة', 'Version')} {item.versionNumber}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('آخر تعديل', 'Updated')} {new Date(item.updatedAt).toLocaleDateString('ar-AE')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white gap-1">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {t('حفظ', 'Save')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>
                {t('تعديل', 'Edit')}
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg border bg-card p-4 mb-4">
          {editing ? (
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={10}
              className="w-full text-sm text-gray-800 bg-transparent focus:outline-none resize-none leading-relaxed"
              dir="auto"
              placeholder={t('المحتوى…', 'Content…')}
            />
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap" dir="auto">
              {(item.content.text as string) || (item.content.body as string) || (
                <span className="text-muted-foreground italic">{t('لا يوجد محتوى', 'No content')}</span>
              )}
            </p>
          )}
        </div>

        {/* Answer Provenance */}
        {item.itemType === 'answer' && answerMeta && (
          <div className="mb-4">
            <AnswerProvenance
              citedAuthorities={answerMeta.citedAuthorities as Array<Record<string, unknown>>}
              verificationReport={answerMeta.verificationReport}
              confidenceLevel={answerMeta.confidenceLevel}
              retrievalInventory={answerMeta.retrievalInventory}
              generationTimestamp={answerMeta.generationTimestamp}
              modelVersion={answerMeta.modelVersion}
            />
          </div>
        )}

        {/* Version History */}
        <div className="rounded-lg border bg-card">
          <button
            onClick={() => setShowHistory((h) => !h)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-muted/40 transition-colors rounded-lg"
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              {t('سجل النسخ', 'Version History')}
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHistory && (
            <div className="px-4 pb-3 border-t">
              {!versionsData ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : versionsData.versions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  {t('لا توجد نسخ سابقة', 'No previous versions')}
                </p>
              ) : (
                <ul className="divide-y mt-1">
                  {versionsData.versions.map((v) => (
                    <li key={v.id} className="py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">
                          {t('النسخة', 'Version')} {v.versionNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.changedAt).toLocaleString('ar-AE')}
                        </span>
                      </div>
                      {typeof v.content.text === 'string' && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2" dir="auto">
                          {v.content.text}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
