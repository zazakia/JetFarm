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
    'stock_movements',
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
    let contract: {
        coreTables: string[];
        configTables: string[];
        localOnlyTables: string[];
        remoteTableMap: Record<string, string>;
        apiOnlyTables: string[];
    };

    beforeAll(() => {
        tables = schemaTableNames();
        contract = JSON.parse(read(CONTRACT));
    });

    it('parses both sources before asserting anything', () => {
        expect(tables.length).toBeGreaterThan(20);
        expect(Object.keys(contract.remoteTableMap).length).toBeGreaterThan(20);
    });

    it('carries no non-agribusiness table', () => {
        const present = FORBIDDEN_TABLES.filter((t) => tables.includes(t));
        expect(present).toEqual([]);
    });

    it('has no model class for a deleted table', () => {
        const models = modelTableNames();
        // positive control: the parse is real, not an empty array matching nothing
        expect(models).toContain('agri_parcels');
        expect(models.length).toBeGreaterThan(20);
        const present = FORBIDDEN_TABLES.filter((t) => models.includes(t));
        expect(present).toEqual([]);
    });

    it('bumps the schema version so the deleteTable migration step runs', () => {
        expect(schemaVersion()).toBe(50);
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
