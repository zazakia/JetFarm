const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

describe('Playwright web server port isolation', () => {
    it('uses the POS Cursor-specific default port in both the runner and server', () => {
        const config = readFileSync(resolve(__dirname, '..', 'playwright.config.ts'), 'utf8');
        const server = readFileSync(resolve(__dirname, 'start-playwright-web.mjs'), 'utf8');

        expect(config).toContain("process.env.PLAYWRIGHT_WEB_PORT || '19119'");
        expect(server).toContain("process.env.PLAYWRIGHT_WEB_PORT || '19119'");
        expect(config).toContain('reuseExistingServer: !process.env.CI');
    });
});
