import {
    getResponsiveTokens,
    getPageContentStyle,
    TABLET_BREAKPOINT,
    DESKTOP_BREAKPOINT,
    COMPACT_PHONE_BREAKPOINT,
} from '../responsiveLayout';

/**
 * The client reported three symptoms, and each one is a token:
 *   - "dili pa fit to screen ang mobile portrait"  → pagePadding / kpiCardMinWidth
 *   - "ang map pud sa mobile app"                  → mapHeight
 *   - "tablet gaka scroll tanan"                   → bodyColumns / contentMaxWidth
 */
describe('getResponsiveTokens', () => {
    it('uses the Tailwind md breakpoint so the shell and the grids agree', () => {
        expect(TABLET_BREAKPOINT).toBe(768);
        expect(DESKTOP_BREAKPOINT).toBe(1024);
        expect(COMPACT_PHONE_BREAKPOINT).toBe(390);
    });

    it('tightens padding on a narrow portrait phone so content fits the screen', () => {
        const tokens = getResponsiveTokens(360, 640);
        expect(tokens.pagePadding).toBe(12);
        expect(tokens.isTabletOrLarger).toBe(false);
        expect(tokens.bodyColumns).toBe(1);
    });

    it('keeps a moderate padding on a standard phone', () => {
        expect(getResponsiveTokens(390, 844).pagePadding).toBe(16);
        expect(getResponsiveTokens(430, 932).pagePadding).toBe(16);
    });

    it('sizes the map to the viewport instead of a fixed slab on a phone', () => {
        // 45% of 640 = 288 — leaves room for the header and the vertex controls
        expect(getResponsiveTokens(360, 640).mapHeight).toBe(288);
    });

    it('never lets the map exceed 45% of the visible height', () => {
        const tokens = getResponsiveTokens(360, 400);
        // 0.45 * 400 = 180, clamped up to the 240 floor
        expect(tokens.mapHeight).toBe(240);
    });

    it('clamps a very tall viewport so the map does not swallow the page', () => {
        expect(getResponsiveTokens(430, 2000).mapHeight).toBe(520);
    });

    it('grows the map on a tablet where there is vertical room', () => {
        // 0.45 * 768 = 345.6 -> 346, above the tablet floor of 320
        expect(getResponsiveTokens(1024, 768).mapHeight).toBe(346);
    });

    it('switches the body to two columns at tablet width so pages stop scrolling forever', () => {
        const tokens = getResponsiveTokens(800, 1280);
        expect(tokens.isTabletOrLarger).toBe(true);
        expect(tokens.bodyColumns).toBe(2);
        expect(tokens.pagePadding).toBe(20);
    });

    it('constrains the line length on desktop instead of stretching cards full width', () => {
        const tokens = getResponsiveTokens(1440, 900);
        expect(tokens.contentMaxWidth).toBe(1180);
        expect(tokens.pagePadding).toBe(24);
    });

    it('leaves phones unconstrained so they use the whole width', () => {
        expect(getResponsiveTokens(390, 844).contentMaxWidth).toBe(Number.POSITIVE_INFINITY);
    });

    it('gives KPI cards a minimum width so a phone gets a scroll strip, not crushed cards', () => {
        expect(getResponsiveTokens(360, 640).kpiCardMinWidth).toBe(140);
        expect(getResponsiveTokens(800, 1280).kpiCardMinWidth).toBe(180);
    });

    it('rounds the map height to whole pixels', () => {
        const tokens = getResponsiveTokens(768, 1024);
        expect(Number.isInteger(tokens.mapHeight)).toBe(true);
    });
});

describe('getPageContentStyle', () => {
    it('gives a phone the viewport padding and no width cap', () => {
        const style = getPageContentStyle(getResponsiveTokens(360, 640));
        expect(style).toEqual({ padding: 12 });
    });

    it('caps and centres the column on a desktop so cards stop stretching', () => {
        const style = getPageContentStyle(getResponsiveTokens(1440, 900));
        expect(style).toEqual({
            padding: 24,
            maxWidth: 1180,
            width: '100%',
            marginHorizontal: 'auto',
        });
    });

    it('lets a screen add its own bottom room for a floating button', () => {
        const style = getPageContentStyle(getResponsiveTokens(360, 640), { paddingBottom: 96 });
        expect(style).toEqual({ padding: 12, paddingBottom: 96 });
    });

    it('does not let a zero cap slip through from a caller style', () => {
        const style = getPageContentStyle(getResponsiveTokens(360, 640), { paddingTop: 8 });
        expect(style.paddingTop).toBe(8);
        expect(style.padding).toBe(12);
    });
});
