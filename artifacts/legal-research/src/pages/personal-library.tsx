import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { Library, FileText, BookOpen, Bookmark, Trash2, Tag, StickyNote, Upload, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useListDocuments } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { LoadingGrid } from '@/components/ui/loading-card';

interface LibraryItem {
  id: number;
  userId: number;
  sourceType: 'document' | 'legal_source';
  documentId?: number | null;
  legalSourceId?: number | null;
  tags: string;
  notes?: string | null;
  savedAt: string;
  sourceMeta: {
    id: number;
    originalName?: string;
    fileType?: string;
    fileSize?: number;
    title?: string;
    jurisdiction?: string;
    docType?: string;
    year?: number;
  } | null;
}

export default function PersonalLibrary() {
  const t = useT();
  const { canUpload } = useUserContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: documents, isLoading: docsLoading } = useListDocuments();

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'documents' | 'sources'>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/library');
      if (r.ok) { const d = await r.json(); setItems(d.items ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleRemove(id: number) {
    await apiFetch(`/api/library/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
    toast({ title: t('تمت الإزالة من المكتبة', 'Removed from library') });
  }

  async function handleSaveEdit(id: number) {
    const tags = editTags.split(',').map(s => s.trim()).filter(Boolean);
    await apiFetch(`/api/library/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, notes: editNotes }),
    });
    setItems(prev => prev.map(i => i.id === id ? { ...i, tags: JSON.stringify(tags), notes: editNotes } : i));
    setEditingId(null);
    toast({ title: t('تم الحفظ', 'Saved') });
  }

  const filtered = items.filter(item => {
    if (activeTab === 'documents' && item.sourceType !== 'document') return false;
    if (activeTab === 'sources' && item.sourceType !== 'legal_source') return false;
    if (search) {
      const q = search.toLowerCase();
      const name = item.sourceMeta?.originalName ?? item.sourceMeta?.title ?? '';
      return name.toLowerCase().includes(q);
    }
    return true;
  });

  const docCount = items.filter(i => i.sourceType === 'document').length;
  const srcCount = items.filter(i => i.sourceType === 'legal_source').length;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Library className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('مكتبتي الشخصية', 'Personal Library')}</h1>
              <p className="text-sm text-muted-foreground">{t('وثائقك المرفوعة والمصادر القانونية المحفوظة في مكان واحد.', 'Your uploaded documents and saved legal sources in one place.')}</p>
            </div>
          </div>
          {canUpload && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => navigate('/upload')}>
              <Upload className="w-4 h-4" />
              {t('رفع وثيقة', 'Upload')}
            </Button>
          )}
        </div>

        {/* Stats + Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'all',       labelAr: `الكل (${items.length})`,              labelEn: `All (${items.length})` },
            { key: 'documents', labelAr: `وثائقي (${docCount})`,                labelEn: `My Docs (${docCount})` },
            { key: 'sources',   labelAr: `المصادر المحفوظة (${srcCount})`,      labelEn: `Saved Sources (${srcCount})` },
          ] as const).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'}`}
            >
              {t(tab.labelAr, tab.labelEn)}
            </button>
          ))}
          <div className="relative ms-auto">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" aria-hidden />
            <input
              type="text"
              className="border border-border rounded-lg ps-8 pe-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary w-48"
              placeholder={t('بحث...', 'Search...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Items grid */}
        {loading || docsLoading ? (
          <LoadingGrid count={6} />
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
              <Library className="w-8 h-8 text-muted-foreground/30" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                {items.length === 0 ? t('مكتبتك فارغة', 'Your library is empty') : t('لا توجد نتائج', 'No results')}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {items.length === 0
                  ? t('ارفع وثائق أو احفظ مصادر قانونية من صفحات التشريعات.', 'Upload documents or save legal sources from the legislation pages.')
                  : t('جرّب تغيير الفلتر أو بحث مختلف.', 'Try changing the filter or search.')}
              </p>
            </div>
            {items.length === 0 && canUpload && (
              <Button onClick={() => navigate('/upload')} className="gap-1.5">
                <Upload className="w-4 h-4" />
                {t('رفع وثيقة', 'Upload Document')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => {
              const isDoc = item.sourceType === 'document';
              const tags: string[] = (() => { try { return JSON.parse(item.tags) as string[]; } catch { return []; } })();
              const title = item.sourceMeta?.originalName ?? item.sourceMeta?.title ?? (isDoc ? t('وثيقة', 'Document') : t('مصدر', 'Source'));
              const sub = isDoc
                ? `${item.sourceMeta?.fileType?.toUpperCase() ?? ''} · ${((item.sourceMeta?.fileSize ?? 0) / 1024).toFixed(0)} KB`
                : `${item.sourceMeta?.jurisdiction ?? ''} · ${item.sourceMeta?.year ?? ''}`;

              return (
                <Card key={item.id} className="border-border hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDoc ? 'bg-primary/8 border border-primary/15' : 'bg-amber-50 border border-amber-200'}`}>
                        {isDoc
                          ? <FileText className="w-4 h-4 text-primary" aria-hidden />
                          : <BookOpen className="w-4 h-4 text-amber-600" aria-hidden />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map(tag => (
                              <span key={tag} className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{item.notes}</p>
                        )}
                      </div>
                    </div>

                    {editingId === item.id ? (
                      <div className="mt-3 space-y-2">
                        <input className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder={t('وسوم (مفصولة بفاصلة)', 'Tags (comma-separated)')}
                          value={editTags} onChange={e => setEditTags(e.target.value)} />
                        <textarea className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                          rows={2} placeholder={t('ملاحظاتك...', 'Your notes...')}
                          value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 text-xs h-7" onClick={() => handleSaveEdit(item.id)}>{t('حفظ', 'Save')}</Button>
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEditingId(null)}>{t('إلغاء', 'Cancel')}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 mt-3">
                        <button type="button"
                          onClick={() => { setEditingId(item.id); setEditNotes(item.notes ?? ''); setEditTags(tags.join(', ')); }}
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg py-1 hover:bg-muted/20 transition-colors">
                          <StickyNote className="w-3 h-3" />{t('تعديل', 'Edit')}
                        </button>
                        <button type="button"
                          onClick={() => handleRemove(item.id)}
                          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-destructive border border-border rounded-lg px-2 py-1 hover:bg-destructive/5 transition-colors"
                          aria-label={t('إزالة', 'Remove')}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Uploaded documents not in library */}
            {activeTab !== 'sources' && documents && documents.filter(d => !items.some(i => i.documentId === d.id)).map(doc => (
              <Card key={`upload-${doc.id}`} className="border-border border-dashed opacity-70 hover:opacity-100 hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground truncate">{doc.originalName}</p>
                      <p className="text-xs text-muted-foreground/70">{doc.fileType.toUpperCase()} · {(doc.fileSize / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={async () => {
                      const r = await apiFetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceType: 'document', documentId: doc.id }) });
                      if (r.ok) { fetchItems(); toast({ title: t('تمت الإضافة', 'Added') }); }
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg py-1.5 hover:bg-muted/20 transition-colors">
                    <Bookmark className="w-3 h-3" />{t('إضافة إلى مكتبتي', 'Add to my library')}
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
