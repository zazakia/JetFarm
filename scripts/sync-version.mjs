import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const isBump = process.argv.includes('--bump') || process.argv.includes('--patch');
const isMinor = process.argv.includes('--minor');
const isMajor = process.argv.includes('--major');

// 1. Read package.json
const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

// 2. Read app.json
const appJsonPath = 'app.json';
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));

// Read the live WatermelonDB schema version instead of hardcoding it. A frozen
// literal here silently reverted AppVersion.ts to "Schema v25" after every bump.
const schemaPath = path.join('src', 'database', 'schema.ts');
const schemaMatch = readFileSync(schemaPath, 'utf8').match(/appSchema\(\{\s*version:\s*(\d+)/);
if (!schemaMatch) {
  console.error(`[sync-version] Could not read appSchema version from ${schemaPath}`);
  process.exit(1);
}
const schemaVersion = Number(schemaMatch[1]);
console.log(`[sync-version] WatermelonDB schema version: v${schemaVersion}`);

let currentVersion = pkg.version || '0.1.0';
let [major, minor, patch] = currentVersion.split('.').map((n) => parseInt(n, 10) || 0);

let currentVersionCode = Number(appJson.expo?.android?.versionCode || 1);

let newVersion = currentVersion;
let newVersionCode = currentVersionCode;

if (isMajor) {
  major += 1;
  minor = 0;
  patch = 0;
  newVersion = `${major}.${minor}.${patch}`;
  newVersionCode += 1;
} else if (isMinor) {
  minor += 1;
  patch = 0;
  newVersion = `${major}.${minor}.${patch}`;
  newVersionCode += 1;
} else if (isBump) {
  patch += 1;
  newVersion = `${major}.${minor}.${patch}`;
  newVersionCode += 1;
}

// Ensure parity between package.json and app.json
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

if (!appJson.expo) appJson.expo = {};
// On the agribusiness-only variant the published brand is Agri-One. Hardcoding the old brand here
// silently reverted app.json on every version bump, so the value is read from the file and only
// defaulted when the field is genuinely missing.
const brandName = appJson.expo.name || 'Agri-One';
const brandSlug = appJson.expo.slug || 'agri-one';
appJson.expo.name = brandName;
appJson.expo.slug = brandSlug;
appJson.expo.version = newVersion;
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = newVersionCode;
writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');

// 3. Update src/constants/AppVersion.ts
const appVersionPath = path.join('src', 'constants', 'AppVersion.ts');
const today = new Date().toISOString().split('T')[0];

const appVersionContent = `import Constants from 'expo-constants';
import { getRuntimeSupabaseUrl } from '../database/supabaseUrl';

export const APP_VERSION = '${newVersion}';
export const APP_BUILD_NUMBER = ${newVersionCode};
export const APP_RELEASE_NAME = 'v${newVersion}';
export const WATERMELONDB_SCHEMA_VERSION = ${schemaVersion};
export const APP_RELEASE_DATE = '${today}';

/**
 * Origin that serves \`/download\` and \`/version.json\`. Production is the Cloudflare Pages
 * deployment, which publishes the redirect, the download page and a current manifest. The
 * self-hosted Hetzner vhost still serves the app but has no \`/download\` route (404) and a
 * stale manifest, so it is not the default release origin.
 */
export const PRODUCTION_APP_URL = 'https://jetfarm.pages.dev';

/**
 * Resolves the origin used for release and update URLs: an explicit build-time
 * override wins, then the browser's own origin (so preview deploys and localhost
 * stay self-consistent), then the production default.
 */
export const resolvePublicAppUrl = (
    envUrl: string | undefined = process.env.EXPO_PUBLIC_APP_URL,
    webOrigin: string | undefined =
        typeof window !== 'undefined' ? window.location?.origin : undefined
): string => {
    const stripTrailingSlash = (value?: string) => (value || '').replace(/\\/+$/, '');
    const httpOnly = (value?: string) => {
        const normalized = stripTrailingSlash(value);
        return /^https?:\\/\\//i.test(normalized) ? normalized : '';
    };

    return httpOnly(envUrl) || httpOnly(webOrigin) || PRODUCTION_APP_URL;
};

export const PUBLIC_APP_URL = resolvePublicAppUrl();

export const APP_DOWNLOAD_URL = \`\${PUBLIC_APP_URL}/download\`;
export const APP_VERSIONED_DOWNLOAD_URL = \`\${PUBLIC_APP_URL}/download/v\${APP_VERSION}\`;

export const PRIMARY_VERSION_URL = \`\${PUBLIC_APP_URL}/version.json\`;

// deploy-cloudflare.mjs mirrors version.json into the public \`downloads\` bucket,
// so the fallback must be that origin: identical values made the retry useless.
export const FALLBACK_VERSION_URL = \`\${getRuntimeSupabaseUrl(
    process.env.EXPO_PUBLIC_SUPABASE_URL || ''
)}/storage/v1/object/public/downloads/version.json\`;

/**
 * Returns the current runtime application version string (e.g. "${newVersion}").
 */
export function getAppVersion(): string {
    return Constants.expoConfig?.version || APP_VERSION;
}

/**
 * Returns the formatted release badge (e.g. "v${newVersion}").
 */
export function getReleaseName(): string {
    return \`v\${getAppVersion()}\`;
}

/**
 * Returns the full release string including build number and database schema version.
 */
export function getFullReleaseString(): string {
    return \`v\${getAppVersion()} (Build \${APP_BUILD_NUMBER} • Schema v\${WATERMELONDB_SCHEMA_VERSION})\`;
}

/**
 * Returns standard footer copyright & release text.
 */
export function getAppFooterText(): string {
    return \`JetFarm \${getReleaseName()} • Build \${APP_BUILD_NUMBER}\`;
}
`;

writeFileSync(appVersionPath, appVersionContent, 'utf8');
console.log(`[sync-version] Synchronized version ${newVersion} (Build ${newVersionCode}) across package.json, app.json, and AppVersion.ts`);

// 4. Trigger updates generator
try {
  const isWindows = process.platform === 'win32';
  spawnSync(isWindows ? 'npm.cmd' : 'npm', ['run', 'generate:updates'], { stdio: 'inherit', shell: isWindows });
} catch (e) {
  console.warn('[sync-version] Note: Could not run generate:updates:', e?.message || e);
}
