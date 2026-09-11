import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_PATH = 'C:/Users/HI/.gemini/antigravity/brain/09ae71e6-d919-4f53-aea0-ff803879f976/balance_sheet_2025.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  console.log('Navigating to app...');
  await page.goto('http://localhost:8081');

  // Attempt Quick Login
  try {
    console.log('Waiting for Quick Login button...');
    const quickLoginButton = page.locator('text=Quick Login (Dev)').first();
    await quickLoginButton.waitFor({ timeout: 5000 });
    await quickLoginButton.click();
    console.log('Quick Login clicked.');
  } catch (e) {
    console.log('Quick Login button not found, assuming already logged in or standard login required.');
  }

  // Wait for dashboard to load
  await page.waitForTimeout(3000);

  // Debug DB
  try {
    const keys = await page.evaluate(() => {
        return window.__WATERMELON_DB__ ? Object.keys(window.__WATERMELON_DB__.collections.map) : [];
    });
    console.log('WatermelonDB Collections: ', keys);
  } catch (e) {
    console.log('Error evaluating DB: ', e);
  }

  await browser.close();
  console.log('Screenshot saved to: ' + SCREENSHOT_PATH);
})();
