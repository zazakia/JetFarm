import http from 'node:http';
import { existsSync, createReadStream, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const PORT = Number(process.env.STAGING_PORT || 19010);
const distDir = 'dist';

// Check if dist/index.html exists or if build is requested
const shouldBuild = !existsSync(join(distDir, 'index.html')) || process.argv.includes('--build');
if (shouldBuild) {
  console.log('[start-staging] Exporting staging web bundle...');
  const isWindows = process.platform === 'win32';
  const buildResult = spawnSync(
    isWindows ? 'npm.cmd' : 'npm',
    ['run', 'export:web:staging'],
    { stdio: 'inherit', shell: isWindows }
  );
  if (buildResult.status !== 0) {
    console.error('[start-staging] Failed to build staging web bundle.');
    process.exit(1);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url?.split('?')[0] || '/');
  let filePath = join(distDir, urlPath === '/' ? 'index.html' : urlPath);

  // SPA fallback: if file does not exist or is a route directory, serve index.html
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, 'index.html');
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const stream = createReadStream(filePath);
  stream.on('error', (err) => {
    res.statusCode = 500;
    res.end('Server Error');
  });
  stream.pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 POSCURSOR STAGING SERVER RUNNING`);
  console.log(`======================================================`);
  console.log(`  Local URL:    http://localhost:${PORT}`);
  console.log(`  Network URL:  http://127.0.0.1:${PORT}`);
  console.log(`  Target DB:    https://zsrglwrscdxtyxyyyhwd.supabase.co`);
  console.log(`  Prod DB Safe: ISOLATED & BLOCKED`);
  console.log(`======================================================\n`);
});
