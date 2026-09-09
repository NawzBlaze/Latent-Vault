import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearResolveCache } from '@/source/adapter';
import { clearYuhuCache } from '@/source/yuhu';
import { resolvePlayable } from '@/source/resolve';
import type { MediaVariant } from '@/catalog/types';

const INDEX_REF: MediaVariant = {
  origin: 'index',
  fileName: 'Indias_Got_Latent_S02E06_1080p_Hindi_WEB_DL_2_0_ESub_x264_HDHub4u.mkv',
  sizeBytes: 894246488,
  mimeType: 'video/x-matroska',
  searchHint: 'latent s02',
};

const YUHU_REF: MediaVariant = {
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

/** Mock both sources. Toggle each side up/down. */
function mockBoth(opts: { indexUp?: boolean; yuhuUp?: boolean } = {}) {
  const indexUp = opts.indexUp ?? true;
  const yuhuUp = opts.yuhuUp ?? true;
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('workers.dev')) {
      if (!yuhuUp) return new Response('err', { status: 500 });
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
          files: indexUp
            ? [{ id: 'tok', name: INDEX_REF.origin === 'index' ? INDEX_REF.fileName : '', size: '894246488' }]
            : [],
        },
      });
    }
    if (url.endsWith('/0:fallback')) {
      return json({ name: 'x', mimeType: 'video/x-matroska', size: '894246488', link: '/download.aspx?f=1' });
    }
    return new Response('nf', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearResolveCache();
  clearYuhuCache();
});

describe('priority resolver', () => {
  it('PRIMARY AVAILABLE → primary (index) chosen', async () => {
    mockBoth({ indexUp: true, yuhuUp: true });
    const media = await resolvePlayable([INDEX_REF, YUHU_REF]);
    expect(media.origin).toBe('index');
    expect(media.via).toBe('primary');
    expect(media.playUrl).toContain('index.csbots.live/download.aspx');
  });

  it('PRIMARY UNAVAILABLE + SECONDARY AVAILABLE → secondary chosen', async () => {
    const { calls } = mockBoth({ indexUp: false, yuhuUp: true });
    const media = await resolvePlayable([INDEX_REF, YUHU_REF]);
    expect(media.origin).toBe('yuhu');
    expect(media.via).toBe('alternate:0');
    expect(media.playUrl).toBe(CDN_URL);
    // Index was genuinely attempted first.
    expect(calls.some((c) => c.includes('/0:search'))).toBe(true);
  });

  it('PRIMARY UNAVAILABLE + SECONDARY UNAVAILABLE → primary error surfaces', async () => {
    mockBoth({ indexUp: false, yuhuUp: false });
    await expect(resolvePlayable([INDEX_REF, YUHU_REF])).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resolves yuhu-only items (no usable index media)', async () => {
    const { calls } = mockBoth({ indexUp: true, yuhuUp: true });
    const media = await resolvePlayable([YUHU_REF]);
    expect(media.origin).toBe('yuhu');
    expect(media.via).toBe('primary');
    // Index never consulted when the item carries no index ref.
    expect(calls.some((c) => c.includes('/0:search'))).toBe(false);
  });

  it('never silently selects the wrong ref (empty refs fail)', async () => {
    await expect(resolvePlayable([])).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
