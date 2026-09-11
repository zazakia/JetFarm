/**
 * WasteLogService
 *
 * Handles Spoilage, Bad Order (B.O.), and Waste logging for Crispy King branches:
 * - Waste entry recording with reason categorization (damaged, expired, burnt, dropped, etc.)
 * - Automatic physical stock deduction via StockMovement (type: adjustment)
 * - Automatic double-entry journal posting:
 *     DR: 5100 Loss on Spoilage & Bad Orders
 *     CR: 1200 Merchandise Inventory
 * - Aggregated waste and spoilage reports for branch managers and area supervisors
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import WasteLog from '../database/models/WasteLog';
import StockMovement from '../database/models/StockMovement';
import JournalEntryService from './JournalEntryService';

export type WasteReason =
    | 'damaged'
    | 'expired'
    | 'burnt_overcooked'
    | 'spilled_dropped'
    | 'contamination'
    | 'bad_order';

export interface RecordWasteInput {
    branchId: string;
    productId: string;
    productName?: string;
    quantity: number;
    uom: string;
    reason: WasteReason;
    unitCost: number;
    recordedBy?: string;
    notes?: string;
    photoUri?: string;
}

export interface WasteSummary {
    totalCost: number;
    totalCount: number;
    byReason: Record<string, number>;
    byProduct: Record<string, { quantity: number; cost: number; uom: string }>;
}

export class WasteLogServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    /**
     * Records a waste / spoilage / bad order item at branch level.
     * Deducts stock and creates GL journal voucher.
     */
    async recordWaste(input: RecordWasteInput): Promise<WasteLog> {
        if (!input.quantity || input.quantity <= 0) {
            throw new Error('Waste quantity must be greater than zero');
        }
        if (input.unitCost < 0) {
            throw new Error('Unit cost cannot be negative');
        }

        const totalCost = Math.round(input.quantity * input.unitCost * 100) / 100;
        const now = new Date();

        // 1. Fetch current stock balance if available
        let currentBalance = 0;
        try {
            const recentMovements = await this.db
                .get<StockMovement>('stock_movements')
                .query(
                    Q.where('product_id', input.productId),
                    Q.where('deleted_at', Q.eq(null)),
                    Q.sortBy('movement_date', Q.desc),
                    Q.take(1)
                )
                .fetch();
            if (recentMovements.length > 0 && recentMovements[0].quantityBalance !== undefined) {
                currentBalance = recentMovements[0].quantityBalance;
            }
        } catch {
            currentBalance = 0;
        }

        const newBalance = Math.max(0, currentBalance - input.quantity);

        let createdLog!: WasteLog;
        let createdMovement!: StockMovement;

        // 2. Create WasteLog and StockMovement in a database write transaction
        await this.db.write(async () => {
            createdLog = await this.db.get<WasteLog>('waste_logs').create((record) => {
                record.branchId = input.branchId;
                record.productId = input.productId;
                record.productName = input.productName ?? null;
                record.quantity = input.quantity;
                record.uom = input.uom;
                record.reason = input.reason;
                record.unitCost = input.unitCost;
                record.totalCost = totalCost;
                record.recordedBy = input.recordedBy ?? null;
                record.notes = input.notes ?? null;
                record.photoUri = input.photoUri ?? null;
                record.status = 'logged';
                record.logDate = now;
                record.journalEntryId = null;
                record.stockMovementId = null;
            });

            createdMovement = await this.db.get<StockMovement>('stock_movements').create((sm) => {
                sm.productId = input.productId;
                sm.productSource = 'crispy-king';
                sm.moduleId = 'crispy-king';
                sm.movementType = 'adjustment';
                sm.quantityIn = null;
                sm.quantityOut = input.quantity;
                sm.quantityBalance = newBalance;
                sm.unitCost = input.unitCost;
                sm.totalCost = totalCost;
                sm.referenceNumber = createdLog.id;
                sm.sourceTable = 'waste_logs';
                sm.sourceId = createdLog.id;
                sm.movementDate = now;
                sm.notes = `Waste/BO: ${input.reason}${input.notes ? ` - ${input.notes}` : ''}`;
                sm.performedBy = input.recordedBy ?? null;
            });
        });

        // 3. Post double-entry journal entry:
        // Debit 5100 (Loss on Spoilage & Bad Orders)
        // Credit 1200 (Merchandise Inventory)
        let journalEntryId: string | null = null;
        if (totalCost > 0) {
            try {
                const je = await JournalEntryService.createEntry(
                    {
                        entryDate: now,
                        description: `Loss on Spoilage/BO (${input.reason}): ${input.productName || input.productId} - ${input.quantity} ${input.uom}`,
                        entryType: 'adjusting',
                        sourceTable: 'waste_logs',
                        sourceId: createdLog.id,
                        lines: [
                            {
                                accountCode: '5100',
                                accountName: 'Loss on Spoilage & Bad Orders',
                                debitAmount: totalCost,
                                description: `Waste log: ${input.reason}`,
                            },
                            {
                                accountCode: '1200',
                                accountName: 'Merchandise Inventory',
                                creditAmount: totalCost,
                                description: `Stock write-down: ${input.productName || input.productId}`,
                            },
                        ],
                    },
                    input.recordedBy
                );
                journalEntryId = je.id;
            } catch (err) {
                console.warn('[WasteLogService] Auto-posting journal entry error:', err);
            }
        }

        // 4. Update the WasteLog with linked IDs
        await this.db.write(async () => {
            await createdLog.update((record) => {
                record.stockMovementId = createdMovement.id;
                record.journalEntryId = journalEntryId;
            });
        });

        return createdLog;
    }

    /**
     * Aggregates total spoilage cost and breakdown by reason for a branch within a date range
     */
    async getBranchWasteSummary(
        branchId: string,
        startDate: Date,
        endDate: Date
    ): Promise<WasteSummary> {
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();

        const logs = await this.db
            .get<WasteLog>('waste_logs')
            .query(
                Q.where('branch_id', branchId),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        const filtered = logs.filter((log) => {
            const time = typeof log.logDate === 'number' ? log.logDate : new Date(log.logDate).getTime();
            return time >= startTimestamp && time <= endTimestamp;
        });

        let totalCost = 0;
        const byReason: Record<string, number> = {};
        const byProduct: Record<string, { quantity: number; cost: number; uom: string }> = {};

        for (const log of filtered) {
            const cost = log.totalCost || 0;
            totalCost += cost;

            byReason[log.reason] = (byReason[log.reason] || 0) + cost;

            if (!byProduct[log.productId]) {
                byProduct[log.productId] = {
                    quantity: 0,
                    cost: 0,
                    uom: log.uom,
                };
            }
            byProduct[log.productId].quantity += log.quantity || 0;
            byProduct[log.productId].cost += cost;
        }

        return {
            totalCost: Math.round(totalCost * 100) / 100,
            totalCount: filtered.length,
            byReason,
            byProduct,
        };
    }

    /**
     * Get recent waste logs for a branch
     */
    async getBranchWasteLogs(branchId: string, limit: number = 50): Promise<WasteLog[]> {
        return await this.db
            .get<WasteLog>('waste_logs')
            .query(
                Q.where('branch_id', branchId),
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('log_date', Q.desc),
                Q.take(limit)
            )
            .fetch();
    }
}

const instance = new WasteLogServiceClass();
export { instance as WasteLogService };
export default instance;
