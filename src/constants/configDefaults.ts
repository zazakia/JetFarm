import { ROLES, UserRole } from './roles';

// Agribusiness-only variant: the flag vocabulary is the finance layer this build ships. The
// lending master switch (system.lending) and every module.* key behind a deleted screen are gone,
// because a flag whose route no longer exists is a row an operator can toggle with no effect - and
// useFeatureFlags now treats an unlisted key as disabled rather than enabled.
export type FeatureFlagKey =
    | 'module.expenses'
    | 'module.reports'
    | 'module.cash_on_hand'
    | 'module.bank_accounts'
    | 'module.accounting';

export interface DefaultFeatureFlag {
    id: string;
    key: FeatureFlagKey;
    label: string;
    description: string;
    category: string;
    enabled: boolean;
    sortOrder: number;
}

export interface DefaultRolePermission {
    id: string;
    role: UserRole;
    permissionKey: string;
    label: string;
    category: string;
    enabled: boolean;
}

const feature = (
    key: FeatureFlagKey,
    label: string,
    description: string,
    sortOrder: number,
    enabled = true,
    category = 'Modules',
    ): DefaultFeatureFlag => ({
    id: `feature-${key.replace(/\./g, '-')}`,
    key,
    label,
    description,
    category,
    enabled,
    sortOrder,
});

export const DEFAULT_FEATURE_FLAGS: DefaultFeatureFlag[] = [
    // Five flags, five surviving route groups. Settings > Feature Flags can still turn one off to
    // hide that section, but there is no lending switch left to re-enable.
    feature('module.expenses', 'Expenses', 'Expense encoding and reports.', 40),
    feature('module.reports', 'Reports', 'Financial statements and period reporting.', 70),
    feature('module.cash_on_hand', 'Cash on Hand', 'Cash vault and on-hand reporting.', 80),
    feature('module.bank_accounts', 'Bank Accounts', 'Bank account and transaction modules.', 90),
    feature('module.accounting', 'Accounting', 'General Ledger, Journal Entries, and Chart of Accounts.', 150),
];

export const CONFIGURABLE_PERMISSION_KEYS = [
    { key: 'route.(admin)', label: 'Admin dashboard', category: 'Route groups' },
    { key: 'route.(expenses-encoder)', label: 'Expenses encoder', category: 'Route groups' },
    { key: 'action.edit', label: 'Edit Data (Expenses, Parcels, Settlements, Journal Entries)', category: 'Data Actions' },
    { key: 'action.delete', label: 'Delete Data (Expenses, Parcels, Settlements, Journal Entries)', category: 'Data Actions' },
    ...DEFAULT_FEATURE_FLAGS.map(flag => ({
        key: flag.key,
        label: flag.label,
        category: flag.category,
    })),
] as const;

const enabledByDefault = (role: UserRole, permissionKey: string): boolean => {
    if (role === ROLES.admin || role === ROLES.main_office) return true;
    if (permissionKey === 'action.edit') {
        return role === ROLES.expenses_encoder;
    }
    if (permissionKey === 'action.delete') {
        return false;
    }
    if (role === ROLES.expenses_encoder) return permissionKey === 'route.(expenses-encoder)' || permissionKey === 'module.expenses';
    return false;
};

export const DEFAULT_ROLE_PERMISSIONS: DefaultRolePermission[] = (Object.values(ROLES) as UserRole[])
    .flatMap(role => CONFIGURABLE_PERMISSION_KEYS.map(permission => ({
        id: `role-permission-${role}-${permission.key.replace(/[().]/g, '-').replace(/-+/g, '-')}`,
        role,
        permissionKey: permission.key,
        label: permission.label,
        category: permission.category,
        enabled: enabledByDefault(role, permission.key),
    })));

export interface DefaultCoopSetting {
    id: string;
    key: string;
    value: string;
    valueType: 'number' | 'string' | 'boolean';
    scope: string;
    isActive: boolean;
}

export const DEFAULT_COOP_SETTINGS: DefaultCoopSetting[] = [
    {
        id: 'setting-savings-interest-rate',
        key: 'savings.interest_rate',
        value: '0.06',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-savings-min-balance',
        key: 'savings.min_maintaining_balance',
        value: '100',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-fund-net-surplus-allocation',
        key: 'fund.net_surplus_allocation',
        value: '0.70',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-fund-reserve-allocation',
        key: 'fund.reserve_fund_allocation',
        value: '0.10',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-fund-education-allocation',
        key: 'fund.education_fund_allocation',
        value: '0.10',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-fund-community-allocation',
        key: 'fund.community_development_fund_allocation',
        value: '0.03',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-fund-optional-allocation',
        key: 'fund.optional_fund_allocation',
        value: '0.07',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-fund-isc-distribution',
        key: 'fund.isc_distribution',
        value: '0.70',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-fund-pr-distribution',
        key: 'fund.pr_distribution',
        value: '0.30',
        valueType: 'number',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-brand-company-name',
        key: 'brand.company_name',
        value: 'Agri-One',
        valueType: 'string',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-brand-company-name-full',
        key: 'brand.company_name_full',
        value: 'Agri-One',
        valueType: 'string',
        scope: 'global',
        isActive: true,
    },
    {
        id: 'setting-brand-logo-base64',
        key: 'brand.logo_base64',
        value: '',
        valueType: 'string',
        scope: 'global',
        isActive: true,
    },
];
