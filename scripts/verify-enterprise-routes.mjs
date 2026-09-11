import { chromium } from 'playwright';
import path from 'path';
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'fs';

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

function startServer(distDir, port = 8092) {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            let reqPath = req.url.split('?')[0];
            let filePath = path.join(distDir, reqPath);

            if (existsSync(filePath) && statSync(filePath).isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }

            if (!existsSync(filePath) || !statSync(filePath).isFile()) {
                filePath = path.join(distDir, 'index.html');
            }

            try {
                const data = readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const mime = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
                res.end(data);
            } catch (err) {
                res.writeHead(500);
                res.end(String(err));
            }
        });

        server.listen(port, '127.0.0.1', () => {
            console.log(`[Enterprise QA] Static server listening at http://127.0.0.1:${port}`);
            resolve(server);
        });
    });
}

async function testEnterpriseAuthenticatedInteractions() {
    const imagesDir = path.resolve('docs/images');
    if (!existsSync(imagesDir)) {
        mkdirSync(imagesDir, { recursive: true });
    }

    const distDir = path.resolve('dist');
    const port = 8092;
    const server = await startServer(distDir, port);
    const baseURL = `http://127.0.0.1:${port}`;

    console.log(`\n======================================================`);
    console.log(`Starting Interactive Enterprise QA on ${baseURL}`);
    console.log(`======================================================\n`);

    const browser = await chromium.launch({ headless: true });
    const consoleErrors = [];

    try {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 1,
        });

        const page = await context.newPage();
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(`[Console Error] ${msg.text()}`);
            }
        });

        page.on('pageerror', err => {
            consoleErrors.push(`[Uncaught Page Error]: ${err.message}`);
        });

        // 1. Login
        console.log(`Navigating to login...`);
        await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        console.log(`Logging in via Admin User quick access...`);
        await page.getByText('Admin User').click();
        await page.waitForTimeout(4000);

        // Verify Admin Portal loaded
        await page.screenshot({ path: path.join(imagesDir, '1_admin_portal.png'), fullPage: true });
        console.log(`Saved screenshot: 1_admin_portal.png`);

        // 2. Click 'SWITCH BRANCH' button in header
        console.log(`Clicking 'SWITCH BRANCH' in header...`);
        const switchBranchBtn = page.getByText(/SWITCH BRANCH/i);
        if (await switchBranchBtn.isVisible()) {
            await switchBranchBtn.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(imagesDir, '2_branch_switcher.png'), fullPage: true });
            const branchText = await page.evaluate(() => document.body.innerText.trim());
            console.log(`Saved screenshot: 2_branch_switcher.png (${branchText.length} chars)`);
            console.log(`Branch switcher preview: "${branchText.slice(0, 100).replace(/\n/g, ' ')}..."`);
            
            // Navigate back to admin dashboard
            await page.goBack();
            await page.waitForTimeout(2000);
        } else {
            console.warn(`SWITCH BRANCH button not found in header!`);
        }

        // 3. Click 'Sales Returns & Refunds' in sidebar
        console.log(`Clicking 'Sales Returns & Refunds' in sidebar...`);
        const returnsNav = page.getByText('Sales Returns & Refunds');
        if (await returnsNav.isVisible()) {
            await returnsNav.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(imagesDir, '3_sales_returns.png'), fullPage: true });
            const retText = await page.evaluate(() => document.body.innerText.trim());
            console.log(`Saved screenshot: 3_sales_returns.png (${retText.length} chars)`);
            console.log(`Returns preview: "${retText.slice(0, 100).replace(/\n/g, ' ')}..."`);
        } else {
            console.warn(`Sales Returns & Refunds nav item not found in sidebar!`);
        }

        // 4. Click 'Touch POS Terminal' in sidebar
        console.log(`Clicking 'Touch POS Terminal' in sidebar...`);
        const posNav = page.getByText('Touch POS Terminal');
        if (await posNav.isVisible()) {
            await posNav.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(imagesDir, '4_touch_pos.png'), fullPage: true });
            const posText = await page.evaluate(() => document.body.innerText.trim());
            console.log(`Saved screenshot: 4_touch_pos.png (${posText.length} chars)`);
            console.log(`POS preview: "${posText.slice(0, 100).replace(/\n/g, ' ')}..."`);
        } else {
            console.warn(`Touch POS Terminal nav item not found in sidebar!`);
        }

        await browser.close();

        console.log(`\n======================================================`);
        console.log(`Interactive Enterprise QA Completed!`);
        console.log(`Total Console Errors detected: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
            consoleErrors.forEach(e => console.error('  ' + e));
        }
        console.log(`======================================================\n`);

    } finally {
        server.close();
    }
}

testEnterpriseAuthenticatedInteractions().catch(err => {
    console.error('Fatal interactive QA error:', err);
    process.exit(1);
});
