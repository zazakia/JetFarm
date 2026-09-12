import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriInvestorLedger extends Model {
    static table = 'agri_investor_ledgers'

    @field('investor_id') investorId!: string
    @field('crop_cycle_id') cropCycleId!: string | null
    @date('transaction_date') transactionDate!: Date
    @field('type') type!: string // capital_injection, equipment_provision, harvest_offtake, payout_refund
    @field('kilos_received') kilosReceived!: number | null
    @field('price_per_kilo') pricePerKilo!: number | null
    @field('amount') amount!: number
    @field('balance_running') balanceRunning!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
