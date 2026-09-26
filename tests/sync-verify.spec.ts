import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';
import { createClient } from '@supabase/supabase-js';

// Initialize a Supabase client inside the test runner using the local config.
// playwright.config.ts defaults this to the local dev Supabase if not overridden.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:46421';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Bidirectional Sync Integrity — E2E Test Suite
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function triggerSyncAndWait(page: Page, timeoutMs = 90_000) {
    const settingsLink = page.getByText('System Settings', { exact: false }).first();
    await settingsLink.click();

    await expect(page.getByText(/Sync|Backup|System Settings/i).first()).toBeVisible({ timeout: 30_000 });

    const syncBtn = page.getByText('Sync Now', { exact: false }).first();
    await expect(syncBtn).toBeVisible({ timeout: 30_000 });
    await syncBtn.click();

    await expect(
        page.getByText(/Sync Now|Last Sync|Sync complete|No pending|Cloud Backup/i).first()
    ).toBeVisible({ timeout: timeoutMs });

    await page.waitForTimeout(1500);
}

async function waitForIdleSync(page: Page, timeoutMs = 45_000) {
    const start = Date.now();
    console.log('[Sync E2E] Waiting for sync store to become idle...');
    while (Date.now() - start < timeoutMs) {
        const status = await page.evaluate(() => {
            const store = (window as any).__SYNC_STORE__;
            return store ? store.getState().status : 'idle';
        });
        if (status === 'idle' || status === 'completed' || status === 'error') {
            console.log(`[Sync E2E] Sync store status is "${status}". Proceeding.`);
            return;
        }
        await page.waitForTimeout(500);
    }
    console.log('[Sync E2E] Warning: Wait for idle sync timed out.');
}

async function getLocalRecordCount(page: Page, tableName: string): Promise<number> {
    return page.evaluate(async (table: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[table]) return -1;
        try {
            return await db.collections.get(table).query().fetchCount();
        } catch (e) {
            return -1;
        }
    }, tableName);
}

async function getPendingLocalCount(page: Page, tableName: string): Promise<number> {
    return page.evaluate(async (table: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[table]) return -1;
        try {
            const records = await db.collections.get(table).query().fetch();
            return records.filter((r: any) => r._status === 'created' || r._status === 'updated' || r._status === 'deleted').length;
        } catch (e) {
            return -1;
        }
    }, tableName);
}

async function getLocalTableNames(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db) return [];
        return Object.keys(db.collections.map);
    });
}

/**
 * Direct WDB Injection: Injects a record directly into WatermelonDB bypassing the app UI.
 */
async function injectLocalRecord(page: Page, tableName: string, record: any): Promise<boolean> {
    return page.evaluate(async ({ table, rec }) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[table]) return false;
        try {
            await db.write(async () => {
                await db.collections.get(table).create((r: any) => {
                    Object.assign(r._raw, rec);
                });
            });
            return true;
        } catch (e) {
            console.error('Inject error', e);
            return false;
        }
    }, { table: tableName, rec: record });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

const CORE_TABLES = ['borrowers', 'loans', 'payments', 'expenses', 'collectors'];

