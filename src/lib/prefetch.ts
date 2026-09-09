/**
 * Intent-based playback prefetch.
 *
 * Cold source resolution (minting a fresh signed URL upstream) is the single
 * largest contributor to first-frame latency — measured at ~3.5 s before any
 * media byte is requested. The server caches the result for its real remaining
 * lifetime, so if we start that work while the user is *deciding* (hovering,
 * focusing or touching an episode card) the click lands on a warm entry.
 *
 * Guardrails: one request per id per page life, a small global cap, no timers
 * that outlive the interaction, failures silently ignored (this is a hint, and
 * playback re-resolves normally if the prefetch is dropped).
 */

const MAX_PREFETCH = 6;
const DWELL_MS = 110;

const done = new Set<string>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** Warm the authorization for one playable id. Safe to call repeatedly. */
export function prefetchPlayback(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  if (done.has(id) || pending.has(id)) return;
  // Count in-flight too: a fast scroll queues many hovers before any resolves,
  // so gating on `done` alone would let the whole grid through at once.
  if (done.size + pending.size >= MAX_PREFETCH) return;
  const timer = setTimeout(() => {
    pending.delete(id);
    done.add(id);
    fetch(`/api/play/${id}`, { method: 'HEAD', redirect: 'manual', cache: 'no-store' }).catch(
      () => {},
    );
  }, DWELL_MS);
  pending.set(id, timer);
}

/** Cancel a hover that never became a click (pointer left before dwell). */
export function cancelPrefetch(id: string): void {
  const timer = pending.get(id);
  if (timer) {
    clearTimeout(timer);
    pending.delete(id);
  }
}

/** Test hook: forget what has been warmed. */
export function __resetPrefetch(): void {
  done.clear();
  for (const t of pending.values()) clearTimeout(t);
  pending.clear();
}
