import { CoopModule } from '../core/BaseModule';

export const TransportModule: CoopModule = {
    id: 'transport',
    name: 'Transport & Fleet',
    icon: 'directions-bus',
    description: 'Manage cooperative transport vehicles, tricycle/jeepney daily boundary collection, fuel logs, and maintenance.',
    version: '1.0.0',
    featureKey: 'feature.modules.transport.enabled',
    coaSegmentCode: 'TRANS',
    defaultCoA: [
        {
            code: '1018',
            name: 'Cash on Hand — Transport Unit',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1000',
            sortOrder: 9
        },
        {
            code: '1510',
            name: 'Transport Vehicles & Equipment',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1500',
            sortOrder: 25
        },
        {
            code: '4130',
            name: 'Transport Boundary & Fare Revenue',
            accountType: 'income',
            normalBalance: 'credit',
            parentCode: '4000',
            sortOrder: 315
        },
        {
            code: '5150',
            name: 'Fuel & Fleet Maintenance Expense',
            accountType: 'expense',
            normalBalance: 'debit',
            parentCode: '5000',
            sortOrder: 425
        }
    ],
    dbTables: [
        {
            name: 'transport_vehicles',
            columns: [
                { name: 'plate_number', type: 'string' },
                { name: 'vehicle_type', type: 'string' },
                { name: 'assigned_driver_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'status', type: 'string' }
            ]
        },
        {
            name: 'transport_collections',
            columns: [
                { name: 'vehicle_id', type: 'string', isIndexed: true },
                { name: 'boundary_amount', type: 'number' },
                { name: 'collection_date', type: 'number' }
            ]
        }
    ],
    routes: [
        {
            path: '/(admin)/modules/transport',
            label: 'Dashboard',
            icon: 'dashboard',
            permissionKey: 'permission.modules.transport.dashboard'
        }
    ],
    roles: [
        {
            role: 'transport-dispatcher',
            label: 'Transport Fleet Dispatcher',
            permissions: ['permission.modules.transport.dashboard']
        }
    ]
};

export default TransportModule;
