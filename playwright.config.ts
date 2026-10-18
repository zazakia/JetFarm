import { defineConfig, devices } from '@playwright/test';
import { isProductionSupabaseUrl } from './src/database/supabaseSafety';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
require('dotenv').config({ path: '.env.test' });
if (process.env.PLAYWRIGHT_ALLOW_LOCAL_ENV === '1') {
  require('dotenv').config({ path: '.env.local', override: false });
}

// 19129 is the dedicated default; the legacy shared 19119 is refused by the mapping
// specs because reuseExistingServer can hand them a stale bundle left there.
// See src/utils/e2ePortPolicy.ts.
const PLAYWRIGHT_WEB_PORT = process.env.PLAYWRIGHT_WEB_PORT || '19129';
const PLAYWRIGHT_WEB_URL = `http://127.0.0.1:${PLAYWRIGHT_WEB_PORT}`;

// Use test / local supabase URL
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:46421';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Mock-auth mode must be visible to the RUNNER, not just to the web-server child started
// below: specs assert it in their own process before signing in. webServer.env alone leaves
// a plain `npx playwright test` failing every spec precondition.
process.env.EXPO_PUBLIC_E2E_MODE = process.env.EXPO_PUBLIC_E2E_MODE || '1';

if (!process.env.PLAYWRIGHT_ALLOW_PRODUCTION_DB && isProductionSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL)) {
  throw new Error(
    `\n❌ SAFETY BREACH: Playwright tests are attempting to use the PRODUCTION database!\n` +
    `Current URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL}\n` +
    `Please set PLAYWRIGHT_ALLOW_PRODUCTION_DB=1 to bypass.\n`
  );
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 1,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  timeout: 120000,
  expect: {
    timeout: 30000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: PLAYWRIGHT_WEB_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'node scripts/start-playwright-web.mjs',
    url: PLAYWRIGHT_WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 600000,
    env: {
      PLAYWRIGHT_WEB_PORT,
      EXPO_PUBLIC_E2E_MODE: '1',
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:46421',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      NODE_ENV: 'test',
    },
  },
});
