import Link from 'next/link';
import type { ContentItem } from '@/catalog/types';
import { isPlayable } from '@/catalog/types';
import { formatRuntime, seasonEpisodeLabel } from '@/lib/format';

interface Props {
  item: ContentItem;
  /** 0..1 resume fraction for Continue Watching. */
  progress?: number;
  eager?: boolean;
}

export default function EpisodeCard({ item, progress, eager = false }: Props) {
  const people = [...item.guests, ...item.panelists, ...item.participants, ...item.hosts, ...item.judges];
  const playable = isPlayable(item);
  return (
    <Link href={`/watch/${item.slug}`} className={`ep-card${playable ? '' : ' is-unavailable'}`}>
      <span className="ep-card-art">
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG key art, no optimisation gain */}
        <img
          src={item.thumbnail}
          alt={`Key art: Season ${item.season}, ${item.title}`}
          width="640"
          height="400"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
        <span className="ep-card-badge">{seasonEpisodeLabel(item.season, item.episodeNumber, item.kind)}</span>
        {item.resolution && <span className="ep-card-quality">{item.resolution.label}</span>}
        {!playable && <span className="ep-card-unavailable">Not available</span>}
      </span>
      <span className="ep-card-body">
        <span className="ep-card-title">
          {item.kind === 'episode' ? `Episode ${item.episodeNumber}` : item.title}
        </span>
        {people.length > 0 && <span className="ep-card-people">with {people.slice(0, 4).join(' · ')}</span>}
        <span className="ep-card-meta">
          {playable ? (
            <>
              {formatRuntime(item.durationSeconds)}
              {item.resolution ? ` · ${item.resolution.label}` : ''}
            </>
          ) : (
            'Not currently available'
          )}
        </span>
        {typeof progress === 'number' && progress > 0 && (
          <span className="ep-card-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        )}
      </span>
    </Link>
  );
}
