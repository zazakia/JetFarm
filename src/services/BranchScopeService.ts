import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import BusinessUnit from '../database/models/BusinessUnit';

export interface UserScopeContext {
    id?: string;
    role: string;
    branchId?: string | null;
    areaId?: string | null;
}

export class BranchScopeService {
    /**
     * Checks if a role has global multi-branch access.
     */
    static isGlobalRole(role: string): boolean {
        return role === 'admin' || role === 'main_office' || role === 'executive';
    }

    /**
     * Checks if a role is strictly locked to a single branch.
     */
    static isBranchScopedRole(role: string): boolean {
        return role === 'branch_cashier' || role === 'branch_manager';
    }

    /**
     * Checks if a role is scoped to an area cluster of branches.
     */
    static isAreaScopedRole(role: string): boolean {
        return role === 'area_supervisor';
    }

    /**
     * Retrieves all branch IDs accessible to the user based on their role and assignments.
     */
    static async getAccessibleBranchIds(user: UserScopeContext): Promise<string[]> {
        if (!user || !user.role) {
            return [];
        }

        // Global roles: return all active branch/business unit IDs
        if (this.isGlobalRole(user.role)) {
            try {
                if (database && database.get) {
                    const buCollection = database.get<BusinessUnit>('business_units');
                    if (buCollection) {
                        const records = await buCollection.query(Q.where('deleted_at', null)).fetch();
                        return records.map((r) => r.id);
                    }
                }
            } catch (err) {
                console.warn('[BranchScopeService] Error querying business units:', err);
            }
            return [];
        }

        // Branch-scoped roles: strictly single assigned branch
        if (this.isBranchScopedRole(user.role)) {
            return user.branchId ? [user.branchId] : [];
        }

        // Area supervisor: return branches matching areaId or areaSupervisorId
        if (this.isAreaScopedRole(user.role)) {
            if (!user.areaId && !user.id) return [];

            try {
                if (database && database.get) {
                    const buCollection = database.get<BusinessUnit>('business_units');
                    if (buCollection) {
                        const conditions: any[] = [Q.where('deleted_at', null)];
                        if (user.areaId && user.id) {
                            conditions.push(
                                Q.or(
                                    Q.where('area_id', user.areaId),
                                    Q.where('area_supervisor_id', user.id)
                                )
                            );
                        } else if (user.areaId) {
                            conditions.push(Q.where('area_id', user.areaId));
                        } else if (user.id) {
                            conditions.push(Q.where('area_supervisor_id', user.id));
                        }

                        const records = await buCollection.query(...conditions).fetch();
                        return records.map((r) => r.id);
                    }
                }
            } catch (err) {
                console.warn('[BranchScopeService] Error querying area branches:', err);
            }
            return [];
        }

        return user.branchId ? [user.branchId] : [];
    }

    /**
     * Verifies if a user has permission to access or transact on a specific branch.
     */
    static async canAccessBranch(user: UserScopeContext, branchId: string): Promise<boolean> {
        if (!user || !user.role || !branchId) {
            return false;
        }

        if (this.isGlobalRole(user.role)) {
            return true;
        }

        if (this.isBranchScopedRole(user.role)) {
            return user.branchId === branchId;
        }

        if (this.isAreaScopedRole(user.role)) {
            const accessibleBranchIds = await this.getAccessibleBranchIds(user);
            return accessibleBranchIds.includes(branchId);
        }

        return user.branchId === branchId;
    }
}
