import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, readdirSync, statSync, readFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildVersionManifest } from './lib/buildVersionManifest.js';

const distDir = 'dist';
const redirectsPath = join(distDir, '_redirects');
const headersPath = join(distDir, '_headers');
const isWindows = process.platform === 'win32';

console.log('[deploy-cloudflare] Starting JetFarm Production Deployment (Web + Android APK)...');

// Fail fast before ANY mutation. Previously each upload site read .env.production
// independently, so a missing file could crash after the APK had already been
// published — a new installer live against a stale version.json.
const productionEnvPath = '.env.production';
if (!existsSync(productionEnvPath)) {
  console.error(
    `[deploy-cloudflare] Missing ${productionEnvPath}. Aborting before any upload.\n` +
    '  Provision it with EXPO_PUBLIC_SUPABASE_URL plus a write-capable Supabase key.\n' +
    '  See docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md, finding C2.'
  );
  process.exit(1);
}

const productionEnvContent = readFileSync(productionEnvPath, 'utf8');

function getProductionEnv(key) {
  const match = productionEnvContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return null;
  let val = match[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

const supabaseUrl = getProductionEnv('EXPO_PUBLIC_SUPABASE_URL') || getProductionEnv('SUPABASE_URL');
const supabaseKey =
  getProductionEnv('SUPABASE_SECRET_KEY') ||
  getProductionEnv('SUPABASE_SERVICE_ROLE_KEY') ||
  getProductionEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
  getProductionEnv('SUPABASE_PUBLISHABLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error(
    `[deploy-cloudflare] ${productionEnvPath} lacks a Supabase URL or write-capable key. Aborting before any upload.`
  );
  process.exit(1);
}

// 0. Ensure version synchronization
console.log('[deploy-cloudflare] Step 0: Verifying version synchronization across config files...');
const syncResult = spawnSync(
  isWindows ? 'node.cmd' : 'node',
  ['scripts/sync-version.mjs'],
  { stdio: 'inherit', shell: isWindows }
);
if (syncResult.status !== 0) {
  console.warn('[deploy-cloudflare] Warning: version sync exited with non-zero status.');
}

let appVersion = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (pkg.version) appVersion = pkg.version;
} catch (_) {}

let appConfig = {};
try {
  appConfig = JSON.parse(readFileSync('app.json', 'utf8'));
} catch (_) {}

const versionCode = Number(appConfig?.expo?.android?.versionCode || 1);
console.log(`[deploy-cloudflare] Deploying JetFarm v${appVersion} (Build ${versionCode})`);

// 1. Build Android APK Installer
const webOnly = process.argv.includes('--web-only');
const skipApkBuild = webOnly || process.argv.includes('--skip-apk-build') || process.argv.includes('--skip-build');
const skipApkUpload = webOnly || process.argv.includes('--skip-apk-upload');

if (!skipApkBuild) {
  console.log('[deploy-cloudflare] Step 1: Compiling Android APK installer for production...');
  const apkBuildResult = spawnSync(
    isWindows ? 'npm.cmd' : 'npm',
    ['run', 'android:production'],
    { stdio: 'inherit', shell: isWindows }
  );
  if (apkBuildResult.status !== 0) {
    console.error('[deploy-cloudflare] Android APK build failed! Halting deployment.');
    process.exit(apkBuildResult.status ?? 1);
  }
} else {
  console.log('[deploy-cloudflare] Step 1: Skipping Android APK compilation (web-only / skip-build)...');
}

