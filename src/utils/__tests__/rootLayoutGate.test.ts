import { shouldDeferRootRenderForFonts } from '../rootLayoutGate';

/**
 * Root-layout font gate regression.
 *
 * Cold-loading a deep URL on web used to render `null` from app/_layout.tsx
 * until expo-font resolved. During that window expo-router's
 * NavigationContainer boots with the deep-link state, but the navigator tree
 * only mounts after the gate lifts, at which point the focused group resets
 * to its index route — the URL is rewritten to "/" and the admin index
 * <Redirect> bounces the user to the dashboard. The gate must therefore
 * never defer on web; native keeps its splash-friendly behavior.
 */
describe('shouldDeferRootRenderForFonts', () => {
    it('does not defer on web while fonts are still loading (deep-link cold load must survive)', () => {
        expect(shouldDeferRootRenderForFonts(false, undefined, 'web')).toBe(false);
    });

    it('does not defer on web after fonts resolve', () => {
        expect(shouldDeferRootRenderForFonts(true, undefined, 'web')).toBe(false);
    });

    it('does not defer on web when font loading errored', () => {
        expect(shouldDeferRootRenderForFonts(false, new Error('font'), 'web')).toBe(false);
    });

    it('defers on native while fonts are loading and no error', () => {
        expect(shouldDeferRootRenderForFonts(false, undefined, 'ios')).toBe(true);
        expect(shouldDeferRootRenderForFonts(false, undefined, 'android')).toBe(true);
    });

    it('does not defer on native once fonts loaded', () => {
        expect(shouldDeferRootRenderForFonts(true, undefined, 'ios')).toBe(false);
    });

    it('does not defer on native when font loading errored', () => {
        expect(shouldDeferRootRenderForFonts(false, new Error('font'), 'android')).toBe(false);
    });
});
