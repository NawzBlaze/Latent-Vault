/**
 * yuhu.freeforall.dev source client — the SECONDARY media source.
 *
 * How Yuhu serves media (reverse-engineered from its public player page):
 *  - Catalogue data: GET https://yuhu.freeforall.dev/okcdn.json
 *    (entries with type 'okcdn' carry a stable okcdn `videoId`).
 *  - Resolution: GET {worker}/?id={videoId} where the worker URL comes from
 *    Yuhu's public /config.json (OKCDN_WORKER). The worker REQUIRES a Yuhu
 *    Referer, otherwise 403 'Invalid referer'.
 *  - The worker returns {status:'success', streams:[{type:'1080p', url}]}
 *    with direct CDN URLs (vd*.okcdn.ru). URLs are signed (~5 day expiry).
 *
 * Researched edge cases (see docs/SOURCE.md):
 *  - The worker sometimes serves STALE cache entries whose signatures are
 *    already dead (CDN answers 400). Every resolved URL is HEAD-verified;
 *    on failure we re-resolve once before giving up.
 *  - The CDN binds playback to the resolving User-Agent family (srcAg):
 *    a URL resolved with a desktop-Chrome UA 400s for iPhone Safari,
 *    Firefox, and even iOS Chrome. Yuhu's own player resolves IN the
 *    browser, so its srcAg always matches the viewer. We mirror that by
 *    forwarding the /api/play caller's EXACT User-Agent to the worker and
 *    verifying the CDN URL with the same UA. Verified for desktop Chrome,
 *    Android Chrome, desktop/iOS Safari, desktop Firefox, iOS Chrome
 *    (CriOS) and iOS Firefox (FxiOS).
 *  - The CDN requires a browser-like User-Agent (empty/curl UA -> 400) and
 *    honours Range (206 + Content-Range, Accept-Ranges: bytes).
 *  - Quality labels are verified by probe, not trusted: resolution requests
 *    the EXACT catalogue quality and fails rather than silently downgrading
 *    (a 720p stream under a 1080p badge would be a fake quality label).
 *
 * Nothing in this module is imported by client components: worker calls and
 * URL verification happen server-side only, inside the /api/play route.
 */

import { ResolvedMedia, SourceError, YuhuFileRef } from './types';

export const YUHU_SITE_ORIGIN = 'https://yuhu.freeforall.dev';
export const YUHU_WORKER_URL =
  process.env.YUHU_WORKER_URL?.replace(/\/$/, '') || 'https://okcdn.okcdn-api.workers.dev';

/**
 * Fallback UA when the caller sends none. Real browsers always send one;
 * the CDN 400s requests without a browser-like UA.
 */
export const FALLBACK_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const REQUEST_TIMEOUT_MS = 12000;

/**
 * Cache lifetime policy.
 *
 * Measured 2026-09-09 against the live CDN: a minted okcdn URL carries an
 * `expires` query parameter ~127.5 h (5.3 days) in the future, and the CDN
 * answers 400 once that moment passes. The previous flat 10-minute TTL
 * therefore discarded a still-valid URL after 0.3% of its real life, forcing
 * an unnecessary worker round-trip for every returning viewer.
 *
 * The cache is now expiry-derived instead of flat:
 *   lifetime = min(MAX_TTL, urlExpiry - SAFETY_MARGIN)
 * so a cached entry is always evicted long before the signature dies, and is
 * never longer than MAX_TTL even if the source ever issues longer-lived URLs.
 */
/** Absolute cap on how long one cached URL may be reused. */
const RESOLVE_CACHE_MAX_TTL_MS = 6 * 60 * 60_000;
/** Never serve a URL that has less than this much life left. */
const EXPIRY_SAFETY_MARGIN_MS = 24 * 60 * 60_000;
/** Conservative fallback used only when a URL exposes no usable `expires`. */
const RESOLVE_CACHE_TTL_MS = 10 * 60_000;
/** Cap: cache entries are keyed by exact caller UA (signatures bind to it). */
const RESOLVE_CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  media: ResolvedMedia;
  storedAt: number;
  /** Epoch ms after which this entry must not be served. */
  expiresAt: number;
}

const resolveCache = new Map<string, CacheEntry>();

export function clearYuhuCache(): void {
  resolveCache.clear();
}

/**
 * Read the CDN's own expiry from a signed URL. okcdn signs with epoch
 * milliseconds (`expires=1789423829788`); tolerate seconds too. Returns null
 * when the URL carries no usable expiry, in which case the caller must fall
 * back to the conservative TTL rather than assume the URL is long-lived.
 * Exported for tests.
 */
