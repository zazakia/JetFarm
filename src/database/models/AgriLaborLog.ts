import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriLaborLog extends Model {
    static table = 'agri_labor_logs'

    @field('worker_id') workerId!: string
    @field('crop_cycle_id') cropCycleId!: string | null
    @date('work_date') workDate!: Date
    @field('task') task!: string
    @field('rate_type') rateType!: string // daily, piece_rate
    @field('units_completed') unitsCompleted!: number
    @field('rate_per_unit') ratePerUnit!: number
    @field('total_pay') totalPay!: number
    @field('payment_status') paymentStatus!: string // pending, paid
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
