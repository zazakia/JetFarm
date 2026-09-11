import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplacePayout extends Model {
    static table = 'marketplace_payouts'

    @field('store_id') storeId: string;
    @field('payout_number') payoutNumber: string;
    @field('gross_sales') grossSales: number;
    @field('commission_deducted') commissionDeducted: number;
    @field('net_amount') netAmount: number;
    @field('destination') destination: string;
    @field('status') status: string;
    @field('gl_journal_id') glJournalId: string | null;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
