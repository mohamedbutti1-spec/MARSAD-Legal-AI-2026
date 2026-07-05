import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/user-context';

export type ItemType = 'question' | 'answer' | 'authority' | 'document' | 'note' | 'highlight' | 'bookmark' | 'timeline_entry';

interface Folder {
  id: number;
  name: string;
}

interface ItemEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    itemType: ItemType;
    title: string;
    content: Record<string, unknown>;
    metadata: Record<string, unknown>;
    folderId: number | null;
    answerMeta?: unknown;
  }) => Promise<void>;
  folders: Folder[];
  defaultType?: ItemType;
}

const ITEM_TYPES: { value: ItemType; labelAr: string; labelEn: string }[] = [
  { value: 'question',       labelAr: 'سؤال',             labelEn: 'Question' },
  { value: 'answer',         labelAr: 'جواب',             labelEn: 'Answer' },
  { value: 'authority',      labelAr: 'سلطة قانونية',    labelEn: 'Authority' },
  { value: 'document',       labelAr: 'وثيقة',            labelEn: 'Document' },
  { value: 'note',           labelAr: 'ملاحظة',           labelEn: 'Note' },
  { value: 'highlight',      labelAr: 'تظليل',            labelEn: 'Highlight' },
  { value: 'bookmark',       labelAr: 'إشارة مرجعية',    labelEn: 'Bookmark' },
  { value: 'timeline_entry', labelAr: 'إدخال زمني',      labelEn: 'Timeline Entry' },
];

export function ItemEditorDialog({ open, onClose, onSave, folders, defaultType = 'note' }: ItemEditorDialogProps) {
  const t = useT();
  const [itemType, setItemType]   = useState<ItemType>(defaultType);
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [folderId, setFolderId]   = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Answer-specific
  const [modelVersion, setModelVersion]     = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState('');

  function reset() {
    setItemType(defaultType); setTitle(''); setBody(''); setFolderId(null);
    setSaving(false); setError(null); setModelVersion(''); setConfidenceLevel('');
  }

  async function handleSave() {
    if (!title.trim()) { setError(t('العنوان مطلوب', 'Title is required')); return; }
    setSaving(true); setError(null);
    try {
      const content: Record<string, unknown> = { text: body };
      const answerMeta = itemType === 'answer' ? {
        modelVersion:    modelVersion || undefined,
        confidenceLevel: confidenceLevel ? parseFloat(confidenceLevel) : undefined,
        citedAuthorities: [],
        verificationReport: {},
        retrievalInventory: {},
      } : undefined;
      await onSave({ itemType, title: title.trim(), content, metadata: {}, folderId, answerMeta });
      reset();
    } catch (e) {
      setError(t('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{t('عنصر جديد', 'New Item')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
              {t('النوع', 'Type')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ITEM_TYPES.map((it) => (
                <button
                  key={it.value}
                  onClick={() => setItemType(it.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    itemType === it.value
                      ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e3a5f]'
                  }`}
                >
                  {t(it.labelAr, it.labelEn)}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              {t('العنوان', 'Title')} *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('أدخل العنوان…', 'Enter title…')}
              dir="auto"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              {t('المحتوى', 'Content')}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={t('أدخل المحتوى…', 'Enter content…')}
              dir="auto"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Answer-specific fields */}
          {itemType === 'answer' && (
            <div className="space-y-3 rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-800">{t('بيانات الجواب', 'Answer Metadata')}</p>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">
                  {t('إصدار النموذج', 'Model Version')}
                </label>
                <Input
                  value={modelVersion}
                  onChange={(e) => setModelVersion(e.target.value)}
                  placeholder="claude-sonnet-4-5"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">
                  {t('مستوى الثقة (0-1)', 'Confidence Level (0-1)')}
                </label>
                <Input
                  value={confidenceLevel}
                  onChange={(e) => setConfidenceLevel(e.target.value)}
                  placeholder="0.85"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Folder selector */}
          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                {t('المجلد', 'Folder')}
              </label>
              <select
                value={folderId ?? ''}
                onChange={(e) => setFolderId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t('الجذر (بدون مجلد)', 'Root (no folder)')}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving}>
            {t('إلغاء', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white">
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {t('حفظ', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
