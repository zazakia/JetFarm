'use strict';

/**
 * Shared builder for the Cloudflare Pages `_headers` Content-Security-Policy.
 *
 * Why this exists: every generator used to inline its own copy of the policy, and each copy
 * drifted. The 2026-10-18 production console capture shows the consequence -- 26x
 * `Loading the image '<URL>' violates the following Content Security Policy directive:
 * "img-src 'self' data: blob:"`, because ParcelMap.web.tsx loads OpenStreetMap / ArcGIS
 * imagery tiles as plain <img> elements from the live document (see
 * src/components/ParcelMap/ParcelMap.web.tsx:98). Locally nothing is blocked because the Expo
 * dev server sends no CSP header at all, so the map looked fine in review and blanked in prod.
 *
 * Widening is deliberately scoped to img-src plus the Supabase storage origins. script-src,
 * style-src, object-src and frame-ancestors stay as strict as they were; the native APK path
 * keeps its own narrower meta CSP in src/components/ParcelMap/webview-html.ts.
 *
 * Consumers: scripts/deploy-cloudflare.mjs, scripts/prepare-cloudflare-dist.mjs,
 * scripts/export-web-staging.mjs.
 */

// Hosts the web bundle loads as images. Keep in sync with ParcelMap.web.tsx tile URLs.
const IMAGE_HOSTS = [
    'https://server.arcgisonline.com',
    'https://*.tile.openstreetmap.org',
];

// Supabase Storage is reachable on the hosted project and on the self-hosted stack.
const SUPABASE_STORAGE_HOSTS = ['https://*.supabase.co'];
const SUPABASE_STORAGE_WS_HOSTS = ['wss://*.supabase.co'];

// Same-box wildcard origins the app talks to (self-hosted Supabase + API hosts on 818.quest).
const SAME_BOX_HOSTS = ['https://*.818.quest', 'wss://*.818.quest'];

function requireOrigin(label, value, scheme) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`buildContentSecurityPolicy: ${label} is required (expected an absolute ${scheme} origin)`);
    }
    if (!value.startsWith(`${scheme}://`)) {
        throw new Error(`buildContentSecurityPolicy: ${label} must start with ${scheme}:// -- got "${value}"`);
    }
    if (value.endsWith('/')) {
        throw new Error(`buildContentSecurityPolicy: ${label} must be an origin without a trailing slash -- got "${value}"`);
    }
    return value;
}

/**
 * @param {object} options
 * @param {string} options.supabaseOrigin  e.g. `https://supabase.818.quest`
 * @param {string} options.supabaseWsOrigin same host, `ws`/`wss` scheme
 * @param {string[]} [options.extraConnectSrc] callers may append hosts (e.g. `https://github.com`)
 * @param {boolean} [options.sameBoxHosts] allow the `*.818.quest` origins in connect-src.
 *   True for the self-hosted stack (API + storage share that host); staging on a hosted
 *   Supabase project must leave it false so a staging bundle can never reach production.
 * @returns {string} the full policy, without a trailing newline or semicolon
 */
function buildContentSecurityPolicy({
    supabaseOrigin,
    supabaseWsOrigin,
    extraConnectSrc = [],
    sameBoxHosts = true,
}) {
    const httpOrigin = requireOrigin('supabaseOrigin', supabaseOrigin, 'https');
    const wsOrigin = requireOrigin('supabaseWsOrigin', supabaseWsOrigin, 'wss');

    if (!Array.isArray(extraConnectSrc)) {
        throw new Error('buildContentSecurityPolicy: extraConnectSrc must be an array of origins');
    }
    for (const origin of extraConnectSrc) {
        if (!/^https?:\/\//.test(origin)) {
            throw new Error(`buildContentSecurityPolicy: extraConnectSrc entries must be absolute http(s) origins -- got "${origin}"`);
        }
    }

    const directives = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        [
            'img-src',
            "'self'",
            'data:',
            'blob:',
            ...IMAGE_HOSTS,
            httpOrigin,
            ...SUPABASE_STORAGE_HOSTS,
        ].join(' '),
        "font-src 'self' data:",
        [
            'connect-src',
            "'self'",
            httpOrigin,
            wsOrigin,
            ...(sameBoxHosts ? SAME_BOX_HOSTS : []),
            ...SUPABASE_STORAGE_HOSTS,
            ...SUPABASE_STORAGE_WS_HOSTS,
            ...extraConnectSrc,
        ].join(' '),
        'upgrade-insecure-requests',
    ];

    return directives.join('; ');
}

module.exports = {
    buildContentSecurityPolicy,
    CSP_IMAGE_HOSTS: IMAGE_HOSTS,
    CSP_SUPABASE_STORAGE_HOSTS: SUPABASE_STORAGE_HOSTS,
};
