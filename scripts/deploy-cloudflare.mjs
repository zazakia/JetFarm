import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, readdirSync, statSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const redirectsPath = join(distDir, '_redirects');
const headersPath = join(distDir, '_headers');

console.log('[deploy-cloudflare] Starting Cloudflare Pages deployment process...');

// 1. Run the production build export script
console.log('[deploy-cloudflare] Step 1: Exporting web app for production...');
const isWindows = process.platform === 'win32';
const buildResult = spawnSync(
  isWindows ? 'npm.cmd' : 'npm',
  ['run', 'export:web:production'],
  { stdio: 'inherit', shell: isWindows }
);

if (buildResult.status !== 0) {
  console.error('[deploy-cloudflare] Web export failed! Exiting deployment.');
  process.exit(buildResult.status ?? 1);
}

// 2. Validate dist directory exists
if (!existsSync(distDir)) {
  console.error(`[deploy-cloudflare] Error: Build output directory "${distDir}" does not exist!`);
  process.exit(1);
}

// 2.5 Build APK
const skipApkBuild = process.argv.includes('--skip-apk-build') || process.argv.includes('--skip-build');
if (!skipApkBuild) {
  console.log('[deploy-cloudflare] Step 1.5: Building Android APK...');
  const apkBuildResult = spawnSync(
    isWindows ? 'npm.cmd' : 'npm',
    ['run', 'android:production'],
    { stdio: 'inherit', shell: isWindows }
  );
  if (apkBuildResult.status !== 0) {
    console.error('[deploy-cloudflare] Android APK build failed! Exiting deployment.');
    process.exit(apkBuildResult.status ?? 1);
  }
} else {
  console.log('[deploy-cloudflare] Step 1.5: Skipping Android APK compilation (using existing build)...');
}

let apkRedirectUrl = '';
const releaseDir = join('android', 'app', 'build', 'outputs', 'apk', 'release');
const apkCandidates = [
    join(releaseDir, 'app-arm64-v8a-release.apk'),
    join(releaseDir, 'app-release.apk'),
    join(releaseDir, 'app-universal-release.apk'),
    join(releaseDir, 'app-release-unsigned.apk')
];
let apkSource = apkCandidates.find(p => existsSync(p));
if (!apkSource && existsSync(releaseDir)) {
    const apks = readdirSync(releaseDir).filter(f => f.endsWith('.apk'));
    if (apks.length > 0) {
        apkSource = join(releaseDir, apks[0]);
    }
}

let appVersion = '0.1.0';
try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    if (pkg.version) appVersion = pkg.version;
} catch (_) {}

