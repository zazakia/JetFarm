import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class WsContainer extends Model {
    static table = 'ws_containers'

    @field('customer_id') customerId!: string
    @field('container_type') containerType!: string // slim | round
    @field('quantity_owned') quantityOwned!: number
    @field('quantity_loaned') quantityLoaned!: number

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
