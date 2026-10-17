/**
 * Responsive layout tokens.
 *
 * The agribusiness screens were a single full-width column with a fixed 20px
 * pad and a 320px map slab, so a portrait phone overflowed and a tablet
 * scrolled forever ("gaka scroll tanan"). Centralising the numbers here keeps
 * every screen honest and makes the breakpoints unit-testable.
 *
 * Breakpoints match the Tailwind defaults that NativeWind evaluates (md=768,
 * lg=1024) so `md:` grid classes and JS-driven layout never disagree — the old
 * admin shell used 720, which left 720-767px devices with a desktop sidebar and
 * a phone body.
 */

export const COMPACT_PHONE_BREAKPOINT = 390;
export const TABLET_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1024;

/** The map takes this fraction of the visible height before clamping. */
const MAP_HEIGHT_RATIO = 0.45;
const MAP_HEIGHT_MIN_PHONE = 240;
const MAP_HEIGHT_MIN_TABLET = 320;
const MAP_HEIGHT_MAX = 520;

/** Longest comfortable line length on a wide screen. */
const CONTENT_MAX_WIDTH_DESKTOP = 1180;

export interface ResponsiveTokens {
    /** Horizontal/vertical padding for a page content container. */
    pagePadding: number;
    /** Cap on the page content width; Infinity below desktop. */
    contentMaxWidth: number;
    /** How many columns the card grid should flow into. */
    bodyColumns: 1 | 2;
    /** Height for an embedded map, sized to the viewport. */
    mapHeight: number;
    /** Minimum width of a KPI card in a horizontal strip. */
    kpiCardMinWidth: number;
    isTabletOrLarger: boolean;
    isDesktopOrLarger: boolean;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function getResponsiveTokens(width: number, height: number): ResponsiveTokens {
    const isTabletOrLarger = width >= TABLET_BREAKPOINT;
    const isDesktopOrLarger = width >= DESKTOP_BREAKPOINT;

    const pagePadding = isDesktopOrLarger
        ? 24
        : isTabletOrLarger
          ? 20
          : width >= COMPACT_PHONE_BREAKPOINT
            ? 16
            : 12;

    const mapFloor = isTabletOrLarger ? MAP_HEIGHT_MIN_TABLET : MAP_HEIGHT_MIN_PHONE;
    const mapHeight = Math.round(clamp(MAP_HEIGHT_RATIO * height, mapFloor, MAP_HEIGHT_MAX));

    return {
        pagePadding,
        contentMaxWidth: isDesktopOrLarger ? CONTENT_MAX_WIDTH_DESKTOP : Number.POSITIVE_INFINITY,
        bodyColumns: isTabletOrLarger ? 2 : 1,
        mapHeight,
        kpiCardMinWidth: isTabletOrLarger ? 180 : 140,
        isTabletOrLarger,
        isDesktopOrLarger,
    };
}

/**
 * contentContainerStyle for a page ScrollView. Screens pass their own extras
 * (a bottom gap for a floating button) which always win over the defaults.
 */
export function getPageContentStyle(
    tokens: ResponsiveTokens,
    extra?: Record<string, number | string>,
): Record<string, number | string> {
    const capped = Number.isFinite(tokens.contentMaxWidth);
    return {
        padding: tokens.pagePadding,
        ...(capped
            ? { maxWidth: tokens.contentMaxWidth, width: '100%', marginHorizontal: 'auto' }
            : {}),
        ...(extra ?? {}),
    };
}
