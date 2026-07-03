import React from 'react';
import { Globe } from 'lucide-react';
import { LegalSourcesBrowser } from '@/components/legal/legal-sources-browser';

export default function EuLaw() {
  return (
    <LegalSourcesBrowser
      jurisdiction="eu"
      pageTitle="EU Law"
      pageTitleAr="القانون الأوروبي"
      pageSubtitleAr="تصفّح لوائح الاتحاد الأوروبي وتوجيهاته والأحكام الصادرة عن محكمة العدل الأوروبية."
      pageSubtitleEn="Browse EU regulations, directives, and judgments from the Court of Justice of the EU."
      icon={<Globe className="w-5 h-5 text-primary" />}
      docTypeOptions={[
        { value: 'regulation',  labelAr: 'لائحة',           labelEn: 'Regulation' },
        { value: 'directive',   labelAr: 'توجيه',           labelEn: 'Directive' },
        { value: 'decision',    labelAr: 'قرار',            labelEn: 'Decision' },
        { value: 'judgment',    labelAr: 'حكم',             labelEn: 'Judgment' },
      ]}
      yearMin={1958}
    />
  );
}
