/**
 * Honest playback instrumentation. Measures what the app can actually know:
 * authorisation latency (preflight), metadata delay, time-to-first-frame,
 * seek latencies and rebuffer counts. No guessing, no fake precision.
 */

export interface SeekSample {
  from: number;
  to: number;
  latencyMs: number;
}

export interface NetworkBreakdown {
  /** mount -> authorization endpoint answered (307 issued). */
  authMs: number | null;
  /** authorization redirect follow (307 -> source). */
  redirectMs: number | null;
  /** source time to first byte, after the redirect completed. */
  sourceTtfbMs: number | null;
  /** source request total (startTime -> responseEnd). */
  sourceTotalMs: number | null;
  /** Host the media actually came from (proves no proxy). */
  mediaHost: string | null;
  /** HTTP status observed for the media request, when the browser reports it. */
  mediaStatus: number | null;
}

const EMPTY_NET: NetworkBreakdown = {
  authMs: null,
  redirectMs: null,
  sourceTtfbMs: null,
  sourceTotalMs: null,
  mediaHost: null,
  mediaStatus: null,
};

export interface PlaybackReport {
  contentId: string;
  /** Measured network breakdown from the Resource Timing API. */
  net: NetworkBreakdown;
  authMs: number | null;
  metadataMs: number | null;
  firstFrameMs: number | null;
  seeks: SeekSample[];
  rebuffers: number;
  errors: string[];
  completed: boolean;
}

export class PlaybackMetrics {
  private t0: number;
  /** Real per-phase network timings, filled from Resource Timing entries. */
  net: NetworkBreakdown = { ...EMPTY_NET };
  private authMs: number | null = null;
  private metadataMs: number | null = null;
  private firstFrameMs: number | null = null;
  private seeks: SeekSample[] = [];
  private rebuffers = 0;
  private errors: string[] = [];
  private completed = false;
  private seekFrom: number | null = null;
  private seekT0 = 0;

  constructor(private contentId: string) {
    this.t0 = now();
  }

  markAuthDone(): void {
    if (this.authMs === null) this.authMs = now() - this.t0;
  }
  markMetadata(): void {
    if (this.metadataMs === null) this.metadataMs = now() - this.t0;
  }
  markFirstFrame(): void {
    if (this.firstFrameMs === null) this.firstFrameMs = now() - this.t0;
  }
  seekStart(from: number): void {
    this.seekFrom = from;
    this.seekT0 = now();
  }
  seekEnd(to: number): void {
    if (this.seekFrom === null) return;
    this.seeks.push({ from: round1(this.seekFrom), to: round1(to), latencyMs: Math.round(now() - this.seekT0) });
    this.seekFrom = null;
  }
  rebuffer(): void {
    this.rebuffers++;
  }
  error(message: string): void {
    if (this.errors.length < 8) this.errors.push(message.slice(0, 160));
  }
  complete(): void {
    this.completed = true;
  }

  /**
   * Read the real network breakdown for this media load. The <video> element
   * follows the 307 itself, so its single Resource Timing entry carries the
   * authorization time (redirectEnd-redirectStart), the redirect follow, and
   * the source's time to first byte.
   */
  recordNetwork(): void {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return;
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const media = entries
      .slice()
      .reverse()
      .find((e) => /\/api\/play\//.test(e.name) || /index\.csbots\.live|okcdn/.test(e.name));
    if (!media) return;
    const r = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : null);
    this.net = {
      authMs:
        r(media.redirectEnd > 0 ? media.redirectEnd - this.t0 : media.responseStart - this.t0),
      redirectMs: r(media.redirectEnd - media.redirectStart),
      sourceTtfbMs: r(
        media.responseStart - (media.redirectEnd > 0 ? media.redirectEnd : media.startTime),
      ),
      sourceTotalMs: r(media.responseEnd - media.startTime),
      mediaHost: (() => { try { return new URL(media.name).host; } catch { return null; } })(),
      mediaStatus: (media as PerformanceResourceTiming & { responseStatus?: number }).responseStatus ?? null,
    };
  }

  report(): PlaybackReport {
    return {
      contentId: this.contentId,
      net: this.net,
      authMs: this.authMs === null ? null : Math.round(this.authMs),
      metadataMs: this.metadataMs === null ? null : Math.round(this.metadataMs),
      firstFrameMs: this.firstFrameMs === null ? null : Math.round(this.firstFrameMs),
      seeks: [...this.seeks],
      rebuffers: this.rebuffers,
      errors: [...this.errors],
      completed: this.completed,
    };
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
