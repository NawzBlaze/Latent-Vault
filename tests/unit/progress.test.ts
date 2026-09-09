import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearProgress,
  listContinueWatching,
  loadProgress,
  progressKey,
  saveProgress,
} from '@/player/progress';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: memoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('watch progress', () => {
  it('uses stable igl_progress_ keys', () => {
    expect(progressKey('s2e5')).toBe('igl_progress_s2e5');
  });

  it('saves and loads a position', () => {
    saveProgress('s2e5', 120, 1800);
    expect(loadProgress('s2e5')).toMatchObject({ position: 120, duration: 1800, completed: false });
  });

  it('marks near-end positions completed', () => {
    saveProgress('s2e5', 1790, 1800);
    expect(loadProgress('s2e5')).toMatchObject({ completed: true, position: 0 });
  });

  it('clears entries', () => {
    saveProgress('s2e5', 120, 1800);
    clearProgress('s2e5');
    expect(loadProgress('s2e5')).toBeNull();
  });

  it('lists unfinished entries newest-first, skipping stubs', () => {
    let tick = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => tick++);
    saveProgress('s2e3', 5, 1800); // too short: skip
    saveProgress('s2e4', 100, 1800);
    saveProgress('s2e5', 200, 1800);
    saveProgress('s2e6', 1799, 1800); // completed: skip
    const list = listContinueWatching();
    expect(list.map((e) => e.contentId)).toEqual(['s2e5', 's2e4']);
    vi.restoreAllMocks();
  });

  it('survives corrupt storage', () => {
    window.localStorage.setItem('igl_progress_s2e5', '{nope');
    expect(loadProgress('s2e5')).toBeNull();
    expect(listContinueWatching()).toEqual([]);
  });

  it('is a no-op without storage (SSR / private mode)', () => {
    vi.stubGlobal('window', undefined as unknown as Window);
    expect(loadProgress('s2e5')).toBeNull();
    expect(saveProgress('s2e5', 1, 2)).toBeNull();
    expect(listContinueWatching()).toEqual([]);
  });
});
