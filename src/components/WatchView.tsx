'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { ContentItem } from '@/catalog/types';
import { isPlayable, primaryOrigin } from '@/catalog/types';
import type { PrevNext } from '@/catalog/order';
import LatentPlayer from '@/player/LatentPlayer';
import { formatRuntime } from '@/lib/format';
import { prefetchOnPageLoad } from '@/lib/prefetch';

interface Props {
  item: ContentItem;
  prevNext: PrevNext;
  related: ContentItem[];
}

const ROLES: { key: 'guests' | 'panelists' | 'participants' | 'hosts' | 'judges'; label: string }[] = [
  { key: 'guests',       label: 'Guests' },
  { key: 'panelists',    label: 'Panelists' },
  { key: 'participants', label: 'Participants' },
  { key: 'hosts',        label: 'Hosts' },
  { key: 'judges',       label: 'Judges' },
];

function codecLabel(codec?: string): string | null {
  if (!codec) return null;
  const map: Record<string, string> = {
    avc1: 'AVC', 'V_MPEG4/ISO/AVC': 'AVC',
    av01: 'AV1',
    hev1: 'HEVC', hvc1: 'HEVC', 'V_MPEGH/ISO/HEVC': 'HEVC',
    mp4a: 'AAC', A_AAC: 'AAC',
    'ac-3': 'Dolby Digital', 'ec-3': 'Dolby Digital+', A_EAC3: 'Dolby Digital+',
  };
  return map[codec] ?? codec;
}

function sourceLine(origin: 'index' | 'yuhu' | 'youtube' | null): string | null {
  if (origin === 'index') return 'Streams directly from index.csbots.live';
  if (origin === 'yuhu')  return 'Streams via the Yuhu archive (secondary source)';
  if (origin === 'youtube') return 'Streamed via official YouTube upload';
  return null;
}

