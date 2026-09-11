import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class CollectionLog extends Model {
    static table = 'collection_logs'

    @field('collector_id') collectorId: string;
    @date('log_date') logDate: number;
    @field('total_collected') totalCollected: number;
    @field('cash_on_hand_start') cashOnHandStart: number;
    @field('cash_on_hand_end') cashOnHandEnd: number;
    @field('notes') notes: string;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
