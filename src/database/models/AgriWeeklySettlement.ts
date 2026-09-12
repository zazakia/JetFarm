import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriWeeklySettlement extends Model {
    static table = 'agri_weekly_settlements'

    @field('crop_cycle_id') cropCycleId!: string
    @field('land_owner_id') landOwnerId!: string
    @field('week_number') weekNumber!: number
    @date('week_start_date') weekStartDate!: Date
    @date('week_end_date') weekEndDate!: Date
    @field('cumulative_kilos') cumulativeKilos!: number
    @field('rate_per_kilo') ratePerKilo!: number
    @field('raw_kilo_earnings') rawKiloEarnings!: number
    @field('guaranteed_minimum') guaranteedMinimum!: number
    @field('target_cumulative_payout') targetCumulativePayout!: number
    @field('previous_cumulative_payout') previousCumulativePayout!: number
    @field('net_payout_due_this_week') netPayoutDueThisWeek!: number
    @field('payment_status') paymentStatus!: string // draft, approved, paid
    @date('disbursement_date') disbursementDate!: Date | null
    @field('receipt_reference') receiptReference!: string | null
    @field('calculation_breakdown_json') calculationBreakdownJson!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
