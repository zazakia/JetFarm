import { SyncService, SYNC_TABLES, SyncPartitionFilter } from '../SyncService';

/**
 * Branch partitioning was retired on the agribusiness-only branch.
 *
 * `applyBranchPartitionFilter` (src/services/SyncService.ts) used to narrow the pull for
 * commissary_dispatches, waste_logs and royalty_calculations only. Those tables (and the
 * branch_cashier / area_supervisor / branch_manager roles that drove the narrowing) were
 * deleted with the coop-business-unit, franchise and commissary domains, so the filter is now
 * a documented pass-through for every surviving agribusiness/finance table: branch scoping is
 * a UI/permission concern, not a pull-time query concern.
 *
 * These tests pin that contract. They are deliberately written as "must NOT narrow" assertions,
 * so re-introducing a `query.eq(...)`/`query.in(...)` arm in applyBranchPartitionFilter fails here.
 */
describe('SyncService Partitioned Sync Filter', () => {
    const ROLE_SCOPED_FILTERS: Array<{ label: string; filter: SyncPartitionFilter }> = [
        { label: 'branch_cashier', filter: { branchId: 'branch-bagacay', role: 'branch_cashier' } },
        { label: 'branch_manager', filter: { branchId: 'branch-daro', role: 'branch_manager' } },
        {
            label: 'area_supervisor',
            filter: {
                role: 'area_supervisor',
                accessibleBranchIds: ['branch-locsin', 'branch-daro', 'branch-bagacay'],
            },
        },
    ];

    /** Applies the (private) pull filter to a spy-backed query builder and returns the spies. */
    const applyFilter = (tableName: string) => {
        const query: any = {
            eq: jest.fn(() => query),
            in: jest.fn(() => query),
        };
        const syncInstance = (SyncService as any).instance;
        const result = syncInstance.applyBranchPartitionFilter(query, tableName);
        return { query, result };
    };

    afterEach(() => {
        SyncService.setPartitionFilter(null);
    });

    it('sets and retrieves the partition filter', () => {
        expect(SyncService.getPartitionFilter()).toBeNull();

        const filter: SyncPartitionFilter = {
            branchId: 'branch-bagacay-123',
            role: 'branch_cashier',
            areaId: 'area-jumar-456',
            accessibleBranchIds: ['branch-bagacay-123'],
        };

        SyncService.setPartitionFilter(filter);
        expect(SyncService.getPartitionFilter()).toEqual(filter);

        SyncService.setPartitionFilter(null);
        expect(SyncService.getPartitionFilter()).toBeNull();
    });

    it.each(ROLE_SCOPED_FILTERS)(
        'returns the untouched query for $label instead of narrowing the pull',
        ({ filter }) => {
            SyncService.setPartitionFilter(filter);

            // Retargeted 2026-10-20 from the retired commissary_dispatches / waste_logs /
            // royalty_calculations narrowing assertions onto the surviving contract:
            // the same filter must now leave every pulled table unfiltered.
            for (const tableName of ['expenses', 'cash_transactions', 'journal_entries', 'agri_parcels']) {
                const { query, result } = applyFilter(tableName);

                expect(result).toBe(query);
                expect(query.eq).not.toHaveBeenCalled();
                expect(query.in).not.toHaveBeenCalled();
            }
        }
    );

    it('narrows no surviving synced table at pull time for any branch-scoped role', () => {
        SyncService.setPartitionFilter({
            branchId: 'branch-bagacay',
            role: 'branch_cashier',
            areaId: 'area-jumar-456',
            accessibleBranchIds: ['branch-bagacay'],
        });

        // SYNC_TABLES is the exact list fetchTableChanges pulls, so this covers every table
        // that can reach applyBranchPartitionFilter. Nothing in it is branch-narrowed anymore.
        expect(SYNC_TABLES.length).toBeGreaterThan(0);
        for (const tableName of SYNC_TABLES) {
            const { query, result } = applyFilter(tableName);

            expect(result).toBe(query);
            expect(query.eq).not.toHaveBeenCalled();
            expect(query.in).not.toHaveBeenCalled();
        }
    });

    it('allows global unfiltered access for executive, admin, and main_office', () => {
        const roles = ['executive', 'admin', 'main_office'];

        for (const role of roles) {
            SyncService.setPartitionFilter({
                role,
                branchId: 'branch-bagacay',
            });

            for (const tableName of ['expenses', 'cash_transactions', 'journal_entries']) {
                const { query, result } = applyFilter(tableName);

                expect(result).toBe(query);
                expect(query.eq).not.toHaveBeenCalled();
                expect(query.in).not.toHaveBeenCalled();
            }
        }
    });

    it('does nothing when no partition filter is set', () => {
        SyncService.setPartitionFilter(null);

        const { query, result } = applyFilter('expenses');
        expect(result).toBe(query);
        expect(query.eq).not.toHaveBeenCalled();
    });
});