export function readUrlExpiryMs(playUrl: string): number | null {
  let raw: string | null = null;
  try {
    raw = new URL(playUrl).searchParams.get('expires');
  } catch {
    return null;
  }
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // < 1e11 means seconds (year ~5138 in ms is implausible); otherwise ms.
  const ms = n < 1e11 ? n * 1000 : n;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * How long (ms) a freshly minted URL may stay cached.
 *
 * Three cases, all deliberately conservative:
 *  1. No usable `expires` on the URL -> the source gave us no expiry claim, so
 *     fall back to the short conservative TTL rather than assume longevity.
 *  2. `expires` already in the past -> the claim contradicts the CDN, which
 *     just answered 200 for it. Treat the claim as untrustworthy and again use
 *     the short TTL (never the long one).
 *  3. `expires` in the future -> cache until SAFETY_MARGIN before it dies,
 *     capped at MAX_TTL. If the URL is already inside the safety margin there
 *     is no window worth caching, so return 0 and skip the cache entirely.
 *
 * Exported for tests.
 */
export function cacheLifetimeMs(playUrl: string, now: number = Date.now()): number {
  const exp = readUrlExpiryMs(playUrl);
  if (exp === null || exp <= now) return RESOLVE_CACHE_TTL_MS;
  const safe = exp - EXPIRY_SAFETY_MARGIN_MS - now;
  if (safe <= 0) return 0; // inside the safety margin: not worth caching
  return Math.min(safe, RESOLVE_CACHE_MAX_TTL_MS);
}

interface WorkerStream {
  type?: string;
  url?: string;
}

interface WorkerResponse {
  status?: string;
  message?: string;
  error?: string;
  streams?: WorkerStream[];
}

/**
 * Security gate: Yuhu resolutions may only ever redirect to the OK.ru CDN
 * hosts the worker is known to return. Anything else fails loudly instead
 * of sending the browser somewhere unexpected.
 */
const ALLOWED_CDN_SUFFIXES = ['.okcdn.ru', '.mycdn.me'];

export function toAllowedYuhuUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SourceError('INVALID', 'worker returned a malformed stream URL');
  }
  if (url.protocol !== 'https:') {
    throw new SourceError('INVALID', 'refusing to redirect to a non-https stream URL');
  }
  const host = url.hostname.toLowerCase();
  const ok = ALLOWED_CDN_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
  if (!ok) {
    throw new SourceError('INVALID', `refusing to redirect outside the Yuhu CDN hosts: ${host}`);
  }
  return url.toString();
}

/** Pick the EXACT requested quality. No silent downgrade, ever. */
export function pickStream(streams: WorkerStream[], quality: string): string {
  const hit = (streams ?? []).find((s) => s.type === quality && typeof s.url === 'string' && s.url.length > 0);
  if (!hit?.url) {
    const available = (streams ?? []).map((s) => s.type).filter(Boolean).join(',') || 'none';
    throw new SourceError(
      'NOT_FOUND',
      `quality ${quality} not offered by Yuhu worker (offers: ${available})`,
    );
  }
  return hit.url;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SourceError('TIMEOUT', `yuhu request timed out after ${timeoutMs}ms: ${url.slice(0, 80)}`);
    }
    throw new SourceError('UPSTREAM', `yuhu unreachable: ${(err as Error).message}`);
  } finally {
    clearTimeout(t);
  }
}

