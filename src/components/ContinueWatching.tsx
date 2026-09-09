'use client';

import { useEffect, useState } from 'react';
import type { ContentItem } from '@/catalog/types';
import { listContinueWatching, type ContinueEntry } from '@/player/progress';
import EpisodeCard from './EpisodeCard';

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

  if (!entries || entries.length === 0) return null;

  return (
    <section className="section" aria-label="Continue watching">
      <div className="section-head">
        <h2>Continue watching</h2>
      </div>
      <div className="card-grid">
        {entries.map(({ item, progress }) => (
          <EpisodeCard
            key={item.id}
            item={item}
            progress={progress.duration > 0 ? progress.position / progress.duration : 0}
          />
        ))}
      </div>
    </section>
  );
}
