import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useListComparisons, useCreateComparison, useDeleteComparison, getListComparisonsQueryKey } from '@workspace/api-client-react';
import { TableProperties, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useUserContext } from '@/lib/user-context';

export default function Comparisons() {
  const { data: comparisons, isLoading } = useListComparisons();
  const createMutation = useCreateComparison();
  const deleteMutation = useDeleteComparison();
  const queryClient = useQueryClient();
  const { role } = useUserContext();
  
  const [newTitle, setNewTitle] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    
    // Default empty structure
    const initialRows = JSON.stringify([
      { aspect: "Scope", uae: "", france: "" },
      { aspect: "Conditions", uae: "", france: "" }
    ]);

    createMutation.mutate({
      data: { title: newTitle, rows: initialRows }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListComparisonsQueryKey() });
        setIsOpen(false);
        setNewTitle('');
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this comparison table?')) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListComparisonsQueryKey() });
        }
      });
    }
  };

  const parseRows = (rowsStr: string | null | undefined) => {
    if (!rowsStr) return [];
    try { return JSON.parse(rowsStr); } catch { return []; }
  };

  return (
    <AppLayout>
      <div className="space-y-6" dir="auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Comparison Tables <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ جداول مقارنة</span></h1>
            <p className="text-muted-foreground mt-2 font-serif">Manual structured analysis grids.</p>
          </div>
          {role === 'owner' && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> New Table</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Comparison Table</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <input 
                    className="w-full bg-background border border-input rounded p-2 focus:ring-2 focus:ring-primary"
                    placeholder="Table Title"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                  />
                  <Button onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending} className="w-full">
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4"><div className="h-64 bg-muted rounded-lg"></div></div>
        ) : comparisons?.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-lg bg-muted/5">
            <TableProperties className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-1">No tables created</h3>
            <p className="text-muted-foreground text-sm">Create a new manual comparison table to get started.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {comparisons?.map(comp => {
              const rows = parseRows(comp.rows);
              return (
                <Card key={comp.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b flex flex-row items-center justify-between py-4">
                    <CardTitle className="font-serif text-xl">{comp.title}</CardTitle>
                    {role === 'owner' && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(comp.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Mobile: stacked cards per row */}
                    <div className="sm:hidden divide-y divide-border">
                      {rows.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Empty table</p>
                      ) : rows.map((row: any, i: number) => (
                        <div key={i} className="p-4 space-y-3">
                          {row.aspect && (
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{row.aspect}</p>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-bold text-gold uppercase mb-1">UAE</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{row.uae || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">France</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{row.france || '—'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop: scrollable table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm text-left min-w-[600px]">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/10">
                          <tr>
                            <th className="px-4 py-3 font-semibold w-1/4">Aspect of Law</th>
                            <th className="px-4 py-3 font-semibold w-3/8 border-l">UAE Perspective</th>
                            <th className="px-4 py-3 font-semibold w-3/8 border-l">French Perspective</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row: any, i: number) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/5">
                              <td className="px-4 py-3 font-medium">{row.aspect || '-'}</td>
                              <td className="px-4 py-3 border-l whitespace-pre-wrap">{row.uae || '-'}</td>
                              <td className="px-4 py-3 border-l whitespace-pre-wrap">{row.france || '-'}</td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Empty table</td></tr>
                          )}
                        </tbody>
                      </table>
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
