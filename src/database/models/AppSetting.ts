import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AppSetting extends Model {
    static table = 'app_settings'

    @field('key') key: string;
    @field('value') value: string;
    @field('value_type') valueType: string;
    @field('scope') scope: string;
    @field('is_active') isActive: boolean;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
