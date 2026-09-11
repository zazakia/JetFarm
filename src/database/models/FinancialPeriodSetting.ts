import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class FinancialPeriodSetting extends Model {
    static table = 'financial_period_settings'

    @field('fiscal_year') fiscalYear!: number
    @field('authorized_share_capital') authorizedShareCapital!: number
    @field('subscribed_capital') subscribedCapital!: number
    @field('subscription_receivable') subscriptionReceivable!: number
    @field('sundry_assets') sundryAssets!: number
    @field('prior_year_data') priorYearData!: string // JSON string of all comparative figures

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
