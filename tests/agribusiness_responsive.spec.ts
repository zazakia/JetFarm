import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';
import { registerUnmeasuredParcel, chooseMode } from './mapping-helpers';
import { getResponsiveTokens } from '../src/utils/responsiveLayout';

/**
 * Responsive layout E2E for the client report of 2026-10-16:
 *   "dili pa fit to screen ang mobile portrait, ang map pud sa mobile app,
 *    tablet gaka scroll tanan"
 *
 * These run against the real react-native-web build at the device sizes the
 * client named, and assert measurable geometry rather than class names: a page
 * that does not overflow horizontally, a map that is a fraction of the visible
 * height instead of a fixed 320px slab, and a registry that flows into two
 * columns on a tablet so the operator stops scrolling forever.
 */

const PARCELS_ROUTE = '/agribusiness/parcels';

/**
 * Detects both shapes of "does not fit the screen":
 *  - the document overflowing horizontally (a real horizontal scrollbar)
 *  - content clipped inside a container (overflow hidden hides it from the
 *    document metric, which is why a scrollWidth-only check can lie)
 * Intentional ellipsis truncation and horizontal scroll strips are excluded.
 */
async function findOverflowing(page: Page) {
  return page.evaluate(() => {
    const limit = window.innerWidth + 1;
    const offenders: string[] = [];

    const inScrollContainer = (el: Element) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node && node !== document.body) {
        // RN-web marks a real horizontal scroller with overflow-x: auto/scroll.
        // The page's own vertical scroller reports hidden, so it cannot
        // over-exclude the way a scrollWidth comparison would.
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowX)) return true;
        node = node.parentElement;
      }
      return false;
    };

    const isLeaflet = (el: Element) => {
      let node: Element | null = el;
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains('leaflet-container')) return true;
        node = node.parentElement;
      }
      return false;
    };

    const label = (el: Element, kind: string, extra: string) => {
      const testId = el.getAttribute('data-testid');
      const cls = (el.getAttribute('class') || '').replace(/css-\w+/, '').slice(0, 48);
      const text = (el.textContent || '').trim().slice(0, 28);
      offenders.push(`${kind} ${el.tagName}#${testId || 'no-testid'}[${cls}] "${text}" ${extra}`);
    };

    document.querySelectorAll('*').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const style = getComputedStyle(el);

      // Leaflet positions tiles and panes outside its own clipped viewport by
      // design; it is not a layout defect.
      if (isLeaflet(el)) return;

      if (rect.right > limit) {
        if (!inScrollContainer(el)) label(el, 'OFFSCREEN', `right=${Math.round(rect.right)}`);
        return;
      }

      const clipsX = /(hidden|clip)/.test(style.overflowX) && style.textOverflow !== 'ellipsis';
      if (clipsX && el.scrollWidth > el.clientWidth + 2 && !inScrollContainer(el)) {
        label(el, 'CLIPPED-X', `scroll=${el.scrollWidth} client=${el.clientWidth}`);
      }

      const clipsY = /(hidden|clip)/.test(style.overflowY) && style.textOverflow !== 'ellipsis';
      if (clipsY && el.scrollHeight > el.clientHeight + 8 && !inScrollContainer(el)) {
        label(el, 'CLIPPED-Y', `scroll=${el.scrollHeight} client=${el.clientHeight}`);
      }
    });

    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      offenders: offenders.slice(0, 15),
    };
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await findOverflowing(page);
  expect(
    metrics.scrollWidth,
    `page overflows horizontally at ${metrics.innerWidth}px. Offenders:\n${metrics.offenders.join('\n')}`
  ).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

async function openParcels(page: Page) {
  await loginAsAdmin(page);
  await safeNavigate(page, PARCELS_ROUTE, 'Track land parcels, acreage, soil quality');
}

