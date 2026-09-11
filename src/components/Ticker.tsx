import type { ContentItem } from '@/catalog/types';

/**
 * Guest-name marquee — a scrolling strip of every credited name in the
 * archive. Pure CSS animation; duplicated track for the seamless loop.
 */
export default function Ticker({ items }: { items: ContentItem[] }) {
  const names = items
    .flatMap((i) => [...i.guests, ...i.panelists, ...i.participants])
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  if (names.length < 2) return null;

  // One long pass, duplicated so translateX(-50%) loops seamlessly.
  const half = names.map((n, i) => (
    <span className="ticker-item" key={`a-${n}-${i}`}>
      {n}
    </span>
  ));
  const half2 = names.map((n, i) => (
    <span className="ticker-item" key={`b-${n}-${i}`}>
      {n}
    </span>
  ));

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {half}
        {half2}
      </div>
    </div>
  );
}
