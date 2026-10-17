import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

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
const MAPPING_ROUTE = '/agribusiness/mapping';

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

  test('the boundary map sizes itself to the viewport, not a fixed slab', async ({ page }) => {
    await openParcels(page);
    await safeNavigate(page, MAPPING_ROUTE, /GPS Boundary Mapping/i);

    const map = page.getByTestId('parcel-map');
    await expect(map).toBeVisible();

    const heightAt = async (width: number, height: number) => {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(300);
      const box = await map.boundingBox();
      expect(box).not.toBeNull();
      return box!;
    };

    const short = await heightAt(390, 640);
    const tall = await heightAt(390, 900);

    // A fixed height (the old 320px slab) would report the same number twice.
    expect(tall.height).toBeGreaterThan(short.height);
    // Proportional to the visible height: 45% of 640 = 288, of 900 = 405.
    expect(short.height).toBeGreaterThan(640 * 0.35);
    expect(short.height).toBeLessThan(640 * 0.55);
    expect(tall.height).toBeGreaterThan(900 * 0.35);
    expect(tall.height).toBeLessThan(900 * 0.55);
    // Must stay inside the phone width.
    expect(short.x + short.width).toBeLessThanOrEqual(390 + 1);
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
    await openParcels(page);
    await safeNavigate(page, MAPPING_ROUTE, /GPS Boundary Mapping/i);

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
