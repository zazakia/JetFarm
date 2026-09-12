import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:19119/login');
  await page.locator('input[type="email"]:not([data-testid])').fill('admin@jetfarm.com');
  await page.locator('input[type="password"]').fill('12345678');
  await page.getByText('Sign In', { exact: false }).click();
  await page.locator('[data-testid="admin-portal-title"]').waitFor({ state: 'visible', timeout: 30000 });

  const res = await page.evaluate(() => {
    const db = window.__WATERMELON_DB__;
    if (!db) return { error: 'No db on window' };
    try {
      const col = db.get('agri_parcels');
      return {
        hasCol: !!col,
        colQuery: typeof col?.query,
        collections: Object.keys(db.collections.map || {})
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Result after admin login:', JSON.stringify(res, null, 2));
  await browser.close();
}

main().catch(console.error);
