import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../../../database';
import WsContainer from '../../../database/models/WsContainer';
import ActionLogService from '../../../services/ActionLogService';

export class WsInventoryServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getByCustomer(customerId: string): Promise<WsContainer[]> {
        return await this.db.collections.get<WsContainer>('ws_containers').query(
            Q.where('customer_id', customerId),
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
    }

    async updateContainerStock(
        customerId: string,
        containerType: string, // slim | round
        quantityOwned: number,
        quantityLoaned: number,
        performedBy?: string
    ): Promise<WsContainer> {
        const existing = await this.db.collections.get<WsContainer>('ws_containers').query(
            Q.where('customer_id', customerId),
            Q.where('container_type', containerType),
            Q.where('deleted_at', Q.eq(null))
        ).fetch();

        let record: WsContainer;

        if (existing.length > 0) {
            record = existing[0];
            await this.db.write(async () => {
                await record.update(r => {
                    r.quantityOwned = quantityOwned;
                    r.quantityLoaned = quantityLoaned;
                });
            });
            await ActionLogService.logAction({
                entityType: 'ws_containers',
                entityId: record.id,
                action: 'UPDATE',
                newData: record._raw,
                performedBy
            });
        } else {
            await this.db.write(async () => {
                record = await this.db.get<WsContainer>('ws_containers').create(r => {
                    r.customerId = customerId;
                    r.containerType = containerType;
                    r.quantityOwned = quantityOwned;
                    r.quantityLoaned = quantityLoaned;
                });
            });
            await ActionLogService.logAction({
                entityType: 'ws_containers',
                entityId: record!.id,
                action: 'CREATE',
                newData: record!._raw,
                performedBy
            });
        }

        return record!;
    }
}

export const WsInventoryService = new WsInventoryServiceClass();
export default WsInventoryService;
