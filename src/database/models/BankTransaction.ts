import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export default class BankTransaction extends Model {
    static table = 'bank_transactions'

    @relation('bank_accounts', 'bank_account_id') bankAccount: any;
    @field('bank_account_id') bankAccountId: string;
    @date('transaction_date') transactionDate: number;
    @field('type') type: string; // 'deposit' | 'withdrawal' | 'interest' | 'fee'
    @field('amount') amount: number;
    @field('particulars') particulars: string;
    @field('remarks') remarks: string;
    @field('is_cleared') isCleared?: boolean;
    @date('cleared_at') clearedAt?: number | null;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