test.describe('mobile portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the parcels registry fits the screen width', async ({ page }) => {
    await openParcels(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId('register-parcel-button')).toBeVisible();
  });

  test('no agribusiness route overflows a portrait phone', async ({ page }) => {
    await loginAsAdmin(page);
    const routes = [
      '/agribusiness',
      '/agribusiness/parcels',
      '/agribusiness/cycles',
      '/agribusiness/mapping',
      '/agribusiness/harvest',
      '/agribusiness/settlements',
      '/agribusiness/workers',
      '/agribusiness/investors',
      '/agribusiness/expenses',
      '/agribusiness/labor',
      '/agribusiness/analytics',
      '/agribusiness/accounting',
      '/agribusiness/implementation-report',
    ];

    const broken: string[] = [];
    const visited: string[] = [];
    for (const route of routes) {
      await safeNavigate(page, route);
      // A route that silently redirects would make the sweep vacuous.
      expect(page.url(), `did not land on ${route}`).toContain(route.replace('/agribusiness', 'agribusiness'));
      const metrics = await findOverflowing(page);
      visited.push(`${route}=${metrics.offenders.length}`);
      if (metrics.offenders.length > 0) {
        broken.push(`${route}:\n  ${metrics.offenders.join('\n  ')}`);
      }
    }
    console.log('[responsive-sweep] offender counts ' + visited.join(' '));
    expect(broken, `content clipped or off-screen at 390px:\n${broken.join('\n')}`).toEqual([]);
  });

  test('the boundary map fills the row its column grants instead of a fixed slab', async ({ page }) => {
    await loginAsAdmin(page);
    // The map only renders once a parcel is selected; register one through the real flow.
    await registerUnmeasuredParcel(page, `RESPONSIVE phone ${Date.now().toString().slice(-5)}`);

    const map = page.getByTestId('parcel-map');
    await expect(map).toBeVisible();

    const geometryAt = async (width: number, height: number) => {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(400);
      const box = await map.boundingBox();
      expect(box, `no map box at ${width}x${height}`).not.toBeNull();
      // Fitting the screen is the same client report: a proportional map that still pushes
      // the document past the viewport is not usable on a phone.
      const context = await page.evaluate(() => ({
        doc: document.documentElement.scrollHeight,
        area: Math.round((document.querySelector('[data-testid="mapping-map-area"]') as HTMLElement).getBoundingClientRect().height),
      }));
      expect(context.doc, `the page scrolls vertically at ${width}x${height}`).toBeLessThanOrEqual(height + 1);
      return { box: box!, ...context };
    };

    const short = await geometryAt(390, 640);
    const tall = await geometryAt(390, 900);

    // A fixed height (the old 320px slab) would report the same number twice.
    expect(tall.box.height).toBeGreaterThan(short.box.height);
    // Measured 2026-10-17: at 390px width the admin shell keeps 72px of top bar and 89px of
    // bottom nav, and this screen's header, search strip, mode strip and save bar keep 335px.
    // That leaves viewport minus 496px, so the previous "at least 35% of the window" floor is
    // arithmetically incompatible with fitting the page at 640. The stronger contract is that
    // the map fills the row its column grants, capped by its 45% height token (src/utils/
    // responsiveLayout.ts): at 640px the granted row is the tighter bound, at 900px the token
    // binds and leaves a little headroom above the save bar. Either bound being violated -
    // a fixed slab, or a token that ignores the row - fails here.
    const grantedRow = (height: number) => Math.min(
      height === 640 ? short.area : tall.area,
      getResponsiveTokens(390, height).mapHeight,
    );
    expect(short.box.height, `the map is neither the granted row nor its 45% token at 640`).toBeCloseTo(grantedRow(640), 0);
    expect(tall.box.height, `the map is neither the granted row nor its 45% token at 900`).toBeCloseTo(grantedRow(900), 0);
    // Keep a usable floor wherever the screen can afford one: at 900px the token is 405px,
    // so a 35% minimum is satisfiable together with fitting the page.
    expect(tall.box.height).toBeGreaterThan(900 * 0.35);
    expect(short.box.height).toBeLessThan(640 * 0.55);
    expect(tall.box.height).toBeLessThan(900 * 0.55);
    // Must stay inside the phone width.
    expect(short.box.x + short.box.width).toBeLessThanOrEqual(390 + 1);
  });

  test('the mapping column fits the portrait phone instead of scrolling the page', async ({ page }) => {
    await loginAsAdmin(page);
    await registerUnmeasuredParcel(page, `FIT phone ${Date.now().toString().slice(-5)}`);
    await chooseMode(page, 'boundary');

    // The client report is "dili pa fit to screen ang mobile portrait": the screen column
    // must resolve inside the viewport, not push the map under the save bar so that a map
    // tap lands on a button. Measure the whole column, not one element.
    const column = await page.evaluate(() => {
      const box = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
      };
      const roots = document.querySelectorAll('.flex-1.bg-gray-50');
      const screen = roots[roots.length - 1] as HTMLElement;
      const screenBox = screen.getBoundingClientRect();
      return {
        map: box('.leaflet-container'),
        save: box('[data-testid="save-boundary"]'),
        toolbar: box('[data-testid="mapping-toolbar"]'),
        details: box('[data-testid="parcel-details-panel"]'),
        screenBottom: Math.round(screenBox.bottom),
        doc: document.documentElement.scrollHeight,
        vh: window.innerHeight,
      };
    });
    const describe = JSON.stringify(column);
    expect(column.doc, `the document scrolls vertically at 390x844: ${describe}`).toBeLessThanOrEqual(column.vh + 1);
    expect(column.map!.bottom, `the map escapes the phone viewport: ${describe}`).toBeLessThanOrEqual(column.vh + 1);
    expect(column.save!.bottom, `the save action is below the fold: ${describe}`).toBeLessThanOrEqual(column.vh + 1);
    // A crushed toolbar is the signature of the flex race that hid the map.
    expect(column.toolbar!.height, `the mode strip grew into the map's space: ${describe}`).toBeLessThan(120);
    // The map tap target must be clear of the save bar, which is what swallowed real taps.
    expect(column.map!.bottom, `the map overlaps the save action: ${describe}`).toBeLessThanOrEqual(column.save!.top);
    await expect(page.getByTestId('save-boundary')).toBeVisible();
  });
});

