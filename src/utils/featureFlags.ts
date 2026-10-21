import { FeatureFlagKey } from '../constants/configDefaults';

export interface RouteFeatureMapping {
    prefix: string;
    featureKey: FeatureFlagKey;
    label: string;
}

// Agribusiness-only variant: the lending master switch (system.lending) and its dependent keys
// died with the loan screens, so there is no cross-key implication left to enforce. What remains
// is the list of flags this build actually ships - useFeatureFlags treats a key outside it as
// disabled, which stops a stale feature_flags row from a pre-teardown database from reviving
// navigation that has no route behind it.
export const AGRIBUSINESS_FEATURE_KEYS: FeatureFlagKey[] = [
    'module.expenses',
    'module.reports',
    'module.cash_on_hand',
    'module.bank_accounts',
    'module.accounting',
];

export function isAgribusinessFeatureKey(key?: string): boolean {
    if (!key) return false;
    return AGRIBUSINESS_FEATURE_KEYS.includes(key as FeatureFlagKey);
}

// Only prefixes whose route group still exists. A prefix that names a deleted screen would gate a
// route nobody can reach, and src/__tests__/agribusinessNavWhitelist.test.ts asserts each of these
// resolves to a file under app/.
export const ROUTE_FEATURE_MAPPINGS: RouteFeatureMapping[] = [
    { prefix: '/accounting', featureKey: 'module.accounting', label: 'Accounting & General Ledger' },
    { prefix: '/reports', featureKey: 'module.reports', label: 'Financial Statements' },
    { prefix: '/expenses', featureKey: 'module.expenses', label: 'Operating Expenses' },
    { prefix: '/cash-on-hand', featureKey: 'module.cash_on_hand', label: 'Cash on Hand' },
    { prefix: '/bank-accounts', featureKey: 'module.bank_accounts', label: 'Bank Accounts' },
];

/**
 * Resolves the feature flag key required for a specific route path.
 * Returns null if the route has no gating feature flag (e.g. root dashboard, settings, users).
 */
export function getFeatureKeyForRoute(pathname: string): RouteFeatureMapping | null {
    if (!pathname) return null;

    const normalized = pathname
        .replace(/^\/\(admin\)/, '')
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
