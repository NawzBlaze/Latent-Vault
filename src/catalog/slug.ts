import type { ContentKind } from './types';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function episodeSlug(season: number, episodeNumber: number, kind: ContentKind): string {
  if (kind === 'bonus') return `s${season}-bonus-e${episodeNumber}`;
  if (kind === 'special') return `s${season}-special-e${episodeNumber}`;
  return `s${season}-e${episodeNumber}`;
}

export function contentId(season: number, episodeNumber: number, kind: ContentKind): string {
  if (kind === 'bonus') return `s${season}b${episodeNumber}`;
  if (kind === 'special') return `s${season}x${episodeNumber}`;
  return `s${season}e${episodeNumber}`;
}
