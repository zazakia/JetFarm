/**
 * Agribusiness-only route manifest guard (branch: agribusiness-only).
 *
 * Why this exists: the owner asked for a build that is agribusiness only, with lending, CIC
 * reporting, the coop business-unit modules and the retail/food-ops screens physically removed --
 * not hidden behind feature flags. A flag can be flipped back in /settings, and a gated route still
 * mounts long enough to fire its data fetches (measured 2026-10-20: `/cic` issued PostgREST
 * requests before the gate redirect landed). Only absence is durable, so absence is what this test
 * asserts. It is the RED-first check for the deletion stages: every forbidden entry that still
 * exists on disk fails by name.
 */
import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(process.cwd(), 'app');

const FORBIDDEN_ROUTE_GROUPS = [
    '(borrower)',
    '(collector)',
    '(loan-encoder)',
    '(payment-encoder)',
    '(cashier)',
    '(branch-manager)',
    '(commissary)',
    '(executive)',
    '(area-supervisor)',
];

const FORBIDDEN_ADMIN_DIRS = [
    'borrowers',
    'loans',
    'payments',
    'loan-approvals',
    'collectors',
    'file-cases',
    'cic',
    'groups',
    'modules',
    'marketplace',
    'payroll',
    'franchise',
];

const FORBIDDEN_ADMIN_FILES = ['remittances.tsx'];

const FORBIDDEN_ROOT_FILES = ['loan-application.tsx', 'loan-calculator.tsx'];

// The 15 financial-statement reports survive; everything else under reports/ is a credit,
// collection or coop share-capital screen and goes with lending.
const KEPT_REPORTS = [
    'annual-report.tsx',
    'audit.tsx',
    'balance-sheet.tsx',
    'bank-export.tsx',
    'cash-flows.tsx',
    'changes-in-equity.tsx',
    'dashboard.tsx',
    'expenses.tsx',
    'financial-summary.tsx',
    'income-statement.tsx',
    'monthly-sales.tsx',
    'notes-to-fs.tsx',
    'period-settings.tsx',
    'segment-comparison.tsx',
    'statutory-reserves.tsx',
];

const REQUIRED_AGRI_SCREENS = [
    'index.tsx',
    'parcels.tsx',
    'mapping.tsx',
    'cycles.tsx',
    'harvest.tsx',
    'settlements.tsx',
    'investors.tsx',
    'labor.tsx',
    'workers.tsx',
    'expenses.tsx',
    'accounting.tsx',
    'analytics.tsx',
    'implementation-report.tsx',
];

const exists = (...parts: string[]) => fs.existsSync(path.join(APP_DIR, ...parts));
const listFiles = (dir: string) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.tsx')) : [];

describe('agribusiness-only route manifest', () => {
    it('has no non-agribusiness role route groups', () => {
        const present = FORBIDDEN_ROUTE_GROUPS.filter((group) => exists(group));
        expect(present).toEqual([]);
    });

    it('has no lending, CIC, module, marketplace, payroll or franchise admin screens', () => {
        const present = FORBIDDEN_ADMIN_DIRS.filter((dir) => exists('(admin)', dir));
        const files = FORBIDDEN_ADMIN_FILES.filter((file) => exists('(admin)', file));
        expect({ present, files }).toEqual({ present: [], files: [] });
    });

    it('has no top-level loan screens', () => {
        const present = FORBIDDEN_ROOT_FILES.filter((file) => exists(file));
        expect(present).toEqual([]);
    });

    it('keeps only the 15 financial-statement reports', () => {
        const reports = listFiles(path.join(APP_DIR, '(admin)', 'reports')).sort();
        const extra = reports.filter((f) => !KEPT_REPORTS.includes(f));
        const missing = [...KEPT_REPORTS].sort().filter((f) => !reports.includes(f));
        expect({ extra, missing }).toEqual({ extra: [], missing: [] });
    });

    it('keeps all 13 agribusiness screens', () => {
        const reports = listFiles(path.join(APP_DIR, '(admin)', 'agribusiness')).sort();
        const missing = [...REQUIRED_AGRI_SCREENS].sort().filter((f) => !reports.includes(f));
        expect(missing).toEqual([]);
    });

    it('keeps the shared admin shell, finance and auth routes', () => {
        const required = [
            ['(admin)', 'index.tsx'],
            ['(admin)', '_layout.tsx'],
            ['(admin)', 'accounting'],
            ['(admin)', 'settings'],
            ['(admin)', 'users'],
            ['(admin)', 'areas'],
            ['(admin)', 'cash-on-hand'],
            ['(admin)', 'bank-accounts'],
            ['(admin)', 'expenses'],
            ['(admin)', 'transfers'],
            ['(admin)', 'returns'],
            ['(expenses-encoder)', 'index.tsx'],
            ['login.tsx'],
            ['register.tsx'],
            ['select-branch.tsx'],
            ['loading.tsx'],
            ['sync-center.tsx'],
        ];
        const missing = required.filter((parts) => !exists(...parts));
        expect(missing.map((p) => p.join('/'))).toEqual([]);
    });
});
