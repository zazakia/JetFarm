import { BranchScopeService, UserScopeContext } from '../BranchScopeService';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        collections: {},
    },
}));

describe('BranchScopeService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Role classification helpers', () => {
        it('identifies global roles correctly', () => {
            expect(BranchScopeService.isGlobalRole('executive')).toBe(true);
            expect(BranchScopeService.isGlobalRole('admin')).toBe(true);
            expect(BranchScopeService.isGlobalRole('main_office')).toBe(true);
            expect(BranchScopeService.isGlobalRole('branch_cashier')).toBe(false);
            expect(BranchScopeService.isGlobalRole('branch_manager')).toBe(false);
            expect(BranchScopeService.isGlobalRole('area_supervisor')).toBe(false);
        });

        it('identifies branch-scoped roles correctly', () => {
            expect(BranchScopeService.isBranchScopedRole('branch_cashier')).toBe(true);
            expect(BranchScopeService.isBranchScopedRole('branch_manager')).toBe(true);
            expect(BranchScopeService.isBranchScopedRole('executive')).toBe(false);
            expect(BranchScopeService.isBranchScopedRole('area_supervisor')).toBe(false);
        });

        it('identifies area-scoped roles correctly', () => {
            expect(BranchScopeService.isAreaScopedRole('area_supervisor')).toBe(true);
            expect(BranchScopeService.isAreaScopedRole('executive')).toBe(false);
            expect(BranchScopeService.isAreaScopedRole('branch_cashier')).toBe(false);
        });
    });

    describe('getAccessibleBranchIds', () => {
        it('returns empty array when user is missing or has no role', async () => {
            expect(await BranchScopeService.getAccessibleBranchIds(null as any)).toEqual([]);
            expect(await BranchScopeService.getAccessibleBranchIds({ role: '' })).toEqual([]);
        });

        it('returns strictly the assigned branch for branch_cashier and branch_manager', async () => {
            const cashier: UserScopeContext = {
                role: 'branch_cashier',
                branchId: 'branch-bagacay',
            };
            expect(await BranchScopeService.getAccessibleBranchIds(cashier)).toEqual(['branch-bagacay']);

            const manager: UserScopeContext = {
                role: 'branch_manager',
                branchId: 'branch-locsin',
            };
            expect(await BranchScopeService.getAccessibleBranchIds(manager)).toEqual(['branch-locsin']);

            const unassignedManager: UserScopeContext = {
                role: 'branch_manager',
                branchId: null,
            };
            expect(await BranchScopeService.getAccessibleBranchIds(unassignedManager)).toEqual([]);
        });

        it('returns all active business units for global roles (executive, admin, main_office)', async () => {
            const mockBranches = [
                { id: 'branch-1', name: 'Bagacay' },
                { id: 'branch-2', name: 'Locsin' },
                { id: 'branch-3', name: 'Bayawan' },
            ];
            const mockQuery = jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue(mockBranches),
            });
            (database.get as jest.Mock).mockReturnValue({ query: mockQuery });

            const execUser: UserScopeContext = { role: 'executive' };
            const branchIds = await BranchScopeService.getAccessibleBranchIds(execUser);

            expect(branchIds).toEqual(['branch-1', 'branch-2', 'branch-3']);
            expect(database.get).toHaveBeenCalledWith('business_units');
        });

        it('returns branches belonging to the area for area_supervisor', async () => {
            const mockAreaBranches = [
                { id: 'branch-bayawan', areaId: 'area-christian' },
                { id: 'branch-mabinay-1', areaId: 'area-christian' },
                { id: 'branch-mabinay-2', areaId: 'area-christian' },
            ];
            const mockQuery = jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue(mockAreaBranches),
            });
            (database.get as jest.Mock).mockReturnValue({ query: mockQuery });

            const supervisor: UserScopeContext = {
                id: 'user-christian',
                role: 'area_supervisor',
                areaId: 'area-christian',
            };

            const branchIds = await BranchScopeService.getAccessibleBranchIds(supervisor);
            expect(branchIds).toEqual(['branch-bayawan', 'branch-mabinay-1', 'branch-mabinay-2']);
            expect(database.get).toHaveBeenCalledWith('business_units');
        });
    });

    describe('canAccessBranch', () => {
        it('returns false when user or branchId is missing', async () => {
            expect(await BranchScopeService.canAccessBranch(null as any, 'branch-1')).toBe(false);
            expect(await BranchScopeService.canAccessBranch({ role: 'admin' }, '')).toBe(false);
        });

        it('allows global roles (executive, admin) to access any branch', async () => {
            expect(await BranchScopeService.canAccessBranch({ role: 'executive' }, 'branch-99')).toBe(true);
            expect(await BranchScopeService.canAccessBranch({ role: 'admin' }, 'branch-42')).toBe(true);
            expect(await BranchScopeService.canAccessBranch({ role: 'main_office' }, 'branch-bagacay')).toBe(true);
        });

        it('allows branch_cashier to access only their assigned branch', async () => {
            const cashier: UserScopeContext = {
                role: 'branch_cashier',
                branchId: 'branch-bagacay',
            };

            expect(await BranchScopeService.canAccessBranch(cashier, 'branch-bagacay')).toBe(true);
            expect(await BranchScopeService.canAccessBranch(cashier, 'branch-locsin')).toBe(false);
        });

        it('allows branch_manager to access only their assigned branch', async () => {
            const manager: UserScopeContext = {
                role: 'branch_manager',
                branchId: 'branch-locsin',
            };

            expect(await BranchScopeService.canAccessBranch(manager, 'branch-locsin')).toBe(true);
            expect(await BranchScopeService.canAccessBranch(manager, 'branch-bayawan')).toBe(false);
        });

        it('allows area_supervisor to access branches inside their area', async () => {
            const mockAreaBranches = [
                { id: 'branch-sagay-1' },
                { id: 'branch-sagay-2' },
            ];
            const mockQuery = jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue(mockAreaBranches),
            });
            (database.get as jest.Mock).mockReturnValue({ query: mockQuery });

            const supervisor: UserScopeContext = {
                id: 'user-renor',
                role: 'area_supervisor',
                areaId: 'area-renor',
            };

            expect(await BranchScopeService.canAccessBranch(supervisor, 'branch-sagay-1')).toBe(true);
            expect(await BranchScopeService.canAccessBranch(supervisor, 'branch-other')).toBe(false);
        });
    });
});
