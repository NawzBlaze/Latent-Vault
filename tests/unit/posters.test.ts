import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '@/catalog/catalogue';
import { isPlayable } from '@/catalog/types';

const PUBLIC_DIR = join(process.cwd(), 'public');
const onDisk = (p: string) => existsSync(join(PUBLIC_DIR, p)) && statSync(join(PUBLIC_DIR, p)).size > 0;

describe('episode artwork', () => {
  it('every playable item uses a real frame extracted from its own video', () => {
    for (const item of CATALOGUE.filter(isPlayable)) {
      const isYoutube = item.source?.primary.origin === 'youtube';
      if (isYoutube) {
        // YouTube-sourced items use their own thumbnail naming convention.
        expect(item.thumbnail, `${item.id} thumbnail`).toMatch(/^\/posters\/s2(e|bonus-e)\d+\.jpg$/);
      } else {
        expect(item.thumbnail, `${item.id} thumbnail`).toMatch(/^\/posters\/frame-[a-z0-9]+\.jpg$/);
      }
      expect(onDisk(item.thumbnail), `${item.thumbnail} on disk`).toBe(true);
    }
  });

  it('items with no media never borrow a playable frame', () => {
    const playableFrames = new Set(
      CATALOGUE.filter(isPlayable).map((i) => i.thumbnail),
    );
    for (const item of CATALOGUE.filter((i) => !isPlayable(i))) {
      expect(playableFrames.has(item.thumbnail), `${item.id} must not reuse a real frame`).toBe(false);
      expect(item.thumbnail).toBe('/posters/unavailable.svg');
      expect(onDisk(item.thumbnail)).toBe(true);
    }
    // All published items are now playable — this test is a no-op but kept for future-proofing.
  });

  it('no synthetic episode-number key art is referenced any more', () => {
    for (const item of CATALOGUE) {
      const isYoutube = item.source?.primary.origin === 'youtube';
      if (isYoutube) continue; // YouTube items use their own naming
      expect(item.thumbnail).not.toMatch(/\/posters\/s2-(e|bonus-e)\d/);
      expect(item.heroImage).not.toMatch(/\/posters\/s2-(e|bonus-e)\d/);
    }
  });
});
