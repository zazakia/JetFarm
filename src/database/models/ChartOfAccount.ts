import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class ChartOfAccount extends Model {
    static table = 'chart_of_accounts'

    @field('code') code!: string
    @field('name') name!: string
    /** asset | liability | equity | income | expense */
    @field('account_type') accountType!: string
    /** debit | credit */
    @field('normal_balance') normalBalance!: string
    @field('parent_code') parentCode!: string | null
    @field('is_header') isHeader!: boolean
    @field('is_active') isActive!: boolean
    @field('description') description!: string | null
    @field('sort_order') sortOrder!: number | null

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
