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
    // No tables are introduced by this module yet. The previously declared
    // `transport_vehicles` / `transport_collections` existed in no layer at all (not
    // in src/database/schema.ts, not in syncTableContract.json, not in any migration,
    // and no model references them), which made the registry claim persistence this
    // module does not have. The console screen mutates useState seed data only; see
    // docs/CRUD-PERSISTENCE-AUDIT.md M4 (task: build real fleet tables or gate the
    // console off). Intended shape, for the record:
    //   transport_vehicles(plate_number, vehicle_type, assigned_driver_id?, status)
    //   transport_collections(vehicle_id, boundary_amount, collection_date)
    dbTables: [],
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
