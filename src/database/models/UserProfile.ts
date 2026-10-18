import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class UserProfile extends Model {
    static table = 'user_profiles'

    @field('full_name') fullName!: string;
    @field('email') email!: string;
    @field('role') role!: string;
    @field('is_active') isActive!: boolean;
    @field('branch_id') branchId?: string;
    @field('area_id') areaId?: string;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt?: number;
}
