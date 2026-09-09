/**
 * Coverage for the expiry-aware Yuhu resolution cache and the playback
 * authorisation headers that expose it.
 *
 * Everything here is offline: the worker and the CDN are mocked, and the clock
 * is controlled, so cache expiry/refresh are exercised deterministically
 * instead of being inferred from wall-clock sleeps.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/play/[contentId]/route';
import {
  cacheLifetimeMs,
  clearYuhuCache,
  readUrlExpiryMs,
  resolveYuhuFile,
} from '@/source/yuhu';
import type { YuhuFileRef } from '@/source/types';

const REF: YuhuFileRef = {
  origin: 'yuhu',
  dataId: 's2-06-rakhi',
  videoId: '6a9d7adc5882d566ebfc00e6',
  quality: '1080p',
  mimeType: 'video/mp4',
};

const HOUR = 3600_000;

/** A signed URL whose `expires` sits `hours` from `base` (epoch ms, like okcdn). */
function cdnUrl(hoursFromNow: number, base = Date.now(), tag = 'a'): string {
  const exp = base + hoursFromNow * HOUR;
  return `https://vd646.okcdn.ru/?tag=${tag}&expires=${exp}&sig=${tag}&type=5`;
}

/** Mock worker + CDN HEAD; each worker call hands back a distinct URL. */
function mockYuhu(urlFor: (n: number) => string) {
  let mints = 0;
  let heads = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('workers.dev')) {
      mints++;
      const u = urlFor(mints);
      return new Response(JSON.stringify({ status: 'success', streams: [{ type: '1080p', url: u }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    heads++;
    return new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': '784971242', 'Accept-Ranges': 'bytes' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, stats: () => ({ mints, heads }) };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearYuhuCache();
});

describe('readUrlExpiryMs', () => {
  it('reads epoch milliseconds (the real okcdn form)', () => {
    expect(readUrlExpiryMs('https://vd646.okcdn.ru/?expires=1789423829788&sig=x')).toBe(1789423829788);
  });

  it('reads epoch seconds too', () => {
    expect(readUrlExpiryMs('https://vd646.okcdn.ru/?expires=1789423829')).toBe(1789423829000);
  });

  it('returns null when there is no usable expiry', () => {
    expect(readUrlExpiryMs('https://vd646.okcdn.ru/?sig=x')).toBeNull();
    expect(readUrlExpiryMs('https://vd646.okcdn.ru/?expires=abc')).toBeNull();
    expect(readUrlExpiryMs('https://vd646.okcdn.ru/?expires=0')).toBeNull();
    expect(readUrlExpiryMs('not a url')).toBeNull();
  });
});

describe('cacheLifetimeMs', () => {
  it('caps a long-lived URL at the 6h maximum', () => {
    const now = Date.now();
    // Real CDN hands out ~127.5h; we must never cache anywhere near that long.
    expect(cacheLifetimeMs(cdnUrl(127.5, now), now)).toBe(6 * HOUR);
  });

  it('shortens to the safety margin when the URL dies sooner', () => {
    const now = Date.now();
    expect(cacheLifetimeMs(cdnUrl(26, now), now)).toBe(2 * HOUR); // 26h - 24h margin
  });

  it('refuses to cache a URL already inside the safety margin', () => {
    const now = Date.now();
    expect(cacheLifetimeMs(cdnUrl(12, now), now)).toBe(0);
  });

  it('falls back to the short TTL when expiry is unknown or already past', () => {
    const now = Date.now();
    expect(cacheLifetimeMs('https://vd646.okcdn.ru/?sig=x', now)).toBe(10 * 60_000);
    expect(cacheLifetimeMs(cdnUrl(-1, now), now)).toBe(10 * 60_000);
  });
});

describe('yuhu resolution cache', () => {
  it('serves a cache HIT with zero upstream calls and flags it', async () => {
    const { stats } = mockYuhu(() => cdnUrl(127.5));
    const first = await resolveYuhuFile(REF, 'UA-A');
    const second = await resolveYuhuFile(REF, 'UA-A');
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.playUrl).toBe(first.playUrl);
    expect(stats()).toEqual({ mints: 1, heads: 1 }); // nothing extra on the hit
  });

  it('re-resolves and refreshes once the entry passes its safe-by date', async () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-09-09T12:00:00.000Z').getTime();
    vi.setSystemTime(t0);
    // URL lives 127.5h, so the entry is safe for min(6h, 127.5h-24h) = 6h.
    const { stats } = mockYuhu((n) => cdnUrl(127.5, t0, `u${n}`));

    const first = await resolveYuhuFile(REF, 'UA-A');
    expect(first.cached).toBe(false);
    expect(first.playUrl).toContain('tag=u1');

    // Still inside the 6h window -> hit, same URL.
    vi.setSystemTime(t0 + 5 * HOUR);
    const warm = await resolveYuhuFile(REF, 'UA-A');
    expect(warm.cached).toBe(true);
    expect(warm.playUrl).toContain('tag=u1');
    expect(stats()).toEqual({ mints: 1, heads: 1 });

    // Past the window -> a fresh URL must be minted, not the stale one.
    vi.setSystemTime(t0 + 6 * HOUR + 1000);
    const refreshed = await resolveYuhuFile(REF, 'UA-A');
    expect(refreshed.cached).toBe(false);
    expect(refreshed.playUrl).toContain('tag=u2');
    expect(stats()).toEqual({ mints: 2, heads: 2 });
  });

  it('never caches a URL inside its safety margin (always re-mints)', async () => {
    const { stats } = mockYuhu((n) => cdnUrl(2, Date.now(), `s${n}`)); // 2h life < 24h margin
    const a = await resolveYuhuFile(REF, 'UA-A');
    const b = await resolveYuhuFile(REF, 'UA-A');
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(false);
    expect(stats().mints).toBe(2); // deliberately no reuse of a near-expiry URL
  });

  it('keeps a separate entry per caller UA (signatures bind to it)', async () => {
    const { stats } = mockYuhu(() => cdnUrl(127.5));
    const a = await resolveYuhuFile(REF, 'UA-A');
    const b = await resolveYuhuFile(REF, 'UA-B');
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(false);
    expect(stats().mints).toBe(2);
  });

  it('evicts an expired entry instead of returning it', async () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-09-09T12:00:00.000Z').getTime();
    vi.setSystemTime(t0);
    // Unknown-expiry URL -> conservative 10 min TTL path.
    const { stats } = mockYuhu(() => 'https://vd646.okcdn.ru/?sig=x');
    await resolveYuhuFile(REF, 'UA-A');
    vi.setSystemTime(t0 + 11 * 60_000);
    const after = await resolveYuhuFile(REF, 'UA-A');
    expect(after.cached).toBe(false);
    expect(stats().mints).toBe(2);
  });
});

