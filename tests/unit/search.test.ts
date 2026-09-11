import { describe, expect, it } from 'vitest';
import { getPublished } from '@/catalog/catalogue';
import { parseEpisodeQuery, searchCatalog } from '@/catalog/search';

const ITEMS = getPublished();
const ids = (q: string) => searchCatalog(ITEMS, q).map((h) => h.item.id);

describe('query parsing', () => {
  it('parses S2E6 / S02E06', () => {
    expect(parseEpisodeQuery('S2E6')).toEqual({ season: 2, episode: 6, kind: null });
    expect(parseEpisodeQuery('S02E06')).toEqual({ season: 2, episode: 6, kind: null });
    expect(parseEpisodeQuery('s1e9')).toEqual({ season: 1, episode: 9, kind: null });
    expect(parseEpisodeQuery('EP6')).toEqual({ season: null, episode: 6, kind: null });
    expect(parseEpisodeQuery('S2 EP6')).toEqual({ season: 2, episode: 6, kind: null });
    expect(parseEpisodeQuery('s2 e6')).toEqual({ season: 2, episode: 6, kind: null });
  });

  it('parses Episode 6 and Bonus Episode 1', () => {
    expect(parseEpisodeQuery('Episode 6')).toEqual({ season: null, episode: 6, kind: null });
    expect(parseEpisodeQuery('Bonus Episode 1')).toEqual({ season: null, episode: 1, kind: 'bonus' });
  });

  it('parses Season 2 and bare bonus', () => {
    expect(parseEpisodeQuery('Season 2')).toEqual({ season: 2, episode: null, kind: null });
    expect(parseEpisodeQuery('bonus')).toEqual({ season: null, episode: null, kind: 'bonus' });
  });

  it('returns null for plain text', () => {
    expect(parseEpisodeQuery('Badshah')).toBeNull();
    expect(parseEpisodeQuery('')).toBeNull();
  });
});

describe('catalogue search (season 2 only)', () => {
  it('finds episode numbers first', () => {
    expect(ids('S2E6')[0]).toBe('s2e6');
    expect(ids('S02E06')[0]).toBe('s2e6');
    expect(ids('Episode 6')[0]).toBe('s2e6');
    expect(ids('EP6')[0]).toBe('s2e6');
    expect(ids('S2 EP6')[0]).toBe('s2e6');
    expect(ids('Varun')[0]).toBe('s2b3');
    expect(ids('Exclusive')[0]).toBe('s2b3');
    expect(ids('S2E1')[0]).toBe('s2e1');
    expect(ids('S2E2')[0]).toBe('s2e2');
  });

  it('never surfaces season 1', () => {
    expect(ids('S1E1')).toEqual([]);
    expect(ids('Season 1')).toEqual([]);
    expect(ids('Deepak Kalal')).toEqual([]);
    expect(ids('Manan Desai')).toEqual([]);
  });

  it('finds bonus episodes by marker', () => {
    expect(ids('Bonus Episode 1')[0]).toBe('s2b1');
    expect(ids('Bonus Episode 3')[0]).toBe('s2b3');
    expect(ids('bonus')).toEqual(expect.arrayContaining(['s2b1', 's2b2', 's2b3']));
  });

  it('matches people exactly, case-insensitively, partially', () => {
    expect(ids('Badshah')[0]).toBe('s2b2');
    expect(ids('badshah')[0]).toBe('s2b2');
    expect(ids('Bads')[0]).toBe('s2b2');
    expect(ids('Rajat Sood')[0]).toBe('s2b2');
    expect(ids('Sood')[0]).toBe('s2b2');
    expect(ids('Orry')[0]).toBe('s2e5');
    expect(ids('Archana Puran Singh')[0]).toBe('s2e5');
    expect(ids('Rakhi Sawant')[0]).toBe('s2e6');
    expect(ids('Ashneer')[0]).toBe('s2e6');
    expect(ids('Varun Dhawan')[0]).toBe('s2b3');
    expect(ids('Munawar Faruqui')[0]).toBe('s2b1');
    expect(ids('Munawar')[0]).toBe('s2b1');
    expect(ids('Haarsh Limbachiyaa')[0]).toBe('s2b2');
  });

  it('finds guests of all episodes', () => {
    expect(ids('Alia Bhatt')[0]).toBe('s2e1');
    expect(ids('Sharvari')[0]).toBe('s2e1');
    expect(ids('Kiku Sharda')[0]).toBe('s2e2');
  });

  it('matches token subsets across name parts', () => {
    expect(ids('Harssh Limbachiyaa')[0]).toBe('s2b2'); // filename spelling via alias
    expect(ids('Joshi')).toEqual(expect.arrayContaining(['s2b1', 's2b2'])); // Rohan + Sourav
    expect(ids('Tanmay')[0]).toBe('s2e3'); // Tanmay Bhat on E3 and E4; E3 ranks first
    expect(ids('Tanmay')).toEqual(expect.arrayContaining(['s2e3', 's2e4']));
  });

  it('matches seasons', () => {
    const s2 = ids('Season 2');
    expect(s2).toEqual(
      expect.arrayContaining(['s2e1', 's2e2', 's2e3', 's2e4', 's2e5', 's2b3', 's2e6', 's2b1', 's2b2']),
    );
  });

  it('explains why each result matched', () => {
    const hits = searchCatalog(ITEMS, 'Badshah');
    expect(hits[0].matchedOn.length).toBeGreaterThan(0);
    expect(hits[0].matchedOn.join(' ')).toMatch(/guest/i);
  });

  it('returns nothing for empty or unknown queries', () => {
    expect(searchCatalog(ITEMS, '')).toEqual([]);
    expect(searchCatalog(ITEMS, '   ')).toEqual([]);
    expect(searchCatalog(ITEMS, 'xyzzy-no-such-guest')).toEqual([]);
  });
});
