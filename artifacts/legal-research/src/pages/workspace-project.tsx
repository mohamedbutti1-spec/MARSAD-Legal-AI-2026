import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT } from '@/lib/user-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, FolderPlus, ChevronLeft, FolderOpen, Loader2,
  FileText, Download, ChevronDown, ChevronRight, Trash2,
} from 'lucide-react';
import { ItemEditorDialog } from '@/components/workspace/item-editor-dialog';
import { SearchPanel } from '@/components/workspace/search-panel';

interface Project { id: number; title: string; description: string | null; status: string }
interface Folder  { id: number; projectId: number; parentFolderId: number | null; name: string; position: number }
interface Item    { id: number; projectId: number; folderId: number | null; itemType: string; title: string; versionNumber: number; createdAt: string; updatedAt: string }

const ITEM_TYPE_COLORS: Record<string, string> = {
  question:       'bg-heading/15 text-heading',
  answer:         'bg-heading/15 text-heading',
  authority:      'bg-heading/15 text-heading/75',
  document:       'bg-gold/15 text-gold/75',
  note:           'bg-muted/60 text-foreground',
  highlight:      'bg-gold/15 text-gold/75',
  bookmark:       'bg-destructive/15 text-destructive',
  timeline_entry: 'bg-heading/15 text-heading',
};
const ITEM_TYPE_AR: Record<string, string> = {
  question: 'سؤال', answer: 'جواب', authority: 'سلطة', document: 'وثيقة',
  note: 'ملاحظة', highlight: 'تظليل', bookmark: 'إشارة', timeline_entry: 'زمني',
};

