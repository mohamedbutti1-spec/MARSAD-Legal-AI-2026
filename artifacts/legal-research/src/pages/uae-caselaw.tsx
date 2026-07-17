import React from 'react';
import {  } from 'lucide-react';
import { Gavel } from '@/components/icons/gavel';
import { LegalSourcesBrowser } from '@/components/legal/legal-sources-browser';

export default function UaeCaseLaw() {
  return (
    <LegalSourcesBrowser
      jurisdiction="uae_caselaw"
      pageTitle="UAE Case Law"
      pageTitleAr="الاجتهاد القضائي الإماراتي"
      pageSubtitleAr="تصفّح أحكام المحاكم الإماراتية من محكمة النقض والاستئناف والابتداء."
      pageSubtitleEn="Browse UAE court judgments from the Court of Cassation, Appeals, and First Instance."
      icon={<Gavel className="w-5 h-5 text-primary" />}
      docTypeOptions={[
        { value: 'judgment',  labelAr: 'حكم',          labelEn: 'Judgment' },
        { value: 'ruling',    labelAr: 'قرار قضائي',   labelEn: 'Ruling' },
        { value: 'circular',  labelAr: 'منشور',        labelEn: 'Circular' },
      ]}
      yearMin={1971}
      showKeyFindings
    />
  );
}
