'use strict';

const fs = require('fs');
const path = require('path');
const { buildVersionManifest } = require('./buildVersionManifest.js');

function writeDistVersion(customDistDir = null) {
    const rootDir = path.resolve(__dirname, '..', '..');
    const distDir = customDistDir || path.join(rootDir, 'dist');

    if (!fs.existsSync(distDir)) {
        return null;
    }

    const appConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'app.json'), 'utf8'));
    const appVersion = appConfig?.expo?.version || '0.0.0';
    const versionCode = Number(appConfig?.expo?.android?.versionCode || 1);
    const publicAppUrl = (process.env.EXPO_PUBLIC_APP_URL || 'https://jetfarm.818.quest').replace(/\/+$/, '');

    let releaseNotesChanges = null;
    const jsonPath = path.join(rootDir, 'src', 'constants', 'generatedAppUpdates.json');
    try {
        if (fs.existsSync(jsonPath)) {
            const updates = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const latest = updates?.[0];
            if (Array.isArray(latest?.changes) && latest.changes.length > 0) {
                releaseNotesChanges = latest.changes;
            }
        }
    } catch (_e) {}

    const versionManifest = buildVersionManifest({
        appVersion,
        versionCode,
        publicAppUrl,
        releaseNotesChanges,
    });

    const targetPath = path.join(distDir, 'version.json');
    fs.writeFileSync(targetPath, JSON.stringify(versionManifest, null, 2), 'utf8');
    return targetPath;
}

module.exports = { writeDistVersion };
