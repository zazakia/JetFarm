import { Colors } from './colors';

// Agribusiness-only variant: the lending and branch-operations lanes are gone, so the role
// vocabulary shrank with them. Every Record below is exhaustive over UserRole, which means a
// role added here without all five maps fails tsc - and a ROLE_HOME_ROUTES entry pointing at a
// deleted route group loops the login redirect at app/(admin)/_layout.tsx:103-107.
// src/__tests__/agribusinessNavWhitelist.test.ts guards both failure modes.
export const ROLES = {
    admin: 'admin',
    expenses_encoder: 'expenses_encoder',
    main_office: 'main_office',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    expenses_encoder: 'Expenses Encoder',
    main_office: 'Main Office',
};

export const ROLE_COLORS: Record<UserRole, string> = {
    admin: Colors.roleAdmin,
    expenses_encoder: Colors.roleExpensesEncoder,
    main_office: Colors.navDark,
};

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
    admin: '/(admin)/agribusiness',
    expenses_encoder: '/(expenses-encoder)',
    main_office: '/(admin)/agribusiness',
};

export const ROLE_ICONS: Record<UserRole, string> = {
    admin: 'shield-checkmark',
    expenses_encoder: 'receipt',
    main_office: 'business',
};
