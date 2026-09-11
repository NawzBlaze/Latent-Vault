import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CATALOGUE,
  getById,
  getBySlug,
  getPlayable,
  getPublished,
  getSeasons,
} from '@/catalog/catalogue';
import { isPlayable, primaryOrigin } from '@/catalog/types';
import { assertPublishable, validateCatalogue } from '@/catalog/validate';

const ROOT = join(__dirname, '..', '..');

describe('catalogue validation', () => {
  it('has zero errors', () => {
    const issues = validateCatalogue(CATALOGUE);
    const errors = issues.filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });

  it('publishes Season 2 ONLY — 7 episodes + 2 bonus, unique ids/slugs', () => {
    const published = getPublished();
    expect(published).toHaveLength(9);
    expect(published.every((i) => i.season === 2)).toBe(true);
    expect(published.filter((i) => i.kind === 'episode')).toHaveLength(6);
    expect(published.filter((i) => i.kind === 'bonus')).toHaveLength(3);
    expect(new Set(published.map((i) => i.id)).size).toBe(published.length);
    expect(new Set(published.map((i) => i.slug)).size).toBe(published.length);
    // Regular numbering is complete and uncollapsed: E1..E6.
    expect(published.filter((i) => i.kind === 'episode').map((i) => i.episodeNumber).sort()).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    // Bonus numbering likewise: B1..B3.
    expect(published.filter((i) => i.kind === 'bonus').map((i) => i.episodeNumber).sort()).toEqual([
      1, 2, 3,
    ]);
    for (const item of published) {
      expect(item.description.toLowerCase()).toContain('latent');
    }
  });

  it('keeps unknown values unknown (no invented metadata)', () => {
    for (const item of CATALOGUE) {
      if (item.releaseDate !== null) expect(Number.isNaN(Date.parse(item.releaseDate))).toBe(false);
      for (const blob of [item.title, item.description, ...item.guests]) {
        expect(blob).not.toMatch(/tbd|todo|lorem|xxx|test test/i);
      }
    }
    // Every published item now has a source — no remaining unavailable identities.
    expect(CATALOGUE.filter((i) => i.availability === 'unavailable').map((i) => i.id).sort()).toEqual([]);
  });

  it('labels resolution honestly (label matches probed pixels)', () => {
    for (const item of CATALOGUE) {
      const r = item.resolution;
      if (!r) continue;
      if (r.label === '1080p') expect([r.width, r.height]).toEqual([1920, 1080]);
    }
  });

  it('enforces index-first: yuhu primary only when index has no usable media', () => {
    for (const item of getPlayable()) {
      const refs = [item.source!.primary, ...item.source!.alternates];
      const origins = refs.map((r) => r.origin);
      // All index refs precede all yuhu refs.
      expect(origins).toEqual([...origins].sort().reverse());
      if (primaryOrigin(item) === 'yuhu') {
        expect(origins).not.toContain('index');
      }
    }
    // The only yuhu-served episode is E6 (index holds E3–E5 + bonuses).
    expect(getPlayable().filter((i) => primaryOrigin(i) === 'yuhu').map((i) => i.id)).toEqual(['s2e6']);
    expect(primaryOrigin(getById('s2e5')!)).toBe('index');
  });

  it('ships poster artwork for every published item', () => {
    for (const item of getPublished()) {
      for (const file of [
        item.thumbnail,
        item.heroImage,
        item.heroImage.replace(/-hero\.svg$/, '-m.svg'),
      ]) {
        expect(existsSync(join(ROOT, 'public', file)), `missing ${file}`).toBe(true);
      }
    }
  });

  it('looks up by id, slug, and seasons', () => {
    expect(getById('s2e6')?.slug).toBe('s2-e6');
    expect(getBySlug('s2-bonus-e2')?.id).toBe('s2b2');
    expect(getById('nope')).toBeUndefined();
    expect(getSeasons()).toEqual([2]);
    expect(getPlayable().map((i) => i.id).sort()).toEqual(
      ['s2b1', 's2b2', 's2b3', 's2e1', 's2e2', 's2e3', 's2e4', 's2e5', 's2e6'],
    );
  });

  it('flags catalogue violations (scope, availability, priority)', () => {
    const base = getById('s2e5')!;
    const errs = (_OVER: unknown) =>
      validateCatalogue([_OVER as never]).filter((i) => i.level === 'error');
    // Season 1 is out of scope.
    expect(errs({ ...base, season: 1 }).some((i) => i.field === 'season')).toBe(true);
    // Available without source.
    expect(errs({ ...base, source: null }).length).toBeGreaterThan(0);
    // YouTube item with index source violates the "youtube must not mix" rule.
    const ytItem = getById('s2e1')!;
    expect(errs({ ...ytItem, source: { primary: { ...base.source!.primary }, alternates: [{ ...ytItem.source!.primary }] } }).some((i) => i.field === 'source')).toBe(true);
    // Yuhu primary ahead of an index ref violates priority.
    const yuhuPrimary = getById('s2e6')!.source!;
    expect(
      errs({
        ...base,
        source: { primary: yuhuPrimary.primary, alternates: [base.source!.primary] },
      }).some((i) => i.field === 'source'),
    ).toBe(true);
  });
});

describe('publication gate', () => {
  it('passes for published, available items with source refs', () => {
    expect(() => assertPublishable(getById('s2e6'))).not.toThrow();
    expect(isPlayable(getById('s2e6')!)).toBe(true);
  });

  it('rejects unknown, unpublished, unavailable, and sourceless items', () => {
    expect(() => assertPublishable(undefined)).toThrow();
    expect(() => assertPublishable(getById('s2e1'))).not.toThrow(); // now available with youtube source
    expect(isPlayable(getById('s2e1')!)).toBe(true);
    const base = getById('s2e5');
    expect(base).toBeDefined();
    expect(() => assertPublishable({ ...base!, published: false })).toThrow();
    expect(() => assertPublishable({ ...base!, availability: 'unavailable' as const })).toThrow();
    expect(() => assertPublishable({ ...base!, source: null })).toThrow();
  });
});
