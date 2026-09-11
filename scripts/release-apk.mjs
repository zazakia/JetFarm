import { spawnSync } from 'node:child_process';
import { readFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';

export async function buildAndReleaseApk(options = {}) {
  console.log('================================================================');
  console.log('🚀 [release-apk] Starting Automatic APK Build & Release Pipeline');
  console.log('================================================================');

  // 1. Read package version
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = options.version || pkg.version;
  const tag = `v${version}`;
  console.log(`[release-apk] Release Version: ${version} (Tag: ${tag})`);

  // 2. Build Release APK if needed
  const apkSource = join('android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!options.skipBuild) {
    console.log('[release-apk] Step 1: Compiling native Android APK via Gradle...');
    const buildResult = spawnSync(
      isWindows ? 'npm.cmd' : 'npm',
      ['run', 'android:production'],
      { stdio: 'inherit', shell: isWindows }
    );
    if (buildResult.status !== 0) {
      throw new Error(`APK compilation failed with exit code ${buildResult.status}`);
    }
  }

  if (!existsSync(apkSource)) {
    throw new Error(`Compiled APK not found at: ${apkSource}`);
  }

  // 3. Prepare release files
  const distApkDir = 'dist-apk';
  if (!existsSync(distApkDir)) {
    mkdirSync(distApkDir, { recursive: true });
  }

  const versionedApkName = `JetFarm-v${version}.apk`;
  const latestApkName = `jetfarm.apk`;
  const versionedApkPath = join(distApkDir, versionedApkName);
  const latestApkPath = join(distApkDir, latestApkName);

  copyFileSync(apkSource, versionedApkPath);
  copyFileSync(apkSource, latestApkPath);
  console.log(`[release-apk] Prepared release assets:`);
  console.log(`  - ${versionedApkPath}`);
  console.log(`  - ${latestApkPath}`);

  // 4. Publish to GitHub Releases via gh CLI
  console.log(`[release-apk] Step 2: Publishing Release to GitHub (${tag})...`);
  const releaseTitle = `JetFarm ${tag}`;
  const releaseNotes = `## JetFarm ${tag} Official Release

### Direct APK Downloads
- [Download JetFarm APK](${versionedApkName})
- Cloudflare Web Portal Mirror: https://jetfarm.pages.dev/download

### Release Information
- **Version**: \`${version}\`
- **Release Tag**: \`${tag}\`
- **Built**: ${new Date().toISOString()}
`;

  // Check if release tag already exists
  const viewResult = spawnSync('gh', ['release', 'view', tag], {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: isWindows,
  });

  if (viewResult.status === 0) {
    console.log(`[release-apk] Release ${tag} already exists. Uploading assets with --clobber...`);
    const uploadResult = spawnSync(
      'gh',
      ['release', 'upload', tag, versionedApkPath, latestApkPath, '--clobber'],
      { stdio: 'inherit', shell: isWindows }
    );
    if (uploadResult.status !== 0) {
      console.warn(`[release-apk] Asset upload warning (exit code ${uploadResult.status})`);
    }
  } else {
    console.log(`[release-apk] Creating new GitHub release ${tag}...`);
    const createResult = spawnSync(
      'gh',
      [
        'release',
        'create',
        tag,
        versionedApkPath,
        latestApkPath,
        '--title',
        releaseTitle,
        '--notes',
        releaseNotes,
      ],
      { stdio: 'inherit', shell: isWindows }
    );
    if (createResult.status !== 0) {
      console.warn(`[release-apk] Release create warning (exit code ${createResult.status})`);
    }
  }

  const directDownloadUrl = `https://github.com/zazakia/POS Cursor/releases/download/${tag}/${versionedApkName}`;
  const latestDownloadUrl = `https://github.com/zazakia/POS Cursor/releases/latest/download/${latestApkName}`;
  console.log('================================================================');
  console.log('✅ [release-apk] APK Build & GitHub Release Complete!');
  console.log(`📥 Versioned Download: ${directDownloadUrl}`);
  console.log(`📥 Latest Download:    ${latestDownloadUrl}`);
  console.log('================================================================');

  return {
    version,
    tag,
    directDownloadUrl,
    latestDownloadUrl,
  };
}

// Standalone execution
if (process.argv[1]?.endsWith('release-apk.mjs')) {
  buildAndReleaseApk()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[release-apk] Failed:', err);
      process.exit(1);
    });
}
