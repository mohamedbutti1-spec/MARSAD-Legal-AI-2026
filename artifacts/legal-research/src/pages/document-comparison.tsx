import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { GitCompareArrows, Loader2, FileText, BookOpen, Sparkles, ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useListDocuments } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

interface CompareRow { aspect: string; sourceA: string; sourceB: string; }
interface CompareResult { title: string; summary: string; rows: CompareRow[]; _meta: Record<string, string> | null; }

type PickerType = 'document' | 'legal_source';

export default function DocumentComparison() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const { data: documents } = useListDocuments();
  const { toast } = useToast();

  const [sideA, setSideA] = useState({ type: 'document' as PickerType, id: '', label: '' });
  const [sideB, setSideB] = useState({ type: 'document' as PickerType, id: '', label: '' });
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [manualRows, setManualRows] = useState<CompareRow[]>([
    { aspect: '', sourceA: '', sourceB: '' },
  ]);
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');

  async function handleAiCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!sideA.id || !sideB.id || !canUseAi) return;
    setLoading(true); setResult(null);
    try {
      const r = await apiFetch('/api/ai/uae-france-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: [parseInt(sideA.id)],
          topic: topic || 'مقارنة قانونية شاملة',
        }),
      });
      if (r.ok) {
        const data = await r.json();
        // Map existing comparisons format to our display format
        let rows: CompareRow[] = [];
        if (data.comparison?.rows) {
          try {
            const parsed = typeof data.comparison.rows === 'string' ? JSON.parse(data.comparison.rows) : data.comparison.rows;
            rows = (parsed as Array<Record<string, string>>).map(row => ({
              aspect:  row.aspect ?? '',
              sourceA: row.uae ?? row.france ?? Object.values(row)[1] as string ?? '',
              sourceB: row.france ?? row.eu ?? Object.values(row)[2] as string ?? '',
            }));
          } catch {}
        }
        setResult({
          title: data.comparison?.title ?? t('نتائج المقارنة', 'Comparison Results'),
          summary: data.comparison?.description ?? '',
          rows,
          _meta: data._meta,
        });
      } else {
        toast({ title: t('فشلت المقارنة', 'Comparison failed'), variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }

  function addRow() { setManualRows(prev => [...prev, { aspect: '', sourceA: '', sourceB: '' }]); }
  function removeRow(i: number) { setManualRows(prev => prev.filter((_, j) => j !== i)); }
  function updateRow(i: number, key: keyof CompareRow, val: string) {
    setManualRows(prev => prev.map((r, j) => j === i ? { ...r, [key]: val } : r));
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    const r = await apiFetch('/api/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: topic || t('مقارنة جديدة', 'New Comparison'),
        description: `${sideA.label} vs ${sideB.label}`,
        rows: JSON.stringify(manualRows.map(row => ({
          aspect: row.aspect,
          uae: row.sourceA,
          france: row.sourceB,
        }))),
      }),
    });
    if (r.ok) {
      toast({ title: t('تم الحفظ', 'Saved!') });
    }
  }

  const SourcePicker = ({ side, onChange }: { side: typeof sideA; onChange: (v: typeof sideA) => void }) => (
    <div className="space-y-2">
      <div className="flex rounded-lg border border-border overflow-hidden text-xs">
        <button type="button" onClick={() => onChange({ ...side, type: 'document', id: '', label: '' })}
          className={`flex-1 py-1.5 font-medium transition-colors ${side.type === 'document' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}>
          <FileText className="w-3 h-3 inline me-1" />{t('وثيقة', 'Document')}
        </button>
        <button type="button" onClick={() => onChange({ ...side, type: 'legal_source', id: '', label: '' })}
          className={`flex-1 py-1.5 font-medium transition-colors ${side.type === 'legal_source' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}>
          <BookOpen className="w-3 h-3 inline me-1" />{t('مصدر', 'Source')}
        </button>
      </div>
      {side.type === 'document' ? (
        <select className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          value={side.id} onChange={e => {
            const opt = e.target.options[e.target.selectedIndex];
            onChange({ ...side, id: e.target.value, label: opt.text });
          }} required>
          <option value="">{t('اختر وثيقة...', 'Select document...')}</option>
          {documents?.map(d => <option key={d.id} value={d.id}>{d.originalName}</option>)}
        </select>
      ) : (
        <input type="text" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t('أدخل اسم المصدر', 'Enter source name')}
          value={side.label}
          onChange={e => onChange({ ...side, label: e.target.value, id: e.target.value })} />
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <GitCompareArrows className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('مقارنة الوثائق', 'Document Comparison')}</h1>
            <p className="text-sm text-muted-foreground">{t('قارن بين مصدرين قانونيين بالذكاء الاصطناعي أو أنشئ جدول مقارنة يدوياً.', 'Compare two legal sources with AI or build a comparison table manually.')}</p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden w-64">
          <button type="button" onClick={() => setMode('ai')} className={`flex-1 py-2 text-sm font-medium gap-1.5 flex items-center justify-center transition-colors ${mode === 'ai' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted/30'}`}>
            <Sparkles className="w-3.5 h-3.5" />{t('ذكاء اصطناعي', 'AI Compare')}
          </button>
          <button type="button" onClick={() => setMode('manual')} className={`flex-1 py-2 text-sm font-medium gap-1.5 flex items-center justify-center transition-colors ${mode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted/30'}`}>
            <ArrowLeftRight className="w-3.5 h-3.5" />{t('يدوي', 'Manual')}
          </button>
        </div>

        {mode === 'ai' ? (
          <form onSubmit={handleAiCompare} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border">
                <CardHeader className="px-4 pt-4 pb-2"><CardTitle className="text-sm">{t('المصدر الأول', 'Source A')}</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4"><SourcePicker side={sideA} onChange={setSideA} /></CardContent>
              </Card>
              <Card className="border-border">
                <CardHeader className="px-4 pt-4 pb-2"><CardTitle className="text-sm">{t('المصدر الثاني', 'Source B')}</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4"><SourcePicker side={sideB} onChange={setSideB} /></CardContent>
              </Card>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('موضوع المقارنة', 'Comparison topic')}</label>
              <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={t('مقارنة أحكام العقود والالتزامات', 'Compare contract and obligation provisions')}
                value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <Button type="submit" className="gap-1.5" disabled={!sideA.id || loading || !canUseAi}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-gold" />}
              {loading ? t('جارٍ المقارنة...', 'Comparing...') : t('مقارنة ذكية', 'AI Compare')}
            </Button>
          </form>
        ) : (
          <form onSubmit={saveManual} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('المصدر الأول (عنوان العمود)', 'Source A (column header)')}</label>
                <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={t('القانون الإماراتي', 'UAE Law')} value={sideA.label} onChange={e => setSideA(s => ({ ...s, label: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('المصدر الثاني (عنوان العمود)', 'Source B (column header)')}</label>
                <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={t('القانون الفرنسي', 'French Law')} value={sideB.label} onChange={e => setSideB(s => ({ ...s, label: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('عنوان المقارنة', 'Comparison title')}</label>
              <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={t('مقارنة قانونية', 'Legal Comparison')} value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <div className="space-y-2">
              {manualRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
                  <input className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={t('الجانب', 'Aspect')} value={row.aspect} onChange={e => updateRow(i, 'aspect', e.target.value)} />
                  <input className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={sideA.label || t('المصدر الأول', 'Source A')} value={row.sourceA} onChange={e => updateRow(i, 'sourceA', e.target.value)} />
                  <input className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={sideB.label || t('المصدر الثاني', 'Source B')} value={row.sourceB} onChange={e => updateRow(i, 'sourceB', e.target.value)} />
                  <button type="button" onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive p-1.5" aria-label={t('حذف', 'Remove')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
                <Plus className="w-3.5 h-3.5" />{t('إضافة صف', 'Add row')}
              </Button>
            </div>
            <Button type="submit" className="gap-1.5">{t('حفظ المقارنة', 'Save comparison')}</Button>
          </form>
        )}

        {/* AI Result Table */}
        {result && (
          <Card className="border-border">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-base">{result.title}</CardTitle>
              {result.summary && <p className="text-sm text-muted-foreground mt-1">{result.summary}</p>}
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {result.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-start px-3 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t('الجانب', 'Aspect')}</th>
                        <th className="text-start px-3 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{sideA.label || t('المصدر الأول', 'Source A')}</th>
                        <th className="text-start px-3 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{sideB.label || t('المصدر الثاني', 'Source B')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/10">
                          <td className="px-3 py-2.5 font-medium text-foreground">{row.aspect}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.sourceA}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.sourceB}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('لا توجد صفوف في نتيجة المقارنة.', 'No rows in comparison result.')}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
