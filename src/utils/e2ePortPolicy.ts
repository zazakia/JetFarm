/**
 * E2E port policy shared by the Playwright harness and the mapping specs.
 *
 * WHY THIS IS NOT A PINNED PORT: the mapping specs originally asserted an exact
 * baseURL of `http://127.0.0.1:19129`. The systematic-test-matrix runner
 * (.agents/skills/systematic-test-matrix/scripts/run_matrix.mjs) allocates a
 * dynamic free port instead, so an exact pin made those specs fail under every
 * automated entry point and pass only for a developer who exported the right
 * variable by hand.
 *
 * The hazard the pin was reaching for is real but narrower: playwright.config.ts
 * sets `reuseExistingServer: !process.env.CI`, so a run can silently attach to a
 * stale bundle left listening on the long-standing shared port. Refusing that one
 * port expresses the intent and still accepts any dedicated or dynamic port.
 */

/** Long-standing shared Playwright port; a server left here is routinely stale. */
export const LEGACY_SHARED_E2E_PORT = '19119';

/** Default port for the Playwright web server (playwright.config.ts + start-playwright-web.mjs). */
export const DEFAULT_E2E_PORT = '19129';

/** Port component of a base URL, or '' when absent/unparseable. */
export function portOf(baseURL: string | undefined): string {
    if (!baseURL) return '';
    try {
        return new URL(baseURL).port;
    } catch {
        return '';
    }
}

/**
 * True when the harness is serving on an explicit port other than the legacy
 * shared one. A missing port is rejected rather than assumed safe, so a
 * misconfigured baseURL cannot slip through as a passing precondition.
 */
export function isDedicatedE2EPort(baseURL: string | undefined): boolean {
    const port = portOf(baseURL);
    return port !== '' && port !== LEGACY_SHARED_E2E_PORT;
}
