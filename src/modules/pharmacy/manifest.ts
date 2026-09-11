import { CoopModule } from '../core/BaseModule';

export const PharmacyModule: CoopModule = {
    id: 'pharmacy',
    name: 'Coop Pharmacy',
    icon: 'medical-services',
    description: 'Track medicine dispensing, prescription logs, inventory expiry dates, and member senior/PWD discounts.',
    version: '1.0.0',
    featureKey: 'feature.modules.pharmacy.enabled',
    coaSegmentCode: 'PHARM',
    defaultCoA: [
        {
            code: '1017',
            name: 'Cash on Hand — Pharmacy',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1000',
            sortOrder: 8
        },
        {
            code: '1220',
            name: 'Medicine Inventory — Pharmacy',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1200',
            sortOrder: 16
        },
        {
            code: '4120',
            name: 'Pharmacy Sales Revenue',
            accountType: 'income',
            normalBalance: 'credit',
            parentCode: '4000',
            sortOrder: 314
        },
        {
            code: '5140',
            name: 'Cost of Goods Sold — Pharmacy',
            accountType: 'expense',
            normalBalance: 'debit',
            parentCode: '5000',
            sortOrder: 424
        }
    ],
    dbTables: [
        {
            name: 'pharmacy_medicines',
            columns: [
                { name: 'generic_name', type: 'string' },
                { name: 'brand_name', type: 'string', isOptional: true },
                { name: 'dosage', type: 'string' },
                { name: 'unit_price', type: 'number' },
                { name: 'stock_qty', type: 'number' },
                { name: 'expiry_date', type: 'number' }
            ]
        },
        {
            name: 'pharmacy_sales',
            columns: [
                { name: 'member_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'total_amount', type: 'number' },
                { name: 'discount_amount', type: 'number', isOptional: true },
                { name: 'sale_date', type: 'number' }
            ]
        }
    ],
    routes: [
        {
            path: '/(admin)/modules/pharmacy',
            label: 'Dashboard',
            icon: 'dashboard',
            permissionKey: 'permission.modules.pharmacy.dashboard'
        }
    ],
    roles: [
        {
            role: 'pharmacy-pharmacist',
            label: 'Coop Pharmacist',
            permissions: ['permission.modules.pharmacy.dashboard']
        }
    ]
};

export default PharmacyModule;
