import { SupervisorApprovalService } from '../SupervisorApprovalService';

describe('SupervisorApprovalService', () => {
    describe('isSupervisorRole', () => {
        it('identifies valid supervisor roles', () => {
            expect(SupervisorApprovalService.isSupervisorRole('branch_manager')).toBe(true);
            expect(SupervisorApprovalService.isSupervisorRole('area_supervisor')).toBe(true);
            expect(SupervisorApprovalService.isSupervisorRole('admin')).toBe(true);
            expect(SupervisorApprovalService.isSupervisorRole('main_office')).toBe(true);
            expect(SupervisorApprovalService.isSupervisorRole('executive')).toBe(true);
        });

        it('rejects non-supervisor roles', () => {
            expect(SupervisorApprovalService.isSupervisorRole('branch_cashier')).toBe(false);
            expect(SupervisorApprovalService.isSupervisorRole('collector')).toBe(false);
            expect(SupervisorApprovalService.isSupervisorRole('borrower')).toBe(false);
            expect(SupervisorApprovalService.isSupervisorRole('loan_encoder')).toBe(false);
        });
    });

    describe('verifyPin', () => {
        it('accepts standard authorized supervisor PINs', () => {
            expect(SupervisorApprovalService.verifyPin('8888')).toBe(true);
            expect(SupervisorApprovalService.verifyPin('1234')).toBe(true);
        });

        it('rejects invalid PINs', () => {
            expect(SupervisorApprovalService.verifyPin('0000')).toBe(false);
            expect(SupervisorApprovalService.verifyPin('9999')).toBe(false);
            expect(SupervisorApprovalService.verifyPin('')).toBe(false);
        });
    });

    describe('validateApproval', () => {
        it('approves when supervisor has permission on the branch and correct PIN', async () => {
            const supervisor = {
                id: 'sup-1',
                role: 'branch_manager',
                branchId: 'branch-bagacay',
                fullName: 'Manager Juan',
            };

            const result = await SupervisorApprovalService.validateApproval({
                supervisor,
                targetBranchId: 'branch-bagacay',
                pin: '8888',
                actionType: 'VOID_ORDER',
            });

            expect(result.authorized).toBe(true);
            expect(result.supervisorId).toBe('sup-1');
            expect(result.supervisorName).toBe('Manager Juan');
        });

        it('rejects when supervisor belongs to another branch without area/global authority', async () => {
            const supervisor = {
                id: 'sup-2',
                role: 'branch_manager',
                branchId: 'branch-daro',
                fullName: 'Manager Pedro',
            };

            const result = await SupervisorApprovalService.validateApproval({
                supervisor,
                targetBranchId: 'branch-bagacay',
                pin: '8888',
                actionType: 'VOID_ORDER',
            });

            expect(result.authorized).toBe(false);
            expect(result.error).toContain('not authorized for this branch');
        });

        it('allows global admin to approve any branch', async () => {
            const supervisor = {
                id: 'admin-1',
                role: 'admin',
                fullName: 'Admin User',
            };

            const result = await SupervisorApprovalService.validateApproval({
                supervisor,
                targetBranchId: 'branch-bagacay',
                pin: '1234',
                actionType: 'HIGH_DISCOUNT',
            });

            expect(result.authorized).toBe(true);
            expect(result.supervisorId).toBe('admin-1');
        });

        it('rejects when PIN is incorrect', async () => {
            const supervisor = {
                id: 'sup-1',
                role: 'branch_manager',
                branchId: 'branch-bagacay',
                fullName: 'Manager Juan',
            };

            const result = await SupervisorApprovalService.validateApproval({
                supervisor,
                targetBranchId: 'branch-bagacay',
                pin: '9999',
                actionType: 'VOID_ORDER',
            });

            expect(result.authorized).toBe(false);
            expect(result.error).toContain('Invalid supervisor PIN');
        });
    });
});
