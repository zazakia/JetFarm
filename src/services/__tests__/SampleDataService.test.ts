import { Database, Q } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import AgriParcel from '../../database/models/AgriParcel';
import Expense from '../../database/models/Expense';
import { SampleDataService, sampleUuid } from '../SampleDataService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every remote table SyncService pushes sample records into declares `id UUID PRIMARY KEY`.
// PostgREST rejects readable ids like "sample-area-poblacion" with 22P02, which fails the whole
// table push and blocks real records in the same batch. This is the agribusiness-only set: credit,
// marketplace, water-station, POS, payroll and share-capital tables are not seeded here.
const SAMPLE_TABLES = [
    'areas', 'expenses', 'branches', 'warehouses',
    'bank_accounts', 'cash_transactions', 'suppliers', 'accounts_payable_vouchers',
    'business_units', 'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
    'statutory_fund_allocations',
    'agri_parcels', 'agri_crop_cycles', 'agri_farm_workers', 'agri_farm_expenses',
    'agri_labor_logs', 'agri_harvest_logs', 'agri_land_owners', 'agri_investors',
    'agri_investor_ledgers', 'agri_weekly_settlements', 'agri_growth_checkins',
];

async function countActive(db: Database, table: string) {
    const rows = await db.get(table as any).query(Q.where('deleted_at', Q.eq(null))).fetch();
    return rows.length;
}

