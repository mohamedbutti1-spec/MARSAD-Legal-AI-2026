import React, { useEffect, useRef, useState } from 'react';

// ─── Scroll-triggered reveal ───────────────────────────────────────────────
// Wraps a block in the platform's standard entrance: a subtle fade-up that
// plays once when the element enters the viewport (styles in index.css
// under ".reveal"). Vertical motion only, so it behaves identically in RTL
// and LTR, and prefers-reduced-motion collapses it to an instant appear.
//
//   <Reveal>…</Reveal>                 fade-up on first viewport entry
//   <Reveal delay={120}>…</Reveal>     staggered item (delay in ms)
//   <Reveal as="section">…</Reveal>    custom wrapper element

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Transition delay in ms — use i * 60–90 for staggered lists. */
  delay?: number;
  /** Wrapper element, defaults to a plain div. */
  as?: 'div' | 'section' | 'li' | 'article' | 'span';
  children?: React.ReactNode;
}

export function Reveal({ delay = 0, as = 'div', className = '', style, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      // Trigger slightly before the element fully scrolls in, so the motion
      // reads as a welcome rather than a late pop-in.
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`.trim()}
      style={delay ? ({ ...style, '--reveal-delay': `${delay}ms` } as React.CSSProperties) : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
