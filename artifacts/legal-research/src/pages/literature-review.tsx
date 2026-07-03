import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGenerateLiteratureReview, useListDocuments } from '@workspace/api-client-react';
import { BookOpenText, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/lib/user-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LiteratureReview() {
  const { canUseAi } = useUserContext();
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('english');
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  
  const { data: documents } = useListDocuments();
  const reviewMutation = useGenerateLiteratureReview();

  const handleGenerate = () => {
    if (!topic.trim() || selectedDocs.length === 0) return;
    reviewMutation.mutate({
      data: {
        topic,
        documentIds: selectedDocs,
        language
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
          <h2 className="text-xl font-bold text-foreground">AI Features Disabled</h2>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Literature Review <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ مراجعة أدبيات</span></h1>
          <p className="text-muted-foreground mt-2 font-serif">Automatically compile academic literature reviews from selected texts.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">1. Select Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {documents?.map(doc => (
                  <label key={doc.id} className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${selectedDocs.includes(doc.id) ? 'bg-primary/5 border-primary' : 'bg-card hover:bg-muted/50'}`}>
                    <input 
                      type="checkbox" 
                      className="mt-1 rounded border-input text-primary focus:ring-primary"
                      checked={selectedDocs.includes(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground block truncate">{doc.filename}</span>
                      <span className="text-xs text-muted-foreground uppercase">{doc.fileType}</span>
                    </div>
                  </label>
                ))}
                {documents?.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">No documents available.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">2. Define Topic</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea 
                  className="w-full min-h-[100px] bg-background border border-input rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter the specific research topic or thesis..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="arabic">Arabic</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  className="w-full" 
                  onClick={handleGenerate}
                  disabled={!topic.trim() || selectedDocs.length === 0 || reviewMutation.isPending}
                >
                  {reviewMutation.isPending ? 'Drafting Review...' : 'Generate Review'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full min-h-[500px] border-primary/20">
              <CardHeader className="bg-muted/20 border-b">
                <CardTitle className="flex items-center gap-2 font-serif">
                  <BookOpenText className="w-5 h-5 text-primary" /> Generated Output
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 relative">
                {reviewMutation.isPending ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm z-10 rounded-b-lg">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                    <p className="font-serif font-medium text-lg">Synthesizing literature...</p>
                    <p className="text-sm text-muted-foreground mt-1">This takes a moment for rigorous analysis.</p>
                  </div>
                ) : null}

                {!reviewMutation.data && !reviewMutation.isPending ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center opacity-50">
                    <BookOpenText className="w-16 h-16 mb-4" />
                    <p>Select sources and define a topic to generate a comprehensive literature review.</p>
                  </div>
                ) : reviewMutation.data ? (
                  <div className="animate-in fade-in duration-500">
                    <div className="mb-6 pb-6 border-b border-border/50">
                      <h2 className="text-2xl font-serif font-bold mb-2">{reviewMutation.data.topic}</h2>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {reviewMutation.data.sources.map(source => (
                          <span key={source} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded font-medium">
                            <CheckCircle2 className="w-3 h-3 text-primary" /> {source}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="prose prose-sm md:prose-base prose-slate dark:prose-invert max-w-none font-serif leading-loose whitespace-pre-wrap">
                      {reviewMutation.data.review}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
