import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync, readdirSync, statSync, renameSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

function parseEnvFile(contents) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      acc[key] = value;
      return acc;
    }, {});
}

const stagingEnvPath = '.env.staging';
const localEnvPath = '.env.local';

if (!existsSync(stagingEnvPath)) {
  console.error(`[export-web-staging] Missing ${stagingEnvPath}`);
  process.exit(1);
}

const originalLocalEnv = existsSync(localEnvPath) ? readFileSync(localEnvPath, 'utf8') : null;
const stagingEnv = readFileSync(stagingEnvPath, 'utf8');
const stagingVars = parseEnvFile(stagingEnv);

try {
  writeFileSync(localEnvPath, stagingEnv);

  const isWindows = process.platform === 'win32';
  const result = spawnSync(
    isWindows ? 'npx.cmd' : 'npx',
    isWindows ? ['expo', 'export', '--platform', 'web', '--clear'] : ['expo', 'export', '--platform', 'web', '--clear'],
    {
      stdio: 'inherit',
      shell: isWindows,
      env: {
        ...process.env,
        ...stagingVars,
        NODE_ENV: 'production',
      },
    }
  );

  if (result.error) {
    console.error('[export-web-staging] Expo export failed to start:', result.error);
    process.exitCode = 1;
  } else {
    if (result.status === 0) {
      const distDir = 'dist';
      const nmPath = join(distDir, 'assets', 'node_modules');
      const vmPath = join(distDir, 'assets', 'vendor_modules');

      if (existsSync(nmPath)) {
        console.log('[export-web-staging] Post-processing: renaming assets/node_modules to vendor_modules...');
        try {
          renameSync(nmPath, vmPath);
        } catch (err) {
          cpSync(nmPath, vmPath, { recursive: true });
          rmSync(nmPath, { recursive: true, force: true });
        }

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

        walkDir(distDir, (filePath) => {
          if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html') || filePath.endsWith('.json')) {
            const content = readFileSync(filePath, 'utf8');
            if (content.includes('assets/node_modules/')) {
              const updatedContent = content.split('assets/node_modules/').join('assets/vendor_modules/');
              writeFileSync(filePath, updatedContent, 'utf8');
            }
          }
        });
        console.log('[export-web-staging] Post-processing complete.');
      }

      // Write staging _redirects for SPA routing
      const redirectsPath = join(distDir, '_redirects');
      writeFileSync(redirectsPath, '/* /index.html 200\n', 'utf8');

      // Write staging _headers with staging Supabase connect-src
      const headersPath = join(distDir, '_headers');
      const stagingHeaders = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://zsrglwrscdxtyxyyyhwd.supabase.co wss://zsrglwrscdxtyxyyyhwd.supabase.co; upgrade-insecure-requests
`;
      writeFileSync(headersPath, stagingHeaders, 'utf8');
      console.log('[export-web-staging] Staging _redirects and _headers generated.');
    }
    process.exitCode = result.status ?? 1;
  }
} finally {
  if (originalLocalEnv === null) {
    if (existsSync(localEnvPath)) {
      unlinkSync(localEnvPath);
    }
  } else {
    writeFileSync(localEnvPath, originalLocalEnv);
  }
}
