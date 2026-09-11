'use client';

import Link from 'next/link';
import { cancelPrefetch, prefetchPlayback } from '@/lib/prefetch';
import type { ContentItem } from '@/catalog/types';
import { isPlayable } from '@/catalog/types';
import { formatRuntime } from '@/lib/format';

/**
 * One archive row: outlined E-number · thumbnail · people · facts · CTA.
 */
export function ArchiveRow({ item }: { item: ContentItem }) {
  const playable = isPlayable(item);
  const people = [...item.guests, ...item.panelists, ...item.participants];
  const warm = () => { if (playable) prefetchPlayback(item.id); };

  return (
    <div
      className="archive-row"
      onPointerEnter={warm}
      onPointerLeave={() => cancelPrefetch(item.id)}
    >
      <span className="archive-no" aria-hidden="true">
        {String(item.episodeNumber).padStart(2, '0')}
      </span>

      <Link href={`/watch/${item.slug}`} className="archive-thumb" aria-label={`Season 2 Episode ${item.episodeNumber}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnail}
          alt=""
          width="320"
          height="180"
          loading="lazy"
          decoding="async"
        />
      </Link>

      <Link href={`/watch/${item.slug}`} className="archive-main">
        <span className="archive-people">
          {people.length > 0 ? people.join(' · ') : 'Credits unverified'}
        </span>
        <span className="archive-sub">
          {item.releaseDate
            ? new Date(item.releaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Release date unverified'}
        </span>
      </Link>

      <span className="archive-facts">
        {item.durationSeconds && <span>{formatRuntime(item.durationSeconds)}</span>}
        {item.resolution && <span>{item.resolution.label}</span>}
        {!item.durationSeconds && !item.resolution && item.source?.primary.origin === 'youtube' && <span>YouTube</span>}
      </span>

      <Link href={`/watch/${item.slug}`} className="archive-cta">
        Watch <span className="arr" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/** Featured episode — the latest playable one gets the large moment. */
export function Feature({ item }: { item: ContentItem }) {
  const playable = isPlayable(item);
  const people = [...item.guests, ...item.panelists, ...item.participants];

  return (
    <Link
      href={`/watch/${item.slug}`}
      className="feature"
      onPointerEnter={() => prefetchPlayback(item.id)}
      onPointerLeave={() => cancelPrefetch(item.id)}
    >
      <span className="feature-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.heroImage}
          alt={`Still from Season 2 Episode ${item.episodeNumber}`}
          width="1280"
          height="720"
          fetchPriority="high"
          decoding="async"
        />
      </span>
      <span className="feature-info">
        <span className="feature-no">
          S2 · Episode {String(item.episodeNumber).padStart(2, '0')}
          {playable ? '' : ' · Listed'}
        </span>
        <span className="feature-title">
          {people.length > 0 ? people.join(' · ') : item.title}
        </span>
        <span className="feature-people">
          {item.description.split('.').slice(0, 2).join('.')}.
        </span>
        <span className="feature-facts">
          <span>
            {item.releaseDate
              ? new Date(item.releaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Date unverified'}
          </span>
          {item.durationSeconds && <span><strong>{formatRuntime(item.durationSeconds)}</strong></span>}
          {item.resolution && <span><strong>{item.resolution.label}</strong></span>}
        </span>
        <span className="feature-actions">
          <span className="btn btn-solid">
            {playable ? 'Watch now' : 'View details'}
            <span aria-hidden="true">→</span>
          </span>
        </span>
      </span>
    </Link>
  );
}
