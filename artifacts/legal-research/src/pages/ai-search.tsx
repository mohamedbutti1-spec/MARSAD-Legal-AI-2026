import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAiSearch, useListDocuments } from '@workspace/api-client-react';
import { BrainCircuit, Search, FileText, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/lib/user-context';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function AiSearch() {
  const { canUseAi } = useUserContext();
  const [query, setQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  
  const { data: documents } = useListDocuments();
  const searchMutation = useAiSearch();

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMutation.mutate({
      data: {
        query,
        documentIds: selectedDocs.length > 0 ? selectedDocs : undefined
      }
    });
  };

  const toggleDoc = (id: number) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
    );
  };

  if (!canUseAi) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <BrainCircuit className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-foreground">AI Features Disabled</h2>
          <p className="text-muted-foreground mt-2">You do not have permission to use AI capabilities.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto" dir="auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <BrainCircuit className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">AI Smart Search <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ بحث ذكي</span></h1>
          <p className="text-muted-foreground mt-3 font-serif max-w-2xl mx-auto">
            Interrogate your legal library. The AI will synthesize answers based directly on the documents you specify.
          </p>
        </div>

        <Card className="border-primary/20 shadow-md">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">Legal Query</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-muted-foreground w-5 h-5" />
                  <textarea 
                    className="w-full min-h-[120px] bg-background border border-input rounded-md p-3 pl-10 text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="E.g., What are the conditions for contract termination under UAE Civil Transactions Law vs French Civil Code?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              <Collapsible className="border rounded-md">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" /> 
                    Target Specific Documents {selectedDocs.length > 0 && <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{selectedDocs.length} selected</span>}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="p-3 border-t max-h-60 overflow-y-auto bg-background space-y-1">
                  {documents?.map(doc => (
                    <label key={doc.id} className="flex items-center gap-3 p-2 hover:bg-muted/30 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-input text-primary focus:ring-primary"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => toggleDoc(doc.id)}
                      />
                      <span className="text-sm text-foreground truncate">{doc.filename}</span>
                    </label>
                  ))}
                  {documents?.length === 0 && <p className="text-sm text-muted-foreground">No documents available.</p>}
                </CollapsibleContent>
              </Collapsible>

              <Button 
                className="w-full py-6 text-lg font-serif" 
                onClick={handleSearch}
                disabled={!query.trim() || searchMutation.isPending}
              >
                {searchMutation.isPending ? 'Analyzing Documents...' : 'Generate Answer'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {searchMutation.data && (
          <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-card">
              <CardHeader className="bg-primary/5 border-b border-border/50 pb-4">
                <CardTitle className="font-serif text-xl flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-primary" /> Synthesized Answer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="prose prose-sm md:prose-base prose-slate dark:prose-invert max-w-none font-serif leading-relaxed">
                  {searchMutation.data.summary}
                </div>
              </CardContent>
            </Card>

            <h3 className="font-serif font-bold text-lg text-foreground pt-4 border-t">Sourced Excerpts <span className="text-muted-foreground font-sans font-normal text-sm ml-2">/ المصادر</span></h3>
            <div className="grid gap-4">
              {searchMutation.data.results.map((hit, idx) => (
                <Card key={idx} className="bg-muted/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">{hit.filename}</span>
                      </div>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-bold tracking-wider">
                        Score: {(hit.relevance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground italic pl-4 border-l-2 border-primary/30">
                      "{hit.excerpt}"
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
