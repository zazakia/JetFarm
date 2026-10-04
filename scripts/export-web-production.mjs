import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

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

// Test fixtures that must never reach a production bundle as the AES key.
const KNOWN_PLACEHOLDER_KEYS = new Set(['mock-primary-key', 'POSCursor_Sec_2024_Ph']);

function resolveEncryptionKey(candidate, source) {
  const key = (candidate || '').trim();
  if (!key || KNOWN_PLACEHOLDER_KEYS.has(key)) {
    console.error(
      `[export-web-production] EXPO_PUBLIC_ENCRYPTION_KEY is missing or is a known test placeholder (source: ${source}).\n` +
      '  Refusing to build: a public key would encrypt production data while appearing to succeed.\n' +
      '  Provision a real key in .env.production (see docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md, finding C1).'
    );
    process.exit(1);
  }
  return key;
}

const productionEnvPath = '.env.production';
const localEnvPath = '.env.local';

let createdSyntheticProductionEnv = false;
if (!existsSync(productionEnvPath)) {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL) {
    const encryptionKey = resolveEncryptionKey(
      process.env.EXPO_PUBLIC_ENCRYPTION_KEY,
      'process.env'
    );
    console.log('[export-web-production] Creating synthetic .env.production from environment variables...');
    const syntheticEnv = `EXPO_PUBLIC_SUPABASE_URL=${process.env.EXPO_PUBLIC_SUPABASE_URL}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''}\nEXPO_PUBLIC_ENCRYPTION_KEY=${encryptionKey}\n`;
    writeFileSync(productionEnvPath, syntheticEnv);
    createdSyntheticProductionEnv = true;
  } else {
    console.error(`[export-web-production] Missing ${productionEnvPath}`);
    process.exit(1);
  }
}

const originalLocalEnv = existsSync(localEnvPath) ? readFileSync(localEnvPath, 'utf8') : null;
const productionEnv = readFileSync(productionEnvPath, 'utf8');
const productionVars = parseEnvFile(productionEnv);

resolveEncryptionKey(productionVars.EXPO_PUBLIC_ENCRYPTION_KEY, productionEnvPath);

try {
  writeFileSync(localEnvPath, productionEnv);

  const isWindows = process.platform === 'win32';
  const result = spawnSync(
    isWindows ? 'npx.cmd expo export --platform web --clear' : 'npx',
    isWindows ? [] : ['expo', 'export', '--platform', 'web', '--clear'],
    {
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      ...productionVars,
      NODE_ENV: 'production',
    },
    }
  );

  if (result.error) {
    console.error('[export-web-production] Expo export failed to start:', result.error);
    process.exitCode = 1;
  } else {
    if (result.status === 0) {
      // Run Post-Processing for vector icons (rename node_modules to vendor_modules)
      const distDir = 'dist';
      const nodeModulesPath = import('node:path').then(p => p.join(distDir, 'assets', 'node_modules'));
      const vendorModulesPath = import('node:path').then(p => p.join(distDir, 'assets', 'vendor_modules'));
      
      const fs = await import('node:fs');
      const path = await import('node:path');
      
      const nmPath = path.join(distDir, 'assets', 'node_modules');
      const vmPath = path.join(distDir, 'assets', 'vendor_modules');
      
      if (fs.existsSync(nmPath)) {
        console.log('[export-web-production] Post-processing: renaming assets/node_modules to vendor_modules...');
        try {
          fs.renameSync(nmPath, vmPath);
        } catch (err) {
          console.warn('[export-web-production] renameSync failed, trying cpSync fallback...', err?.message || err);
          fs.cpSync(nmPath, vmPath, { recursive: true });
          fs.rmSync(nmPath, { recursive: true, force: true });
        }
        
        const walkDir = (dir, callback) => {
          fs.readdirSync(dir).forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
              walkDir(filePath, callback);
            } else {
              callback(filePath);
            }
          });
        };

        walkDir(distDir, (filePath) => {
          if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html') || filePath.endsWith('.json')) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('assets/node_modules/')) {
              const updatedContent = content.split('assets/node_modules/').join('assets/vendor_modules/');
              fs.writeFileSync(filePath, updatedContent, 'utf8');
            }
          }
        });
        console.log('[export-web-production] Post-processing complete.');
      }
    }
    process.exitCode = result.status ?? 1;
  }
} finally {
  if (createdSyntheticProductionEnv && existsSync(productionEnvPath)) {
    unlinkSync(productionEnvPath);
  }
  if (originalLocalEnv === null) {
    if (existsSync(localEnvPath)) {
      unlinkSync(localEnvPath);
    }
  } else {
    writeFileSync(localEnvPath, originalLocalEnv);
  }
}
