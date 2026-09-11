import { chromium } from 'playwright';

async function verifyLiveEspinosa() {
  console.log('========================================================================');
  console.log('   EVALUATING DOM & REACT NATIVE WEB STATE FOR ESPINOSA ON jetfarm.pages.dev');
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

  console.log('2. Navigating to Members list...');
  await page.locator('text=Members').first().click();
  await page.waitForTimeout(4000);

  // Evaluate all text nodes inside table / list elements
  const allCellTexts = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements
      .map(el => el.innerText)
      .filter(txt => txt && txt.toUpperCase().includes('ESPINOSA'));
  });

  console.log('\n--- DOM Text Nodes matching ESPINOSA ---');
  console.log(allCellTexts);

  // Check if search input can be typed into directly
  console.log('\n3. Searching for "PAUL C. ESPINOSA"...');
  const searchInput = page.locator('input').filter({ hasNotText: 'admin' }).first();
  if (await searchInput.count() > 0) {
    await searchInput.focus();
    await searchInput.fill('PAUL C. ESPINOSA');
    await page.waitForTimeout(3000);
  }

  const filteredText = await page.innerText('body');
  console.log('\n--- Filtered Body Text ---');
  console.log(filteredText.substring(0, 1500));

  await page.screenshot({ path: 'docs/images/live_verification_espinosa_dom.png', fullPage: true });
  console.log('\nSaved full page screenshot to docs/images/live_verification_espinosa_dom.png');

  await browser.close();
  console.log('\nLive DOM verification complete!');
}

verifyLiveEspinosa().catch(console.error);
