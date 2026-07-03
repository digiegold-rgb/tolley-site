import { defineConfig, devices } from '@playwright/test';

/**
 * Vater v2 e2e — first Playwright config in the repo.
 *
 * Targets the Vercel prod deployment by default (PLAYWRIGHT_BASE_URL).
 * For a local run, point this at http://localhost:3000 with `next dev`
 * already running.
 *
 * Storage state is opt-in via PLAYWRIGHT_STORAGE_STATE — when present we
 * load it so the spec can skip the login UI. Otherwise the spec falls
 * back to a credentialed login flow driven by PLAYWRIGHT_TEST_USER /
 * PLAYWRIGHT_TEST_PASSWORD.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://tolley.io';
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  // The vater pipeline can take minutes per step. Generous timeouts.
  timeout: 15 * 60 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    storageState,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
