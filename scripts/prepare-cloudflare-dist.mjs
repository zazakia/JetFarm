/**
 * prepare-cloudflare-dist.mjs
 *
 * Generates Cloudflare Pages dist artefacts:
 *   _redirects  — SPA fallback + /download → APK
 *   _headers    — security headers
 *   dist/download/index.html — static APK download page
 *   dist/version.json — in-app updater manifest
 *
 * Called by ci-cd.yml after the web export so the download page is always
 * present regardless of whether a Supabase upload key is available.
 *
 * APK URL strategy (in priority order):
 *   1. APK_REDIRECT_URL env var (set by CI after upload)
 *   2. GitHub Releases latest download URL (derived from GITHUB_REPOSITORY)
 *   3. Fallback: <APP_URL>/download (self-referential, harmless)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';

// ── Read version from package.json ────────────────────────────────────────────
let appVersion = '0.1.0';
let versionCode = 1;
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (pkg.version) appVersion = pkg.version;
} catch (_) {}
try {
  const appJson = JSON.parse(readFileSync('app.json', 'utf8'));
  versionCode = Number(appJson?.expo?.android?.versionCode || 1);
} catch (_) {}

const versionedApkName = `JetFarm-v${appVersion}.apk`;
const repo = process.env.GITHUB_REPOSITORY || 'zazakia/JetFarm';
const githubReleaseApkUrl = `https://github.com/${repo}/releases/download/v${appVersion}/${versionedApkName}`;

const appUrl = (process.env.EXPO_PUBLIC_APP_URL || 'https://jetfarm.pages.dev').replace(/\/+$/, '');
let apkUrl = process.env.APK_REDIRECT_URL || githubReleaseApkUrl;

console.log(`[prepare-cloudflare-dist] Versioned APK Filename: ${versionedApkName}`);
console.log(`[prepare-cloudflare-dist] APK Download URL: ${apkUrl}`);
console.log(`[prepare-cloudflare-dist] App version: ${appVersion} (Build ${versionCode})`);

// ── 1. _redirects ─────────────────────────────────────────────────────────────
const redirectsPath = join(distDir, '_redirects');
const redirectsContent =
  `/download ${apkUrl} 302\n` +
  `/download/ ${apkUrl} 302\n` +
  `/download/latest ${apkUrl} 302\n` +
  `/download/apk ${apkUrl} 302\n` +
  `/download/v* ${apkUrl} 302\n` +
  `/${versionedApkName} ${apkUrl} 302\n` +
  `/jetfarm.apk ${apkUrl} 302\n` +
  `/* /index.html 200\n`;

writeFileSync(redirectsPath, redirectsContent, 'utf8');
console.log('[prepare-cloudflare-dist] ✅ Wrote _redirects');

// ── 2. _headers ───────────────────────────────────────────────────────────────
const headersPath = join(distDir, '_headers');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://supabase.818.quest';
let supabaseOrigin = supabaseUrl;
try { supabaseOrigin = new URL(supabaseUrl).origin; } catch (_) {}
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, 'ws');

const headersContent =
  `/*\n` +
  `  X-Frame-Options: DENY\n` +
  `  X-Content-Type-Options: nosniff\n` +
  `  Referrer-Policy: strict-origin-when-cross-origin\n` +
  `  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n` +
  `  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin} https://*.818.quest wss://*.818.quest https://*.supabase.co wss://*.supabase.co https://github.com; upgrade-insecure-requests\n`;

writeFileSync(headersPath, headersContent, 'utf8');
console.log('[prepare-cloudflare-dist] ✅ Wrote _headers');

// ── 3. dist/download/index.html ───────────────────────────────────────────────
const downloadPageDir = join(distDir, 'download');
mkdirSync(downloadPageDir, { recursive: true });

const downloadHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${apkUrl}">
  <title>Downloading JetFarm APK...</title>
  <script>window.location.href = "${apkUrl}";</script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
  <div style="text-align: center; padding: 2.5rem; background: #1e293b; border: 1px solid #334155; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); max-width: 440px; width: 90%;">
    <div style="font-size: 2.5rem; margin-bottom: 1rem;">🌾</div>
    <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem 0;">JetFarm Mobile App</h2>
    <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.75rem;">Your installer <strong>${versionedApkName}</strong> is downloading automatically. If it does not begin, click the button below.</p>
    <a href="${apkUrl}" download="${versionedApkName}" style="display: inline-block; width: 100%; box-sizing: border-box; background: #059669; color: #ffffff; padding: 0.875rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; font-size: 1rem;">Download ${versionedApkName}</a>
    <p style="color: #64748b; font-size: 0.8rem; margin-top: 1.5rem; margin-bottom: 0;">Version ${appVersion} (Build ${versionCode}) • JetFarm Android Release</p>
  </div>
</body>
</html>
`;

writeFileSync(join(downloadPageDir, 'index.html'), downloadHtml, 'utf8');
console.log('[prepare-cloudflare-dist] ✅ Wrote dist/download/index.html');

// ── 4. dist/version.json ──────────────────────────────────────────────────────
const versionManifest = {
  latestVersion: appVersion,
  versionCode,
  releaseTag: `v${appVersion}`,
  releaseDate: new Date().toISOString().slice(0, 10),
  minSupportedVersion: '0.1.0',
  apkUrl,
  apkLatestUrl: `${appUrl}/download`,
  apkSizeMb: 60,
  releaseNotes: `• JetFarm Release v${appVersion}\n• Mobile Android APK installer and Web App deployment\n• Automated version synchronization and branding badges`,
  forceUpdate: false,
  autoDownload: true,
};

const versionJsonPath = join(distDir, 'version.json');
writeFileSync(versionJsonPath, JSON.stringify(versionManifest, null, 2), 'utf8');
console.log('[prepare-cloudflare-dist] ✅ Wrote dist/version.json');

// ── 5. Rename node_modules → vendor_modules ──────────────────────────────────
import { readdirSync, statSync, renameSync } from 'node:fs';

const nodeModulesPath = join(distDir, 'assets', 'node_modules');
const vendorModulesPath = join(distDir, 'assets', 'vendor_modules');

if (existsSync(nodeModulesPath)) {
  renameSync(nodeModulesPath, vendorModulesPath);

  const jsDir = join(distDir, '_expo', 'static', 'js', 'web');
  if (existsSync(jsDir)) {
    const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
    let updatedCount = 0;
    for (const jsFile of jsFiles) {
      const filePath = join(jsDir, jsFile);
      let content = readFileSync(filePath, 'utf8');
      if (content.includes('assets/node_modules/')) {
        content = content.replaceAll('assets/node_modules/', 'assets/vendor_modules/');
        writeFileSync(filePath, content, 'utf8');
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`[prepare-cloudflare-dist] ✅ Renamed vendor paths in ${updatedCount} JS files`);
    }
  }

  console.log('[prepare-cloudflare-dist] ✅ Renamed assets/node_modules → assets/vendor_modules');
}

console.log('[prepare-cloudflare-dist] 🚀 Cloudflare dist preparation complete!');
