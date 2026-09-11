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
    '00000000-0000-0000-0000-000000000003': { name: 'Loan Encoder', role: 'Loan Encoder', email: 'encoder@poscursor.com' },
    '00000000-0000-0000-0000-000000000004': { name: 'Payment Encoder', role: 'Payment Encoder', email: 'payment_encoder@poscursor.com' },
    '00000000-0000-0000-0000-000000000005': { name: 'Expenses Encoder', role: 'Expenses Encoder', email: 'expenses_encoder@poscursor.com' },
    'cybergada': { name: 'Cybergada Master', role: 'Admin', email: 'cybergada@gmail.com' },
    'admin': { name: 'Admin User', role: 'Admin', email: 'admin@poscursor.com' },
    'master_collector': { name: 'Master Collector', role: 'Collector', email: 'collector@poscursor.com' },
    'loan_encoder': { name: 'Loan Encoder', role: 'Loan Encoder', email: 'encoder@poscursor.com' },
    'payment_encoder': { name: 'Payment Encoder', role: 'Payment Encoder', email: 'payment_encoder@poscursor.com' },
    'expenses_encoder': { name: 'Expenses Encoder', role: 'Expenses Encoder', email: 'expenses_encoder@poscursor.com' },
    'cresencio': { name: 'Cresencio Junco', role: 'Collector', email: 'cresencio.junco@poscursor.com' },
    'gerald': { name: 'Gerald Gera', role: 'Collector', email: 'gerald.gera@poscursor.com' },
    'bernie': { name: 'Bernie Casera', role: 'Collector', email: 'bernie.casera@poscursor.com' },
    'test_member': { name: 'Test Member', role: 'Borrower', email: 'member.test@poscursor.com' },
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
    // POS & Sales
    marketplace_products: { entityName: 'Product', module: 'Crispy King POS', icon: 'fastfood', badgeColor: 'amber' },
    products: { entityName: 'Product', module: 'Crispy King POS', icon: 'fastfood', badgeColor: 'amber' },
    marketplace_orders: { entityName: 'POS Sales Order', module: 'Crispy King POS', icon: 'point-of-sale', badgeColor: 'amber' },
    sales_orders: { entityName: 'POS Sales Order', module: 'Crispy King POS', icon: 'point-of-sale', badgeColor: 'amber' },
    sales_returns: { entityName: 'Sales Return', module: 'Crispy King POS', icon: 'assignment-return', badgeColor: 'rose' },
    cash_transactions: { entityName: 'Cash Register Till', module: 'Crispy King POS', icon: 'account-balance-wallet', badgeColor: 'cyan' },
    
    // Inventory
    stock_movements: { entityName: 'Stock Movement', module: 'Inventory & Bodega', icon: 'inventory', badgeColor: 'teal' },
    commissary_dispatches: { entityName: 'Commissary Dispatch', module: 'Inventory & Bodega', icon: 'local-shipping', badgeColor: 'sky' },
    waste_logs: { entityName: 'Spoilage & Waste', module: 'Inventory & Bodega', icon: 'delete-sweep', badgeColor: 'stone' },
    spoilage: { entityName: 'Spoilage & Bad Orders', module: 'Inventory & Bodega', icon: 'delete-sweep', badgeColor: 'stone' },
    store_audits: { entityName: 'Bodega Inventory Audit', module: 'Inventory & Bodega', icon: 'fact-check', badgeColor: 'teal' },

    // Lending & Credit
    loans: { entityName: 'Loan Account', module: 'Lending & Loans', icon: 'receipt-long', badgeColor: 'blue' },
    payments: { entityName: 'Payment Entry', module: 'Lending & Loans', icon: 'payments', badgeColor: 'emerald' },
    borrowers: { entityName: 'Member / Borrower', module: 'Lending & Loans', icon: 'person', badgeColor: 'indigo' },
    loan_products: { entityName: 'Loan Product', module: 'Lending & Loans', icon: 'category', badgeColor: 'blue' },
    loan_applications: { entityName: 'Loan Application', module: 'Lending & Loans', icon: 'assignment', badgeColor: 'blue' },
    collection_logs: { entityName: 'Collection Activity', module: 'Lending & Loans', icon: 'history-edu', badgeColor: 'emerald' },
    collection_groups: { entityName: 'Collection Group', module: 'Lending & Loans', icon: 'groups', badgeColor: 'indigo' },
    savings_transactions: { entityName: 'Savings Transaction', module: 'Lending & Loans', icon: 'savings', badgeColor: 'emerald' },
    share_capital_transactions: { entityName: 'Share Capital Entry', module: 'Lending & Loans', icon: 'account-balance', badgeColor: 'indigo' },

    // Accounting & Finance
    journal_entries: { entityName: 'Journal Entry', module: 'Accounting & Finance', icon: 'menu-book', badgeColor: 'violet' },
    journal_entry_lines: { entityName: 'Journal Entry Line', module: 'Accounting & Finance', icon: 'format-list-numbered', badgeColor: 'violet' },
    accounts_payable_vouchers: { entityName: 'AP Voucher', module: 'Accounting & Finance', icon: 'receipt', badgeColor: 'blue' },
    expenses: { entityName: 'Store Expense', module: 'Accounting & Finance', icon: 'money-off', badgeColor: 'red' },
    expense_categories: { entityName: 'Expense Category', module: 'Accounting & Finance', icon: 'label', badgeColor: 'red' },
    bank_accounts: { entityName: 'Bank Account', module: 'Accounting & Finance', icon: 'account-balance', badgeColor: 'blue' },
    bank_transactions: { entityName: 'Bank Transaction', module: 'Accounting & Finance', icon: 'swap-horiz', badgeColor: 'blue' },
    chart_of_accounts: { entityName: 'Chart of Accounts', module: 'Accounting & Finance', icon: 'account-tree', badgeColor: 'violet' },
    
    // Franchise & CRM
    franchise_contracts: { entityName: 'Franchise Contract', module: 'Franchise & CRM', icon: 'handshake', badgeColor: 'amber' },
    franchise_royalty_ledgers: { entityName: 'Franchise Royalty Ledger', module: 'Franchise & CRM', icon: 'monetization-on', badgeColor: 'amber' },

    // HR & Payroll
    employees: { entityName: 'Employee Profile', module: 'HR & Staff', icon: 'badge', badgeColor: 'emerald' },
    payrolls: { entityName: 'Payroll Record', module: 'HR & Staff', icon: 'payments', badgeColor: 'emerald' },
    payroll_runs: { entityName: 'Payroll Run', module: 'HR & Staff', icon: 'date-range', badgeColor: 'emerald' },

    // System & Settings
    feature_flags: { entityName: 'Feature Flag', module: 'System & Config', icon: 'toggle-on', badgeColor: 'purple' },
    user_profiles: { entityName: 'User Account', module: 'System & Config', icon: 'admin-panel-settings', badgeColor: 'indigo' },
    device_registries: { entityName: 'Device Registry', module: 'System & Config', icon: 'devices', badgeColor: 'gray' },
    app_settings: { entityName: 'System Setting', module: 'System & Config', icon: 'settings', badgeColor: 'gray' },

    // Water Station
    ws_customers: { entityName: 'WS Customer', module: 'Water Station', icon: 'person', badgeColor: 'blue' },
    ws_deliveries: { entityName: 'WS Delivery', module: 'Water Station', icon: 'local-shipping', badgeColor: 'blue' },
    ws_payments: { entityName: 'WS Payment', module: 'Water Station', icon: 'payments', badgeColor: 'blue' },
    ws_expenses: { entityName: 'WS Expense', module: 'Water Station', icon: 'money-off', badgeColor: 'blue' },
    ws_containers: { entityName: 'WS Container Tracking', module: 'Water Station', icon: 'water-drop', badgeColor: 'blue' },
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
    } else if (normTable === 'loans') {
        const loanNum = data.loan_number || data.loanNumber || entityId.substring(0, 8);
        const borrower = data.borrower_name || data.borrowerName || '';
        title = `Loan #${loanNum}${borrower ? ` • ${borrower}` : ''}`;
        if (data.total_amount || data.principal_amount) {
            subtitle = `Amount: ${formatPHP(data.total_amount || data.principal_amount)}`;
        }
    } else if (normTable === 'payments') {
        const amount = data.amount != null ? formatPHP(data.amount) : '';
        const ref = data.reference_number || data.receipt_number || data.receiptNumber || '';
        title = amount ? `Payment ${amount}` : 'Loan Payment';
        if (ref) subtitle = `Ref #${ref}`;
    } else if (normTable === 'borrowers') {
        const name = data.full_name || data.fullName || `${data.first_name || ''} ${data.last_name || ''}`.trim() || entityId;
        title = name;
        if (data.contact_number || data.phone) subtitle = `Contact: ${data.contact_number || data.phone}`;
    } else if (normTable.includes('product')) {
        title = data.name || data.title || entityId;
        if (data.price != null) subtitle = `Price: ${formatPHP(data.price)}`;
    } else if (normTable.includes('order')) {
        const ord = data.order_number || data.orderNumber || entityId.substring(0, 8);
        title = `Order #${ord}`;
        if (data.total_amount != null) subtitle = `Total: ${formatPHP(data.total_amount)}`;
    } else if (normTable === 'stock_movements') {
        const prod = data.product_name || data.productName || 'Inventory Item';
        const qty = data.quantity != null ? `${data.quantity > 0 ? '+' : ''}${data.quantity}` : '';
        title = `${prod} (${qty})`;
        subtitle = `Movement: ${capitalizeRole(data.movement_type || 'Stock Change')}`;
    } else if (normTable === 'expenses') {
        title = data.description || data.category || 'Store Expense';
        if (data.amount != null) subtitle = `Amount: ${formatPHP(data.amount)}`;
    } else if (normTable === 'user_profiles') {
        title = data.full_name || data.fullName || data.email || entityId;
        subtitle = `Role: ${capitalizeRole(data.role || 'User')}`;
    } else if (normTable === 'commissary_dispatches') {
        title = `Dispatch #${data.dispatch_number || entityId.substring(0, 8)}`;
        if (data.status) subtitle = `Status: ${capitalizeRole(data.status)}`;
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
    'amount', 'total_amount', 'totalAmount', 'principal_amount', 'principalAmount',
    'installment_amount', 'installmentAmount', 'balance', 'price', 'cost',
    'interest_amount', 'interestAmount', 'fee', 'penalty_amount', 'deposit_amount'
]);

const DATE_FIELDS = new Set([
    'date', 'payment_date', 'paymentDate', 'release_date', 'releaseDate',
    'maturity_date', 'maturityDate', 'first_payment_date', 'firstPaymentDate',
    'due_date', 'dueDate', 'timestamp'
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
