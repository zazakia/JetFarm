import fs from 'fs';
import path from 'path';

// Objects declared at depth 1 of an array literal, so nested column arrays don't leak in.
function directArrayEntries(source: string, key: string): string[] {
    const hit = source.match(new RegExp(`${key}:\\s*\\[`));
    if (!hit) return [];
    const open = source.indexOf('[', hit.index);
    let depth = 0;
    let start = -1;
    const entries: string[] = [];

    for (let i = open + 1; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{' || ch === '[' || ch === '(') depth += 1;
        else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
        if (ch === '{' && depth === 1) start = i;
        if (ch === '}' && depth === 0 && start >= 0) {
            entries.push(source.slice(start, i + 1));
            start = -1;
        }
        if (ch === ']' && depth === 0) break;
    }

    return entries;
}

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

    it('keeps the schema-only migration runner dry by default and free of credentials', () => {
        // The live schema repair for H1-H4 / M2 runs through scripts/apply-hetzner-migrations.mjs
        // instead of a full deploy, so its safety properties are contractual:
        const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'apply-hetzner-migrations.mjs'), 'utf8');

        // 1. writes require an explicit flag; plain invocation only reports
        expect(script).toContain("'--apply'");
        expect(script).toMatch(/if \(!apply\)[\s\S]*?process\.exit\(0\)/);
        // 2. no credentials, and no reading of an env file -- the SSH alias is the only config
        expect(script).not.toMatch(/SUPABASE_(SERVICE_ROLE|SECRET|PASSWORD|TOKEN|DB)/);
        expect(script).not.toMatch(/sb_(secret|pat)_/);
        expect(script).not.toMatch(/password\s*[:=]/i);
        expect(script).not.toMatch(/readFileSync\([^)]*\.env/);
        expect(script.match(/process\.env\.[A-Z_]+/g)).toEqual(['process.env.HETZNER_SSH_ALIAS']);
        // 3. it must not be able to wreck a live database with the bootstrap migration
        expect(script).toContain('20260401000000_initial_schema');
        // 4. it shares the deploy ledger, so a full deploy cannot re-apply the same file
        expect(script).toContain('deploy_schema_migrations');
        expect(script).toContain("APP_NAME = 'jetfarm'");
        // 5. it does not touch the site directory or the web bundle
        expect(script).not.toMatch(/rm -rf|tar -xzf|dist_update|site\/\*/);
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

    it('keeps the repaired push columns available locally, remotely, and in the typed sample', () => {
        // docs/CRUD-PERSISTENCE-AUDIT.md H1-H4, repaired by the 20260927000000 migration.
        // The general invariant lives in `pushes only columns that the remote table actually
        // has`; this pins the specific columns so a future regeneration of types.ts or a schema
        // rename cannot quietly drop them again.
        const repair = fs.readFileSync(
            path.join(process.cwd(), 'supabase', 'migrations', '20260927000000_sync_push_repair_missing_remote_columns.sql'),
            'utf8'
        );

        for (const [table, columns] of Object.entries({
            collectors: ['commission_rate', 'member_id'],
            employees: ['name', 'role', 'base_salary']
        })) {
            for (const column of columns) {
                expect(tableColumns(table)).toHaveProperty(column);
                expect(repair).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
            }
        }

        // H3/H4 add only a soft-delete column to two remote tables that have no local schema
        // entry of their own, so they are asserted against the migration alone.
        for (const table of ['device_registry', 'statutory_rates']) {
            expect(repair).toMatch(new RegExp(`ALTER TABLE public\\.${table}\\s+ADD COLUMN IF NOT EXISTS deleted_at`));
        }
        expect(repair).toContain("NOTIFY pgrst, 'reload schema'");

        // types.ts is a hand-maintained sample (18 of 88 tables), not a live generation, so only
        // the tables it does declare can be pinned.
        const types = fs.readFileSync(path.join(process.cwd(), 'src', 'database', 'types.ts'), 'utf8');
        const appCollectorsBlock = types.match(/app_collectors:\s*{[\s\S]*?Relationships:\s*\[\]/)?.[0] ?? '';
        expect(appCollectorsBlock).toContain('commission_rate: number | null');
        expect(appCollectorsBlock).toContain('commission_rate?: number | null');
        expect(appCollectorsBlock).toContain('member_id: string | null');
        expect(appCollectorsBlock).toContain('member_id?: string | null');
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

    describe('local columns must exist remotely (push payload contract)', () => {
        // WHY THIS EXISTS -----------------------------------------------------------------------
        // SyncService.sanitizeRecord strips only `_status` and `_changed`, and WatermelonDB's
        // sanitizedRaw() guarantees record._raw contains *every* column of the local tableSchema
        // (null for unset optionals). The full raw object is what gets upserted. Therefore a single
        // local column that the remote table does not have makes PostgREST reject the whole batch
        // with PGRST204, which getSyncFailureKind() classifies as 'schema'. The push loop only
        // defers a missing *table* on an optional table -- never a column -- so the table's push
        // hard-fails, the cycle throws, and those rows are retried forever and never marked synced.
        // See docs/CRUD-PERSISTENCE-AUDIT.md sections 2-3 (H1-H4).
        // This check needs no credentials and no network: migrations are the remote truth.

        const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

        function matchParen(text: string, openIndex: number): number {
            let depth = 0;
            for (let i = openIndex; i < text.length; i += 1) {
                if (text[i] === '(') depth += 1;
                else if (text[i] === ')') {
                    depth -= 1;
                    if (depth === 0) return i;
                }
            }
            return -1;
        }

        const CONSTRAINT_KEYWORDS = /^\s*(constraint|primary|unique|foreign|exclude|check|with|using|on)\b/i;

        function remoteColumnsByTable(): Record<string, Set<string>> {
            const tables: Record<string, Set<string>> = {};

            for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
                const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8').replace(/\r/g, '');

                for (const m of source.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_."]+)\s*\(/gi)) {
                    const raw = m[1].replace(/"/g, '');
                    const name = raw.includes('.') ? raw.split('.').pop()! : raw;
                    const open = source.indexOf('(', m.index + m[0].length - 1);
                    const close = matchParen(source, open);
                    if (close < 0) continue;
                    if (!tables[name]) tables[name] = new Set();
                    for (const line of source.slice(open + 1, close).split('\n')) {
                        if (!line.trim() || CONSTRAINT_KEYWORDS.test(line)) continue;
                        const col = line.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s+\S/i);
                        if (col) tables[name].add(col[1].toLowerCase());
                    }
                }

                // ALTER statements also live inside `DO $$ ... IF EXISTS (...) THEN ALTER TABLE ...`
                // guards, so anchor on every occurrence and read forward to the next semicolon.
                // Skipping those made real remote columns look like sync losses.
                for (const m of source.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+|ONLY\s+)?([a-zA-Z0-9_.]+)/gi)) {
                    const target = m[1].replace(/^\.|\.$/g, '').split('.').pop()!;
                    const columns = tables[target];
                    if (!columns) continue;
                    const tail = source.slice(m.index + m[0].length);
                    const end = tail.indexOf(';');
                    if (end < 0) continue;
                    for (const c of tail.slice(0, end).matchAll(/ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s+\S/gi)) {
                        columns.add(c[1].toLowerCase());
                    }
                }
            }

            return tables;
        }

        function localSchemaTables(): Record<string, string[]> {
            const schema = fs.readFileSync(path.join(process.cwd(), 'src', 'database', 'schema.ts'), 'utf8');
            const hits = [...schema.matchAll(/tableSchema\(\{\s*name:\s*'([^']+)'/g)];
            const out: Record<string, string[]> = {};

            hits.forEach((hit, index) => {
                // Start after `tableSchema({ name: 'x'` so the table's own name isn't read as a column.
                const start = hit.index + hit[0].length;
                const end = index + 1 < hits.length ? hits[index + 1].index : schema.length;
                out[hit[1]] = [...schema.slice(start, end).matchAll(/\{\s*name:\s*'([^']+)'/g)].map((c) => c[1]);
            });

            return out;
        }

        it('pushes only columns that the remote table actually has', () => {
            const contract = JSON.parse(fs.readFileSync(
                path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'),
                'utf8'
            ));
            const synced: string[] = [...contract.coreTables, ...contract.configTables];
            const remoteMap: Record<string, string> = contract.remoteTableMap;
            const remote = remoteColumnsByTable();
            const local = localSchemaTables();

            const offenders: string[] = [];
            for (const table of synced) {
                const remoteName = remoteMap[table] ?? table;
                const remoteColumns = remote[remoteName];
                if (!remoteColumns) {
                    offenders.push(`${table} -> ${remoteName}: remote table not found in migrations`);
                    continue;
                }
                // deleted_at is always sent by the soft-delete upsert, even with no local deletion.
                const required = new Set([...(local[table] ?? []), 'deleted_at']);
                const missing = [...required].filter((column) => !remoteColumns.has(column));
                if (missing.length) offenders.push(`${table} -> ${remoteName}: ${missing.sort().join(', ')}`);
            }

            expect(offenders).toEqual([]);
        });

        it('keeps the coop module registry honest about the tables it claims', () => {
            const local = new Set(Object.keys(localSchemaTables()));
            const contract = JSON.parse(fs.readFileSync(
                path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'),
                'utf8'
            ));
            const remote = remoteColumnsByTable();
            const modulesDir = path.join(process.cwd(), 'src', 'modules');

            const phantoms: string[] = [];
            for (const entry of fs.readdirSync(modulesDir)) {
                const manifestPath = path.join(modulesDir, entry, 'manifest.ts');
                if (!fs.existsSync(manifestPath)) continue;
                const source = fs.readFileSync(manifestPath, 'utf8');
                // Only depth-1 objects of `dbTables: [...]` are tables; the nested
                // `columns: [{ name: ... }]` entries inside them are not.
                for (const entryBody of directArrayEntries(source, 'dbTables')) {
                    const table = entryBody.match(/^\{\s*name:\s*'([a-z0-9_]+)'/)?.[1];
                    if (!table) continue;
                    const remoteName = contract.remoteTableMap[table] ?? table;
                    if (!local.has(table) && !remote[remoteName]) {
                        phantoms.push(`${entry}: ${table}`);
                    }
                }
            }

            expect(phantoms).toEqual([]);
        });
    });

    describe('migration history stays reproducible and referentially reachable', () => {
        // WHY THIS EXISTS -----------------------------------------------------------------------
        // The migrations directory *is* the remote schema as far as these guards are concerned, so
        // two failure modes have to be locked down:
        //
        // 1. The same table created by two files. Both sites use `CREATE TABLE IF NOT EXISTS`, so
        //    the second block is a silent no-op on a fresh database -- the first one wins. That is
        //    harmless while the copies agree and invisible drift the moment they don't, which is
        //    exactly how the water-station and CIC repair migrations were written
        //    (docs/CRUD-PERSISTENCE-AUDIT.md M1). Those files are already applied in production, so
        //    rewriting them would change history without changing the database; the invariant is
        //    instead asserted here.
        //
        // 2. A foreign key that aims at a table the client cannot reach. Sync pushes are plain
        //    PostgREST upserts, so a constraint violation (SQLSTATE 23503) on a core table is a
        //    hard push failure: getSyncFailureKind() cannot defer it, the cycle throws, and those
        //    rows retry forever and never get marked synced. app_payrolls.employee_id used to point
        //    at app_employees, which no model, screen, or remoteTableMap entry can write.
        //    See docs/CRUD-PERSISTENCE-AUDIT.md M2 and the repair migration
        //    20261002000000_retire_legacy_payroll_foreign_key.sql.

        const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
        const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

        function readSql(file: string): string {
            return fs.readFileSync(path.join(migrationsDir, file), 'utf8').replace(/\r/g, '');
        }

        function bareName(raw: string): string {
            return raw.replace(/"/g, '').split('.').pop()!.toLowerCase();
        }

        function bodyOf(source: string, openIndex: number): number {
            let depth = 0;
            for (let i = openIndex; i < source.length; i += 1) {
                if (source[i] === '(') depth += 1;
                else if (source[i] === ')') {
                    depth -= 1;
                    if (depth === 0) return i;
                }
            }
            return -1;
        }

        const TABLE_LEVEL_CLAUSE = /^\s*(constraint|primary|unique|foreign|exclude|check|with|using|on)\b/i;

        function createTableBlocks(): { file: string; index: number; table: string; columns: string[]; body: string }[] {
            const blocks: { file: string; index: number; table: string; columns: string[]; body: string }[] = [];

            sqlFiles.forEach((file, index) => {
                const source = readSql(file);
                for (const m of source.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_."]+)\s*\(/gi)) {
                    const open = source.indexOf('(', m.index + m[0].length - 1);
                    const close = bodyOf(source, open);
                    if (close < 0) continue;
                    const body = source.slice(open + 1, close);
                    const columns = body
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line && !TABLE_LEVEL_CLAUSE.test(line))
                        .map((line) => line.match(/^"?([a-z_][a-z0-9_]*)"?\s+\S/i)?.[1]?.toLowerCase())
                        .filter((column): column is string => Boolean(column));

                    blocks.push({ file, index, table: bareName(m[1]), columns, body });
                }
            });

            return blocks;
        }

        it('never lets two migrations disagree about one table definition', () => {
            const byTable: Record<string, { file: string; columns: string[] }[]> = {};
            for (const block of createTableBlocks()) {
                (byTable[block.table] ??= []).push({ file: block.file, columns: block.columns });
            }

            const drifted: string[] = [];
            for (const [table, defs] of Object.entries(byTable)) {
                if (defs.length < 2) continue;
                const reference = [...defs[0].columns].sort().join(',');
                for (const def of defs.slice(1)) {
                    if ([...def.columns].sort().join(',') !== reference) {
                        drifted.push(`${table}: ${defs[0].file} != ${def.file}`);
                    }
                }
            }

            expect(drifted).toEqual([]);
        });

        it('keeps every surviving foreign key pointed at a table the client can reach', () => {
            const contract = JSON.parse(fs.readFileSync(
                path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'),
                'utf8'
            ));
            // Anything the client can pull or push, plus what it never touches at all, is reachable
            // only through remoteTableMap values -- that is the set SyncService can keep referents in.
            const reachable = new Set<string>(Object.values(contract.remoteTableMap) as string[]);

            type ForeignKey = {
                file: string;
                index: number;
                table: string;
                constraint: string;
                referenced: string;
            };

            const created: ForeignKey[] = [];
            const dropped = new Set<string>();

            for (const block of createTableBlocks()) {
                for (const line of block.body.split('\n')) {
                    const inline = line.match(/^\s*"?([a-z_][a-z0-9_]*)"?\s+\S.*REFERENCES\s+([a-zA-Z0-9_."]+)\s*\(/i);
                    if (!inline) continue;
                    created.push({
                        file: block.file,
                        index: block.index,
                        table: block.table,
                        // PostgreSQL derives the name of an inline column reference this way.
                        constraint: `${block.table}_${inline[1].toLowerCase()}_fkey`,
                        referenced: bareName(inline[2]),
                    });
                }
            }

            sqlFiles.forEach((file, index) => {
                const source = readSql(file);

                for (const m of source.matchAll(
                    /ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY\s*\([^)]*\)\s*REFERENCES\s+([a-zA-Z0-9_."]+)/gi
                )) {
                    const table = source
                        .slice(0, m.index)
                        .match(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+|ONLY\s+)?([a-zA-Z0-9_.]+)\s*$/i)?.[1];
                    if (!table) continue;
                    created.push({ file, index, table: bareName(table), constraint: m[1].toLowerCase(), referenced: bareName(m[2]) });
                }

                for (const m of source.matchAll(
                    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+|ONLY\s+)?([a-zA-Z0-9_.]+)[^;]*?DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi
                )) {
                    dropped.add(`${bareName(m[1])}::${m[2].toLowerCase()}`);
                }
            });

            const orphaned = created
                .filter((fk) => !reachable.has(fk.referenced))
                .filter((fk) => !dropped.has(`${fk.table}::${fk.constraint}`))
                .map((fk) => `${fk.file}: ${fk.table}.${fk.constraint} -> ${fk.referenced}`);

            expect(orphaned).toEqual([]);
        });

        it('retires the legacy payroll foreign key in a forward-only migration', () => {
            const repair = readSql('20261002000000_retire_legacy_payroll_foreign_key.sql');
            expect(repair).toContain('DROP CONSTRAINT IF EXISTS app_payrolls_employee_id_fkey');
            // Retiring referential integrity must not retire data, and must not rewrite the
            // original migration (that file is already applied in production).
            expect(repair).not.toMatch(/DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM/i);
            expect(readSql('20260524120000_create_payroll_tables.sql')).toContain('REFERENCES app_employees(id)');
        });
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
