import React from 'react';
import { ScrollText } from 'lucide-react';
import { LegalSourcesBrowser } from '@/components/legal/legal-sources-browser';

export default function UaeLegislation() {
  return (
    <LegalSourcesBrowser
      jurisdiction="uae_legislation"
      pageTitle="UAE Legislation"
      pageTitleAr="التشريعات الإماراتية"
      pageSubtitleAr="تصفّح وابحث في القوانين الاتحادية الإماراتية مرتبةً حسب السنة والجهة المُصدِرة والموضوع."
      pageSubtitleEn="Browse and search UAE federal laws sorted by year, issuing authority, and subject."
      icon={<ScrollText className="w-5 h-5 text-primary" />}
      docTypeOptions={[
        { value: 'law',        labelAr: 'قانون',           labelEn: 'Law' },
        { value: 'decree',     labelAr: 'مرسوم',           labelEn: 'Decree' },
        { value: 'regulation', labelAr: 'لائحة',           labelEn: 'Regulation' },
        { value: 'resolution', labelAr: 'قرار',            labelEn: 'Resolution' },
      ]}
      yearMin={1971}
    />
  );
}
