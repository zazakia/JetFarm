import { SalesReturnServiceClass } from '../SalesReturnService';

describe('SalesReturnService', () => {
    let service: SalesReturnServiceClass;
    let mockDb: any;
    let mockStockMovementCreate: jest.Mock;
    let mockWasteLogCreate: jest.Mock;
    let mockCashTransactionCreate: jest.Mock;
    let mockJournalEntryCreate: jest.Mock;

    beforeEach(() => {
        mockStockMovementCreate = jest.fn().mockImplementation(async (callback) => {
            const rec: any = { id: 'sm-1' };
            callback(rec);
            return rec;
        });

        mockWasteLogCreate = jest.fn().mockImplementation(async (callback) => {
            const rec: any = { id: 'waste-1' };
            callback(rec);
            return rec;
        });

        mockCashTransactionCreate = jest.fn().mockImplementation(async (callback) => {
            const rec: any = { id: 'cash-1' };
            callback(rec);
            return rec;
        });

        mockJournalEntryCreate = jest.fn().mockResolvedValue({ id: 'je-1' });

        mockDb = {
            write: jest.fn().mockImplementation(async (cb) => cb()),
            get: jest.fn((table: string) => {
                if (table === 'stock_movements') return { create: mockStockMovementCreate };
                if (table === 'waste_logs') return { create: mockWasteLogCreate };
                if (table === 'cash_transactions') return { create: mockCashTransactionCreate };
                return { create: jest.fn() };
            }),
        };

        service = new SalesReturnServiceClass(mockDb);
        (service as any).journalEntryService = {
            createEntry: mockJournalEntryCreate,
        };
    });

    test('creates return draft correctly and computes refund amount', () => {
        const draft = service.createReturnDraft({
            branchId: 'branch-bagacay',
            cashierId: 'cashier-1',
            originalOrderNumber: 'CK-20260910-12345',
            customerName: 'Juan Dela Cruz',
            items: [
                {
                    productId: 'ck-scut',
                    productName: 'Special Cut Fried Chicken',
                    condition: 'good_resellable',
                    quantity: 2,
                    unitPrice: 50.0,
                    unitCost: 28.0,
                    reason: 'Wrong item given',
                },
                {
                    productId: 'ck-rice',
                    productName: 'Cooked Rice',
                    condition: 'damaged_expired',
                    quantity: 1,
                    unitPrice: 15.0,
                    unitCost: 7.0,
                    reason: 'Cold / Unacceptable quality',
                },
            ],
            refundMethod: 'cash',
        });

        expect(draft.id).toBeDefined();
        expect(draft.returnNumber).toMatch(/^RET-\d{8}-[A-Z0-9]{5}$/);
        expect(draft.totalRefundAmount).toBe(115.0); // (2 * 50) + (1 * 15)
        expect(draft.status).toBe('draft');
    });

    test('requires supervisor approval before completing return', async () => {
        const draft = service.createReturnDraft({
            branchId: 'branch-bagacay',
            cashierId: 'cashier-1',
            items: [
                {
                    productId: 'ck-scut',
                    productName: 'Chicken',
                    condition: 'good_resellable',
                    quantity: 1,
                    unitPrice: 50.0,
                    reason: 'Customer request',
                },
            ],
        });

        await expect(service.completeReturn(draft.id)).rejects.toThrow(
            'Return draft must be approved by supervisor before completion.'
        );

        service.approveReturn(draft.id, 'Supervisor Mario');
        const approved = service.getReturnById(draft.id);
        expect(approved?.status).toBe('approved');
        expect(approved?.approvedBy).toBe('Supervisor Mario');
    });

    test('completes return: restocks good item to inventory, routes damaged item to waste log, refunds cash', async () => {
        const draft = service.createReturnDraft({
            branchId: 'branch-bagacay',
            cashierId: 'cashier-1',
            items: [
                {
                    productId: 'ck-scut',
                    productName: 'Special Cut Fried Chicken',
                    condition: 'good_resellable',
                    quantity: 3,
                    unitPrice: 50.0,
                    unitCost: 28.0,
                    reason: 'Excess order',
                },
                {
                    productId: 'ck-flt',
                    productName: 'Chicken Fillet',
                    condition: 'damaged_expired',
                    quantity: 1,
                    unitPrice: 45.0,
                    unitCost: 24.0,
                    reason: 'Dropped / spoiled',
                },
            ],
            refundMethod: 'cash',
        });

        service.approveReturn(draft.id, 'Supervisor Elena');

        const result = await service.completeReturn(draft.id);

        expect(result.returnDraft.status).toBe('completed');
        // 1 good item restocked into inventory shelf
        expect(mockStockMovementCreate).toHaveBeenCalledTimes(1);
        // 1 damaged item written off in waste log (NOT restocked)
        expect(mockWasteLogCreate).toHaveBeenCalledTimes(1);
        // Cash payout out of drawer
        expect(mockCashTransactionCreate).toHaveBeenCalledTimes(1);
        // Auto-posts GL journal
        expect(mockJournalEntryCreate).toHaveBeenCalledTimes(1);
    });

    test('converts packs/boxes to base UOM single units upon restock and stores in branch warehouse', async () => {
        let createdStockMovement: any = null;
        mockStockMovementCreate.mockImplementationOnce(async (callback) => {
            const rec: any = { id: 'sm-uom' };
            callback(rec);
            createdStockMovement = rec;
            return rec;
        });

        const draft = service.createReturnDraft({
            branchId: 'branch-001',
            warehouseId: 'wh-main-shelf',
            cashierId: 'cashier-1',
            items: [
                {
                    productId: 'ck-box-wings',
                    productName: 'Chicken Wings Box (12 pcs)',
                    condition: 'good_resellable',
                    quantity: 2, // 2 boxes
                    uom: 'box',
                    uomMultiplier: 12, // 12 pcs per box
                    unitPrice: 360.0,
                    unitCost: 180.0,
                    reason: 'Over-ordered',
                },
            ],
            refundMethod: 'cash',
        });

        service.approveReturn(draft.id, 'Supervisor Carlos');
        const res = await service.completeReturn(draft.id);

        expect(res.returnDraft.status).toBe('completed');
        expect(mockStockMovementCreate).toHaveBeenCalledTimes(1);
        // Rule: 2 boxes * 12 pcs/box = 24 single base units restocked
        expect(createdStockMovement.quantityIn).toBe(24);
        expect(createdStockMovement.quantityBalance).toBe(24);
        expect(createdStockMovement.branchId).toBe('branch-001');
        expect(createdStockMovement.warehouseId).toBe('wh-main-shelf');
    });

    test('Gate G-11: defends against rapid concurrent double-tap completion', async () => {
        const draft = service.createReturnDraft({
            branchId: 'branch-001',
            cashierId: 'cashier-1',
            items: [
                {
                    productId: 'ck-item',
                    productName: 'Fried Chicken',
                    condition: 'good_resellable',
                    quantity: 1,
                    unitPrice: 50.0,
                    reason: 'Wrong item',
                },
            ],
            refundMethod: 'cash',
        });

        service.approveReturn(draft.id, 'Supervisor Carlos');

        // Simulate concurrent double-tap
        const results = await Promise.allSettled([
            service.completeReturn(draft.id),
            service.completeReturn(draft.id),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        // Exactly one succeeds, the other is rejected by mutex
        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);
        expect(mockStockMovementCreate).toHaveBeenCalledTimes(1);
    });
});
