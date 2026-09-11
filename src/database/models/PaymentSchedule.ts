import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export default class PaymentSchedule extends Model {
    static table = 'payment_schedules'

    @relation('loans', 'loan_id') loan: any;
    @field('loan_id') loanId: string;
    @date('due_date') dueDate: Date | number;
    @field('scheduled_amount') scheduledAmount: number;
    @field('principal_amount') principalAmount: number;
    @field('interest_amount') interestAmount: number;
    @field('fees_amount') feesAmount: number;
    @field('status') status: string; // 'pending' | 'paid' | 'partial' | 'late'
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
