import fs from 'fs';
import path from 'path';

function tableColumns(tableName: string) {
    const schema = fs.readFileSync(path.join(process.cwd(), 'src', 'database', 'schema.ts'), 'utf8');
    const tableStart = schema.indexOf(`name: '${tableName}'`);
    const nextTable = schema.indexOf('tableSchema({', tableStart + 1);
    const block = schema.slice(tableStart, nextTable === -1 ? undefined : nextTable);
    const columns: Record<string, { name: string; type: string; isOptional?: boolean }> = {};

    for (const match of block.matchAll(/\{ name: '([^']+)', type: '([^']+)'(, isOptional: true)?/g)) {
        columns[match[1]] = {
            name: match[1],
            type: match[2],
            ...(match[3] ? { isOptional: true } : {}),
        };
    }

    return columns;
}

describe('local/remote schema regression contracts', () => {
    it('publishes one machine-readable sync contract for the app and integrity verifier', () => {
        const contractPath = path.join(process.cwd(), 'src', 'services', 'syncTableContract.json');

        expect(fs.existsSync(contractPath)).toBe(true);
        const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        const registeredTables = [...contract.coreTables, ...contract.configTables];

        expect(registeredTables.length).toBeGreaterThan(40);
        expect(Object.keys(contract.remoteTableMap).sort()).toEqual(registeredTables.sort());
        expect(contract.remoteTableMap.ws_customers).toBe('ws_customers');
        expect(contract.remoteTableMap.ws_expenses).toBe('ws_expenses');
        expect(contract.coreTables).toContain('file_cases');
        expect(contract.remoteTableMap.file_cases).toBe('app_file_cases');
        const syncService = fs.readFileSync(
            path.join(process.cwd(), 'src', 'services', 'SyncService.ts'),
            'utf8'
        );
        expect(syncService).toMatch(
            /file_cases:\s*\[\s*'filed_date',\s*'created_at',\s*'updated_at',\s*'deleted_at'\s*\]/
        );
    });

    it('ships a forward-only CIC production repair migration', () => {
        const migration = fs.readFileSync(
            path.join(process.cwd(), 'supabase', 'migrations', '20260715075836_repair_cic_production_schema.sql'),
            'utf8'
        );

        for (const column of ['middle_name', 'name_suffix', 'mother_maiden_name', 'sss_number', 'gsis_number', 'philhealth_number']) {
            expect(migration).toContain(column);
        }
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.cic_settings');
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.cic_submissions');
        expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
        expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    });

    it('verifies CIC API-only tables even though they are not Watermelon sync tables', () => {
        const contract = JSON.parse(fs.readFileSync(
            path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'),
            'utf8'
        ));
        const verifier = fs.readFileSync(path.join(process.cwd(), 'scripts', 'verify-sync-integrity.mjs'), 'utf8');

        expect(contract.apiOnlyTables).toEqual(expect.arrayContaining(['cic_settings', 'cic_submissions']));
        expect(verifier).toContain('apiOnlyTables');
        expect(verifier).toContain('verifierTables');
    });

    it('verifies required remote borrower columns instead of table reachability alone', () => {
        const contract = JSON.parse(fs.readFileSync(
            path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'),
            'utf8'
        ));
        const verifier = fs.readFileSync(path.join(process.cwd(), 'scripts', 'verify-sync-integrity.mjs'), 'utf8');

        expect(contract.requiredRemoteColumns.borrowers).toEqual(expect.arrayContaining([
            'middle_name',
            'name_suffix',
            'mother_maiden_name',
            'sss_number',
            'gsis_number',
            'philhealth_number',
        ]));
        expect(verifier).toContain('requiredRemoteColumns');
        expect(verifier).toContain('requiredColumns.join');
    });

    it('keeps the sync verifier local-first, read-only by default, and contract-driven', () => {
        const verifier = fs.readFileSync(
            path.join(process.cwd(), 'scripts', 'verify-sync-integrity.mjs'),
            'utf8'
        );

        expect(verifier).toContain("syncTableContract.json");
        expect(verifier).toContain("args.includes('--production')");
        expect(verifier).toContain("args.includes('--canary')");
        expect(verifier).toContain("args.includes('--allow-production-write')");
        expect(verifier).toMatch(/PRODUCTION\s*&&\s*CANARY\s*&&\s*!ALLOW_PRODUCTION_WRITE/);
        expect(verifier).toContain(".limit(1)");
        expect(verifier).toContain("error?.code === 'PGRST303'");
        expect(verifier).toContain('LOCAL_JWT_SKEW_RETRY_MS');
        expect(verifier).not.toContain("head: true");
        expect(verifier).not.toContain('ANON_KEY.slice');
    });

    it('keeps production migration utilities free of embedded credentials', () => {
        const rpcScript = fs.readFileSync(path.join(process.cwd(), 'scripts', 'apply-migrations-via-rpc.mjs'), 'utf8');
        const checkScript = fs.readFileSync(path.join(process.cwd(), 'scripts', 'check-production-migrations.mjs'), 'utf8');
        const scripts = `${rpcScript}\n${checkScript}`;

        expect(scripts).not.toMatch(/sb_secret_[A-Za-z0-9_-]+/);
        expect(scripts).not.toMatch(/password\s*:\s*['"][^'"]+['"]/i);
        expect(rpcScript).toContain('SUPABASE_SECRET_KEY');
        expect(checkScript).toContain('SUPABASE_DB_PASSWORD');
    });

    it('exposes detailed sync audit export and deletion controls in Sync Center', () => {
        const syncCenter = fs.readFileSync(path.join(process.cwd(), 'app', 'sync-center.tsx'), 'utf8');

        expect(syncCenter).toContain('syncAuditLogService.exportLatest');
        expect(syncCenter).toContain('syncAuditLogService.clearRetainedSessions');
        expect(syncCenter).toContain('export-detailed-sync-log');
        expect(syncCenter).toContain('delete-detailed-sync-logs');
        expect(syncCenter).toContain('auditPersistenceWarning');
    });

    it('keeps configurable settings tables available locally and in sync mapping', () => {
        for (const table of ['app_settings', 'loan_products', 'feature_flags', 'role_permissions']) {
            expect(Object.keys(tableColumns(table)).length).toBeGreaterThan(0);
        }

        const syncService = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'SyncService.ts'), 'utf8');
        const contract = JSON.parse(fs.readFileSync(
            path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'),
            'utf8'
        ));
        expect(syncService).toContain('EXPO_PUBLIC_ENABLE_CONFIG_SYNC');
        expect(syncService).toContain('CONFIG_SYNC_TABLES');
        expect(contract.configTables).toContain('app_settings');
        expect(contract.remoteTableMap.loan_products).toBe('app_loan_products');
        expect(contract.remoteTableMap.feature_flags).toBe('app_feature_flags');
        expect(contract.remoteTableMap.role_permissions).toBe('app_role_permissions');
    });

    it('registers file cases in the web WatermelonDB model list', () => {
        const webDatabase = fs.readFileSync(path.join(process.cwd(), 'src', 'database', 'index.web.ts'), 'utf8');

        expect(webDatabase).toContain("import FileCase from './models/FileCase';");
        expect(webDatabase).toMatch(/modelClasses:\s*\[[\s\S]*\bFileCase\b[\s\S]*\]/);
    });

    it('keeps local Watermelon payments aligned with remote app_payments.borrower_id', () => {
        const columns = tableColumns('payments');

        expect(columns.borrower_id).toEqual(expect.objectContaining({
            name: 'borrower_id',
            type: 'string',
            isOptional: true,
        }));
    });

    it('keeps generated Supabase types aware of app_payments.borrower_id', () => {
        const types = fs.readFileSync(path.join(process.cwd(), 'src', 'database', 'types.ts'), 'utf8');
        const appPaymentsBlock = types.match(/app_payments:\s*{[\s\S]*?Relationships:\s*\[\]/)?.[0] ?? '';

        expect(appPaymentsBlock).toContain('borrower_id: string');
        expect(appPaymentsBlock).toContain('borrower_id?: string');
    });

    it('keeps loan product computation fields available locally and remotely', () => {
        const columns = tableColumns('loans');
        expect(columns.loan_type).toEqual(expect.objectContaining({ type: 'string', isOptional: true }));
        expect(columns.processing_fee).toEqual(expect.objectContaining({ type: 'number', isOptional: true }));
        expect(columns.vat_on_interest).toEqual(expect.objectContaining({ type: 'number', isOptional: true }));
        expect(columns.savings_per_payment).toEqual(expect.objectContaining({ type: 'number', isOptional: true }));

        const migration = fs.readFileSync(
            path.join(process.cwd(), 'supabase', 'migrations', '20260512180000_add_loan_product_computation_fields.sql'),
            'utf8'
        );
        expect(migration).toContain('loan_type');
        expect(migration).toContain('savings_per_payment');
    });

    describe('sync engine completeness and exhaustiveness check', () => {
        const ALLOWED_UNSYNCED_TABLES = new Set<string>();

        function getSchemaTables(): string[] {
            const schema = fs.readFileSync(path.join(process.cwd(), 'src', 'database', 'schema.ts'), 'utf8');
            const matches = [...schema.matchAll(/tableSchema\(\{\s*name:\s*'([^']+)'/g)];
            return matches.map(m => m[1]);
        }

        function getSyncServiceInfo() {
            const syncContent = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'SyncService.ts'), 'utf8');
            const contract = JSON.parse(fs.readFileSync(
                path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'),
                'utf8'
            ));
            const core = contract.coreTables;
            const config = contract.configTables;
            const remoteMapKeys = Object.keys(contract.remoteTableMap);

            // Parse TABLE_BIGINT_FIELDS keys
            const bigintMatch = syncContent.match(/TABLE_BIGINT_FIELDS:\s*Record<string,\s*string\[\]>\s*=\s*{([\s\S]*?)}/);
            const bigintTableKeys = bigintMatch
                ? [...bigintMatch[1].matchAll(/([a-zA-Z0-9_]+)\s*:/g)].map(m => m[1])
                : [];

            return { core, config, remoteMapKeys, bigintTableKeys };
        }

        it('ensures every local schema table is registered in SyncService tables', () => {
            const schemaTables = getSchemaTables();
            const { core, config } = getSyncServiceInfo();
            const syncTables = new Set([...core, ...config]);

            const unregistered: string[] = [];
            for (const table of schemaTables) {
                if (!syncTables.has(table) && !ALLOWED_UNSYNCED_TABLES.has(table)) {
                    unregistered.push(table);
                }
            }

            expect(unregistered).toEqual([]);
        });

        it('ensures every registered sync table exists in the schema.ts', () => {
            const schemaTables = new Set(getSchemaTables());
            const { core, config } = getSyncServiceInfo();
            const syncTables = [...core, ...config];

            const phantomTables: string[] = [];
            for (const table of syncTables) {
                if (!schemaTables.has(table)) {
                    phantomTables.push(table);
                }
            }

            expect(phantomTables).toEqual([]);
        });

        it('ensures every registered sync table has a key mapping in REMOTE_TABLE_MAP', () => {
            const { core, config, remoteMapKeys } = getSyncServiceInfo();
            const syncTables = [...core, ...config];
            const mapKeys = new Set(remoteMapKeys);

            const missingMappings: string[] = [];
            for (const table of syncTables) {
                if (!mapKeys.has(table)) {
                    missingMappings.push(table);
                }
            }

            expect(missingMappings).toEqual([]);
        });

        it('ensures all TABLE_BIGINT_FIELDS target tables are real registered sync tables', () => {
            const { core, config, bigintTableKeys } = getSyncServiceInfo();
            const syncTables = new Set([...core, ...config]);

            const orphanedBigIntConfigs: string[] = [];
            for (const table of bigintTableKeys) {
                if (!syncTables.has(table)) {
                    orphanedBigIntConfigs.push(table);
                }
            }

            expect(orphanedBigIntConfigs).toEqual([]);
        });
    });
});
