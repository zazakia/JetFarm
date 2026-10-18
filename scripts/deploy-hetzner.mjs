import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildVersionManifest } = require('./lib/buildVersionManifest.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const HETZNER_HOST = process.env.HETZNER_HOST || '46.225.190.206';
const HETZNER_SSH = process.env.HETZNER_SSH_ALIAS || 'hetzner';
const DOMAIN = 'jetfarm.818.quest';
const FALLBACK_DOMAIN = 'jetfarm.46.225.190.206.sslip.io';
const REMOTE_APP_DIR = '/home/deploy/apps/jetfarm';
const REMOTE_SITE_DIR = '/home/deploy/apps/jetfarm/site';

console.log('\n🚀 =================================================================');
console.log('   JETFARM — Hetzner Production Deployment Pipeline');
console.log(`   Target Host: ${HETZNER_HOST} (${DOMAIN})`);
console.log(`   Fallback URL: https://${FALLBACK_DOMAIN}`);
console.log('=================================================================\n');

// Stage 1: Pre-Flight Probe
function preflightCheck() {
  console.log('📡 [Stage 1: Pre-Flight] Checking SSH connection to Hetzner...');
  try {
    const out = execSync(`ssh -o BatchMode=yes -o ConnectTimeout=8 ${HETZNER_SSH} "echo OK"`, { encoding: 'utf8' }).trim();
    if (out !== 'OK') throw new Error(`Unexpected SSH output: ${out}`);
    console.log('  ✓ SSH connection to Hetzner VPS is active');
  } catch (err) {
    console.error('  ❌ SSH connection failed:', err.message);
    process.exit(1);
  }

  try {
    const memory = execSync(`ssh ${HETZNER_SSH} "free -h | grep Mem | awk '{print \\$3 \\\" used / \\\" \\$4 \\\" free\\\"}'"`, { encoding: 'utf8' }).trim();
    const disk = execSync(`ssh ${HETZNER_SSH} "df -h / | tail -n 1 | awk '{print \\$3 \\\" used / \\\" \\$4 \\\" avail\\\"}'"`, { encoding: 'utf8' }).trim();
    console.log(`  ✓ Server Memory: ${memory}`);
    console.log(`  ✓ Root Disk Space: ${disk}`);
  } catch (err) {
    console.warn('  ⚠ Unable to read server telemetry:', err.message);
  }
}

// Stage 2: Database Migration Sync
function syncDatabaseMigrations() {
  console.log('\n🗄️  [Stage 2: Database] Syncing migrations to Hetzner Supabase DB...');
  const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('  ⚠ No migrations directory found, skipping.');
    return;
  }

  // Ensure deploy_schema_migrations table exists
  execSync(
    `ssh ${HETZNER_SSH} "docker exec -i supabase-db psql -U postgres -d postgres -c 'CREATE TABLE IF NOT EXISTS deploy_schema_migrations (app_name text NOT NULL, version text NOT NULL, applied_at timestamptz DEFAULT now(), PRIMARY KEY(app_name, version));'"`,
    { stdio: 'pipe' }
  );

  // Fetch already applied migrations for jetfarm / infinityfinance
  const appliedRaw = execSync(
    `ssh ${HETZNER_SSH} "docker exec -i supabase-db psql -U postgres -d postgres -t -c \\"SELECT version FROM deploy_schema_migrations WHERE app_name IN ('jetfarm', 'infinityfinance');\\""`,
    { encoding: 'utf8' }
  );
  const appliedVersions = new Set(appliedRaw.split('\n').map(s => s.trim()).filter(Boolean));

  const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of allFiles) {
    const version = file.replace(/\.sql$/, '');

    // Skip the destructive bootstrap migration from 2026-04-01 on existing database
    if (file.startsWith('20260401000000_initial_schema')) {
      skippedCount++;
      continue;
    }

    if (appliedVersions.has(version)) {
      skippedCount++;
      continue;
    }

    console.log(`  → Applying ${file}...`);
    const filePath = path.join(migrationsDir, file);
    try {
      const sqlContent = fs.readFileSync(filePath);
      execSync(`ssh ${HETZNER_SSH} "docker exec -i supabase-db psql -U postgres -d postgres"`, {
        input: sqlContent,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      execSync(
        `ssh ${HETZNER_SSH} "docker exec -i supabase-db psql -U postgres -d postgres -c \\"INSERT INTO deploy_schema_migrations (app_name, version) VALUES ('jetfarm', '${version}') ON CONFLICT DO NOTHING;\\""`,
        { stdio: 'pipe' }
      );
      appliedCount++;
    } catch (err) {
      console.warn(`    ⚠ Migration warning on ${file}: ${err.message?.split('\n')[0]}`);
    }
  }

  console.log(`  ✓ Migrations processed: ${appliedCount} applied, ${skippedCount} previously recorded/skipped`);

  // Reload PostgREST schema cache
  try {
    execSync(`ssh ${HETZNER_SSH} "docker exec -i supabase-db psql -U postgres -d postgres -c \\"NOTIFY pgrst, 'reload schema';\\""`, { stdio: 'pipe' });
    console.log('  ✓ PostgREST schema cache reloaded');
  } catch (_e) {}
}

// Stage 3: Web Export
function buildWebExport() {
  console.log('\n📦 [Stage 3: Web Export] Exporting production bundle...');
  const localEnvPath = path.join(rootDir, '.env.local');
  const hetznerEnvPath = path.join(rootDir, '.env.hetzner');

  let originalLocalEnv = null;
  if (fs.existsSync(localEnvPath)) {
    originalLocalEnv = fs.readFileSync(localEnvPath, 'utf8');
  }

  try {
    if (fs.existsSync(hetznerEnvPath)) {
      fs.writeFileSync(localEnvPath, fs.readFileSync(hetznerEnvPath, 'utf8'), 'utf8');
    }

    const isWindows = process.platform === 'win32';
    console.log('  🔨 Generating app updates metadata...');
    spawnSync(isWindows ? 'node.exe' : 'node', ['scripts/generate-app-updates.mjs'], { cwd: rootDir, stdio: 'inherit' });

    console.log('  🔨 Running npx expo export --platform web --clear...');
    const res = spawnSync(
      isWindows ? 'npx.cmd' : 'npx',
      ['expo', 'export', '--platform', 'web', '--clear'],
      { cwd: rootDir, stdio: 'inherit', shell: isWindows }
    );

    if (res.status !== 0) {
      throw new Error(`Web export failed with exit code ${res.status}`);
    }

    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      throw new Error('Build output missing dist/index.html');
    }

    console.log('  ✓ Web export compiled successfully');

    // Emit the in-app update manifest into dist/ (bug audit §11.5): without this file the
    // SPA catch-all answers /version.json with index.html, every update check throws on
    // .json() and fails silently. Written before archiving so it ships with the bundle.
    console.log('  🧾 Generating dist/version.json for in-app update checks...');
    const appConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'app.json'), 'utf8'));
    const appVersion = appConfig?.expo?.version || '0.0.0';
    const versionCode = Number(appConfig?.expo?.android?.versionCode || 1);
    // Release URLs must point at the origin that actually serves /download. The Hetzner
    // vhost has no such route (it 404s), so the Cloudflare Pages deployment is the default;
    // EXPO_PUBLIC_APP_URL still wins for a deliberately self-hosted release.
    const publicAppUrl = (process.env.EXPO_PUBLIC_APP_URL || 'https://jetfarm.pages.dev').replace(/\/+$/, '');
    let releaseNotesChanges = null;
    try {
      const updatesJsonPath = path.join(rootDir, 'src', 'constants', 'generatedAppUpdates.json');
      if (fs.existsSync(updatesJsonPath)) {
        const updates = JSON.parse(fs.readFileSync(updatesJsonPath, 'utf8'));
        const latest = updates?.[0];
        if (Array.isArray(latest?.changes) && latest.changes.length > 0) {
          releaseNotesChanges = latest.changes;
        }
      }
    } catch (_e) {
      // Missing updates metadata falls back to the default release notes.
    }
    const versionManifest = buildVersionManifest({ appVersion, versionCode, publicAppUrl, releaseNotesChanges });
    fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionManifest, null, 2), 'utf8');
    console.log(`  ✓ dist/version.json written (v${appVersion} / Build ${versionCode})`);

    // Archive dist/ into dist_update.tar.gz
    const archivePath = path.join(rootDir, 'dist_update.tar.gz');
    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);

    console.log('  📦 Compressing bundle into dist_update.tar.gz...');
    execSync(`tar -czf dist_update.tar.gz -C dist .`, { cwd: rootDir, stdio: 'inherit' });
    console.log('  ✓ Archive created');

    return archivePath;
  } finally {
    if (originalLocalEnv !== null) {
      fs.writeFileSync(localEnvPath, originalLocalEnv, 'utf8');
    }
  }
}

