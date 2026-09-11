import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export default class LoanPenalty extends Model {
    static table = 'loan_penalties'

    @relation('loans', 'loan_id') loan: any;
    @field('loan_id') loanId: string;
    @field('amount') amount: number;
    @date('penalty_date') penaltyDate: number;
    @field('reason') reason: string;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
