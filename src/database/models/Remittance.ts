import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Remittance extends Model {
    static table = 'remittances'

    @field('collector_id') collectorId: string;
    @field('amount') amount: number;
    @date('remittance_date') remittanceDate: number;
    @field('status') status: string; // pending, approved, rejected
    @field('approved_by') approvedBy: string;
    @field('notes') notes: string;

    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
