import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../../../database';
import WsCustomer from '../../../database/models/WsCustomer';
import ActionLogService from '../../../services/ActionLogService';

export interface WsCustomerInput {
    name: string;
    phone?: string;
    address?: string;
    isMember: boolean;
    memberId?: string;
}

export class WsCustomerServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getAll(): Promise<WsCustomer[]> {
        return await this.db.collections.get<WsCustomer>('ws_customers').query(
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
    }

    async getById(id: string): Promise<WsCustomer | null> {
        try {
            return await this.db.collections.get<WsCustomer>('ws_customers').find(id);
        } catch {
            return null;
        }
    }

    async create(input: WsCustomerInput, performedBy?: string): Promise<WsCustomer> {
        let customer!: WsCustomer;
        await this.db.write(async () => {
            customer = await this.db.get<WsCustomer>('ws_customers').create(record => {
                record.name = input.name;
                record.phone = input.phone ?? null;
                record.address = input.address ?? null;
                record.isMember = input.isMember;
                record.memberId = input.memberId ?? null;
                record.isActive = true;
            });
        });

        await ActionLogService.logAction({
            entityType: 'ws_customers',
            entityId: customer.id,
            action: 'CREATE',
            newData: customer._raw,
            performedBy
        });

        return customer;
    }

    async update(id: string, input: Partial<WsCustomerInput>, performedBy?: string): Promise<WsCustomer> {
        const customer = await this.getById(id);
        if (!customer) throw new Error(`Customer with ID ${id} not found.`);

        await this.db.write(async () => {
            await customer.update(record => {
                if (input.name !== undefined) record.name = input.name;
                if (input.phone !== undefined) record.phone = input.phone ?? null;
                if (input.address !== undefined) record.address = input.address ?? null;
                if (input.isMember !== undefined) record.isMember = input.isMember;
                if (input.memberId !== undefined) record.memberId = input.memberId ?? null;
            });
        });

        await ActionLogService.logAction({
            entityType: 'ws_customers',
            entityId: customer.id,
            action: 'UPDATE',
            newData: customer._raw,
            performedBy
        });

        return customer;
    }

    async delete(id: string, performedBy?: string): Promise<void> {
        const customer = await this.getById(id);
        if (!customer) throw new Error(`Customer with ID ${id} not found.`);

        await this.db.write(async () => {
            await customer.update(record => {
                record.deletedAt = new Date();
            });
        });

        await ActionLogService.logAction({
            entityType: 'ws_customers',
            entityId: customer.id,
            action: 'DELETE',
            oldData: customer._raw,
            performedBy
        });
    }
}

export const WsCustomerService = new WsCustomerServiceClass();
export default WsCustomerService;
