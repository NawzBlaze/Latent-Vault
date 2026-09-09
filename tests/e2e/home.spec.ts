import { expect, test } from '@playwright/test';

test.describe('homepage', () => {
  test('renders brand, hero, and sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LATENT VAULT/);
    await expect(page.getByRole('link', { name: 'Latent Vault home' })).toBeVisible();
    // Hero: latest Season 2 release (S2E6) with Watch + Browse actions.
    await expect(page.getByRole('heading', { name: 'India’s Got Latent' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Watch now/ })).toHaveAttribute('href', '/watch/s2-e6');
    await expect(page.getByRole('link', { name: /Browse season 2/ })).toBeVisible();
    // Real sections only: Season 2 + Bonus. No duplicated catalogue rails.
    await expect(page.getByRole('heading', { name: 'Season 2' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bonus' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Latest releases' })).toHaveCount(0);
    // Cards link to watch pages; all 7 regular episodes listed (E1, E2 marked unavailable).
    const cards = page.locator('.ep-card');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first()).toHaveAttribute('href', /\/watch\//);
    await expect(page.locator('.ep-card[href="/watch/s2-e1"]')).toContainText('Not available');
    await expect(page.locator('.ep-card[href="/watch/s2-e6"]')).toContainText('1080p');
  });

  test('season 1 appears nowhere public', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/season/1"]')).toHaveCount(0);
    await expect(page.locator('a[href^="/watch/s1-"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Season 1' })).toHaveCount(0);
  });

  test('navigates header links', async ({ page }) => {
    await page.goto('/');
    const desktopNav = page.getByRole('navigation', { name: 'Primary' });
    const menuBtn = page.getByRole('button', { name: /Open menu|Close menu/ });
    // Mobile: open the compact menu first.
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      const mobileNav = page.getByRole('navigation', { name: 'Mobile' });
      await mobileNav.getByRole('link', { name: 'Season 2' }).click();
      await expect(page).toHaveURL(/\/season\/2/);
      await expect(page.getByRole('heading', { name: 'Season 2' }).first()).toBeVisible();
      await menuBtn.click();
      await mobileNav.getByRole('link', { name: 'Bonus' }).click();
      await expect(page).toHaveURL(/\/bonus/);
      return;
    }
    await desktopNav.getByRole('link', { name: 'Season 2' }).click();
    await expect(page).toHaveURL(/\/season\/2/);
    await expect(page.getByRole('heading', { name: 'Season 2' })).toBeVisible();
    await desktopNav.getByRole('link', { name: 'Bonus' }).click();
    await expect(page).toHaveURL(/\/bonus/);
  });

  test('footer carries the unofficial-archive disclaimer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.footer-legal')).toContainText('Unofficial fan archive');
  });

  test('has no horizontal overflow on small phones', async ({ page }) => {
    for (const size of [
      { w: 375, h: 812 },
      { w: 390, h: 844 },
      { w: 430, h: 932 },
    ]) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${size.w}px overflow`).toBeLessThanOrEqual(1);
    }
  });
});
