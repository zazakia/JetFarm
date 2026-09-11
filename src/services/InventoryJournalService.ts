/**
 * InventoryJournalService
 *
 * Records and retrieves all inventory stock movements across modules.
 * Every movement creates a corresponding double-entry journal entry.
 *
 * Journal Entries:
 * - Purchase (in):    DR 1210/1220/1230 Merchandise Inventory / CR 2030 AP
 * - Sale (out):       DR 5130/5140/5150 COGS / CR 1210/1220/1230 Inventory
 * - Adjustment +:     DR 12xx Inventory / CR 4070 Misc Income
 * - Adjustment -:     DR 5100 Other Op Expenses / CR 12xx Inventory
 * - Return to supplier: DR 2030 AP / CR 12xx Inventory
 * - Beginning balance: DR 12xx Inventory / CR 3010 Share Capital
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import StockMovement from '../database/models/StockMovement';
import { JournalEntryServiceClass } from './JournalEntryService';
import ActionLogService from './ActionLogService';

const INVENTORY_ACCOUNT_MAP: Record<string, string> = {
    'agri-store': '1210',
    'pharmacy': '1220',
    'marketplace': '1230',
    'water-station': '1015',
};

const COGS_ACCOUNT_MAP: Record<string, string> = {
    'agri-store': '5130',
    'pharmacy': '5140',
    'marketplace': '5150',
    'water-station': '5120',
};

export interface StockMovementInput {
    productId: string;
    productSource: string;
    moduleId: string;
    movementType: 'purchase' | 'sale' | 'adjustment_increase' | 'adjustment_decrease' | 'return' | 'beginning';
    quantityIn?: number;
    quantityOut?: number;
    unitCost?: number;
    referenceNumber?: string;
    sourceTable?: string;
    sourceId?: string;
    movementDate: Date;
    notes?: string;
    performedBy?: string;
}

export interface StockMovementRow {
    id: string;
    date: Date;
    referenceNumber: string | null;
    description: string;
    movementType: string;
    quantityIn: number;
    quantityOut: number;
    balance: number;
    unitCost: number;
    totalCost: number;
    moduleId: string;
}

export interface InventorySummary {
    productId: string;
    productSource: string;
    moduleId: string;
    currentStock: number;
    totalCostValue: number;
    weightedAverageCost: number;
    lastMovementDate: Date | null;
}

export class InventoryJournalServiceClass {
    private db: Database;
    private journalEntryService: JournalEntryServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.journalEntryService = new JournalEntryServiceClass(db);
    }

    /**
     * Get the current stock balance for a product.
     */
    async getCurrentStock(productId: string, productSource: string): Promise<number> {
        const movements = await this.db.collections
            .get<StockMovement>('stock_movements')
            .query(
                Q.where('product_id', productId),
                Q.where('product_source', productSource),
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('movement_date', Q.desc),
                Q.take(1)
            )
            .fetch();
        return movements[0]?.quantityBalance ?? 0;
    }

    /**
     * Compute Weighted Average Cost for a product.
     */
    async computeWAC(productId: string, productSource: string): Promise<number> {
        const movements = await this.db.collections
            .get<StockMovement>('stock_movements')
            .query(
                Q.where('product_id', productId),
                Q.where('product_source', productSource),
                Q.where('movement_type', Q.oneOf(['purchase', 'beginning'])),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        const totalQty = movements.reduce((s, m) => s + (m.quantityIn ?? 0), 0);
        const totalCost = movements.reduce((s, m) => s + (m.totalCost ?? 0), 0);
        return totalQty > 0 ? totalCost / totalQty : 0;
    }

    /**
     * Record a stock movement and post the corresponding journal entry.
     */
    async recordMovement(input: StockMovementInput): Promise<StockMovement> {
        const inventoryAccount = INVENTORY_ACCOUNT_MAP[input.moduleId] ?? '1230';
        const cogsAccount = COGS_ACCOUNT_MAP[input.moduleId] ?? '5150';
        const currentStock = await this.getCurrentStock(input.productId, input.productSource);
        const wac = await this.computeWAC(input.productId, input.productSource);

        const qtyIn = input.quantityIn ?? 0;
        const qtyOut = input.quantityOut ?? 0;
        const newBalance = currentStock + qtyIn - qtyOut;
        const unitCost = input.unitCost ?? wac;
        const totalCost = unitCost * (qtyIn || qtyOut);

        let movement!: StockMovement;
        await this.db.write(async () => {
            movement = await this.db.collections.get<StockMovement>('stock_movements').create(m => {
                (m as any).productId = input.productId;
                (m as any).productSource = input.productSource;
                (m as any).moduleId = input.moduleId;
                (m as any).movementType = input.movementType.replace('_increase', '').replace('_decrease', '');
                (m as any).quantityIn = qtyIn || null;
                (m as any).quantityOut = qtyOut || null;
                (m as any).quantityBalance = newBalance;
                (m as any).unitCost = unitCost || null;
                (m as any).totalCost = totalCost || null;
                (m as any).referenceNumber = input.referenceNumber ?? null;
                (m as any).sourceTable = input.sourceTable ?? null;
                (m as any).sourceId = input.sourceId ?? null;
                (m as any).movementDate = input.movementDate.getTime();
                (m as any).notes = input.notes ?? null;
                (m as any).performedBy = input.performedBy ?? null;
            });
        });

        await this._postJournalEntry(input, movement.id, inventoryAccount, cogsAccount, totalCost);

        await ActionLogService.logAction({
            entityType: 'stock_movements',
            entityId: movement.id,
            action: 'CREATE',
            newData: { movementType: input.movementType, qtyIn, qtyOut, balance: newBalance },
            performedBy: input.performedBy,
        });

        return movement;
    }

    private async _postJournalEntry(
        input: StockMovementInput,
        movementId: string,
        inventoryAccount: string,
        cogsAccount: string,
        totalCost: number
    ): Promise<void> {
        if (totalCost <= 0.005) return;

        const date = input.movementDate;
        const ref = input.referenceNumber ?? '';

        switch (input.movementType) {
            case 'purchase':
                await this.journalEntryService.createEntry({
                    entryDate: date,
                    description: `Inventory purchase — ${input.moduleId} (${ref})`,
                    entryType: 'auto',
                    sourceTable: input.sourceTable ?? 'stock_movements',
                    sourceId: input.sourceId ?? movementId,
                    lines: [
                        { accountCode: inventoryAccount, accountName: 'Merchandise Inventory', debitAmount: totalCost, description: 'Stock received' },
                        { accountCode: '2030', accountName: 'Accounts Payable', creditAmount: totalCost, description: 'Supplier payable' },
                    ],
                }, input.performedBy);
                break;

            case 'sale':
                await this.journalEntryService.createEntry({
                    entryDate: date,
                    description: `Cost of goods sold — ${input.moduleId} (${ref})`,
                    entryType: 'auto',
                    sourceTable: input.sourceTable ?? 'stock_movements',
                    sourceId: input.sourceId ?? movementId,
                    lines: [
                        { accountCode: cogsAccount, accountName: 'Cost of Goods Sold', debitAmount: totalCost, description: 'COGS on sale' },
                        { accountCode: inventoryAccount, accountName: 'Merchandise Inventory', creditAmount: totalCost, description: 'Inventory reduced on sale' },
                    ],
                }, input.performedBy);
                break;

            case 'adjustment_increase':
                await this.journalEntryService.createEntry({
                    entryDate: date,
                    description: `Inventory adjustment (increase) — ${input.moduleId}: ${input.notes ?? ''}`,
                    entryType: 'adjusting',
                    sourceTable: 'stock_movements',
                    sourceId: movementId,
                    lines: [
                        { accountCode: inventoryAccount, accountName: 'Merchandise Inventory', debitAmount: totalCost, description: 'Stock increase' },
                        { accountCode: '4070', accountName: 'Miscellaneous Income', creditAmount: totalCost, description: 'Inventory adjustment gain' },
                    ],
                }, input.performedBy);
                break;

            case 'adjustment_decrease':
                await this.journalEntryService.createEntry({
                    entryDate: date,
                    description: `Inventory adjustment (decrease) — ${input.moduleId}: ${input.notes ?? ''}`,
                    entryType: 'adjusting',
                    sourceTable: 'stock_movements',
                    sourceId: movementId,
                    lines: [
                        { accountCode: '5100', accountName: 'Other Operating Expenses', debitAmount: totalCost, description: 'Inventory write-down' },
                        { accountCode: inventoryAccount, accountName: 'Merchandise Inventory', creditAmount: totalCost, description: 'Stock decrease' },
                    ],
                }, input.performedBy);
                break;

            case 'return':
                await this.journalEntryService.createEntry({
                    entryDate: date,
                    description: `Return to supplier — ${input.moduleId} (${ref})`,
                    entryType: 'auto',
                    sourceTable: 'stock_movements',
                    sourceId: movementId,
                    lines: [
                        { accountCode: '2030', accountName: 'Accounts Payable', debitAmount: totalCost, description: 'AP reduced on return' },
                        { accountCode: inventoryAccount, accountName: 'Merchandise Inventory', creditAmount: totalCost, description: 'Stock returned' },
                    ],
                }, input.performedBy);
                break;

            case 'beginning':
                await this.journalEntryService.createEntry({
                    entryDate: date,
                    description: `Beginning inventory balance — ${input.moduleId}`,
                    entryType: 'adjusting',
                    sourceTable: 'stock_movements',
                    sourceId: movementId,
                    lines: [
                        { accountCode: inventoryAccount, accountName: 'Merchandise Inventory', debitAmount: totalCost, description: 'Opening inventory balance' },
                        { accountCode: '3010', accountName: 'Share Capital', creditAmount: totalCost, description: 'Beginning balance offset' },
                    ],
                }, input.performedBy);
                break;
        }
    }

    /**
     * Get movement history for a product.
     */
    async getMovements(
        opts: { productId?: string; moduleId?: string; startDate?: Date; endDate?: Date; limit?: number } = {}
    ): Promise<StockMovement[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', Q.eq(null))];
        if (opts.productId) clauses.push(Q.where('product_id', opts.productId));
        if (opts.moduleId) clauses.push(Q.where('module_id', opts.moduleId));
        if (opts.startDate) clauses.push(Q.where('movement_date', Q.gte(opts.startDate.getTime())));
        if (opts.endDate) clauses.push(Q.where('movement_date', Q.lte(opts.endDate.getTime())));
        clauses.push(Q.sortBy('movement_date', Q.asc));
        if (opts.limit) clauses.push(Q.take(opts.limit));
        return this.db.collections.get<StockMovement>('stock_movements').query(...clauses).fetch();
    }

    /**
     * Get inventory summary per product for a module.
     */
    async getInventorySummary(moduleId: string, asOf?: Date): Promise<InventorySummary[]> {
        const clauses: Q.Clause[] = [
            Q.where('module_id', moduleId),
            Q.where('deleted_at', Q.eq(null)),
        ];
        if (asOf) clauses.push(Q.where('movement_date', Q.lte(asOf.getTime())));

        const movements = await this.db.collections
            .get<StockMovement>('stock_movements')
            .query(...clauses)
            .fetch();

        const productMap = new Map<string, { qtyIn: number; qtyOut: number; totalCost: number; lastDate: Date | null; source: string }>();

        for (const m of movements) {
            const key = `${m.productSource}:${m.productId}`;
            const existing = productMap.get(key) ?? { qtyIn: 0, qtyOut: 0, totalCost: 0, lastDate: null, source: m.productSource };
            existing.qtyIn += m.quantityIn ?? 0;
            existing.qtyOut += m.quantityOut ?? 0;
            if (['purchase', 'beginning'].includes(m.movementType)) existing.totalCost += m.totalCost ?? 0;
            const mDate = m.movementDate instanceof Date ? m.movementDate : new Date(m.movementDate);
            if (!existing.lastDate || mDate > existing.lastDate) existing.lastDate = mDate;
            productMap.set(key, existing);
        }

        const summaries: InventorySummary[] = [];
        for (const [key, data] of productMap.entries()) {
            const [, productId] = key.split(':');
            const currentStock = data.qtyIn - data.qtyOut;
            const wac = data.qtyIn > 0 ? data.totalCost / data.qtyIn : 0;
            summaries.push({
                productId,
                productSource: data.source,
                moduleId,
                currentStock,
                totalCostValue: currentStock * wac,
                weightedAverageCost: wac,
                lastMovementDate: data.lastDate,
            });
        }

        return summaries.sort((a, b) => a.productId.localeCompare(b.productId));
    }

    /**
     * Record beginning inventory balance for a product.
     */
    async recordBeginningBalance(opts: {
        productId: string;
        productSource: string;
        moduleId: string;
        quantity: number;
        unitCost: number;
        date: Date;
        performedBy?: string;
    }): Promise<StockMovement> {
        return this.recordMovement({
            productId: opts.productId,
            productSource: opts.productSource,
            moduleId: opts.moduleId,
            movementType: 'beginning',
            quantityIn: opts.quantity,
            unitCost: opts.unitCost,
            movementDate: opts.date,
            notes: 'Beginning balance entry',
            performedBy: opts.performedBy,
        });
    }
}

const instance = new InventoryJournalServiceClass();
export { instance as InventoryJournalService };
export default instance;