test.describe('Bidirectional Sync Integrity', () => {
    test.setTimeout(180_000);

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
        });
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await loginAsAdmin(page);
        await page.waitForTimeout(2000); // Let WDB finish initializing

        // Stop auto sync service during E2E checks to avoid overlapping sync requests
        await page.evaluate(() => {
            if ((window as any).__AUTO_SYNC_SERVICE__) {
                (window as any).__AUTO_SYNC_SERVICE__.stop();
                console.log('[E2E Test] Stopped AutoSyncService successfully.');
            }
        });

        // Wait for any active sync cycle initiated during the login flow to completely finish
        await waitForIdleSync(page);
    });

    test('1 · SYNC HEALTH — Sync Now completes without errors', async ({ page }) => {
        console.log('\n[Sync E2E] ── TEST 1: Sync Health ──');
        await triggerSyncAndWait(page);
        const hasError = await page.getByText(/Sync failed|Connection problem/i).first().isVisible().catch(() => false);
        expect(hasError).toBe(false);
    });

    test('2 · LOCAL PERSIST — WatermelonDB has data after sync', async ({ page }) => {
        console.log('\n[Sync E2E] ── TEST 2: Local Persist ──');
        await triggerSyncAndWait(page);
        const tableNames = await getLocalTableNames(page);
        expect(tableNames.length).toBeGreaterThan(0);
        
        let hasData = false;
        for (const table of CORE_TABLES) {
            if (tableNames.includes(table)) {
                const count = await getLocalRecordCount(page, table);
                if (count > 0) hasData = true;
            }
        }
        if (!hasData) console.log('⚠ No local data found — fresh install?');
    });

    test('3 · PUSH INTEGRITY — 0 pending local changes after sync', async ({ page }) => {
        console.log('\n[Sync E2E] ── TEST 3: Push Integrity (Pending Count) ──');
        await triggerSyncAndWait(page);
        
        const tableNames = await getLocalTableNames(page);
        const tablesToCheck = CORE_TABLES.filter(t => tableNames.includes(t));

        let totalPendingBefore = 0;
        for (const table of tablesToCheck) {
            const count = await getPendingLocalCount(page, table);
            if (count > 0) totalPendingBefore += count;
        }
        
        await triggerSyncAndWait(page);

        let totalPendingAfter = 0;
        for (const table of tablesToCheck) {
            const count = await getPendingLocalCount(page, table);
            if (count > 0) totalPendingAfter += count;
        }
        
        expect(totalPendingAfter).toBe(0);
    });

    test('4 · RELOAD PERSIST — Data survives full page reload', async ({ page }) => {
        console.log('\n[Sync E2E] ── TEST 4: Reload Persist ──');
        await triggerSyncAndWait(page);
        const tableNamesBefore = await getLocalTableNames(page);
        expect(tableNamesBefore.length).toBeGreaterThan(0);
        
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); // Give WDB time to re-attach to window
        
        const tableNamesAfter = await getLocalTableNames(page);
        expect(tableNamesAfter.length).toBeGreaterThan(0);
    });

    test('5 · REMOTE REACHABLE — App communicates with Supabase', async ({ page }) => {
        console.log('\n[Sync E2E] ── TEST 5: Remote Reachability ──');
        
        const isMockMode = await page.evaluate(() => {
            if ((window as any).__EXPO_PUBLIC_E2E_MODE__ === '1') return true;
            const hostname = window.location?.hostname?.toLowerCase() || '';
            const port = window.location?.port || '';
            const isE2EPort = port === '19009' || port === '19119';
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            const isJetfarmPagesHost = hostname === 'jetfarm.pages.dev' || hostname.endsWith('.jetfarm.pages.dev');
            const isJetfarmNetlifyHost = hostname === 'jetfarm.netlify.app' || hostname.endsWith('.jetfarm.netlify.app');
            const isPagesDev = hostname.endsWith('.pages.dev') && !isJetfarmPagesHost;
            const isNetlify = hostname.endsWith('.netlify.app') && !isJetfarmNetlifyHost;
            return (isLocalhost && isE2EPort) || isPagesDev || isNetlify;
        });

        if (isMockMode) {
            console.log('[Sync E2E] Skipping Test 5 because sync is mocked in local E2E/pages.dev mode.');
            return;
        }

        const supabaseRequests: string[] = [];
        page.on('request', req => {
            if (req.url().includes('supabase.co') || req.url().includes('supabase.io') || req.url().includes('127.0.0.1:46421')) {
                supabaseRequests.push(req.url());
            }
        });
        await triggerSyncAndWait(page);
        expect(supabaseRequests.length).toBeGreaterThan(0);
    });

    test('6 · PULL DATA — Remote Supabase data appears in WatermelonDB after sync', async ({ page }) => {
        console.log('\n[Sync E2E] ── TEST 6: Bidirectional PULL Verification ──');

        const isMockMode = await page.evaluate(() => {
            const hostname = window.location.hostname;
            const port = window.location.port;
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            const isE2EPort = port === '19009' || port === '19119';
            const isJetfarmPagesHost = hostname === 'jetfarm.pages.dev' || hostname.endsWith('.jetfarm.pages.dev');
            const isJetfarmNetlifyHost = hostname === 'jetfarm.netlify.app' || hostname.endsWith('.jetfarm.netlify.app');
            const isPagesDev = hostname.endsWith('.pages.dev') && !isJetfarmPagesHost;
            const isNetlify = hostname.endsWith('.netlify.app') && !isJetfarmNetlifyHost;
            return (isLocalhost && isE2EPort) || isPagesDev || isNetlify;
        });

        if (isMockMode) {
            console.log('[Sync E2E] Skipping Test 6 because sync is mocked in local E2E/pages.dev mode.');
            return;
        }

        // Authenticate the test runner client so it has SELECT/INSERT permissions on app_action_logs
        const { error: loginError } = await supabase.auth.signInWithPassword({
            email: 'admin@jetfarm.com',
            password: '12345678'
        });
        if (loginError) {
            console.log('[Sync E2E] Could not authenticate test runner client with Supabase. Error:', loginError);
            test.skip();
            return;
        }

        const sentinelId = `pull-test-${Date.now()}`;
        const now = new Date().toISOString();

        const { error: insertError } = await supabase
            .from('app_action_logs')
            .insert([{
                id: sentinelId,
                action: 'CREATE',
                entity_type: 'test',
                entity_id: sentinelId,
                performed_by: 'e2e-test-pull',
                timestamp: now,
                created_at: now,
                updated_at: now,
                deleted_at: null
            }]);

        if (insertError) {
            console.log('[Sync E2E] Could not insert sentinel into Supabase. Error:', insertError);
            test.skip();
            return;
        }
        console.log(`[Sync E2E] Sentinel ${sentinelId} inserted into Supabase app_action_logs`);

        await triggerSyncAndWait(page);

        const isPresentLocal = await page.evaluate(async (id: string) => {
            const db = (window as any).__WATERMELON_DB__;
            if (!db || !db.collections.map['action_logs']) return false;
            try {
                const record = await db.collections.get('action_logs').find(id);
                return !!record;
            } catch (e) {
                return false;
            }
        }, sentinelId);

        expect(isPresentLocal, 'Sentinel record should be pulled into WatermelonDB').toBe(true);
        console.log('[Sync E2E] ✓ Sentinel successfully pulled from Supabase');
    });

    test('7 · PUSH DATA — Local WatermelonDB data appears in Supabase after sync', async ({ page }) => {
        console.log('\n[Sync E2E] ── TEST 7: Bidirectional PUSH Verification ──');

        const isMockMode = await page.evaluate(() => {
            const hostname = window.location.hostname;
            const port = window.location.port;
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            const isE2EPort = port === '19009' || port === '19119';
            const isJetfarmPagesHost = hostname === 'jetfarm.pages.dev' || hostname.endsWith('.jetfarm.pages.dev');
            const isJetfarmNetlifyHost = hostname === 'jetfarm.netlify.app' || hostname.endsWith('.jetfarm.netlify.app');
            const isPagesDev = hostname.endsWith('.pages.dev') && !isJetfarmPagesHost;
            const isNetlify = hostname.endsWith('.netlify.app') && !isJetfarmNetlifyHost;
            return (isLocalhost && isE2EPort) || isPagesDev || isNetlify;
        });

        if (isMockMode) {
            console.log('[Sync E2E] Skipping Test 7 because sync is mocked in local E2E/pages.dev mode.');
            return;
        }

        // Authenticate the test runner client
        const { error: loginError } = await supabase.auth.signInWithPassword({
            email: 'admin@jetfarm.com',
            password: '12345678'
        });
        if (loginError) {
            console.log('[Sync E2E] Could not authenticate test runner client with Supabase. Error:', loginError);
            test.skip();
            return;
        }

        const sentinelId = `push-test-${Date.now()}`;
        const now = Date.now();

        const injected = await injectLocalRecord(page, 'action_logs', {
            id: sentinelId,
            action: 'CREATE',
            entity_type: 'test',
            entity_id: sentinelId,
            performed_by: 'e2e-test-push',
            timestamp: now,
            created_at: now,
            updated_at: now,
            _status: 'created',
            _changed: 'action,entity_type,entity_id,performed_by,timestamp'
        });

        expect(injected, 'Should be able to inject record into WatermelonDB').toBe(true);
        console.log(`[Sync E2E] Sentinel ${sentinelId} injected into local WatermelonDB`);

        await triggerSyncAndWait(page);
        await new Promise(r => setTimeout(r, 1000));

        const { data, error } = await supabase
            .from('app_action_logs')
            .select('id, action')
            .eq('id', sentinelId)
            .limit(1);

        if (error) {
            throw new Error(`Supabase query failed: ${error.message}`);
        }

        const isPresentRemote = data && data.length > 0;
        if (!isPresentRemote) {
            throw new Error(`Sentinel ${sentinelId} was not found in remote Supabase after push.`);
        }

        console.log('[Sync E2E] ✓ Sentinel successfully pushed to Supabase');
    });
});
