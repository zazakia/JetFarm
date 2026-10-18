import { expect, type Locator, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';
import { isDedicatedE2EPort } from '../src/utils/e2ePortPolicy';

export const MAPPING_ROUTE = '/agribusiness/mapping';
export const PARCELS_ROUTE = '/agribusiness/parcels';
export const WORKERS_ROUTE = '/agribusiness/workers';
export const LABOR_ROUTE = '/agribusiness/labor';
export type Coordinate = readonly [string, string];

// Artificial equatorial rectangles, NOT surveyed land or guessed production data.
// Entered by the operator UI only; never inject WatermelonDB/IndexedDB records.
export const OUTER: readonly Coordinate[] = [
  ['0.000000', '0.000000'], ['0.000000', '0.002000'],
  ['0.002000', '0.002000'], ['0.002000', '0.000000'],
];
export const POCKET: readonly Coordinate[] = [
  ['0.001200', '0.001200'], ['0.001200', '0.001600'],
  ['0.001600', '0.001600'], ['0.001600', '0.001200'],
];
export const BLOCK: readonly Coordinate[] = [
  ['0.000200', '0.000200'], ['0.000200', '0.000800'],
  ['0.001800', '0.000800'], ['0.001800', '0.000200'],
];

// Independent analytic spherical rectangle oracle, not a call into product code.
export function rectangleHectares(south: number, north: number, west: number, east: number) {
  const radians = Math.PI / 180;
  return 6378137 ** 2 * (east - west) * radians *
    (Math.sin(north * radians) - Math.sin(south * radians)) / 10000;
}
export const OUTER_HA = rectangleHectares(0, 0.002, 0, 0.002);
export const POCKET_HA = rectangleHectares(0.0012, 0.0016, 0.0012, 0.0016);
export const USABLE_HA = OUTER_HA - POCKET_HA;
export const BLOCK_HA = rectangleHectares(0.0002, 0.0018, 0.0002, 0.0008);

export async function localAdmin(page: Page, baseURL?: string) {
  // Deliberately not an exact-port pin: the systematic-test-matrix runner allocates a
  // dynamic free port, so a literal here failed under every automated entry point. The
  // hazard worth refusing is reuseExistingServer attaching to a stale shared-port bundle.
  expect(
    isDedicatedE2EPort(baseURL),
    `Mapping specs need a dedicated port, not the legacy shared 19119 (got ${baseURL ?? 'no baseURL'})`,
  ).toBe(true);
  expect(process.env.EXPO_PUBLIC_E2E_MODE, 'Build/run with the real local mock-auth harness').toBe('1');
  expect(process.env.PLAYWRIGHT_ALLOW_PRODUCTION_DB).not.toBe('1');
  const backend = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:46421');
  expect(['127.0.0.1', 'localhost', '[::1]']).toContain(backend.hostname);
  await loginAsAdmin(page);
  // Observe the session created by the login UI; do not write auth storage.
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem('jetfarm:e2e-auth-user');
    if (!raw) return false;
    const user = JSON.parse(raw);
    return user.role === 'admin' && user.email === 'admin@jetfarm.com';
  })).toBe(true);
}

export async function mappingReady(page: Page, id?: string) {
  await expect(page.getByText('GPS Parcel Mapping', { exact: true })).toBeVisible();
  await expect(page.getByTestId('mapping-mode-browse')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('mapping-mode-manual')).toBeEnabled();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByTestId('mapping-error')).toHaveCount(0);
  if (id) await expect(page.getByTestId(`parcel-chip-${id}`)).toHaveAttribute('aria-pressed', 'true');
}

