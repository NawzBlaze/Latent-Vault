import { expect, test } from '@playwright/test';

/**
 * REAL playback verification (no mocks):
 *   browser -> /api/play -> 307 -> source CDN (Range-capable media)
 * Priority: index.csbots.live first, Yuhu only when index lacks the episode.
 */
const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

test.describe('playback authorisation (live sources)', () => {
  test('307s index episodes to index with an empty body', async ({ request }) => {
    const t0 = Date.now();
    const res = await request.get('/api/play/s2b2', { maxRedirects: 0 });
    const authMs = Date.now() - t0;
    expect(res.status()).toBe(307);
    const location = res.headers()['location'] ?? '';
    expect(location).toMatch(/^https:\/\/index\.csbots\.live\/download\.aspx\?/);
    const body = await res.body();
    expect(body.length).toBe(0); // Vercel ships bytes: zero. Media bypasses us.
    expect(res.headers()['cache-control']).toBe('no-store');
    expect(res.headers()['x-source-origin']).toBe('index');
    expect(res.headers()['x-resolve-via']).toBe('primary');
    console.log(`index auth+redirect latency: ${authMs}ms`);
  });

  test('307s the yuhu-fallback episode (E6) to the verified CDN', async ({ request }) => {
    const t0 = Date.now();
    const res = await request.get('/api/play/s2e6', { maxRedirects: 0 });
    const authMs = Date.now() - t0;
    expect(res.status()).toBe(307);
    const location = res.headers()['location'] ?? '';
    expect(location).toMatch(/^https:\/\/[^/]*\.okcdn\.ru\//);
    const body = await res.body();
    expect(body.length).toBe(0);
    expect(res.headers()['cache-control']).toBe('no-store');
    expect(res.headers()['x-source-origin']).toBe('yuhu');
    console.log(`yuhu auth+redirect latency: ${authMs}ms`);
  });

  test('unknown / unavailable / invalid ids never redirect', async ({ request }) => {
    expect((await request.get('/api/play/s9e9', { maxRedirects: 0 })).status()).toBe(404);
    const unav = await request.get('/api/play/s2e1', { maxRedirects: 0 });
    expect(unav.status()).toBe(404);
    expect(((await unav.json()) as { error: string }).error).toBe('unavailable');
    expect((await request.get('/api/play/!!!', { maxRedirects: 0 })).status()).toBe(400);
  });

  test('the index 307 target serves Range-capable video directly', async ({ request }) => {
    const auth = await request.get('/api/play/s2b2', { maxRedirects: 0 });
    const location = auth.headers()['location']!;
    const head = await request.head(location);
    expect(head.status()).toBe(200);
    expect(head.headers()['content-type']).toBe('video/mp4');
    expect(Number(head.headers()['content-length'])).toBe(607821456);

    for (const range of ['bytes=0-1023', 'bytes=5000000-5001023', 'bytes=600000000-600001023']) {
      const r = await request.get(location, { headers: { Range: range } });
      expect(r.status(), range).toBe(206);
      expect(r.headers()['content-range'], range).toMatch(/^bytes \d+-\d+\/607821456$/);
    }
  });

  test('the yuhu 307 target serves Range-capable video directly', async ({ request }) => {
    const auth = await request.get('/api/play/s2e6', { maxRedirects: 0 });
    const location = auth.headers()['location']!;
    const head = await request.head(location, { headers: { 'User-Agent': CHROME_UA } });
    expect(head.status()).toBe(200);
    expect(head.headers()['content-type']).toBe('video/mp4');
    expect(head.headers()['accept-ranges']).toBe('bytes');
    const total = Number(head.headers()['content-length']);
    expect(total).toBeGreaterThan(100_000_000);

    for (const range of ['bytes=0-1023', `bytes=${total - 1024}-${total - 1}`]) {
      const r = await request.get(location, { headers: { Range: range, 'User-Agent': CHROME_UA } });
      expect(r.status(), range).toBe(206);
      expect(r.headers()['content-range'], range).toContain(`/${total}`);
    }
  });
});
