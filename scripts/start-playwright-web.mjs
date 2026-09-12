import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const distDir = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.PLAYWRIGHT_WEB_PORT || '19119');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function mimeTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const candidate = path.resolve(distDir, `.${decoded}`);

  if (!candidate.startsWith(distDir)) {
    return path.join(distDir, 'index.html');
  }

  if (existsSync(candidate)) {
    const stats = statSync(candidate);
    if (stats.isDirectory()) {
      const nestedIndex = path.join(candidate, 'index.html');
      if (existsSync(nestedIndex)) {
        return nestedIndex;
      }
    } else {
      return candidate;
    }
  }

  return path.join(distDir, 'index.html');
}

function exportWebBundle() {
  if (process.env.SKIP_EXPORT === '1' && existsSync(path.join(distDir, 'index.html'))) {
    console.log('[playwright-web] Skipping expo export (dist/ already exists and SKIP_EXPORT=1).');
    return;
  }
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows
    ? ['/c', 'npx expo export --platform web --clear']
    : ['expo', 'export', '--platform', 'web', '--clear'];

  console.log('[playwright-web] Exporting static web bundle for Playwright...');
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      EXPO_PUBLIC_E2E_MODE: '1',
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:45421',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    },
  });

  if (result.error) {
    console.error('[playwright-web] Failed to start expo export:', result.error);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    console.error(`[playwright-web] expo export exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    const filePath = resolveRequestPath(req.url || '/');
    const stream = createReadStream(filePath);

    res.statusCode = 200;
    res.setHeader('Content-Type', mimeTypeFor(filePath));
    res.setHeader('Cache-Control', 'no-store');

    stream.on('error', (error) => {
      console.error('[playwright-web] Failed to serve file:', filePath, error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      res.end('Internal Server Error');
    });

    stream.pipe(res);
  });

  server.on('error', async (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.log(`[playwright-web] Port ${port} is already in use; reusing the existing server.`);
      const isReachable = await new Promise((resolve) => {
        const request = http.get(`http://127.0.0.1:${port}`, (response) => {
          response.resume();
          resolve(response.statusCode !== 500);
        });

        request.on('error', () => resolve(false));
        request.setTimeout(5000, () => {
          request.destroy();
          resolve(false);
        });
      });

      if (!isReachable) {
        console.error(`[playwright-web] Existing server on port ${port} is not reachable.`);
        process.exit(1);
      }

      return;
    }

    console.error('[playwright-web] Failed to start static server:', error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`[playwright-web] Static web server ready on http://localhost:${port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (!existsSync(path.resolve(process.cwd(), 'app.json'))) {
  console.error('[playwright-web] Must run from the repo root.');
  process.exit(1);
}

exportWebBundle();
startServer();
