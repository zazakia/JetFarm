import { chromium } from 'playwright';

async function verifyLiveAccounting() {
  console.log('========================================================================');
  console.log('   LIVE BROWSER VERIFICATION FOR JOURNAL ENTRIES & TRIAL BALANCE');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('1. Logging in as Admin...');
  await page.goto('https://jetfarm.pages.dev', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const inputs = page.locator('input');
  await inputs.nth(0).fill('admin@jetfarm.com');
  await inputs.nth(1).fill('12345678');
  await page.locator('text=SIGN IN').first().click();
  await page.waitForTimeout(5000);

  console.log('2. Clicking Journal Entries link...');
  const jeTab = page.locator('text=Journal Entries').first();
  if (await jeTab.count() > 0) {
    await jeTab.click();
    await page.waitForTimeout(4000);
  }

  const jeText = await page.innerText('body');
  console.log('\n--- Journal Entries Page Text ---');
  console.log(jeText.substring(0, 1500));

  console.log('\n3. Clicking Trial Balance link...');
  const tbTab = page.locator('text=Trial Balance').first();
  if (await tbTab.count() > 0) {
    await tbTab.click();
    await page.waitForTimeout(4000);
  }

  const tbText = await page.innerText('body');
  console.log('\n--- Trial Balance Page Text ---');
  console.log(tbText.substring(0, 1500));

  await page.screenshot({ path: 'docs/images/live_verification_trial_balance.png', fullPage: true });
  console.log('\nSaved screenshot to docs/images/live_verification_trial_balance.png');

  await browser.close();
  console.log('\nLive accounting verification complete!');
}

verifyLiveAccounting().catch(console.error);
