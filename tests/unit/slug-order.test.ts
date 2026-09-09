import { describe, expect, it } from 'vitest';
import { getPublished } from '@/catalog/catalogue';
import { contentId, episodeSlug, slugify } from '@/catalog/slug';
import { latestRegular, prevNext, related, sortChronological, sortLatestFirst } from '@/catalog/order';

const ITEMS = getPublished();

describe('slugs', () => {
  it('slugifies text', () => {
    expect(slugify('  Hello, World!  ')).toBe('hello-world');
    expect(slugify('S02 — Bonus EP™ 2')).toBe('s02-bonus-ep-2');
  });

  it('builds episode slugs and ids', () => {
    expect(episodeSlug(1, 1, 'episode')).toBe('s1-e1');
    expect(episodeSlug(2, 2, 'bonus')).toBe('s2-bonus-e2');
    expect(episodeSlug(2, 1, 'special')).toBe('s2-special-e1');
    expect(contentId(2, 5, 'episode')).toBe('s2e5');
    expect(contentId(2, 1, 'bonus')).toBe('s2b1');
  });
});

describe('ordering', () => {
  it('orders chronologically and latest-first', () => {
    expect(sortChronological(ITEMS).map((i) => i.id)).toEqual([
      's2e1',
      's2e2',
      's2e3',
      's2e4',
      's2e5',
      's2e6',
      's2b1',
      's2b2',
      's2b3',
    ]);
    expect(sortLatestFirst(ITEMS)[0].id).toBe('s2b3');
  });

  it('picks the latest regular episode as the hero', () => {
    expect(latestRegular(ITEMS)?.id).toBe('s2e6');
  });

  it('chains prev/next within the same kind (numbering uncollapsed)', () => {
    const s2e3 = ITEMS.find((i) => i.id === 's2e3')!;
    const pn = prevNext(ITEMS, s2e3);
    // E2 is unavailable but keeps its place in the chain.
    expect(pn.prev?.id).toBe('s2e2');
    expect(pn.next?.id).toBe('s2e4');

    const first = ITEMS.find((i) => i.id === 's2e1')!;
    expect(prevNext(ITEMS, first).prev).toBeNull();

    const last = ITEMS.find((i) => i.id === 's2e6')!;
    expect(prevNext(ITEMS, last).next).toBeNull();

    const b1 = ITEMS.find((i) => i.id === 's2b1')!;
    const bpn = prevNext(ITEMS, b1);
    expect(bpn.prev).toBeNull();
    expect(bpn.next?.id).toBe('s2b2');

    const b2 = ITEMS.find((i) => i.id === 's2b2')!;
    const b2pn = prevNext(ITEMS, b2);
    expect(b2pn.prev?.id).toBe('s2b1');
    expect(b2pn.next?.id).toBe('s2b3');

    const b3 = ITEMS.find((i) => i.id === 's2b3')!;
    expect(prevNext(ITEMS, b3).next).toBeNull();
  });

  it('suggests related without repeating the current item', () => {
    const s2e5 = ITEMS.find((i) => i.id === 's2e5')!;
    const rel = related(ITEMS, s2e5, 4);
    expect(rel.map((i) => i.id)).not.toContain('s2e5');
    expect(rel.length).toBe(4);
    // Same-season items rank first.
    expect(rel[0].season).toBe(2);
  });
});
