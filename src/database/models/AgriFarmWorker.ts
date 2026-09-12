import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriFarmWorker extends Model {
    static table = 'agri_farm_workers'

    @field('name') name!: string
    @field('contact_number') contactNumber!: string | null
    @field('specialization') specialization!: string | null
    @field('daily_rate') dailyRate!: number
    @field('status') status!: string // active, inactive

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
