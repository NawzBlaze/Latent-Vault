import type { ContentItem } from './types';

function rank(item: ContentItem): number {
  // Regular episodes first, then bonus, then specials — each by season/episode.
  const kindRank = item.kind === 'episode' ? 0 : item.kind === 'bonus' ? 1 : 2;
  return kindRank * 1_000_000 + item.season * 10_000 + item.episodeNumber;
}

/** Oldest first: S1E1 … S2E6, then bonus, then specials. */
export function sortChronological(items: ContentItem[]): ContentItem[] {
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/** Newest first. */
export function sortLatestFirst(items: ContentItem[]): ContentItem[] {
  return [...items].sort((a, b) => rank(b) - rank(a));
}

/** The hero / "latest" item: highest season+episode among regular episodes. */
export function latestRegular(items: ContentItem[]): ContentItem | undefined {
  const regular = items.filter((i) => i.kind === 'episode');
  return sortLatestFirst(regular)[0];
}

export interface PrevNext {
  prev: ContentItem | null;
  next: ContentItem | null;
}

/**
 * Previous / next within the same kind chain (episodes chain together,
 * bonus chain together), ordered chronologically.
 */
export function prevNext(items: ContentItem[], current: ContentItem): PrevNext {
  const chain = sortChronological(items.filter((i) => i.kind === current.kind));
  const idx = chain.findIndex((i) => i.id === current.id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? chain[idx - 1] : null,
    next: idx < chain.length - 1 ? chain[idx + 1] : null,
  };
}

/** Related = same season first, then same kind, then the rest (latest first). */
export function related(items: ContentItem[], current: ContentItem, limit = 6): ContentItem[] {
  const others = items.filter((i) => i.id !== current.id);
  const score = (i: ContentItem) =>
    (i.season === current.season ? 2 : 0) + (i.kind === current.kind ? 1 : 0);
  return [...others]
    .sort((a, b) => score(b) - score(a) || rank(b) - rank(a))
    .slice(0, limit);
}
