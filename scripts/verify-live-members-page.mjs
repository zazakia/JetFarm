import { chromium } from 'playwright';

async function verifyMembersPage() {
  console.log('========================================================================');
  console.log('   VERIFYING LIVE MEMBERS LIST SEARCH FOR "ESPINOSA" ON jetfarm.pages.dev');
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

  console.log('2. Clicking Members tab in sidebar...');
  await page.locator('text=Members').first().click();
  await page.waitForTimeout(4000);

  console.log('3. Searching for "Espinosa" in Members SearchBar...');
  const searchInput = page.locator('input[placeholder*="Search name" i], input[placeholder*="phone" i]').first();
  if (await searchInput.count() > 0) {
    await searchInput.click();
    await searchInput.fill('Espinosa');
    await page.waitForTimeout(3000);
  } else {
    console.log('Could not find specific search input, finding input inside main view...');
    const allInputs = page.locator('input');
    for (let i = 0; i < await allInputs.count(); i++) {
      const ph = await allInputs.nth(i).getAttribute('placeholder');
      console.log(`Input ${i} placeholder:`, ph);
      if (ph && ph.toLowerCase().includes('search')) {
        await allInputs.nth(i).fill('Espinosa');
        await page.waitForTimeout(3000);
        break;
      }
    }
  }

  const pageText = await page.innerText('body');
  console.log('\n--- Live Filtered Members Text Output ---');
  console.log(pageText.substring(0, 1500));

  const espinosaLines = pageText.split('\n').filter(l => l.toUpperCase().includes('ESPINOSA'));
  console.log('\nMatching Lines for "ESPINOSA":', espinosaLines);

  await page.screenshot({ path: 'docs/images/live_verification_espinosa_filtered.png', fullPage: true });
  console.log('\nSaved full page screenshot to docs/images/live_verification_espinosa_filtered.png');

  await browser.close();
  console.log('\nLive browser verification complete!');
}

verifyMembersPage().catch(console.error);
