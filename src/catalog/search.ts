/**
 * Catalogue search. Operates ENTIRELY on catalogue metadata — no hardcoded
 * names, no external calls.
 *
 * Matches: title, season/episode markers, guests, panelists, participants,
 * hosts, judges, aliases, description.
 *
 * Supports: exact, case-insensitive, partial, token and episode-number
 * matching ("Tanmay Bhat", "S2E5", "S02E05", "Episode 5", "Bonus Episode 1").
 */

import type { ContentItem } from './types';

export interface SearchHit {
  item: ContentItem;
  score: number;
  matchedOn: string[];
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  const n = norm(s);
  return n ? n.split(' ') : [];
}

interface EpisodeQuery {
  season: number | null;
  episode: number | null;
  kind: 'bonus' | 'special' | null;
}

/** Parse "S2E5", "S02E05", "Episode 5", "Bonus Episode 1", "Season 2". */
export function parseEpisodeQuery(raw: string): EpisodeQuery | null {
  const n = norm(raw);
  if (!n) return null;
  let season: number | null = null;
  let episode: number | null = null;
  let kind: 'bonus' | 'special' | null = null;

  // Compact or spaced: S2E6, s2 e6, S2EP6, S2 EP6.
  const se = n.match(/\bs0?(\d+)\s*e\s*p?\s*0?(\d+)\b/);
  if (se) {
    season = Number(se[1]);
    episode = Number(se[2]);
  }
  if (n.includes('bonus')) kind = 'bonus';
  if (n.includes('special')) kind = 'special';

  const ep = n.match(/\bepisodes?\s+0?(\d+)\b/) || n.match(/\bep\s*0?(\d+)\b/);
  if (ep) episode = Number(ep[1]);

  const sn = n.match(/\bseasons?\s+0?(\d+)\b/);
  if (sn) season = Number(sn[1]);

  // Bare pair like "2 5" is too ambiguous — ignore.
  if (season === null && episode === null && kind === null) return null;
  // A lone "episode"/"season" word with no number is not an episode query.
  if (season === null && episode === null) {
    // kind-only query ("bonus") is still useful.
    return kind ? { season, episode, kind } : null;
  }
  return { season, episode, kind };
}

function peopleOf(item: ContentItem): { name: string; role: string }[] {
  const out: { name: string; role: string }[] = [];
  const push = (names: string[], role: string) => names.forEach((name) => out.push({ name, role }));
  push(item.guests, 'guest');
  push(item.panelists, 'panelist');
  push(item.participants, 'participant');
  push(item.hosts, 'host');
  push(item.judges, 'judge');
  return out;
}

function scoreText(haystack: string, qTokens: string[]): { score: number; full: boolean; partial: boolean } {
  const h = norm(haystack);
  const hTokens = h ? h.split(' ') : [];
  if (qTokens.length === 0 || hTokens.length === 0) return { score: 0, full: false, partial: false };
  // Every query token must appear (as a prefix-or-full token hit) for a match.
  let hits = 0;
  let fullTokens = 0;
  for (const q of qTokens) {
    const full = hTokens.includes(q);
    const pref = !full && hTokens.some((t) => t.startsWith(q) && q.length >= 3);
    if (full) {
      hits++;
      fullTokens++;
    } else if (pref) {
      hits += 0.7;
    }
  }
  if (hits < qTokens.length * 0.7) return { score: 0, full: false, partial: false };
  const coverage = hits / qTokens.length;
  const exact = h === qTokens.join(' ');
  return { score: coverage * (exact ? 1.5 : 1), full: fullTokens === qTokens.length, partial: true };
}

export function searchCatalog(items: ContentItem[], rawQuery: string, limit = 24): SearchHit[] {
  const q = rawQuery.trim();
  if (!q) return [];
  const qTokens = tokens(q);
  const epq = parseEpisodeQuery(q);
  const hits: SearchHit[] = [];

  for (const item of items) {
    // An explicit season number is a hard filter: 'Season 1' must not
    // surface Season 2 items via the loose token fallback below.
    if (epq && epq.season !== null && item.season !== epq.season) continue;
    let score = 0;
    const matchedOn: string[] = [];

    // 1. Episode-number matching (highest signal).
    if (epq) {
      const seasonOk = epq.season === null || epq.season === item.season;
      const epOk = epq.episode === null || epq.episode === item.episodeNumber;
      const kindOk =
        epq.kind === null || item.kind === epq.kind || (epq.kind === 'bonus' && item.kind === 'episode' && epq.episode !== null);
      if (epq.season !== null && epq.episode !== null && seasonOk && epOk && (epq.kind === null || item.kind === epq.kind)) {
        score += 100;
        matchedOn.push(`S${item.season}E${item.episodeNumber}`);
      } else if (epq.episode !== null && epq.season === null && epOk && kindOk) {
        score += 60;
        matchedOn.push(`Episode ${item.episodeNumber}`);
      } else if (epq.season !== null && epq.episode === null && seasonOk && kindOk) {
        score += 25;
        matchedOn.push(`Season ${item.season}`);
      } else if (epq.kind !== null && epq.season === null && epq.episode === null && item.kind === epq.kind) {
        score += 25;
        matchedOn.push(item.kind === 'bonus' ? 'Bonus' : 'Special');
      }
    }

    // 2. People matching.
    for (const p of peopleOf(item)) {
      const r = scoreText(p.name, qTokens);
      if (r.score > 0) {
        score += 50 * r.score + (r.full ? 10 : 0);
        matchedOn.push(`${p.role}: ${p.name}`);
      }
    }
    for (const alias of item.aliases) {
      const r = scoreText(alias, qTokens);
      if (r.score > 0) {
        score += 30 * r.score;
        matchedOn.push(`aka ${alias}`);
      }
    }

    // 3. Title matching.
    const titleHay = `${item.title} season ${item.season} episode ${item.episodeNumber} ${item.kind}`;
    const tr = scoreText(titleHay, qTokens);
    if (tr.score > 0) {
      score += 20 * tr.score;
      matchedOn.push('title');
    }

    // 4. Description (weakest).
    const dr = scoreText(item.description, qTokens);
    if (dr.score > 0) {
      score += 6 * dr.score;
      if (matchedOn.length === 0) matchedOn.push('description');
    }

    if (score > 0) hits.push({ item, score, matchedOn: [...new Set(matchedOn)].slice(0, 3) });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
