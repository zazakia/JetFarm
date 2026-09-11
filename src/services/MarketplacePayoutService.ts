import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import MarketplaceSubOrder from '../database/models/MarketplaceSubOrder';
import MarketplacePayout from '../database/models/MarketplacePayout';
import MarketplaceStore from '../database/models/MarketplaceStore';
import SavingsTransaction from '../database/models/SavingsTransaction';
import ActionLogService from './ActionLogService';

export interface PayoutSummary {
    storeId: string;
    pendingSubOrdersCount: number;
    grossSales: number;
    commissionDeducted: number;
    netAmount: number;
    eligibleCashAdvanceAmount: number; // e.g. 70% of pending net payout
}

export class MarketplacePayoutService {
    /**
     * Get real-time seller payout summary and cash advance eligibility
     */
    static async getStorePayoutSummary(storeId: string): Promise<PayoutSummary> {
        const pendingSubOrders = await database.get<MarketplaceSubOrder>('marketplace_sub_orders')
            .query(
                Q.where('store_id', storeId),
                Q.where('payout_status', 'pending'),
                Q.where('fulfillment_status', 'completed'),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        let grossSales = 0;
        let commissionDeducted = 0;
        let netAmount = 0;

        for (const so of pendingSubOrders) {
            grossSales += so.subtotal;
            commissionDeducted += so.commissionAmount;
            netAmount += so.netPayout;
        }

        const eligibleCashAdvanceAmount = Math.round(netAmount * 0.70 * 100) / 100; // 70% max draw

        return {
            storeId,
            pendingSubOrdersCount: pendingSubOrders.length,
            grossSales: Math.round(grossSales * 100) / 100,
            commissionDeducted: Math.round(commissionDeducted * 100) / 100,
            netAmount: Math.round(netAmount * 100) / 100,
            eligibleCashAdvanceAmount,
        };
    }

    /**
     * Process batch payout to seller's Coop Savings account
     */
    static async processPayout(storeId: string, destination: 'savings_wallet' | 'bank_account' = 'savings_wallet'): Promise<MarketplacePayout> {
        const store = await database.get<MarketplaceStore>('marketplace_stores').find(storeId);
        const summary = await this.getStorePayoutSummary(storeId);

        if (summary.pendingSubOrdersCount === 0 || summary.netAmount <= 0) {
            throw new Error('No pending completed sub-orders available for payout');
        }

        const now = Date.now();
        const payoutNumber = `PO-${now.toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        let createdPayout: MarketplacePayout;

        await database.write(async () => {
            // 1. Create Payout Record
            createdPayout = await database.get<MarketplacePayout>('marketplace_payouts').create(po => {
                po.storeId = storeId;
                po.payoutNumber = payoutNumber;
                po.grossSales = summary.grossSales;
                po.commissionDeducted = summary.commissionDeducted;
                po.netAmount = summary.netAmount;
                po.destination = destination;
                po.status = 'processed';
                po.glJournalId = `GL-PO-${payoutNumber}`;
            });

            // 2. Update SubOrders payout_status to 'paid'
            const pendingSubOrders = await database.get<MarketplaceSubOrder>('marketplace_sub_orders')
                .query(
                    Q.where('store_id', storeId),
                    Q.where('payout_status', 'pending'),
                    Q.where('fulfillment_status', 'completed'),
                    Q.where('deleted_at', Q.eq(null))
                )
                .fetch();

            for (const so of pendingSubOrders) {
                await so.update(s => {
                    s.payoutStatus = 'paid';
                });
            }

            // 3. Deposit net payout directly into Member's Coop Savings Account if destination === 'savings_wallet'
            if (destination === 'savings_wallet' && store.borrowerId) {
                await database.get<SavingsTransaction>('savings_transactions').create(st => {
                    st.borrowerId = store.borrowerId;
                    st.type = 'deposit';
                    st.amount = summary.netAmount;
                    st.date = now;
                    st.notes = `Marketplace Store Payout (${payoutNumber})`;
                });
            }
        });

        await ActionLogService.logAction({
            entityType: 'marketplace_payouts',
            entityId: createdPayout!.id,
            action: 'CREATE',
            newData: { payoutNumber, netAmount: summary.netAmount, grossSales: summary.grossSales, commission: summary.commissionDeducted },
        });

        return createdPayout!;
    }

    static async fetchStorePayouts(storeId: string): Promise<MarketplacePayout[]> {
        return await database.get<MarketplacePayout>('marketplace_payouts')
            .query(Q.where('store_id', storeId), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }
}

export default MarketplacePayoutService;
