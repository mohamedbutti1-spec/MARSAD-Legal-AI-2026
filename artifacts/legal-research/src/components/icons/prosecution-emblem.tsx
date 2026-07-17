import React from 'react';
import type { JourneyPath } from '@/lib/journey-catalog';

/**
 * شعار النيابة العامة المعتمد — الخيار 5 من الأمر التنفيذي:
 * ميزان عدالة محوره هيئة إنسان داخل دائرة، مع غصن غار على الجانب،
 * ذهبي مطفي على أسود، بلا نص وبلا أي أشكال مطرقة أو أدوات.
 * يرث اللون من الأب (currentColor) — يُستخدم مع text-gold.
 */
export function ProsecutionEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="شعار النيابة العامة"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* الدائرة الخارجية */}
      <circle cx="50" cy="50" r="45" strokeWidth="4.5" />

      {/* غصن الغار — على الجانب الأيسر الداخلي */}
      <path d="M37 82 Q16 68 20 42" strokeWidth="2.5" />
      <ellipse cx="24" cy="72" rx="5.5" ry="2.4" transform="rotate(-52 24 72)" fill="currentColor" stroke="none" />
      <ellipse cx="19.5" cy="62" rx="5.5" ry="2.4" transform="rotate(-72 19.5 62)" fill="currentColor" stroke="none" />
      <ellipse cx="18.5" cy="52" rx="5.5" ry="2.4" transform="rotate(-86 18.5 52)" fill="currentColor" stroke="none" />
      <ellipse cx="20.5" cy="42.5" rx="5.5" ry="2.4" transform="rotate(-100 20.5 42.5)" fill="currentColor" stroke="none" />

      {/* هيئة الإنسان — الرأس والجذع محور الميزان */}
      <circle cx="50" cy="26.5" r="5.5" fill="currentColor" stroke="none" />
      <path d="M50 34 V 70" strokeWidth="5" />

      {/* ذراع الميزان */}
      <path d="M27 40 H 73" strokeWidth="4" />

      {/* خيوط الكفتين */}
      <path d="M27 40 L 20 55.5 M27 40 L 34 55.5" strokeWidth="2" />
      <path d="M73 40 L 66 55.5 M73 40 L 80 55.5" strokeWidth="2" />

      {/* الكفتان */}
      <path d="M18 56 A 9 9 0 0 0 36 56 Z" fill="currentColor" stroke="none" />
      <path d="M64 56 A 9 9 0 0 0 82 56 Z" fill="currentColor" stroke="none" />

      {/* القاعدة */}
      <path d="M42 73 H 58" strokeWidth="4" />
      <path d="M38 79 H 62" strokeWidth="4" />
    </svg>
  );
}

/**
 * أيقونة المسار المهني — تعرض شعار النيابة العامة المعتمد (SVG) لمسار
 * النيابة، والرمز التعبيري الافتراضي لبقية المسارات.
 */
export function PathIcon({ path, className, emojiClassName }: {
  path: Pick<JourneyPath, 'id' | 'icon'>;
  className?: string;
  emojiClassName?: string;
}) {
  if (path.id === 'prosecution') {
    return <ProsecutionEmblem className={className} />;
  }
  return <span className={emojiClassName} aria-hidden>{path.icon}</span>;
}
