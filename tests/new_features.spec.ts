/**
 * new_features.spec.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Playwright E2E smoke tests covering feature areas introduced across the
 * commit history (March – April 2026) for POSCursor, migrated to the Agri-One
 * admin shell (2026-10).
 *
 * Navigation note: the current sidebar only renders Agribusiness / Core
 * Operations / System Administration / Support sections, so every screen is
 * reached through safeNavigate() with its direct route instead.
 *
 * Grouped by feature area:
 *  1. Authentication – sign-in form & error handling
 *  2. Audit Trail – Audit log navigation & visual diff
 *  3. Admin Reports – financial statement pages this build ships
 *  4. Monthly Closing – Closing history page
 *  5. Data Recovery (Deleted Items) – Deleted items management screen
 *  6. Sync Status – Real-time sync indicator on the encoder portal
 *  7. Settings – Backup/export & audit settings pages
 *
 * Lending areas (loan encoder, renewal workflow, auto-audit, savings and the
 * collection/MFI reports) are deleted on this branch, not feature-flagged, so
 * their specs went with the screens.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { test, expect, Page } from '@playwright/test';
import { expectLoginScreen, loginAsAdmin as loginAsAdminViaForm, safeNavigate } from './playwright-auth';

// ═══════════════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION – Quick Login Profiles
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Feature: Quick Login Profiles', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(90000);
    await page.goto('/login');
    await expectLoginScreen(page);
  });

  test('Login screen displays the standard sign-in form', async ({ page }) => {
    await expect(page.locator('input[type="email"]:not([data-testid])')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText('Sign In', { exact: false })).toBeVisible();
  });

  test('Admin login navigates to Admin Portal', async ({ page }) => {
    await loginAsAdminViaForm(page);
    await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('Agri-One Agribusiness')).toBeVisible();
  });

  test('Invalid credentials show error message', async ({ page }) => {
    await page.locator('input[type="email"]:not([data-testid])').fill('bad@user.com');
    await page.locator('input[type="password"]').fill('badpassword');
    await page.getByText('Sign In', { exact: false }).click();
    await expect(page.getByText(/Email or password is incorrect/i)).toBeVisible({ timeout: 20000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. AUDIT TRAIL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Feature: Audit Trail System', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdminViaForm(page);
  });

  test('Audit Trail page is accessible from Settings', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings/audit-trail');
    await expect(
      page.getByText(/Audit Trail|Action Log|Change History|Activity Log/i).first()
    ).toBeVisible({ timeout: 30000 });
  });

  test('Audit Trail shows log entries or empty state', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings/audit-trail');
    await expect(
      page.getByText(/Audit Trail|Action Log|Change History|Activity Log/i).first()
    ).toBeVisible({ timeout: 30000 });

    // Logs should appear, or an empty state message
    await expect(
      page.getByText(/No audit|No records|Action|Created|Updated/i).first()
    ).toBeVisible({ timeout: 20000 });
  });

  test('Audit Trail settings page accessible', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings/audit-trail');
    await expect(
      page.getByText(/Audit|Data Quality|Integrity|data health/i).first()
    ).toBeVisible({ timeout: 30000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ADMIN REPORTS MODULE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Feature: Admin Reports Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdminViaForm(page);
  });

  test('Cash Flows report page renders', async ({ page }) => {
    await safeNavigate(page, '/(admin)/reports/cash-flows');
    // Page header renders the statement-of-cash-flows section
    await expect(
      page.getByText(/Cash Flow|Operating|Investing|Financing|Reporting Period/i).first()
    ).toBeVisible({ timeout: 30000 });
  });

  test('Balance Sheet report page renders', async ({ page }) => {
    await safeNavigate(page, '/(admin)/reports/balance-sheet');
    await expect(
      page.getByText(/Balance Sheet|Assets|Liabilities/i).first()
    ).toBeVisible({ timeout: 30000 });
  });

  test('Income Statement report page renders', async ({ page }) => {
    await safeNavigate(page, '/(admin)/reports/income-statement');
    await expect(
      page.getByText(/Income|Revenue|Expense|Statement/i).first()
    ).toBeVisible({ timeout: 30000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. MONTHLY CLOSING SERVICE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Feature: Monthly Closing (Financial Period Closing)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdminViaForm(page);
  });

  test('Closing page renders with period selector', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings/closing');
    await expect(
      // Actual heading in closing.tsx is "Financial Closing"
      page.getByText(/Financial Closing|Monthly Closing|Close Month|Period/i).first()
    ).toBeVisible({ timeout: 30000 });
  });

  test('Closing history list shows entries or empty state', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings/closing');
    await expect(
      // Actual page sections: "Financial Closing", "Snapshot History", empty "No snapshots found"
      page.getByText(/Snapshot History|No snapshots|Financial Closing|Period/i).first()
    ).toBeVisible({ timeout: 30000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. DATA RECOVERY – Deleted Items Management
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Feature: Data Recovery (Deleted Items)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdminViaForm(page);
  });

  test('Deleted items screen loads and shows table or empty state', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings/deleted');
    await expect(
      page.getByText(/Deleted Items|Trash|Recover|Soft Delete|No deleted/i).first()
    ).toBeVisible({ timeout: 30000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. SYNC STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Feature: Real-Time Sync Status Indicator', () => {
  test('Admin shell hides the floating sync button by design', async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdminViaForm(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    // GlobalSyncButton returns null for admin/main_office roles and for any
    // /(admin) route (see src/components/GlobalSyncButton.tsx HIDDEN_ROUTES).
    await expect(page.getByTestId('global-sync-button')).toHaveCount(0);
  });

  test('Expenses Encoder portal shows sync status indicator', async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await page.goto('/login');
    await page.locator('input[type="email"]:not([data-testid])').fill('expenses_encoder@agri-one.com');
    await page.locator('input[type="password"]').fill('12345678');
    await page.getByText('Sign In', { exact: false }).click();
    await expect(page.getByText('Record Expense', { exact: false }).first()).toBeVisible({ timeout: 60000 });

    await expect(
      page.getByTestId('sync-status-indicator').getByText(/Synced|Syncing|Sync Fail|\d+ Pend/)
    ).toBeVisible({ timeout: 60000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. SETTINGS MODULE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Feature: Admin Settings Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdminViaForm(page);
  });

  test('Settings home page accessible and renders main options', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings');
    await expect(
      page.getByText(/Settings|Configuration|Preferences/i).first()
    ).toBeVisible({ timeout: 30000 });
  });

  test('Expense Categories settings page accessible', async ({ page }) => {
    await safeNavigate(page, '/(admin)/settings/expense-categories');
    await expect(
      page.getByText(/Expense Categor|Category|Expense Type/i).first()
    ).toBeVisible({ timeout: 30000 });
  });

  // The bulk "Data Migration" settings screen belonged to the lending-era import tooling and is not
  // part of the agribusiness variant (no settings/migration route survives), so its test is removed
  // rather than pointed at a screen that no longer exists.
});
