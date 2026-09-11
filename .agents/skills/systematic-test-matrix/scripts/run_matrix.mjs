import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';
import { chromium } from '@playwright/test';

const repoRoot = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = path.join(repoRoot, 'tmp', 'systematic-test-matrix', timestamp);

const args = new Set(process.argv.slice(2));
const bail = !args.has('--no-bail');
const skipPlaywright = args.has('--skip-playwright');
const skipSmoke = args.has('--skip-smoke');
const onlyArg = process.argv.slice(2).find((arg) => arg.startsWith('--only='));
const onlySteps = new Set(
  onlyArg
    ? onlyArg
        .slice('--only='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : []
);

const results = [];

async function getFreePort(preferredPort = 19009) {
  const tryPort = (port) => new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      server.close(() => resolve(actualPort));
    });
  });

  const preferred = await tryPort(preferredPort);
  if (preferred) return preferred;
  const fallback = await tryPort(0);
  if (fallback) return fallback;
  throw new Error('Unable to allocate a free localhost port for verification');
}

function isTestFile(fileName) {
  return /\.(test)\.(ts|tsx|js|jsx)$/.test(fileName);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listEntriesSafe(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function discoverJestBuckets(rootDirs = ['app', 'src']) {
  const buckets = [];

  async function walk(currentDir) {
    const entries = await listEntriesSafe(currentDir);
    const testFiles = entries.filter((entry) => entry.isFile() && isTestFile(entry.name));
    if (path.basename(currentDir) === '__tests__' && testFiles.length > 0) {
      buckets.push({
        bucket: path.relative(repoRoot, currentDir).replace(/\\/g, '/'),
        files: testFiles
          .map((entry) => path.relative(repoRoot, path.join(currentDir, entry.name)).replace(/\\/g, '/'))
          .sort((a, b) => a.localeCompare(b)),
      });
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'tmp') continue;
      await walk(path.join(currentDir, entry.name));
    }
  }

  for (const rootDir of rootDirs) {
    await walk(path.join(repoRoot, rootDir));
  }

  return buckets.sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function platformCommand(command, args = []) {
  if (process.platform !== 'win32') {
    return { command, args, shell: false };
  }

  if (command === 'npm') return { command: 'npm.cmd', args, shell: true };
  if (command === 'npx') return { command: 'npx.cmd', args, shell: true };
  return { command, args, shell: true };
}

async function runStep(name, command, commandArgs, options = {}) {
  const safeName = name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
  const logPath = path.join(reportDir, `${safeName}.log`);
  const startedAt = new Date().toISOString();
  const { command: resolvedCommand, args: resolvedArgs, shell } = platformCommand(command, commandArgs);

  return new Promise((resolve) => {
    const child = spawn(resolvedCommand, resolvedArgs, {
      cwd: repoRoot,
      shell,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        ...options.env,
      },
    });

    let output = '';
    const append = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);

    child.on('error', async (error) => {
      output += `\n[spawn error] ${error.stack || error.message}\n`;
      await fs.writeFile(logPath, output, 'utf8');
      const result = {
        name,
        command: [resolvedCommand, ...resolvedArgs].join(' '),
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: -1,
        ok: false,
        logPath: path.relative(repoRoot, logPath).replace(/\\/g, '/'),
      };
      results.push(result);
      resolve(result);
    });

    child.on('close', async (code) => {
      await fs.writeFile(logPath, output, 'utf8');
      const result = {
        name,
        command: [resolvedCommand, ...resolvedArgs].join(' '),
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: code ?? 1,
        ok: (code ?? 1) === 0,
        logPath: path.relative(repoRoot, logPath).replace(/\\/g, '/'),
      };
      results.push(result);
      resolve(result);
    });
  });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

async function startStaticServer(rootDir, port) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const rawPath = decodeURIComponent(requestUrl.pathname);
      const relativePath = rawPath.replace(/^\/+/, '');
      const candidates = [
        path.join(rootDir, relativePath),
        path.join(rootDir, relativePath, 'index.html'),
        path.join(rootDir, `${relativePath}.html`),
        path.join(rootDir, 'index.html'),
      ];

      let selected = null;
      for (const candidate of candidates) {
        try {
          const stat = await fs.stat(candidate);
          if (stat.isFile()) {
            selected = candidate;
            break;
          }
        } catch {}
      }

      if (!selected) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const body = await fs.readFile(selected);
      res.writeHead(200, { 'Content-Type': contentType(selected) });
      res.end(body);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return server;
}

