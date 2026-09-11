'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ContentItem } from '@/catalog/types';
import { isPlayable } from '@/catalog/types';
import { searchCatalog } from '@/catalog/search';
import { formatRuntime } from '@/lib/format';

const HINTS = ['S2E6', 'Rakhi Sawant', 'Tanmay Bhat', 'Bonus', 'Orry'];

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
          placeholder="Guest, episode, title&hellip;"
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
            ? 'No matches'
            : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
        </p>
      )}

      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map(({ item, matchedOn }) => (
            <Link key={item.id} href={`/watch/${item.slug}`} className="search-hit">
              <span className="search-hit-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt="" width="320" height="180" loading="lazy" decoding="async" />
              </span>
              <span className="search-hit-body">
                <span className="search-hit-no">
                  S{item.season} · {item.kind === 'episode'
                    ? `E${String(item.episodeNumber).padStart(2, '0')}`
                    : item.title}
                </span>
                <h3>
                  {item.guests.length > 0
                    ? item.guests.slice(0, 3).join(', ')
                    : item.title}
                </h3>
                <span className="search-hit-meta">
                  {isPlayable(item)
                    ? [item.durationSeconds ? formatRuntime(item.durationSeconds) : null,
                       item.resolution?.label].filter(Boolean).join(' · ')
                    : 'Unavailable'}
                </span>
                {matchedOn.length > 0 && (
                  <span className="search-hit-why">
                    {matchedOn.map((m) => <span key={m}>{m}</span>)}
                  </span>
                )}
              </span>
              <span className="archive-cta hit-cta">
                {isPlayable(item) ? 'Watch' : 'View'} <span className="arr" aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && (
        <div className="search-empty">
          <h2>Nothing in the vault matches that.</h2>
          <p>
            The archive covers Season 2 of India&rsquo;s Got Latent — try a guest name,
            an episode number like &ldquo;S2E5&rdquo;, or browse the season directly.
          </p>
          <div className="tips">
            <Link href="/season/2" className="more">Browse Season 2 →</Link>
            <Link href="/bonus" className="more">Browse Bonus →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
