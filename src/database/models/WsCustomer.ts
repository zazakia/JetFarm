import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class WsCustomer extends Model {
    static table = 'ws_customers'

    @field('name') name!: string
    @field('phone') phone!: string | null
    @field('address') address!: string | null
    @field('is_member') isMember!: boolean
    @field('member_id') memberId!: string | null
    @field('is_active') isActive!: boolean

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
