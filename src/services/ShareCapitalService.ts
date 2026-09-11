import { database } from '../database';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
import { Q } from '@nozbe/watermelondb';
import Borrower from '../database/models/Borrower';
import { AutoPostingService } from './AutoPostingService';
import ActionLogService from './ActionLogService';

export class ShareCapitalService {
    /**
     * Subscribe to shares
     * @param memberId Borrower/Member ID
     * @param shareType 'COMMON' | 'PREFERRED'
     * @param amount Amount to subscribe
     * @param numberOfShares Number of shares (amount / parValue)
     * @param parValue Par value of the share
     * @param recordedBy User ID who recorded the transaction
     */
    static async subscribe(
        memberId: string,
        shareType: string,
        amount: number,
        numberOfShares: number,
        parValue: number,
        recordedBy: string,
        memberName?: string
    ): Promise<ShareCapitalTransaction> {
        const transaction = await database.write(async () => {
            const runningBalance = await this.getCurrentBalance(memberId);
            const newAmountBalance = runningBalance.amount + amount;
            const newSharesBalance = runningBalance.shares + numberOfShares;

            return await database.get<ShareCapitalTransaction>('share_capital_transactions').create(
                (tx: ShareCapitalTransaction) => {
                    tx.memberId = memberId;
                    tx.transactionType = 'SUBSCRIPTION';
                    tx.shareType = shareType;
                    tx.amount = amount;
                    tx.numberOfShares = numberOfShares;
                    tx.parValue = parValue;
                    tx.transactionDate = Date.now();
                    tx.runningBalanceAmount = newAmountBalance;
                    tx.runningBalanceShares = newSharesBalance;
                    tx.recordedBy = recordedBy;
                }
            );
        });

        // Auto-post to accounting: DR Cash on Hand / CR Share Capital
        try {
            await AutoPostingService.postShareCapital({
                transactionId: transaction.id,
                amount,
                entryDate: new Date(transaction.transactionDate),
                memberName,
                postedBy: recordedBy,
            });
        } catch (e) {
            console.warn('[ShareCapitalService] Auto-posting failed (subscribe):', e);
        }

        return transaction;
    }

    /**
     * Pay for share subscription (Capital Build-Up / CBU)
     * @param memberId Borrower/Member ID
     * @param amount Amount paid
     * @param recordedBy User ID who recorded the transaction
     */
    static async deposit(
        memberId: string,
        amount: number,
        recordedBy: string,
        memberName?: string
    ): Promise<ShareCapitalTransaction> {
        // Duplicate guard: reject if an identical deposit (same member + amount) exists within the last 60 seconds
        const recentCutoff = Date.now() - 60_000;
        const existing = await database
            .get<ShareCapitalTransaction>('share_capital_transactions')
            .query(
                Q.where('member_id', memberId),
                Q.where('transaction_type', 'DEPOSIT'),
                Q.where('amount', amount),
                Q.where('deleted_at', null),
                Q.where('date', Q.gte(recentCutoff))
            )
            .fetch();
        if (existing.length > 0) {
            throw new Error('[ShareCapitalService] Duplicate CBU deposit detected. Please wait before submitting again.');
        }

        const transaction = await database.write(async () => {
            const runningBalance = await this.getCurrentBalance(memberId);
            const newAmountBalance = runningBalance.amount + amount;

            return await database.get<ShareCapitalTransaction>('share_capital_transactions').create(
                (tx: ShareCapitalTransaction) => {
                    tx.memberId = memberId;
                    tx.transactionType = 'DEPOSIT';
                    tx.amount = amount;
                    tx.transactionDate = Date.now();
                    tx.runningBalanceAmount = newAmountBalance;
                    tx.runningBalanceShares = runningBalance.shares; // Shares don't increase with partial payment until fully paid per share, depending on policy.
                    tx.recordedBy = recordedBy;
                }
            );
        });

        // Auto-post to accounting: DR Cash on Hand / CR Share Capital
        try {
            await AutoPostingService.postShareCapital({
                transactionId: transaction.id,
                amount,
                entryDate: new Date(transaction.transactionDate),
                memberName,
                postedBy: recordedBy,
            });
        } catch (e) {
            console.warn('[ShareCapitalService] Auto-posting failed (deposit):', e);
        }

        return transaction;
    }

    /**
     * Get current share capital balance
     * @param memberId Borrower/Member ID
     */
    static async getCurrentBalance(memberId: string): Promise<{ amount: number; shares: number }> {
        const transactions = await database
            .get<ShareCapitalTransaction>('share_capital_transactions')
            .query(
                Q.where('member_id', memberId),
                Q.where('deleted_at', null),
                Q.sortBy('date', Q.desc)
            )
            .fetch();

        if (transactions.length > 0) {
            const latest = transactions[0];
            if (latest.runningBalanceAmount && latest.runningBalanceAmount > 0) {
                return {
                    amount: latest.runningBalanceAmount,
                    shares: latest.runningBalanceShares || Math.floor(latest.runningBalanceAmount / 100),
                };
            }
            const totalAmount = transactions.reduce((sum, tx) => {
                const amt = Number(tx.amount || 0);
                const type = (tx.transactionType || '').toUpperCase();
                if (['WITHDRAWAL', 'REDEMPTION', 'DEBIT'].includes(type)) {
                    return sum - amt;
                }
                return sum + amt;
            }, 0);
            const totalShares = transactions.reduce((sum, tx) => sum + (Number(tx.numberOfShares) || 0), 0) || Math.floor(totalAmount / 100);
            return { amount: Math.round(totalAmount * 100) / 100, shares: totalShares };
        }

        try {
            const savingsTx = await database
                .get('savings_transactions')
                .query(
                    Q.where('borrower_id', memberId),
                    Q.where('deleted_at', null)
                )
                .fetch();

            const cbuTx = savingsTx.filter((tx: any) => {
                const t = (tx.type || '').toLowerCase();
                return t === 'cbu' || t === 'cbu_opening_balance' || t === 'cbu_deposit';
            });

            if (cbuTx.length > 0) {
                const amount = cbuTx.reduce((s, tx: any) => s + (Number(tx.amount) || 0), 0);
                const shares = Math.floor(amount / 100);
                return { amount, shares };
            }
        } catch (e) {
            // Ignore fallback errors
        }

        return { amount: 0, shares: 0 };
    }

