import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class FranchiseContract extends Model {
    static table = 'franchise_contracts'

    @field('branch_id') branchId!: string
    @field('branch_name') branchName!: string
    @field('owner_name') ownerName!: string
    @field('owner_phone') ownerPhone!: string | null
    @field('owner_email') ownerEmail!: string | null
    @field('territory') territory!: string | null
    @date('contract_start') contractStart!: Date
    @date('contract_end') contractEnd!: Date | null
    @date('renewal_date') renewalDate!: Date | null
    @field('royalty_pct') royaltyPct!: number
    @field('franchise_fee') franchiseFee!: number
    /** active | suspended | terminated | expired | pending_renewal */
    @field('status') status!: string
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
