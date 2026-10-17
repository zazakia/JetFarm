import { test, expect, type Page } from '@playwright/test';
import { safeNavigate } from './playwright-auth';
import {
  WORKERS_ROUTE, OUTER_HA, USABLE_HA, BLOCK_HA, POCKET, BLOCK, type Coordinate,
  localAdmin, mappingReady, registerUnmeasuredParcel, registerWorker, workerCard,
  chooseMode, addVertex, addPoints, drawOuterManually, reviewAndSave,
  vertexRows, vertexMarkers, filledPaths, mapLabels, expectHoleRendered, expectNoWages, tapMap,
} from './mapping-helpers';

const WORKER_A = 'Synthetic GPS Worker A';
const WORKER_B = 'Synthetic GPS Worker B';
const BLOCK_NAME = 'Synthetic West Work Block';
const TASK = 'Synthetic block weeding inspection';

async function excludePocket(page: Page) {
  await chooseMode(page, 'exclude');
  await addPoints(page, POCKET);
  await page.getByTestId('accept-exclusion').click();
  await expect(page.getByTestId('mapping-mode-browse')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('measured-hectares')).toHaveText(`${USABLE_HA.toFixed(4)} ha`);
  await expectHoleRendered(page);
}

function assignments(page: Page) {
  return page.getByTestId('block-monitoring-panel').getByRole('button', { name: /^Update assignment / });
}

function assignmentFor(page: Page, worker: string) {
  return assignments(page).filter({ hasText: `${worker} · ${TASK} ·` });
}

async function openProgress(page: Page, worker: string) {
  const assignment = assignmentFor(page, worker);
  await expect(assignment).toHaveCount(1);
  const label = await assignment.getAttribute('aria-label');
  if (!label?.startsWith('Update assignment ')) throw new Error('Assignment has no accessible identity');
  const id = label.slice('Update assignment '.length);
  await assignment.click();
  const panel = page.getByTestId(`block-progress-${id}`);
  await expect(panel).toBeVisible();
  return { id, panel };
}

