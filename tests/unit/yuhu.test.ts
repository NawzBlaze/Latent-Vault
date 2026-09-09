import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearYuhuCache, pickStream, resolveYuhuFile, toAllowedYuhuUrl } from '@/source/yuhu';
import { SourceError, type YuhuFileRef } from '@/source/types';

const REF: YuhuFileRef = {
  origin: 'yuhu',
  dataId: 's2-06-rakhi',
  videoId: '6a9d7adc5882d566ebfc00e6',
  quality: '1080p',
  mimeType: 'video/mp4',
};

const CDN_URL = 'https://vd646.okcdn.ru/?srcIp=x&expires=999&sig=abc&type=5';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Mock the worker + CDN HEAD verification. */
function mockYuhu(opts: {
  streams?: { type: string; url: string }[];
  workerStatus?: number;
  headStatus?: number;
  headContentType?: string;
  onFetch?: (url: string, init?: RequestInit) => void;
} = {}) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    opts.onFetch?.(url, init);
    if (url.includes('workers.dev')) {
      if ((opts.workerStatus ?? 200) !== 200) return new Response('forbidden', { status: opts.workerStatus });
      return json({
        status: 'success',
        streams: opts.streams ?? [
          { type: '480p', url: 'https://vd1.okcdn.ru/?a=1' },
          { type: '1080p', url: CDN_URL },
        ],
      });
    }
    // CDN HEAD verification.
    return new Response(null, {
      status: opts.headStatus ?? 200,
      headers: {
        'Content-Type': opts.headContentType ?? 'video/mp4',
        'Content-Length': '784971242',
        'Accept-Ranges': 'bytes',
      },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearYuhuCache();
});

describe('yuhu client', () => {
  it('resolves the exact verified quality to a verified CDN URL', async () => {
    const { fetchMock } = mockYuhu();
    const media = await resolveYuhuFile(REF);
    expect(media.origin).toBe('yuhu');
    expect(media.playUrl).toBe(CDN_URL);
    expect(media.mimeType).toBe('video/mp4');
    expect(media.sizeBytes).toBe(784971242);
    expect(media.refName).toBe('s2-06-rakhi');
    expect(media.resolveMs).toBeGreaterThanOrEqual(0);
    // Worker call carries the Yuhu referer the worker requires.
    const workerCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('workers.dev'));
    expect((workerCall?.[1]?.headers as Record<string, string>)?.Referer).toContain('yuhu.freeforall.dev');
  });

  it('re-resolves ONCE when the CDN reports a stale signature, then succeeds', async () => {
    let heads = 0;
    mockYuhu({
      onFetch: (url, init) => {
        if (!url.includes('workers.dev') && init?.method === 'HEAD') heads++;
      },
      headStatus: 200,
    });
    // First HEAD 400s (stale), second succeeds: simulate via call count.
    const origFetch = globalThis.fetch;
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!String(url).includes('workers.dev')) {
          n++;
          if (n === 1) return new Response('x', { status: 400 });
        }
        return (origFetch as typeof fetch)(url, init);
      }),
    );
    const media = await resolveYuhuFile(REF);
    expect(media.playUrl).toBe(CDN_URL);
    expect(heads).toBe(1); // one verifying HEAD reached the mock CDN
  });

  it('fails honestly when the worker drops the verified quality (no silent downgrade)', async () => {
    mockYuhu({ streams: [{ type: '480p', url: 'https://vd1.okcdn.ru/?a=1' }] });
    await expect(resolveYuhuFile(REF)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('fails on worker refusal without retrying forever', async () => {
    const { fetchMock } = mockYuhu({ workerStatus: 403 });
    await expect(resolveYuhuFile(REF)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails when the CDN serves a non-video content type', async () => {
    mockYuhu({ headContentType: 'text/html' });
    await expect(resolveYuhuFile(REF)).rejects.toThrow(SourceError);
  });

  it('caches worker responses briefly', async () => {
    const { fetchMock } = mockYuhu();
    await resolveYuhuFile(REF);
    await resolveYuhuFile(REF);
    // 1 worker call + 1 HEAD for the first resolution; zero for the second.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forwards the caller UA exactly (CDN signatures bind to it)', async () => {
    const { fetchMock } = mockYuhu();
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
    await resolveYuhuFile(REF, safari);
    for (const call of fetchMock.mock.calls) {
      expect((call[1]?.headers as Record<string, string>)?.['User-Agent']).toBe(safari);
    }
    // A different caller UA resolves separately (never serves another UA's URL).
    await resolveYuhuFile(REF, 'Mozilla/5.0 Firefox/128.0');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('falls back to a browser UA when the caller sends none', async () => {
    const { fetchMock } = mockYuhu();
    await resolveYuhuFile(REF, null);
    const uas = fetchMock.mock.calls.map((c) => (c[1]?.headers as Record<string, string>)?.['User-Agent']);
    expect(uas.length).toBeGreaterThan(0);
    for (const ua of uas) expect(ua).toMatch(/Chrome\//);
  });

  it('picks exact quality matches only', () => {
    const streams = [
      { type: '480p', url: 'https://vd1.okcdn.ru/?a=1' },
      { type: '1080p', url: CDN_URL },
    ];
    expect(pickStream(streams, '1080p')).toBe(CDN_URL);
    expect(() => pickStream(streams, '720p')).toThrow(SourceError);
    expect(() => pickStream([], '1080p')).toThrow(SourceError);
  });

  it('never redirects outside the known Yuhu CDN hosts', () => {
    expect(() => toAllowedYuhuUrl('https://evil.example/x')).toThrow(SourceError);
    expect(() => toAllowedYuhuUrl('https://okcdn.ru.evil.example/x')).toThrow(SourceError);
    expect(() => toAllowedYuhuUrl('http://vd1.okcdn.ru/x')).toThrow(SourceError);
    expect(toAllowedYuhuUrl('https://vd1.okcdn.ru/?a=1')).toBe('https://vd1.okcdn.ru/?a=1');
    expect(toAllowedYuhuUrl('https://x.mycdn.me/v')).toBe('https://x.mycdn.me/v');
  });
});
