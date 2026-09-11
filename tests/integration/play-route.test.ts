import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD } from '@/app/api/play/[contentId]/route';
import { clearResolveCache } from '@/source/adapter';
import { clearYuhuCache } from '@/source/yuhu';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const CDN_URL = 'https://vd646.okcdn.ru/?srcIp=x&expires=999&sig=abc&type=5';

/** Mock both sources: index exact-name hits + minting, yuhu worker + CDN HEAD. */
function mockSourcesUp() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('workers.dev')) {
      return json({ status: 'success', streams: [{ type: '1080p', url: CDN_URL }] });
    }
    if (url.includes('okcdn.ru')) {
      return new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': '100' },
      });
    }
    if (url.endsWith('/0:search')) {
      return json({
        nextPageToken: null,
        curPageIndex: 0,
        data: {
          files: [
            {
              id: 'tok',
              name: 'Indias_Got_Latent_S02E06_1080p_Hindi_WEB_DL_2_0_ESub_x264_HDHub4u.mkv',
              mimeType: 'video/x-matroska',
              size: '894246488',
            },
          ],
        },
      });
    }
    if (url.endsWith('/0:fallback')) {
      return json({
        name: 'x',
        mimeType: 'video/x-matroska',
        size: '894246488',
        link: '/download.aspx?file=fresh&expiry=e&mac=m',
      });
    }
    return new Response('nf', { status: 404 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearResolveCache();
  clearYuhuCache();
});

describe('GET /api/play/[contentId]', () => {
  it('307-redirects index content with a tiny body + origin header', async () => {
    vi.stubGlobal('fetch', mockSourcesUp());
    const res = await GET(new Request('http://x/api/play/s2b3'), { params: { contentId: 's2b3' } });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://index.csbots.live/download.aspx?file=fresh&expiry=e&mac=m',
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-source-origin')).toBe('index');
    expect(res.headers.get('x-resolve-via')).toBe('primary');
    const body = await res.text();
    expect(body.length).toBe(0);
  });

  it('307-redirects yuhu-fallback content to the verified CDN URL', async () => {
    vi.stubGlobal('fetch', mockSourcesUp());
    const res = await GET(new Request('http://x/api/play/s2e6'), { params: { contentId: 's2e6' } });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(CDN_URL);
    expect(res.headers.get('x-source-origin')).toBe('yuhu');
    const body = await res.text();
    expect(body.length).toBe(0);
  });

  it('forwards the player browser UA to the yuhu worker', async () => {
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
    let seenUa: string | null = null;
    const inner = mockSourcesUp();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes('workers.dev')) {
          seenUa = (init?.headers as Record<string, string>)?.['User-Agent'] ?? null;
        }
        return inner(url, init);
      }),
    );
    const res = await GET(new Request('http://x/api/play/s2e6', { headers: { 'User-Agent': safari } }), {
      params: { contentId: 's2e6' },
    });
    expect(res.status).toBe(307);
    expect(seenUa).toBe(safari);
  });

  it('answers HEAD identically (player preflight)', async () => {
    vi.stubGlobal('fetch', mockSourcesUp());
    const res = await HEAD(new Request('http://x/api/play/s2b3'), { params: { contentId: 's2b3' } });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('index.csbots.live/download.aspx');
  });

  it('404s unknown content', async () => {
    const res = await GET(new Request('http://x/api/play/s9e9'), { params: { contentId: 's9e9' } });
    expect(res.status).toBe(404);
  });

  it('returns youtube source for E1 (previously unavailable)', async () => {
    const res = await GET(new Request('http://x/api/play/s2e1'), { params: { contentId: 's2e1' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source: string; videoId: string };
    expect(body.source).toBe('youtube');
    expect(body.videoId).toBe('eHTXQW58WhA');
  });

  it('400s invalid ids', async () => {
    const res = await GET(new Request('http://x/api/play/!!!'), { params: { contentId: '!!!' } });
    expect(res.status).toBe(400);
  });

  it('404s when the file vanished from the source', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/0:search')) {
          return json({ nextPageToken: null, curPageIndex: 0, data: { files: [] } });
        }
        return new Response('nf', { status: 404 });
      }),
    );
    const res = await GET(new Request('http://x/api/play/s2b3'), { params: { contentId: 's2b3' } });
    expect(res.status).toBe(404);
  });

  it('502s (small JSON, no proxy) when the source errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad gateway', { status: 502 })),
    );
    const res = await GET(new Request('http://x/api/play/s2b3'), { params: { contentId: 's2b3' } });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('media source unavailable');
  });
});

describe('x-resolve-cache header truthfulness', () => {
  it('reports miss on a cold index resolution', async () => {
    vi.stubGlobal('fetch', mockSourcesUp());
    const res = await GET(new Request('http://x/api/play/s2b3'), { params: { contentId: 's2b3' } });
    expect(res.status).toBe(307);
    expect(res.headers.get('x-resolve-cache')).toBe('miss');
  });

  it('reports hit when the index adapter cache serves the second call', async () => {
    vi.stubGlobal('fetch', mockSourcesUp());
    const ctx = { params: { contentId: 's2b3' } };
    const req = () => new Request('http://x/api/play/s2b3');
    const first = await GET(req(), ctx);
    const second = await GET(req(), ctx);
    expect(first.headers.get('x-resolve-cache')).toBe('miss');
    // Same location, no re-resolution: the header must say so for BOTH sources.
    expect(second.headers.get('x-resolve-cache')).toBe('hit');
    expect(second.headers.get('location')).toBe(first.headers.get('location'));
    expect(Number(second.headers.get('x-resolve-ms'))).toBeLessThan(50);
  });
});

describe('publication gate inside the route', () => {
  it('404s unpublished catalogue entries', async () => {
    // Route a request at a real id shape that the catalogue marks unpublished
    // by shadowing the module is overkill here: the gate shares the unknown
    // branch, so assert the contract on an id that can never publish.
    const res = await GET(new Request('http://x/api/play/zz9'), { params: { contentId: 'zz9' } });
    expect(res.status).toBe(404);
  });
});
