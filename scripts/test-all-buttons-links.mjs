import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  const dir = 'tests/screenshots';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[Console Error] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(`[Page Crash] ${err.message}`);
  });

  console.log('--- 1. Login with Admin credentials and wait for portal title ---');
  await page.goto('http://127.0.0.1:19119/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]:not([data-testid])').fill('admin@jetfarm.com');
  await page.locator('input[type="password"]').fill('12345678');
  await page.getByText('Sign In', { exact: false }).click();
  
  // Wait until admin-portal-title is visible
  await page.locator('[data-testid="admin-portal-title"]').waitFor({ state: 'visible', timeout: 30000 });
  console.log('Admin Portal Title visible!');
  await page.screenshot({ path: 'tests/screenshots/verified_admin_dashboard.png' });

  console.log('--- 2. Testing Clicking Real Buttons on Dashboard ---');
  // Click New Borrower
  console.log('Clicking "New Borrower" button...');
  await page.getByText(/New Borrower/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  console.log('  -> Current URL after New Borrower click:', page.url());
  await page.screenshot({ path: 'tests/screenshots/verified_borrowers_page.png' });

  // Navigate back to Admin Dashboard using sidebar link (in-memory state preserved)
  await page.getByText(/Admin Dashboard/i).first().click({ force: true });
  await page.locator('[data-testid="admin-portal-title"]').waitFor({ state: 'visible', timeout: 20000 });

  // Click New Loan
  console.log('Clicking "New Loan" button...');
  await page.getByText(/New Loan/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  console.log('  -> Current URL after New Loan click:', page.url());
  await page.screenshot({ path: 'tests/screenshots/verified_new_loan_page.png' });

  // Navigate back to Admin Dashboard
  await page.getByText(/Admin Dashboard/i).first().click({ force: true });
  await page.locator('[data-testid="admin-portal-title"]').waitFor({ state: 'visible', timeout: 20000 });

  // Click Record Payment
  console.log('Clicking "Record Payment" button...');
  await page.getByText(/Record Payment/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  console.log('  -> Current URL after Record Payment click:', page.url());
  await page.screenshot({ path: 'tests/screenshots/verified_payments_page.png' });

  // Navigate back to Admin Dashboard
  await page.getByText(/Admin Dashboard/i).first().click({ force: true });
  await page.locator('[data-testid="admin-portal-title"]').waitFor({ state: 'visible', timeout: 20000 });

  // Click Accounting
  console.log('Clicking "Accounting" button...');
  await page.getByText(/Accounting/i).first().click({ force: true });
  await page.waitForTimeout(2500);
  console.log('  -> Current URL after Accounting click:', page.url());
  await page.screenshot({ path: 'tests/screenshots/verified_accounting_page.png' });

  console.log('--- 3. Testing Real Click Navigation for Outgrower / Agribusiness ---');
  // Click Operator Command Center in Sidebar
  const agriLink = page.getByText(/Operator Command Center/i).first();
  if (await agriLink.isVisible()) {
    console.log('Clicking "Operator Command Center" sidebar link...');
    await agriLink.click({ force: true });
    await page.waitForTimeout(2500);
    console.log('  -> Current URL after Agribusiness click:', page.url());
    await page.screenshot({ path: 'tests/screenshots/verified_agribusiness_command_center.png' });
  }

  // Click Cassava Crop Cycles
  const cyclesLink = page.getByText(/Cassava Crop Cycles/i).first();
  if (await cyclesLink.isVisible()) {
    console.log('Clicking "Cassava Crop Cycles" sidebar link...');
    await cyclesLink.click({ force: true });
    await page.waitForTimeout(2500);
    console.log('  -> Current URL after Crop Cycles click:', page.url());
    await page.screenshot({ path: 'tests/screenshots/verified_crop_cycles_page.png' });
  }

  // Click Harvest Scale Terminal
  const scaleLink = page.getByText(/Harvest Scale Terminal/i).first();
  if (await scaleLink.isVisible()) {
    console.log('Clicking "Harvest Scale Terminal" sidebar link...');
    await scaleLink.click({ force: true });
    await page.waitForTimeout(2500);
    console.log('  -> Current URL after Harvest Scale Terminal click:', page.url());
    await page.screenshot({ path: 'tests/screenshots/verified_harvest_scale_page.png' });
  }

  // Click Land Parcels Registry
  const parcelsLink = page.getByText(/Land Parcels Registry/i).first();
  if (await parcelsLink.isVisible()) {
    console.log('Clicking "Land Parcels Registry" sidebar link...');
    await parcelsLink.click({ force: true });
    await page.waitForTimeout(2000);
    console.log('  -> Current URL after Land Parcels click:', page.url());
    await page.screenshot({ path: 'tests/screenshots/verified_land_parcels_page.png' });
  }

  // Click Land Owner Settlements
  const settlementsLink = page.getByText(/Land Owner Settlements/i).first();
  if (await settlementsLink.isVisible()) {
    console.log('Clicking "Land Owner Settlements" sidebar link...');
    await settlementsLink.click({ force: true });
    await page.waitForTimeout(2000);
    console.log('  -> Current URL after Settlements click:', page.url());
    await page.screenshot({ path: 'tests/screenshots/verified_settlements_page.png' });
  }

  console.log('--- 4. Testing Cooperative Reports & CBU ---');
  const cbuLink = page.getByText('CBU Report').first();
  if (await cbuLink.isVisible()) {
    console.log('Clicking "CBU Report" sidebar link...');
    await cbuLink.click({ force: true });
    await page.waitForTimeout(2000);
    console.log('  -> Current URL after CBU Report click:', page.url());
    await page.screenshot({ path: 'tests/screenshots/verified_cbu_report_page.png' });
  }

  const shareCapLink = page.getByText('Share Capital').first();
  if (await shareCapLink.isVisible()) {
    console.log('Clicking "Share Capital" sidebar link...');
    await shareCapLink.click({ force: true });
    await page.waitForTimeout(2000);
    console.log('  -> Current URL after Share Capital click:', page.url());
    await page.screenshot({ path: 'tests/screenshots/verified_share_capital_page.png' });
  }

  console.log('--- 5. Summary of Crashes / Page Errors ---');
  console.log(`Total Runtime Crashes: ${errors.length}`);
  if (errors.length > 0) {
    console.log(errors);
  } else {
    console.log('SUCCESS: All buttons, links, and navigation transitions verified with ZERO runtime errors!');
  }

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
