import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class StatutoryRate extends Model {
    static table = 'statutory_rates'

    /** sss | philhealth | pagibig | tax */
    @field('rate_type') rateType!: string
    @field('bracket_min') bracketMin!: number
    @field('bracket_max') bracketMax!: number | null
    @field('employee_share') employeeShare!: number
    @field('employer_share') employerShare!: number
    @date('effective_from') effectiveFrom!: Date
    @date('effective_to') effectiveTo!: Date | null
    @field('description') description!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
