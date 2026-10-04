import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './playwright-auth';

test('debug logout button', async ({ page }) => {
  await loginWithCredentials(page, 'cresencio.junco@jetfarm.com');
  
  // Wait for dashboard
  await expect(page.getByText(/Collector Portal/i).first()).toBeVisible({ timeout: 30000 });
  
  // Screen dump of current data-testids
  const testids = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
  });
  console.log('Found TestIDs:', testids);
  
  const logoutBtn = page.getByTestId('logout-button');
  const isVisible = await logoutBtn.isVisible();
  console.log('Logout Button Visible:', isVisible);
  
  if (isVisible) {
    const box = await logoutBtn.boundingBox();
    console.log('Logout Button Bounding Box:', box);
    await logoutBtn.screenshot({ path: 'logout_btn_debug.png' });
  }
  
  await page.screenshot({ path: 'full_dashboard_debug.png' });
});

