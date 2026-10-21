import { formatPHP } from './currency';
import { formatDateTime, formatDate } from './dates';

export interface OperatorInfo {
    id: string;
    name: string;
    role: string;
    email?: string;
    initials: string;
    isSystem: boolean;
}

export interface EntityInfo {
    entityName: string;
    module: string;
    title: string;
    subtitle?: string;
    icon: string;
    badgeColor: 'purple' | 'blue' | 'emerald' | 'amber' | 'teal' | 'rose' | 'indigo' | 'cyan' | 'sky' | 'red' | 'stone' | 'violet' | 'gray';
}

export interface FieldChange {
    key: string;
    label: string;
    oldValue: any;
    newValue: any;
    oldValueFormatted: string;
    newValueFormatted: string;
    isCurrency: boolean;
    isBoolean: boolean;
}

// Well-known users from seed data, tests, and standard admin accounts
const WELL_KNOWN_USERS: Record<string, { name: string; role: string; email?: string }> = {
    '00000000-0000-0000-0000-000000000002': { name: 'Cybergada Master', role: 'Admin', email: 'cybergada@gmail.com' },
    '00000000-0000-0000-0000-000000000001': { name: 'Super Admin', role: 'Admin', email: 'admin@poscursor.com' },
    '00000000-0000-0000-0000-000000000005': { name: 'Expenses Encoder', role: 'Expenses Encoder', email: 'expenses_encoder@poscursor.com' },
    'cybergada': { name: 'Cybergada Master', role: 'Admin', email: 'cybergada@gmail.com' },
    'admin': { name: 'Admin User', role: 'Admin', email: 'admin@poscursor.com' },
    'expenses_encoder': { name: 'Expenses Encoder', role: 'Expenses Encoder', email: 'expenses_encoder@poscursor.com' },
    'main_office': { name: 'Main Office', role: 'Main Office', email: 'mainoffice@poscursor.com' },
    'system': { name: 'System Automated Engine', role: 'System', email: 'system@poscursor.internal' },
};

function getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function capitalizeRole(role: string): string {
    if (!role) return 'User';
    return role.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Resolves raw user IDs or UUIDs into clean, human-readable operator profiles.
 */
export function resolveOperator(
    performedBy?: string | null,
    userProfilesMap?: Map<string, { id: string; fullName: string; role: string; email?: string }>
): OperatorInfo {
    const raw = (performedBy || '').trim();

    if (!raw || raw.toLowerCase() === 'system') {
        return {
            id: raw || 'system',
            name: raw.toLowerCase() === 'system' ? 'System Automated Engine' : 'System Process',
            role: 'System',
            email: 'system@poscursor.internal',
            initials: 'SY',
            isSystem: true
        };
    }

    // Check pre-registered well-known users
    if (WELL_KNOWN_USERS[raw]) {
        const u = WELL_KNOWN_USERS[raw];
        return {
            id: raw,
            name: u.name,
            role: u.role,
            email: u.email,
            initials: getInitials(u.name),
            isSystem: false
        };
    }

    // Check user profiles from database
    if (userProfilesMap && userProfilesMap.has(raw)) {
        const p = userProfilesMap.get(raw)!;
        const name = p.fullName || p.email || `User (${raw.substring(0, 8)})`;
        return {
            id: raw,
            name,
            role: capitalizeRole(p.role),
            email: p.email,
            initials: getInitials(name),
            isSystem: false
        };
    }

    // UUID fallback: show short ID formatted nicely
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    const displayName = isUuid ? `User (${raw.substring(0, 8)})` : capitalizeRole(raw);

    return {
        id: raw,
        name: displayName,
        role: 'User',
        initials: getInitials(displayName),
        isSystem: false
    };
}

interface TableMetadata {
    entityName: string;
    module: string;
    icon: string;
    badgeColor: EntityInfo['badgeColor'];
}

const TABLE_METADATA: Record<string, TableMetadata> = {
    // Agribusiness Operations
    agri_parcels: { entityName: 'Farm Parcel', module: 'Agribusiness Operations', icon: 'landscape', badgeColor: 'emerald' },
    agri_parcel_blocks: { entityName: 'Parcel Block', module: 'Agribusiness Operations', icon: 'grid-view', badgeColor: 'emerald' },
    agri_block_assignments: { entityName: 'Block Assignment', module: 'Agribusiness Operations', icon: 'assignment', badgeColor: 'teal' },
    agri_block_progress: { entityName: 'Block Progress', module: 'Agribusiness Operations', icon: 'timeline', badgeColor: 'teal' },
    agri_crop_cycles: { entityName: 'Crop Cycle', module: 'Agribusiness Operations', icon: 'agriculture', badgeColor: 'teal' },
    agri_harvest_logs: { entityName: 'Harvest Log', module: 'Agribusiness Operations', icon: 'grain', badgeColor: 'amber' },
    agri_weekly_settlements: { entityName: 'Harvest Settlement', module: 'Agribusiness Operations', icon: 'event-note', badgeColor: 'emerald' },
    agri_growth_checkins: { entityName: 'Growth Check-in', module: 'Agribusiness Operations', icon: 'ecg-heart', badgeColor: 'sky' },
    agri_land_owners: { entityName: 'Land Owner', module: 'Agribusiness Operations', icon: 'terrain', badgeColor: 'stone' },
    agri_investors: { entityName: 'Capital Partner', module: 'Agribusiness Operations', icon: 'groups', badgeColor: 'indigo' },
    agri_investor_ledgers: { entityName: 'Partner Ledger', module: 'Agribusiness Operations', icon: 'manage-accounts', badgeColor: 'indigo' },
    agri_farm_workers: { entityName: 'Farm Worker', module: 'Agribusiness Operations', icon: 'person', badgeColor: 'cyan' },
    agri_labor_logs: { entityName: 'Field Labor Log', module: 'Agribusiness Operations', icon: 'engineering', badgeColor: 'cyan' },
    agri_farm_expenses: { entityName: 'Farm Expense', module: 'Agribusiness Operations', icon: 'money-off', badgeColor: 'red' },
    stock_movements: { entityName: 'Stock Movement', module: 'Farm Inputs & Supplies', icon: 'inventory', badgeColor: 'teal' },

    // Accounting & Finance
    journal_entries: { entityName: 'Journal Entry', module: 'Accounting & Finance', icon: 'menu-book', badgeColor: 'violet' },
    journal_entry_lines: { entityName: 'Journal Entry Line', module: 'Accounting & Finance', icon: 'format-list-numbered', badgeColor: 'violet' },
    accounts_payable_vouchers: { entityName: 'AP Voucher', module: 'Accounting & Finance', icon: 'receipt', badgeColor: 'blue' },
    expenses: { entityName: 'Expense', module: 'Accounting & Finance', icon: 'money-off', badgeColor: 'red' },
    expense_categories: { entityName: 'Expense Category', module: 'Accounting & Finance', icon: 'label', badgeColor: 'red' },
    cash_transactions: { entityName: 'Cash Position', module: 'Accounting & Finance', icon: 'account-balance-wallet', badgeColor: 'cyan' },
    bank_accounts: { entityName: 'Bank Account', module: 'Accounting & Finance', icon: 'account-balance', badgeColor: 'blue' },
    bank_transactions: { entityName: 'Bank Transaction', module: 'Accounting & Finance', icon: 'swap-horiz', badgeColor: 'blue' },
    chart_of_accounts: { entityName: 'Chart of Accounts', module: 'Accounting & Finance', icon: 'account-tree', badgeColor: 'violet' },
    financial_snapshots: { entityName: 'Financial Snapshot', module: 'Accounting & Finance', icon: 'photo-library', badgeColor: 'violet' },
    financial_period_settings: { entityName: 'Financial Period', module: 'Accounting & Finance', icon: 'date-range', badgeColor: 'violet' },
    statutory_rates: { entityName: 'Statutory Rate', module: 'Accounting & Finance', icon: 'percent', badgeColor: 'violet' },
    statutory_fund_allocations: { entityName: 'Statutory Fund Allocation', module: 'Accounting & Finance', icon: 'savings', badgeColor: 'violet' },
    suppliers: { entityName: 'Supplier', module: 'Accounting & Finance', icon: 'local-shipping', badgeColor: 'blue' },

    // Structure & Reference Data
    branches: { entityName: 'Branch', module: 'Structure & Reference', icon: 'account-balance', badgeColor: 'stone' },
    warehouses: { entityName: 'Warehouse', module: 'Structure & Reference', icon: 'warehouse', badgeColor: 'stone' },
    business_units: { entityName: 'Business Unit', module: 'Structure & Reference', icon: 'business', badgeColor: 'stone' },
    areas: { entityName: 'Area / Zone', module: 'Structure & Reference', icon: 'map', badgeColor: 'stone' },

    // System & Settings
    feature_flags: { entityName: 'Feature Flag', module: 'System & Config', icon: 'toggle-on', badgeColor: 'purple' },
    user_profiles: { entityName: 'User Account', module: 'System & Config', icon: 'admin-panel-settings', badgeColor: 'indigo' },
    user_branch_roles: { entityName: 'User Branch Role', module: 'System & Config', icon: 'admin-panel-settings', badgeColor: 'indigo' },
    role_permissions: { entityName: 'Role Permission', module: 'System & Config', icon: 'lock', badgeColor: 'purple' },
    app_settings: { entityName: 'System Setting', module: 'System & Config', icon: 'settings', badgeColor: 'gray' },
    action_logs: { entityName: 'Audit Log Entry', module: 'System & Config', icon: 'history', badgeColor: 'gray' },
};

function parsePayload(data: any): any {
    if (!data) return null;
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/**
 * Extracts human-readable entity details, titles, and categorization from raw DB table and record data.
 */
export function formatEntityInfo(
    entityType: string,
    entityId: string,
    oldDataRaw?: any,
    newDataRaw?: any
): EntityInfo {
    const normTable = (entityType || '').toLowerCase().trim();
    const meta = TABLE_METADATA[normTable] || {
        entityName: capitalizeRole(normTable),
        module: 'General Operations',
        icon: 'dataset',
        badgeColor: 'gray' as const,
    };

    const oldObj = parsePayload(oldDataRaw);
    const newObj = parsePayload(newDataRaw);
    const data = newObj || oldObj || {};

    let title = '';
    let subtitle = '';

    // Extract smart titles based on model
    if (normTable === 'feature_flags') {
        const rawTitle = data.name || data.flag_name || data.title;
        if (rawTitle) {
            title = String(rawTitle);
        } else {
            title = capitalizeRole(data.key || entityId.replace('feature-', '').replace(/[-_]/g, ' '));
        }
        subtitle = `Key: ${data.key || entityId}`;
    } else if (normTable === 'agri_parcels') {
        const code = data.code || data.parcel_code || entityId.substring(0, 8);
        title = data.name ? `${data.name} (${code})` : `Parcel ${code}`;
        if (data.area_hectares != null) subtitle = `Area: ${data.area_hectares} ha`;
        else if (data.location_address) subtitle = data.location_address;
    } else if (normTable === 'agri_crop_cycles') {
        const cycle = data.cycle_code || data.cycle_number || data.code || entityId.substring(0, 8);
        title = `Crop Cycle ${cycle}`;
        if (data.crop_type || data.crop) subtitle = `Crop: ${data.crop_type || data.crop}`;
    } else if (normTable === 'agri_weekly_settlements') {
        title = data.week_number != null ? `Weekly Settlement #${data.week_number}` : `Settlement (${entityId.substring(0, 8)})`;
        const due = data.net_payout_due_this_week != null ? data.net_payout_due_this_week : data.raw_kilo_earnings;
        if (due != null) subtitle = `Net payout: ${formatPHP(due)}`;
    } else if (normTable === 'agri_harvest_logs') {
        title = data.batch_number ? `Harvest ${data.batch_number}` : `Harvest Log (${entityId.substring(0, 8)})`;
        if (data.net_weight_kg != null) subtitle = `Net weight: ${data.net_weight_kg} kg`;
    } else if (normTable === 'agri_farm_expenses') {
        title = data.description || data.category || 'Farm Expense';
        if (data.amount != null) subtitle = `Amount: ${formatPHP(data.amount)}`;
    } else if (normTable === 'agri_labor_logs') {
        title = data.task ? `Field task: ${data.task}` : `Labor Log (${entityId.substring(0, 8)})`;
        if (data.total_pay != null) subtitle = `Total pay: ${formatPHP(data.total_pay)}`;
    } else if (normTable === 'agri_investors') {
        title = data.company_name || data.contact_person || `Capital Partner (${entityId.substring(0, 8)})`;
        if (data.contact_number) subtitle = `Contact: ${data.contact_number}`;
    } else if (normTable === 'agri_investor_ledgers') {
        title = data.type ? `Partner ledger: ${capitalizeRole(data.type)}` : `Partner Ledger (${entityId.substring(0, 8)})`;
        if (data.amount != null) subtitle = `Amount: ${formatPHP(data.amount)}`;
    } else if (normTable === 'agri_land_owners') {
        title = data.name || data.full_name || `Land Owner (${entityId.substring(0, 8)})`;
        if (data.contact_number || data.phone) subtitle = `Contact: ${data.contact_number || data.phone}`;
    } else if (normTable === 'agri_farm_workers') {
        title = data.name || `Farm Worker (${entityId.substring(0, 8)})`;
        if (data.specialization) subtitle = `Specialization: ${data.specialization}`;
    } else if (normTable === 'journal_entries') {
        title = data.description || data.reference_number || `Journal Entry (${entityId.substring(0, 8)})`;
        if (data.reference_number) subtitle = `Ref #${data.reference_number}`;
    } else if (normTable === 'stock_movements') {
        const prod = data.product_name || data.productName || 'Farm Input';
        const qty = data.quantity != null ? `${data.quantity > 0 ? '+' : ''}${data.quantity}` : '';
        title = `${prod} (${qty})`;
        subtitle = `Movement: ${capitalizeRole(data.movement_type || 'Stock Change')}`;
    } else if (normTable === 'expenses') {
        title = data.description || data.category || 'Expense';
        if (data.amount != null) subtitle = `Amount: ${formatPHP(data.amount)}`;
    } else if (normTable === 'user_profiles') {
        title = data.full_name || data.fullName || data.email || entityId;
        subtitle = `Role: ${capitalizeRole(data.role || 'User')}`;
    } else if (normTable === 'suppliers') {
        title = data.name || data.supplier_name || `Supplier (${entityId.substring(0, 8)})`;
        if (data.phone) subtitle = `Contact: ${data.phone}`;
    } else {
        title = data.name || data.title || data.full_name || data.description || data.code || `${meta.entityName} (${entityId.substring(0, 8)})`;
    }

    return {
        entityName: meta.entityName,
        module: meta.module,
        title,
        subtitle,
        icon: meta.icon,
        badgeColor: meta.badgeColor,
    };
}

/**
 * Generates a human-understandable sentence explaining the action.
 */
export function generateActionNarrative(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
    entityType: string,
    entityId: string,
    oldDataRaw?: any,
    newDataRaw?: any
): string {
    const info = formatEntityInfo(entityType, entityId, oldDataRaw, newDataRaw);
    const oldObj = parsePayload(oldDataRaw);
    const newObj = parsePayload(newDataRaw);

    switch (action) {
        case 'CREATE':
            return `Created ${info.entityName} "${info.title}"`;
        case 'DELETE':
            return `Deleted ${info.entityName} "${info.title}"`;
        case 'RESTORE':
            return `Restored ${info.entityName} "${info.title}"`;
        case 'UPDATE': {
            if (oldObj && newObj) {
                const changes = formatFieldChanges(oldObj, newObj);
                if (changes.length === 1) {
                    const c = changes[0];
                    return `Updated ${info.entityName} "${info.title}": changed ${c.label} from ${c.oldValueFormatted} to ${c.newValueFormatted}`;
                } else if (changes.length > 1) {
                    const fields = changes.slice(0, 3).map(c => c.label).join(', ');
                    const more = changes.length > 3 ? ` and ${changes.length - 3} other fields` : '';
                    return `Updated ${info.entityName} "${info.title}": modified ${fields}${more}`;
                }
            }
            return `Updated ${info.entityName} "${info.title}"`;
        }
        default:
            return `Performed ${action} on ${info.entityName}`;
    }
}

const EXCLUDED_DIFF_FIELDS = new Set([
    'id', '_status', '_changed', 'sync_status', 'created_at', 'updated_at', 
    'deleted_at', 'createdAt', 'updatedAt', 'deletedAt'
]);

const CURRENCY_FIELDS = new Set([
    'amount', 'total_amount', 'totalAmount', 'gross_amount', 'grossAmount',
    'net_amount', 'netAmount', 'balance', 'price', 'cost', 'fee',
    'daily_wage', 'dailyWage', 'investment_amount', 'investmentAmount',
    'principal_amount', 'principalAmount'
]);

const DATE_FIELDS = new Set([
    'date', 'settlement_date', 'settlementDate', 'start_date', 'startDate',
    'end_date', 'endDate', 'planting_date', 'plantingDate', 'harvest_date',
    'harvestDate', 'due_date', 'dueDate', 'timestamp'
]);

/**
 * Transforms raw object state differences into cleanly formatted, human-readable field comparisons.
 */
export function formatFieldChanges(oldObj: any, newObj: any): FieldChange[] {
    if (!oldObj && !newObj) return [];

    const keys = Array.from(new Set([
        ...Object.keys(oldObj || {}),
        ...Object.keys(newObj || {})
    ])).filter(k => !EXCLUDED_DIFF_FIELDS.has(k));

    const changes: FieldChange[] = [];

    for (const key of keys) {
        const oldVal = oldObj ? oldObj[key] : undefined;
        const newVal = newObj ? newObj[key] : undefined;

        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            const isCurrency = CURRENCY_FIELDS.has(key) && (typeof oldVal === 'number' || typeof newVal === 'number' || (!isNaN(Number(oldVal)) && oldVal !== ''));
            const isBoolean = typeof oldVal === 'boolean' || typeof newVal === 'boolean';
            const isDate = DATE_FIELDS.has(key) && (oldVal || newVal);

            const formatValue = (val: any): string => {
                if (val === undefined || val === null || val === '') return 'None';
                if (isBoolean) return val ? 'Yes / Enabled' : 'No / Disabled';
                if (isCurrency) return formatPHP(Number(val));
                if (isDate) return formatDate(val);
                if (typeof val === 'object') return JSON.stringify(val);
                return String(val);
            };

            const label = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/^\w/, c => c.toUpperCase());

            changes.push({
                key,
                label,
                oldValue: oldVal,
                newValue: newVal,
                oldValueFormatted: formatValue(oldVal),
                newValueFormatted: formatValue(newVal),
                isCurrency,
                isBoolean,
            });
        }
    }

    return changes;
}

