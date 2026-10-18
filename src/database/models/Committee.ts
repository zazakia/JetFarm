import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Committee extends Model {
    static table = 'committees'

    @field('name') name!: string;
    @field('type') type!: string | null;
    @field('is_active') isActive!: boolean | null;

    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