describe('/api/play authorisation headers', () => {
  /** Route-level mock: index 404s so s2e6 resolves via its yuhu primary. */
  function mockRoute(expiryUrl: string) {
    let mints = 0;
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('workers.dev')) {
        mints++;
        return new Response(JSON.stringify({ status: 'success', streams: [{ type: '1080p', url: expiryUrl }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('okcdn.ru')) {
        return new Response(null, {
          status: 200,
          headers: { 'Content-Type': 'video/mp4', 'Content-Length': '784971242' },
        });
      }
      return new Response('nf', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, mints: () => mints };
  }

  it('reports miss then hit, and measures the current request not the mint', async () => {
    const m = mockRoute(cdnUrl(127.5));
    const req = () =>
      new Request('http://x/api/play/s2e6', { headers: { 'User-Agent': 'UA-HDR' } });
    const ctx = { params: { contentId: 's2e6' } };

    const first = await GET(req(), ctx);
    expect(first.status).toBe(307);
    expect(first.headers.get('x-resolve-cache')).toBe('miss');
    expect(first.headers.get('x-source-origin')).toBe('yuhu');

    const second = await GET(req(), ctx);
    expect(second.status).toBe(307);
    expect(second.headers.get('x-resolve-cache')).toBe('hit');
    expect(second.headers.get('location')).toBe(first.headers.get('location'));
    expect(m.mints()).toBe(1);

    // The whole point of the fix: a hit must not advertise the cold cost.
    const hitMs = Number(second.headers.get('x-resolve-ms'));
    expect(Number.isFinite(hitMs)).toBe(true);
    expect(hitMs).toBeLessThan(1000);
  });

  it('never proxies media bytes: 307, empty body, no content-range', async () => {
    mockRoute(cdnUrl(127.5));
    const res = await GET(
      new Request('http://x/api/play/s2e6', { headers: { 'User-Agent': 'UA-BODY', Range: 'bytes=0-1048575' } }),
      { params: { contentId: 's2e6' } },
    );
    expect(res.status).toBe(307); // a redirect, never 200/206
    expect(res.headers.get('location')).toContain('okcdn.ru');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-range')).toBeNull();
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(0); // zero bytes of video through Vercel
  });

  it('leaves the publication gate untouched: unavailable stays 404', async () => {
    mockRoute(cdnUrl(127.5));
    const un = await GET(new Request('http://x/api/play/s2e1'), { params: { contentId: 's2e1' } });
    expect(un.status).toBe(404);
    expect(((await un.json()) as { error: string }).error).toBe('unavailable');
    const unknown = await GET(new Request('http://x/api/play/zz9'), { params: { contentId: 'zz9' } });
    expect(unknown.status).toBe(404);
  });
});
