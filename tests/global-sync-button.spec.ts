import { test, expect, type Page } from '@playwright/test';
import { expectLoginScreen, loginAsAdmin, loginAsExpensesEncoder } from './playwright-auth';

async function expectNoBottomOverlap(page: Page) {
  const syncButton = page.getByTestId('global-sync-button');
  const buttonBox = await syncButton.boundingBox();
  const viewport = page.viewportSize();
  expect(buttonBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(buttonBox!.y).toBeGreaterThanOrEqual(80);
  expect(buttonBox!.y).toBeLessThan(140);
  expect(buttonBox!.x + buttonBox!.width).toBeGreaterThan(viewport!.width - 140);
  expect(buttonBox!.y + buttonBox!.height).toBeLessThan(viewport!.height - 120);
}

test.describe('Global sync button', () => {
  test('is hidden before login', async ({ page }) => {
    await page.goto('/login');
    await expectLoginScreen(page);
    await expect(page.getByTestId('global-sync-button')).toHaveCount(0);
  });

  test('hides all sync chrome after admin login', async ({ page }) => {
    await loginAsAdmin(page);

    // Current product design: the floating GlobalSyncButton is hidden for admin
    // roles, and no SyncStatusIndicator is rendered inside the (admin) shell
    // (it only appears on the encoder portal).
    await expect(page.getByTestId('global-sync-button')).toHaveCount(0);
    await expect(page.getByTestId('sync-status-indicator')).toHaveCount(0);
  });

  for (const [role, login] of [
    ['expenses encoder', loginAsExpensesEncoder],
  ] as const) {
    test(`is available after ${role} login and can trigger manual sync`, async ({ page }) => {
      const unexpectedErrors: string[] = [];
      page.on('console', (message) => {
        const text = message.text();
        if (/internetReachability|ERR_CONNECTION_REFUSED|schema cache|borrower_id|Sync failed/i.test(text)) {
          if (!/realtime\/v1\/websocket/i.test(text)) {
            unexpectedErrors.push(text);
          }
        }
      });
      page.on('response', async (response) => {
        if (/\/rest\/v1\//.test(response.url()) && response.status() >= 400) {
          // Device heartbeat may 401 before E2E mock mode skips registry writes.
          if (/\/device_registry/i.test(response.url())) return;
          unexpectedErrors.push(`${response.status()} ${response.url()} ${(await response.text().catch(() => '')).slice(0, 160)}`);
        }
      });

      await login(page);

      const syncButton = page.getByTestId('global-sync-button');
      await expect(syncButton).toBeVisible({ timeout: 60000 });
      await expect(syncButton).toContainText(/Sync/i);
      await expectNoBottomOverlap(page);

      await syncButton.click();
      await expect(page).not.toHaveURL(/.*login.*/);
      await expect(
        syncButton.or(page.getByText('Sync Center', { exact: true }))
      ).toBeVisible({ timeout: 30000 });
      expect(unexpectedErrors).toEqual([]);
    });
  }
});

