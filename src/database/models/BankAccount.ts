import { Model } from '@nozbe/watermelondb'
import { field, date, children } from '@nozbe/watermelondb/decorators'
import { EncryptionService } from '../../services/EncryptionService'

export default class BankAccount extends Model {
    static table = 'bank_accounts'

    @field('bank_name') bankName: string;
    @field('account_name') accountName: string;
    @field('account_number') accountNumber: string;
    @field('starting_balance') startingBalance: number;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;

    @children('bank_transactions') transactions: any;

    get decryptedAccountName(): string | null {
        return EncryptionService.decrypt(this.accountName);
    }

    get decryptedAccountNumber(): string | null {
        return EncryptionService.decrypt(this.accountNumber);
    }
}
