import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/user-context';

interface CreateDecisionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: DecisionFormData) => Promise<void>;
}

export interface DecisionFormData {
  decisionNumber: string;
  title: string;
  titleAr: string;
  issuerOrg?: string;
  issuerOrgAr?: string;
  subject?: string;
  subjectAr?: string;
  status: string;
  issuedDate?: string;
  effectiveDate?: string;
  content: { body?: string; bodyAr?: string };
}

const STATUSES = [
  { value: 'draft',     labelAr: 'مسودة',       labelEn: 'Draft' },
  { value: 'issued',    labelAr: 'صادر',        labelEn: 'Issued' },
  { value: 'executed',  labelAr: 'منفّذ',        labelEn: 'Executed' },
];

export function CreateDecisionDialog({ open, onClose, onSave }: CreateDecisionDialogProps) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [form, setForm] = useState<DecisionFormData>({
    decisionNumber: '', title: '', titleAr: '', issuerOrg: '', issuerOrgAr: '',
    subject: '', subjectAr: '', status: 'draft', issuedDate: '', effectiveDate: '',
    content: { body: '', bodyAr: '' },
  });

  function reset() {
    setForm({ decisionNumber: '', title: '', titleAr: '', issuerOrg: '', issuerOrgAr: '', subject: '', subjectAr: '', status: 'draft', issuedDate: '', effectiveDate: '', content: { body: '', bodyAr: '' } });
    setError(null);
  }

  function set(key: keyof DecisionFormData, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.decisionNumber.trim()) { setError(t('رقم القرار مطلوب', 'Decision number is required')); return; }
    if (!form.titleAr.trim())        { setError(t('العنوان بالعربية مطلوب', 'Arabic title is required')); return; }
    if (!form.title.trim())          { setError(t('العنوان بالإنجليزية مطلوب', 'English title is required')); return; }
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{t('إنشاء قرار إداري جديد', 'New Administrative Decision')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Decision number + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('رقم القرار', 'Decision Number')} *</label>
              <Input value={form.decisionNumber} onChange={(e) => set('decisionNumber', e.target.value)} placeholder="QR-2024-001" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('الحالة', 'Status')}</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{t(s.labelAr, s.labelEn)}</option>)}
              </select>
            </div>
          </div>

          {/* Titles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('العنوان بالعربية', 'Arabic Title')} *</label>
              <Input value={form.titleAr} onChange={(e) => set('titleAr', e.target.value)} placeholder="عنوان القرار" dir="rtl" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('العنوان بالإنجليزية', 'English Title')} *</label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Decision title" dir="ltr" />
            </div>
          </div>

          {/* Issuer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('الجهة المصدرة (عربي)', 'Issuer Org (AR)')}</label>
              <Input value={form.issuerOrgAr} onChange={(e) => set('issuerOrgAr', e.target.value)} placeholder="وزارة العدل" dir="rtl" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('الجهة المصدرة (إنجليزي)', 'Issuer Org (EN)')}</label>
              <Input value={form.issuerOrg} onChange={(e) => set('issuerOrg', e.target.value)} placeholder="Ministry of Justice" dir="ltr" />
            </div>
          </div>

          {/* Subject */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('الموضوع (عربي)', 'Subject (AR)')}</label>
              <Input value={form.subjectAr} onChange={(e) => set('subjectAr', e.target.value)} dir="rtl" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('الموضوع (إنجليزي)', 'Subject (EN)')}</label>
              <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} dir="ltr" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('تاريخ الإصدار', 'Issued Date')}</label>
              <Input type="date" value={form.issuedDate} onChange={(e) => set('issuedDate', e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('تاريخ النفاذ', 'Effective Date')}</label>
              <Input type="date" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} dir="ltr" />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('نص القرار (عربي)', 'Decision Body (AR)')}</label>
            <textarea
              value={form.content.bodyAr ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, content: { ...f.content, bodyAr: e.target.value } }))}
              rows={4} dir="rtl"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="أدخل نص القرار…"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving}>{t('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white">
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {t('إنشاء', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
