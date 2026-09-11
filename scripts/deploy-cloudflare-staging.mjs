import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const distDir = 'dist';
const projectName = process.env.CLOUDFLARE_PROJECT_NAME || 'jetfarm';
const isWindows = process.platform === 'win32';

console.log('[deploy-cloudflare-staging] Starting staging deployment...');

// 1. Export web staging bundle
console.log('[deploy-cloudflare-staging] Step 1: Exporting web bundle with .env.staging...');
const buildResult = spawnSync(
  isWindows ? 'npm.cmd' : 'npm',
  ['run', 'export:web:staging'],
  { stdio: 'inherit', shell: isWindows }
);

if (buildResult.status !== 0) {
  console.error('[deploy-cloudflare-staging] Staging export failed! Exiting deployment.');
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(distDir)) {
  console.error(`[deploy-cloudflare-staging] Error: Build output directory "${distDir}" does not exist!`);
  process.exit(1);
}

// 2. Deploy to Cloudflare Pages staging branch
console.log(`[deploy-cloudflare-staging] Step 2: Uploading static files to Cloudflare Pages (project: ${projectName}, branch: staging)...`);
const deployResult = spawnSync(
  isWindows ? 'npx.cmd' : 'npx',
  ['wrangler', 'pages', 'deploy', distDir, '--project-name', projectName, '--branch', 'staging'],
  { stdio: 'inherit', shell: isWindows }
);

if (deployResult.status !== 0) {
  console.error('[deploy-cloudflare-staging] Wrangler deployment to staging failed!');
  process.exit(deployResult.status ?? 1);
}

console.log('[deploy-cloudflare-staging] Deployment to Cloudflare Pages (staging) completed successfully!');
process.exit(0);