// Stage 4: Deploy to Hetzner
function deployToServer(archivePath) {
  console.log('\n🚀 [Stage 4: Hetzner Deployment] Deploying container and assets...');

  // Ensure remote directory exists
  execSync(`ssh ${HETZNER_SSH} "mkdir -p ${REMOTE_APP_DIR}/site"`, { stdio: 'inherit' });

  // Upload configs
  const nginxConf = path.join(rootDir, 'scripts', 'hetzner-nginx.conf');
  const dockerCompose = path.join(rootDir, 'scripts', 'hetzner-docker-compose.yml');

  execSync(`scp "${nginxConf}" "${HETZNER_SSH}:${REMOTE_APP_DIR}/nginx.conf"`, { stdio: 'inherit' });
  execSync(`scp "${dockerCompose}" "${HETZNER_SSH}:${REMOTE_APP_DIR}/docker-compose.yml"`, { stdio: 'inherit' });
  execSync(`scp "${archivePath}" "${HETZNER_SSH}:${REMOTE_APP_DIR}/dist_update.tar.gz"`, { stdio: 'inherit' });

  // Unpack and launch container
  console.log('  🔨 Unpacking site and launching container...');
  execSync(
    `ssh ${HETZNER_SSH} "cd ${REMOTE_APP_DIR} && rm -rf site/* && tar -xzf dist_update.tar.gz -C site/ && rm dist_update.tar.gz && docker compose up -d --remove-orphans && docker restart jetfarm-app"`,
    { stdio: 'inherit' }
  );
  console.log('  ✓ Container jetfarm-app is running on port 8088');

  // Update Caddyfile.new if not already present
  console.log('  🌐 Configuring Caddy reverse proxy...');
  const caddyBlock = `\n# JetFarm / Agri-Finance ERP on port 8088\n${FALLBACK_DOMAIN}, ${DOMAIN} {\n    encode zstd gzip\n    reverse_proxy 127.0.0.1:8088\n}\n`;
  const tmpCaddyPath = path.join(rootDir, 'scripts', '.caddy_snippet.tmp');
  fs.writeFileSync(tmpCaddyPath, caddyBlock, 'utf8');
  execSync(`scp "${tmpCaddyPath}" "${HETZNER_SSH}:/tmp/jetfarm_caddy.snippet"`, { stdio: 'pipe' });
  if (fs.existsSync(tmpCaddyPath)) fs.unlinkSync(tmpCaddyPath);

  execSync(
    `ssh ${HETZNER_SSH} "grep -q '127.0.0.1:8088' /home/deploy/Caddyfile.new || (cat /tmp/jetfarm_caddy.snippet >> /home/deploy/Caddyfile.new && rm -f /tmp/jetfarm_caddy.snippet)"`,
    { stdio: 'inherit' }
  );

  // Validate and reload Caddy
  try {
    execSync(
      `ssh ${HETZNER_SSH} "caddy validate --config /home/deploy/Caddyfile.new && caddy reload --config /home/deploy/Caddyfile.new"`,
      { stdio: 'inherit' }
    );
    console.log('  ✓ Caddy reloaded successfully without sudo');
  } catch (err) {
    console.warn('  ⚠ Caddy reload notification:', err.message);
  }
}

