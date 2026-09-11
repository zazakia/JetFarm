import { expect, type Page } from '@playwright/test';

const LOGIN_EMAIL_SELECTOR = 'input[type="email"]:not([data-testid])';
const LOGIN_PASSWORD_SELECTOR = 'input[type="password"]';
const DEFAULT_PASSWORD = '12345678';

export async function loginWithCredentials(page: Page, email: string, password = DEFAULT_PASSWORD) {
  await page.goto('/login');
  await page.waitForSelector(LOGIN_EMAIL_SELECTOR, { state: 'visible', timeout: 60000 });
  await page.locator(LOGIN_EMAIL_SELECTOR).fill(email);
  await page.locator(LOGIN_PASSWORD_SELECTOR).fill(password);
  await page.getByText('Sign In', { exact: false }).click();
  // Wait for the app to initialize and redirect away from login
  await expect(page).not.toHaveURL(/.*\/login.*/, { timeout: 30000 });
}

export async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, 'admin@poscursor.com');
  // Wait for the admin portal to be visible, potentially handling a redirect
  await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
}

export async function loginAsCollector(page: Page) {
  await loginWithCredentials(page, 'collector@poscursor.com');
  await expect(page.getByText(/Collector Portal|Collection Sheet/i).first()).toBeVisible({ timeout: 60000 });
}

export async function loginAsLoanEncoder(page: Page) {
  await loginWithCredentials(page, 'loan_encoder@poscursor.com');
  await expect(page.getByText('New Loan Entry', { exact: false })).toBeVisible({ timeout: 60000 });
}

export async function loginAsPaymentEncoder(page: Page) {
  await loginWithCredentials(page, 'payment_encoder@poscursor.com');
  await expect(page.getByTestId('page-title')).toHaveText(/Record.*Payment/i, { timeout: 60000 });
}

export async function safeNavigate(page: Page, url: string, targetSelectorOrText?: string | RegExp) {
  // Use client-side navigation if possible, or fallback to page.goto
  await page.evaluate((targetUrl) => {
    if (window && (window as any).router) {
      (window as any).router.push(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  }, url).catch(() => {
    return page.goto(url);
  });
  const pathPart = url.split('?')[0].replace(/^\//, '');
  if (pathPart && pathPart !== '(') {
    try {
      await page.waitForURL(u => u.pathname.includes(pathPart), { timeout: 15000 });
    } catch (e) {
      console.warn(`[safeNavigate] URL did not change to include "${pathPart}" within 15s. Current URL: ${page.url()}`);
    }
  }

  // If we see a loading screen, wait for it to disappear
  const loading = page.getByText(/Redirecting|Loading|Restoring/i);
  if (await loading.isVisible()) {
    await expect(loading).not.toBeVisible({ timeout: 30000 });
  }
  
  try {
    if (targetSelectorOrText) {
      if (typeof targetSelectorOrText === 'string' && (targetSelectorOrText.startsWith('#') || targetSelectorOrText.startsWith('.') || targetSelectorOrText.startsWith('['))) {
        await page.waitForSelector(targetSelectorOrText, { state: 'visible', timeout: 30000 });
      } else {
        // Use a more specific locator if possible to avoid matching dashboard buttons
        await expect(page.getByText(targetSelectorOrText).first()).toBeVisible({ timeout: 30000 });
      }
    } else {
      await page.waitForLoadState('networkidle');
    }
  } catch (e) {
    // If we were redirected to login, the test will likely fail anyway
    const isLogin = await page.locator(LOGIN_EMAIL_SELECTOR).isVisible();
    if (isLogin) {
      throw new Error(`Navigation to ${url} failed: Redirected to login page. Current URL: ${page.url()}`);
    }
    throw e;
  }
}

export async function expectLoginScreen(page: Page) {
  await page.waitForSelector(LOGIN_EMAIL_SELECTOR, { state: 'visible', timeout: 60000 });
  await expect(page.locator(LOGIN_EMAIL_SELECTOR)).toBeVisible();
  await expect(page.locator(LOGIN_PASSWORD_SELECTOR)).toBeVisible();
  await expect(page.getByText('Sign In', { exact: false })).toBeVisible();
}

