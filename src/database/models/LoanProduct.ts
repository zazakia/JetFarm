import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class LoanProduct extends Model {
    static table = 'loan_products'

    @field('product_type') productType!: string;
    @field('label') label!: string;
    @field('description') description!: string;
    @field('default_rate_percent') defaultRatePercent!: number;
    @field('default_term') defaultTerm!: number;
    @field('default_term_unit') defaultTermUnit!: string;
    @field('default_frequency') defaultFrequency!: string;
    @field('default_processing_fee_rate') defaultProcessingFeeRate!: number;
    @field('default_processing_fee_flat') defaultProcessingFeeFlat!: number;
    @field('default_notarial_fee') defaultNotarialFee!: number;
    @field('notarial_fee_threshold') notarialFeeThreshold!: number;
    @field('notarial_fee_above_threshold') notarialFeeAboveThreshold!: number;
    @field('default_savings_per_payment') defaultSavingsPerPayment!: number;
    @field('default_principal') defaultPrincipal!: number;
    @field('max_principal') maxPrincipal!: number;
    @field('min_term_months') minTermMonths!: number;
    @field('max_term_months') maxTermMonths!: number;
    @field('is_active') isActive!: boolean;
    @field('sort_order') sortOrder!: number;
    @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