// Stage 5: Edge Verification
async function verifyEndpoints() {
  console.log('\n🔍 [Stage 5: Verification] Testing live endpoints...');

  try {
    execSync(`ssh ${HETZNER_SSH} "curl -fsS http://127.0.0.1:8088/ > /dev/null"`, { stdio: 'pipe' });
    console.log('  ✓ In-cluster HTTP on port 8088 verified');
  } catch (err) {
    console.warn('  ⚠ Host probe warning:', err.message);
  }

  const probe = (url) =>
    new Promise((resolve) => {
      https
        .get(url, { timeout: 10000, rejectUnauthorized: false }, (res) => {
          console.log(`  ✓ ${url} -> HTTP ${res.statusCode}`);
          resolve(res.statusCode);
        })
        .on('error', (err) => {
          console.warn(`  ⚠ ${url} -> ${err.message}`);
          resolve(null);
        });
    });

  await probe(`https://${FALLBACK_DOMAIN}`);
  await probe(`https://${DOMAIN}`);
}

async function main() {
  preflightCheck();
  syncDatabaseMigrations();
  const archivePath = buildWebExport();
  deployToServer(archivePath);
  await verifyEndpoints();

  console.log('\n🎉 =================================================================');
  console.log('   JETFARM DEPLOYMENT COMPLETE');
  console.log(`   Primary URL:  https://${DOMAIN}`);
  console.log(`   Fallback URL: https://${FALLBACK_DOMAIN}`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err);
  process.exit(1);
});
