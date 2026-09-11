'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Fade-and-rise reveal on first viewport entry.
 * Delays cascade via `--d` (set from the index prop) once the element
 * scrolls into view. Falls back to visible when JS is unavailable
 * (globals.css keys the hidden state off `html.js`).
 */
export default function ScrollReveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = { '--d': `${delay}ms` } as CSSProperties;

  return (
    // @ts-expect-error — dynamic tag with ref
    <Tag ref={ref} className={`reveal ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}
