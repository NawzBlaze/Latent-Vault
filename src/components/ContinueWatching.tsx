'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ContentItem } from '@/catalog/types';
import { listContinueWatching, type ContinueEntry } from '@/player/progress';
import { formatRuntime } from '@/lib/format';

export default function ContinueWatching({ items }: { items: ContentItem[] }) {
  const [entries, setEntries] = useState<(ContinueEntry & { item: ContentItem })[] | null>(null);

  useEffect(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const found = listContinueWatching()
      .map((e) => ({ ...e, item: byId.get(e.contentId) }))
      .filter((e): e is ContinueEntry & { item: ContentItem } => !!e.item && e.item.published)
      .slice(0, 6);
    setEntries(found);
  }, [items]);

  // Render nothing until we know there is progress — no reserved space.
  if (!entries || entries.length === 0) return null;

  return (
    <section className="cw-section" aria-label="Continue watching">
      <div className="cw-head">
        <h2 className="cw-heading">Continue watching</h2>
        <span className="label">Resume where you left off</span>
      </div>
      <div className="cw-strip">
        {entries.map(({ item, progress }) => {
          const pct = progress.duration > 0 ? progress.position / progress.duration : 0;
          const remaining = progress.duration - progress.position;
          return (
            <Link key={item.id} href={`/watch/${item.slug}`} className="cw-card">
              <span className="cw-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnail}
                  alt=""
                  width="320"
                  height="180"
                  loading="lazy"
                  decoding="async"
                />
                <span className="cw-progress" aria-hidden="true">
                  <span style={{ width: `${Math.round(pct * 100)}%` }} />
                </span>
              </span>
              <span className="cw-body">
                <span className="cw-label">
                  S2 · E{String(item.episodeNumber).padStart(2, '0')}
                  {item.kind !== 'episode' ? ` · ${item.kind}` : ''}
                </span>
                <span className="cw-guests">
                  {[...item.guests, ...item.panelists].slice(0, 2).join(', ')}
                </span>
                {remaining > 30 && (
                  <span className="cw-remaining">{formatRuntime(remaining)} remaining</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
