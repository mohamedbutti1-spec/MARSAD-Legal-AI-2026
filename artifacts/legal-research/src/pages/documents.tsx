import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useListDocuments, useDeleteDocument, getListDocumentsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Trash2, Calendar, File, ShieldAlert } from 'lucide-react';
import { useUserContext } from '@/lib/user-context';
import { useQueryClient } from '@tanstack/react-query';
import { DocumentComments } from '@/components/document-comments';

export default function Documents() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  const { role } = useUserContext();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useListDocuments({
    search: search || undefined,
    type: type !== 'all' ? type : undefined
  });

  const deleteDoc = useDeleteDocument();

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteDoc.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        }
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Document Library <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ المكتبة</span></h1>
            <p className="text-muted-foreground mt-2 font-serif">Browse and manage your legal research repository.</p>
          </div>
        </div>

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
            {[1,2,3].map(i => (
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
            {documents?.map(doc => (
              <Card key={doc.id} className="hover:border-primary/50 transition-colors group">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center text-secondary-foreground shrink-0">
                      <File className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{doc.filename}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="uppercase font-bold tracking-wider">{doc.fileType}</span></span>
                        <span className="flex items-center gap-1">• {(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {doc.keywords && (
                      <div className="hidden lg:flex gap-1 mr-2">
                        {doc.keywords.split(',').slice(0, 3).map(kw => (
                          <span key={kw} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <DocumentComments documentId={doc.id} documentName={doc.filename} />

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
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
