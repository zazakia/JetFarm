/**
 * MarketplaceSalesPostingService
 *
 * Auto-posts journal entries for marketplace sales transactions.
 *
 * On order confirmed (credit sale):
 *   DR: 1500 Other Receivables
 *   CR: 4130 Sales Revenue — Marketplace
 *
 * On payment received:
 *   DR: 1010 Cash on Hand
 *   CR: 1500 Other Receivables
 */

import { Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import { JournalEntryServiceClass } from './JournalEntryService';

const ACCT = {
    OTHER_RECEIVABLES: '1500',
    CASH_ON_HAND: '1010',
    MARKETPLACE_SALES_REVENUE: '4130',
};

export class MarketplaceSalesPostingServiceClass {
    private db: Database;
    private journalEntryService: JournalEntryServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.journalEntryService = new JournalEntryServiceClass(db);
    }

    /**
     * Post a credit sale entry when a marketplace order is confirmed.
     * DR: 1500 Other Receivables
     * CR: 4130 Sales Revenue — Marketplace
     */
    async postSale(opts: {
        orderId: string;
        orderNumber: string;
        buyerName?: string;
        totalAmount: number;
        orderDate: Date;
        postedBy?: string;
    }): Promise<void> {
        if (opts.totalAmount <= 0) return;

        await this.journalEntryService.createEntry({
            entryDate: opts.orderDate,
            description: `Marketplace Sale — Order #${opts.orderNumber}${opts.buyerName ? ` (${opts.buyerName})` : ''}`,
            entryType: 'auto',
            sourceTable: 'marketplace_orders',
            sourceId: opts.orderId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.OTHER_RECEIVABLES,
                    accountName: 'Other Receivables',
                    debitAmount: opts.totalAmount,
                    description: `Receivable from Order #${opts.orderNumber}`,
                },
                {
                    accountCode: ACCT.MARKETPLACE_SALES_REVENUE,
                    accountName: 'Marketplace Sales Revenue',
                    creditAmount: opts.totalAmount,
                    description: 'Sales revenue recorded',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post the collection of payment when order payment_status = paid.
     * DR: 1010 Cash on Hand
     * CR: 1500 Other Receivables
     */
    async postPaymentReceived(opts: {
        orderId: string;
        orderNumber: string;
        totalAmount: number;
        paymentDate: Date;
        postedBy?: string;
    }): Promise<void> {
        if (opts.totalAmount <= 0) return;

        await this.journalEntryService.createEntry({
            entryDate: opts.paymentDate,
            description: `Marketplace Payment Received — Order #${opts.orderNumber}`,
            entryType: 'auto',
            sourceTable: 'marketplace_orders',
            sourceId: opts.orderId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.CASH_ON_HAND,
                    accountName: 'Cash on Hand',
                    debitAmount: opts.totalAmount,
                    description: 'Cash collected from marketplace sale',
                },
                {
                    accountCode: ACCT.OTHER_RECEIVABLES,
                    accountName: 'Other Receivables',
                    creditAmount: opts.totalAmount,
                    description: `AR cleared for Order #${opts.orderNumber}`,
                },
            ],
        }, opts.postedBy);
    }
}

const instance = new MarketplaceSalesPostingServiceClass();
export { instance as MarketplaceSalesPostingService };
export default instance;
