/**
 * Source-layer types.
 *
 * LATENT VAULT has exactly TWO media sources, in strict priority order:
 *   1. index.csbots.live  (primary)
 *   2. yuhu.freeforall.dev (secondary — used only when index lacks usable
 *      media for the same episode)
 *
 * All source-specific knowledge lives behind the clients in ./adapter (index)
 * and ./yuhu, coordinated by the priority resolver in ./resolve.
 */

/** Which of the two authorised sources a reference points at. */
export type SourceOrigin = 'index' | 'yuhu';

/**
 * Stable reference to one file on index.csbots.live.
 * Never contains expiring data (search ids rotate per request).
 */
export interface IndexFileRef {
  origin: 'index';
  /** Exact file name on the source (stable). */
  fileName: string;
  /** Size in bytes as listed by the source (stable, used to disambiguate). */
  sizeBytes: number;
  /** MIME type as listed by the source. */
  mimeType: string;
  /**
   * Short query hint that narrows the source search to this file.
   * Only an optimisation — resolution always verifies the exact file name.
   */
  searchHint: string;
  /** Optional operator note (e.g. why this variant is primary). */
  note?: string;
}

/**
 * Stable reference to one Yuhu okcdn entry.
 * Never contains expiring data (CDN URLs expire after ~5 days and the
 * worker occasionally serves stale cache entries).
 */
export interface YuhuFileRef {
  origin: 'yuhu';
  /** Yuhu's own stable entry id from /okcdn.json (e.g. 's2-06-rakhi'). */
  dataId: string;
  /** The okcdn video id the worker resolves (stable). */
  videoId: string;
  /** Verified quality label to request, e.g. '1080p'. Exact match required. */
  quality: string;
  /** MIME type served by the CDN for this quality (probed). */
  mimeType: string;
  /** Optional operator note (e.g. Yuhu's label vs our canonical numbering). */
  note?: string;
}

/** A freshly resolved, playable media URL. Short-lived by nature. */
export interface ResolvedMedia {
  /** Absolute playable URL on a source CDN (contains a fresh signature). */
  playUrl: string;
  /** Which authorised source produced this URL. */
  origin: SourceOrigin;
  mimeType: string;
  sizeBytes: number | null;
  /** Stable identity of the resolved ref (file name or Yuhu dataId). */
  refName: string;
  /** Which reference produced this URL: 'primary' or 'alternate:<n>'. */
  via: string;
  resolvedAt: number;
  /** How long (ms) the resolution round-trip took. */
  resolveMs: number;
  /**
   * True when this result was served from the server-side resolution cache
   * rather than freshly minted. Observability only — never a functional
   * branch. Optional so source clients that do not cache may omit it.
   */
  cached?: boolean;
}

export interface MediaVerification {
  ok: boolean;
  status: number | null;
  contentType: string | null;
  contentLength: number | null;
  contentRange: string | null;
  rangeSupported: boolean;
  latencyMs: number;
  error?: string;
}

export class SourceError extends Error {
  readonly code: 'NOT_FOUND' | 'UPSTREAM' | 'TIMEOUT' | 'FORBIDDEN' | 'INVALID';
  constructor(code: SourceError['code'], message: string) {
    super(message);
    this.name = 'SourceError';
    this.code = code;
  }
}
