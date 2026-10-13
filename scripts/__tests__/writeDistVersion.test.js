'use strict';

const path = require('path');
const fs = require('fs');

describe('write-dist-version script', () => {
    const rootDir = path.resolve(__dirname, '..', '..');
    const distDir = path.join(rootDir, 'dist');
    const versionJsonPath = path.join(distDir, 'version.json');
    const scriptPath = path.join(rootDir, 'scripts', 'write-dist-version.mjs');

    it('script file exists', () => {
        expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it('emits a valid version.json into dist when executed', async () => {
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
        }
        if (fs.existsSync(versionJsonPath)) {
            fs.unlinkSync(versionJsonPath);
        }

        const { writeDistVersion } = require('../lib/writeDistVersionLib.js');
        const writtenPath = writeDistVersion();

        expect(writtenPath).toBe(versionJsonPath);
        expect(fs.existsSync(versionJsonPath)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        expect(manifest).toHaveProperty('latestVersion');
        expect(manifest).toHaveProperty('versionCode');
        expect(manifest).toHaveProperty('releaseTag');
        expect(manifest).toHaveProperty('apkUrl');

        // Assert against the source of truth (app.json), never a literal version:
        // hardcoding "0.1.1" made every release bump fail this suite.
        const appConfig = JSON.parse(
            fs.readFileSync(path.join(rootDir, 'app.json'), 'utf8')
        );
        const expectedVersion = appConfig.expo.version;
        const expectedVersionCode = Number(appConfig.expo.android.versionCode);

        expect(manifest.latestVersion).toBe(expectedVersion);
        expect(manifest.versionCode).toBe(expectedVersionCode);
        expect(manifest.releaseTag).toBe(`v${expectedVersion}`);
        expect(manifest.apkUrl).toContain(`/download/v${expectedVersion}`);
        expect(manifest.apkUrl).toMatch(/^https?:\/\//);
    });
});
