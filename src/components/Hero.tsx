import Link from 'next/link';
import type { ContentItem } from '@/catalog/types';
import { isPlayable } from '@/catalog/types';
import { formatRuntime } from '@/lib/format';

export default function Hero({ item }: { item: ContentItem }) {
  const people = [...item.guests, ...item.panelists, ...item.participants];
  const playable = isPlayable(item);

  return (
    <section className="hero" aria-label={`Featured: Season 2 Episode ${item.episodeNumber}`}>
      <figure className="hero-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.heroImage}
          alt={`Still from Season 2 Episode ${item.episodeNumber} of India's Got Latent`}
          width="1600"
          height="900"
          fetchPriority="high"
          decoding="async"
        />
        <figcaption>Season 2 Episode {item.episodeNumber}</figcaption>
      </figure>

      <div className="hero-copy">
        <div className="wrap hero-copy-inner">
          <div>
            <div className="hero-kicker">
              <span className="label">
                India&rsquo;s Got Latent &middot; <em>Season 2</em>
              </span>
              <span className="hero-rule" aria-hidden="true" />
              <span className="label">Latest</span>
            </div>
            <h1 className="hero-title">
              Episode {item.episodeNumber}
              {people.length > 0 && (
                <span className="hero-people">
                  {people.slice(0, 3).join(', ')}
                  {people.length > 3 ? ` and ${people.length - 3} more` : ''}
                </span>
              )}
            </h1>
          </div>

          <div className="hero-side">
            <div className="hero-meta">
              <span>
                {item.releaseDate
                  ? new Date(item.releaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Date unknown'}
              </span>
              {playable && item.durationSeconds && (
                <span><strong>{formatRuntime(item.durationSeconds)}</strong></span>
              )}
              {playable && item.resolution && (
                <span><strong>{item.resolution.label}</strong></span>
              )}
            </div>
            <div className="hero-actions">
              <Link href={`/watch/${item.slug}`} className="btn btn-solid">
                {playable ? 'Watch now' : 'View details'}
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                </svg>
              </Link>
              <Link href="/season/2" className="btn btn-quiet">
                Browse Season 2
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