export default function WatchView({ item, prevNext, related }: Props) {
  const [theater, setTheater] = useState(false);
  const playable = isPlayable(item);
  const isYoutube = item.source?.primary.origin === 'youtube';
  const youtubeVideoId = isYoutube && item.source?.primary.origin === 'youtube' ? item.source.primary.videoId : null;
  const v = item.source?.primary ?? null;
  const formatBits = v && v.origin !== 'youtube'
    ? [
        v.mimeType === 'video/mp4' ? 'MP4' : v.mimeType === 'video/x-matroska' ? 'MKV' : null,
        codecLabel(v.videoCodec),
        codecLabel(v.audioCodec),
      ].filter(Boolean)
    : [];
  const origin = sourceLine(primaryOrigin(item));

  useEffect(() => {
    if (playable && !isYoutube) prefetchOnPageLoad(item.id);
  }, [item.id, playable, isYoutube]);

  return (
    <div className={`watch-layout${theater ? ' is-theater' : ''}`}>
      <div>
        {playable && youtubeVideoId ? (
          <div className="yt-embed" style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000', borderRadius: '4px', overflow: 'hidden' }}>
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`}
              title={`India's Got Latent — S2 E${item.episodeNumber}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : playable && item.source ? (
          <LatentPlayer
            contentId={item.id}
            title={`India's Got Latent — ${item.kind === 'episode' ? `S2 E${item.episodeNumber}` : item.title}`}
            poster={item.thumbnail}
            qualityLabel={item.resolution?.label}
            formatLabel={formatBits.join(' · ') || undefined}
            sourceNote={'note' in (v ?? {}) ? (v as { note?: string }).note : undefined}
            prevNext={prevNext}
            onTheaterChange={setTheater}
          />
        ) : (() => {
          const ytUrl = item.officialUrl?.url ?? '';
          const ytMatch = ytUrl.match(/[?&]v=([A-Za-z0-9_-]{11})/);
          const ytId = ytMatch?.[1] ?? null;
          const ytThumb = ytId ? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg` : item.thumbnail;

          return (
            <div className="yt-panel" role="status" aria-label="Episode available on YouTube">
              <div
                className="yt-panel-bg"
                style={{ backgroundImage: `url(${ytThumb})` }}
                aria-hidden="true"
              />
              <div className="yt-panel-body">
                <div className="yt-panel-kicker">
                  S{item.season} · {item.kind === 'episode'
                    ? `Episode ${String(item.episodeNumber).padStart(2, '0')}`
                    : item.title} · No archived copy
                </div>
                <h2 className="yt-panel-title">
                  {[...item.guests, ...item.panelists].slice(0, 3).join(', ')}
                </h2>
                <p className="yt-panel-copy">
                  This episode is available on the official Samay Raina YouTube channel.
                  The archive does not stream, re-host or proxy YouTube video.
                </p>
                {item.officialUrl && (
                  <div className="yt-panel-actions">
                    <a
                      className="btn btn-solid"
                      href={item.officialUrl.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      Watch on YouTube ↗
                    </a>
                    <span className="yt-panel-note">Official upload</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="watch-head">
          <span className="watch-no">
            {item.kind === 'episode'
              ? `Season 2 · Episode ${String(item.episodeNumber).padStart(2, '0')}`
              : `Season 2 · ${item.title}`}
          </span>
          <h1>India&rsquo;s Got Latent</h1>

          <div className="watch-facts">
            <span>
              {item.releaseDate
                ? new Date(item.releaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Date unverified'}
            </span>
            {playable ? (
              <>
                {item.durationSeconds && <span><strong>{formatRuntime(item.durationSeconds)}</strong></span>}
                {item.resolution && <span><strong>{item.resolution.label}</strong></span>}
                {formatBits.length > 0 && <span>{formatBits.join(' · ')}</span>}
              </>
            ) : (
              <span>Unavailable</span>
            )}
          </div>

          <p className="watch-desc">{item.description}</p>

          {ROLES.some((r) => item[r.key].length > 0) && (
            <div className="watch-people">
              {ROLES.filter((r) => item[r.key].length > 0).map((r) => (
                <div className="watch-people-row" key={r.key}>
                  <span className="watch-people-role">{r.label}</span>
                  <span className="watch-people-names">{item[r.key].join(' · ')}</span>
                </div>
              ))}
            </div>
          )}

          {origin && (
            <div className="source-line"><strong>Source</strong> — {origin}.</div>
          )}
          {'note' in (v ?? {}) && (v as { note?: string }).note && (
            <div className="source-note"><strong>Note</strong> — {(v as { note: string }).note}</div>
          )}

          <div className="prevnext">
            {prevNext.prev ? (
              <Link href={`/watch/${prevNext.prev.slug}`}>
                <span className="dir">← Previous</span>
                <span>
                  {prevNext.prev.kind === 'episode'
                    ? `Episode ${String(prevNext.prev.episodeNumber).padStart(2, '0')}`
                    : prevNext.prev.title}
                  {prevNext.prev.guests.length > 0 && ` — ${prevNext.prev.guests.slice(0, 2).join(', ')}`}
                </span>
              </Link>
            ) : (
              <span className="empty"><span className="dir">← Previous</span><span>Start of the season</span></span>
            )}
            {prevNext.next ? (
              <Link href={`/watch/${prevNext.next.slug}`}>
                <span className="dir">Next →</span>
                <span>
                  {prevNext.next.kind === 'episode'
                    ? `Episode ${String(prevNext.next.episodeNumber).padStart(2, '0')}`
                    : prevNext.next.title}
                  {prevNext.next.guests.length > 0 && ` — ${prevNext.next.guests.slice(0, 2).join(', ')}`}
                </span>
              </Link>
            ) : (
              <span className="empty"><span className="dir">Next →</span><span>End of the season</span></span>
            )}
          </div>
        </div>
      </div>

      <aside className="watch-side">
        <section aria-label="More from Season 2">
          <h2 className="watch-side-title">More from Season 2</h2>
          <div>
            {related.map((r) => (
              <Link key={r.id} href={`/watch/${r.slug}`} className="archive-row" style={{ gridTemplateColumns: '112px minmax(0, 1fr)', padding: '14px 0', display: 'grid', gap: '14px', alignItems: 'center', borderBottom: '1px solid var(--rule)' }}>
                <span className="archive-thumb" style={{ display: 'block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbnail} alt="" width="320" height="180" loading="lazy" decoding="async" />
                </span>
                <span>
                  <span className="search-hit-no">
                    {r.kind === 'episode'
                      ? `E${String(r.episodeNumber).padStart(2, '0')}`
                      : r.title}
                  </span>
                  <span style={{ display: 'block', marginTop: '4px', fontSize: 'var(--t-small)', color: 'var(--paper-dim)' }}>
                    {r.guests.slice(0, 2).join(', ')}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
