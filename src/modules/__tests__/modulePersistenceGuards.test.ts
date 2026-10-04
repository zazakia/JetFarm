import fs from 'fs';
import path from 'path';
import { DEFAULT_FEATURE_FLAGS } from '../../constants/configDefaults';
import { ROUTE_FEATURE_MAPPINGS } from '../../utils/featureFlags';
import { AgriStoreModule } from '../agri-store/manifest';
import { PharmacyModule } from '../pharmacy/manifest';
import { TransportModule } from '../transport/manifest';
import { WaterStationModule } from '../water-station/manifest';

// docs/CRUD-PERSISTENCE-AUDIT.md M3/M4.
//
// Agri-Store, Pharmacy and Transport declare a manifest, a route, a role and a default
// Chart-of-Accounts segment, but they own no tables: their consoles keep products, medicines
// and vehicles in useState, so "Record Sale" decrements an in-memory counter and nothing is
// written to WatermelonDB. That means nothing syncs and nothing posts to the ledger, while the
// banner presented a hardcoded peso figure as today's sales.
//
// Until those three units are actually wired to stock_movements / module_transactions, the
// honest state is: shipped dark by default, and unmistakably labelled when someone turns one on.
// These guards lock that state so a future edit cannot re-claim persistence it does not have.

const UNIMPLEMENTED = ['agri-store', 'pharmacy', 'transport'] as const;

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

function consoleSource(module: string): string {
    return read(path.join('app', '(admin)', 'modules', module, 'index.tsx'));
}

describe('coop modules without a persistence layer', () => {
    it('declares no tables in its manifest', () => {
        for (const module of [AgriStoreModule, PharmacyModule, TransportModule]) {
            expect(module.dbTables).toEqual([]);
        }

        // The implemented module must keep declaring its real tables, or this suite would be
        // satisfied by every manifest going empty.
        const declared = WaterStationModule.dbTables.map((t) => t.name);
        expect(declared).toEqual(expect.arrayContaining(['ws_customers', 'ws_deliveries', 'ws_containers']));
    });

    it('ships its feature flag disabled by default', () => {
        for (const key of [
            'feature.modules.agri_store.enabled',
            'feature.modules.pharmacy.enabled',
            'feature.modules.transport.enabled'
        ] as const) {
            const flag = DEFAULT_FEATURE_FLAGS.find((f) => f.key === key);
            expect(flag).toBeDefined();
            expect(flag?.enabled).toBe(false);
        }

        // The implemented module stays on, so this suite cannot be satisfied by every coop flag
        // going dark.
        expect(DEFAULT_FEATURE_FLAGS.find((f) => f.key === 'feature.modules.water_station.enabled')?.enabled).toBe(true);
    });

    it('labels its sample data instead of presenting it as live books', () => {
        for (const module of UNIMPLEMENTED) {
            const screen = consoleSource(module);
            expect(screen).toContain('DemoDataNotice');
            // The action confirmation must say the write did not happen.
            expect(screen).toContain('Preview Only');
            expect(screen).not.toMatch(/'Sale Recorded'/);
            expect(screen).not.toMatch(/Recorded sale of/);
            expect(screen).not.toMatch(/Alert\.alert\('Dispensed'/);
            expect(screen).not.toMatch(/Alert\.alert\('Boundary Collected'/);
        }
    });

    it('never claims a real accounting period in the header of a preview console', () => {
        for (const module of UNIMPLEMENTED) {
            // A period label ("Today's Sales") on a screen backed by useState seed data reads as a
            // booked figure in a finance app. Preview consoles label their KPIs as preview instead.
            expect(consoleSource(module)).not.toMatch(/Today's\s+[A-Za-z]/);
            expect(consoleSource(module)).not.toMatch(/Total Collections|Revenue Today/);
        }
    });

    it('routes the console behind the flag it names', () => {
        for (const [prefix, key] of [
            ['/modules/agri-store', 'feature.modules.agri_store.enabled'],
            ['/modules/pharmacy', 'feature.modules.pharmacy.enabled'],
            ['/modules/transport', 'feature.modules.transport.enabled']
        ] as const) {
            const mapping = ROUTE_FEATURE_MAPPINGS.find((m) => m.prefix === prefix);
            expect(mapping).toBeDefined();
            expect(mapping?.featureKey).toBe(key);
        }
    });
});
