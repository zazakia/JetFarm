const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

/**
 * The runner and the web server must agree on the default port, and that default
 * must not be the legacy shared 19119: mapping specs refuse it because
 * `reuseExistingServer: !CI` can hand them a stale bundle left there.
 */
describe('Playwright web server port isolation', () => {
    const config = readFileSync(resolve(__dirname, '..', 'playwright.config.ts'), 'utf8');
    const server = readFileSync(resolve(__dirname, 'start-playwright-web.mjs'), 'utf8');
    const DEFAULT = "process.env.PLAYWRIGHT_WEB_PORT || '19129'";

    it('uses the same dedicated default port in both the runner and the server', () => {
        expect(config).toContain(DEFAULT);
        expect(server).toContain(DEFAULT);
    });

    it('no longer defaults to the legacy shared port anywhere in the harness', () => {
        expect(config).not.toContain("'19119'");
        expect(server).not.toContain("'19119'");
    });

    it('still reuses a running server outside CI', () => {
        expect(config).toContain('reuseExistingServer: !process.env.CI');
    });

    it('exposes mock-auth mode to the runner, not only to the web-server child', () => {
        // webServer.env reaches the server process alone. Specs assert the flag in their own
        // process, so the config must default it at module scope or every mapping spec fails
        // its precondition under a plain `npx playwright test`.
        expect(config).toMatch(
            /process\.env\.EXPO_PUBLIC_E2E_MODE\s*=\s*process\.env\.EXPO_PUBLIC_E2E_MODE\s*\|\|\s*'1'/,
        );
    });
});
