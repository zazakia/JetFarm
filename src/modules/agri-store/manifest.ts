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
    dbTables: [
        {
            name: 'agri_products',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'category', type: 'string' },
                { name: 'unit', type: 'string' },
                { name: 'price', type: 'number' },
                { name: 'stock_quantity', type: 'number' }
            ]
        },
        {
            name: 'agri_sales',
            columns: [
                { name: 'member_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'total_amount', type: 'number' },
                { name: 'payment_type', type: 'string' },
                { name: 'sale_date', type: 'number' }
            ]
        }
    ],
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
