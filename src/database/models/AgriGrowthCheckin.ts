import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriGrowthCheckin extends Model {
    static table = 'agri_growth_checkins'

    @field('crop_cycle_id') cropCycleId!: string
    @date('checkin_date') checkinDate!: Date
    @field('stage') stage!: string // land_prep, germination, vegetative, root_bulking, maturity
    @field('plant_height_cm') plantHeightCm!: number | null
    @field('health_status') healthStatus!: string // excellent, good, fair, pest_risk, diseased
    @field('notes') notes!: string | null
    @field('photo_uri') photoUri!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
