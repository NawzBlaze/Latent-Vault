/**
 * index.csbots.live source adapter — the ONE place that knows how the
 * primary media source works.
 *
 * How the source behaves (reverse-engineered from its public web UI):
 *  - Catalogue data is served as JSON: POST {origin}/0:search {q, page_token, page_index}
 *  - Search results carry per-request encrypted `id` tokens (they ROTATE —
 *    they are NOT stable identifiers and must never be stored).
 *  - A fresh playable link is minted per request: POST {origin}/0:fallback {id}
 *    -> { name, mimeType, size, link: "/download.aspx?file=…&expiry=…&mac=…" }
 *  - The `link` is a short-lived signed URL. It supports HTTP Range
 *    (206 + Content-Range) and serves bytes directly to the browser.
 *
 * Stable identity therefore = exact `fileName` (+ `sizeBytes` to disambiguate).
 * At playback-authorisation time we re-search, exact-match the file name,
 * mint a fresh link, and 307-redirect the browser to it.
 *
 * Nothing in this module is imported by client components: fresh signed URLs
 * are minted server-side only, inside the /api/play route.
 */

import { ResolvedMedia, SourceError, IndexFileRef, MediaVerification } from './types';

export const SOURCE_ORIGIN =
  process.env.SOURCE_ORIGIN?.replace(/\/$/, '') || 'https://index.csbots.live';

const REQUEST_TIMEOUT_MS = 12000;
/** Fresh-link cache TTL. Signed URLs expire server-side; keep this well below that. */
const RESOLVE_CACHE_TTL_MS = 45_000;

interface CacheEntry {
  media: ResolvedMedia;
  storedAt: number;
}

const resolveCache = new Map<string, CacheEntry>();

interface SourceSearchFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  link?: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SOURCE_ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'latent-vault/1.0' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 404) throw new SourceError('NOT_FOUND', `source ${path} -> 404`);
      throw new SourceError('UPSTREAM', `source ${path} -> ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof SourceError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SourceError('TIMEOUT', `source ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new SourceError('UPSTREAM', `source ${path} unreachable: ${(err as Error).message}`);
  } finally {
    clearTimeout(t);
  }
}

/** Search the source and return the exact file hit, or null. */
async function searchExact(fileName: string, queries: string[]): Promise<SourceSearchFile | null> {
  for (const q of queries) {
    const res = await postJson<{
      nextPageToken: string | null;
      curPageIndex: number;
      data: { files: SourceSearchFile[] } | null;
    }>('/0:search', { q, page_token: null, page_index: 0 });
    const files = res.data?.files ?? [];
    const hit = files.find((f) => f.name === fileName);
    if (hit) return hit;
    // Paginate (the source pages large result sets).
    let token = res.nextPageToken;
    let idx = res.curPageIndex + 1;
    let guard = 0;
    while (token && guard++ < 5) {
      const page = await postJson<{
        nextPageToken: string | null;
        curPageIndex: number;
        data: { files: SourceSearchFile[] } | null;
      }>('/0:search', { q, page_token: token, page_index: idx });
      const hit2 = (page.data?.files ?? []).find((f) => f.name === fileName);
      if (hit2) return hit2;
      token = page.nextPageToken;
      idx = page.curPageIndex + 1;
    }
  }
  return null;
}

/** Mint a fresh signed playable URL for a search-hit id. */
async function mintLink(hitId: string): Promise<{ link: string; mimeType: string; size: string; name: string }> {
  const fb = await postJson<{ link: string; mimeType: string; size: string; name: string }>(
    '/0:fallback',
    { id: hitId },
  );
  if (!fb.link || !fb.link.startsWith('/')) {
    throw new SourceError('UPSTREAM', 'source returned an unexpected link shape');
  }
  return fb;
}

/**
 * Security gate: the adapter may only ever redirect to the configured
 * source origin. This makes open-redirect bugs structurally impossible.
 */
export function toAllowedPlayUrl(link: string): string {
  const url = new URL(link, SOURCE_ORIGIN);
  const allowed = new URL(SOURCE_ORIGIN);
  if (url.origin !== allowed.origin) {
    throw new SourceError('INVALID', 'refusing to redirect outside the source origin');
  }
  return url.toString();
}

function cacheKey(ref: IndexFileRef): string {
  return `index::${ref.fileName}::${ref.sizeBytes}`;
}

export function clearResolveCache(): void {
  resolveCache.clear();
}

/**
 * Resolve one stable file reference to a fresh playable URL.
 * Throws SourceError('NOT_FOUND') when the file is no longer listed.
 */
export async function resolveSourceFile(ref: IndexFileRef): Promise<ResolvedMedia> {
  const key = cacheKey(ref);
  const cached = resolveCache.get(key);
  if (cached && Date.now() - cached.storedAt < RESOLVE_CACHE_TTL_MS) {
    return { ...cached.media, cached: true };
  }
  const t0 = Date.now();
  const queries = ref.searchHint && ref.searchHint !== 'latent' ? [ref.searchHint, 'latent'] : ['latent'];
  const hit = await searchExact(ref.fileName, queries);
  if (!hit) {
    throw new SourceError('NOT_FOUND', `file no longer listed on source: ${ref.fileName}`);
  }
  if (hit.size && Number(hit.size) !== ref.sizeBytes) {
    // Same name but a different byte size = a different upload. Refuse to
    // silently substitute; the catalogue must be re-verified by an operator.
    throw new SourceError(
      'INVALID',
      `size mismatch for ${ref.fileName}: catalogue=${ref.sizeBytes} source=${hit.size}`,
    );
  }
  const minted = await mintLink(hit.id);
  const media: ResolvedMedia = {
    playUrl: toAllowedPlayUrl(minted.link),
    origin: 'index',
    mimeType: minted.mimeType || ref.mimeType,
    sizeBytes: minted.size ? Number(minted.size) : ref.sizeBytes,
    refName: ref.fileName,
    via: 'primary',
    resolvedAt: Date.now(),
    resolveMs: Date.now() - t0,
    cached: false,
  };
  resolveCache.set(key, { media, storedAt: Date.now() });
  return media;
}

/**
 * Verify a playable URL with small requests only (HEAD + 1-byte Range).
 * Used by health checks and tests — never in the playback hot path.
 */
export async function verifyMediaUrl(playUrl: string): Promise<MediaVerification> {
  const t0 = Date.now();
  const absolute = toAllowedPlayUrl(playUrl);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const head = await fetch(absolute, {
      method: 'HEAD',
      headers: { 'User-Agent': 'latent-vault/1.0' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const range = await fetch(absolute, {
      headers: { 'User-Agent': 'latent-vault/1.0', Range: 'bytes=0-0' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    // Drain the 1-byte body so sockets are reused.
    await range.arrayBuffer().catch(() => undefined);
    const contentType = range.headers.get('content-type') ?? head.headers.get('content-type');
    const lenRaw = range.headers.get('content-length') ?? head.headers.get('content-length');
    const contentRange = range.headers.get('content-range');
    const rangeSupported = range.status === 206 && !!contentRange;
    const ok = (head.status === 200 || head.status === 206) && !!contentType?.startsWith('video/');
    return {
      ok,
      status: head.status,
      contentType,
      contentLength: lenRaw ? Number(lenRaw) : null,
      contentRange,
      rangeSupported,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      contentRange: null,
      rangeSupported: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(t);
  }
}
