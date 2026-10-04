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
    // No tables are introduced by this module yet. The previously declared
    // `pharmacy_medicines` / `pharmacy_sales` existed in no layer at all (not in
    // src/database/schema.ts, not in syncTableContract.json, not in any migration,
    // and no model references them), which made the registry claim persistence this
    // module does not have. The console screen mutates useState seed data only; see
    // docs/CRUD-PERSISTENCE-AUDIT.md M4 (task: build real pharmacy tables or gate
    // the console off). Intended shape, for the record:
    //   pharmacy_medicines(generic_name, brand_name?, dosage, unit_price, stock_qty, expiry_date)
    //   pharmacy_sales(member_id?, total_amount, discount_amount?, sale_date)
    dbTables: [],
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
