/**
 * CommissaryDispatchService
 *
 * Handles logistics lifecycle for Crispy King Commissary:
 * - PO dispatch creation
 * - In-transit tracking
 * - Branch receiving with line-item discrepancy & variance calculation
 * - Physical acceptance sign-off
 * - Inventory posting via StockMovement and double-entry general ledger
 * - Delivery dispute management
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import CommissaryDispatch, { DispatchItem } from '../database/models/CommissaryDispatch';
import StockMovement from '../database/models/StockMovement';
import JournalEntryService from './JournalEntryService';

export interface CreateDispatchItemInput {
    productId: string;
    productName: string;
    quantityExpected: number;
    uom: string;
    unitCost: number;
    notes?: string;
}

export interface CreateDispatchInput {
    fromLocation: string;
    toBranchId: string;
    items: CreateDispatchItemInput[];
    poReference?: string;
    dispatchedBy?: string;
    notes?: string;
}

export interface ReceivedItemInput {
    productId: string;
    quantityReceived: number;
    notes?: string;
}

export class CommissaryDispatchServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    private generateDispatchNumber(): string {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        return `DSP-${dateStr}-${randomDigits}`;
    }

    /**
     * Create a new commissary dispatch draft
     */
    async createDispatch(input: CreateDispatchInput): Promise<CommissaryDispatch> {
        if (!input.items || input.items.length === 0) {
            throw new Error('Dispatch must contain at least one item');
        }

        const totalAmount = input.items.reduce((sum, item) => {
            return sum + (item.quantityExpected || 0) * (item.unitCost || 0);
        }, 0);

        const dispatchNumber = this.generateDispatchNumber();
        const itemsWithVariance: DispatchItem[] = input.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantityExpected: item.quantityExpected,
            uom: item.uom,
            unitCost: item.unitCost,
            quantityReceived: undefined,
            variance: undefined,
            notes: item.notes,
        }));

        let createdRecord!: CommissaryDispatch;

        await this.db.write(async () => {
            createdRecord = await this.db.get<CommissaryDispatch>('commissary_dispatches').create((record) => {
                record.fromLocation = input.fromLocation;
                record.toBranchId = input.toBranchId;
                record.dispatchNumber = dispatchNumber;
                record.poReference = input.poReference ?? null;
                record.status = 'draft';
                record.itemsJson = JSON.stringify(itemsWithVariance);
                record.totalAmount = Math.round(totalAmount * 100) / 100;
                record.dispatchedBy = input.dispatchedBy ?? null;
                record.notes = input.notes ?? null;
            });
        });

        return createdRecord;
    }

    /**
     * Mark dispatch in-transit from commissary to destination branch
     */
    async markInTransit(dispatchId: string): Promise<CommissaryDispatch> {
        const dispatch = await this.getDispatchById(dispatchId);

        await this.db.write(async () => {
            await dispatch.update((record) => {
                record.status = 'in_transit';
                record.dispatchedAt = new Date();
            });
        });

        return dispatch;
    }

    /**
     * Branch Manager receives delivery and performs physical count.
     * Computes line-item variances (quantityReceived - quantityExpected).
     */
    async receiveDispatch(
        dispatchId: string,
        receivedItems: ReceivedItemInput[],
        receivedBy: string
    ): Promise<CommissaryDispatch> {
        const dispatch = await this.getDispatchById(dispatchId);
        const currentItems: DispatchItem[] = dispatch.items;

        const updatedItems = currentItems.map((item) => {
            const match = receivedItems.find((r) => r.productId === item.productId);
            const quantityReceived = match !== undefined ? match.quantityReceived : item.quantityExpected;
            const variance = quantityReceived - item.quantityExpected;
            return {
                ...item,
                quantityReceived,
                variance,
                notes: match?.notes || item.notes,
            };
        });

        await this.db.write(async () => {
            await dispatch.update((record) => {
                record.status = 'received';
                record.itemsJson = JSON.stringify(updatedItems);
                record.receivedBy = receivedBy;
                record.receivedAt = new Date();
            });
        });

        return dispatch;
    }

    /**
     * Supervisor or Branch Manager verifies physical receipt, commits stock to branch inventory
     * via StockMovement, and posts double-entry inventory ledger journal.
     */
    async verifyAndPostToInventory(dispatchId: string, verifiedBy: string): Promise<CommissaryDispatch> {
        const dispatch = await this.getDispatchById(dispatchId);
        const items: DispatchItem[] = dispatch.items;

        await this.db.write(async () => {
            for (const item of items) {
                const qtyToPost = item.quantityReceived !== undefined ? item.quantityReceived : item.quantityExpected;
                if (qtyToPost <= 0) continue;

                const itemTotalCost = Math.round(qtyToPost * item.unitCost * 100) / 100;

                await this.db.get<StockMovement>('stock_movements').create((sm) => {
                    sm.productId = item.productId;
                    sm.productSource = 'crispy-king';
                    sm.moduleId = 'crispy-king';
                    sm.branchId = dispatch.toBranchId;
                    sm.warehouseId = dispatch.toBranchId;
                    sm.movementType = 'transfer';
                    sm.quantityIn = qtyToPost;
                    sm.quantityOut = null;
                    sm.quantityBalance = qtyToPost;
                    sm.unitCost = item.unitCost;
                    sm.totalCost = itemTotalCost;
                    sm.referenceNumber = dispatch.dispatchNumber;
                    sm.sourceTable = 'commissary_dispatches';
                    sm.sourceId = dispatch.id;
                    sm.movementDate = new Date();
                    sm.notes = `Delivery received from ${dispatch.fromLocation} to ${dispatch.toBranchId}`;
                    sm.performedBy = verifiedBy;
                });
            }

            await dispatch.update((record) => {
                record.status = 'verified';
                record.verifiedBy = verifiedBy;
                record.verifiedAt = new Date();
            });
        });

        // Double-entry accounting: Debit Merchandise Inventory (1200), Credit AP/Commissary Transfer (2010)
        if (dispatch.totalAmount > 0) {
            try {
                await JournalEntryService.createEntry(
                    {
                        entryDate: new Date(),
                        description: `Commissary Delivery Received — ${dispatch.dispatchNumber} to Branch ${dispatch.toBranchId}`,
                        entryType: 'auto',
                        sourceTable: 'commissary_dispatches',
                        sourceId: dispatch.id,
                        lines: [
                            {
                                accountCode: '1200',
                                accountName: 'Merchandise Inventory',
                                debitAmount: dispatch.totalAmount,
                                description: `Stock received: ${dispatch.dispatchNumber}`,
                            },
                            {
                                accountCode: '2010',
                                accountName: 'Accounts Payable',
                                creditAmount: dispatch.totalAmount,
                                description: `Commissary inter-branch payable: ${dispatch.dispatchNumber}`,
                            },
                        ],
                    },
                    verifiedBy
                );
            } catch (err) {
                console.warn('[CommissaryDispatchService] Journal auto-post error:', err);
            }
        }

        return dispatch;
    }

    /**
     * Dispute delivery due to major damage, missing cargo, or seal tamper
     */
    async disputeDispatch(dispatchId: string, notes: string): Promise<CommissaryDispatch> {
        const dispatch = await this.getDispatchById(dispatchId);

        await this.db.write(async () => {
            await dispatch.update((record) => {
                record.status = 'disputed';
                record.notes = record.notes ? `${record.notes}\nDISPUTE: ${notes}` : `DISPUTE: ${notes}`;
            });
        });

        return dispatch;
    }

    /**
     * Get single dispatch by ID
     */
    async getDispatchById(dispatchId: string): Promise<CommissaryDispatch> {
        return await this.db.get<CommissaryDispatch>('commissary_dispatches').find(dispatchId);
    }

    /**
     * Get all dispatches inbound to a specific branch
     */
    async getDispatchesByBranch(branchId: string, status?: string): Promise<CommissaryDispatch[]> {
        const conditions = [
            Q.where('to_branch_id', branchId),
            Q.where('deleted_at', Q.eq(null)),
        ];
        if (status) {
            conditions.push(Q.where('status', status));
        }
        return await this.db
            .get<CommissaryDispatch>('commissary_dispatches')
            .query(...conditions, Q.sortBy('created_at', Q.desc))
            .fetch();
    }

    /**
     * Get all dispatches dispatched from Commissary
     */
    async getDispatchesByCommissary(status?: string): Promise<CommissaryDispatch[]> {
        const conditions = [Q.where('deleted_at', Q.eq(null))];
        if (status) {
            conditions.push(Q.where('status', status));
        }
        return await this.db
            .get<CommissaryDispatch>('commissary_dispatches')
            .query(...conditions, Q.sortBy('created_at', Q.desc))
            .fetch();
    }
}

const instance = new CommissaryDispatchServiceClass();
export { instance as CommissaryDispatchService };
export default instance;
