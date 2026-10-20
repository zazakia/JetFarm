import { ROLES, UserRole } from './roles';

export type FeatureFlagKey =
    | 'system.lending'
    | 'module.borrowers'
    | 'module.loans'
    | 'module.payments'
    | 'module.expenses'
    | 'module.remittances'
    | 'module.file_cases'
    | 'module.reports'
    | 'module.cash_on_hand'
    | 'module.bank_accounts'
    | 'module.savings'
    | 'module.payroll'
    | 'module.employees'
    | 'module.business_modules'
    | 'module.marketplace'
    | 'module.cic'
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
    // Shipped dark: all loan-management surfaces (Borrowers, Loans, Payments, Remittances,
    // Collectors, File Cases, CIC, lending reports & loan-products settings) are hidden by
    // default via this master switch — routes render FeatureDisabledNotice and dependent
    // lending flags are forced off (see useFeatureFlags.isEnabled). Re-enable in
    // Settings > Feature Flags. NOTE: ensureFeatureFlags() only seeds rows that do not
    // exist yet, so databases seeded before this change keep lending enabled until the
    // flag is turned off there.
    feature('system.lending', 'Lending & Credit System', 'Master switch for all lending features (Loans, Calculator, Applications, Approvals, Borrowers, Field Collections, CIC, and Lending Reports).', 1, false, 'Core Systems'),
    feature('module.borrowers', 'Borrowers', 'Borrower management and profiles.', 10),
    feature('module.loans', 'Loans', 'Loan creation, approval, and account management.', 20),
    feature('module.payments', 'Payments', 'Payment encoding and receipts.', 30),
    feature('module.expenses', 'Expenses', 'Expense encoding and reports.', 40),
    feature('module.remittances', 'Remittances', 'Collector remittance review.', 50),
    feature('module.file_cases', 'File Cases', 'Legal/file case tracking for delinquent loans.', 60, false),
    feature('module.reports', 'Reports', 'Operational and financial reports.', 70),
    feature('module.cash_on_hand', 'Cash on Hand', 'Cash vault and on-hand reporting.', 80),
    feature('module.bank_accounts', 'Bank Accounts', 'Bank account and transaction modules.', 90),
    feature('module.savings', 'Savings', 'Borrower savings portfolio and passbook functions.', 100),
    feature('module.payroll', 'Payroll', 'Monthly staff payroll runs and payout history.', 110, false),
    feature('module.employees', 'Employees', 'Staff registry and base salary management.', 120, false),
    feature('module.business_modules', 'Business Modules', 'Cooperative business modules hub (e.g. Water Station).', 130, true),
    feature('module.marketplace', 'Marketplace', 'Cooperative member marketplace & seller center.', 135, true),
    feature('module.cic', 'CIC Reporting', 'Credit Information Corporation (CIC) compliance reporting.', 140),
    feature('module.accounting', 'Accounting', 'General Ledger, Journal Entries, and Chart of Accounts.', 150),
];

export const CONFIGURABLE_PERMISSION_KEYS = [
    { key: 'route.(admin)', label: 'Admin dashboard', category: 'Route groups' },
    { key: 'route.(collector)', label: 'Collector dashboard', category: 'Route groups' },
    { key: 'route.(loan-encoder)', label: 'Loan encoder', category: 'Route groups' },
    { key: 'route.(payment-encoder)', label: 'Payment encoder', category: 'Route groups' },
    { key: 'route.(expenses-encoder)', label: 'Expenses encoder', category: 'Route groups' },
    { key: 'route.(borrower)', label: 'Borrower portal', category: 'Route groups' },
    { key: 'action.edit', label: 'Edit Data (Borrowers, Loans, Savings, CBU, Payments, Expenses)', category: 'Data Actions' },
    { key: 'action.delete', label: 'Delete Data (Borrowers, Loans, Savings, CBU, Payments, Expenses)', category: 'Data Actions' },
    ...DEFAULT_FEATURE_FLAGS.map(flag => ({
        key: flag.key,
        label: flag.label,
        category: flag.category,
    })),
] as const;

const enabledByDefault = (role: UserRole, permissionKey: string): boolean => {
    if (
        permissionKey === 'module.file_cases' ||
        permissionKey === 'module.payroll' ||
        permissionKey === 'module.employees'
    ) {
        return false;
    }
    if (role === ROLES.admin || role === ROLES.main_office) return true;
    if (permissionKey === 'action.edit') {
        return role === ROLES.loan_encoder || role === ROLES.payment_encoder || role === ROLES.expenses_encoder;
    }
    if (permissionKey === 'action.delete') {
        return false;
    }
    if (role === ROLES.collector) return permissionKey === 'route.(collector)' || permissionKey === 'route.(payment-encoder)' || permissionKey === 'module.payments' || permissionKey === 'module.borrowers';
    if (role === ROLES.loan_encoder) return permissionKey === 'route.(loan-encoder)' || permissionKey === 'module.borrowers' || permissionKey === 'module.loans';
    if (role === ROLES.payment_encoder) return permissionKey === 'route.(payment-encoder)' || permissionKey === 'module.payments';
    if (role === ROLES.expenses_encoder) return permissionKey === 'route.(expenses-encoder)' || permissionKey === 'module.expenses';
    if (role === ROLES.borrower) return permissionKey === 'route.(borrower)' || permissionKey === 'module.marketplace';
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
