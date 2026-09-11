import { chromium } from 'playwright';

async function runSmokeTest(url) {
  console.log(`\n=== Starting smoke test for: ${url} ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const results = { url, logs: [], errors: [] };
  page.on('console', msg => results.logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => results.errors.push(err.message));

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`HTTP Status: ${response.status()}`);
    
    // Wait for React Native Web SPA hydration
    await page.waitForTimeout(5000);

    const title = await page.title();
    console.log(`Page Title: "${title}"`);

    // Check headings / text
    const textContent = await page.content();
    const hasPoscursorBrand = textContent.toLowerCase().includes('jetfarm') || textContent.toLowerCase().includes('coop') || textContent.toLowerCase().includes('infinity');
    console.log(hasPoscursorBrand ? '✅ Brand text detected on page' : '⚠️ Brand text check warning');

    // Verify input fields
    const inputs = await page.locator('input').count();
    console.log(`Input fields detected: ${inputs}`);

    // Verify buttons / quick login elements
    const buttons = await page.locator('[role="button"], button').count();
    console.log(`Interactive buttons detected: ${buttons}`);

    // Check runtime JS errors
    if (results.errors.length === 0) {
        console.log('✅ Zero JavaScript page errors');
    } else {
        console.log(`❌ Page errors (${results.errors.length}):`, results.errors);
    }

    const hostClean = new URL(url).hostname.replace(/\./g, '_');
    const screenshotPath = `docs/images/smoke-test-${hostClean}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved to ${screenshotPath}`);
  } catch (err) {
    console.log(`❌ Smoke test error: ${err.message}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  await runSmokeTest('https://jetfarm.pages.dev');
  await runSmokeTest('https://bf29e013.jetfarm.pages.dev');
})();
