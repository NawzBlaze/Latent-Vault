import { describe, expect, it } from 'vitest';
import { PlaybackMetrics } from '@/player/metrics';
import { formatBytes, formatClock, formatRuntime, seasonEpisodeLabel } from '@/lib/format';

describe('playback metrics', () => {
  it('records marks, seeks, rebuffers, and errors', () => {
    const m = new PlaybackMetrics('s2e5');
    m.markAuthDone();
    m.markMetadata();
    m.markFirstFrame();
    m.seekStart(10);
    m.seekEnd(20);
    m.rebuffer();
    m.error('boom');
    const r = m.report();
    expect(r.contentId).toBe('s2e5');
    expect(r.authMs).not.toBeNull();
    expect(r.metadataMs).not.toBeNull();
    expect(r.firstFrameMs).not.toBeNull();
    expect(r.seeks).toEqual([{ from: 10, to: 20, latencyMs: expect.any(Number) }]);
    expect(r.rebuffers).toBe(1);
    expect(r.errors).toEqual(['boom']);
    expect(r.completed).toBe(false);
  });

  it('keeps first marks (no overwrite)', () => {
    const m = new PlaybackMetrics('s2e5');
    m.markAuthDone();
    const a = m.report().authMs;
    m.markAuthDone();
    expect(m.report().authMs).toBe(a);
  });
});

describe('formatting', () => {
  it('formats clocks', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3661)).toBe('1:01:01');
    expect(formatClock(null)).toBe('—');
    expect(formatClock(NaN)).toBe('—');
  });

  it('formats runtimes', () => {
    expect(formatRuntime(2400)).toBe('40 min');
    expect(formatRuntime(3639)).toBe('1 hr 1 min');
    expect(formatRuntime(3600)).toBe('1 hr');
    expect(formatRuntime(null)).toBe('Unknown runtime');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2553562896)).toBe('2.4 GB');
  });

  it('labels season/episode badges', () => {
    expect(seasonEpisodeLabel(2, 5, 'episode')).toBe('S2 · E5');
    expect(seasonEpisodeLabel(2, 1, 'bonus')).toBe('S2 · Bonus E1');
  });
});
