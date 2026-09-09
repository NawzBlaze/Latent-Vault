/** Format seconds as H:MM:SS or M:SS. Unknown -> '—'. */
export function formatClock(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '—';
  }
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1 hr 4 min" style runtime for cards. Unknown -> 'Unknown runtime'. */
export function formatRuntime(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return 'Unknown runtime';
  }
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

/** "S2 · E5" / "S2 · Bonus E2" badge text. */
export function seasonEpisodeLabel(season: number, episodeNumber: number, kind: string): string {
  if (kind === 'bonus') return `S${season} · Bonus E${episodeNumber}`;
  if (kind === 'special') return `S${season} · Special ${episodeNumber}`;
  return `S${season} · E${episodeNumber}`;
}
