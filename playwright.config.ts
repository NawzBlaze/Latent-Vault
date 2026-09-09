import { defineConfig, devices } from '@playwright/test';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const PORT = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${PORT}`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    // Full Chromium (not the headless shell): required for H.264/AAC decode
    // in the real-playback tests.
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    {
      name: 'mobile-390',
      use: {
        channel: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: MOBILE_UA,
      },
      testIgnore: ['**/playback-redirect.spec.ts'],
    },
    {
      name: 'mobile-375',
      use: {
        channel: 'chromium',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        userAgent: MOBILE_UA,
      },
      testIgnore: ['**/playback-redirect.spec.ts', '**/watch.spec.ts'],
    },
  ],
});
