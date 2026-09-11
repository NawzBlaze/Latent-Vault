'use client';

import Link from 'next/link';
import { cancelPrefetch, prefetchPlayback } from '@/lib/prefetch';
import type { ContentItem } from '@/catalog/types';
import { isPlayable } from '@/catalog/types';
import { formatRuntime } from '@/lib/format';

/** Compact bonus row — clearly secondary to the Season 2 index. */
export default function BonusRow({ item }: { item: ContentItem }) {
  const playable = isPlayable(item);
  const people = [...item.guests, ...item.panelists, ...item.participants];
  const warm = () => { if (playable) prefetchPlayback(item.id); };

  return (
    <div
      className="bonus-row"
      onPointerEnter={warm}
      onPointerLeave={() => cancelPrefetch(item.id)}
    >
      <Link href={`/watch/${item.slug}`} className="bonus-thumb">
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
      <Link href={`/watch/${item.slug}`} className="bonus-main">
        <span className="bonus-no">Bonus {String(item.episodeNumber).padStart(2, '0')}</span>
        <span className="bonus-people">
          {people.length > 0 ? people.join(' · ') : item.title}
        </span>
        <span className="bonus-date">
          {item.releaseDate
            ? new Date(item.releaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Release date unverified'}
        </span>
      </Link>
      <span className="bonus-meta">
        {playable ? (
          <>
            {item.durationSeconds && <span>{formatRuntime(item.durationSeconds)}</span>}
            {item.resolution && <span>{item.resolution.label}</span>}
          </>
        ) : (
          <span>Unavailable</span>
        )}
        {playable ? (
          <Link href={`/watch/${item.slug}`} className="archive-cta">
            Watch <span className="arr" aria-hidden="true">→</span>
          </Link>
        ) : item.officialUrl ? (
          <a
            href={item.officialUrl.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="archive-cta-yt"
          >
            YouTube ↗
          </a>
        ) : null}
      </span>
    </div>
  );
}
