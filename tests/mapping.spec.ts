import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * GPS Boundary Mapping module E2E (web build).
 *
 * Covers what the Jest screen tests cannot: the real react-leaflet map mounting
 * inside the exported bundle, vertices rendering as an interactive SVG polygon,
 * the cross-platform ConfirmDialog flow (`Alert.alert` is a no-op on
 * react-native-web), and boundary persistence across screen navigation.
 *
 * The suite is self-contained: local web E2E mode signs in through
 * AuthService.quickSignIn with a local session, so remote rows are never synced
 * into the browser. Each test registers its own parcels through the parcels
 * screen, which also keeps the spec honest about the real operator entry point.
 */

const MAPPING_ROUTE = '/agribusiness/mapping';
const PARCELS_ROUTE = '/agribusiness/parcels';

const BUKIDNON_VERTICES: Array<[string, string]> = [
  ['8.364043', '124.864014'],
  ['8.369357', '124.864014'],
  ['8.369357', '124.869386'],
];

async function openParcelsScreen(page: Page) {
  // loginAsAdmin already clears the first-run onboarding tour overlay.
  await loginAsAdmin(page);
  await safeNavigate(page, PARCELS_ROUTE, 'Land Parcels Registry');
}

/** Registers a parcel through the real UI and returns its WatermelonDB id. */
async function createParcel(page: Page, name: string, code: string): Promise<string> {
  await page.getByTestId('register-parcel-button').click();

  await page.getByTestId('parcel-name-input').fill(name);
  await page.getByTestId('parcel-code-input').fill(code);
  await page.getByTestId('landowner-name-input').fill('E2E Landowner');
  await page.getByTestId('parcel-area-input').fill('4.2');
  await page.getByTestId('save-parcel-button').click();

  // The modal closes on success and the card appears in the registry.
  await expect(page.getByTestId('parcel-name-input')).toHaveCount(0);
  const card = page.locator('[data-testid^="parcel-card-"]').filter({ hasText: name }).first();
  await expect(card).toBeVisible();

  const testId = await card.getAttribute('data-testid');
  if (!testId || !testId.startsWith('parcel-card-')) {
    throw new Error(`Parcel card is missing its data-testid (got ${String(testId)})`);
  }
  return testId.replace('parcel-card-', '');
}

/** Login, register `parcelCount` parcels (name → id), then open the mapping screen. */
async function seedParcels(page: Page, count = 1): Promise<Record<string, string>> {
  await openParcelsScreen(page);
  const ids: Record<string, string> = {};
  for (let i = 1; i <= count; i++) {
    const name = `E2E Parcel ${i}`;
    ids[name] = await createParcel(page, name, `E2EP-${i}`);
  }
  return ids;
}

async function openMappingScreen(page: Page, parcelCount = 1): Promise<Record<string, string>> {
  const ids = await seedParcels(page, parcelCount);

  // A target text is required: safeNavigate otherwise waits for 'networkidle',
  // which never settles here because the live OpenStreetMap layer keeps
  // requesting tiles.
  await safeNavigate(page, MAPPING_ROUTE, 'GPS Boundary Mapping');
  await expect(page.locator('[data-testid^="parcel-chip-"]').first()).toBeVisible();
  return ids;
}

const vertexRows = (page: Page) => page.locator('[data-testid^="remove-vertex-"]');
const vertexCount = (page: Page) => vertexRows(page).count();

async function dialogTitle(page: Page): Promise<string> {
  return (await page.getByTestId('confirm-dialog-title').textContent())?.trim() ?? '';
}

async function addVertex(page: Page, lat: string, lon: string) {
  await page.getByPlaceholder('Latitude (e.g. 8.3512)').fill(lat);
  await page.getByPlaceholder('Longitude (e.g. 124.8621)').fill(lon);
  await page.getByTestId('add-vertex').click();
}

