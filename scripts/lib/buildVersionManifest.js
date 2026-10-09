'use strict';

/**
 * Shared builder for the `version.json` in-app-update manifest.
 *
 * History (docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md §11.5): the Cloudflare path had this
 * manifest inlined, and the Hetzner path (the real production pipeline) never emitted
 * version.json at all — so the update checker received the SPA index.html, threw on
 * `.json()`, and silently fell through. Both deploy scripts must build the manifest
 * through this one helper so the contract cannot drift apart again.
 *
 * Consumers: scripts/deploy-hetzner.mjs, scripts/deploy-cloudflare.mjs.
 */
function buildVersionManifest({
  appVersion,
  versionCode,
  publicAppUrl,
  apkRedirectUrl = null,
  releaseNotesChanges = null,
  releaseNotesSummary = null,
}) {
  if (!appVersion || typeof appVersion !== 'string') {
    throw new Error('buildVersionManifest: appVersion (string) is required');
  }
  if (!Number.isFinite(Number(versionCode))) {
    throw new Error('buildVersionManifest: versionCode (number) is required');
  }

  const [vMajor = 0, vMinor = 0, vPatch = 0] = String(appVersion)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const minSupportedVersion =
    vPatch > 0 ? `${vMajor}.${vMinor}.${vPatch - 1}` : `${vMajor}.${vMinor}.0`;

  const base = String(publicAppUrl || '').replace(/\/+$/, '');
  if (base && !/^https?:\/\//.test(base)) {
    throw new Error(`buildVersionManifest: publicAppUrl must include a scheme, got "${publicAppUrl}"`);
  }

  let releaseNotes =
    `• JetFarm Release v${appVersion}\n` +
    '• Mobile Android APK installer and Web App deployment\n' +
    '• Automated version synchronization and branding badges';
  if (Array.isArray(releaseNotesChanges) && releaseNotesChanges.length > 0) {
    releaseNotes = releaseNotesChanges.map((c) => `• ${c}`).join('\n');
  } else if (releaseNotesSummary) {
    releaseNotes = `• ${releaseNotesSummary}`;
  }

  // The manifest must advertise the APK that was actually published; fall back to
  // the download redirect on the deployed origin (never a hardcoded dead host).
  return {
    latestVersion: appVersion,
    versionCode,
    releaseTag: `v${appVersion}`,
    releaseDate: new Date().toISOString().split('T')[0],
    minSupportedVersion,
    apkUrl: apkRedirectUrl || `${base}/download/v${appVersion}`,
    apkLatestUrl: apkRedirectUrl || `${base}/download`,
    apkSizeMb: 60,
    releaseNotes,
    forceUpdate: false,
    autoDownload: true,
  };
}

module.exports = { buildVersionManifest };
