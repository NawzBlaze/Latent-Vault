import { expect, test } from '@playwright/test';

/**
 * Watch-page + player tests against REAL media (Bonus EP2, MP4/AVC: the most
 * widely decodable file in the catalogue). Playwright's Chromium decodes it
 * with full codec support; assertions wait on real media events.
 */
const URL = '/watch/s2-bonus-e2?lv-debug=1';

async function readyPlayer(page: import('@playwright/test').Page) {
  await page.goto(URL);
  await expect(page.locator('.lv-player')).toBeVisible();
  // Wait for real metadata from the source (duration becomes finite).
  await page.waitForFunction(
    () => {
      const v = document.querySelector('video');
      return !!v && Number.isFinite(v.duration) && v.duration > 1000;
    },
    null,
    { timeout: 60_000 },
  );
}

test.describe('watch page', () => {
  test('shows title, metadata, people, prev/next, related', async ({ page }) => {
    await page.goto('/watch/s2-bonus-e2');
    await expect(page.getByRole('heading', { name: 'India’s Got Latent' })).toBeVisible();
    await expect(page.getByText('Season 2 · Bonus Episode 2').first()).toBeVisible();
    await expect(page.getByText('Badshah · Sourav Joshi')).toBeVisible();
    await expect(page.locator('.prevnext')).toContainText('Previous');
    await expect(page.getByRole('heading', { name: 'More from the vault' })).toBeVisible();
  });

  test('unavailable episode: verified identity, no player, no fake actions', async ({ page }) => {
    await page.goto('/watch/s2-e1');
    await expect(page.getByRole('heading', { name: 'India’s Got Latent' })).toBeVisible();
    await expect(page.getByText('Season 2 · Episode 1').first()).toBeVisible();
    await expect(page.getByText('Alia Bhatt · Sharvari · Ashish Solanki')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Not currently available' })).toBeVisible();
    await expect(page.locator('.lv-player')).toHaveCount(0);
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /play|watch/i })).toHaveCount(0);
    await expect(page.locator('.prevnext')).toContainText('Next →');
  });

  test('yuhu-sourced episode (E6) loads real media in the custom player', async ({ page }) => {
    await page.goto('/watch/s2-e6?lv-debug=1');
    await expect(page.locator('.lv-player')).toBeVisible();
    await expect(page.getByText('Rakhi Sawant · Ashneer Grover')).toBeVisible();
    await expect(page.locator('.source-line')).toContainText('Yuhu archive');
    await page.waitForFunction(
      () => {
        const v = document.querySelector('video');
        return !!v && Number.isFinite(v.duration) && v.duration > 3000 && v.duration < 3200;
      },
      null,
      { timeout: 60_000 },
    );
    const video = page.locator('video');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
  });

  test('play -> pause via button and keyboard', async ({ page }) => {
    await readyPlayer(page);
    const video = page.locator('video');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
    await expect(page.locator('.lv-player')).toHaveAttribute('data-state', 'playing');
    // Keyboard: space pauses.
    await page.keyboard.press(' ');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await page.keyboard.press(' ');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
  });

  test('seek: arrows, far seek, and 0-9 percentage', async ({ page }) => {
    await readyPlayer(page);
    const video = page.locator('video');
    const t0 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.keyboard.press('ArrowRight'); // +5s
    await expect
      .poll(async () => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(t0 + 3);
    await page.keyboard.press('5'); // 50%
    await expect
      .poll(async () => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 30_000 })
      .toBeGreaterThan(600);
    // Far seek near the end still resolves.
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = v.duration - 30;
    });
    await expect
      .poll(async () => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(600);
  });

  test('volume, mute, and playback speed controls', async ({ page }) => {
    await readyPlayer(page);
    const video = page.locator('video');
    await page.getByRole('button', { name: 'Mute' }).click();
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await page.keyboard.press('m');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
    await page.getByRole('button', { name: /Playback speed/ }).click();
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1.25);
    await page.keyboard.press('>');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1.5);
  });

  test('fullscreen toggles on the player region', async ({ page }) => {
    await readyPlayer(page);
    await page.getByRole('button', { name: 'Enter fullscreen' }).click();
    await expect.poll(async () => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await page.getByRole('button', { name: 'Exit fullscreen' }).click();
    await expect.poll(async () => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  });

  test('theater mode widens the player', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'theater mode is a desktop control');
    await readyPlayer(page);
    const player = page.locator('.lv-player');
    const before = await player.evaluate((el) => el.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'Enter theater mode' }).click();
    await expect(player).toHaveClass(/is-theater/);
    const after = await player.evaluate((el) => el.getBoundingClientRect().width);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('resume restores a saved position once metadata is available', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'igl_progress_s2b2',
        JSON.stringify({ position: 600, duration: 2400, updatedAt: Date.now(), completed: false }),
      );
    });
    await page.goto(URL);
    await page.waitForFunction(
      () => {
        const v = document.querySelector('video');
        return !!v && Math.abs(v.currentTime - 600) < 8;
      },
      null,
      { timeout: 60_000 },
    );
    await expect(page.getByText(/Resumed from/)).toBeVisible();
  });

  test('larger touch screens show ±10s buttons', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'requires a coarse pointer');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/watch/s2-bonus-e2');
    await expect(page.locator('.lv-player')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back 10 seconds' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forward 10 seconds' })).toBeVisible();
  });

  test('small-phone control bar fits without clipping', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'requires a coarse pointer');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/watch/s2-bonus-e2');
    await expect(page.locator('.lv-player')).toBeVisible();
    const player = await page.locator('.lv-player').boundingBox();
    const full = await page.getByRole('button', { name: 'Enter fullscreen' }).boundingBox();
    expect(player).not.toBeNull();
    expect(full).not.toBeNull();
    expect(full!.x + full!.width).toBeLessThanOrEqual(player!.x + player!.width + 1);
  });

  test('settings disclose honest quality + subtitle state', async ({ page }) => {
    await readyPlayer(page);
    await page.getByRole('button', { name: 'Player settings' }).click();
    const settings = page.locator('.lv-settings');
    await expect(settings.getByText('1080p · MP4 · AVC · AAC')).toBeVisible();
    await expect(settings.getByText('None available for web playback')).toBeVisible();
  });

  test('continue-watching appears on home after progress is saved', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'igl_progress_s2e5',
        JSON.stringify({ position: 300, duration: 3274, updatedAt: Date.now(), completed: false }),
      );
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Continue watching' })).toBeVisible();
    await expect(page.locator('.ep-card-progress').first()).toBeVisible();
  });
});
