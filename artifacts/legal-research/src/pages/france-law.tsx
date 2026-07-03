import React from 'react';
import { Landmark } from 'lucide-react';
import { LegalSourcesBrowser } from '@/components/legal/legal-sources-browser';

export default function FranceLaw() {
  return (
    <LegalSourcesBrowser
      jurisdiction="france"
      pageTitle="French Law"
      pageTitleAr="القانون الفرنسي"
      pageSubtitleAr="تصفّح القوانين والمراسيم والأحكام القضائية الفرنسية ذات الصلة بالبحث القانوني المقارن."
      pageSubtitleEn="Browse French laws, codes, and judicial decisions relevant to comparative legal research."
      icon={<Landmark className="w-5 h-5 text-primary" />}
      docTypeOptions={[
        { value: 'code',        labelAr: 'قانون/كود',     labelEn: 'Code' },
        { value: 'law',         labelAr: 'قانون',          labelEn: 'Law' },
        { value: 'decree',      labelAr: 'مرسوم',          labelEn: 'Decree / Arrêté' },
        { value: 'judgment',    labelAr: 'حكم',            labelEn: 'Judgment' },
        { value: 'regulation',  labelAr: 'لائحة',          labelEn: 'Regulation' },
      ]}
      yearMin={1804}
    />
  );
}
