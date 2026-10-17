import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/** Durable LOCAL-only outbox. Payloads are immutable, even after acknowledgement. */
export default class AgriPendingLayoutOperation extends Model {
    static table = 'agri_pending_layout_operations'

    @readonly @field('operation_id') operationId!: string
    @readonly @field('parcel_id') parcelId!: string
    @readonly @field('expected_revision') expectedRevision!: number
    @readonly @field('payload_json') payloadJson!: string
    @readonly @field('created_by') createdBy!: string
    @field('state') state!: 'queued' | 'acknowledged'

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
}
