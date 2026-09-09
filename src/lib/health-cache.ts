/** Tiny TTL cache for the /api/health source probes (module-private). */

export interface SourcePingResult {
  reachable: boolean;
  latencyMs: number | null;
}

export interface HealthProbe {
  at: number;
  index: SourcePingResult;
  yuhu: SourcePingResult;
}

let cached: HealthProbe | null = null;
export const HEALTH_CACHE_MS = 60_000;

export function getHealthProbe(): HealthProbe | null {
  if (cached && Date.now() - cached.at < HEALTH_CACHE_MS) return cached;
  return null;
}

export function setHealthProbe(p: HealthProbe): void {
  cached = p;
}

/** Test-only: drop the cached source probes. */
export function __resetHealthCacheForTests(): void {
  cached = null;
}
