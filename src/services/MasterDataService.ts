import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import Branch from '../database/models/Branch';
import Warehouse from '../database/models/Warehouse';
import StatutoryRate from '../database/models/StatutoryRate';
import Supplier from '../database/models/Supplier';
import uuid from 'react-native-uuid';
import { BaseModelService } from './BaseModelService';

export class MasterDataServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    // =========================================================================
    // BRANCHES
    // =========================================================================
    async getBranches(includeInactive = true): Promise<Branch[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', null)];
        if (!includeInactive) {
            clauses.push(Q.where('is_active', true));
        }
        clauses.push(Q.sortBy('name', Q.asc));
        return this.db.get<Branch>('branches').query(...clauses).fetch();
    }

    async createBranch(input: {
        name: string;
        code?: string;
        isHq?: boolean;
        isActive?: boolean;
    }): Promise<Branch> {
        let branch!: Branch;
        const now = Date.now();
        await this.db.write(async () => {
            branch = await this.db.get<Branch>('branches').create(b => {
                (b as any)._raw.id = uuid.v4().toString();
                b.name = input.name.trim();
                b.code = input.code?.trim() || undefined;
                b.isHq = input.isHq ?? false;
                b.isActive = input.isActive ?? true;
                (b as any).deletedAt = null;
            });
        });
        return branch;
    }

    async updateBranch(
        id: string,
        input: { name?: string; code?: string; isHq?: boolean; isActive?: boolean }
    ): Promise<Branch> {
        const branch = await this.db.get<Branch>('branches').find(id);
        const now = Date.now();
        await this.db.write(async () => {
            await branch.update(b => {
                if (input.name !== undefined) b.name = input.name.trim();
                if (input.code !== undefined) b.code = input.code.trim();
                if (input.isHq !== undefined) b.isHq = input.isHq;
                if (input.isActive !== undefined) b.isActive = input.isActive;
            });
        });
        return branch;
    }

    async toggleBranchActive(id: string): Promise<Branch> {
        const branch = await this.db.get<Branch>('branches').find(id);
        return this.updateBranch(id, { isActive: !branch.isActive });
    }

    // =========================================================================
    // WAREHOUSES & STORAGE LOCATIONS
    // =========================================================================
    async getWarehouses(branchId?: string, includeInactive = true): Promise<Warehouse[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', null)];
        if (branchId) {
            clauses.push(Q.where('branch_id', branchId));
        }
        if (!includeInactive) {
            clauses.push(Q.where('is_active', true));
        }
        clauses.push(Q.sortBy('name', Q.asc));
        return this.db.get<Warehouse>('warehouses').query(...clauses).fetch();
    }

    async createWarehouse(input: {
        branchId: string;
        name: string;
        type?: string;
        isActive?: boolean;
    }): Promise<Warehouse> {
        let wh!: Warehouse;
        const now = Date.now();
        await this.db.write(async () => {
            wh = await this.db.get<Warehouse>('warehouses').create(w => {
                (w as any)._raw.id = uuid.v4().toString();
                w.branchId = input.branchId;
                w.name = input.name.trim();
                w.type = input.type || 'store';
                w.isActive = input.isActive ?? true;
                (w as any).deletedAt = null;
            });
        });
        return wh;
    }

    async updateWarehouse(
        id: string,
        input: { branchId?: string; name?: string; type?: string; isActive?: boolean }
    ): Promise<Warehouse> {
        const wh = await this.db.get<Warehouse>('warehouses').find(id);
        const now = Date.now();
        await this.db.write(async () => {
            await wh.update(w => {
                if (input.branchId !== undefined) w.branchId = input.branchId;
                if (input.name !== undefined) w.name = input.name.trim();
                if (input.type !== undefined) w.type = input.type;
                if (input.isActive !== undefined) w.isActive = input.isActive;
            });
        });
        return wh;
    }

    async toggleWarehouseActive(id: string): Promise<Warehouse> {
        const wh = await this.db.get<Warehouse>('warehouses').find(id);
        return this.updateWarehouse(id, { isActive: !wh.isActive });
    }

    // =========================================================================
    // STATUTORY CONTRIBUTION RATES (SSS, PhilHealth, Pag-IBIG)
    // =========================================================================
    async getStatutoryRates(rateType?: string): Promise<StatutoryRate[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', null)];
        if (rateType) {
            clauses.push(Q.where('rate_type', rateType.toLowerCase()));
        }
        clauses.push(Q.sortBy('bracket_min', Q.asc));
        return this.db.get<StatutoryRate>('statutory_rates').query(...clauses).fetch();
    }

    async createStatutoryRate(input: {
        rateType: string;
        bracketMin: number;
        bracketMax?: number | null;
        employeeShare: number;
        employerShare: number;
        effectiveFrom: Date;
        effectiveTo?: Date | null;
        description?: string;
    }): Promise<StatutoryRate> {
        let rate!: StatutoryRate;
        const now = new Date();
        await this.db.write(async () => {
            rate = await this.db.get<StatutoryRate>('statutory_rates').create(r => {
                (r as any)._raw.id = uuid.v4().toString();
                r.rateType = input.rateType.toLowerCase();
                r.bracketMin = input.bracketMin;
                r.bracketMax = input.bracketMax !== undefined ? input.bracketMax : null;
                r.employeeShare = input.employeeShare;
                r.employerShare = input.employerShare;
                r.effectiveFrom = input.effectiveFrom;
                r.effectiveTo = input.effectiveTo || null;
                r.description = input.description?.trim() || null;
                r.createdAt = now;
                r.updatedAt = now;
                r.deletedAt = null;
            });
        });
        return rate;
    }

    async updateStatutoryRate(
        id: string,
        input: {
            rateType?: string;
            bracketMin?: number;
            bracketMax?: number | null;
            employeeShare?: number;
            employerShare?: number;
            effectiveFrom?: Date;
            effectiveTo?: Date | null;
            description?: string;
        }
    ): Promise<StatutoryRate> {
        const rate = await this.db.get<StatutoryRate>('statutory_rates').find(id);
        const now = new Date();
        await this.db.write(async () => {
            await rate.update(r => {
                if (input.rateType !== undefined) r.rateType = input.rateType.toLowerCase();
                if (input.bracketMin !== undefined) r.bracketMin = input.bracketMin;
                if (input.bracketMax !== undefined) r.bracketMax = input.bracketMax;
                if (input.employeeShare !== undefined) r.employeeShare = input.employeeShare;
                if (input.employerShare !== undefined) r.employerShare = input.employerShare;
                if (input.effectiveFrom !== undefined) r.effectiveFrom = input.effectiveFrom;
                if (input.effectiveTo !== undefined) r.effectiveTo = input.effectiveTo;
                if (input.description !== undefined) r.description = input.description?.trim() || null;
                r.updatedAt = now;
            });
        });
        return rate;
    }

    async deleteStatutoryRate(id: string): Promise<void> {
        const rate = await this.db.get<StatutoryRate>('statutory_rates').find(id);
        await this.db.write(async () => {
            await rate.update(r => {
                r.deletedAt = new Date();
            });
        });
    }

    // =========================================================================
    // SUPPLIERS & VENDORS
    // =========================================================================
    async getSuppliers(includeInactive = true): Promise<Supplier[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', null)];
        if (!includeInactive) {
            clauses.push(Q.where('is_active', true));
        }
        clauses.push(Q.sortBy('name', Q.asc));
        return this.db.get<Supplier>('suppliers').query(...clauses).fetch();
    }

    async createSupplier(input: {
        name: string;
        contactPerson?: string;
        phone?: string;
        email?: string;
        address?: string;
        tin?: string;
        paymentTermsDays?: number;
    }): Promise<Supplier> {
        let supplier!: Supplier;
        const now = new Date();
        await this.db.write(async () => {
            supplier = await this.db.get<Supplier>('suppliers').create(s => {
                (s as any)._raw.id = uuid.v4().toString();
                s.name = input.name.trim();
                s.contactPerson = input.contactPerson?.trim() || null;
                s.phone = input.phone?.trim() || null;
                s.email = input.email?.trim() || null;
                s.address = input.address?.trim() || null;
                s.tin = input.tin?.trim() || null;
                s.paymentTermsDays = input.paymentTermsDays ?? 30;
                s.isActive = true;
                s.createdAt = now;
                s.updatedAt = now;
                s.deletedAt = null;
            });
        });
        return supplier;
    }

    async updateSupplier(
        id: string,
        input: {
            name?: string;
            contactPerson?: string;
            phone?: string;
            email?: string;
            address?: string;
            tin?: string;
            paymentTermsDays?: number;
            isActive?: boolean;
        }
    ): Promise<Supplier> {
        const supplier = await this.db.get<Supplier>('suppliers').find(id);
        const now = new Date();
        await this.db.write(async () => {
            await supplier.update(s => {
                if (input.name !== undefined) s.name = input.name.trim();
                if (input.contactPerson !== undefined) s.contactPerson = input.contactPerson?.trim() || null;
                if (input.phone !== undefined) s.phone = input.phone?.trim() || null;
                if (input.email !== undefined) s.email = input.email?.trim() || null;
                if (input.address !== undefined) s.address = input.address?.trim() || null;
                if (input.tin !== undefined) s.tin = input.tin?.trim() || null;
                if (input.paymentTermsDays !== undefined) s.paymentTermsDays = input.paymentTermsDays;
                if (input.isActive !== undefined) s.isActive = input.isActive;
                s.updatedAt = now;
            });
        });
        return supplier;
    }

    async toggleSupplierActive(id: string): Promise<Supplier> {
        const supplier = await this.db.get<Supplier>('suppliers').find(id);
        return this.updateSupplier(id, { isActive: !supplier.isActive });
    }
}

export const MasterDataService = new MasterDataServiceClass();
export default MasterDataService;