describe('SampleDataService', () => {
    let database: Database;

    beforeEach(() => {
        database = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('seeds the agribusiness and ledger demo records', async () => {
        await SampleDataService.enable(database);

        const parcels = await database.get<AgriParcel>('agri_parcels').query(Q.where('deleted_at', null)).fetch();
        const cycles = await database.get('agri_crop_cycles').query(Q.where('deleted_at', null)).fetch();
        const landowners = await database.get('agri_land_owners').query(Q.where('deleted_at', null)).fetch();
        const investors = await database.get('agri_investors').query(Q.where('deleted_at', null)).fetch();
        const settlements = await database.get('agri_weekly_settlements').query(Q.where('deleted_at', null)).fetch();
        const checkins = await database.get('agri_growth_checkins').query(Q.where('deleted_at', null)).fetch();
        const banks = await database.get('bank_accounts').query(Q.where('deleted_at', null)).fetch();
        const coa = await database.get('chart_of_accounts').query(Q.where('deleted_at', null)).fetch();
        const jes = await database.get('journal_entries').query(Q.where('deleted_at', null)).fetch();
        const vouchers = await database.get('accounts_payable_vouchers').query(Q.where('deleted_at', null)).fetch();
        const expenses = await database.get<Expense>('expenses').query(Q.where('deleted_at', null)).fetch();

        expect(parcels.length).toBeGreaterThanOrEqual(2);
        expect(cycles.length).toBeGreaterThanOrEqual(2);
        expect(landowners.length).toBeGreaterThanOrEqual(2);
        expect(investors.length).toBeGreaterThanOrEqual(2);
        expect(settlements.length).toBeGreaterThanOrEqual(2);
        expect(checkins.length).toBeGreaterThanOrEqual(2);
        expect(banks.length).toBeGreaterThanOrEqual(2);
        expect(coa.length).toBeGreaterThanOrEqual(8);
        expect(vouchers.length).toBeGreaterThanOrEqual(2);
        expect(expenses).toHaveLength(3);
        expect(expenses.every(e => e.description.includes(SampleDataService.marker))).toBe(true);

        // Double-entry balance holds for every seeded journal entry.
        for (const je of jes as any[]) {
            expect(je.totalDebit).toBe(je.totalCredit);
            expect(je.totalDebit).toBeGreaterThan(0);
        }
    });

    it('attaches sample parcels to the sample land owners it also seeds', async () => {
        await SampleDataService.enable(database);

        // Before the teardown these pointed at ids derived from sample borrowers, so the parcel
        // list rendered an unresolvable owner. A parcel must now resolve to a real land owner row.
        const parcels = await database.get<AgriParcel>('agri_parcels').query(Q.where('deleted_at', null)).fetch();
        expect(parcels.length).toBeGreaterThan(0);
        for (const parcel of parcels as any[]) {
            expect(parcel.landOwnerId).toEqual(expect.stringMatching(UUID_RE));
            const owner = await database.get('agri_land_owners').find(parcel.landOwnerId);
            expect(owner).toBeTruthy();
        }
    });

    it('reports only agribusiness and finance counters in the demo status', async () => {
        const status = await SampleDataService.getStatus(database);

        expect(Object.keys(status.totals).sort()).toEqual([
            'accountsPayableVouchers', 'agriCropCycles', 'agriFarmExpenses', 'agriFarmWorkers',
            'agriGrowthCheckins', 'agriHarvestLogs', 'agriInvestorLedgers', 'agriInvestors',
            'agriLaborLogs', 'agriLandOwners', 'agriParcels', 'agriWeeklySettlements',
            'areas', 'bankAccounts', 'branches', 'businessUnits', 'cashTransactions',
            'chartOfAccounts', 'expenses', 'journalEntries', 'journalEntryLines',
            'statutoryFundAllocations', 'suppliers', 'warehouses',
        ].sort());

        for (const retired of ['loans', 'borrowers', 'payments', 'fileCases', 'marketplaceProducts',
            'waterCustomers', 'employees', 'payrollRuns', 'shareCapitalTransactions', 'savingsTransactions']) {
            expect(status.totals).not.toHaveProperty(retired);
        }
    });

    it('seeds nothing into the credit, marketplace, water-station or payroll tables', async () => {
        await SampleDataService.enable(database);

        const untouched = [
            'borrowers', 'loans', 'payments', 'payment_schedules', 'file_cases', 'collectors',
            'marketplace_products', 'marketplace_orders', 'ws_customers', 'ws_deliveries',
            'sales_returns', 'pos_sessions', 'payroll_runs', 'employees',
            'share_capital_transactions', 'savings_transactions', 'loan_applications',
        ];
        const counts = await Promise.all(untouched.map(table => countActive(database, table)));
        expect(counts.reduce((sum, n) => sum + n, 0)).toBe(0);
    });

    it('can hide, restore, and purge sample data without touching real records', async () => {
        const realParcelId = sampleUuid('real-parcel-not-sample');
        await database.write(async () => {
            await database.get<AgriParcel>('agri_parcels').create(p => {
                p._raw.id = realParcelId;
                p.name = 'Real Grower Parcel';
                p.code = 'PARCEL-REAL-01';
                p.areaHectares = 2;
                p.status = 'planted';
            });
        });

        await SampleDataService.enable(database);
        await SampleDataService.disable(database);

        let status = await SampleDataService.getStatus(database);
        expect(status.enabled).toBe(false);
        expect(status.deleted).toBeGreaterThan(0);
        const real = await database.get<AgriParcel>('agri_parcels').find(realParcelId);
        expect((real as any).deletedAt).toBeFalsy();

        await SampleDataService.restore(database);
        status = await SampleDataService.getStatus(database);
        expect(status.enabled).toBe(true);

        await SampleDataService.purge(database);
        status = await SampleDataService.getStatus(database);
        expect(status.active).toBe(0);
        expect(status.deleted).toBe(0);

        await expect(database.get<AgriParcel>('agri_parcels').find(realParcelId)).resolves.toBeTruthy();
    });

    it('returns an empty status when the database is unavailable during logout teardown', async () => {
        const dbWithMissingCollection = {
            get: jest.fn(() => null),
        } as unknown as Database;

        const status = await SampleDataService.getStatus(dbWithMissingCollection);
        expect(status).toMatchObject({ enabled: false, active: 0, deleted: 0 });
        expect(Object.values(status.totals).every(value => value === 0)).toBe(true);
        expect(Object.keys(status.totals)).toHaveLength(SAMPLE_TABLES.length);
    });

    describe('sync-safe uuid sample ids', () => {
        it('assigns a valid uuid id to every seeded sample record', async () => {
            await SampleDataService.enable(database);

            const offenders: string[] = [];
            for (const table of SAMPLE_TABLES) {
                const rows = await database.get(table as any).query().fetch();
                for (const row of rows as any[]) {
                    if (!UUID_RE.test(row.id)) {
                        offenders.push(`${table}:${row.id}`);
                    }
                }
            }
            expect(offenders).toEqual([]);
        });

        it('sampleUuid is deterministic, uuid-formatted, and collision-free per key', () => {
            const a = sampleUuid('sample-area-poblacion');
            const b = sampleUuid('sample-area-poblacion');
            const c = sampleUuid('sample-branch-main');

            expect(a).toBe(b);
            expect(a).not.toBe(c);
            expect(a).toEqual(expect.stringMatching(UUID_RE));
        });

        it('purgeLegacyReadableIds destroys pre-uuid sample rows without touching real records', async () => {
            await database.write(async () => {
                await database.get('areas').create((r: any) => {
                    r._raw.id = 'sample-area-poblacion';
                    r._raw.name = '[sample-data] District 1 - Poblacion Agri-Center';
                });
                await database.get('branches').create((r: any) => {
                    r._raw.id = 'sample-branch-main';
                    r._raw.name = '[sample-data] Main Branch';
                });
                await database.get<AgriParcel>('agri_parcels').create((p: any) => {
                    p._raw.id = sampleUuid('real-parcel');
                    p.name = 'Real Parcel';
                    p.code = 'REAL-01';
                    p.areaHectares = 1;
                    p.status = 'planted';
                });
            });

            const purged = await SampleDataService.purgeLegacyReadableIds(database);
            expect(purged).toBe(2);

            expect(await findByIdOrNull(database, 'areas', 'sample-area-poblacion')).toBeNull();
            expect(await findByIdOrNull(database, 'branches', 'sample-branch-main')).toBeNull();
            expect(await findByIdOrNull(database, 'agri_parcels', sampleUuid('real-parcel'))).not.toBeNull();
        });

        it('enable after purgeLegacyReadableIds does not resurrect legacy readable ids', async () => {
            await database.write(async () => {
                await database.get('areas').create((r: any) => {
                    r._raw.id = 'sample-area-poblacion';
                    r._raw.name = '[sample-data] District 1 - Poblacion Agri-Center';
                });
            });
            await SampleDataService.purgeLegacyReadableIds(database);
            await SampleDataService.enable(database);

            const areas = await database.get('areas').query().fetch();
            expect(areas.length).toBeGreaterThan(0);
            for (const area of areas as any[]) {
                expect(area.id).toEqual(expect.stringMatching(UUID_RE));
            }
        });
    });
});

async function findByIdOrNull(db: Database, table: string, id: string) {
    try {
        return await db.get(table as any).find(id);
    } catch {
        return null;
    }
}
