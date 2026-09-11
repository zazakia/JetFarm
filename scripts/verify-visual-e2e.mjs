import { chromium } from 'playwright';
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function startServer(distDir, port = 8086) {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            let reqPath = req.url.split('?')[0];
            let filePath = path.join(distDir, reqPath);

            if (existsSync(filePath) && statSync(filePath).isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }

            if (!existsSync(filePath) || !statSync(filePath).isFile()) {
                // SPA fallback
                filePath = path.join(distDir, 'index.html');
            }

            try {
                const data = readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const mime = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': mime });
                res.end(data);
            } catch (err) {
                res.writeHead(500);
                res.end(String(err));
            }
        });

        server.listen(port, '127.0.0.1', () => {
            console.log(`Static SPA server listening at http://127.0.0.1:${port}`);
            resolve(server);
        });
    });
}

async function run() {
    const imagesDir = path.resolve('docs/images');
    if (!existsSync(imagesDir)) {
        mkdirSync(imagesDir, { recursive: true });
    }

    const distDir = path.resolve('dist');
    const port = 8086;
    const server = await startServer(distDir, port);

    try {
        const browser = await chromium.launch({ headless: true });
        const consoleErrors = [];

        // 1. Mobile Viewport Check (390x844)
        console.log('\n--- Testing Mobile Viewport (390x844) ---');
        const mobileContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 2,
        });
        const mobilePage = await mobileContext.newPage();
        mobilePage.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(`[Mobile Console Error] ${msg.text()}`);
            }
        });

        await mobilePage.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle', timeout: 30000 });
        await mobilePage.waitForTimeout(3000);
        const mobilePath = path.join(imagesDir, 'verify_mobile_390x844.png');
        await mobilePage.screenshot({ path: mobilePath, fullPage: true });
        console.log(`Saved mobile screenshot to ${mobilePath}`);
        await mobileContext.close();

        // 2. Desktop Viewport Check (1280x800)
        console.log('\n--- Testing Desktop Viewport (1280x800) ---');
        const desktopContext = await browser.newContext({
            viewport: { width: 1280, height: 800 },
        });
        const desktopPage = await desktopContext.newPage();
        desktopPage.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(`[Desktop Console Error] ${msg.text()}`);
            }
        });

        await desktopPage.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle', timeout: 30000 });
        await desktopPage.waitForTimeout(3000);
        const desktopPath = path.join(imagesDir, 'verify_desktop_1280x800.png');
        await desktopPage.screenshot({ path: desktopPath, fullPage: true });
        console.log(`Saved desktop screenshot to ${desktopPath}`);

        const title = await desktopPage.title();
        console.log(`Page title: "${title}"`);

        // Check if root content rendered
        const bodyContent = await desktopPage.evaluate(() => document.body.innerText);
        console.log(`Rendered body preview: ${bodyContent.slice(0, 150).replace(/\n/g, ' ')}...`);

        await browser.close();

        console.log(`\nVisual E2E Verification Complete.`);
        console.log(`Console Errors detected: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
            consoleErrors.forEach(e => console.error('  ' + e));
        }
    } finally {
        server.close();
    }
}

run().catch(err => {
    console.error('Visual verification failed:', err);
    process.exit(1);
});
