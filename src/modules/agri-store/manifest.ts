import { CoopModule } from '../core/BaseModule';

export const AgriStoreModule: CoopModule = {
    id: 'agri-store',
    name: 'Agri-Store',
    icon: 'grass',
    description: 'Manage agricultural supplies, fertilizers, seeds, member credit purchasing, and inventory tracking.',
    version: '1.0.0',
    featureKey: 'feature.modules.agri_store.enabled',
    coaSegmentCode: 'AGRI',
    defaultCoA: [
        {
            code: '1016',
            name: 'Cash on Hand — Agri-Store',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1000',
            sortOrder: 7
        },
        {
            code: '1210',
            name: 'Merchandise Inventory — Agri-Store',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1200',
            sortOrder: 15
        },
        {
            code: '4110',
            name: 'Agri-Store Sales Revenue',
            accountType: 'income',
            normalBalance: 'credit',
            parentCode: '4000',
            sortOrder: 313
        },
        {
            code: '5130',
            name: 'Cost of Goods Sold — Agri-Store',
            accountType: 'expense',
            normalBalance: 'debit',
            parentCode: '5000',
            sortOrder: 423
        }
    ],
    // No tables are introduced by this module yet. The previously declared
    // `agri_products` / `agri_sales` existed in no layer at all (not in
    // src/database/schema.ts, not in syncTableContract.json, not in any migration),
    // which made the registry claim persistence this module does not have.
    // The console screen still mutates useState seed data only; see
    // docs/CRUD-PERSISTENCE-AUDIT.md M4 (task: implement on stock_movements /
    // module_transactions, or gate the console off). Intended shape, for the record:
    //   agri_products(name, category, unit, price, stock_quantity)
    //   agri_sales(member_id?, total_amount, payment_type, sale_date)
    // The generic inventory path already names this unit as a discriminator value:
    // stock_movements.product_source = 'agri_products'.
    dbTables: [],
    routes: [
        {
            path: '/(admin)/modules/agri-store',
            label: 'Dashboard',
            icon: 'dashboard',
            permissionKey: 'permission.modules.agri_store.dashboard'
        }
    ],
    roles: [
        {
            role: 'agri-store-clerk',
            label: 'Agri-Store Storekeeper',
            permissions: ['permission.modules.agri_store.dashboard']
        }
    ]
};

export default AgriStoreModule;
