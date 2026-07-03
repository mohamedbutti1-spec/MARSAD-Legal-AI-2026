import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetDocumentStats } from '@workspace/api-client-react';
import { BookOpen, FileText, UploadCloud, Library } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetDocumentStats();

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ لوحة القيادة</span></h1>
          <p className="text-muted-foreground mt-2 font-serif">Welcome back, Mr. Al Shamsi. Your private library is ready.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-16 bg-muted/20" />
                <CardContent className="h-16" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-destructive/10 text-destructive rounded border border-destructive/20">
            Failed to load dashboard stats.
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Documents</CardTitle>
                <Library className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold text-foreground">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">Files in private library</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Size</CardTitle>
                <FileText className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold text-foreground">{(stats.totalSize / 1024 / 1024).toFixed(1)} <span className="text-xl text-muted-foreground">MB</span></div>
                <p className="text-xs text-muted-foreground mt-1">Storage utilized</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Uploads</CardTitle>
                <UploadCloud className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold text-foreground">{stats.recentUploads}</div>
                <p className="text-xs text-muted-foreground mt-1">In the last 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Document Types</CardTitle>
                <BookOpen className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1.5 mt-2">
                  {stats.byType.map(t => (
                    <div key={t.type} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-muted-foreground">{t.type.toUpperCase()}</span>
                      <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground font-bold">{t.count}</span>
                    </div>
                  ))}
                  {stats.byType.length === 0 && <span className="text-sm text-muted-foreground">No documents</span>}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-serif">Platform Activity <span className="font-sans font-normal text-muted-foreground text-sm ml-2">/ نشاط المنصة</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded bg-muted/5">
                <span className="text-muted-foreground text-sm flex items-center gap-2"><BookOpen className="w-4 h-4"/> Awaiting activity data</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="font-serif text-primary-foreground">Quick AI Search <span className="font-sans font-normal text-primary-foreground/70 text-sm ml-2">/ بحث سريع</span></CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-primary-foreground/80 mb-4">
                Ask a legal question across your entire repository of UAE and French law documents.
              </p>
              <div className="space-y-3">
                <textarea 
                  className="w-full bg-primary-foreground/10 border border-primary-foreground/20 rounded p-3 text-primary-foreground placeholder:text-primary-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary-foreground/50"
                  rows={4}
                  placeholder="Enter legal query..."
                />
                <button className="w-full bg-primary-foreground text-primary py-2 rounded font-bold shadow-sm hover:opacity-90 transition-opacity">
                  Search Library
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
