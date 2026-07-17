import React from 'react';

/**
 * البديل الرسمي الموحّد لأيقونة المطرقة القضائية (Gavel) في كامل المنصة —
 * وفق التوجيه المعتمد: لا مطارق؛ الرموز تعبّر عن الأمن + العدالة + الثقة
 * + الحماية. التصميم: ميزان عدالة داخل درع حماية.
 * متوافقة مع واجهة أيقونات lucide (viewBox 24، حد 2، currentColor) بحيث
 * تعمل في كل مواضع الاستخدام الحالية دون أي تعديل آخر.
 */
export function Gavel({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {/* الدرع — الحماية */}
      <path d="M12 2 L20 4.8 V11 C20 16 16.5 19.6 12 22 C7.5 19.6 4 16 4 11 V4.8 Z" />
      {/* الميزان — العدالة */}
      <path d="M12 6.5 V15" />
      <path d="M8 8.5 H16" />
      <path d="M8 8.5 L6.6 11.6 A1.9 1.9 0 0 0 9.4 11.6 Z" />
      <path d="M16 8.5 L14.6 11.6 A1.9 1.9 0 0 0 17.4 11.6 Z" />
      <path d="M10.2 15 H13.8" />
    </svg>
  );
}
