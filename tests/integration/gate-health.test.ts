import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/catalog/catalogue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/catalog/catalogue')>();
  const draft = { ...mod.getById('s2e6')!, published: false };
  return {
    ...mod,
    getById: (id: string) => (id === 's2e6' ? draft : mod.getById(id)),
  };
});

import { GET as playGet } from '@/app/api/play/[contentId]/route';
import { GET as healthGet } from '@/app/api/health/route';
import { __resetHealthCacheForTests } from '@/lib/health-cache';

afterEach(() => {
  vi.unstubAllGlobals();
  __resetHealthCacheForTests();
});

describe('publication gate (unpublished entry)', () => {
  it('404s even though the id exists', async () => {
    const res = await playGet(new Request('http://x/api/play/s2e6'), { params: { contentId: 's2e6' } });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/health', () => {
  it('reports counts without secrets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('workers.dev')) return new Response('f', { status: 403 });
        return new Response(JSON.stringify({ nextPageToken: null, data: { files: [] } }), { status: 200 });
      }),
    );
    const res = await healthGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    const catalogue = body.catalogue as Record<string, unknown>;
    expect(catalogue.published).toBe(9);
    expect(catalogue.seasons).toEqual([2]);
    expect(catalogue.episodes).toBe(6);
    expect(catalogue.bonus).toBe(3);
    expect(catalogue.available).toBe(9);
    expect(catalogue.unavailable).toBe(0);
    const sources = body.sources as Record<string, { reachable: boolean }>;
    expect(sources.index.reachable).toBe(true);
    expect(sources.yuhu.reachable).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/download\.aspx|expiry|mac=|okcdn\.ru\/\?/);
  });

  it('marks sources unreachable instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    const res = await healthGet();
    const body = (await res.json()) as { sources: { index: { reachable: boolean }; yuhu: { reachable: boolean } } };
    expect(body.sources.index.reachable).toBe(false);
    expect(body.sources.yuhu.reachable).toBe(false);
  });
});
