import Link from 'next/link';
import type { ContentItem } from '@/catalog/types';
import { formatRuntime } from '@/lib/format';

function heroSources(item: ContentItem): { wide: string; portrait: string } {
  return {
    wide: item.heroImage,
    portrait: item.heroImage.replace(/-hero\.svg$/, '-m.svg'),
  };
}

export default function Hero({ item }: { item: ContentItem }) {
  const art = heroSources(item);
  const people = [...item.guests, ...item.panelists, ...item.participants, ...item.hosts, ...item.judges];
  const label =
    item.kind === 'episode'
      ? `Season ${item.season} · Episode ${item.episodeNumber}`
      : `Season ${item.season} · ${item.title}`;

  return (
    <section className="hero fade-in" aria-label="Featured episode">
      <div className="hero-copy">
        <div className="hero-eyebrow">
          <span className="rule" aria-hidden="true" />
          <span className="hero-show">Latest in the archive</span>
        </div>
        <h1 className="hero-title">India’s Got Latent</h1>
        <p className="hero-sub">{label}</p>
        <p className="hero-desc">{item.description}</p>
        <div className="meta-row">
          <span className="chip chip-gold">S{item.season} E{item.episodeNumber}</span>
          <span className="chip">{formatRuntime(item.durationSeconds)}</span>
          {item.resolution && <span className="chip">{item.resolution.label}</span>}
          {people.slice(0, 2).map((p) => (
            <span className="chip" key={p}>
              {p}
            </span>
          ))}
        </div>
        <div className="hero-actions">
          <Link href={`/watch/${item.slug}`} className="btn btn-gold">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
            Watch now
          </Link>
          <Link href={item.kind === 'bonus' ? '/bonus' : `/season/${item.season}`} className="btn btn-outline">
            Browse {item.kind === 'bonus' ? 'bonus' : `season ${item.season}`}
          </Link>
        </div>
      </div>
      <figure className="hero-art">
        <picture>
          <source media="(max-width: 860px)" srcSet={art.portrait} />
          {/* eslint-disable-next-line @next/next/no-img-element -- local SVG key art */}
          <img
            src={art.wide}
            alt={`Archive key art for ${label}`}
            width="1600"
            height="640"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <figcaption>
          {label} · {formatRuntime(item.durationSeconds)}
          {item.resolution ? ` · ${item.resolution.label}` : ''}
        </figcaption>
      </figure>
    </section>
  );
}
