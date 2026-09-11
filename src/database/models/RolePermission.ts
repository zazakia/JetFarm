import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class RolePermission extends Model {
    static table = 'role_permissions'

    @field('role') role: string;
    @field('permission_key') permissionKey: string;
    @field('label') label: string;
    @field('category') category: string;
    @field('enabled') enabled: boolean;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
