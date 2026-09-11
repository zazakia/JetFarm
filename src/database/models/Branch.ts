import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

export default class Branch extends Model {
    static table = 'branches';

    @field('name') name!: string;
    @field('code') code?: string;
    @field('is_hq') isHq?: boolean;
    @field('is_active') isActive?: boolean;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt?: number;

    @children('warehouses') warehouses!: any;
    @children('business_units') businessUnits!: any;
    @children('user_branch_roles') userBranchRoles!: any;
}
