import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class PosSession extends Model {
    static table = 'pos_sessions';

    @field('branch_id') branchId!: string;
    @field('cashier_id') cashierId!: string;
    @field('terminal_id') terminalId?: string;
    @date('opened_at') openedAt!: Date;
    @date('closed_at') closedAt?: Date;
    @field('opening_float') openingFloat!: number;
    @field('closing_cash_expected') closingCashExpected?: number;
    @field('closing_cash_actual') closingCashActual?: number;
    @field('variance_amount') varianceAmount?: number;
    /** 'open' | 'closed' | 'audited' */
    @field('status') status!: string;
    @field('notes') notes?: string;

    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;
    @date('deleted_at') deletedAt?: Date;
}
