import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class Supplier extends Model {
    static table = 'suppliers'

    @field('name') name!: string
    @field('contact_person') contactPerson!: string | null
    @field('phone') phone!: string | null
    @field('email') email!: string | null
    @field('address') address!: string | null
    @field('tin') tin!: string | null
    @field('payment_terms_days') paymentTermsDays!: number | null
    @field('is_active') isActive!: boolean | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
