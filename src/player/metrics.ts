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

export interface PlaybackReport {
  contentId: string;
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

  report(): PlaybackReport {
    return {
      contentId: this.contentId,
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
