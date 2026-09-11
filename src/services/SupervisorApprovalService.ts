import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import UserProfile from '../database/models/UserProfile';
import { BranchScopeService, UserScopeContext } from './BranchScopeService';
import ActionLogService from './ActionLogService';

export interface SupervisorInfo extends UserScopeContext {
    fullName?: string;
    email?: string;
}

export interface ApprovalValidationParams {
    supervisor: SupervisorInfo;
    targetBranchId: string;
    pin: string;
    actionType: string;
}

export interface ApprovalResult {
    authorized: boolean;
    supervisorId?: string;
    supervisorName?: string;
    error?: string;
}

export class SupervisorApprovalService {
    // Valid supervisor roles who have authorization power
    private static readonly SUPERVISOR_ROLES = new Set([
        'branch_manager',
        'area_supervisor',
        'admin',
        'main_office',
        'executive',
    ]);

    // Authorized offline manager override PINs (strictly for development / automated testing)
    private static readonly DEV_FALLBACK_PINS = ['8888', '1234'];

    /**
     * Checks if a user's role grants supervisor authorization privileges.
     */
    static isSupervisorRole(role: string): boolean {
        return this.SUPERVISOR_ROLES.has(role);
    }

    /**
     * Verifies supervisor PIN.
     * In production, strictly requires EXPO_PUBLIC_SUPERVISOR_OVERRIDE_PIN.
     * Fallback demo PINs are only permitted in __DEV__ / test environments.
     */
    static verifyPin(pin: string): boolean {
        if (!pin || pin.trim().length === 0) return false;
        const trimmed = pin.trim();
        const configuredPin = process.env.EXPO_PUBLIC_SUPERVISOR_OVERRIDE_PIN?.trim();
        if (configuredPin && trimmed === configuredPin) return true;

        const isDevOrTest = (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV === 'test';
        if (isDevOrTest) {
            return this.DEV_FALLBACK_PINS.includes(trimmed);
        }

        return false;
    }

    /**
     * Validates whether a supervisor can authorize an action at a target branch.
     */
    static async validateApproval(params: ApprovalValidationParams): Promise<ApprovalResult> {
        const { supervisor, targetBranchId, pin, actionType } = params;

        if (!supervisor || !supervisor.role) {
            return { authorized: false, error: 'Supervisor profile is missing or invalid.' };
        }

        if (!this.isSupervisorRole(supervisor.role)) {
            return { authorized: false, error: 'User does not hold a supervisor or managerial role.' };
        }

        const hasBranchAccess = await BranchScopeService.canAccessBranch(supervisor, targetBranchId);
        if (!hasBranchAccess) {
            return {
                authorized: false,
                error: `Supervisor is not authorized for this branch (${targetBranchId}).`,
            };
        }

        if (!this.verifyPin(pin)) {
            return { authorized: false, error: 'Invalid supervisor PIN. Please re-enter.' };
        }

        return {
            authorized: true,
            supervisorId: supervisor.id,
            supervisorName: supervisor.fullName || 'Authorized Supervisor',
        };
    }

    /**
     * Fetches all active supervisors who can authorize actions at the specified branch.
     */
    static async getEligibleSupervisors(branchId: string): Promise<SupervisorInfo[]> {
        try {
            if (!database || !database.collections) return [];
            const profilesCollection = database.collections.get<UserProfile>('user_profiles');
            if (!profilesCollection) return [];

            const users = await profilesCollection
                .query(
                    Q.where('deleted_at', null),
                    Q.where('is_active', true),
                    Q.where('role', Q.oneOf(['branch_manager', 'area_supervisor', 'admin', 'main_office', 'executive']))
                )
                .fetch();

            const eligible: SupervisorInfo[] = [];
            for (const u of users) {
                const scope: SupervisorInfo = {
                    id: u.id,
                    role: u.role,
                    branchId: u.branchId,
                    areaId: u.areaId,
                    fullName: u.fullName,
                    email: u.email,
                };
                if (await BranchScopeService.canAccessBranch(scope, branchId)) {
                    eligible.push(scope);
                }
            }
            return eligible;
        } catch (err) {
            console.warn('[SupervisorApprovalService] getEligibleSupervisors error:', err);
            return [];
        }
    }

    /**
     * Records an audit log for an approved supervisor override.
     */
    static async recordApprovalLog(params: {
        supervisorId: string;
        cashierId: string;
        branchId: string;
        action: string;
        details?: any;
    }): Promise<void> {
        try {
            await ActionLogService.logAction({
                entityType: 'supervisor_overrides',
                entityId: `${params.branchId}:${params.action}:${Date.now()}`,
                action: 'UPDATE',
                performedBy: params.supervisorId,
                newData: {
                    cashierId: params.cashierId,
                    branchId: params.branchId,
                    action: params.action,
                    details: params.details,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (err) {
            console.warn('[SupervisorApprovalService] Failed to record approval log:', err);
        }
    }
}
