/**
 * Agribusiness-only schema and sync-contract guard (branch: agribusiness-only).
 *
 * Why this exists: the teardown has to remove the non-agribusiness tables from all three places at
 * once -- the WatermelonDB schema, the model registry, and the sync contract that decides what is
 * pushed to Postgres. Partial removal is the dangerous state: a schema table with no contract entry
 * silently stops syncing, and a contract entry with no remote table turns every push into a
 * PGRST204 batch rejection. Names are parsed from source with the same regex
 * schemaContracts.regression.test.ts:710 uses, so this guard has no runtime dependency on
 * WatermelonDB.
 *
 * The forbidden list is evidence-backed, not a guess: every entry here is reached only from the
 * screens, services and models being deleted (verified by git grep 2026-10-20), and the tables that
 * merely look coop-ish stay out of it -- business_units (used by the kept /(admin)/users screens),
 * suppliers + accounts_payable_vouchers + stock_movements' kept neighbours (used by the accounting
 * books), and statutory_fund_allocations (statutory reserves report). `children` is in: it is the
 * borrower's dependent table (models/Child.ts:5, models/Borrower.ts:48), not a React prop.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string[]) => fs.readFileSync(path.join(process.cwd(), ...rel), 'utf8');

const SCHEMA = ['src', 'database', 'schema.ts'];
const CONTRACT = ['src', 'services', 'syncTableContract.json'];
const MODELS_DIR = ['src', 'database', 'models'];

const FORBIDDEN_TABLES = [
    // lending / cooperative credit
    'loan_penalties',
    'loan_products',
    'loan_applications',
    'borrowers',
    'collectors',
    'collection_logs',
    'collection_groups',
    'loans',
    'payment_schedules',
    'payments',
    'guarantors',
    'dependents',
    'children',
    'savings_transactions',
    'share_capital_transactions',
    'remittances',
    'file_cases',
    'committees',
    'committee_members',
    'board_resolutions',
    'meeting_attendance',
    // QSR / retail / commissary
    'pos_sessions',
    'sales_returns',
    'sales_return_lines',
    'commissary_dispatches',
    'waste_logs',
    'store_audits',
    // payroll and franchise
    'employees',
    'employee_leaves',
    'payrolls',
    'payroll_runs',
    'payroll_lines',
    'royalty_calculations',
    'franchise_contracts',
    'franchise_royalty_ledger',
    // coop business-unit modules
    'ws_customers',
    'ws_deliveries',
    'ws_containers',
    'ws_payments',
    'ws_expenses',
    'module_transactions',
    // marketplace
    'marketplace_stores',
    'marketplace_categories',
    'marketplace_products',
    'marketplace_orders',
    'marketplace_sub_orders',
    'marketplace_order_items',
    'marketplace_payouts',
    'marketplace_reviews',
    'marketplace_promotions',
    'marketplace_disputes',
];

// app_* is NOT disqualifying on its own: the kept finance/shell tables expenses, cash_transactions,
// bank_accounts, bank_transactions, action_logs, app_settings, feature_flags, role_permissions,
// areas and financial_snapshots all ride app_*. These prefixes are exclusively non-agri.
const FORBIDDEN_REMOTE_PREFIXES = ['ws_', 'marketplace_', 'cic_'];

// Documented deviations from the teardown plan: kept because a surviving agribusiness/finance
// consumer still reads them. Each is asserted PRESENT below so a later cleanup cannot drop it by
// accident, and the reason lives here instead of in someone's memory.
const KEPT_DEVIATIONS: { table: string; because: string }[] = [
    {
        // The plan listed stock_movements under "QSR / retail / commissary", but the table is the
        // inventory book of the kept accounting layer: src/services/InventoryJournalService.ts
        // writes it and app/(admin)/accounting/inventory-journal.tsx renders it; UserTracingService
        // and auditTrailFormatter read it. Retail POS (pos_sessions, sales_returns) went, the
        // inventory ledger stayed.
        table: 'stock_movements',
        because: 'kept InventoryJournalService + accounting/inventory-journal screen',
    },
];

const MIGRATIONS = ['src', 'database', 'migrations.ts'];

// The v50 step is the authoritative list of retired tables: whatever it drops must be gone from the
// schema, the model registry and the sync contract. Deriving the forbidden set from the migration
// instead of trusting only the hand-written list is what keeps this guard honest as the teardown
// grows -- stragglers like device_registry and any later drop are covered without a second edit.
const retiredTables = (): string[] => {
    const src = read(MIGRATIONS);
    const step = src.match(/toVersion:\s*50,\s*steps:\s*\[([\s\S]*?)\n\s*\],/);
    if (!step) throw new Error('could not parse the toVersion: 50 step from migrations.ts');
    const names = [...step[1].matchAll(/DROP TABLE IF EXISTS ([a-z0-9_]+);/g)].map((m: RegExpMatchArray) => m[1]);
    expect(names.length).toBeGreaterThan(20);
    expect(new Set(names).size).toBe(names.length);
    return names;
};

const schemaTableNames = () => [
    ...read(SCHEMA).matchAll(/tableSchema\(\{\s*name:\s*'([^']+)'/g),
].map((m: RegExpMatchArray) => m[1]);

const schemaVersion = () => {
    const hit = read(SCHEMA).match(/appSchema\(\{\s*version:\s*(\d+)/);
    if (!hit) throw new Error('could not parse appSchema version from schema.ts');
    return Number(hit[1]);
};

// Models declare `static table = 'x'` (verified: src/database/models/AgriParcel.ts:5), not a
// `@table('x')` decorator. Matching the wrong shape makes the deleted-table assertion below pass
// while checking nothing, so the parse is pinned: every model file must yield exactly one name,
// and a kept table must be recognised.
const modelFiles = () =>
    fs
        .readdirSync(path.join(process.cwd(), ...MODELS_DIR))
        .filter((f) => f.endsWith('.ts') && f !== 'index.ts');

const modelTableNames = () => {
    const names: string[] = [];
    for (const file of modelFiles()) {
        const src = read([...MODELS_DIR, file]);
        const found = [...src.matchAll(/static\s+table\s*=\s*'([^']+)'/g)].map((m: RegExpMatchArray) => m[1]);
        expect(found).toHaveLength(1);
        names.push(...found);
    }
    return names;
};

describe('agribusiness-only schema and sync contract', () => {
    let tables: string[];
    let retired: string[];
    let contract: {
        coreTables: string[];
        configTables: string[];
        localOnlyTables: string[];
        remoteTableMap: Record<string, string>;
        apiOnlyTables: string[];
    };

    beforeAll(() => {
        tables = schemaTableNames();
        retired = retiredTables();
        contract = JSON.parse(read(CONTRACT));
    });

    it('parses both sources before asserting anything', () => {
        expect(tables.length).toBeGreaterThan(20);
        expect(retired.length).toBeGreaterThan(20);
        expect(Object.keys(contract.remoteTableMap).length).toBeGreaterThan(20);
    });

    it('retires every table the hand-written list names', () => {
        // A name in FORBIDDEN_TABLES that the v50 step does not drop means the local schema and the
        // remote database would disagree, so the list is checked against the migration it claims.
        const missing = FORBIDDEN_TABLES.filter((t) => !retired.includes(t));
        expect(missing).toEqual([]);
    });

    it('carries no non-agribusiness table', () => {
        const present = retired.filter((t) => tables.includes(t));
        expect(present).toEqual([]);
    });

    it('has no model class for a deleted table', () => {
        const models = modelTableNames();
        // positive control: the parse is real, not an empty array matching nothing
        expect(models).toContain('agri_parcels');
        expect(models.length).toBeGreaterThan(20);
        const present = retired.filter((t) => models.includes(t));
        expect(present).toEqual([]);
    });

    it('keeps each documented deviation and states why it survived', () => {
        const models = modelTableNames();
        for (const deviation of KEPT_DEVIATIONS) {
            expect(tables).toContain(deviation.table);
            expect(models).toContain(deviation.table);
            expect(Object.keys(contract.remoteTableMap)).toContain(deviation.table);
            // A deviation that also landed in the drop list would silently delete itself on upgrade.
            expect(retired).not.toContain(deviation.table);
            expect(deviation.because.length).toBeGreaterThan(10);
        }
    });

    it('bumps the schema version so the v50 drop step runs', () => {
        expect(schemaVersion()).toBe(50);
    });

    it('declares no column pointing at a retired table', () => {
        // The retire migration drops app_cash_transactions.pos_session_id on the remote side, so a
        // local schema that still declares it would push a column Postgres no longer has, and
        // PostgREST rejects the whole batch (PGRST204), not just that row.
        const retiredColumns = ['pos_session_id'];
        const schemaSrc = read(SCHEMA);
        const modelSrc = read([...MODELS_DIR, 'CashTransaction.ts']);
        for (const column of retiredColumns) {
            expect(schemaSrc).not.toContain(`{ name: '${column}'`);
            expect(modelSrc).not.toContain(`@field('${column}')`);
        }
        // positive control: the files parsed are the real ones, not an empty read
        expect(schemaSrc).toContain("name: 'cash_transactions'");
        expect(modelSrc).toContain("@field('particulars')");
    });

    it('keeps every declared table mapped in the sync contract, or declared local/api-only', () => {
        const synced = new Set([...Object.keys(contract.remoteTableMap)]);
        const declared = new Set([
            ...synced,
            ...contract.localOnlyTables,
            ...contract.apiOnlyTables,
        ]);
        const orphaned = tables.filter((t) => !declared.has(t));
        expect(orphaned).toEqual([]);
    });

    it('maps nothing in the contract that no longer exists in the schema', () => {
        const stale = Object.keys(contract.remoteTableMap).filter((t) => !tables.includes(t));
        expect(stale).toEqual([]);
    });

    it('pushes no remote table whose local side was deleted', () => {
        // remoteTableMap is local -> remote; check both ends of every pair
        const hit = Object.entries(contract.remoteTableMap).filter(
            ([local, remote]) =>
                retired.includes(local) ||
                FORBIDDEN_TABLES.includes(local) ||
                FORBIDDEN_REMOTE_PREFIXES.some((p) => remote.startsWith(p))
        );
        // app_borrowers/app_loans/... belong to the deleted lending set; ws_* and marketplace_*
        // to the deleted modules. cic_* must not appear at all, the api-only pair being removed
        // together with src/services/cic.
        expect(hit.map(([local]) => local)).toEqual([]);
        expect(contract.apiOnlyTables).toEqual([]);
    });

    it('still syncs the agribusiness and finance core', () => {
        for (const required of [
            'agri_parcels',
            'agri_land_owners',
            'agri_crop_cycles',
            'agri_harvest_logs',
            'agri_weekly_settlements',
            'journal_entries',
            'journal_entry_lines',
            'chart_of_accounts',
            'bank_accounts',
            'cash_transactions',
            'user_profiles',
        ]) {
            expect(tables).toContain(required);
        }
        expect(contract.localOnlyTables).toEqual(['agri_pending_layout_operations']);
    });
});
