import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriLandOwner extends Model {
    static table = 'agri_land_owners'

    @field('user_id') userId!: string | null
    @field('name') name!: string
    @field('contact_number') contactNumber!: string | null
    @field('bank_name') bankName!: string | null
    @field('account_number') accountNumber!: string | null
    @field('default_per_kilo_rate') defaultPerKiloRate!: number
    @field('default_guaranteed_minimum') defaultGuaranteedMinimum!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
