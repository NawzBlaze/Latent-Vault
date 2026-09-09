/**
 * Lightweight client-side resume, backed by localStorage.
 * Key format: igl_progress_[contentId]
 */

export interface WatchProgress {
  position: number;
  duration: number;
  updatedAt: number;
  completed: boolean;
}

export function progressKey(contentId: string): string {
  return `igl_progress_${contentId}`;
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isValid(p: unknown): p is WatchProgress {
  if (!p || typeof p !== 'object') return false;
  const v = p as Record<string, unknown>;
  return (
    typeof v.position === 'number' &&
    Number.isFinite(v.position) &&
    v.position >= 0 &&
    typeof v.duration === 'number' &&
    Number.isFinite(v.duration) &&
    v.duration >= 0 &&
    typeof v.updatedAt === 'number' &&
    typeof v.completed === 'boolean'
  );
}

export function loadProgress(contentId: string): WatchProgress | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(progressKey(contentId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProgress(contentId: string, position: number, duration: number): WatchProgress | null {
  const s = storage();
  if (!s) return null;
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const pos = Number.isFinite(position) && position >= 0 ? Math.min(position, dur || position) : 0;
  // Completed when within the last 20 seconds (or 97% for very long files).
  const completed = dur > 0 && (dur - pos <= 20 || (dur > 0 && pos / dur >= 0.97));
  const value: WatchProgress = { position: completed ? 0 : pos, duration: dur, updatedAt: Date.now(), completed };
  try {
    s.setItem(progressKey(contentId), JSON.stringify(value));
    return value;
  } catch {
    return null;
  }
}

export function clearProgress(contentId: string): void {
  try {
    storage()?.removeItem(progressKey(contentId));
  } catch {
    /* private-mode storage: resume silently unavailable */
  }
}

export interface ContinueEntry {
  contentId: string;
  progress: WatchProgress;
}

/** All unfinished entries with a meaningful position, newest first. */
export function listContinueWatching(): ContinueEntry[] {
  const s = storage();
  if (!s) return [];
  const out: ContinueEntry[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k || !k.startsWith('igl_progress_')) continue;
      const raw = s.getItem(k);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!isValid(parsed)) continue;
      if (parsed.completed || parsed.position < 15) continue;
      out.push({ contentId: k.slice('igl_progress_'.length), progress: parsed });
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.progress.updatedAt - a.progress.updatedAt);
}
