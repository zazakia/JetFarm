import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Collector extends Model {
    static table = 'collectors'

    @field('full_name') fullName!: string;
    @field('auth_id') authId!: string;
    @field('is_active') isActive!: boolean;
    @field('commission_rate') commissionRate!: number;
    @field('member_id') memberId!: string;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number;
}
