/**
 * Intent-based playback prefetch.
 *
 * Cold source resolution (~3.5 s before any media byte) is the single largest
 * contributor to first-frame latency. The server caches the resolved signed URL
 * for its real remaining lifetime, so if we start that work while the user is
 * *deciding* (hovering, focusing, or touching an episode card) the click lands
 * on a warm, fast entry.
 *
 * prefetchOnPageLoad(): called immediately when a watch page mounts — warms
 * the URL before the user even presses play. This is the biggest win for the
 * "video takes too long to load" problem.
 *
 * Guardrails: one request per id per page life, small global cap, no timers
 * that outlive the interaction, failures silently ignored.
 */

const MAX_PREFETCH = 8;
const DWELL_MS    = 60;   // faster than 110ms — intent confirmed sooner

const done    = new Set<string>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** Warm the authorisation for one playable id after a short dwell. Safe to call repeatedly. */
export function prefetchPlayback(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  if (done.has(id) || pending.has(id)) return;
  if (done.size + pending.size >= MAX_PREFETCH) return;
  const timer = setTimeout(() => {
    pending.delete(id);
    done.add(id);
    fetch(`/api/play/${id}`, { method: 'HEAD', redirect: 'manual', cache: 'no-store' }).catch(() => {});
  }, DWELL_MS);
  pending.set(id, timer);
}

/**
 * Warm immediately on page load (no dwell delay).
 * Called from the watch page useEffect so the URL is cached before play is pressed.
 */
export function prefetchOnPageLoad(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  if (done.has(id)) return;
  // Cancel any pending dwell timer (we're doing it now)
  const existing = pending.get(id);
  if (existing) { clearTimeout(existing); pending.delete(id); }
  done.add(id);
  fetch(`/api/play/${id}`, { method: 'HEAD', redirect: 'manual', cache: 'no-store' }).catch(() => {});
}

/** Cancel a hover that never became a click (pointer left before dwell). */
export function cancelPrefetch(id: string): void {
  const timer = pending.get(id);
  if (timer) { clearTimeout(timer); pending.delete(id); }
}

/** Test hook: forget what has been warmed. */
export function __resetPrefetch(): void {
  done.clear();
  for (const t of pending.values()) clearTimeout(t);
  pending.clear();
}