/** Real registry + Leaflet + local persistence acceptance; no map/service/DB mocks. */
test.describe('GPS labor blocks approved browser acceptance', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.beforeEach(async ({ page, baseURL }) => {
    test.setTimeout(300000);
    await localAdmin(page, baseURL);
  });

  for (const mode of ['exclude', 'block'] as const) {
    test(`GPS-POINTER draws ${mode} inside an already filled saved parcel without label, vertex or control additions`, async ({ page }) => {
      const name = `DUMMY: ${mode} pointer parcel`;
      await registerUnmeasuredParcel(page, name);
      await drawOuterManually(page);
      await reviewAndSave(page, OUTER_HA, 0);
      await expect(filledPaths(page)).toHaveCount(1);
      await chooseMode(page, mode);
      await page.getByRole('button', { name: 'Fit selected geometry', exact: true }).click();
      await expect(vertexRows(page)).toHaveCount(0);
      await expect(filledPaths(page)).toHaveCount(1);

      // Observe the saved rectangular SVG area only; no Leaflet API, injected
      // coordinates, forced clicks, or manual-input shortcuts for this outline.
      const outline = [[0.18, 0.65], [0.35, 0.65], [0.35, 0.82], [0.18, 0.82]];
      for (const [index, fraction] of outline.entries()) {
        const map = page.locator('.leaflet-container');
        await map.scrollIntoViewIfNeeded();
        const point = await filledPaths(page).first().evaluate((path, [xFraction, yFraction]) => {
          const svgPath = path as SVGPathElement;
          const bounds = path.getBoundingClientRect();
          const x = bounds.x + bounds.width * xFraction;
          const y = bounds.y + bounds.height * yFraction;
          const matrix = svgPath.getScreenCTM();
          if (!matrix) throw new Error('Saved parcel has no SVG projection');
          const hit = document.elementFromPoint(x, y);
          const container = path.closest('.leaflet-container');
          const mapBounds = container?.getBoundingClientRect();
          if (!mapBounds) throw new Error('Saved parcel has no mounted map');
          return {
            xFraction: (x - mapBounds.x) / mapBounds.width,
            yFraction: (y - mapBounds.y) / mapBounds.height,
            insideFill: svgPath.isPointInFill(new DOMPoint(x, y).matrixTransform(matrix.inverse())),
            unobstructed: !!hit && !!container?.contains(hit) && !hit.closest('.leaflet-marker-pane, .leaflet-tooltip-pane, .leaflet-control'),
          };
        }, fraction);
        expect(point.insideFill, 'Pointer must be inside the saved parcel fill, not on empty map').toBe(true);
        expect(point.unobstructed, 'Pointer must not hit a label, vertex or control').toBe(true);
        await tapMap(page, point.xFraction, point.yFraction);
        await expect(vertexRows(page)).toHaveCount(index + 1);
        await expect(vertexMarkers(page)).toHaveCount(index + 1);
        await expect(page.getByTestId('vertex-input-error')).toHaveCount(0);
      }

      await mapLabels(page).filter({ hasText: name }).click();
      await expect(vertexRows(page)).toHaveCount(4);
      await vertexMarkers(page).first().click();
      await expect(vertexMarkers(page).first().locator('[data-vertex-index="0"] > div')).toHaveCSS('width', '22px');
      await expect(vertexRows(page)).toHaveCount(4);
      await page.locator('.leaflet-control-zoom-in').click();
      await expect(vertexRows(page)).toHaveCount(4);
      await expect(vertexMarkers(page)).toHaveCount(4);

      if (mode === 'exclude') {
        await page.getByTestId('accept-exclusion').click();
        await expect(page.getByTestId('mapping-mode-browse')).toHaveAttribute('aria-pressed', 'true');
        await expectHoleRendered(page);
        const measured = Number((await page.getByTestId('measured-hectares').innerText()).replace(' ha', ''));
        expect(measured).toBeGreaterThan(0);
        expect(measured).toBeLessThan(OUTER_HA);
      } else {
        await page.getByTestId('preview-division').click();
        const division = page.getByTestId('block-division-panel');
        await expect(division.locator('[data-testid^="block-name-"]')).toHaveCount(1);
        await expect(division).toContainText('Unassigned remainder: 1 piece(s)');
        await expect(filledPaths(page)).toHaveCount(3);
        await expect(mapLabels(page).filter({ hasText: 'Preview · Block 1' })).toBeVisible();
        await expect(page.getByTestId('mapping-error')).toHaveCount(0);
      }
    });
  }

  test('GPS-BLOCKS outlined block retains a visible remainder and persists independent 40% / 0% worker progress without wages', async ({ page }) => {
    // These workers exist and are active before assignment, created by the actual roster UI.
    await registerWorker(page, WORKER_A);
    await registerWorker(page, WORKER_B);
    await expectNoWages(page); // Honest zero-wage baseline, not assignment-panel reassurance.
    const parcelId = await registerUnmeasuredParcel(page, 'Synthetic block acceptance parcel');
    await drawOuterManually(page);
    await reviewAndSave(page, OUTER_HA, 0);

    await excludePocket(page);
    await reviewAndSave(page, USABLE_HA, OUTER_HA);
    await chooseMode(page, 'block');
    await addPoints(page, BLOCK);
    await page.getByTestId('preview-division').click();
    const division = page.getByTestId('block-division-panel');
    await expect(division.getByRole('textbox', { name: 'Name for piece 1', exact: true })).toBeVisible();
    await expect(division.locator('[data-testid^="block-name-"]')).toHaveCount(1);
    await expect(division).toContainText(`Piece 1: ${BLOCK_HA.toFixed(4)} ha`);
    await expect(division).toContainText(`Unassigned remainder: 1 piece(s), ${(USABLE_HA - BLOCK_HA).toFixed(4)} ha`);
    // Prove geometry on the map, not just an optimistic inspector summary.
    await expect(filledPaths(page)).toHaveCount(3); // Parent, preview block, remainder.
    await expect(mapLabels(page).filter({ hasText: 'Unassigned remainder' })).toBeVisible();
    await expect(mapLabels(page).filter({ hasText: 'Preview · Block 1' })).toBeVisible();
    await division.getByRole('textbox', { name: 'Name for piece 1', exact: true }).fill(BLOCK_NAME);
    await page.getByTestId('accept-division').click();
    await expect(page.getByTestId('unsaved-badge')).toBeVisible();
    await expect(mapLabels(page).filter({ hasText: BLOCK_NAME })).toBeVisible();
    await expect(mapLabels(page).filter({ hasText: 'Unassigned remainder' })).toBeVisible();
    await expect(page.locator('[data-testid^="select-block-"]')).toHaveCount(1);
    const blockTestId = await page.locator('[data-testid^="select-block-"]').getAttribute('data-testid');
    if (!blockTestId) throw new Error('Accepted block has no selectable identity');
    const blockId = blockTestId.slice('select-block-'.length);
    await reviewAndSave(page, USABLE_HA, USABLE_HA);
    await expect(page.getByTestId('clear-saved-boundary')).toHaveCount(0); // Retained blocks cannot be erased by a clear.
    await expect(filledPaths(page)).toHaveCount(3);
    await expect.poll(() => filledPaths(page).evaluateAll(paths => paths.map(path =>
      (path.getAttribute('d') || '').match(/M/gi)?.length || 0
    ).sort())).toEqual([1, 2, 3]); // Block, parcel hole, remainder's parcel hole + block hole.

    // Select the actual rendered feature, not the inspector button as a substitute.
    await page.getByRole('button', { name: 'Fit selected geometry', exact: true }).click();
    await mapLabels(page).filter({ hasText: BLOCK_NAME }).click();
    await expect(page.getByTestId(`select-block-${blockId}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(mapLabels(page).filter({ hasText: BLOCK_NAME })).toContainText('Selected ·');
    await expect(page.getByTestId('block-filter-all')).toBeChecked();
    await expect(page.getByTestId('block-filter-unassigned')).not.toBeChecked();
    await page.getByTestId('block-filter-unassigned').click();
    await expect(page.getByTestId('block-filter-unassigned')).toBeChecked();
    await expect(page.getByTestId('block-filter-all')).not.toBeChecked();
    await page.getByTestId('block-filter-all').click();
    await page.getByTestId('assign-block-workers').click();
    const form = page.getByTestId('block-assignment-panel');
    await expect(form).toBeVisible();
    await expect(form.getByRole('checkbox')).toHaveCount(2);
    for (const worker of [WORKER_A, WORKER_B]) {
      await form.getByRole('checkbox', { name: `Assign ${worker}`, exact: true }).click();
      await expect(form.getByRole('checkbox', { name: `Assign ${worker}`, exact: true })).toBeChecked();
    }
    await form.getByRole('textbox', { name: 'Assignment task', exact: true }).fill(TASK);
    await form.getByRole('button', { name: 'Save worker assignments', exact: true }).click();
    await expect(form.getByText('Assignments saved locally.', { exact: true })).toBeVisible();
    await expect(assignments(page)).toHaveCount(2);
    for (const worker of [WORKER_A, WORKER_B]) {
      await expect(assignmentFor(page, worker)).toHaveText(`${worker} · ${TASK} · 0% · assigned`);
    }

    const first = await openProgress(page, WORKER_A);
    await first.panel.getByRole('textbox', { name: 'Progress percentage', exact: true }).fill('40');
    await first.panel.getByRole('radio', { name: 'Status in_progress', exact: true }).click();
    await first.panel.getByRole('textbox', { name: 'Progress notes', exact: true }).fill('Worker A inspected 40% of this block.');
    await first.panel.getByRole('button', { name: 'Save progress update', exact: true }).click();
    await expect(first.panel.getByText('Progress saved locally.', { exact: true })).toBeVisible();
    await expect(assignmentFor(page, WORKER_A)).toHaveText(`${WORKER_A} · ${TASK} · 40% · in_progress`);
    await expect(first.panel.getByRole('button', { name: /^Correct update / })).toHaveCount(1);
    await expect(first.panel.getByText(/ · 40% · in progress$/)).toBeVisible();
    await expect(assignmentFor(page, WORKER_B)).toHaveText(`${WORKER_B} · ${TASK} · 0% · assigned`);

    const second = await openProgress(page, WORKER_B);
    expect(second.id).not.toBe(first.id);
    await expect(second.panel.getByRole('textbox', { name: 'Progress percentage', exact: true })).toHaveValue('0');
    await expect(second.panel.getByRole('radio', { name: 'Status assigned', exact: true })).toBeChecked();
    await expect(second.panel.getByText('No supervisor updates yet.', { exact: true })).toBeVisible();
    await second.panel.getByRole('textbox', { name: 'Progress notes', exact: true }).fill('Worker B has not started.');
    await second.panel.getByRole('button', { name: 'Save progress update', exact: true }).click();
    await expect(second.panel.getByText('Progress saved locally.', { exact: true })).toBeVisible();
    await expect(second.panel.getByRole('button', { name: /^Correct update / })).toHaveCount(1);
    await expect(second.panel.getByText(/ · 0% · assigned$/)).toBeVisible();
    await expect(second.panel.getByText('Worker A inspected 40% of this block.', { exact: true })).toHaveCount(0);
    await expect(assignments(page)).toHaveCount(2);
    await expect(assignmentFor(page, WORKER_A)).toContainText('40% · in_progress');

    // A full browser reload proves durable records, not React state or a sidebar counter.
    await page.reload();
    await mappingReady(page, parcelId);
    await expect(page.getByTestId(`select-block-${blockId}`)).toBeVisible();
    await expect(filledPaths(page)).toHaveCount(3);
    await expect(mapLabels(page).filter({ hasText: 'Unassigned remainder' })).toBeVisible();
    await expect(page.getByTestId('measured-hectares')).toHaveText(`${USABLE_HA.toFixed(4)} ha`);
    await expect.poll(() => filledPaths(page).evaluateAll(paths => paths.map(path =>
      (path.getAttribute('d') || '').match(/M/gi)?.length || 0
    ).sort())).toEqual([1, 2, 3]);
    await page.getByRole('button', { name: 'Fit selected geometry', exact: true }).click();
    await mapLabels(page).filter({ hasText: BLOCK_NAME }).click();
    await page.getByTestId('assign-block-workers').click();
    await expect(assignments(page)).toHaveCount(2);
    await expect(assignmentFor(page, WORKER_A)).toHaveText(`${WORKER_A} · ${TASK} · 40% · in_progress`);
    await expect(assignmentFor(page, WORKER_B)).toHaveText(`${WORKER_B} · ${TASK} · 0% · assigned`);
    const persistedFirst = await openProgress(page, WORKER_A);
    expect(persistedFirst.id).toBe(first.id);
    await expect(persistedFirst.panel.getByRole('textbox', { name: 'Progress percentage', exact: true })).toHaveValue('40');
    await expect(persistedFirst.panel.getByRole('button', { name: /^Correct update / })).toHaveCount(1);
    await expect(persistedFirst.panel.getByText('Worker A inspected 40% of this block.', { exact: true })).toBeVisible();
    const persistedSecond = await openProgress(page, WORKER_B);
    expect(persistedSecond.id).toBe(second.id);
    await expect(persistedSecond.panel.getByRole('textbox', { name: 'Progress percentage', exact: true })).toHaveValue('0');
    await expect(persistedSecond.panel.getByRole('button', { name: /^Correct update / })).toHaveCount(1);
    await expect(persistedSecond.panel.getByText('Worker B has not started.', { exact: true })).toBeVisible();
    await expect(persistedSecond.panel.getByText('Worker A inspected 40% of this block.', { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: `D:/GitHub/JetFarm/tmp/systematic-test-matrix/gps-browser-blocks-${Date.now()}.png`,
      fullPage: true,
    });

    await expectNoWages(page);
    await safeNavigate(page, WORKERS_ROUTE, 'Farm Laborers & Staff');
    for (const worker of [WORKER_A, WORKER_B]) {
      const roster = workerCard(page, worker);
      await expect(roster).toHaveCount(1);
      await expect(roster).toContainText('0 log(s)');
      for (const label of ['Total Earnings', 'Pending Payout']) {
        await expect(roster.getByText(label, { exact: true }).locator('..')).toContainText(/₱\s*0\.00/);
      }
    }
  });

  test('GPS-CUT exactly two endpoints conserve all usable pieces including the excluded pocket after reload', async ({ page }) => {
    const parcelId = await registerUnmeasuredParcel(page, 'Synthetic two-point cut parcel');
    await drawOuterManually(page);
    await reviewAndSave(page, OUTER_HA, 0);
    await excludePocket(page);
    await reviewAndSave(page, USABLE_HA, OUTER_HA);
    await chooseMode(page, 'cut');
    await addPoints(page, [['-0.000200', '0.001000'], ['0.002200', '0.001000']]);
    await addVertex(page, '0.001000', '0.001000');
    await expect(page.getByTestId('vertex-input-error')).toContainText('exactly two points');
    await expect(vertexRows(page)).toHaveCount(2);
    await expect(vertexMarkers(page)).toHaveCount(2);
    await page.getByTestId('preview-division').click();
    const division = page.getByTestId('block-division-panel');
    await expect(division.locator('[data-testid^="block-name-"]')).toHaveCount(2);
    const expectedAreas = [OUTER_HA / 2, USABLE_HA - OUTER_HA / 2].map(area => area.toFixed(4)).sort();
    await expect.poll(async () => {
      const labels = await division.getByText(/^Piece \d+: [\d.]+ ha$/).allTextContents();
      return labels.map(label => label.match(/: ([\d.]+) ha$/)?.[1]).sort();
    }).toEqual(expectedAreas);
    await expect(division.getByText('No unassigned remainder', { exact: true })).toBeVisible();
    await expect(filledPaths(page)).toHaveCount(3); // Parent with hole plus both preview pieces.
    await expect(mapLabels(page).filter({ hasText: 'Preview ·' })).toHaveCount(2);
    await expect(mapLabels(page).filter({ hasText: 'Unassigned remainder' })).toHaveCount(0);
    await division.getByRole('textbox', { name: 'Name for piece 1', exact: true }).fill('Synthetic cut piece A');
    await division.getByRole('textbox', { name: 'Name for piece 2', exact: true }).fill('Synthetic cut piece B');
    await page.getByTestId('accept-division').click();
    await reviewAndSave(page, USABLE_HA, USABLE_HA);
    await expect(page.locator('[data-testid^="select-block-"]')).toHaveCount(2);
    const ids = await page.locator('[data-testid^="select-block-"]').evaluateAll(rows => rows.map(row => row.getAttribute('data-testid')).sort());
    await expect(filledPaths(page)).toHaveCount(3);
    await expect.poll(() => filledPaths(page).evaluateAll(paths => paths.map(path =>
      (path.getAttribute('d') || '').match(/M/gi)?.length || 0
    ).sort())).toEqual([1, 2, 2]); // One piece retains the pocket, plus the parent hole.
    await page.reload();
    await mappingReady(page, parcelId);
    await expect(page.locator('[data-testid^="select-block-"]')).toHaveCount(2);
    expect(await page.locator('[data-testid^="select-block-"]').evaluateAll(rows => rows.map(row => row.getAttribute('data-testid')).sort())).toEqual(ids);
    await expect(filledPaths(page)).toHaveCount(3);
    await expect(mapLabels(page).filter({ hasText: 'Synthetic cut piece' })).toHaveCount(2);
    await expect(mapLabels(page).filter({ hasText: 'Unassigned remainder' })).toHaveCount(0);
    await expect(page.getByTestId('measured-hectares')).toHaveText(`${USABLE_HA.toFixed(4)} ha`);
    await expect.poll(() => filledPaths(page).evaluateAll(paths => paths.map(path =>
      (path.getAttribute('d') || '').match(/M/gi)?.length || 0
    ).sort())).toEqual([1, 2, 2]);
  });

  const rejectedPockets: Array<{ name: string; points: readonly Coordinate[] }> = [
    { name: 'outside the parcel', points: [
      ['0.003000', '0.003000'], ['0.003000', '0.003400'],
      ['0.003400', '0.003400'], ['0.003400', '0.003000'],
    ] },
    { name: 'touching the outer edge', points: [
      ['0.000000', '0.000400'], ['0.000000', '0.000800'],
      ['0.000400', '0.000800'], ['0.000400', '0.000400'],
    ] },
  ];
  for (const { name, points } of rejectedPockets) {
    test(`GPS-EXCLUSION rejects a pocket ${name} and retains the saved usable area`, async ({ page }) => {
      await registerUnmeasuredParcel(page);
      await drawOuterManually(page);
      await reviewAndSave(page, OUTER_HA, 0);
      await chooseMode(page, 'exclude');
      await addPoints(page, points);
      await page.getByTestId('accept-exclusion').click();
      await expect(page.getByTestId('vertex-input-error')).toContainText('must lie strictly inside');
      await expect(page.getByTestId('mapping-mode-exclude')).toHaveAttribute('aria-pressed', 'true');
      await expect(vertexRows(page)).toHaveCount(4);
      await expect(vertexMarkers(page)).toHaveCount(4);
      await expect(page.getByTestId('measured-hectares')).toHaveText(`${OUTER_HA.toFixed(4)} ha`);
      await page.getByTestId('cancel-boundary-edit').click();
      await expect(page.getByTestId('unsaved-badge')).toHaveCount(0);
      await expectHoleRendered(page, 1);
      await page.reload();
      await mappingReady(page);
      await expectHoleRendered(page, 1);
      await expect(page.getByTestId('measured-hectares')).toHaveText(`${OUTER_HA.toFixed(4)} ha`);
    });
  }
});
