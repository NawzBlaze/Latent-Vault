import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test('finds a guest and explains the match', async ({ page }) => {
    await page.goto('/search');
    await page.locator('#archive-q').fill('Badshah');
    await expect(page.getByText('1 result for “Badshah”')).toBeVisible();
    const hit = page.locator('.search-hit').first();
    await expect(hit).toContainText('Bonus Episode 2');
    await expect(hit).toContainText('guest: Badshah');
  });

  test('matches episode numbers (S2E5 / S02E05 / Episode 5)', async ({ page }) => {
    await page.goto('/search?q=S2E5');
    await expect(page.locator('.search-hit').first()).toContainText('Episode 5');
    await page.locator('#archive-q').fill('S02E05');
    await expect(page.locator('.search-hit').first()).toContainText('Episode 5');
    await page.locator('#archive-q').fill('Bonus Episode 1');
    await expect(page.locator('.search-hit').first()).toContainText('Bonus Episode 1');
    await page.locator('#archive-q').fill('S2E6');
    await expect(page.locator('.search-hit').first()).toContainText('Episode 6');
  });

  test('finds guests of unavailable episodes, marked honestly', async ({ page }) => {
    await page.goto('/search');
    await page.locator('#archive-q').fill('Alia Bhatt');
    const hit = page.locator('.search-hit').first();
    await expect(hit).toContainText('Episode 1');
    await expect(hit).toContainText('Not currently available');
  });

  test('season 1 queries return the intentional zero state', async ({ page }) => {
    await page.goto('/search?q=Season%201');
    await expect(page.getByText('Nothing in the vault matches that')).toBeVisible();
  });

  test('partial + case-insensitive matching', async ({ page }) => {
    await page.goto('/search');
    await page.locator('#archive-q').fill('bads');
    await expect(page.locator('.search-hit').first()).toContainText('Bonus Episode 2');
  });

  test('zero-result state looks intentional', async ({ page }) => {
    await page.goto('/search');
    await page.locator('#archive-q').fill('xyzzy-no-such-guest');
    await expect(page.getByText('Nothing in the vault matches that')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse Season 2' })).toBeVisible();
  });

  test('header search submits to the search page', async ({ page }) => {
    await page.goto('/');
    const box = page.locator('.header-search input');
    if (await box.isVisible()) {
      await box.fill('Orry');
      await box.press('Enter');
      await expect(page).toHaveURL(/\/search\?q=Orry/);
      await expect(page.locator('.search-hit').first()).toContainText('Episode 5');
    }
  });
});
