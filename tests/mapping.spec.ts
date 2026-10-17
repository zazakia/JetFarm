import { test, expect } from '@playwright/test';
import { safeNavigate } from './playwright-auth';
import {
  MAPPING_ROUTE, PARCELS_ROUTE, OUTER, OUTER_HA,
  localAdmin, mappingReady, registerUnmeasuredParcel, registerSecondParcel,
  vertexRows, vertexMarkers, boundaryPaths, filledPaths, chooseMode,
  addVertex, addPoints, drawOuterManually, expectDialog, acknowledge,
  openReview, reviewAndSave, tapMap, markerCenters,
} from './mapping-helpers';

/**
 * Approved GPS UX acceptance labels (GPS-*) are local traceability names, not
 * invented external requirement IDs. These replace the obsolete form-only flow:
 * explicit intent, open line -> Close boundary -> review -> saved, selection not
 * deletion, and draft clearing distinct from audited saved-geometry clearing.
 * Real Leaflet, UI-created disposable fixtures, and local harness auth only.
 * Browser RED/baseline execution is deferred while the parent edits the app.
 */
test.describe('GPS Parcel Mapping approved browser UX', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.beforeEach(async ({ page, baseURL }) => {
    test.setTimeout(180000);
    await localAdmin(page, baseURL);
  });

  test('GPS-AREA replaces unmeasured hectares only after explicit close, review and save', async ({ page }) => {
    await registerUnmeasuredParcel(page);
    await drawOuterManually(page);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    await expect(page.getByTestId('parcel-details-panel')).toContainText('Registered area: 0.0000 ha');
    await expect(page.getByTestId('parcel-details-panel')).toContainText('4.9568 ha');
    await expect(page.getByTestId('parcel-details-panel')).toContainText('49,568 m²');
    await expect(page.getByTestId('parcel-details-panel')).toContainText('Outer perimeter');

    await openReview(page, OUTER_HA, 0);
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    await expect(page.getByTestId('parcel-details-panel')).toContainText('Registered area: 0.0000 ha');
    await expect(vertexRows(page)).toHaveCount(4);
    await expect(filledPaths(page)).toHaveCount(1);

    await reviewAndSave(page, OUTER_HA, 0);
    await expect(vertexMarkers(page)).toHaveCount(0); // Browse is not an edit mode.
    await expect(filledPaths(page)).toHaveCount(1);
    await page.screenshot({
      path: `D:/GitHub/JetFarm/tmp/systematic-test-matrix/gps-browser-saved-${Date.now()}.png`,
      fullPage: true,
    });
  });

  const invalidCoordinates = [
    { name: 'latitude above 90', lat: '90.000001', lon: '0' },
    { name: 'latitude below -90', lat: '-90.000001', lon: '0' },
    { name: 'longitude above 180', lat: '0', lon: '180.000001' },
    { name: 'longitude below -180', lat: '0', lon: '-180.000001' },
    { name: 'trailing latitude text', lat: '0.001north', lon: '0' },
    { name: 'trailing longitude text', lat: '0', lon: '0.001east' },
    { name: 'missing latitude', lat: '', lon: '0' },
    { name: 'missing longitude', lat: '0', lon: '' },
    { name: 'NaN', lat: 'NaN', lon: '0' },
    { name: 'Infinity', lat: '0', lon: 'Infinity' },
  ];
  for (const { name, lat, lon } of invalidCoordinates) {
    test(`GPS-VALID rejects ${name} without mutating the draft`, async ({ page }) => {
      await registerUnmeasuredParcel(page);
      await chooseMode(page, 'manual');
      await addVertex(page, lat, lon);
      await expect(page.getByTestId('vertex-input-error')).toContainText('Enter full decimal degrees');
      await expect(vertexRows(page)).toHaveCount(0);
      await expect(vertexMarkers(page)).toHaveCount(0);
      await expect(boundaryPaths(page)).toHaveCount(0);
      await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);
      await expect(page.getByRole('textbox', { name: 'Latitude in decimal degrees', exact: true })).toHaveValue(lat);
      await expect(page.getByRole('textbox', { name: 'Longitude in decimal degrees', exact: true })).toHaveValue(lon);
      await addPoints(page, [OUTER[0]]);
      await expect(page.getByTestId('vertex-input-error')).toHaveCount(0);
      await expect(page.getByRole('textbox', { name: 'Latitude in decimal degrees', exact: true })).toHaveValue('');
      await expect(page.getByRole('textbox', { name: 'Longitude in decimal degrees', exact: true })).toHaveValue('');
      await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    });
  }

  for (const count of [0, 1, 2]) {
    test(`GPS-INCOMPLETE rejects review/save with ${count} points and retains those points`, async ({ page }) => {
      await registerUnmeasuredParcel(page);
      await chooseMode(page, 'manual');
      await addPoints(page, OUTER.slice(0, count));
      await page.getByTestId('save-boundary').click();
      await expectDialog(page, 'Boundary Incomplete');
      await expect(page.getByTestId('confirm-dialog-message')).toContainText('at least three non-crossing vertices');
      await acknowledge(page, 'Boundary Incomplete');
      await expect(vertexRows(page)).toHaveCount(count);
      await expect(vertexMarkers(page)).toHaveCount(count);
      await expect(filledPaths(page)).toHaveCount(0);
      await expect(page.getByTestId('parcel-details-panel')).toContainText('Registered area: 0.0000 ha');
      await expect(page.getByTestId('unsaved-badge')).toHaveCount(count ? 1 : 0);
    });
  }

  for (const invalid of [
    { name: 'crossing ring', points: [OUTER[0], OUTER[2], OUTER[1], OUTER[3]], message: /self-intersects/ },
    { name: 'duplicate adjacent vertex', points: [OUTER[0], OUTER[1], OUTER[1], OUTER[2], OUTER[3]], message: /duplicate vertex/ },
  ]) {
    test(`GPS-TOPOLOGY refuses to close or save a ${invalid.name}`, async ({ page }) => {
      await registerUnmeasuredParcel(page);
      await chooseMode(page, 'manual');
      await addPoints(page, invalid.points);
      await page.getByTestId('close-boundary').click();
      await expect(page.getByTestId('vertex-input-error')).toContainText(invalid.message);
      await expect(filledPaths(page)).toHaveCount(0);
      await expect(page.getByTestId('measured-hectares')).toHaveCount(0);
      await page.getByTestId('save-boundary').click();
      await expectDialog(page, 'Boundary Invalid');
      await expect(page.getByTestId('confirm-dialog-message')).toContainText(invalid.message);
      await acknowledge(page, 'Boundary Invalid');
      await expect(vertexRows(page)).toHaveCount(invalid.points.length);
      await expect(vertexMarkers(page)).toHaveCount(invalid.points.length);
      await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    });
  }

  test('GPS-MODES Browse never adds points; Draw boundary consumes real Leaflet taps', async ({ page }) => {
    await registerUnmeasuredParcel(page);
    await expect(page.getByTestId('boundary-editor-panel')).toHaveCount(0);
    await tapMap(page, 0.35, 0.4);
    await expect(vertexMarkers(page)).toHaveCount(0);
    await expect(boundaryPaths(page)).toHaveCount(0);
    await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);

    await chooseMode(page, 'boundary');
    await tapMap(page, 0.5, 0.5);
    await expect(vertexRows(page)).toHaveCount(1);
    await expect(vertexMarkers(page)).toHaveCount(1);
    // First-point fit is observable through the actual projected marker position.
    await expect.poll(async () => {
      const box = await page.locator('.leaflet-container').boundingBox();
      const [point] = await markerCenters(page);
      return !!box && !!point && Math.abs(point.x - (box.x + box.width / 2)) < 3 &&
        Math.abs(point.y - (box.y + box.height / 2)) < 3;
    }).toBe(true);
    await tapMap(page, 0.22, 0.72);
    await expect(vertexRows(page)).toHaveCount(2);
    await tapMap(page, 0.76, 0.72);
    await expect(vertexRows(page)).toHaveCount(3);
    await expect(vertexMarkers(page)).toHaveCount(3);
    await expect(filledPaths(page)).toHaveCount(0);
    await page.getByTestId('close-boundary').click();
    await expect(filledPaths(page)).toHaveCount(1);
    await expect(filledPaths(page)).toHaveAttribute('d', /z\s*$/i);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
  });

  test('GPS-SELECT selecting a real marker does not delete until the explicit Delete action', async ({ page }) => {
    await registerUnmeasuredParcel(page);
    await drawOuterManually(page);
    await page.getByRole('button', { name: 'Fit selected geometry', exact: true }).click();
    const before = await vertexRows(page).allTextContents();
    const marker = vertexMarkers(page).first();
    await marker.click();
    await expect(vertexRows(page)).toHaveText(before);
    await expect(vertexMarkers(page)).toHaveCount(4);
    await expect(filledPaths(page)).toHaveCount(1);
    // The selected vertex has a visible, larger dot, not a silently removed row.
    await expect.poll(() => marker.locator('[data-vertex-index="0"] > div').evaluate(el =>
      el.getBoundingClientRect().width
    )).toBe(22);
    await page.getByRole('button', { name: 'Delete vertex 1', exact: true }).click();
    await expect(vertexRows(page)).toHaveCount(3);
    await expect(vertexMarkers(page)).toHaveCount(3);
    await expect(vertexRows(page)).toHaveText(before.slice(1).map((text, index) => text.replace(/^\d+\./, `${index + 1}.`)));
    await expect(filledPaths(page)).toHaveCount(0); // Deletion reopens the draft.
    await page.getByTestId('mapping-undo').click();
    await expect(vertexRows(page)).toHaveText(before);
    await expect(vertexMarkers(page)).toHaveCount(4);
    await expect(filledPaths(page)).toHaveCount(1);
    await page.getByTestId('mapping-redo').click();
    await expect(vertexMarkers(page)).toHaveCount(3);
  });

  test('GPS-DRAG dragging a Leaflet vertex changes coordinates and shape without adding or deleting vertices', async ({ page }) => {
    await registerUnmeasuredParcel(page);
    await drawOuterManually(page);
    await page.getByRole('button', { name: 'Fit selected geometry', exact: true }).click();
    const row = page.getByTestId('select-vertex-0');
    const coordinatesBefore = await row.textContent();
    const pathBefore = await filledPaths(page).getAttribute('d');
    const marker = vertexMarkers(page).first();
    await marker.scrollIntoViewIfNeeded();
    const box = await marker.boundingBox();
    if (!box) throw new Error('Cannot drag an invisible vertex');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 - 25, { steps: 12 });
    await page.mouse.up();
    await expect(row).not.toHaveText(coordinatesBefore || '');
    await expect(vertexRows(page)).toHaveCount(4);
    await expect(vertexMarkers(page)).toHaveCount(4);
    await expect(boundaryPaths(page)).not.toHaveAttribute('d', pathBefore || '');
    await expect(filledPaths(page)).toHaveCount(0);
    await expect(page.getByTestId('parcel-details-panel')).toContainText('Registered area: 0.0000 ha');
    await page.getByTestId('mapping-undo').click();
    await expect(row).toHaveText(coordinatesBefore || '');
    await expect(filledPaths(page)).toHaveCount(1);
  });

  test('GPS-SWITCH Keep Editing preserves the selected parcel; Discard removes its unsaved geometry', async ({ page }) => {
    const idA = await registerUnmeasuredParcel(page, 'Synthetic Parcel A');
    const idB = await registerSecondParcel(page, 'Synthetic Parcel B');
    await page.getByTestId(`parcel-mapping-link-${idA}`).click();
    await mappingReady(page, idA);
    await chooseMode(page, 'manual');
    await addPoints(page, [OUTER[0]]);
    await page.getByTestId(`parcel-chip-${idB}`).click();
    await expectDialog(page, 'Unsaved Changes');
    await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText('Discard');
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    await expect(page.getByTestId(`parcel-chip-${idA}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(vertexRows(page)).toHaveCount(1);
    await expect(vertexMarkers(page)).toHaveCount(1);

    await page.getByTestId(`parcel-chip-${idB}`).click();
    await expectDialog(page, 'Unsaved Changes');
    await page.getByTestId('confirm-dialog-confirm').click();
    await mappingReady(page, idB);
    await expect(page.getByTestId('parcel-details-panel')).toContainText('Synthetic Parcel B');
    await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);
    await expect(vertexMarkers(page)).toHaveCount(0);
    await page.getByTestId(`parcel-chip-${idA}`).click();
    await mappingReady(page, idA);
    await expect(page.getByTestId('recover-mapping-draft')).toHaveCount(0);
    await chooseMode(page, 'manual');
    await expect(vertexRows(page)).toHaveCount(0);
  });

  test('GPS-DRAFT Clear Draft Points cancels safely and cannot erase the saved boundary or recorded hectares', async ({ page }) => {
    await registerUnmeasuredParcel(page);
    await drawOuterManually(page);
    await reviewAndSave(page, OUTER_HA, 0);
    await chooseMode(page, 'manual');
    await page.getByTestId('clear-boundary').click();
    await expectDialog(page, 'Clear Draft Points');
    await expect(page.getByTestId('confirm-dialog-message')).toContainText('Saved geometry and registered hectares remain unchanged');
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(vertexRows(page)).toHaveCount(4);
    await page.getByTestId('clear-boundary').click();
    await expectDialog(page, 'Clear Draft Points');
    await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText('Clear draft');
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(vertexRows(page)).toHaveCount(0);
    await expect(boundaryPaths(page)).toHaveCount(0);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    await expect(page.getByTestId('parcel-details-panel')).toContainText(`Registered area: ${OUTER_HA.toFixed(4)} ha`);
    await page.getByTestId('save-boundary').click();
    await acknowledge(page, 'Boundary Incomplete');
    page.once('dialog', dialog => dialog.accept()); // Browser beforeunload protects this dirty draft.
    await page.reload();
    await mappingReady(page);
    await expect(filledPaths(page)).toHaveCount(1); // Saved geometry, not the empty draft, rehydrates.
    await expect(page.getByTestId('measured-hectares')).toHaveText(`${OUTER_HA.toFixed(4)} ha`);
    await expect(page.getByTestId('parcel-details-panel')).toContainText(`Registered area: ${OUTER_HA.toFixed(4)} ha`);
    await chooseMode(page, 'manual');
    await expect(vertexRows(page)).toHaveCount(4);
  });

  test('GPS-CLEAR Clear Saved Boundary is a separate confirmation and preserves recorded hectares after reload', async ({ page }) => {
    const id = await registerUnmeasuredParcel(page);
    await drawOuterManually(page);
    await reviewAndSave(page, OUTER_HA, 0);
    await page.getByTestId('clear-saved-boundary').click();
    await expectDialog(page, 'Clear Saved Boundary');
    await expect(page.getByTestId('confirm-dialog-message')).toContainText('audited and revision-checked');
    await expect(page.getByTestId('confirm-dialog-message')).toContainText('Recorded hectares and crop history remain unchanged');
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(filledPaths(page)).toHaveCount(1);
    await page.getByTestId('clear-saved-boundary').click();
    await expectDialog(page, 'Clear Saved Boundary');
    await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText('Clear saved geometry');
    await page.getByTestId('confirm-dialog-confirm').click();
    await acknowledge(page, 'Saved Boundary Cleared');
    await expect(boundaryPaths(page)).toHaveCount(0);
    await expect(page.getByTestId('empty-boundary-state')).toBeVisible();
    await expect(page.getByTestId('parcel-details-panel')).toContainText(`Registered area: ${OUTER_HA.toFixed(4)} ha`);
    await page.reload();
    await mappingReady(page, id);
    await expect(boundaryPaths(page)).toHaveCount(0);
    await expect(page.getByTestId('measured-hectares')).toHaveCount(0);
    await expect(page.getByTestId('parcel-details-panel')).toContainText(`Registered area: ${OUTER_HA.toFixed(4)} ha`);
  });

  test('GPS-RECOVERY reload offers a draft explicitly without silently restoring unsaved hectares', async ({ page }) => {
    const id = await registerUnmeasuredParcel(page);
    await drawOuterManually(page);
    page.once('dialog', dialog => dialog.accept());
    await page.reload();
    await mappingReady(page, id);
    await expect(page.getByTestId('recover-mapping-draft')).toBeVisible();
    await expect(boundaryPaths(page)).toHaveCount(0);
    await expect(page.getByTestId('parcel-details-panel')).toContainText('Registered area: 0.0000 ha');
    await page.getByTestId('recover-mapping-draft').click();
    await expect(page.getByTestId('recover-mapping-draft')).toHaveCount(0);
    await expect(vertexRows(page)).toHaveCount(4);
    await expect(vertexMarkers(page)).toHaveCount(4);
    await expect(filledPaths(page)).toHaveCount(1);
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    await reviewAndSave(page, OUTER_HA, 0);
  });

  test('GPS-PERSIST parcel-card deep links select the right parcel and saved vertices survive a full reload', async ({ page }) => {
    const idA = await registerUnmeasuredParcel(page, 'Synthetic Saved Parcel');
    const idB = await registerSecondParcel(page, 'Synthetic Unmapped Parcel');
    await page.getByTestId(`parcel-mapping-link-${idA}`).click();
    await mappingReady(page, idA);
    await drawOuterManually(page);
    const savedRows = await vertexRows(page).allTextContents();
    await reviewAndSave(page, OUTER_HA, 0);
    await safeNavigate(page, PARCELS_ROUTE, 'Land Parcels Registry');
    await page.getByTestId(`parcel-mapping-link-${idB}`).click();
    await expect(page).toHaveURL(new RegExp(`parcelId=${idB}`));
    await mappingReady(page, idB);
    await expect(page.getByTestId('parcel-details-panel')).toContainText('Synthetic Unmapped Parcel');
    await expect(page.getByTestId('empty-boundary-state')).toBeVisible();
    await expect(boundaryPaths(page)).toHaveCount(0);
    await page.getByTestId(`parcel-chip-${idA}`).click();
    await mappingReady(page, idA);
    await expect(filledPaths(page)).toHaveCount(1);
    await chooseMode(page, 'manual');
    await expect(vertexRows(page)).toHaveText(savedRows);
    await chooseMode(page, 'browse');
    // Navigate via the parcel card again so URL and selection both name A on reload.
    await safeNavigate(page, PARCELS_ROUTE, 'Land Parcels Registry');
    await page.getByTestId(`parcel-mapping-link-${idA}`).click();
    await mappingReady(page, idA);
    await page.reload();
    await mappingReady(page, idA);
    await expect(filledPaths(page)).toHaveCount(1);
    await expect(page.getByTestId('measured-hectares')).toHaveText(`${OUTER_HA.toFixed(4)} ha`);
    await chooseMode(page, 'manual');
    await expect(vertexRows(page)).toHaveText(savedRows);
  });
});
