import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class UserBranchRole extends Model {
    static table = 'user_branch_roles';

    @field('user_id') userId!: string;
    @field('branch_id') branchId!: string;
    @field('role') role!: string;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt?: number;

    @relation('user_profiles', 'user_id') userProfile!: any;
    @relation('branches', 'branch_id') branch!: any;
}
