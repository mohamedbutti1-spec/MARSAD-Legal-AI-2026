import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/user-context';

interface AddLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: LinkFormData) => Promise<void>;
}

export interface LinkFormData {
  linkType: string;
  linkedEntityType: string;
  linkedEntityId?: number;
  linkedEntityRef?: string;
  titleAr?: string;
  titleEn?: string;
  authorityClass: string;
  notes?: string;
}

const LINK_TYPES = [
  { value: 'legislation',          labelAr: 'تشريع',            labelEn: 'Legislation' },
  { value: 'exec_regulation',      labelAr: 'لائحة تنفيذية',   labelEn: 'Exec. Regulation' },
  { value: 'cabinet_decision',     labelAr: 'قرار مجلس الوزراء', labelEn: 'Cabinet Decision' },
  { value: 'ministerial_decision', labelAr: 'قرار وزاري',       labelEn: 'Ministerial Decision' },
  { value: 'case_law',             labelAr: 'اجتهاد قضائي',    labelEn: 'Case Law' },
  { value: 'legal_principle',      labelAr: 'مبدأ قانوني',      labelEn: 'Legal Principle' },
  { value: 'legal_opinion',        labelAr: 'رأي قانوني',       labelEn: 'Legal Opinion' },
  { value: 'research_project',     labelAr: 'مشروع بحثي',       labelEn: 'Research Project' },
  { value: 'other_decision',       labelAr: 'قرار إداري آخر',   labelEn: 'Other Decision' },
  { value: 'other',                labelAr: 'أخرى',             labelEn: 'Other' },
];

const ENTITY_TYPES = [
  { value: 'kb_document',      labelAr: 'وثيقة قانونية (قاعدة المعرفة)', labelEn: 'KB Document' },
  { value: 'legal_source',     labelAr: 'مصدر قانوني',                   labelEn: 'Legal Source' },
  { value: 'research_project', labelAr: 'مشروع بحثي',                   labelEn: 'Research Project' },
  { value: 'research_item',    labelAr: 'عنصر بحثي',                    labelEn: 'Research Item' },
  { value: 'adkg_decision',    labelAr: 'قرار إداري آخر',               labelEn: 'Other ADKG Decision' },
  { value: 'external',         labelAr: 'مرجع خارجي',                   labelEn: 'External Reference' },
];

const AUTHORITY_CLASSES = [
  { value: 'binding',     labelAr: 'ملزم',     labelEn: 'Binding', color: 'bg-heading/15 text-heading/75' },
  { value: 'persuasive',  labelAr: 'إرشادي',  labelEn: 'Persuasive', color: 'bg-heading/15 text-heading' },
  { value: 'non_binding', labelAr: 'غير ملزم', labelEn: 'Non-binding', color: 'bg-muted/60 text-muted-foreground' },
];

export function AddLinkDialog({ open, onClose, onSave }: AddLinkDialogProps) {
  const t = useT();
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm]       = useState<LinkFormData>({
    linkType: 'legislation', linkedEntityType: 'kb_document',
    authorityClass: 'persuasive',
  });

  function reset() { setForm({ linkType: 'legislation', linkedEntityType: 'kb_document', authorityClass: 'persuasive' }); setError(null); }

  async function handleSave() {
    if (!form.titleAr && !form.titleEn && !form.linkedEntityRef) {
      setError(t('يجب توفير عنوان أو مرجع', 'A title or reference is required'));
      return;
    }
    setSaving(true); setError(null);
    try {
      await onSave(form);
      reset(); onClose();
    } catch {
      setError(t('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{t('إضافة رابط قانوني', 'Add Legal Link')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Link type */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">{t('نوع الرابط', 'Link Type')}</label>
            <div className="flex flex-wrap gap-1.5">
              {LINK_TYPES.map((lt) => (
                <button
                  key={lt.value}
                  onClick={() => setForm((f) => ({ ...f, linkType: lt.value }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.linkType === lt.value ? 'bg-primary text-primary-foreground border-primary/50' : 'bg-card text-muted-foreground border-border hover:border-primary/60'}`}
                >
                  {t(lt.labelAr, lt.labelEn)}
                </button>
              ))}
            </div>
          </div>

          {/* Entity type */}
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('نوع الكيان', 'Entity Type')}</label>
            <select
              value={form.linkedEntityType}
              onChange={(e) => setForm((f) => ({ ...f, linkedEntityType: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ENTITY_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{t(et.labelAr, et.labelEn)}</option>
              ))}
            </select>
          </div>

          {/* Entity ID (if internal) */}
          {form.linkedEntityType !== 'external' && (
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('معرّف الكيان (اختياري)', 'Entity ID (optional)')}</label>
              <Input
                type="number"
                value={form.linkedEntityId ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, linkedEntityId: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                placeholder="123"
                dir="ltr"
              />
            </div>
          )}

          {/* Titles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('العنوان (عربي)', 'Title (AR)')}</label>
              <Input value={form.titleAr ?? ''} onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))} dir="rtl" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('العنوان (إنجليزي)', 'Title (EN)')}</label>
              <Input value={form.titleEn ?? ''} onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))} dir="ltr" />
            </div>
          </div>

          {/* External ref */}
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('مرجع / رابط خارجي', 'Reference / External Link')}</label>
            <Input value={form.linkedEntityRef ?? ''} onChange={(e) => setForm((f) => ({ ...f, linkedEntityRef: e.target.value }))} dir="auto" placeholder="URL أو معرّف خارجي" />
          </div>

          {/* Authority class */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">{t('طبيعة السلطة', 'Authority Class')}</label>
            <div className="flex gap-2">
              {AUTHORITY_CLASSES.map((ac) => (
                <button
                  key={ac.value}
                  onClick={() => setForm((f) => ({ ...f, authorityClass: ac.value }))}
                  className={`flex-1 text-xs py-1.5 rounded-md border-2 transition-colors ${form.authorityClass === ac.value ? `${ac.color} border-current font-semibold` : 'border-border text-muted-foreground hover:border-border'}`}
                >
                  {t(ac.labelAr, ac.labelEn)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('ملاحظات', 'Notes')}</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} dir="auto"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving}>{t('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:opacity-90 text-white">
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {t('إضافة', 'Add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
