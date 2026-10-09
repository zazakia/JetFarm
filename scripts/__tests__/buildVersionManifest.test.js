/**
 * Guard for the production update-check gap (docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md §11.5):
 * the Hetzner pipeline never emitted dist/version.json, so every in-app update check
 * received the SPA index.html and silently failed. The manifest shape must be built by
 * one shared, tested helper used by BOTH deploy paths.
 */
const path = require('path');
const fs = require('fs');

const manifestPath = path.join(__dirname, '..', 'lib', 'buildVersionManifest.js');

describe('buildVersionManifest (version.json manifest helper)', () => {
    let buildVersionManifest;

    beforeAll(() => {
        ({ buildVersionManifest } = require(manifestPath));
    });

    it('builds the full manifest contract consumed by AppUpdateService', () => {
        const m = buildVersionManifest({
            appVersion: '0.1.1',
            versionCode: 7,
            publicAppUrl: 'https://jetfarm.818.quest',
        });

        expect(m.latestVersion).toBe('0.1.1');
        expect(m.versionCode).toBe(7);
        expect(m.releaseTag).toBe('v0.1.1');
        expect(m.minSupportedVersion).toBe('0.1.0');
        expect(m.apkUrl).toBe('https://jetfarm.818.quest/download/v0.1.1');
        expect(m.apkLatestUrl).toBe('https://jetfarm.818.quest/download');
        expect(m.forceUpdate).toBe(false);
        expect(m.autoDownload).toBe(true);
        expect(m.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('prefers the actually-published APK redirect URL when provided', () => {
        const m = buildVersionManifest({
            appVersion: '1.2.3',
            versionCode: 10,
            publicAppUrl: 'https://jetfarm.818.quest/',
            apkRedirectUrl: 'https://cdn.example/installed.apk',
        });

        expect(m.apkUrl).toBe('https://cdn.example/installed.apk');
        expect(m.apkLatestUrl).toBe('https://cdn.example/installed.apk');
    });

    it('never derives a double-slash download link from a trailing-slash base URL', () => {
        const m = buildVersionManifest({
            appVersion: '1.2.3',
            versionCode: 10,
            publicAppUrl: 'https://jetfarm.818.quest/',
        });
        expect(m.apkUrl).toBe('https://jetfarm.818.quest/download/v1.2.3');
        expect(m.apkLatestUrl).toBe('https://jetfarm.818.quest/download');
    });

    it('rolls minSupportedVersion back one patch, flooring at .0', () => {
        expect(buildVersionManifest({ appVersion: '2.0.5', versionCode: 1, publicAppUrl: 'https://x.invalid' }).minSupportedVersion).toBe('2.0.4');
        expect(buildVersionManifest({ appVersion: '2.0.0', versionCode: 1, publicAppUrl: 'https://x.invalid' }).minSupportedVersion).toBe('2.0.0');
        expect(buildVersionManifest({ appVersion: '0.1', versionCode: 1, publicAppUrl: 'https://x.invalid' }).minSupportedVersion).toBe('0.1.0');
    });

    it('uses provided release notes lines when given', () => {
        const m = buildVersionManifest({
            appVersion: '0.1.1',
            versionCode: 7,
            publicAppUrl: 'https://jetfarm.818.quest',
            releaseNotesChanges: ['Fixed ledger drift', 'Redacted PII logs'],
        });
        expect(m.releaseNotes).toBe('• Fixed ledger drift\n• Redacted PII logs');
    });
});

describe('deploy pipelines actually emit version.json', () => {
    const readScript = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

    it('deploy-hetzner.mjs writes dist/version.json via the shared helper before packaging', () => {
        const src = readScript('deploy-hetzner.mjs');
        expect(src).toContain('buildVersionManifest');
        expect(src).toContain('version.json');
    });

    it('deploy-cloudflare.mjs uses the shared helper instead of an inline manifest', () => {
        const src = readScript('deploy-cloudflare.mjs');
        expect(src).toContain('buildVersionManifest');
    });
});
