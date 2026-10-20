import { FeatureFlagKey } from '../constants/configDefaults';

export interface RouteFeatureMapping {
    prefix: string;
    featureKey: FeatureFlagKey;
    label: string;
}

export const LENDING_FEATURE_KEYS: FeatureFlagKey[] = [
    'system.lending',
    'module.borrowers',
    'module.loans',
    'module.payments',
    'module.remittances',
    'module.file_cases',
    'module.cic',
];

export function isLendingFeatureKey(key?: string): boolean {
    if (!key) return false;
    return LENDING_FEATURE_KEYS.includes(key as FeatureFlagKey);
}

export const ROUTE_FEATURE_MAPPINGS: RouteFeatureMapping[] = [
    { prefix: '/accounting', featureKey: 'module.accounting', label: 'Accounting & General Ledger' },

    // Specific Lending Reports & Tools (placed before generic /reports)
    { prefix: '/reports/active-loans', featureKey: 'system.lending', label: 'Active Loans Collection' },
    { prefix: '/reports/daily-collection', featureKey: 'system.lending', label: 'Daily Collection Sheet' },
    { prefix: '/reports/weekly-collection', featureKey: 'system.lending', label: 'Weekly Collection Sheet' },
    { prefix: '/reports/collection-logs', featureKey: 'system.lending', label: 'Collection Logs' },
    { prefix: '/reports/collection', featureKey: 'system.lending', label: 'Collection Report' },
    { prefix: '/reports/collector-efficiency', featureKey: 'system.lending', label: 'Collector Efficiency' },
    { prefix: '/reports/collector-collection-analysis', featureKey: 'system.lending', label: 'Collector Collection Analysis' },
    { prefix: '/reports/portfolio-aging', featureKey: 'system.lending', label: 'Portfolio Aging' },
    { prefix: '/reports/aging', featureKey: 'system.lending', label: 'Aging Report' },
    { prefix: '/reports/par', featureKey: 'system.lending', label: 'PAR Report' },
    { prefix: '/reports/past-due', featureKey: 'system.lending', label: 'Past Due Report' },
    { prefix: '/reports/delinquent-accounts', featureKey: 'system.lending', label: 'Delinquent Accounts' },
    { prefix: '/reports/disbursements', featureKey: 'system.lending', label: 'Disbursement History' },
    { prefix: '/reports/renewals', featureKey: 'system.lending', label: 'Borrower Retention' },
    { prefix: '/reports/excess-cash-receipt', featureKey: 'system.lending', label: 'Excess Cash Receipt' },
    { prefix: '/reports/creditors-group-life', featureKey: 'system.lending', label: 'Creditors Group Life' },
    { prefix: '/reports/mfi-kpis', featureKey: 'system.lending', label: 'MFI Metrics' },
    { prefix: '/reports/soa-masterlist', featureKey: 'system.lending', label: 'SOA Masterlist' },
    { prefix: '/reports/cbu', featureKey: 'system.lending', label: 'CBU Report' },

    // Lending Settings & Calculations (placed before generic /settings)
    { prefix: '/settings/loan-products', featureKey: 'system.lending', label: 'Loan Products' },
    { prefix: '/settings/collection-groups', featureKey: 'system.lending', label: 'Collection Groups' },
    { prefix: '/settings/coop-computations', featureKey: 'system.lending', label: 'Cooperative Computations' },

    // Core Lending Modules & Screens
    { prefix: '/collectors', featureKey: 'system.lending', label: 'Field Collectors' },
    { prefix: '/loan-approvals', featureKey: 'system.lending', label: 'Loan Approvals' },
    { prefix: '/loan-application', featureKey: 'system.lending', label: 'Loan Application' },
    { prefix: '/loan-calculator', featureKey: 'system.lending', label: 'Loan Calculator' },
    { prefix: '/borrowers', featureKey: 'module.borrowers', label: 'Borrowers / Members' },
    { prefix: '/loans', featureKey: 'module.loans', label: 'Loans' },
    { prefix: '/payments', featureKey: 'module.payments', label: 'Payments' },
    { prefix: '/remittances', featureKey: 'module.remittances', label: 'Remittances' },
    { prefix: '/file-cases', featureKey: 'module.file_cases', label: 'File Cases' },
    { prefix: '/cic', featureKey: 'module.cic', label: 'CIC Reporting' },

    // Other System Modules
    { prefix: '/expenses', featureKey: 'module.expenses', label: 'Expenses' },
    { prefix: '/payroll', featureKey: 'module.payroll', label: 'Payroll' },
    { prefix: '/reports', featureKey: 'module.reports', label: 'Reports' },
    { prefix: '/cash-on-hand', featureKey: 'module.cash_on_hand', label: 'Cash on Hand' },
    { prefix: '/bank-accounts', featureKey: 'module.bank_accounts', label: 'Bank Accounts' },
    { prefix: '/settings/employees', featureKey: 'module.employees', label: 'Employees' },
];

/**
 * Resolves the feature flag key required for a specific route path.
 * Returns null if the route has no gating feature flag (e.g. root dashboard, settings, users).
 */
export function getFeatureKeyForRoute(pathname: string): RouteFeatureMapping | null {
    if (!pathname) return null;

    const normalized = pathname
        .replace(/^\/\(admin\)/, '')
        .replace(/^\/\(borrower\)/, '')
        .replace(/^\/\(collector\)/, '')
        .replace(/^\/\(loan-encoder\)/, '')
        .replace(/^\/\(payment-encoder\)/, '')
        .replace(/^\/\(expenses-encoder\)/, '')
        .replace(/\/$/, '') || '/';

    // Exact or prefix matches
    for (const mapping of ROUTE_FEATURE_MAPPINGS) {
        if (normalized === mapping.prefix || normalized.startsWith(mapping.prefix + '/')) {
            return mapping;
        }
    }

    return null;
}
