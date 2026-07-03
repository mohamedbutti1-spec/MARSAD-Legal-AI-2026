import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGenerateCitation, useListDocuments } from '@workspace/api-client-react';
import { Quote, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Citations() {
  const { data: documents } = useListDocuments();
  const citationMutation = useGenerateCitation();
  
  const [docId, setDocId] = useState<string>('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const [publisher, setPublisher] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    if (!docId) return;
    citationMutation.mutate({
      data: {
        documentId: parseInt(docId),
        authorName: author || undefined,
        publicationYear: year ? parseInt(year) : undefined,
        publisher: publisher || undefined
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto" dir="auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Citation Generator <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ التوثيق</span></h1>
          <p className="text-muted-foreground mt-2 font-serif">Generate Harvard-style academic citations for your library documents.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Select Document</label>
                <Select value={docId} onValueChange={setDocId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a document..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documents?.map(doc => (
                      <SelectItem key={doc.id} value={doc.id.toString()}>{doc.filename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Author Name (Optional)</label>
                <input 
                  className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g., Al Shamsi, M."
                  value={author} onChange={e => setAuthor(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Year</label>
                  <input 
                    type="number"
                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="2023"
                    value={year} onChange={e => setYear(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Publisher</label>
                  <input 
                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="e.g., Dubai Courts"
                    value={publisher} onChange={e => setPublisher(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={!docId || citationMutation.isPending} className="w-full mt-4">
                Generate Citation
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
              {citationMutation.data ? (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">Harvard Format</span>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(citationMutation.data.citation)}>
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="font-serif text-lg leading-relaxed text-foreground text-left p-4 bg-background border rounded shadow-sm">
                    {citationMutation.data.citation}
                  </p>
                </div>
              ) : (
                <div className="opacity-40">
                  <Quote className="w-16 h-16 mb-4 mx-auto" />
                  <p className="font-serif">Fill details to generate</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
