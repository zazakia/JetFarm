import { CoopModule } from '../core/BaseModule';

export const WaterStationModule: CoopModule = {
    id: 'water-station',
    name: 'Water Station',
    icon: 'local-drink',
    description: 'Track water refilling, deliveries, containers, and payments with segment financial reporting.',
    version: '1.0.0',
    featureKey: 'feature.modules.water_station.enabled',
    coaSegmentCode: 'WS',
    defaultCoA: [
        {
            code: '1015',
            name: 'Cash on Hand — Water Station',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1000',
            sortOrder: 6
        },
        {
            code: '4100',
            name: 'Water Sales Revenue',
            accountType: 'income',
            normalBalance: 'credit',
            parentCode: '4000',
            sortOrder: 312
        },
        {
            code: '5120',
            name: 'Cost of Sales — Water Station Supplies',
            accountType: 'expense',
            normalBalance: 'debit',
            parentCode: '5000',
            sortOrder: 422
        }
    ],
    dbTables: [
        {
            name: 'ws_customers',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'phone', type: 'string', isOptional: true },
                { name: 'address', type: 'string', isOptional: true },
                { name: 'is_member', type: 'boolean' },
                { name: 'member_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'is_active', type: 'boolean', isOptional: true }
            ]
        },
        {
            name: 'ws_deliveries',
            columns: [
                { name: 'customer_id', type: 'string', isIndexed: true },
                { name: 'delivery_date', type: 'number' },
                { name: 'gallons', type: 'number' },
                { name: 'price_per_gallon', type: 'number' },
                { name: 'total_amount', type: 'number' },
                { name: 'status', type: 'string' }
            ]
        },
        {
            name: 'ws_containers',
            columns: [
                { name: 'customer_id', type: 'string', isIndexed: true },
                { name: 'container_type', type: 'string' },
                { name: 'quantity_owned', type: 'number' },
                { name: 'quantity_loaned', type: 'number' }
            ]
        },
        {
            name: 'ws_payments',
            columns: [
                { name: 'customer_id', type: 'string', isIndexed: true },
                { name: 'delivery_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'payment_date', type: 'number' },
                { name: 'amount', type: 'number' },
                { name: 'payment_method', type: 'string' }
            ]
        },
        {
            name: 'ws_expenses',
            columns: [
                { name: 'category', type: 'string' },
                { name: 'amount', type: 'number' },
                { name: 'expense_date', type: 'number' },
                { name: 'description', type: 'string', isOptional: true }
            ]
        }
    ],
    routes: [
        {
            path: '/(admin)/modules/water-station',
            label: 'Dashboard',
            icon: 'dashboard',
            permissionKey: 'permission.modules.water_station.dashboard'
        },
        {
            path: '/(admin)/modules/water-station/customers',
            label: 'Customers',
            icon: 'people',
            permissionKey: 'permission.modules.water_station.customers'
        },
        {
            path: '/(admin)/modules/water-station/deliveries',
            label: 'Deliveries',
            icon: 'local-shipping',
            permissionKey: 'permission.modules.water_station.deliveries'
        },
        {
            path: '/(admin)/modules/water-station/inventory',
            label: 'Inventory',
            icon: 'inventory',
            permissionKey: 'permission.modules.water_station.inventory'
        }
    ],
    roles: [
        {
            role: 'water-station-cashier',
            label: 'Water Station Cashier',
            permissions: [
                'permission.modules.water_station.dashboard',
                'permission.modules.water_station.customers',
                'permission.modules.water_station.deliveries',
                'permission.modules.water_station.inventory'
            ]
        },
        {
            role: 'water-station-delivery-boy',
            label: 'Water Station Delivery Boy',
            permissions: [
                'permission.modules.water_station.deliveries'
            ]
        }
    ]
};

export default WaterStationModule;
