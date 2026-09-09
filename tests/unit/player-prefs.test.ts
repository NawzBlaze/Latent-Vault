import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPrefs, writePrefs } from '@/player/LatentPlayer';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
});

describe('player preference persistence', () => {
  it('round-trips volume and speed', () => {
    writePrefs({ volume: 0.4, rate: 1.5 });
    expect(readPrefs()).toEqual({ volume: 0.4, rate: 1.5 });
  });

  it('clamps nonsense saved values instead of applying them', () => {
    store.set('lv.player.prefs', JSON.stringify({ volume: 9, rate: 99 }));
    expect(readPrefs()).toEqual({ volume: 1, rate: 1 });
  });

  it('tolerates corrupt storage', () => {
    store.set('lv.player.prefs', '{not json');
    expect(() => readPrefs()).not.toThrow();
    expect(readPrefs()).toBeNull();
  });

  it('is inert without a window (SSR)', () => {
    delete (globalThis as any).window;
    expect(() => writePrefs({ volume: 1, rate: 1 })).not.toThrow();
    expect(readPrefs()).toBeNull();
    vi.clearAllMocks();
  });
});
