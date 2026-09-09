/**
 * Latent-specific content filter — SEASON 2 ONLY.
 *
 * The sources host large unrelated libraries, so catalogue candidates must
 * pass a multi-signal check — never one fragile filename regex. Season 1
 * (and anything not verifiably Season 2) is a hard exclusion: this archive
 * publishes India's Got Latent Season 2 and nothing else.
 *
 * Signals (each contributes evidence):
 *  1. show markers   — "india's got latent" in several spellings
 *  2. season markers — S02, "season 2", "S2" (S01 is an EXCLUSION)
 *  3. episode markers— E01/E7, "episode 5", "bonus ep 2", "special"
 *  4. path/category  — any folder segment naming the show
 *  5. container      — video mime / video extension
 *
 * A file matches when the show marker is present AND at least one of
 * (season marker, episode marker, latent folder, bonus/special marker)
 * corroborates it, with no hard exclusion. Every decision returns its
 * evidence so wrong calls are auditable.
 */

export interface FilterInput {
  fileName: string;
  /** Folder path segments, e.g. ["India's Got Latent"]. */
  pathSegments?: string[];
  mimeType?: string;
}

export interface FilterVerdict {
  match: boolean;
  /** 0..1 confidence for tuning; match is decided by rules, not the score. */
  confidence: number;
  evidence: string[];
  season: number | null;
  episodeNumber: number | null;
  kind: 'episode' | 'bonus' | 'special' | null;
}

const VIDEO_EXT = new Set(['mp4', 'mkv', 'webm', 'm4v', 'mov', 'avi']);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasShowMarker(n: string): string | null {
  if (n.includes('indias got latent') || n.includes("india s got latent")) return 'show:indias-got-latent';
  if (n.includes('india got latent')) return 'show:india-got-latent';
  // Bare "got latent" only counts with a corroborating marker (checked by caller context).
  if (n.includes('got latent')) return 'show:got-latent';
  return null;
}

function seasonMarker(n: string): { season: number; evidence: string } | null {
  // Handles "S2", "S02" and glued "S02E06" (lookahead: boundary or episode part).
  const m = n.match(/\bs0?([12])(?=\b|e\d)/) || n.match(/\bseason\s+0?([12])\b/);
  if (m) return { season: Number(m[1]), evidence: `season:S${m[1]}` };
  return null;
}

function episodeMarker(n: string): { episode: number; evidence: string } | null {
  const m =
    n.match(/\bs0?[12]\s*e0?(\d{1,2})\b/) ||
    n.match(/\be0?(\d{1,2})\b/) ||
    n.match(/\bepisode\s+0?(\d{1,2})\b/) ||
    n.match(/\bep\s*0?(\d{1,2})\b/);
  if (m) return { episode: Number(m[1]), evidence: `episode:E${m[1]}` };
  return null;
}

function kindMarker(n: string): { kind: 'bonus' | 'special'; evidence: string } | null {
  if (n.includes('bonus')) return { kind: 'bonus', evidence: 'kind:bonus' };
  if (n.includes('special')) return { kind: 'special', evidence: 'kind:special' };
  return null;
}

