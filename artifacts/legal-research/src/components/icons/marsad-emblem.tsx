import React from 'react';

/**
 * شعار مرصد الرسمي — رمز فريد يعبّر عن: الأمن (الدرع) + العدالة (الميزان)
 * + الثقة والحماية (النجمة الرباعية). ذهبي مطفي على أسود، بلا نص داخل
 * الشعار، وبلا مطرقة أو أي شكل مشابه لشعارات رسمية قائمة.
 * يرث اللون من الأب (currentColor) — يُستخدم مع text-gold.
 */
export function MarsadEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="شعار مرصد"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* الدرع — الأمن والحماية */}
      <path
        d="M50 6 L86 18 V48 C86 72 68 87 50 94 C32 87 14 72 14 48 V18 Z"
        strokeWidth="4.5"
      />

      {/* النجمة الرباعية — الثقة والريادة */}
      <path
        d="M50 16 L53 25 L62 28 L53 31 L50 40 L47 31 L38 28 L47 25 Z"
        fill="currentColor"
        stroke="none"
      />

      {/* الميزان — العدالة */}
      {/* العمود */}
      <path d="M50 44 V 74" strokeWidth="4" />
      {/* الذراع */}
      <path d="M31 50 H 69" strokeWidth="3.5" />
      {/* خيوط الكفتين */}
      <path d="M31 50 L 25.5 62 M31 50 L 36.5 62" strokeWidth="1.8" />
      <path d="M69 50 L 63.5 62 M69 50 L 74.5 62" strokeWidth="1.8" />
      {/* الكفتان */}
      <path d="M23.5 62.5 A 7 7 0 0 0 38.5 62.5 Z" fill="currentColor" stroke="none" />
      <path d="M61.5 62.5 A 7 7 0 0 0 76.5 62.5 Z" fill="currentColor" stroke="none" />
      {/* القاعدة */}
      <path d="M43 78 H 57" strokeWidth="3.5" />
    </svg>
  );
}