/** Starts with an empty, disposable browser registry and follows its real map-registration action. */
export async function registerUnmeasuredParcel(page: Page, name = 'GPS browser fixture'): Promise<string> {
  await safeNavigate(page, MAPPING_ROUTE, 'GPS Parcel Mapping');
  await page.getByTestId('register-mapping-parcel').click();
  await expect(page).toHaveURL(/\/agribusiness\/parcels\?mapRegistration=1/);
  await page.getByTestId('register-parcel-button').click();
  await page.getByTestId('parcel-name-input').fill(name);
  await page.getByTestId('parcel-code-input').fill('GPS-SYNTHETIC');
  await page.getByTestId('landowner-name-input').fill('Synthetic browser landowner');
  await expect(page.getByTestId('parcel-area-input')).toHaveCount(0);
  await expect(page.getByText('Area will be measured from your mapped boundary. The parcel is explicitly unmeasured until review and Save.')).toBeVisible();
  await page.getByTestId('save-parcel-button').click();
  await expect(page.getByTestId('parcel-name-input')).toHaveCount(0);
  await expect(page).toHaveURL(/\/agribusiness\/mapping\?parcelId=[^&]+/);
  const id = new URL(page.url()).searchParams.get('parcelId');
  expect(id).toBeTruthy();
  if (!id) throw new Error('Registration did not return the new parcel deep link');
  await mappingReady(page, id);
  await expect(page.getByTestId('parcel-details-panel')).toContainText(name);
  await expect(page.getByTestId('parcel-details-panel')).toContainText('Registered area: 0.0000 ha');
  await expect(page.getByTestId('empty-boundary-state')).toBeVisible();
  await expect(boundaryPaths(page)).toHaveCount(0);
  return id;
}

/** A second registry fixture with explicitly synthetic registered area, no saved GPS geometry. */
export async function registerSecondParcel(page: Page, name: string): Promise<string> {
  await safeNavigate(page, PARCELS_ROUTE, 'Land Parcels Registry');
  await page.getByTestId('register-parcel-button').click();
  await page.getByTestId('parcel-name-input').fill(name);
  await page.getByTestId('parcel-code-input').fill('GPS-SECOND');
  await page.getByTestId('landowner-name-input').fill('Second synthetic browser landowner');
  await page.getByTestId('parcel-area-input').fill('4.2');
  await page.getByTestId('save-parcel-button').click();
  await expect(page.getByTestId('parcel-name-input')).toHaveCount(0);
  const card = page.locator('[data-testid^="parcel-card-"]').filter({ hasText: name });
  await expect(card).toHaveCount(1);
  const testId = await card.getAttribute('data-testid');
  if (!testId?.startsWith('parcel-card-')) throw new Error('Registry fixture has no parcel card ID');
  return testId.slice('parcel-card-'.length);
}

export const vertexRows = (page: Page) => page.locator('[data-testid^="select-vertex-"]');
export const vertexMarkers = (page: Page) => page.locator('.leaflet-marker-pane .parcel-vertex-icon');
export const boundaryPaths = (page: Page) => page.locator('.leaflet-overlay-pane path');
export const filledPaths = (page: Page) => page.locator('.leaflet-overlay-pane path:not([fill="none"])');
// ParcelMap tags each saved feature's outline with `feature-boundary-<id>` (web SVG path and
// native webview share the class), so a test can assert one parcel's own boundary instead of
// counting every neighbor overlay in the shared pane.
export const featureBoundaryPath = (page: Page, featureId: string) => page.locator(`.leaflet-overlay-pane path.feature-boundary-${featureId}`);
export const mapLabels = (page: Page) => page.locator('.leaflet-tooltip-pane .leaflet-tooltip');