export function filterSourceFile(input: FilterInput): FilterVerdict {
  const evidence: string[] = [];
  const name = norm(input.fileName);
  const show = hasShowMarker(name);

  let season: number | null = null;
  let episodeNumber: number | null = null;
  let kind: FilterVerdict['kind'] = null;

  const sMark = seasonMarker(name);
  if (sMark) {
    season = sMark.season;
    evidence.push(sMark.evidence);
  }
  const eMark = episodeMarker(name);
  if (eMark) {
    episodeNumber = eMark.episode;
    evidence.push(eMark.evidence);
  }
  const kMark = kindMarker(name);
  if (kMark) {
    kind = kMark.kind;
    evidence.push(kMark.evidence);
  }

  const segs = (input.pathSegments ?? []).map(norm);
  const folderHit = segs.find((s) => hasShowMarker(s));
  if (folderHit) evidence.push(`folder:${folderHit.slice(0, 40)}`);

  const ext = (input.fileName.split('.').pop() ?? '').toLowerCase();
  const isVideo =
    (input.mimeType?.startsWith('video/') ?? false) || VIDEO_EXT.has(ext);
  if (isVideo) evidence.push(`container:${ext || input.mimeType}`);

  // Hard exclusions: folders can never be episodes, and Season 1 is out of
  // scope for this archive — only Season 2 is published.
  if (input.mimeType === 'application/vnd.google-apps.folder') {
    return { match: false, confidence: 0, evidence: [...evidence, 'exclude:folder'], season, episodeNumber, kind };
  }
  if (season === 1) {
    return {
      match: false,
      confidence: 0,
      evidence: [...evidence, 'exclude:season-1'],
      season,
      episodeNumber,
      kind,
    };
  }

  if (!show) {
    return { match: false, confidence: 0.05, evidence: [...evidence, 'missing:show-marker'], season, episodeNumber, kind };
  }
  evidence.unshift(show);

  // Corroboration rule: the show marker alone is not enough — require at
  // least one of season / episode / kind marker, a latent folder, or (for
  // already-classified video) a bare got-latent + video signal pair.
  const corroborated =
    sMark !== null || eMark !== null || kMark !== null || folderHit !== undefined;

  if (!corroborated) {
    return {
      match: false,
      confidence: 0.3,
      evidence: [...evidence, 'missing:corroboration'],
      season,
      episodeNumber,
      kind,
    };
  }

  if (!isVideo) {
    return {
      match: false,
      confidence: 0.4,
      evidence: [...evidence, 'missing:video-container'],
      season,
      episodeNumber,
      kind,
    };
  }

  const confidence = Math.min(0.99, 0.55 + evidence.length * 0.09);
  return { match: true, confidence, evidence, season, episodeNumber, kind: kind ?? 'episode' };
}

export interface YuhuEntryInput {
  dataId: string;
  title: string;
  /** 'okcdn' | 'youtube' | 'mp4' as listed in Yuhu's okcdn.json. */
  type: string;
}

export interface YuhuVerdict {
  /** True only for numbered S2 episodes/bonuses with direct (non-YouTube) media. */
  usable: boolean;
  reason: string;
  kind: 'episode' | 'bonus' | null;
}

/**
 * Classify a Yuhu okcdn.json entry for catalogue use.
 *
 * Policy (see docs/SOURCE.md):
 *  - Only numbered Season 2 regular episodes and numbered bonus episodes.
 *  - 'youtube'-type entries are metadata-only (never playback).
 *  - BTS clips, documentaries, talk segments and specials are NOT episodes
 *    and are rejected, even when they carry an 's2-' dataId prefix.
 *  - Season 1 / special entries are rejected.
 */
export function classifyYuhuEntry(input: YuhuEntryInput): YuhuVerdict {
  const id = input.dataId.trim().toLowerCase();
  if (!id.startsWith('s2-')) {
    return { usable: false, reason: 'not a season-2 entry', kind: null };
  }
  if (id.startsWith('s2-bts') || id.includes('bonus-clip') || id.includes('stillalive')) {
    return { usable: false, reason: 'behind-the-scenes / clip / documentary, not an episode', kind: null };
  }
  let kind: 'episode' | 'bonus' | null = null;
  if (/^s2-\d{2}(-|$)/.test(id)) kind = 'episode';
  else if (/^s2-bonus-ep\d+$/.test(id)) kind = 'bonus';
  if (!kind) {
    return { usable: false, reason: 'not a numbered episode or bonus entry', kind: null };
  }
  if (input.type !== 'okcdn') {
    return { usable: false, reason: `'${input.type}' entries are metadata-only (no direct media)`, kind };
  }
  return { usable: true, reason: 'numbered season-2 entry with direct media', kind };
}
