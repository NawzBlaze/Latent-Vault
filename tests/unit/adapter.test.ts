import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearResolveCache, resolveSourceFile, toAllowedPlayUrl } from '@/source/adapter';
import { SourceError, type IndexFileRef } from '@/source/types';

const REF: IndexFileRef = {
  origin: 'index',
  fileName: 'Indias_Got_Latent_S02E06_1080p_Hindi_WEB_DL_2_0_ESub_x264_HDHub4u.mkv',
  sizeBytes: 894246488,
  mimeType: 'video/x-matroska',
  searchHint: 'latent s02',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockSource(opts: {
  searchFiles?: unknown[];
  fallbackLink?: string;
  fallbackSize?: string;
  searchStatus?: number;
  fallbackStatus?: number;
} = {}) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method} ${url}`);
    if (url.endsWith('/0:search')) {
      if ((opts.searchStatus ?? 200) !== 200) return new Response('err', { status: opts.searchStatus });
      return jsonResponse({
        nextPageToken: null,
        curPageIndex: 0,
        data: { files: opts.searchFiles ?? [] },
      });
    }
    if (url.endsWith('/0:fallback')) {
      if ((opts.fallbackStatus ?? 200) !== 200) return new Response('err', { status: opts.fallbackStatus });
      return jsonResponse({
        name: REF.fileName,
        mimeType: 'video/x-matroska',
        size: opts.fallbackSize ?? String(REF.sizeBytes),
        link: opts.fallbackLink ?? '/download.aspx?file=abc&expiry=def&mac=123',
      });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearResolveCache();
});

describe('index source client', () => {
  it('resolves an exact file-name match to a playable URL', async () => {
    mockSource({
      searchFiles: [{ id: 'rotating-token', name: REF.fileName, mimeType: REF.mimeType, size: String(REF.sizeBytes) }],
    });
    const media = await resolveSourceFile(REF);
    expect(media.origin).toBe('index');
    expect(media.playUrl).toBe('https://index.csbots.live/download.aspx?file=abc&expiry=def&mac=123');
    expect(media.mimeType).toBe('video/x-matroska');
    expect(media.sizeBytes).toBe(REF.sizeBytes);
    expect(media.refName).toBe(REF.fileName);
    expect(media.resolveMs).toBeGreaterThanOrEqual(0);
  });

  it('throws NOT_FOUND when the file is no longer listed', async () => {
    mockSource({ searchFiles: [{ id: 'x', name: 'something else.mkv', size: '10' }] });
    await expect(resolveSourceFile(REF)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a same-name file with a different byte size (no silent swap)', async () => {
    mockSource({
      searchFiles: [{ id: 'x', name: REF.fileName, mimeType: REF.mimeType, size: '12345' }],
    });
    await expect(resolveSourceFile(REF)).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('caches fresh links briefly (no re-search within TTL)', async () => {
    const { fetchMock } = mockSource({
      searchFiles: [{ id: 't', name: REF.fileName, mimeType: REF.mimeType, size: String(REF.sizeBytes) }],
    });
    await resolveSourceFile(REF);
    await resolveSourceFile(REF);
    // 1 search + 1 fallback for the first call; zero fetches for the second.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never redirects outside the source origin', () => {
    expect(() => toAllowedPlayUrl('https://evil.example/x')).toThrow(SourceError);
    expect(() => toAllowedPlayUrl('https://index.csbots.live.evil.example/x')).toThrow(SourceError);
    expect(toAllowedPlayUrl('/download.aspx?file=a')).toBe('https://index.csbots.live/download.aspx?file=a');
  });

  it('maps upstream failures to UPSTREAM errors', async () => {
    mockSource({ searchStatus: 500 });
    await expect(resolveSourceFile(REF)).rejects.toMatchObject({ code: 'UPSTREAM' });
  });
});
