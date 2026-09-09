import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetPrefetch, cancelPrefetch, prefetchPlayback } from '@/lib/prefetch';

const fetchMock = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
  Promise.resolve(new Response(null, { status: 307 })),
);

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockClear();
  __resetPrefetch();
  (globalThis as any).window = {};
  (globalThis as any).fetch = fetchMock;
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).window;
  delete (globalThis as any).fetch;
});

describe('intent-based playback prefetch', () => {
  it('warms authorization once per id after the dwell', () => {
    prefetchPlayback('s2e3');
    prefetchPlayback('s2e3');
    prefetchPlayback('s2e3');
    expect(fetchMock).not.toHaveBeenCalled(); // nothing before the dwell
    vi.advanceTimersByTime(150);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/play/s2e3');
  });

  it('never follows the redirect (it only needs the cache warm)', () => {
    prefetchPlayback('s2e4');
    vi.advanceTimersByTime(150);
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe('HEAD');
    expect(init.redirect).toBe('manual');
  });

  it('a hover that ends before the dwell requests nothing', () => {
    prefetchPlayback('s2e5');
    cancelPrefetch('s2e5');
    vi.advanceTimersByTime(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is capped so a scroll over the grid cannot stampede the source', () => {
    for (let i = 0; i < 12; i++) prefetchPlayback(`id-${i}`);
    vi.advanceTimersByTime(500);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('is a no-op during SSR', () => {
    delete (globalThis as any).window;
    prefetchPlayback('s2e6');
    vi.advanceTimersByTime(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