/**
 * Builds CSV string of audit logs for auditor export and record keeping.
 */
export function buildAuditExportData(
    logs: any[],
    userProfilesMap?: Map<string, any>
): string {
    const headers = [
        'Timestamp',
        'Date & Time',
        'Action',
        'Module',
        'Entity Type',
        'Entity Title',
        'Entity ID',
        'Performed By',
        'Role',
        'Summary'
    ];

    const escapeCsv = (str: string | null | undefined): string => {
        if (!str) return '""';
        const cleaned = String(str).replace(/"/g, '""');
        return `"${cleaned}"`;
    };

    const rows = logs.map(log => {
        const operator = resolveOperator(log.performedBy, userProfilesMap);
        const entity = formatEntityInfo(log.entityType, log.entityId, log.oldData, log.newData);
        const narrative = generateActionNarrative(log.action, log.entityType, log.entityId, log.oldData, log.newData);
        const dt = formatDateTime(log.timestamp);

        return [
            log.timestamp,
            escapeCsv(dt),
            log.action,
            escapeCsv(entity.module),
            escapeCsv(entity.entityName),
            escapeCsv(entity.title),
            escapeCsv(log.entityId),
            escapeCsv(operator.name),
            escapeCsv(operator.role),
            escapeCsv(narrative),
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}
