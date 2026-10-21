import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';

test.describe('Admin Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdmin(page);
  });

  test('should display agribusiness admin dashboard with Agri-One Agribusiness heading', async ({ page }) => {
    await expect(page.getByTestId('admin-portal-title')).toBeVisible();
    await expect(page.getByText(/Agribusiness Dashboard|Operator Command Center/i).first()).toBeVisible();
  });

  test('should display agribusiness KPI stat cards', async ({ page }) => {
    const kpis = [
      'Managed Land',
      'Active Cycles',
      'Total Harvest',
      'Settlements Paid',
    ];

    for (const kpi of kpis) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible({ timeout: 30000 });
    }
  });

  test('should display quick operational hub buttons', async ({ page }) => {
    const actions = [
      'Weigh-in Scale',
      'Weekly Settlements',
      'Land Parcels',
      'GPS Mapping',
      'Planting Cycles',
      'Farm Labor',
      'Farm Expenses',
    ];

    for (const action of actions) {
      await expect(page.getByText(action, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('should navigate to Land Parcels when clicking Land Parcels', async ({ page }) => {
    await page.getByText(/Land Parcels/i).first().click({ force: true });
    await expect(page).toHaveURL(/.*parcels.*/, { timeout: 30000 });
  });

  test('should navigate to Planting Cycles when clicking Planting Cycles', async ({ page }) => {
    await page.getByText(/Planting Cycles/i).first().click({ force: true });
    await expect(page).toHaveURL(/.*cycles.*/, { timeout: 30000 });
  });
});
