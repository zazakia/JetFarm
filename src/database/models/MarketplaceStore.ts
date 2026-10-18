import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceStore extends Model {
    static table = 'marketplace_stores'

    @field('borrower_id') borrowerId!: string;
    @field('name') name!: string;
    @field('slug') slug!: string;
    @field('logo_url') logoUrl!: string | null;
    @field('banner_url') bannerUrl!: string | null;
    @field('description') description!: string | null;
    @field('category') category!: string | null;
    @field('status') status!: string;
    @field('holiday_mode') holidayMode!: boolean;
    @field('rating') rating!: number;
    @field('commission_tier') commissionTier!: string | null;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
