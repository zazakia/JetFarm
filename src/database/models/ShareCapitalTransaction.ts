import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'

export default class ShareCapitalTransaction extends Model {
    static table = 'share_capital_transactions'

    @relation('borrowers', 'member_id') member: any;
    @field('member_id') memberId: string;
    @field('transaction_type') transactionType: string;
    @field('share_type') shareType: string | null;
    @field('number_of_shares') numberOfShares: number | null;
    @field('par_value') parValue: number | null;
    @field('amount') amount: number;
    @field('running_balance_shares') runningBalanceShares: number | null;
    @field('running_balance_amount') runningBalanceAmount: number | null;
    @field('reference_number') referenceNumber: string | null;
    @date('date') transactionDate: number;
    @field('notes') notes: string | null;
    @field('recorded_by') recordedBy: string | null;

    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
