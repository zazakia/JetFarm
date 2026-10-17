import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Land Parcels Registry + Cassava Crop Cycles edit/delete E2E (web build).
 *
 * Covers the client request of 2026-10-16 ("Asa mag edit or delete sa mga Land
 * Parcels Registries ug Cassava Crop Cycle? apil sa logs kung masayop") on the
 * surface the client actually uses. Jest screen tests prove the wiring; this
 * spec proves the real react-native-web build renders the actions, that the
 * ConfirmDialog (not the web no-op Alert.alert) carries the confirmation, and
 * that the financial-history guard reaches the operator as a readable message.
 */

const PARCELS_ROUTE = '/agribusiness/parcels';
const CYCLES_ROUTE = '/agribusiness/cycles';

const stamp = Date.now().toString().slice(-6);

async function openParcels(page: Page) {
  await loginAsAdmin(page);
  await safeNavigate(page, PARCELS_ROUTE, 'Track land parcels, acreage, soil quality');
}

/** Registers a parcel through the real UI and returns its id. */
async function createParcel(page: Page, name: string): Promise<string> {
  await page.getByTestId('register-parcel-button').click();
  await page.getByTestId('parcel-name-input').fill(name);
  await page.getByTestId('parcel-code-input').fill(`E2E-${stamp}`);
  await page.getByTestId('landowner-name-input').fill(`E2E Owner ${stamp}`);
  await page.getByTestId('parcel-area-input').fill('3.5');
  await page.getByTestId('save-parcel-button').click();

  await expect(page.getByTestId('parcel-name-input')).toHaveCount(0);
  const card = page.locator('[data-testid^="parcel-card-"]').filter({ hasText: name }).first();
  await expect(card).toBeVisible();

  const testId = await card.getAttribute('data-testid');
  if (!testId || !testId.startsWith('parcel-card-')) {
    throw new Error(`Parcel card is missing its data-testid (got ${String(testId)})`);
  }
  return testId.replace('parcel-card-', '');
}

/** Starts a cassava cycle on the parcel whose chip matches `parcelName`. */
async function createCycle(page: Page, parcelName: string) {
  await safeNavigate(page, CYCLES_ROUTE, 'Cassava Planting Cycles');
  await page.getByText(/Start New Cycle/i).first().click();

  await page.getByText(`${parcelName} (3.5 ha)`).first().click();
  await page.getByPlaceholder('Golden Yellow, KU-50, Lakan').fill(`Bayong ${stamp}`);
  await page.getByPlaceholder('e.g. 3.0').fill('2.5');
  await page.getByText(/Start Cycle/i).last().click();

  const editButton = page.locator('[data-testid^="cycle-edit-"]').first();
  await expect(editButton).toBeVisible({ timeout: 30000 });
}

test.describe('Agribusiness registry CRUD (parcels + crop cycles)', () => {
  test('edits a registered parcel and shows the corrected values on the card', async ({ page }) => {
    await openParcels(page);
    const name = `E2E Editable ${stamp}`;
    const id = await createParcel(page, name);

    await page.getByTestId(`parcel-edit-${id}`).click();
    await expect(page.getByTestId('parcel-name-input')).toHaveValue(name);

    await page.getByTestId('parcel-name-input').fill(`E2E Edited ${stamp}`);
    await page.getByTestId('parcel-area-input').fill('7.25');
    await page.getByTestId('save-parcel-button').click();

    await expect(page.getByTestId('parcel-name-input')).toHaveCount(0);
    const updated = page.locator(`[data-testid="parcel-card-${id}"]`);
    await expect(updated).toContainText(`E2E Edited ${stamp}`, { timeout: 30000 });
    await expect(updated).toContainText('7.25');
  });

  test('locks the landowner while editing so contract terms cannot be reassigned', async ({ page }) => {
    await openParcels(page);
    const id = await createParcel(page, `E2E Locked Owner ${stamp}`);

    await page.getByTestId(`parcel-edit-${id}`).click();

    await expect(page.getByTestId('landowner-name-input')).not.toBeEditable();
    await expect(page.getByText(/stay locked/i)).toBeVisible();
  });

  test('deletes a parcel through the confirmation dialog and removes it from the registry', async ({ page }) => {
    await openParcels(page);
    const name = `E2E Deletable ${stamp}`;
    const id = await createParcel(page, name);

    await page.getByTestId(`parcel-delete-${id}`).click();
    await expect(page.getByTestId('confirm-dialog-title')).toHaveText('Delete Land Parcel');
    await page.getByTestId('confirm-dialog-confirm').click();

    await expect(page.locator(`[data-testid="parcel-card-${id}"]`)).toHaveCount(0, { timeout: 30000 });
  });

  test('blocks deleting a parcel that still carries an active cycle and explains why', async ({ page }) => {
    const name = `E2E Guarded ${stamp}`;
    await openParcels(page);
    const id = await createParcel(page, name);
    await createCycle(page, name);

    await safeNavigate(page, PARCELS_ROUTE, 'Track land parcels, acreage, soil quality');
    await expect(page.locator(`[data-testid="parcel-card-${id}"]`)).toBeVisible();

    await page.getByTestId(`parcel-delete-${id}`).click();
    await page.getByTestId('confirm-dialog-confirm').click();

    await expect(page.getByTestId('confirm-dialog-title')).toHaveText('Cannot Delete Parcel');
    await expect(page.getByTestId('confirm-dialog-message')).toContainText(/active crop cycle/i);
    await expect(page.locator(`[data-testid="parcel-card-${id}"]`)).toBeVisible();
  });

  test('edits and deletes a crop cycle that has no financial history', async ({ page }) => {
    const name = `E2E Cycle CRUD ${stamp}`;
    await openParcels(page);
    await createParcel(page, name);
    await createCycle(page, name);

    const editButton = page.locator('[data-testid^="cycle-edit-"]').first();
    const cycleId = (await editButton.getAttribute('data-testid'))!.replace('cycle-edit-', '');

    await editButton.click();
    await expect(page.getByTestId('edit-cycle-variety-input')).toHaveValue(`Bayong ${stamp}`);
    await page.getByTestId('edit-cycle-variety-input').fill(`KU-50 ${stamp}`);
    await page.getByTestId('save-cycle-edit-button').click();
    await expect(page.getByTestId('edit-cycle-variety-input')).toHaveCount(0);
    await expect(page.locator(`[data-testid="cycle-edit-${cycleId}"]`)).toBeVisible();

    await page.getByTestId(`cycle-delete-${cycleId}`).click();
    await expect(page.getByTestId('confirm-dialog-title')).toHaveText('Delete Crop Cycle');
    await page.getByTestId('confirm-dialog-confirm').click();

    await expect(page.locator(`[data-testid="cycle-edit-${cycleId}"]`)).toHaveCount(0, { timeout: 30000 });
  });
});
