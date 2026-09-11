import { chromium } from 'playwright';

async function verifyLiveBrowser() {
  console.log('========================================================================');
  console.log('   PLAYWRIGHT LIVE BROWSER VERIFICATION FOR https://jetfarm.pages.dev');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Navigating to https://jetfarm.pages.dev...');
  await page.goto('https://jetfarm.pages.dev', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('2. Entering admin credentials...');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('admin@jetfarm.com');
  await inputs.nth(1).fill('12345678');

  console.log('3. Clicking SIGN IN button...');
  const signInBtn = page.locator('text=SIGN IN').first();
  await signInBtn.click();

  await page.waitForTimeout(6000);

  console.log('\n4. Current URL after login:', page.url());
  let bodyText = await page.innerText('body');
  console.log('\n--- Page Text Snippet ---');
  console.log(bodyText.substring(0, 1000));

  await page.screenshot({ path: 'docs/images/live_verification_result.png', fullPage: true });
  console.log('\nSaved full page screenshot to docs/images/live_verification_result.png');

  await browser.close();
  console.log('\nBrowser verification script complete!');
}

verifyLiveBrowser().catch(console.error);