export async function chooseMode(page: Page, mode: 'browse' | 'boundary' | 'manual' | 'exclude' | 'cut' | 'block') {
  await page.getByTestId(`mapping-mode-${mode}`).click();
  await expect(page.getByTestId(`mapping-mode-${mode}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('boundary-editor-panel')).toHaveCount(mode === 'browse' ? 0 : 1);
}

export async function addVertex(page: Page, latitude: string, longitude: string) {
  await page.getByRole('textbox', { name: 'Latitude in decimal degrees', exact: true }).fill(latitude);
  await page.getByRole('textbox', { name: 'Longitude in decimal degrees', exact: true }).fill(longitude);
  await page.getByTestId('add-vertex').click();
}

export async function addPoints(page: Page, points: readonly Coordinate[]) {
  const before = await vertexRows(page).count();
  for (const [index, [latitude, longitude]] of points.entries()) {
    await addVertex(page, latitude, longitude);
    await expect(vertexRows(page)).toHaveCount(before + index + 1);
    await expect(vertexMarkers(page)).toHaveCount(before + index + 1);
    await expect(page.getByTestId('vertex-input-error')).toHaveCount(0);
  }
}

export async function drawOuterManually(page: Page) {
  await chooseMode(page, 'manual');
  await addPoints(page, OUTER);
  await expect(filledPaths(page)).toHaveCount(0);
  await expect(boundaryPaths(page)).toHaveCount(1);
  await page.getByTestId('close-boundary').click();
  await expect(filledPaths(page)).toHaveCount(1);
  await expect(filledPaths(page)).toHaveAttribute('d', /z\s*$/i);
  await expect(page.getByTestId('measured-hectares')).toHaveText(`${OUTER_HA.toFixed(4)} ha`);
}

export async function expectDialog(page: Page, title: string) {
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('confirm-dialog-title')).toHaveText(title);
}

export async function acknowledge(page: Page, title: string) {
  await expectDialog(page, title);
  await expect(page.getByTestId('confirm-dialog-cancel')).toHaveCount(0);
  await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText('OK');
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
}

export async function openReview(page: Page, measured: number, registered: number) {
  await page.getByTestId('save-boundary').click();
  await expectDialog(page, 'Review Measured Area');
  await expect(page.getByTestId('confirm-dialog-message')).toContainText(`Registered area: ${registered.toFixed(4)} ha`);
  await expect(page.getByTestId('confirm-dialog-message')).toContainText(`Measured usable area: ${measured.toFixed(4)} ha`);
  await expect(page.getByTestId('confirm-dialog-message')).toContainText('Exclusions are deducted');
  await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText('Save reviewed layout');
  await expect(page.getByTestId('confirm-dialog-cancel')).toHaveText('Keep Editing');
}

export async function reviewAndSave(page: Page, measured: number, registered: number) {
  await openReview(page, measured, registered);
  await page.getByTestId('confirm-dialog-confirm').click();
  await acknowledge(page, 'Boundary Saved');
  await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);
  await mappingReady(page);
  await expect(page.getByTestId('parcel-details-panel')).toContainText(`Registered area: ${measured.toFixed(4)} ha`);
  await expect(page.getByTestId('parcel-details-panel')).not.toContainText('Boundary saved: Not recorded');
  await expect(page.getByTestId('measured-hectares')).toHaveText(`${measured.toFixed(4)} ha`);
}

/** The WatermelonDB Loki adapter autosaves to IndexedDB at most every 500ms
 *  (adapters/lokijs/worker/lokiExtensions.js) and the app itself warns that abrupt closure can
 *  lose recent saves. Reloads that force durability must wait out one flush window first. */
export async function settleAutosave(page: Page) {
  await page.waitForTimeout(800);
}

/** Normal pointer event against the mounted map; no force, Leaflet API injection, or mock map. */
export async function tapMap(page: Page, xFraction: number, yFraction: number) {
  const map = page.locator('.leaflet-container');
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  if (!box) throw new Error('Leaflet has no visible map bounds');
  await map.click({ position: { x: box.width * xFraction, y: box.height * yFraction } });
}

/** fitBounds animates the overlay per frame; screen fractions sampled mid-animation go stale
 *  before the pointer arrives (a stale point can land on an interactive label and swallow the
 *  map click). Wait until rendered path geometry holds still across three spaced samples. */
export async function waitForMapSettled(page: Page) {
  const read = () => filledPaths(page).evaluateAll(paths => paths.map(path => {
    const box = path.getBoundingClientRect();
    return `${box.x.toFixed(2)}|${box.y.toFixed(2)}|${box.width.toFixed(2)}|${box.height.toFixed(2)}`;
  }).join(';'));
  await expect.poll(async () => {
    let last = await read();
    for (let sample = 0; sample < 2; sample++) {
      await page.waitForTimeout(100);
      const next = await read();
      if (next !== last) return 'moving';
      last = next;
    }
    return 'settled';
  }, { timeout: 20000, message: 'expected the map viewport to stop animating before pointer sampling' }).toBe('settled');
}

/** Observe projected Leaflet vertices; pointer drag/click uses these, not a private map instance. */
export async function markerCenters(page: Page) {
  return vertexMarkers(page).evaluateAll(markers => markers.map(marker => {
    const box = marker.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }));
}

export async function expectHoleRendered(page: Page, rings = 2) {
  await expect(filledPaths(page)).toHaveCount(1);
  await expect(filledPaths(page)).toHaveAttribute('fill-rule', 'evenodd');
  await expect.poll(() => filledPaths(page).evaluateAll(paths =>
    paths.map(path => (path.getAttribute('d') || '').match(/M/gi)?.length || 0)
  )).toEqual([rings]);
  // Chrome's real SVG fill engine must leave the rectangular pocket unfilled.
  // Ring count alone could pass for a path that incorrectly paints its hole.
  await expect.poll(() => filledPaths(page).evaluate(path => {
    const svgPath = path as SVGPathElement;
    const subpaths = (path.getAttribute('d') || '').match(/M[^M]+/gi) || [];
    return subpaths.slice(1).map(subpath => {
      const values = (subpath.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const xs = values.filter((_, index) => index % 2 === 0);
      const ys = values.filter((_, index) => index % 2 === 1);
      const center = new DOMPoint((Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2);
      return svgPath.isPointInFill(center);
    });
  })).toEqual(Array.from({ length: rings - 1 }, () => false));
}

export async function registerWorker(page: Page, name: string) {
  await safeNavigate(page, WORKERS_ROUTE, 'Farm Laborers & Staff');
  await page.getByText('Register Worker', { exact: true }).click();
  // RN Modal uses role=dialog on web. Keep modal and roster actions disambiguated.
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Register Farm Worker & Staff', { exact: true })).toBeVisible();
  await modal.getByPlaceholder('e.g. Juan dela Cruz', { exact: true }).fill(name);
  await modal.getByPlaceholder('450', { exact: true }).fill('450');
  await modal.getByText('active', { exact: true }).click();
  await modal.getByText('Register Worker', { exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByTestId('web-toast-container').getByText(`Worker "${name}" registered successfully!`, { exact: true })).toBeVisible();
  await expect(workerCard(page, name).getByText('active', { exact: true })).toBeVisible();
}

export function workerCard(page: Page, name: string): Locator {
  // Smallest roster card containing this worker and its Edit Record action.
  // This deliberately excludes aggregate KPI cards and the task directory.
  return page.locator('div').filter({ has: page.getByText(name, { exact: true }) })
    .filter({ has: page.getByText('Edit Record', { exact: true }) })
    .filter({ hasNot: page.locator('div').filter({ has: page.getByText(name, { exact: true }) })
      .filter({ has: page.getByText('Edit Record', { exact: true }) }) });
}

export async function expectNoWages(page: Page) {
  await safeNavigate(page, LABOR_ROUTE, 'Farm Labor & Field Workers');
  // Positive loaded-state assertion prevents an empty pre-query render proving absence.
  await expect(page.getByTestId('field-workers-kpi-card')).toContainText('2');
  await expect(page.getByText('No Labor Logs Recorded', { exact: true })).toBeVisible();
  await expect(page.getByText('Pay Wage', { exact: true })).toHaveCount(0);
  for (const label of ['Pending Wages', 'Total Paid']) {
    const card = page.getByText(label, { exact: true }).locator('..');
    // formatPHP renders with currencyDisplay 'code' ("PHP 0.00"), never a bare ₱ symbol.
    await expect(card).toContainText(/PHP\s*0\.00/);
  }
}
