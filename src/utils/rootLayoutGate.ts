/**
 * Root-layout font gate decision (app/_layout.tsx).
 *
 * Why this exists: returning `null` from the root layout while expo-font
 * loads is safe on native (splash covers the wait), but on web it destroys
 * cold deep links. expo-router's NavigationContainer boots with the deep-link
 * navigation state, yet the navigator tree only mounts when the gate lifts;
 * the remount resets the focused group to its index route, useLinking
 * rewrites the URL to "/" and the index <Redirect> bounces the user to the
 * dashboard. Rendering the tree immediately on web keeps the deep state.
 */
export function shouldDeferRootRenderForFonts(
    fontsLoaded: boolean,
    fontError: unknown,
    platform: string,
): boolean {
    if (platform === 'web') return false;
    return !fontsLoaded && !fontError;
}
