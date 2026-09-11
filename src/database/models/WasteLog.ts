import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class WasteLog extends Model {
    static table = 'waste_logs';

    @field('branch_id') branchId!: string;
    @field('product_id') productId!: string;
    @field('product_name') productName!: string | null;
    @field('quantity') quantity!: number;
    @field('uom') uom!: string;
    /** damaged | expired | burnt_overcooked | spilled_dropped | contamination | bad_order */
    @field('reason') reason!: string;
    @field('unit_cost') unitCost!: number;
    @field('total_cost') totalCost!: number;
    @field('recorded_by') recordedBy!: string | null;
    @field('notes') notes!: string | null;
    @field('photo_uri') photoUri!: string | null;
    /** logged | approved | investigating */
    @field('status') status!: string;
    @date('log_date') logDate!: Date;
    @field('journal_entry_id') journalEntryId!: string | null;
    @field('stock_movement_id') stockMovementId!: string | null;

    @date('created_at') createdAt!: Date;
    @date('updated_at') updatedAt!: Date;
    @date('deleted_at') deletedAt!: Date | null;
}