if (apkSource) {
    const stats = statSync(apkSource);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[deploy-cloudflare] Found APK at ${apkSource} (${sizeMb} MB). Uploading to Supabase Storage...`);
    try {
        const { createClient } = await import('@supabase/supabase-js');
        // Retrieve credentials from .env.production
        const envContent = readFileSync('.env.production', 'utf8');
        const getEnv = (key) => {
            const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
            if (!match) return null;
            let val = match[1].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            return val;
        };
        const supabaseUrl = getEnv('EXPO_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
        const supabaseKey = getEnv('SUPABASE_SECRET_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY');
        
        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const apkBuffer = readFileSync(apkSource);
            const { createRequire } = await import('node:module');
            const require = createRequire(import.meta.url);
            const { listObsoleteApkObjectNames } = require('./apkStorageRetention.js');
            
            // Upload only the mutable latest artifact. Versioned copies balloon Storage.
            const { error } = await supabase.storage
                .from('downloads')
                .upload('jetfarm.apk', apkBuffer, {
                    contentType: 'application/vnd.android.package-archive',
                    upsert: true
                });
                
            if (error) {
                console.error('[deploy-cloudflare] Supabase upload failed for jetfarm.apk:', error.message);
            } else {
                apkRedirectUrl = `${supabaseUrl}/storage/v1/object/public/downloads/jetfarm.apk`;
                console.log('[deploy-cloudflare] Latest APK uploaded successfully:', apkRedirectUrl);
            }

            // Delete any historical versioned APKs left in the bucket.
            const { data: objects, error: listError } = await supabase.storage.from('downloads').list('', { limit: 1000 });
            if (listError) {
                console.warn('[deploy-cloudflare] Warning: could not list downloads bucket for APK cleanup:', listError.message);
            } else {
                const obsolete = listObsoleteApkObjectNames((objects || []).map((obj) => obj.name));
                if (obsolete.length > 0) {
                    const { error: removeError } = await supabase.storage.from('downloads').remove(obsolete);
                    if (removeError) {
                        console.warn('[deploy-cloudflare] Warning: failed removing obsolete APKs:', removeError.message);
                    } else {
                        console.log(`[deploy-cloudflare] Removed obsolete versioned APKs: ${obsolete.join(', ')}`);
                    }
                }
            }
        } else {
            console.error('[deploy-cloudflare] Supabase credentials not found in .env.production');
        }
    } catch (err) {
        console.error('[deploy-cloudflare] Failed to upload APK:', err);
    }
} else {
    console.log('[deploy-cloudflare] Warning: APK file not found at expected path.');
}

// 3. Write Cloudflare Pages Redirects File for SPA routing & /download redirect
console.log('[deploy-cloudflare] Step 2: Creating _redirects file for SPA client-side routing & APK downloads...');
let redirectsContent = `/* /index.html 200\n`;
if (apkRedirectUrl) {
    redirectsContent = 
        `/download ${apkRedirectUrl} 302\n` +
        `/download/ ${apkRedirectUrl} 302\n` +
        `/download/latest ${apkRedirectUrl} 302\n` +
        `/download/apk ${apkRedirectUrl} 302\n` +
        `/download/v* ${apkRedirectUrl} 302\n` +
        `/jetfarm.apk ${apkRedirectUrl} 302\n` +
        redirectsContent;
}
writeFileSync(redirectsPath, redirectsContent, 'utf8');
console.log('[deploy-cloudflare] Successfully wrote _redirects');

// 3.5 Create static fallback download page in dist/download/index.html
if (apkRedirectUrl) {
    const { mkdirSync } = await import('node:fs');
    const downloadPageDir = join(distDir, 'download');
    mkdirSync(downloadPageDir, { recursive: true });
    const downloadHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${apkRedirectUrl}">
  <title>Downloading POS Cursor APK...</title>
  <script>
    window.location.href = "${apkRedirectUrl}";
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
  <div style="text-align: center; padding: 2.5rem; background: #1e293b; border: 1px solid #334155; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); max-width: 440px; width: 90%;">
    <div style="font-size: 2.5rem; margin-bottom: 1rem;">📱</div>
    <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem 0;">POS Cursor Mobile App</h2>
    <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.75rem;">Your APK download is starting automatically. If it does not begin, click the button below.</p>
    <a href="${apkRedirectUrl}" style="display: inline-block; width: 100%; box-sizing: border-box; background: #2563eb; color: #ffffff; padding: 0.875rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; font-size: 1rem; transition: background 0.2s;">Download APK Directly</a>
    <p style="color: #64748b; font-size: 0.8rem; margin-top: 1.5rem; margin-bottom: 0;">Version ${appVersion} • Android Release</p>
  </div>
</body>
</html>\n`;
    writeFileSync(join(downloadPageDir, 'index.html'), downloadHtml, 'utf8');
    console.log('[deploy-cloudflare] Successfully generated dist/download/index.html fallback page');
}

// 3.6 Generate version.json manifest for automatic in-app updates
console.log('[deploy-cloudflare] Step 2.5: Generating version.json manifest for In-App Auto-Updater...');
const appConfig = JSON.parse(readFileSync('app.json', 'utf8'));
const [vMajor, vMinor, vPatch] = String(appVersion).split('.').map((n) => parseInt(n, 10) || 0);
const minSupportedVersion = vPatch > 0 ? `${vMajor}.${vMinor}.${vPatch - 1}` : `${vMajor}.${vMinor}.0`;

let releaseNotes = '• POS Cursor Release v' + appVersion + '\n• Automatic in-app APK updater\n• Performance optimizations and offline persistence resilience';
try {
    const { GENERATED_APP_UPDATES } = await import('../src/constants/generatedAppUpdates.js').catch(async () => {
        return await import('../src/constants/appUpdates.js').catch(() => ({ GENERATED_APP_UPDATES: [] }));
    });
    if (GENERATED_APP_UPDATES && GENERATED_APP_UPDATES.length > 0) {
        const latest = GENERATED_APP_UPDATES[0];
        if (latest.changes && latest.changes.length > 0) {
            releaseNotes = latest.changes.map(c => `• ${c}`).join('\n');
        } else if (latest.summary) {
            releaseNotes = `• ${latest.summary}`;
        }
    }
} catch (_) {}

const versionManifest = {
    latestVersion: appVersion,
    versionCode: Number(appConfig?.expo?.android?.versionCode || 1),
    releaseTag: `v${appVersion}`,
    releaseDate: new Date().toISOString().split('T')[0],
    minSupportedVersion,
    apkUrl: `https://jetfarm.pages.dev/download/v${appVersion}`,
    apkLatestUrl: 'https://jetfarm.pages.dev/download',
    apkSizeMb: 60,
    releaseNotes,
    forceUpdate: false,
    autoDownload: true,
};

const versionJsonPath = join(distDir, 'version.json');
writeFileSync(versionJsonPath, JSON.stringify(versionManifest, null, 2), 'utf8');
console.log('[deploy-cloudflare] Successfully wrote dist/version.json');

// Upload version.json fallback to Supabase CDN
try {
    const envContent = readFileSync('.env.production', 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        if (!match) return null;
        let val = match[1].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        return val;
    };
    const supabaseUrl = getEnv('EXPO_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
    const supabaseKey = getEnv('SUPABASE_SECRET_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.storage.from('downloads').upload('version.json', Buffer.from(JSON.stringify(versionManifest, null, 2)), {
            contentType: 'application/json',
            upsert: true,
        });
        console.log('[deploy-cloudflare] Successfully uploaded version.json to Supabase CDN fallback');
    }
} catch (vErr) {
    console.warn('[deploy-cloudflare] Supabase version.json upload warning:', vErr?.message || vErr);
}

// 4. Write Cloudflare Pages Headers File for Security Policies
console.log('[deploy-cloudflare] Step 3: Creating _headers file for security policies...');
const headersContent = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://jetfarm-placeholder-db.supabase.co wss://jetfarm-placeholder-db.supabase.co; upgrade-insecure-requests\n`;
writeFileSync(headersPath, headersContent, 'utf8');
console.log('[deploy-cloudflare] Successfully wrote _headers');

// 5. Post-Process to rename `node_modules` inside build folder
// Cloudflare Pages/Wrangler ignores directories named `node_modules` during upload, which blocks vector icons.
console.log('[deploy-cloudflare] Step 4: Post-processing build assets to bypass Cloudflare node_modules ignore filter...');
const nodeModulesPath = join(distDir, 'assets', 'node_modules');
const vendorModulesPath = join(distDir, 'assets', 'vendor_modules');

if (existsSync(nodeModulesPath)) {
  console.log('[deploy-cloudflare] Found assets/node_modules directory. Renaming to assets/vendor_modules...');
  renameSync(nodeModulesPath, vendorModulesPath);
  console.log('[deploy-cloudflare] Directory renamed successfully.');

  // Recursive walk function to update paths in built files
  const walkDir = (dir, callback) => {
    readdirSync(dir).forEach(file => {
      const filePath = join(dir, file);
      if (statSync(filePath).isDirectory()) {
        walkDir(filePath, callback);
      } else {
        callback(filePath);
      }
    });
  };

  console.log('[deploy-cloudflare] Updating asset path references in JS, CSS, HTML, and JSON files...');
  let updatedCount = 0;
  const jsDir = join(distDir, '_expo', 'static', 'js', 'web');
  if (existsSync(jsDir)) {
    const jsFiles = readdirSync(jsDir).filter(f => f.endsWith('.js'));
    for (const jsFile of jsFiles) {
      const filePath = join(jsDir, jsFile);
      let content = readFileSync(filePath, 'utf8');
      if (content.includes('assets/node_modules/@react-navigation/elements/src/assets/')) {
        content = content.replaceAll('assets/node_modules/@react-navigation/elements/src/assets/', 'assets/nav_');
        writeFileSync(filePath, content, 'utf8');
        updatedCount++;
      }
    }
  }
  console.log(`[deploy-cloudflare] Post-processing complete. Updated path references in ${updatedCount} files.`);
} else {
  console.log('[deploy-cloudflare] Warning: assets/node_modules not found. Skipping rename step.');
}

const projectName = process.env.CLOUDFLARE_PROJECT_NAME || 'jetfarm';
console.log(`[deploy-cloudflare] Step 5: Uploading static files to Cloudflare Pages (project: ${projectName})...`);
const deployResult = spawnSync(
  isWindows ? 'npx.cmd' : 'npx',
  ['wrangler', 'pages', 'deploy', distDir, '--project-name', projectName, '--branch', 'main', '--commit-dirty=true'],
  { stdio: 'inherit', shell: isWindows }
);

if (deployResult.status !== 0) {
  console.error('[deploy-cloudflare] Wrangler deployment failed!');
  process.exit(deployResult.status ?? 1);
}

console.log('[deploy-cloudflare] Deployment to Cloudflare Pages completed successfully!');
process.exit(0);
