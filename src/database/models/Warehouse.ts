import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class Warehouse extends Model {
    static table = 'warehouses';

    @field('branch_id') branchId!: string;
    @field('name') name!: string;
    @field('type') type?: string; // 'store' | 'transit' | 'commissary' | 'quarantine'
    @field('is_active') isActive?: boolean;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt?: number;

    @relation('branches', 'branch_id') branch!: any;
}