async function runSmokeCheck() {
  const smokePath = path.join(reportDir, 'smoke.json');
  const distDir = path.join(repoRoot, 'dist');
  const port = await getFreePort(19009);
  const url = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  const server = await startStaticServer(distDir, port);
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);

    const payload = {
      ok: consoleErrors.length === 0 && pageErrors.length === 0,
      finalUrl: page.url(),
      title: await page.title(),
      consoleErrors,
      pageErrors,
    };
    await fs.writeFile(smokePath, JSON.stringify(payload, null, 2), 'utf8');

    const result = {
      name: 'export_smoke',
      command: `serve dist at ${url} and open in Chromium`,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      exitCode: payload.ok ? 0 : 1,
      ok: payload.ok,
      logPath: path.relative(repoRoot, smokePath).replace(/\\/g, '/'),
    };
    results.push(result);
    return result;
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function main() {
  await ensureDir(reportDir);
  const playwrightPort = String(await getFreePort(Number(process.env.PLAYWRIGHT_WEB_PORT || 19009)));

  const jestBuckets = await discoverJestBuckets();
  await fs.writeFile(
    path.join(reportDir, 'jest-buckets.json'),
    JSON.stringify(jestBuckets, null, 2),
    'utf8'
  );

  const plannedSteps = [
    ['typescript', 'npx', ['tsc', '--noEmit']],
    ['expo_doctor', 'npx', ['expo-doctor']],
    ...jestBuckets.map(({ bucket, files }) => [
      `jest_${bucket}`,
      'npx',
      ['jest', '--runInBand', '--forceExit', '--runTestsByPath', ...files],
    ]),
    ['jest_full', 'npm', ['test', '--', '--runInBand', '--forceExit']],
    ...(!skipPlaywright ? [['playwright_full', 'npx', ['playwright', 'test', '--workers=1', '--reporter=list'], { env: { PLAYWRIGHT_WEB_PORT: playwrightPort } }]] : []),
    ['export_web', 'npm', ['run', 'export:web']],
  ];

  const steps =
    onlySteps.size === 0
      ? plannedSteps
      : plannedSteps.filter(([name]) => onlySteps.has(name));

  for (const [name, command, commandArgs, options] of steps) {
    const result = await runStep(name, command, commandArgs, options);
    if (!result.ok && bail) break;
  }

  const shouldRunSmoke = !skipSmoke && (onlySteps.size === 0 || onlySteps.has('export_smoke'));

  if (shouldRunSmoke) {
    const priorFailures = results.some((result) => !result.ok);
    if (!priorFailures || !bail) {
      try {
        const smokeResult = await runSmokeCheck();
        if (!smokeResult.ok && bail) {
          // nothing else follows
        }
      } catch (error) {
        const smokePath = path.join(reportDir, 'smoke-error.log');
        await fs.writeFile(smokePath, String(error?.stack || error), 'utf8');
        results.push({
          name: 'export_smoke',
          command: 'chromium smoke',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          exitCode: 1,
          ok: false,
          logPath: path.relative(repoRoot, smokePath).replace(/\\/g, '/'),
        });
      }
    }
  }

  const summary = {
    createdAt: new Date().toISOString(),
    bail,
    skipPlaywright,
    skipSmoke,
    reportDir: path.relative(repoRoot, reportDir).replace(/\\/g, '/'),
    ok: results.every((result) => result.ok),
    results,
  };

  const summaryPath = path.join(reportDir, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`\n[systematic-test-matrix] Summary: ${path.relative(repoRoot, summaryPath).replace(/\\/g, '/')}`);
  if (!summary.ok) {
    process.exitCode = 1;
  }
}

await main();