async function addTriangle(page: Page) {
  for (const [lat, lon] of BUKIDNON_VERTICES) {
    await addVertex(page, lat, lon);
  }
  await expect.poll(() => vertexCount(page)).toBe(3);
}

async function acknowledgeDialog(page: Page) {
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
}

test.describe('GPS Boundary Mapping', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    await page.setDefaultTimeout(30000);
  });

  test('mounts the live map and saves a manually captured boundary', async ({ page }) => {
    await openMappingScreen(page);

    // A real Leaflet map replaces the old static "shape preview" placeholder.
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText('Shoelace Geodesic Projection')).toHaveCount(0);

    // A brand-new parcel has no boundary yet.
    await expect(page.getByTestId('empty-boundary-state')).toBeVisible();
    expect(await vertexCount(page)).toBe(0);

    await addTriangle(page);

    // The polygon only appears once the boundary can close.
    await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toBeVisible();
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    await expect(page.getByText(/Auto-Calculated Perimeter Area/i).first()).toBeVisible();
    // Area is derived from the vertices, never typed in.
    await expect(page.getByText(/\d+\.\d{4}/).first()).toBeVisible();

    await page.getByTestId('save-boundary').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    expect(await dialogTitle(page)).toBe('Boundary Saved');
    await expect(page.getByTestId('confirm-dialog-message')).toContainText('3 GPS vertices');
    await acknowledgeDialog(page);
    await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);

    await page.screenshot({ path: 'docs/images/mapping-boundary-saved.png', fullPage: true });
    // Close-up of the rendered polygon for the module docs.
    await page.locator('.leaflet-container').screenshot({ path: 'docs/images/mapping-polygon.png' });
  });

  test('rejects an out-of-range coordinate with inline feedback', async ({ page }) => {
    await openMappingScreen(page);

    await addVertex(page, '999', '124.86');
    await expect(page.getByTestId('vertex-input-error')).toBeVisible();
    expect(await vertexCount(page)).toBe(0);
    await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);

    // Fixing the value clears the error and appends the vertex.
    await addVertex(page, BUKIDNON_VERTICES[0][0], BUKIDNON_VERTICES[0][1]);
    await expect(page.getByTestId('vertex-input-error')).toHaveCount(0);
    await expect.poll(() => vertexCount(page)).toBe(1);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
  });

  test('blocks saving an incomplete boundary with an acknowledge-only dialog', async ({ page }) => {
    await openMappingScreen(page);

    await addVertex(page, BUKIDNON_VERTICES[0][0], BUKIDNON_VERTICES[0][1]);
    await addVertex(page, BUKIDNON_VERTICES[1][0], BUKIDNON_VERTICES[1][1]);
    await expect.poll(() => vertexCount(page)).toBe(2);

    await page.getByTestId('save-boundary').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    expect(await dialogTitle(page)).toBe('Boundary Incomplete');

    // Informational dialog: a single OK action, no destructive second button.
    await expect(page.getByTestId('confirm-dialog-cancel')).toHaveCount(0);
    await expect(page.getByTestId('confirm-dialog-confirm')).toContainText('OK');

    await acknowledgeDialog(page);
    expect(await vertexCount(page)).toBe(2);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
  });

  test('confirms before discarding unsaved edits when switching parcels', async ({ page }) => {
    await openMappingScreen(page, 2);
    const chips = page.locator('[data-testid^="parcel-chip-"]');
    expect(await chips.count()).toBe(2);

    const chipA = await chips.nth(0).getAttribute('data-testid');
    const chipB = await chips.nth(1).getAttribute('data-testid');
    expect(chipA).not.toBe(chipB);

    // Pin the starting parcel (clicking the already-selected chip is a no-op).
    await page.locator(`[data-testid="${chipA}"]`).click();
    await addVertex(page, BUKIDNON_VERTICES[0][0], BUKIDNON_VERTICES[0][1]);
    await expect.poll(() => vertexCount(page)).toBe(1);

    await page.locator(`[data-testid="${chipB}"]`).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    expect(await dialogTitle(page)).toBe('Unsaved Changes');
    await expect(page.getByTestId('confirm-dialog-confirm')).toContainText('Discard');

    // "Keep Editing" preserves the work and stays on the same parcel.
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    expect(await vertexCount(page)).toBe(1);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();

    // "Discard" switches parcels and clears the dirty flag.
    await page.locator(`[data-testid="${chipB}"]`).click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);
    expect(await vertexCount(page)).toBe(0);
    await expect(page.getByTestId('empty-boundary-state')).toContainText('E2E Parcel');

    // Returning to parcel A proves the discard really committed — the unsaved
    // vertex is gone, and no stale geometry bled over from parcel B either.
    await page.locator(`[data-testid="${chipA}"]`).click();
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    expect(await vertexCount(page)).toBe(0);
    await expect(page.getByTestId('empty-boundary-state')).toBeVisible();
  });

  test('edits the boundary directly on the map', async ({ page }) => {
    await openMappingScreen(page);

    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Start from an empty parcel so the click cannot land on the polygon path
    // (an interactive L.Polygon swallows the map click by design).
    expect(await vertexCount(page)).toBe(0);

    // A map click adds the first vertex.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => vertexCount(page)).toBe(1);

    // FitBounds re-frames the map on that vertex; a second click elsewhere adds
    // another, which is what the coordinates list below reflects.
    await page.mouse.click(box.x + 60, box.y + box.height - 60);
    await expect.poll(() => vertexCount(page)).toBe(2);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();

    // Tapping a vertex marker removes it again.
    await page.locator('.leaflet-marker-icon').first().click({ force: true });
    await expect.poll(() => vertexCount(page)).toBe(1);
  });

  test('clears the whole boundary only after confirmation', async ({ page }) => {
    await openMappingScreen(page);
    await addTriangle(page);

    await page.getByTestId('clear-boundary').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    expect(await dialogTitle(page)).toBe('Clear Boundary');

    // Cancel leaves the boundary intact.
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    expect(await vertexCount(page)).toBe(3);

    // Confirm empties it and restores the empty-state guidance.
    await page.getByTestId('clear-boundary').click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect.poll(() => vertexCount(page)).toBe(0);
    await expect(page.getByTestId('empty-boundary-state')).toBeVisible();
  });

  test('persists a saved boundary and honours the parcel-card deep link', async ({ page }) => {
    const ids = await seedParcels(page, 2);
    const idA = ids['E2E Parcel 1'];
    const idB = ids['E2E Parcel 2'];

    // Save a real triangle against parcel 1.
    await safeNavigate(page, MAPPING_ROUTE, 'GPS Boundary Mapping');
    await page.getByTestId(`parcel-chip-${idA}`).click();
    await addTriangle(page);
    await page.getByTestId('save-boundary').click();
    expect(await dialogTitle(page)).toBe('Boundary Saved');
    await acknowledgeDialog(page);
    await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);

    // Open parcel 2 through its card action, not a hand-typed URL.
    await safeNavigate(page, PARCELS_ROUTE, 'Land Parcels Registry');
    const cardB = page.locator(`[data-testid="parcel-card-${idB}"]`);
    await expect(cardB).toBeVisible();
    await cardB.locator('[data-testid^="parcel-mapping-link-"]').click();

    await expect(page.getByText('GPS Boundary Mapping').first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`parcelId=${idB}`));
    // The deep link must select parcel 2 — which has no boundary — not fall back
    // to the first row (parcel 1, whose triangle would show 3 vertices).
    await expect(page.getByTestId('empty-boundary-state')).toContainText('E2E Parcel 2');
    expect(await vertexCount(page)).toBe(0);

    // And parcel 1's boundary survived the round trip.
    await page.getByTestId(`parcel-chip-${idA}`).click();
    await expect.poll(() => vertexCount(page)).toBe(3);
    await expect(page.getByTestId('empty-boundary-state')).toHaveCount(0);
    await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toBeVisible();
  });
});
