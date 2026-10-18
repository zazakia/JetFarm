import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class FeatureFlag extends Model {
    static table = 'feature_flags'

    @field('key') key!: string;
    @field('label') label!: string;
    @field('description') description!: string;
    @field('category') category!: string;
    @field('enabled') enabled!: boolean;
    @field('sort_order') sortOrder!: number;
    @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
