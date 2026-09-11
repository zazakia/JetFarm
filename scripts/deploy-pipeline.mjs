#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import https from 'node:https';

const COLORS = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function runStep(stepName, command, args = []) {
  console.log(COLORS.cyan(`\n>>> [Step] ${stepName}...`));
  const isWindows = process.platform === 'win32';
  const executable = isWindows && (command === 'npm' || command === 'npx') ? `${command}.cmd` : command;

  const result = spawnSync(executable, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(COLORS.red(`\n❌ [FAILED] Step "${stepName}" exited with code ${result.status}`));
    process.exit(result.status ?? 1);
  }
  console.log(COLORS.green(`✓ [PASSED] ${stepName}`));
}

function verifyWatermelonDbSchemaSync() {
  console.log(COLORS.cyan('\n>>> [Step 1/6] Verifying WatermelonDB Schema & Migration Alignment...'));
  try {
    const schemaContent = readFileSync('src/database/schema.ts', 'utf8');
    const versionMatch = schemaContent.match(/version:\s*(\d+)/);
    const schemaVersion = versionMatch ? parseInt(versionMatch[1], 10) : null;

    const migrationContent = readFileSync('src/database/migrations.ts', 'utf8');
    const toVersionMatches = [...migrationContent.matchAll(/toVersion:\s*(\d+)/g)];
    const maxMigrationVersion = toVersionMatches.length
      ? Math.max(...toVersionMatches.map((m) => parseInt(m[1], 10)))
      : null;

    console.log(`   WatermelonDB Schema Version: ${schemaVersion}`);
    console.log(`   Latest Migration toVersion:  ${maxMigrationVersion}`);

    if (schemaVersion !== maxMigrationVersion) {
      console.error(
        COLORS.red(
          `❌ [FAILED] Schema version (${schemaVersion}) does not match latest migration version (${maxMigrationVersion})!`
        )
      );
      process.exit(1);
    }
    console.log(COLORS.green('✓ [PASSED] WatermelonDB schema and migrations are perfectly aligned.'));
  } catch (err) {
    console.error(COLORS.red(`❌ [FAILED] Error reading schema/migration files: ${err.message}`));
    process.exit(1);
  }
}

async function verifyLiveSite(url) {
  console.log(COLORS.cyan(`\n>>> [Step 6/6] Verifying Live Deployment at ${url}...`));
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log(COLORS.green(`✓ [PASSED] Live site responded with HTTP ${res.statusCode}`));
          resolve(true);
        } else {
          console.warn(COLORS.yellow(`⚠️ [WARN] Live site responded with HTTP ${res.statusCode}`));
          resolve(false);
        }
      })
      .on('error', (err) => {
        console.warn(COLORS.yellow(`⚠️ [WARN] Live ping failed: ${err.message}`));
        resolve(false);
      });
  });
}

async function main() {
  console.log(COLORS.bold('\n🚀 POS Cursor Cloudflare Pages Deployment Pipeline'));
  console.log(COLORS.cyan('====================================================='));

  // 1. WatermelonDB Schema alignment
  verifyWatermelonDbSchemaSync();

  // 2. Auth Schema & Supabase DB health check
  runStep('2/6 Supabase Auth Schema & Remote DB Check', 'node', ['scripts/check-auth-schema.mjs']);
  if (existsSync('scripts/check-production-migrations.mjs')) {
    runStep('2b/6 Production Migration Check', 'node', ['scripts/check-production-migrations.mjs']);
  }

  // 3. TypeScript Compilation Check
  runStep('3/6 TypeScript Type Check', 'npx', ['tsc', '--noEmit']);

  // 4. Jest Unit Tests
  runStep('4/6 Jest Unit Test Suite', 'npm', ['test', '--', '--passWithNoTests']);

  // 5. Build and Deploy to Cloudflare Pages (jetfarm.pages.dev)
  runStep('5/6 Build and Deploy to Cloudflare Pages (jetfarm)', 'node', ['scripts/deploy-cloudflare.mjs']);

  // 6. Post-deploy health verification
  const liveUrl = 'https://jetfarm.pages.dev';
  await verifyLiveSite(liveUrl);

  console.log(COLORS.bold(COLORS.green('\n🎉 SUCCESS! JetFarm successfully deployed to Cloudflare Pages!')));
  console.log(COLORS.cyan(`🌐 Live URL: ${liveUrl}\n`));
}

main().catch((err) => {
  console.error(COLORS.red(`\n💥 Deployment pipeline aborted: ${err.message}`));
  process.exit(1);
});
