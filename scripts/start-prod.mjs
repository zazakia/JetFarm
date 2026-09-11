import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const command = isWindows ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['expo', 'start', '--clear'], {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    NODE_ENV: 'production',
  },
});

if (result.error) {
  console.error('[start-prod] Failed to launch Expo:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
