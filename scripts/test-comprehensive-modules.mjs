import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  const dir = 'tests/screenshots';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[Console Error] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(`[Page Uncaught Error] ${err.message}`);
  });

  console.log('=== TESTING ON E2E SERVER (PORT 19119) ===');
  console.log('--- STEP 1: LOGIN FLOW & QUICK ACCESS ---');
  await page.goto('http://127.0.0.1:19119/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/port19119_step1_login.png' });

  // Click quick login as Admin
  console.log('Logging in as Admin User (admin@jetfarm.com)...');
  const adminCard = page.locator('text=admin@jetfarm.com').first();
  await adminCard.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tests/screenshots/port19119_step2_admin_portal.png' });
  console.log('Current URL after Admin login:', page.url());

  console.log('--- STEP 2: VERIFY ADMIN DASHBOARD & STATS ---');
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Dashboard content snippet:\n' + bodyText.slice(0, 300));

  // Test Navigating to Borrowers
  console.log('Testing Navigation to Borrowers...');
  await page.goto('http://127.0.0.1:19119/borrowers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/port19119_step3_borrowers.png' });
  console.log('Borrowers Page URL:', page.url());

  // Test Navigating to Loans
  console.log('Testing Navigation to Loans...');
  await page.goto('http://127.0.0.1:19119/loans', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/port19119_step4_loans.png' });
  console.log('Loans Page URL:', page.url());

  // Test Navigating to Accounting
  console.log('Testing Navigation to Accounting...');
  await page.goto('http://127.0.0.1:19119/accounting', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/port19119_step5_accounting.png' });
  console.log('Accounting Page URL:', page.url());

  // Test Navigating to Settings
  console.log('Testing Navigation to Settings...');
  await page.goto('http://127.0.0.1:19119/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/port19119_step6_settings.png' });
  console.log('Settings Page URL:', page.url());

  // Test Navigating to New Loan Entry
  console.log('Testing New Loan Entry form...');
  await page.goto('http://127.0.0.1:19119/loans/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/port19119_step7_new_loan.png' });
  console.log('New Loan URL:', page.url());

  console.log('--- STEP 3: COLLECTOR MODULE WORKFLOW ---');
  await page.goto('http://127.0.0.1:19119/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const collectorCard = page.locator('text=collector@jetfarm.com').first();
  if (await collectorCard.count() > 0) {
    await collectorCard.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'tests/screenshots/port19119_step8_collector.png' });
    console.log('Collector URL after login:', page.url());
  }

  console.log('--- STEP 4: EXPENSES ENCODER MODULE WORKFLOW ---');
  await page.goto('http://127.0.0.1:19119/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const encoderCard = page.locator('text=expen').first();
  if (await encoderCard.count() > 0) {
    await encoderCard.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'tests/screenshots/port19119_step9_expenses_encoder.png' });
    console.log('Expenses Encoder URL after login:', page.url());
  }

  console.log('--- VERIFICATION SUMMARY ---');
  console.log('Total Uncaught Errors:', errors.length);
  if (errors.length > 0) {
    console.log('Errors observed:', errors);
  } else {
    console.log('SUCCESS: All tested modules, routes, buttons and views rendered without runtime crashes!');
  }

  await browser.close();
}

main().catch(err => {
  console.error('Fatal script error:', err);
  process.exit(1);
});
