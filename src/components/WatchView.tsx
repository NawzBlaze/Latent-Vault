'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ContentItem } from '@/catalog/types';
import { isPlayable, primaryOrigin } from '@/catalog/types';
import type { PrevNext } from '@/catalog/order';
import LatentPlayer from '@/player/LatentPlayer';
import { formatRuntime } from '@/lib/format';
import EpisodeCard from './EpisodeCard';

interface Props {
  item: ContentItem;
  prevNext: PrevNext;
  related: ContentItem[];
}

const ROLES: { key: 'guests' | 'panelists' | 'participants' | 'hosts' | 'judges'; label: string }[] = [
  { key: 'guests', label: 'Guests' },
  { key: 'panelists', label: 'Panelists' },
  { key: 'participants', label: 'Participants' },
  { key: 'hosts', label: 'Hosts' },
  { key: 'judges', label: 'Judges' },
];

function codecLabel(codec?: string): string | null {
  if (!codec) return null;
  const map: Record<string, string> = {
    avc1: 'AVC',
    'V_MPEG4/ISO/AVC': 'AVC',
    av01: 'AV1',
    hev1: 'HEVC',
    hvc1: 'HEVC',
    'V_MPEGH/ISO/HEVC': 'HEVC',
    mp4a: 'AAC',
    A_AAC: 'AAC',
    'ac-3': 'Dolby Digital',
    'ec-3': 'Dolby Digital+',
    A_EAC3: 'Dolby Digital+',
  };
  return map[codec] ?? codec;
}

function sourceLine(origin: 'index' | 'yuhu' | null): string | null {
  if (origin === 'index') return 'Streams directly from index.csbots.live';
  if (origin === 'yuhu') return 'Streams via the Yuhu archive (secondary source)';
  return null;
}

export default function WatchView({ item, prevNext, related }: Props) {
  const [theater, setTheater] = useState(false);
  const playable = isPlayable(item);
  const label =
    item.kind === 'episode'
      ? `Season ${item.season} · Episode ${item.episodeNumber}`
      : `Season ${item.season} · ${item.title}`;
  const v = item.source?.primary ?? null;
  const formatBits = v
    ? [
        v.mimeType === 'video/mp4' ? 'MP4' : v.mimeType === 'video/x-matroska' ? 'MKV' : null,
        codecLabel(v.videoCodec),
        codecLabel(v.audioCodec),
      ].filter(Boolean)
    : [];
  const origin = sourceLine(primaryOrigin(item));

  return (
    <div className={`watch-layout${theater ? ' is-theater' : ''}`}>
      <div>
        {playable && item.source ? (
          <LatentPlayer
            contentId={item.id}
            title={`India's Got Latent — ${label}`}
            poster={item.thumbnail}
            qualityLabel={item.resolution?.label}
            formatLabel={formatBits.join(' · ') || undefined}
            sourceNote={v?.note}
            onTheaterChange={setTheater}
          />
        ) : (
          <div className="unavailable-panel glass-surface" role="status" aria-label="Episode not available">
            <div className="unavailable-kicker">{label}</div>
            <h2 className="unavailable-title">Not currently available</h2>
            <p className="unavailable-copy">
              This episode’s identity is verified, but no usable media copy exists on the
              archive’s sources yet — so there is nothing to play. The moment a verified
              copy appears, it will stream here.
            </p>
            {item.officialUrl ? (
              <div className="unavailable-official">
                <a
                  className="btn btn-gold btn-glow"
                  href={item.officialUrl.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                    <path
                      fill="currentColor"
                      d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"
                    />
                  </svg>
                  {item.officialUrl.label}
                </a>
                <p className="unavailable-note">
                  Opens the show’s own channel in a new tab. The archive does not stream,
                  embed or proxy this video.
                </p>
              </div>
            ) : null}
          </div>
        )}

        <div className="watch-title-block">
          <div className="kicker">{label}</div>
          <h1>India’s Got Latent</h1>
          <div className="meta-row">
            <span className="chip chip-gold">S{item.season} E{item.episodeNumber}</span>
            <span className="chip">{item.kind === 'bonus' ? 'Bonus' : item.kind === 'special' ? 'Special' : 'Episode'}</span>
            {playable ? (
              <>
                <span className="chip">{formatRuntime(item.durationSeconds)}</span>
                {item.resolution && <span className="chip">{item.resolution.label}</span>}
                {formatBits.length > 0 && <span className="chip">{formatBits.join(' · ')}</span>}
              </>
            ) : (
              <span className="chip chip-muted">Not available</span>
            )}
          </div>

          <p className="watch-desc">{item.description}</p>

          {ROLES.some((r) => item[r.key].length > 0) && (
            <div className="watch-people">
              {ROLES.filter((r) => item[r.key].length > 0).map((r) => (
                <div className="watch-people-row" key={r.key}>
                  <span className="watch-people-role">{r.label}</span>
                  <span>{item[r.key].join(' · ')}</span>
                </div>
              ))}
            </div>
          )}

          {origin && (
            <div className="source-line">
              <strong>Source.</strong> {origin}
            </div>
          )}

          {v?.note && (
            <div className="source-note">
              <strong>Source note.</strong> {v.note}
            </div>
          )}

          <div className="prevnext">
            {prevNext.prev ? (
              <Link href={`/watch/${prevNext.prev.slug}`}>
                <span className="dir">← Previous</span>
                <span className="t">
                  S{prevNext.prev.season} ·{' '}
                  {prevNext.prev.kind === 'episode' ? `Episode ${prevNext.prev.episodeNumber}` : prevNext.prev.title}
                </span>
              </Link>
            ) : (
              <span className="empty">
                <span className="dir">← Previous</span>
                <span className="t">Start of this collection</span>
              </span>
            )}
            {prevNext.next ? (
              <Link href={`/watch/${prevNext.next.slug}`}>
                <span className="dir">Next →</span>
                <span className="t">
                  S{prevNext.next.season} ·{' '}
                  {prevNext.next.kind === 'episode' ? `Episode ${prevNext.next.episodeNumber}` : prevNext.next.title}
                </span>
              </Link>
            ) : (
              <span className="empty">
                <span className="dir">Next →</span>
                <span className="t">End of this collection</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <aside className="watch-side">
        <section className="section" style={{ marginTop: 8 }} aria-label="Related episodes">
          <div className="section-head">
            <h2>More from the vault</h2>
          </div>
          <div className="card-grid">
            {related.map((r) => (
              <EpisodeCard key={r.id} item={r} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
