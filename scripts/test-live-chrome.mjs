import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  const dir = 'tests/screenshots';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGE_ERR] ${err.message}`));

  console.log('Navigating directly to http://localhost:8085/login...');
  await page.goto('http://localhost:8085/login', { waitUntil: 'networkidle', timeout: 45000 });
  
  // Wait up to 10s for login input
  try {
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i], input', { timeout: 10000 });
  } catch (e) {}

  console.log('Page Title:', await page.title());
  console.log('Current URL:', page.url());

  const bodySnippet = await page.evaluate(() => document.body.innerText);
  console.log('Body snippet:\n' + bodySnippet.slice(0, 500));

  await page.screenshot({ path: 'tests/screenshots/live_web_login.png' });
  console.log('Saved screenshot to tests/screenshots/live_web_login.png');

  console.log('Console logs:');
  console.log(consoleLogs.filter(l => !l.includes('Download the React DevTools')).join('\n'));

  await browser.close();
}

main().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
