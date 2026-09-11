import { Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import { JournalEntryServiceClass } from './JournalEntryService';
import StockMovement from '../database/models/StockMovement';
import WasteLog from '../database/models/WasteLog';
import CashTransaction from '../database/models/CashTransaction';

export type ReturnCondition = 'good_resellable' | 'damaged_expired';

export interface ReturnItemInput {
    productId: string;
    productName: string;
    condition: ReturnCondition;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    reason: string;
    uom?: string; // 'box' | 'pack' | 'pc'
    uomMultiplier?: number; // base units per UOM (e.g. 10 or 24)
    sku?: string;
}

export interface CreateReturnInput {
    branchId: string;
    warehouseId?: string;
    cashierId: string;
    originalOrderNumber?: string;
    originalOrderId?: string;
    customerId?: string;
    customerName?: string;
    customerContact?: string;
    items: ReturnItemInput[];
    refundMethod?: 'cash' | 'credit' | 'e_wallet';
    notes?: string;
}

export interface ReturnDraft {
    id: string;
    returnNumber: string;
    branchId: string;
    warehouseId?: string;
    cashierId: string;
    originalOrderNumber?: string;
    originalOrderId?: string;
    customerId?: string;
    customerName?: string;
    customerContact?: string;
    items: ReturnItemInput[];
    totalRefundAmount: number;
    refundMethod: 'cash' | 'credit' | 'e_wallet';
    status: 'draft' | 'approved' | 'completed' | 'rejected';
    notes?: string;
    createdAt: number;
    approvedBy?: string;
    approvedAt?: number;
}

const returnDrafts = new Map<string, ReturnDraft>();

export class SalesReturnServiceClass {
    private db: Database;
    private journalEntryService: JournalEntryServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.journalEntryService = new JournalEntryServiceClass(db);
    }

    static generateReturnNumber(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `RET-${year}${month}${day}-${rand}`;
    }

    createReturnDraft(input: CreateReturnInput): ReturnDraft {
        if (!input.items || input.items.length === 0) {
            throw new Error('At least one return item must be provided.');
        }

        for (const item of input.items) {
            if (item.quantity <= 0) {
                throw new Error(`Quantity for ${item.productName || item.productId} must be greater than zero.`);
            }
            if (item.unitPrice < 0) {
                throw new Error(`Unit price for ${item.productName || item.productId} cannot be negative.`);
            }
        }

        const totalRefundAmount = Number(
            input.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(2)
        );

        const returnNumber = SalesReturnServiceClass.generateReturnNumber();
        const id = `ret_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const draft: ReturnDraft = {
            id,
            returnNumber,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            cashierId: input.cashierId,
            originalOrderNumber: input.originalOrderNumber,
            originalOrderId: input.originalOrderId,
            customerId: input.customerId,
            customerName: input.customerName?.trim() || 'Walk-in Customer',
            customerContact: input.customerContact?.trim(),
            items: input.items,
            totalRefundAmount,
            refundMethod: input.refundMethod || 'cash',
            status: 'draft',
            notes: input.notes,
            createdAt: Date.now(),
        };

        returnDrafts.set(id, draft);
        return draft;
    }

    approveReturn(returnId: string, supervisorName: string): ReturnDraft {
        const draft = returnDrafts.get(returnId);
        if (!draft) {
            throw new Error(`Return draft with ID ${returnId} not found.`);
        }
        if (draft.status !== 'draft') {
            throw new Error(`Cannot approve return with status '${draft.status}'.`);
        }

        draft.status = 'approved';
        draft.approvedBy = supervisorName;
        draft.approvedAt = Date.now();
        returnDrafts.set(returnId, draft);
        return draft;
    }

    async completeReturn(returnId: string): Promise<{
        returnDraft: ReturnDraft;
        stockMovementIds: string[];
        wasteLogIds: string[];
        cashTransactionId?: string;
        journalEntryId?: string;
    }> {
        const draft = returnDrafts.get(returnId);
        if (!draft) {
            throw new Error(`Return draft with ID ${returnId} not found.`);
        }
        if (draft.status !== 'approved') {
            throw new Error(`Return draft must be approved by supervisor before completion.`);
        }

        // Concurrency defense: Immediately advance status to lock out simultaneous double-submission
        draft.status = 'completed';

        const now = new Date();
        const stockMovementIds: string[] = [];
        const wasteLogIds: string[] = [];
        let createdCashTxnId: string | undefined;

        try {
            await this.db.write(async () => {
            const stockColl = this.db.get<StockMovement>('stock_movements');
            const wasteColl = this.db.get<WasteLog>('waste_logs');

            for (const item of draft.items) {
                // Rule: Packs/boxes convert to single units (Base UOM)
                const multiplier = item.uomMultiplier && item.uomMultiplier > 0 ? item.uomMultiplier : 1;
                const baseQty = item.quantity * multiplier;

                if (item.condition === 'good_resellable') {
                    const movement = await stockColl.create((rec) => {
                        rec.productId = item.productId;
                        rec.productSource = 'marketplace_products';
                        rec.moduleId = 'crispy-king';
                        (rec as any).warehouseId = draft.warehouseId || null;
                        (rec as any).branchId = draft.branchId;
                        rec.movementType = 'return';
                        rec.quantityIn = baseQty; // Rule: base UOM single units
                        rec.quantityOut = 0;
                        rec.quantityBalance = baseQty;
                        rec.unitCost = item.unitCost || 0;
                        rec.totalCost = Number(((item.unitCost || 0) * baseQty).toFixed(2));
                        rec.referenceNumber = draft.returnNumber;
                        rec.sourceTable = 'sales_returns';
                        rec.sourceId = draft.id;
                        rec.movementDate = now;
                        rec.notes = `Customer return: ${item.reason} (${item.productName}) [Converted to ${baseQty} base units]`;
                        rec.performedBy = draft.approvedBy || draft.cashierId;
                    });
                    stockMovementIds.push(movement.id);
                } else {
                    const waste = await wasteColl.create((rec) => {
                        rec.branchId = draft.branchId;
                        rec.productId = item.productId;
                        rec.productName = item.productName;
                        rec.quantity = baseQty;
                        rec.uom = 'pcs';
                        rec.reason = item.reason.toLowerCase().includes('expir') ? 'expired' : 'damaged';
                        rec.unitCost = item.unitCost || 0;
                        rec.totalCost = Number(((item.unitCost || 0) * baseQty).toFixed(2));
                        rec.recordedBy = draft.approvedBy || draft.cashierId;
                        rec.notes = `Customer return rejection (NOT restocked): ${item.reason}`;
                        rec.status = 'approved';
                        rec.logDate = now;
                    });
                    wasteLogIds.push(waste.id);
                }
            }

            // Persist Return record to database if collection is registered
            try {
                const srColl = this.db.get<any>('sales_returns');
                const srlColl = this.db.get<any>('sales_return_lines');
                if (srColl?.create) {
                    const savedReturn = await srColl.create((rec: any) => {
                        rec.returnNumber = draft.returnNumber;
                        rec.originalOrderNumber = draft.originalOrderNumber || null;
                        rec.originalOrderId = draft.originalOrderId || null;
                        rec.customerId = draft.customerId || null;
                        rec.customerName = draft.customerName || null;
                        rec.branchId = draft.branchId;
                        rec.warehouseId = draft.warehouseId || null;
                        rec.status = 'completed';
                        rec.reason = draft.items.map(i => i.reason).join('; ');
                        rec.totalRefundAmount = draft.totalRefundAmount;
                        rec.refundMethod = draft.refundMethod;
                        rec.createdBy = draft.cashierId;
                        rec.approvedBy = draft.approvedBy || null;
                        rec.approvedAt = draft.approvedAt ? new Date(draft.approvedAt) : now;
                        rec.completedAt = now;
                        rec.notes = draft.notes || null;
                    });

                    if (srlColl?.create) {
                        for (const item of draft.items) {
                            const multiplier = item.uomMultiplier && item.uomMultiplier > 0 ? item.uomMultiplier : 1;
                            await srlColl.create((lineRec: any) => {
                                lineRec.salesReturnId = savedReturn.id;
                                lineRec.productId = item.productId;
                                lineRec.productName = item.productName;
                                lineRec.sku = item.sku || null;
                                lineRec.returnQuantity = item.quantity;
                                lineRec.uom = item.uom || 'pc';
                                lineRec.uomMultiplier = multiplier;
                                lineRec.baseQuantity = item.quantity * multiplier;
                                lineRec.unitPrice = item.unitPrice;
                                lineRec.totalAmount = Number((item.unitPrice * item.quantity).toFixed(2));
                                lineRec.condition = item.condition === 'good_resellable' ? 'good' : 'damaged';
                                lineRec.restockAction = item.condition === 'good_resellable' ? 'restock_shelf' : 'waste_log';
                            });
                        }
                    }
                }
            } catch (persistErr) {
                // Non-fatal if schema/mock does not implement sales_returns
            }

            if (draft.refundMethod === 'cash' && draft.totalRefundAmount > 0) {
                const cashColl = this.db.get<CashTransaction>('cash_transactions');
                const cashTxn = await cashColl.create((rec) => {
                    rec.amount = draft.totalRefundAmount;
                    rec.type = 'out';
                    rec.particulars = `Sales Return Refund: ${draft.returnNumber} (${draft.customerName})`;
                    rec.remarks = `Refund for return ${draft.returnNumber}`;
                    rec.recordedBy = draft.cashierId;
                    rec.transactionDate = now.getTime();
                });
                createdCashTxnId = cashTxn.id;
            }
        });
        } catch (dbErr) {
            draft.status = 'approved';
            throw dbErr;
        }

        let journalEntryId: string | undefined;
        try {
            const entry = await this.journalEntryService.createEntry({
                entryDate: now,
                description: `Sales Return & Refund — ${draft.returnNumber} (${draft.branchId})`,
                entryType: 'auto',
                sourceTable: 'sales_returns',
                sourceId: draft.id,
                postedBy: draft.approvedBy || draft.cashierId,
                lines: [
                    {
                        accountCode: '5210',
                        accountName: 'Sales Returns & Allowances',
                        debitAmount: draft.totalRefundAmount,
                        creditAmount: 0,
                        description: `Customer refund for ${draft.returnNumber}`,
                    },
                    {
                        accountCode: '1010',
                        accountName: 'Cash on Hand / Drawer',
                        debitAmount: 0,
                        creditAmount: draft.totalRefundAmount,
                        description: `Cash refund payout for ${draft.returnNumber}`,
                    },
                ],
            });
            journalEntryId = entry.id;
        } catch (jeErr) {
            console.warn('[SalesReturnService] Failed to auto-post journal entry:', jeErr);
        }

        draft.status = 'completed';
        returnDrafts.set(returnId, draft);

        return {
            returnDraft: draft,
            stockMovementIds,
            wasteLogIds,
            cashTransactionId: createdCashTxnId,
            journalEntryId,
        };
    }

    getAllReturns(branchId?: string): ReturnDraft[] {
        const all = Array.from(returnDrafts.values());
        if (!branchId) return all.sort((a, b) => b.createdAt - a.createdAt);
        return all
            .filter((r) => r.branchId === branchId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    getReturnById(id: string): ReturnDraft | undefined {
        return returnDrafts.get(id);
    }
}

export const SalesReturnService = new SalesReturnServiceClass();
