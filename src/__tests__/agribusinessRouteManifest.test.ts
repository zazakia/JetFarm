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

const FORBIDDEN_ADMIN_FILES = [
    'remittances.tsx',
    // the cooperative business-rules editor (savings interest, net-surplus split, ISC/patronage);
    // its agri-relevant half now lives at settings/statutory-allocations.tsx
    'settings/coop-computations.tsx',
];

const FORBIDDEN_ROOT_FILES = ['loan-application.tsx', 'loan-calculator.tsx'];

// Services that posted cooperative lending data and were physically deleted with the lending
// teardown. The coop-historical seed (`FinancialDataSeedService`) wrote audited FY2024/FY2025
// loans-receivable, share-capital and patronage journal lines into the Agri-One ledger, so the
// report screen that exposed it (`period-settings.tsx`) had its seed handler stripped. Absence here
// is the durable assertion; a reintroduced file fails by name. (`CooperativeFundService` survives:
// it was repurposed to the statutory-reserve appropriations that back the kept `statutory-reserves`
// report and the `fund.*_allocation` settings the Agri-One editor writes.)
const FORBIDDEN_SRC_FILES = [
    'services/FinancialDataSeedService.ts',
    'services/ShareCapitalService.ts',
    'services/DividendService.ts',
    'services/MembershipService.ts',
    'services/CooperativeSavingsService.ts',
];

// The 10 general-ledger financial statements survive. `audit.tsx` (credit/ops audit),
// `dashboard.tsx` (MfiKpi lending dashboard), `bank-export.tsx`, `monthly-sales.tsx` and
// `financial-summary.tsx` were on the original keep list but read loans, payments, remittances and
// collector balances, so they go with the lending services behind them.
const KEPT_REPORTS = [
    'annual-report.tsx',
    'balance-sheet.tsx',
    'cash-flows.tsx',
    'changes-in-equity.tsx',
    'expenses.tsx',
    'income-statement.tsx',
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

    it('has no deleted cooperative lending services', () => {
        const srcDir = path.join(process.cwd(), 'src');
        const present = FORBIDDEN_SRC_FILES.filter((file) => fs.existsSync(path.join(srcDir, file)));
        expect(present).toEqual([]);
    });

    it('keeps only the 10 general-ledger financial statements', () => {
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
            ['(expenses-encoder)', 'index.tsx'],
            ['login.tsx'],
            ['select-branch.tsx'],
            ['loading.tsx'],
            ['sync-center.tsx'],
        ];
        const missing = required.filter((parts) => !exists(...parts));
        expect(missing.map((p) => p.join('/'))).toEqual([]);
    });

    it('offers no borrower-facing sign-up route', () => {
        // Self-registration created an inactive `borrower` profile and an approval queue that only
        // the lending coop used; agribusiness accounts are provisioned under (admin)/users.
        expect(exists('register.tsx')).toBe(false);
        expect(exists('(admin)', 'returns.tsx')).toBe(false);
        expect(exists('(admin)', 'returns', 'index.tsx')).toBe(false);
    });
});