    /**
     * Get transaction history
     * @param memberId Borrower/Member ID
     */
    static async getHistory(memberId: string): Promise<ShareCapitalTransaction[]> {
        const transactions = await database
            .get<ShareCapitalTransaction>('share_capital_transactions')
            .query(
                Q.where('member_id', memberId),
                Q.where('deleted_at', null),
                Q.sortBy('date', Q.desc)
            )
            .fetch();

        if (transactions.length > 0) {
            return transactions;
        }

        try {
            const savingsTx = await database
                .get('savings_transactions')
                .query(
                    Q.where('borrower_id', memberId),
                    Q.where('deleted_at', null)
                )
                .fetch();

            const cbuTx = savingsTx.filter((tx: any) => {
                const t = (tx.type || '').toLowerCase();
                return t === 'cbu' || t === 'cbu_opening_balance' || t === 'cbu_deposit';
            });

            if (cbuTx.length > 0) {
                return cbuTx.map((tx: any) => ({
                    id: tx.id,
                    memberId: tx.borrowerId,
                    transactionType: 'DEPOSIT',
                    shareType: 'COMMON',
                    numberOfShares: Math.floor((Number(tx.amount) || 0) / 100),
                    parValue: 100,
                    amount: Number(tx.amount) || 0,
                    runningBalanceShares: Math.floor((Number(tx.amount) || 0) / 100),
                    runningBalanceAmount: Number(tx.amount) || 0,
                    referenceNumber: tx.referenceId || 'CBU-CARRYFORWARD',
                    transactionDate: Number(tx.date || tx.createdAt || Date.now()),
                    notes: tx.notes || 'CBU record',
                    recordedBy: tx.recordedBy || null,
                    // Source marker: this row lives in savings_transactions, not share_capital_transactions
                    _isLegacy: true,
                } as any));
            }
        } catch (e) {
            // Ignore fallback errors
        }

        return [];
    }

    /**
     * Update an existing share capital transaction
     */
    static async updateTransaction(
        transactionId: string,
        params: {
            amount?: number;
            numberOfShares?: number;
            parValue?: number;
            shareType?: string;
            transactionType?: string;
            notes?: string;
        },
        performedBy?: string
    ): Promise<ShareCapitalTransaction> {
        const tx = await database.get<ShareCapitalTransaction>('share_capital_transactions').find(transactionId);
        const oldData = { ...tx._raw };

        await database.write(async () => {
            await tx.update((record: ShareCapitalTransaction) => {
                if (params.amount !== undefined) record.amount = params.amount;
                if (params.numberOfShares !== undefined) record.numberOfShares = params.numberOfShares;
                if (params.parValue !== undefined) record.parValue = params.parValue;
                if (params.shareType !== undefined) record.shareType = params.shareType;
                if (params.transactionType !== undefined) record.transactionType = params.transactionType;
                if (params.notes !== undefined) record.notes = params.notes;
            });
        });

        await ActionLogService.logAction({
            entityType: 'share_capital_transactions',
            entityId: tx.id,
            action: 'UPDATE',
            oldData,
            newData: tx._raw,
            performedBy,
        });

        return tx;
    }

    /**
     * Soft delete a share capital transaction
     */
    static async deleteTransaction(transactionId: string, performedBy?: string): Promise<void> {
        const tx = await database.get<ShareCapitalTransaction>('share_capital_transactions').find(transactionId);
        const oldData = { ...tx._raw };

        await database.write(async () => {
            await tx.update((record: ShareCapitalTransaction) => {
                record.deletedAt = Date.now();
            });
        });

        await ActionLogService.logAction({
            entityType: 'share_capital_transactions',
            entityId: tx.id,
            action: 'DELETE',
            oldData,
            performedBy,
        });
    }

    /**
     * Source-aware soft delete for CBU/share capital rows.
     *
     * When `getHistory()` falls back to legacy `savings_transactions` rows it
     * marks them with `_isLegacy: true`. Passing that flag here ensures we
     * look in the correct WatermelonDB table instead of always querying
     * `share_capital_transactions` (which would throw "record not found" for
     * legacy IDs).
     *
     * @param transactionId  The record ID to soft-delete
     * @param isLegacy       True when the row originated from savings_transactions (CBU carry-forward)
     * @param performedBy    User ID for the audit log
     */
    static async deleteTransactionById(
        transactionId: string,
        isLegacy: boolean,
        performedBy?: string
    ): Promise<void> {
        if (isLegacy) {
            // Legacy CBU row stored in savings_transactions
            const tx = await database.get<any>('savings_transactions').find(transactionId);
            const oldData = { ...tx._raw };

            await database.write(async () => {
                await tx.update((record: any) => {
                    record.deletedAt = Date.now();
                });
            });

            await ActionLogService.logAction({
                entityType: 'savings_transactions',
                entityId: tx.id,
                action: 'DELETE',
                oldData,
                performedBy,
            });
        } else {
            // Native share_capital_transactions row
            await this.deleteTransaction(transactionId, performedBy);
        }
    }
}
