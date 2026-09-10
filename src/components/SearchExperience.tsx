'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ContentItem } from '@/catalog/types';
import { isPlayable } from '@/catalog/types';
import { searchCatalog } from '@/catalog/search';
import { formatRuntime, seasonEpisodeLabel } from '@/lib/format';

const HINTS = ['S2E6', 'Bonus Episode 1', 'Badshah', 'Rakhi Sawant', 'Alia Bhatt', 'Season 2'];

export default function SearchExperience({
  items,
  initialQuery,
}: {
  items: ContentItem[];
  initialQuery: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const results = useMemo(() => searchCatalog(items, q), [items, q]);
  const showResults = q.trim().length > 0;

  return (
    <div>
      <form
        className="search-box"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const url = new URL(window.location.href);
          if (q.trim()) url.searchParams.set('q', q.trim());
          else url.searchParams.delete('q');
          window.history.replaceState(null, '', url.toString());
        }}
      >
        <label htmlFor="archive-q" className="visually-hidden">
          Search the archive
        </label>
        <input
          id="archive-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “S2E5”, a guest name, or “Bonus Episode 1”…"
          autoComplete="off"
          autoFocus
        />
      </form>

      <div className="search-hints" aria-label="Example searches">
        {HINTS.map((h) => (
          <button key={h} type="button" onClick={() => setQ(h)}>
            {h}
          </button>
        ))}
      </div>

      {showResults && (
        <p className="search-count" role="status">
          {results.length === 0
            ? `No results for “${q.trim()}”`
            : `${results.length} result${results.length === 1 ? '' : 's'} for “${q.trim()}”`}
        </p>
      )}

      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map(({ item, matchedOn }) => (
            <Link key={item.id} href={`/watch/${item.slug}`} className="search-hit">
              {/* eslint-disable-next-line @next/next/no-img-element -- local SVG key art */}
              <span className="search-hit-art">
                {/* eslint-disable-next-line @next/next/no-img-element -- real archive frame */}
                <img src={item.thumbnail} alt="" width="640" height="360" loading="lazy" decoding="async" />
              </span>
              <span className="search-hit-body">
                <span className="chip chip-gold">
                  {seasonEpisodeLabel(item.season, item.episodeNumber, item.kind)}
                </span>
                <h3>{item.kind === 'episode' ? `Episode ${item.episodeNumber}` : item.title}</h3>
                <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                  {isPlayable(item) ? (
                    <>
                      {formatRuntime(item.durationSeconds)}
                      {item.resolution ? ` · ${item.resolution.label}` : ''}
                    </>
                  ) : (
                    'Not currently available'
                  )}
                  {item.guests.length > 0 ? ` · with ${item.guests.slice(0, 3).join(', ')}` : ''}
                </span>
                <span className="search-hit-why">
                  {matchedOn.map((m) => (
                    <span className="chip" key={m}>
                      {m}
                    </span>
                  ))}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && (
        <div className="search-empty">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG brand mark */}
          <img src="/brand/mark.svg" alt="" width="56" height="56" />
          <h2>Nothing in the vault matches that</h2>
          <p>
            The archive only holds verified Season 2 episodes of India’s Got Latent. Check
            the spelling, try an episode number like “S2E6”, or browse a season instead.
          </p>
          <div className="tips">
            <Link href="/season/2" className="btn btn-outline">
              Browse Season 2
            </Link>
            <Link href="/bonus" className="btn btn-outline">
              Browse Bonus
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
