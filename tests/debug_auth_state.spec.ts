import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './playwright-auth';

test('debug auth state and redirect', async ({ page }) => {
  await loginWithCredentials(page, 'cresencio.junco@poscursor.com');
  
  // Wait a bit for auth to process
  await page.waitForTimeout(5000);
  
  const authState = await page.evaluate(async () => {
    // We can't easily access the React state from here, but we can check localStorage/sessionStorage
    // Or just check if there's any redirect happening.
    return {
      url: window.location.href,
      localStorage: JSON.stringify(localStorage), // Supabase often stores session here
    };
  });
  
  console.log('Final URL:', authState.url);
  // console.log('LocalStorage:', authState.localStorage);
  
  await page.screenshot({ path: 'auth_state_debug.png' });
});