// 2. Identify and Upload APK to Supabase Storage CDN
let apkRedirectUrl = '';
if (skipApkUpload) {
  console.log('[deploy-cloudflare] Step 2: Skipping APK upload to Supabase Storage CDN (--web-only / --skip-apk-upload)...');
} else {
  const releaseDir = join('android', 'app', 'build', 'outputs', 'apk', 'release');
  const apkCandidates = [
    join(releaseDir, 'app-arm64-v8a-release.apk'),
    join(releaseDir, 'app-release.apk'),
    join(releaseDir, 'app-universal-release.apk'),
    join(releaseDir, 'app-release-unsigned.apk'),
    join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  ];

  let apkSource = apkCandidates.find((p) => existsSync(p));
  if (!apkSource && existsSync(releaseDir)) {
    const apks = readdirSync(releaseDir).filter((f) => f.endsWith('.apk'));
    if (apks.length > 0) {
      apkSource = join(releaseDir, apks[0]);
    }
  }

  if (apkSource) {
    const stats = statSync(apkSource);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[deploy-cloudflare] Found APK at ${apkSource} (${sizeMb} MB). Uploading to Supabase Storage CDN...`);
  try {
    const { createClient } = await import('@supabase/supabase-js');

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const apkBuffer = readFileSync(apkSource);
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const { listObsoleteApkObjectNames } = require('./apkStorageRetention.js');

      // Upload versioned APK installer as primary target
      const versionedApkName = `JetFarm-v${appVersion}.apk`;
      const { error: versionedError } = await supabase.storage
        .from('downloads')
        .upload(versionedApkName, apkBuffer, {
          contentType: 'application/vnd.android.package-archive',
          upsert: true,
        });

      // Also upload jetfarm.apk for backward compatibility
      const { error } = await supabase.storage
        .from('downloads')
        .upload('jetfarm.apk', apkBuffer, {
          contentType: 'application/vnd.android.package-archive',
          upsert: true,
        });

      if (versionedError && error) {
        console.error('[deploy-cloudflare] Supabase upload failed for APK:', (versionedError || error).message);
      } else {
        apkRedirectUrl = `${supabaseUrl}/storage/v1/object/public/downloads/${versionedApkName}`;
        console.log('[deploy-cloudflare] Versioned APK uploaded successfully:', apkRedirectUrl);
      }

      // Delete historical obsolete APKs left in bucket (excluding current version)
      const { data: objects, error: listError } = await supabase.storage.from('downloads').list('', { limit: 1000 });
      if (listError) {
        console.warn('[deploy-cloudflare] Warning: could not list downloads bucket for cleanup:', listError.message);
      } else {
        const obsolete = listObsoleteApkObjectNames((objects || []).map((obj) => obj.name))
          .filter((name) => name !== versionedApkName && name !== versionedApkName.toLowerCase());
        if (obsolete.length > 0) {
          const { error: removeError } = await supabase.storage.from('downloads').remove(obsolete);
          if (removeError) {
            console.warn('[deploy-cloudflare] Warning: failed removing obsolete APKs:', removeError.message);
          } else {
            console.log(`[deploy-cloudflare] Cleaned obsolete versioned APKs: ${obsolete.join(', ')}`);
          }
        }
      }
    } else {
      console.error('[deploy-cloudflare] Supabase credentials not found in .env.production');
    }
  } catch (err) {
    console.error('[deploy-cloudflare] Failed to upload APK to Supabase Storage:', err);
  }
} else {
  console.warn('[deploy-cloudflare] Warning: No compiled APK binary found at expected paths.');
}
}


// 3. Export Web Application for Production
console.log('[deploy-cloudflare] Step 2: Exporting web app for production...');
const buildResult = spawnSync(
  isWindows ? 'npm.cmd' : 'npm',
  ['run', 'export:web:production'],
  { stdio: 'inherit', shell: isWindows }
);

if (buildResult.status !== 0) {
  console.error('[deploy-cloudflare] Web export failed! Exiting deployment.');
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(distDir)) {
  console.error(`[deploy-cloudflare] Error: Build output directory "${distDir}" does not exist!`);
  process.exit(1);
}

// 4. Create Cloudflare Pages Redirects File for SPA routing & APK downloads
console.log('[deploy-cloudflare] Step 3: Creating _redirects file for SPA client-side routing & APK downloads...');
let redirectsContent = `/* /index.html 200\n`;
if (apkRedirectUrl) {
  const versionedApkName = `JetFarm-v${appVersion}.apk`;
  redirectsContent =
    `/download ${apkRedirectUrl} 302\n` +
    `/download/ ${apkRedirectUrl} 302\n` +
    `/download/latest ${apkRedirectUrl} 302\n` +
    `/download/apk ${apkRedirectUrl} 302\n` +
    `/download/v* ${apkRedirectUrl} 302\n` +
    `/${versionedApkName} ${apkRedirectUrl} 302\n` +
    `/jetfarm.apk ${apkRedirectUrl} 302\n` +
    redirectsContent;
}
writeFileSync(redirectsPath, redirectsContent, 'utf8');
console.log('[deploy-cloudflare] Successfully wrote _redirects');

// 5. Create static fallback download page in dist/download/index.html
if (apkRedirectUrl) {
  const versionedApkName = `JetFarm-v${appVersion}.apk`;
  const downloadPageDir = join(distDir, 'download');
  mkdirSync(downloadPageDir, { recursive: true });
  const downloadHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${apkRedirectUrl}">
  <title>Downloading JetFarm APK...</title>
  <script>
    window.location.href = "${apkRedirectUrl}";
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
  <div style="text-align: center; padding: 2.5rem; background: #1e293b; border: 1px solid #334155; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); max-width: 440px; width: 90%;">
    <div style="font-size: 2.5rem; margin-bottom: 1rem;">🌾</div>
    <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem 0;">JetFarm Mobile App</h2>
    <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.75rem;">Your installer <strong>${versionedApkName}</strong> is downloading automatically. If it does not begin, click the button below.</p>
    <a href="${apkRedirectUrl}" download="${versionedApkName}" style="display: inline-block; width: 100%; box-sizing: border-box; background: #059669; color: #ffffff; padding: 0.875rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; font-size: 1rem; transition: background 0.2s;">Download ${versionedApkName}</a>
    <p style="color: #64748b; font-size: 0.8rem; margin-top: 1.5rem; margin-bottom: 0;">Version ${appVersion} (Build ${versionCode}) • JetFarm Android Release</p>
  </div>
</body>
</html>\n`;
  writeFileSync(join(downloadPageDir, 'index.html'), downloadHtml, 'utf8');
  console.log('[deploy-cloudflare] Successfully generated dist/download/index.html fallback page');
}

// 6. Generate version.json manifest for automatic in-app updates
console.log('[deploy-cloudflare] Step 4: Generating version.json manifest for In-App Auto-Updater...');

// The manifest contract lives in scripts/lib/buildVersionManifest.js so both deploy
// pipelines emit an identical version.json (bug audit §11.5).
let releaseNotesChanges = null;
let releaseNotesSummary = null;
try {
  const { GENERATED_APP_UPDATES } = await import('../src/constants/generatedAppUpdates.js').catch(async () => {
    return await import('../src/constants/appUpdates.js').catch(() => ({ GENERATED_APP_UPDATES: [] }));
  });
  const latest = GENERATED_APP_UPDATES?.[0];
  if (Array.isArray(latest?.changes) && latest.changes.length > 0) {
    releaseNotesChanges = latest.changes;
  } else if (latest?.summary) {
    releaseNotesSummary = latest.summary;
  }
} catch (_) {}

// The manifest must advertise the APK that was actually published. These literals
// pointed at the Hetzner vhost, which publishes no `/download` route (404) and a stale
// manifest, so every in-app "update now" link 404ed even when a valid APK had been uploaded.
const publicAppUrl = (getProductionEnv('EXPO_PUBLIC_APP_URL') || 'https://jetfarm.pages.dev').replace(/\/+$/, '');

const versionManifest = buildVersionManifest({
  appVersion,
  versionCode,
  publicAppUrl,
  apkRedirectUrl,
  releaseNotesChanges,
  releaseNotesSummary,
});

const versionJsonPath = join(distDir, 'version.json');
writeFileSync(versionJsonPath, JSON.stringify(versionManifest, null, 2), 'utf8');
console.log('[deploy-cloudflare] Successfully wrote dist/version.json');

// Upload version.json fallback to Supabase CDN
try {
  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: versionError } = await supabase.storage.from('downloads').upload('version.json', Buffer.from(JSON.stringify(versionManifest, null, 2)), {
      contentType: 'application/json',
      upsert: true,
    });
    if (versionError) {
      console.error('[deploy-cloudflare] version.json upload FAILED — CDN manifest is now stale relative to the published APK:', versionError.message);
      process.exitCode = 1;
    } else {
      console.log('[deploy-cloudflare] Successfully uploaded version.json to Supabase CDN fallback');
    }
  }
} catch (vErr) {
  console.error('[deploy-cloudflare] Supabase version.json upload threw:', vErr?.message || vErr);
  process.exitCode = 1;
}

// 7. Write Cloudflare Pages Headers File for Security Policies
console.log('[deploy-cloudflare] Step 5: Creating _headers file for security policies...');
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : 'https://supabase.818.quest';
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, 'ws');
const headersContent = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin} https://*.818.quest wss://*.818.quest https://*.supabase.co wss://*.supabase.co; upgrade-insecure-requests\n`;
writeFileSync(headersPath, headersContent, 'utf8');
console.log('[deploy-cloudflare] Successfully wrote _headers');

// 8. Post-Process to rename node_modules inside build folder for Cloudflare Pages
console.log('[deploy-cloudflare] Step 6: Post-processing build assets to bypass Cloudflare node_modules ignore filter...');
const nodeModulesPath = join(distDir, 'assets', 'node_modules');
const vendorModulesPath = join(distDir, 'assets', 'vendor_modules');

if (existsSync(nodeModulesPath)) {
  console.log('[deploy-cloudflare] Renaming assets/node_modules to assets/vendor_modules...');
  renameSync(nodeModulesPath, vendorModulesPath);

  const jsDir = join(distDir, '_expo', 'static', 'js', 'web');
  if (existsSync(jsDir)) {
    const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
    let updatedCount = 0;
    for (const jsFile of jsFiles) {
      const filePath = join(jsDir, jsFile);
      let content = readFileSync(filePath, 'utf8');
      if (content.includes('assets/node_modules/@react-navigation/elements/src/assets/')) {
        content = content.replaceAll('assets/node_modules/@react-navigation/elements/src/assets/', 'assets/nav_');
        writeFileSync(filePath, content, 'utf8');
        updatedCount++;
      }
    }
    console.log(`[deploy-cloudflare] Post-processing complete. Updated path references in ${updatedCount} files.`);
  }
}

// 9. Wrangler Deploy to Cloudflare Pages
const projectName = process.env.CLOUDFLARE_PROJECT_NAME || 'jetfarm';
console.log(`[deploy-cloudflare] Step 7: Uploading static files to Cloudflare Pages (project: ${projectName})...`);
const deployResult = spawnSync(
  isWindows ? 'npx.cmd' : 'npx',
  ['wrangler', 'pages', 'deploy', distDir, '--project-name', projectName, '--branch', 'main', '--commit-dirty=true'],
  { stdio: 'inherit', shell: isWindows }
);

if (deployResult.status !== 0) {
  console.error('[deploy-cloudflare] Wrangler deployment failed!');
  process.exit(deployResult.status ?? 1);
}

console.log(`[deploy-cloudflare] JetFarm v${appVersion} deployed successfully to Cloudflare Pages & Supabase Storage CDN!`);
process.exit(0);
