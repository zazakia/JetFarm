import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export interface DispatchItem {
    productId: string;
    productName: string;
    quantityExpected: number;
    uom: string;
    unitCost: number;
    quantityReceived?: number;
    variance?: number;
    notes?: string;
}

export default class CommissaryDispatch extends Model {
    static table = 'commissary_dispatches';

    @field('from_location') fromLocation!: string;
    @field('to_branch_id') toBranchId!: string;
    @field('dispatch_number') dispatchNumber!: string;
    @field('po_reference') poReference!: string | null;
    /** draft | in_transit | received | verified | disputed */
    @field('status') status!: string;
    @field('items_json') itemsJson!: string;
    @field('total_amount') totalAmount!: number;
    @field('dispatched_by') dispatchedBy!: string | null;
    @date('dispatched_at') dispatchedAt!: Date | null;
    @field('received_by') receivedBy!: string | null;
    @date('received_at') receivedAt!: Date | null;
    @field('verified_by') verifiedBy!: string | null;
    @date('verified_at') verifiedAt!: Date | null;
    @field('notes') notes!: string | null;

    @date('created_at') createdAt!: Date;
    @date('updated_at') updatedAt!: Date;
    @date('deleted_at') deletedAt!: Date | null;

    get items(): DispatchItem[] {
        try {
            return JSON.parse(this.itemsJson || '[]');
        } catch {
            return [];
        }
    }
}