export default function WorkspaceProject() {
  const t = useT();
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId, 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [activeFolderId, setActiveFolderId]   = useState<number | null | 'all'>('all');
  const [showNewItem, setShowNewItem]         = useState(false);
  const [showNewFolder, setShowNewFolder]     = useState(false);
  const [newFolderName, setNewFolderName]     = useState('');
  const [folderCreating, setFolderCreating]   = useState(false);
  const [showSearch, setShowSearch]           = useState(false);
  const [showExport, setShowExport]           = useState(false);
  const [exportLoading, setExportLoading]     = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['workspace.project', projectId],
    queryFn: () =>
      apiFetch(`/api/research/workspace/projects/${projectId}`).then((r) => r.json()) as Promise<{
        project: Project; folders: Folder[]; items: Item[];
      }>,
  });

  const createItemMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/research/workspace/projects/${projectId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace.project', projectId] }),
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: number) =>
      apiFetch(`/api/research/workspace/projects/${projectId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace.project', projectId] }),
  });

  const { project, folders = [], items = [] } = data ?? {};

  const visibleItems = items.filter((item) => {
    if (activeFolderId === 'all') return true;
    return item.folderId === activeFolderId;
  });

  async function handleNewFolder() {
    if (!newFolderName.trim()) return;
    setFolderCreating(true);
    try {
      const r = await apiFetch(`/api/research/workspace/projects/${projectId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ['workspace.project', projectId] });
        setShowNewFolder(false); setNewFolderName('');
      }
    } finally {
      setFolderCreating(false);
    }
  }

  async function handleExport(format: string) {
    setExportLoading(true);
    try {
      const r = await apiFetch(`/api/research/workspace/projects/${projectId}/export?format=${format}`);
      if (r.ok) {
        const blob = await r.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `project-${projectId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExportLoading(false);
      setShowExport(false);
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

  if (!project) {
    return (
      <AppLayout>
        <p className="text-muted-foreground py-20 text-center">{t('المشروع غير موجود', 'Project not found')}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => navigate('/workspace')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-heading transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('مساحة البحث', 'Workspace')}
        </button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-bold text-heading flex-1 min-w-0 truncate">{project.title}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowSearch((s) => !s)}>
            {t('بحث', 'Search')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            <Download className="w-4 h-4 ml-1" />
            {t('تصدير', 'Export')}
          </Button>
          <Button size="sm" onClick={() => setShowNewItem(true)} className="bg-primary hover:opacity-90 text-white gap-1">
            <Plus className="w-4 h-4" />
            {t('عنصر جديد', 'New Item')}
          </Button>
        </div>
      </div>

      {/* Search panel (collapsible) */}
      {showSearch && (
        <div className="mb-4 rounded-lg border bg-card p-4">
          <SearchPanel projectId={projectId} onResultClick={(r) => navigate(`/workspace/${projectId}/items/${r.id}`)} />
        </div>
      )}

      <div className="flex gap-4">
        {/* Folder sidebar */}
        <div className="w-48 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('المجلدات', 'Folders')}
            </span>
            <button onClick={() => setShowNewFolder(true)} className="text-muted-foreground hover:text-heading transition-colors" title={t('مجلد جديد', 'New Folder')}>
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          <ul className="space-y-0.5">
            <li>
              <button
                onClick={() => setActiveFolderId('all')}
                className={`w-full text-start text-sm px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeFolderId === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('الكل', 'All')}</span>
                <span className={`text-xs ms-auto ${activeFolderId === 'all' ? 'text-white/70' : 'text-muted-foreground'}`}>{items.length}</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveFolderId(null)}
                className={`w-full text-start text-sm px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeFolderId === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('الجذر', 'Root')}</span>
                <span className={`text-xs ms-auto ${activeFolderId === null ? 'text-white/70' : 'text-muted-foreground'}`}>{items.filter((i) => i.folderId === null).length}</span>
              </button>
            </li>
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  onClick={() => setActiveFolderId(folder.id)}
                  className={`w-full text-start text-sm px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeFolderId === folder.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                  <span className={`text-xs ms-auto ${activeFolderId === folder.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {items.filter((i) => i.folderId === folder.id).length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Item list */}
        <div className="flex-1 min-w-0">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/20">
              <FileText className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t('لا توجد عناصر', 'No items here')}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowNewItem(true)}>
                <Plus className="w-4 h-4 ml-1" />
                {t('أضف عنصراً', 'Add Item')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border rounded-lg px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors group"
                  onClick={() => navigate(`/workspace/${projectId}/items/${item.id}`)}
                >
                  <FileText className="w-4 h-4 text-heading shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('النسخة', 'v')}{item.versionNumber} · {new Date(item.updatedAt).toLocaleDateString('ar-AE')}
                    </p>
                  </div>
                  <Badge className={`text-xs shrink-0 ${ITEM_TYPE_COLORS[item.itemType] ?? 'bg-muted/60 text-muted-foreground'}`}>
                    {t(ITEM_TYPE_AR[item.itemType] ?? item.itemType, item.itemType)}
                  </Badge>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(t('حذف هذا العنصر؟', 'Delete this item?'))) deleteItemMut.mutate(item.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title={t('حذف', 'Delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Item Dialog */}
      <ItemEditorDialog
        open={showNewItem}
        onClose={() => setShowNewItem(false)}
        folders={folders}
        onSave={async (data) => { await createItemMut.mutateAsync(data as Record<string, unknown>); setShowNewItem(false); }}
      />

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={(o) => { if (!o) { setShowNewFolder(false); setNewFolderName(''); } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>{t('مجلد جديد', 'New Folder')}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
              placeholder={t('اسم المجلد…', 'Folder name…')}
              dir="auto"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} disabled={folderCreating}>{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleNewFolder} disabled={folderCreating} className="bg-primary hover:opacity-90 text-white">
              {folderCreating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {t('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader><DialogTitle>{t('تصدير المشروع', 'Export Project')}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            {(['pdf', 'docx', 'md'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={exportLoading}
                className="w-full text-start px-4 py-3 rounded-lg border hover:bg-muted transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-heading" />
                <div>
                  <p className="text-sm font-medium">{fmt.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt === 'pdf'  ? t('ملف PDF مع مصادر الاستشهاد', 'PDF with citation provenance')
                   : fmt === 'docx' ? t('وثيقة Word قابلة للتعديل', 'Editable Word document')
                   :                  t('ملف Markdown نصي', 'Plain Markdown text')}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {exportLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('جارٍ التصدير…', 'Exporting…')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
