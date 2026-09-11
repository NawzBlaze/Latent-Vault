/**
 * Catalogue validation — keeps the data honest.
 * Run in tests and (cheaply) at build time. Publication gate included:
 * only `published: true` + `available` items with source refs may play.
 */

import type { ContentItem } from './types';
import { PUBLIC_SEASON } from './types';

export interface ValidationIssue {
  level: 'error' | 'warning';
  itemId: string;
  field: string;
  message: string;
}

const RES_LABELS: Record<string, [number, number]> = {
  '480p': [854, 480],
  '576p': [1024, 576],
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
  '2160p': [3840, 2160],
};

export function validateCatalogue(items: ContentItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const push = (level: ValidationIssue['level'], itemId: string, field: string, message: string) =>
    issues.push({ level, itemId, field, message });

  for (const item of items) {
    if (!item.id) push('error', '?', 'id', 'missing id');
    if (ids.has(item.id)) push('error', item.id, 'id', 'duplicate id');
    ids.add(item.id);
    if (!item.slug) push('error', item.id, 'slug', 'missing slug');
    if (slugs.has(item.slug)) push('error', item.id, 'slug', 'duplicate slug');
    slugs.add(item.slug);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug || '')) {
      push('error', item.id, 'slug', 'slug must be kebab-case');
    }
    // Scope gate: this archive publishes ONLY Season 2.
    if (item.season !== PUBLIC_SEASON) {
      push('error', item.id, 'season', `only season ${PUBLIC_SEASON} may be catalogued`);
    }
    if (!Number.isInteger(item.episodeNumber) || item.episodeNumber < 1) {
      push('error', item.id, 'episodeNumber', 'invalid episodeNumber');
    }
    if (!['episode', 'bonus', 'special'].includes(item.kind)) push('error', item.id, 'kind', 'invalid kind');
    if (!item.title?.trim()) push('error', item.id, 'title', 'missing title');
    if (!item.description?.trim()) push('error', item.id, 'description', 'missing description');
    if (typeof item.published !== 'boolean') push('error', item.id, 'published', 'published must be boolean');
    if (item.availability !== 'available' && item.availability !== 'unavailable') {
      push('error', item.id, 'availability', 'availability must be available|unavailable');
    }

    if (item.releaseDate !== null && Number.isNaN(Date.parse(item.releaseDate))) {
      push('error', item.id, 'releaseDate', 'releaseDate must be ISO date or null');
    }
    if (item.archivedAt !== null && Number.isNaN(Date.parse(item.archivedAt))) {
      push('error', item.id, 'archivedAt', 'archivedAt must be an ISO date or null');
    }

    if (item.durationSeconds !== null && !(item.durationSeconds > 0)) {
      push('error', item.id, 'durationSeconds', 'duration must be positive seconds or null');
    }

    // Availability consistency: available ⟺ usable refs + probed media facts.
    const refs = item.source ? [item.source.primary, ...item.source.alternates] : [];
    const isYoutube = refs.some((r) => r.origin === 'youtube');
    if (item.availability === 'available') {
      if (!item.source) {
        push('error', item.id, 'source', 'available items must carry source references');
      }
      // YouTube-sourced items don't need probed duration/resolution/archivedAt.
      if (!isYoutube) {
        if (item.durationSeconds === null) {
          push('error', item.id, 'durationSeconds', 'available items must have a probed duration');
        }
        if (!item.resolution) {
          push('error', item.id, 'resolution', 'available items must have a probed resolution');
        }
        if (item.archivedAt === null) {
          push('error', item.id, 'archivedAt', 'available items must record when the copy was archived');
        }
      }
    } else {
      // Unavailable = verified identity ONLY. No refs, no media facts.
      if (item.source) push('error', item.id, 'source', 'unavailable items must not carry source refs');
      if (item.durationSeconds !== null) {
        push('error', item.id, 'durationSeconds', 'unavailable items must not claim a duration');
      }
      if (item.resolution) {
        push('error', item.id, 'resolution', 'unavailable items must not claim a resolution');
      }
      if (item.archivedAt !== null) {
        push('error', item.id, 'archivedAt', 'unavailable items archive no copy');
      }
    }

    // Reference shape per origin.
    for (const [n, ref] of refs.entries()) {
      const where = n === 0 ? 'source.primary' : `source.alternates[${n - 1}]`;
      if (ref.origin === 'index') {
        if (!ref.fileName) push('error', item.id, `${where}.fileName`, 'missing index file name');
        if (!(ref.sizeBytes > 0)) push('error', item.id, `${where}.sizeBytes`, 'missing index size');
        if (!ref.mimeType?.startsWith('video/')) {
          push('error', item.id, `${where}.mimeType`, 'index ref must be a video MIME type');
        }
        if (!ref.searchHint) push('warning', item.id, `${where}.searchHint`, 'missing search hint');
      } else if (ref.origin === 'yuhu') {
        if (!ref.dataId) push('error', item.id, `${where}.dataId`, 'missing yuhu dataId');
        if (!ref.videoId) push('error', item.id, `${where}.videoId`, 'missing yuhu videoId');
        if (!ref.quality) push('error', item.id, `${where}.quality`, 'missing verified yuhu quality');
        if (!ref.mimeType?.startsWith('video/')) {
          push('error', item.id, `${where}.mimeType`, 'yuhu ref must be a video MIME type');
        }
      } else if (ref.origin === 'youtube') {
        if (!ref.videoId) push('error', item.id, `${where}.videoId`, 'missing youtube videoId');
      } else {
        push('error', item.id, where, 'unknown source origin');
      }
    }

    // Priority rule: index refs ALWAYS precede yuhu refs. A yuhu primary is
    // only legal when the item has no usable index media at all.
    // YouTube refs are standalone — they never mix with index/yuhu.
    const hasYoutube = refs.some((r) => r.origin === 'youtube');
    const hasIndexOrYuhu = refs.some((r) => r.origin === 'index' || r.origin === 'yuhu');
    if (hasYoutube && hasIndexOrYuhu) {
      push('error', item.id, 'source', 'youtube refs must not mix with index or yuhu refs');
    }
    const firstYuhu = refs.findIndex((r) => r.origin === 'yuhu');
    const lastIndex = refs.map((r) => r.origin).lastIndexOf('index');
    if (firstYuhu !== -1 && lastIndex !== -1 && firstYuhu < lastIndex) {
      push('error', item.id, 'source', 'index references must precede yuhu references');
    }

    // Resolution honesty: label must match probed pixels.
    // Skip for YouTube-sourced items (no local media to probe).
    const r = item.resolution;
    if (r && !isYoutube) {
      const expected = RES_LABELS[r.label];
      if (!expected) {
        push('warning', item.id, 'resolution.label', `unusual label ${r.label}`);
      } else if (expected[0] !== r.width || expected[1] !== r.height) {
        push('error', item.id, 'resolution', `label ${r.label} does not match ${r.width}x${r.height}`);
      }
      const v = item.source?.primary;
      if (v?.width && v?.height && (v.width !== r.width || v.height !== r.height)) {
        push('error', item.id, 'resolution', 'resolution does not match primary variant probe');
      }
    }

    for (const f of ['thumbnail', 'heroImage'] as const) {
      if (!item[f]?.startsWith('/')) push('error', item.id, f, `${f} must be a local path`);
    }
  }
  return issues;
}

export function assertPublishable(item: ContentItem | undefined): asserts item is ContentItem {
  if (!item || !item.published || item.availability !== 'available' || !item.source) {
    throw new Error('not publishable');
  }
}
