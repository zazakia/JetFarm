/**
 * Guard for the production CSP block (evidence: 2026-10-18 browser console capture, 26x
 * `Loading the image '<URL>' violates the following Content Security Policy directive:
 * "img-src 'self' data: blob:"`). The deployed bundle is served from Cloudflare Pages with
 * the `_headers` CSP emitted by scripts/deploy-cloudflare.mjs and scripts/prepare-cloudflare-dist.mjs.
 * ParcelMap.web.tsx loads its tiles from https://*.tile.openstreetmap.org (street) and
 * https://server.arcgisonline.com (satellite) directly into the document, so those hosts must be
 * in img-src or the map renders blank in production while working locally (no CSP on the dev server).
 *
 * Both generators must build the header through scripts/lib/buildContentSecurityPolicy.js so the
 * allow-list cannot drift apart again the way it did when each script inlined its own copy.
 */
const fs = require('fs');
const path = require('path');

const libPath = path.join(__dirname, '..', 'lib', 'buildContentSecurityPolicy.js');
const read = rel => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

const TILE_HOSTS = ['https://server.arcgisonline.com', 'https://*.tile.openstreetmap.org'];
const STORAGE_HOSTS = ['https://*.supabase.co'];

function imageSrcOf(csp) {
    const match = csp.match(/img-src([^;]*);/);
    if (!match) throw new Error(`no img-src directive in CSP: ${csp}`);
    return match[1];
}

describe('buildContentSecurityPolicy (shared _headers CSP builder)', () => {
    let buildContentSecurityPolicy;

    beforeAll(() => {
        ({ buildContentSecurityPolicy } = require(libPath));
    });

    it('allows the map-tile and storage hosts the app actually loads', () => {
        const csp = buildContentSecurityPolicy({
            supabaseOrigin: 'https://supabase.818.quest',
            supabaseWsOrigin: 'wss://supabase.818.quest',
        });
        const imgSrc = imageSrcOf(csp);

        for (const host of [...TILE_HOSTS, ...STORAGE_HOSTS]) {
            expect(imgSrc).toContain(host);
        }
        // The base list must survive; blob: is how the export inlines local imagery.
        for (const token of ["'self'", 'data:', 'blob:']) {
            expect(imgSrc).toContain(token);
        }
    });

    it('keeps the dangerous directives intact instead of loosening the whole policy', () => {
        const csp = buildContentSecurityPolicy({
            supabaseOrigin: 'https://supabase.818.quest',
            supabaseWsOrigin: 'wss://supabase.818.quest',
        });

        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("frame-ancestors 'none'");
        // Map tiles are <img> loads only: widening must not leak into script-src or connect-src.
        expect(csp).not.toMatch(/script-src[^;]*arcgisonline/);
        expect(csp).not.toMatch(/connect-src[^;]*arcgisonline/);
        // No host wildcard outside img-src/connect-src, and never a blanket source.
        expect(csp).not.toMatch(/(default|script|style|font|frame|object|base)-src [^;]*\*/);
        expect(csp).toMatch(/script-src 'self';/);
    });

    it('derives the Supabase origin into both img-src and connect-src from the caller', () => {
        const csp = buildContentSecurityPolicy({
            supabaseOrigin: 'https://db.example.com',
            supabaseWsOrigin: 'wss://db.example.com',
        });

        expect(imageSrcOf(csp)).toContain('https://db.example.com');
        expect(csp).toMatch(/connect-src[^;]*https:\/\/db\.example\.com/);
        expect(csp).toMatch(/connect-src[^;]*wss:\/\/db\.example\.com/);
    });

    it('lets a caller append connect-src hosts without touching the shared defaults', () => {
        const csp = buildContentSecurityPolicy({
            supabaseOrigin: 'https://supabase.818.quest',
            supabaseWsOrigin: 'wss://supabase.818.quest',
            extraConnectSrc: ['https://github.com'],
        });

        expect(csp).toMatch(/connect-src[^;]*https:\/\/github\.com/);
    });
});

describe('CSP generators stay on the shared builder', () => {
    const generators = [
        'scripts/deploy-cloudflare.mjs',
        'scripts/prepare-cloudflare-dist.mjs',
        'scripts/export-web-staging.mjs',
    ];

    it.each(generators)('%s builds the header through the shared lib', file => {
        const script = read(file);

        expect(script).toContain('buildContentSecurityPolicy');
        // A hardcoded narrow img-src here is exactly the bug this guard exists for.
        expect(script).not.toContain("img-src 'self' data: blob:;");
    });

    it('netlify.toml ships the same allow-list', () => {
        const toml = read('netlify.toml');
        const line = toml.split(/\r?\n/).find(l => l.includes('Content-Security-Policy'));

        expect(line).toBeDefined();
        for (const host of [...TILE_HOSTS, ...STORAGE_HOSTS]) {
            expect(line).toContain(host);
        }
    });

    it('the native webview map document keeps its own narrower CSP', () => {
        // The APK path runs Leaflet inside a WebView with its own meta CSP; the web allow-list
        // must not be copy-pasted there, and that file must not silently lose its tiles.
        const html = read('src/components/ParcelMap/webview-html.ts');

        for (const host of TILE_HOSTS) {
            expect(html).toContain(host);
        }
        expect(html).toContain("<meta http-equiv=\"Content-Security-Policy\"");
    });
});
