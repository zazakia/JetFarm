import { SyncService, SyncPartitionFilter } from '../SyncService';

describe('SyncService Partitioned Sync Filter', () => {
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

    it('filters commissary_dispatches and waste_logs for branch_cashier', () => {
        SyncService.setPartitionFilter({
            branchId: 'branch-bagacay',
            role: 'branch_cashier',
        });

        const mockDispatchQuery = { eq: jest.fn().mockReturnThis() };
        const mockWasteQuery = { eq: jest.fn().mockReturnThis() };
        const mockProductQuery = { eq: jest.fn().mockReturnThis() };

        // Test through instance private helper access
        const syncInstance = (SyncService as any).instance;
        syncInstance.applyBranchPartitionFilter(mockDispatchQuery, 'commissary_dispatches');
        expect(mockDispatchQuery.eq).toHaveBeenCalledWith('to_branch_id', 'branch-bagacay');

        syncInstance.applyBranchPartitionFilter(mockWasteQuery, 'waste_logs');
        expect(mockWasteQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-bagacay');

        syncInstance.applyBranchPartitionFilter(mockProductQuery, 'marketplace_products');
        expect(mockProductQuery.eq).not.toHaveBeenCalled();
    });

    it('filters branch records for branch_manager', () => {
        SyncService.setPartitionFilter({
            branchId: 'branch-daro',
            role: 'branch_manager',
        });

        const mockRoyaltyQuery = { eq: jest.fn().mockReturnThis() };
        const syncInstance = (SyncService as any).instance;

        syncInstance.applyBranchPartitionFilter(mockRoyaltyQuery, 'royalty_calculations');
        expect(mockRoyaltyQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-daro');
    });

    it('filters with in() operator for area_supervisor across assigned stores', () => {
        const assignedStores = ['branch-locsin', 'branch-daro', 'branch-bagacay'];
        SyncService.setPartitionFilter({
            role: 'area_supervisor',
            accessibleBranchIds: assignedStores,
        });

        const mockDispatchQuery = { in: jest.fn().mockReturnThis() };
        const mockWasteQuery = { in: jest.fn().mockReturnThis() };
        const syncInstance = (SyncService as any).instance;

        syncInstance.applyBranchPartitionFilter(mockDispatchQuery, 'commissary_dispatches');
        expect(mockDispatchQuery.in).toHaveBeenCalledWith('to_branch_id', assignedStores);

        syncInstance.applyBranchPartitionFilter(mockWasteQuery, 'waste_logs');
        expect(mockWasteQuery.in).toHaveBeenCalledWith('branch_id', assignedStores);
    });

    it('allows global unfiltered access for executive, admin, and main_office', () => {
        const roles = ['executive', 'admin', 'main_office'];

        for (const role of roles) {
            SyncService.setPartitionFilter({
                role,
                branchId: 'branch-bagacay',
            });

            const mockQuery = { eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis() };
            const syncInstance = (SyncService as any).instance;

            syncInstance.applyBranchPartitionFilter(mockQuery, 'commissary_dispatches');
            syncInstance.applyBranchPartitionFilter(mockQuery, 'waste_logs');

            expect(mockQuery.eq).not.toHaveBeenCalled();
            expect(mockQuery.in).not.toHaveBeenCalled();
        }
    });

    it('does nothing when no partition filter is set', () => {
        SyncService.setPartitionFilter(null);

        const mockQuery = { eq: jest.fn().mockReturnThis() };
        const syncInstance = (SyncService as any).instance;

        const result = syncInstance.applyBranchPartitionFilter(mockQuery, 'commissary_dispatches');
        expect(result).toBe(mockQuery);
        expect(mockQuery.eq).not.toHaveBeenCalled();
    });
});
