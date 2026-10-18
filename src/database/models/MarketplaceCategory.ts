import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceCategory extends Model {
    static table = 'marketplace_categories'

    @field('name') name!: string;
    @field('slug') slug!: string;
    @field('icon') icon!: string | null;
    @field('parent_id') parentId!: string | null;
    @field('is_active') isActive!: boolean;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
