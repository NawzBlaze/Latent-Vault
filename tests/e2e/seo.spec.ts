import { expect, test } from '@playwright/test';

test.describe('seo + platform', () => {
  test('robots.txt and sitemap.xml', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Disallow: /api/');

    const sm = await request.get('/sitemap.xml');
    expect(sm.status()).toBe(200);
    const xml = await sm.text();
    for (const slug of ['s2-e1', 's2-e2', 's2-e6', 's2-bonus-e1', 's2-bonus-e2']) {
      expect(xml).toContain(`/watch/${slug}`);
    }
    expect(xml).toContain('/season/2');
    // Season 1 is excluded from every public surface.
    expect(xml).not.toContain('/watch/s1-');
    expect(xml).not.toContain('/season/1');
  });

  test('season 1 route is a genuine 404', async ({ page }) => {
    const res = await page.goto('/season/1');
    expect(res?.status()).toBe(404);
  });

  test('real 404 for unknown watch slug', async ({ page }) => {
    const res = await page.goto('/watch/no-such-episode');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Reel not found' })).toBeVisible();
  });

  test('episode pages carry unique metadata + canonical', async ({ page }) => {
    await page.goto('/watch/s2-e5');
    await expect(page).toHaveTitle(/S2 E5/);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /\/watch\/s2-e5$/);
    const og = page.locator('meta[property="og:image"]');
    await expect(og.first()).toHaveAttribute('content', /\/watch\/s2-e5\/opengraph-image/);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain('VideoObject');
    expect(ld).toContain('/api/play/s2e5');
  });

  test('unavailable episode pages advertise no playback URL', async ({ page }) => {
    await page.goto('/watch/s2-e1');
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain('VideoObject');
    expect(ld).not.toContain('/api/play/');
  });

  test('health endpoint reports honestly', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.catalogue.published).toBe(9);
    expect(body.catalogue.seasons).toEqual([2]);
    expect(body.catalogue.available).toBe(7);
    expect(body.catalogue.unavailable).toBe(2);
    expect(typeof body.sources.index.reachable).toBe('boolean');
    expect(typeof body.sources.yuhu.reachable).toBe('boolean');
  });

  test('mobile watch layout: no overflow, 44px targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/watch/s2-bonus-e2');
    await expect(page.locator('.lv-player')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    // Touch-only ±10s buttons exist only on coarse-pointer projects; the
    // core controls must be 44px targets everywhere.
    const names = ['Play', 'Player settings', 'Enter fullscreen'];
    const touchBack = page.getByRole('button', { name: 'Back 10 seconds' });
    if (await touchBack.isVisible().catch(() => false)) {
      names.push('Back 10 seconds', 'Forward 10 seconds');
    }
    for (const name of names) {
      const box = await page.getByRole('button', { name }).first().boundingBox();
      expect(box, name).not.toBeNull();
      expect(Math.min(box!.width, box!.height), name).toBeGreaterThanOrEqual(43);
    }
  });
});