/** Registers a parcel through the real UI so the column test has data to lay out. */
async function createParcel(page: Page, name: string) {
  await page.getByTestId('register-parcel-button').click();
  await page.getByTestId('parcel-name-input').fill(name);
  await page.getByTestId('parcel-code-input').fill(`RESP-${name.slice(-4)}`);
  await page.getByTestId('landowner-name-input').fill('Responsive Test Owner');
  await page.getByTestId('parcel-area-input').fill('2.5');
  await page.getByTestId('save-parcel-button').click();
  await expect(page.getByTestId('parcel-name-input')).toHaveCount(0);
  await expect(page.locator('[data-testid^="parcel-card-"]').filter({ hasText: name }).first()).toBeVisible();
}

test.describe('tablet landscape', () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test('registry cards flow into two columns so the page stops scrolling', async ({ page }) => {
    await openParcels(page);

    const cards = page.locator('[data-testid^="parcel-card-"]');
    if ((await cards.count()) < 2) {
      // The E2E database may start empty; the layout claim needs two records.
      await createParcel(page, `RESP A ${Date.now().toString().slice(-5)}`);
      await createParcel(page, `RESP B ${Date.now().toString().slice(-5)}`);
    }
    await expect(cards.nth(1)).toBeVisible();

    const a = await cards.nth(0).boundingBox();
    const b = await cards.nth(1).boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // Side by side: roughly the same vertical position, different horizontal one.
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(40);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width * 0.5);
    // Each card takes about half the column, not the full width.
    expect(a!.width).toBeLessThan(820 * 0.6);
  });

  test('the mapping screen shows the map and its tools on tablet', async ({ page }) => {
    await loginAsAdmin(page);
    await registerUnmeasuredParcel(page, `RESPONSIVE tablet ${Date.now().toString().slice(-5)}`);

    const map = page.getByTestId('parcel-map');
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    expect(box).not.toBeNull();
    // On a tablet the map gets real vertical room instead of the phone slab.
    expect(box!.height).toBeGreaterThanOrEqual(320);
    await expectNoHorizontalOverflow(page);
  });

  test('a 740px window uses the phone shell, matching the md grid breakpoint', async ({ page }) => {
    // The shell used to switch at 720 while Tailwind md is 768, so 720-767px
    // devices got a desktop sidebar around single-column phone content.
    await page.setViewportSize({ width: 740, height: 1180 });
    await openParcels(page);
    await expect(page.getByTestId('desktop-search-button')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
