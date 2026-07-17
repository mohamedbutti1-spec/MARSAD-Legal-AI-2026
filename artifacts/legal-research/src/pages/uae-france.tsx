import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUaeFranceCompare, useListDocuments } from '@workspace/api-client-react';
import { Scale, ChevronRight, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/lib/user-context';

export default function UaeFrance() {
  const { canUseAi } = useUserContext();
  const [topic, setTopic] = useState('');
  const compareMutation = useUaeFranceCompare();

  const handleCompare = () => {
    if (!topic.trim()) return;
    compareMutation.mutate({
      data: { topic }
    });
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
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="w-12 h-8 rounded shadow-sm overflow-hidden flex">
              <div className="w-1/3 bg-heading"></div><div className="w-1/3 bg-card"></div><div className="w-1/3 bg-black"></div>
            </div>
            <Scale className="w-8 h-8 text-primary" />
            <div className="w-12 h-8 rounded shadow-sm overflow-hidden flex">
              <div className="w-1/3 bg-heading"></div><div className="w-1/3 bg-card"></div><div className="w-1/3 bg-destructive"></div>
            </div>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">UAE vs France Legal Analysis</h1>
          <p className="text-muted-foreground mt-3 font-serif">
            A specialized comparative engine analyzing civil and commercial law principles between the United Arab Emirates and the French Republic.
          </p>
        </div>

        <Card className="max-w-3xl mx-auto mb-8">
          <CardContent className="p-6 flex gap-4">
            <input 
              type="text"
              className="flex-1 bg-background border border-input rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-serif"
              placeholder="Enter legal principle (e.g., Force Majeure, Good Faith in Contracts)..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
            />
            <Button onClick={handleCompare} disabled={!topic.trim() || compareMutation.isPending} className="px-8">
              {compareMutation.isPending ? 'Analyzing...' : 'Compare'}
            </Button>
          </CardContent>
        </Card>

        {compareMutation.data && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* UAE Panel */}
              <Card className="border-t-4 border-t-heading">
                <CardHeader className="bg-muted/10 pb-4">
                  <CardTitle className="font-serif text-xl flex items-center justify-between">
                    UAE Law Application
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-background px-2 py-1 rounded border">Civil Transactions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="prose prose-sm md:prose-base prose-slate dark:prose-invert font-serif leading-relaxed">
                    {compareMutation.data.uaeAnalysis}
                  </div>
                </CardContent>
              </Card>

              {/* France Panel */}
              <Card className="border-t-4 border-t-blue-700">
                <CardHeader className="bg-muted/10 pb-4">
                  <CardTitle className="font-serif text-xl flex items-center justify-between">
                    French Law Application
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-background px-2 py-1 rounded border">Code Civil</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="prose prose-sm md:prose-base prose-slate dark:prose-invert font-serif leading-relaxed">
                    {compareMutation.data.franceAnalysis}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Key Similarities</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {compareMutation.data.similarities.map((item, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <Check className="w-5 h-5 text-heading shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Core Differences</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {compareMutation.data.differences.map((item, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <ChevronRight className="w-5 h-5 text-destructive shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="lg:col-span-1 bg-primary text-primary-foreground">
                <CardHeader>
                  <CardTitle className="text-lg text-primary-foreground">Synthesis Conclusion</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-primary-foreground/90 font-serif">
                    {compareMutation.data.conclusion}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
