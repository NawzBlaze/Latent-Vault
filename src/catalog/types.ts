import type { IndexFileRef, YuhuFileRef } from '@/source/types';

export type ContentKind = 'episode' | 'bonus' | 'special';

/** Public catalogue scope: ONLY Season 2. Enforced by validate + tests. */
export const PUBLIC_SEASON = 2;

/** One playable file reference. Index refs always precede Yuhu refs. */
export type MediaVariant = (IndexFileRef | YuhuFileRef) & {
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
};

export type IndexVariant = MediaVariant & { origin: 'index' };
export type YuhuVariant = MediaVariant & { origin: 'yuhu' };

export interface SourceReference {
  primary: MediaVariant;
  alternates: MediaVariant[];
}

/** Playback availability. 'unavailable' = verified identity, no usable media. */
export type Availability = 'available' | 'unavailable';

export interface ResolutionInfo {
  width: number;
  height: number;
  /** Honest label derived from probed pixels, e.g. '1080p', '2160p'. */
  label: string;
}

export interface ContentItem {
  id: string;
  slug: string;
  season: number;
  episodeNumber: number;
  kind: ContentKind;
  title: string;
  /** Factual archive note. Only states verified facts, never guesses. */
  description: string;
  /** Original release date (verified). null = unknown (never guessed). */
  releaseDate: string | null;
  /**
   * When the source copy was last modified (when we archived it), or null
   * when no media is archived (unavailable items). NEVER a release date.
   */
  archivedAt: string | null;
  /** Runtime in seconds, probed from real media. null = no media. */
  durationSeconds: number | null;
  thumbnail: string;
  heroImage: string;
  guests: string[];
  panelists: string[];
  participants: string[];
  hosts: string[];
  judges: string[];
  /** Alternate spellings / truncated forms seen in source file names. */
  aliases: string[];
  /**
   * Stable source references, or null when no usable media exists on
   * either authorised source. Never contains expiring URLs.
   */
  source: SourceReference | null;
  availability: Availability;
  resolution: ResolutionInfo | null;
  published: boolean;
  /**
   * Official external upload (e.g. the show's own YouTube channel), shown as an
   * outbound link ONLY. This is never a playback source: no bytes are fetched,
   * embedded, proxied or redirected through it, and /api/play ignores it
   * entirely. Present when the archive has no media but an official copy
   * exists elsewhere.
   */
  officialUrl?: { url: string; label: string } | null;
}

export interface PersonRef {
  name: string;
  role: 'guest' | 'panelist' | 'participant' | 'host' | 'judge';
}

/** True only when the item may be served by /api/play. */
export function isPlayable(item: ContentItem): boolean {
  return (
    item.published === true &&
    item.availability === 'available' &&
    item.source !== null
  );
}

/** Which authorised source serves this item first (null = none). */
export function primaryOrigin(item: ContentItem): 'index' | 'yuhu' | null {
  return item.source ? item.source.primary.origin : null;
}
