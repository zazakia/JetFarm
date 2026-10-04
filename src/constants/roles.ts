import { Colors } from './colors';

export const ROLES = {
    admin: 'admin',
    collector: 'collector',
    loan_encoder: 'loan_encoder',
    payment_encoder: 'payment_encoder',
    expenses_encoder: 'expenses_encoder',
    borrower: 'borrower',
    main_office: 'main_office',
    branch_cashier: 'branch_cashier',
    branch_manager: 'branch_manager',
    area_supervisor: 'area_supervisor',
    commissary_keeper: 'commissary_keeper',
    executive: 'executive',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    collector: 'Collector',
    loan_encoder: 'Loan Encoder',
    payment_encoder: 'Payment Encoder',
    expenses_encoder: 'Expenses Encoder',
    borrower: 'Borrower',
    main_office: 'Main Office',
    branch_cashier: 'Branch Cashier',
    branch_manager: 'Branch Manager',
    area_supervisor: 'Area Supervisor',
    commissary_keeper: 'Commissary Keeper',
    executive: 'Executive',
};

export const ROLE_COLORS: Record<UserRole, string> = {
    admin: Colors.roleAdmin,
    collector: Colors.roleCollector,
    loan_encoder: Colors.roleLoanEncoder,
    payment_encoder: Colors.rolePaymentEncoder,
    expenses_encoder: Colors.roleExpensesEncoder,
    borrower: Colors.roleBorrower,
    main_office: Colors.navDark,
    branch_cashier: Colors.roleBranchCashier,
    branch_manager: Colors.roleBranchManager,
    area_supervisor: Colors.roleAreaSupervisor,
    commissary_keeper: Colors.roleCommissaryKeeper,
    executive: Colors.roleExecutive,
};

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
    admin: '/(admin)/agribusiness',
    collector: '/(collector)',
    loan_encoder: '/(loan-encoder)',
    payment_encoder: '/(payment-encoder)',
    expenses_encoder: '/(expenses-encoder)',
    borrower: '/(borrower)',
    main_office: '/(admin)/agribusiness',
    branch_cashier: '/(cashier)',
    branch_manager: '/(branch-manager)',
    area_supervisor: '/(area-supervisor)',
    commissary_keeper: '/(commissary)',
    executive: '/(executive)',
};

export const ROLE_ICONS: Record<UserRole, string> = {
    admin: 'shield-checkmark',
    collector: 'people',
    loan_encoder: 'document-text',
    payment_encoder: 'cash',
    expenses_encoder: 'receipt',
    borrower: 'person-outline',
    main_office: 'business',
    branch_cashier: 'calculator',
    branch_manager: 'storefront',
    area_supervisor: 'map',
    commissary_keeper: 'cube',
    executive: 'stats-chart',
};
