import { CoACreateInput } from '../../services/ChartOfAccountsService';

export interface ModuleTableColumn {
    name: string;
    type: 'string' | 'number' | 'boolean';
    isOptional?: boolean;
    isIndexed?: boolean;
}

export interface ModuleTableDef {
    name: string;
    columns: ModuleTableColumn[];
}

export interface ModuleRoute {
    path: string;
    label: string;
    icon: string;
    permissionKey: string;
}

export interface ModuleRole {
    role: string;
    label: string;
    permissions: string[];
}

export interface CoopModule {
    id: string; // e.g., 'water-station'
    name: string;
    icon: string;
    description: string;
    version: string;
    featureKey: string; // Feature flag key in database/config
    coaSegmentCode: string; // e.g., 'WS'
    defaultCoA: CoACreateInput[]; // Default chart of accounts entries
    dbTables: ModuleTableDef[]; // Tables introduced by this module
    routes: ModuleRoute[]; // Sub-menus and routing paths
    roles: ModuleRole[]; // Role overrides/custom roles for the module
}
