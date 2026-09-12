import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriInvestor extends Model {
    static table = 'agri_investors'

    @field('user_id') userId!: string | null
    @field('company_name') companyName!: string
    @field('contact_person') contactPerson!: string | null
    @field('contact_number') contactNumber!: string | null
    @field('email') email!: string | null
    @field('default_offtake_price_per_kg') defaultOfftakePricePerKg!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
