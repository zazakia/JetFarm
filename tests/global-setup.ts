import { chromium, type FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL || typeof baseURL !== 'string') {
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Expo web can return the HTML shell quickly while the initial synchronous
    // bundle request is still compiling. Going directly to the login route and
    // waiting for the email field avoids depending on auth redirects or
    // lower-priority controls that may appear later in the bootstrap.
    const loginURL = new URL('/login', baseURL).toString();
    await page.goto(loginURL, { waitUntil: 'commit', timeout: 120000 });
    await page.waitForSelector('input[type="email"]:not([data-testid])', {
      state: 'visible',
      timeout: 240000,
    });
  } finally {
    await browser.close();
  }
}

