import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useListDocuments, useDeleteDocument, useUpdateDocument, getListDocumentsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Trash2, Calendar, File, Tag } from 'lucide-react';
import { useUserContext } from '@/lib/user-context';
import { useQueryClient } from '@tanstack/react-query';
import { DocumentComments } from '@/components/document-comments';

type Category = 'protocol' | 'thesis' | 'marsad' | 'presentations' | 'research' | 'uncategorized';

const CATEGORIES: { value: Category; labelEn: string; labelAr: string; color: string }[] = [
  { value: 'protocol',        labelEn: 'Protocol',       labelAr: 'بروتوكول',    color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'thesis',          labelEn: 'Thesis',         labelAr: 'رسالة',       color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'marsad',          labelEn: 'MARSAD',         labelAr: 'مرصد',        color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'presentations',   labelEn: 'Presentations',  labelAr: 'عروض',        color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'research',        labelEn: 'Research',       labelAr: 'بحث',         color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 'uncategorized',   labelEn: 'Uncategorized',  labelAr: 'غير مصنف',   color: 'bg-muted text-muted-foreground border-border' },
];

function getCategoryMeta(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function Documents() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [recategorizing, setRecategorizing] = useState<number | null>(null);
  const { role, canUpload } = useUserContext();
  const queryClient = useQueryClient();

  // Fetch with current filters
  const { data: documents, isLoading } = useListDocuments({
    search: search || undefined,
    type: type !== 'all' ? type : undefined,
    category: activeCategory !== 'all' ? activeCategory : undefined,
  });

  // Fetch all docs (no filters) to compute per-category counts for the sidebar
  const { data: allDocuments } = useListDocuments({});

  const deleteDoc = useDeleteDocument();
  const updateDoc = useUpdateDocument();

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteDoc.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        }
      });
    }
  };

  const handleRecategorize = (id: number, category: Category) => {
    updateDoc.mutate({ id, data: { category } }, {
      onSuccess: () => {
        setRecategorizing(null);
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      }
    });
  };

  // Per-category counts from allDocuments
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: allDocuments?.length ?? 0 };
    for (const cat of CATEGORIES) counts[cat.value] = 0;
    for (const doc of allDocuments ?? []) {
      const cat = (doc as any).category ?? 'uncategorized';
      if (counts[cat] !== undefined) counts[cat]++;
      else counts['uncategorized']++;
    }
    return counts;
  }, [allDocuments]);

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">
              Document Library{' '}
              <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ المكتبة</span>
            </h1>
            <p className="text-muted-foreground mt-2 font-serif">Browse and manage your legal research repository.</p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60'
            }`}
          >
            All ({categoryCounts.all})
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                activeCategory === cat.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60'
              }`}
            >
              {cat.labelEn} ({categoryCounts[cat.value] ?? 0})
            </button>
          ))}
        </div>

        {/* Search + type filter */}
        <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-md border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search documents by name or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">Word (DOCX)</SelectItem>
              <SelectItem value="txt">Text (TXT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : documents?.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-md bg-muted/10">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-1">No documents found</h3>
            <p className="text-muted-foreground">Adjust your search or upload new files.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {documents?.map(doc => {
              const docCategory = ((doc as any).category ?? 'uncategorized') as Category;
              const catMeta = getCategoryMeta(docCategory);
              const isRecategorizing = recategorizing === doc.id;

              return (
                <Card key={doc.id} className="hover:border-primary/50 transition-colors group">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center text-secondary-foreground shrink-0">
                        <File className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{doc.originalName ?? doc.filename}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="uppercase font-bold tracking-wider">{doc.fileType}</span>
                          </span>
                          <span className="flex items-center gap-1">• {(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {/* Category badge */}
                        <div className="mt-1.5 flex items-center gap-2">
                          {canUpload && isRecategorizing ? (
                            <Select
                              value={docCategory}
                              onValueChange={(val) => handleRecategorize(doc.id, val as Category)}
                            >
                              <SelectTrigger className="h-6 text-xs px-2 w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(c => (
                                  <SelectItem key={c.value} value={c.value} className="text-xs">
                                    {c.labelEn} / {c.labelAr}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${canUpload ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'} ${catMeta.color}`}
                              title={canUpload ? 'Click to change category' : undefined}
                              onClick={() => canUpload && setRecategorizing(doc.id)}
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {catMeta.labelEn}
                            </span>
                          )}
                          {canUpload && isRecategorizing && (
                            <button
                              className="text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() => setRecategorizing(null)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.keywords && (
                        <div className="hidden lg:flex gap-1 mr-2">
                          {doc.keywords.split(',').slice(0, 3).map(kw => (
                            <span
                              key={kw}
                              className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider"
                            >
                              {kw.trim()}
                            </span>
                          ))}
                        </div>
                      )}

                      <DocumentComments documentId={doc.id} documentName={doc.originalName ?? doc.filename} />

                      {role === 'owner' && (
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={deleteDoc.isPending}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 md:opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