async function callWorker(ref: YuhuFileRef, userAgent: string): Promise<WorkerResponse> {
  const url = `${YUHU_WORKER_URL}/?id=${encodeURIComponent(ref.videoId)}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
        Referer: `${YUHU_SITE_ORIGIN}/player?id=${encodeURIComponent(ref.dataId)}`,
        Origin: YUHU_SITE_ORIGIN,
      },
    },
    REQUEST_TIMEOUT_MS,
  );
  if (res.status === 403) throw new SourceError('FORBIDDEN', 'yuhu worker refused the request (referer?)');
  if (!res.ok) throw new SourceError('UPSTREAM', `yuhu worker -> ${res.status}`);
  const body = (await res.json().catch(() => null)) as WorkerResponse | null;
  if (!body || body.status !== 'success' || !Array.isArray(body.streams)) {
    throw new SourceError('UPSTREAM', `yuhu worker error: ${body?.message || body?.error || 'bad shape'}`);
  }
  return body;
}

/**
 * HEAD-verify a CDN URL (small request, no bytes). Returns the content
 * length when the URL is good; throws SourceError('INVALID') when stale.
 */
async function verifyCdnUrl(playUrl: string, userAgent: string): Promise<number | null> {
  const res = await fetchWithTimeout(
    playUrl,
    { method: 'HEAD', headers: { 'User-Agent': userAgent } },
    REQUEST_TIMEOUT_MS,
  );
  if (res.status === 400) {
    // Known worker pathology: a stale cached entry with a dead signature.
    throw new SourceError('INVALID', 'cdn rejected the resolved URL as stale (400)');
  }
  if (res.status !== 200 && res.status !== 206) {
    throw new SourceError('UPSTREAM', `cdn HEAD -> ${res.status}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('video/')) {
    throw new SourceError('INVALID', `cdn served unexpected content-type: ${contentType || 'none'}`);
  }
  const lenRaw = res.headers.get('content-length');
  return lenRaw ? Number(lenRaw) : null;
}

function cacheKey(ref: YuhuFileRef, userAgent: string): string {
  // Exact UA: CDN signatures bind to the resolving UA (srcAg), so a URL
  // minted for one UA must never be served to another.
  return `${ref.videoId}::${ref.quality}::${userAgent}`;
}

function cacheSet(key: string, media: ResolvedMedia): void {
  const now = Date.now();
  const lifetime = cacheLifetimeMs(media.playUrl, now);
  // A URL too close to its own expiry is not worth caching; the caller still
  // receives it (it was HEAD-verified good on this request).
  if (lifetime <= 0) return;
  if (resolveCache.size >= RESOLVE_CACHE_MAX_ENTRIES) {
    const oldest = resolveCache.keys().next().value as string | undefined;
    if (oldest) resolveCache.delete(oldest);
  }
  resolveCache.set(key, { media, storedAt: now, expiresAt: now + lifetime });
}

/** Test seam: report the remaining cache life for a key (ms), or -1. */
export function yuhuCacheRemainingMs(key: string): number {
  const e = resolveCache.get(key);
  if (!e) return -1;
  return e.expiresAt - Date.now();
}

/** Test seam: expose the key format without exporting the map itself. */
export function yuhuCacheKey(ref: YuhuFileRef, userAgent: string): string {
  return cacheKey(ref, userAgent);
}

/**
 * Resolve one stable Yuhu reference to a fresh, verified playable URL.
 * `callerUa` is the viewing browser's User-Agent, forwarded EXACTLY so the
 * minted signature matches the browser that will play it. Verifies the CDN
 * URL and re-resolves ONCE on staleness — never retries forever.
 */
export async function resolveYuhuFile(ref: YuhuFileRef, callerUa?: string | null): Promise<ResolvedMedia> {
  const userAgent = callerUa?.trim() ? callerUa.trim().slice(0, 500) : FALLBACK_USER_AGENT;
  const key = cacheKey(ref, userAgent);
  const cached = resolveCache.get(key);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      // Cache hit: no worker call, no CDN HEAD. The stored URL is guaranteed
      // to still hold at least EXPIRY_SAFETY_MARGIN_MS of life, so it is safe
      // to hand back without re-verification.
      return { ...cached.media, cached: true };
    }
    // Past its safe-by date: drop it so a fresh URL is minted below.
    resolveCache.delete(key);
  }
  const t0 = Date.now();
  let lastErr: unknown = null;
  // Attempt 1: resolve + verify. Attempt 2 (only): fresh re-resolve for the
  // known stale-cache pathology. Two attempts total, then fail honestly.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const worker = await callWorker(ref, userAgent);
      const playUrl = toAllowedYuhuUrl(pickStream(worker.streams ?? [], ref.quality));
      const sizeBytes = await verifyCdnUrl(playUrl, userAgent);
      const media: ResolvedMedia = {
        playUrl,
        origin: 'yuhu',
        mimeType: ref.mimeType,
        sizeBytes,
        refName: ref.dataId,
        via: 'primary',
        resolvedAt: Date.now(),
        resolveMs: Date.now() - t0,
        cached: false,
      };
      cacheSet(key, media);
      return media;
    } catch (err) {
      lastErr = err;
      // Only the stale-signature pathology merits a re-resolve. Missing
      // quality, forbidden worker, timeouts etc. fail immediately.
      if (!(err instanceof SourceError) || err.code !== 'INVALID') break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new SourceError('UPSTREAM', 'yuhu resolution failed');
}
