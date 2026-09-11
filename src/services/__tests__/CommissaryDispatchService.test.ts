import { CommissaryDispatchService, CreateDispatchInput } from '../CommissaryDispatchService';
import { database } from '../../database';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((cb) => cb()),
        collections: {},
    },
}));

describe('CommissaryDispatchService', () => {
    let mockDispatchCollection: any;
    let mockStockMovementCollection: any;
    let mockDispatches: any[];
    let mockMovements: any[];

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatches = [];
        mockMovements = [];

        mockDispatchCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = { id: `disp-${Date.now()}` };
                cb(record);
                mockDispatches.push(record);
                return record;
            }),
            find: jest.fn().mockImplementation(async (id: string) => {
                const found = mockDispatches.find((d) => d.id === id);
                if (!found) throw new Error('Not found');
                return found;
            }),
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockImplementation(async () => mockDispatches),
            }),
        };

        mockStockMovementCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = { id: `sm-${Date.now()}` };
                cb(record);
                mockMovements.push(record);
                return record;
            }),
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue([]),
            }),
        };

        (database.get as jest.Mock).mockImplementation((table: string) => {
            if (table === 'commissary_dispatches') return mockDispatchCollection;
            if (table === 'stock_movements') return mockStockMovementCollection;
            return {
                create: jest.fn().mockImplementation((cb) => {
                    const record: any = { id: `rec-${Date.now()}` };
                    cb(record);
                    return record;
                }),
                query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
            };
        });
    });

    describe('createDispatch', () => {
        const input: CreateDispatchInput = {
            fromLocation: 'Main Office Commissary',
            toBranchId: 'branch-bagacay',
            poReference: 'PO-2026-0701',
            dispatchedBy: 'commissary-keeper-1',
            items: [
                {
                    productId: 'ck-chicken-raw',
                    productName: 'Marinated S-Cut Chicken (Kilos)',
                    quantityExpected: 200,
                    uom: 'kg',
                    unitCost: 140.0,
                },
                {
                    productId: 'ck-breading',
                    productName: 'Crispy King Breading Mix',
                    quantityExpected: 15,
                    uom: 'bag',
                    unitCost: 250.0,
                },
            ],
        };

        it('creates a new dispatch record in draft status with correct total amount', async () => {
            const dispatch = await CommissaryDispatchService.createDispatch(input);

            expect(dispatch).toBeDefined();
            expect(dispatch.fromLocation).toBe('Main Office Commissary');
            expect(dispatch.toBranchId).toBe('branch-bagacay');
            expect(dispatch.status).toBe('draft');
            // 200 * 140 = 28,000; 15 * 250 = 3,750; Total = 31,750
            expect(dispatch.totalAmount).toBe(31750.0);
            expect(dispatch.dispatchNumber).toMatch(/^DSP-\d{8}-\d{4}$/);
            expect(mockDispatchCollection.create).toHaveBeenCalledTimes(1);
        });

        it('throws error when items array is empty', async () => {
            await expect(
                CommissaryDispatchService.createDispatch({
                    ...input,
                    items: [],
                })
            ).rejects.toThrow('Dispatch must contain at least one item');
        });
    });

    describe('markInTransit', () => {
        it('transitions status from draft to in_transit and sets dispatchedAt', async () => {
            const mockRecord: any = {
                id: 'disp-001',
                status: 'draft',
                dispatchedAt: null,
                update: jest.fn().mockImplementation((cb) => {
                    cb(mockRecord);
                    return Promise.resolve(mockRecord);
                }),
            };
            mockDispatches.push(mockRecord);

            const updated = await CommissaryDispatchService.markInTransit('disp-001');

            expect(updated.status).toBe('in_transit');
            expect(updated.dispatchedAt).toBeDefined();
            expect(mockRecord.update).toHaveBeenCalled();
        });
    });

    describe('receiveDispatch', () => {
        it('calculates line item variances between expected and received stock', async () => {
            const items = [
                {
                    productId: 'ck-chicken-raw',
                    productName: 'Marinated S-Cut Chicken',
                    quantityExpected: 100,
                    uom: 'kg',
                    unitCost: 140.0,
                },
                {
                    productId: 'ck-breading',
                    productName: 'Crispy King Breading Mix',
                    quantityExpected: 20,
                    uom: 'bag',
                    unitCost: 250.0,
                },
            ];

            const mockRecord: any = {
                id: 'disp-002',
                status: 'in_transit',
                itemsJson: JSON.stringify(items),
                items,
                receivedBy: null,
                receivedAt: null,
                update: jest.fn().mockImplementation((cb) => {
                    cb(mockRecord);
                    return Promise.resolve(mockRecord);
                }),
            };
            mockDispatches.push(mockRecord);

            const received = await CommissaryDispatchService.receiveDispatch(
                'disp-002',
                [
                    { productId: 'ck-chicken-raw', quantityReceived: 95, notes: '5kg shortage in pack 3' },
                    { productId: 'ck-breading', quantityReceived: 20 },
                ],
                'branch-manager-bagacay'
            );

            expect(received.status).toBe('received');
            expect(received.receivedBy).toBe('branch-manager-bagacay');
            expect(received.receivedAt).toBeDefined();

            const parsedItems = JSON.parse(mockRecord.itemsJson);
            expect(parsedItems[0].quantityReceived).toBe(95);
            expect(parsedItems[0].variance).toBe(-5); // Shortage
            expect(parsedItems[1].quantityReceived).toBe(20);
            expect(parsedItems[1].variance).toBe(0); // Exact
        });
    });

    describe('verifyAndPostToInventory', () => {
        it('creates stock movements and sets status to verified', async () => {
            const items = [
                {
                    productId: 'ck-chicken-raw',
                    productName: 'Marinated S-Cut Chicken',
                    quantityExpected: 100,
                    quantityReceived: 95,
                    variance: -5,
                    uom: 'kg',
                    unitCost: 140.0,
                },
            ];

            const mockRecord: any = {
                id: 'disp-003',
                dispatchNumber: 'DSP-20260910-0001',
                toBranchId: 'branch-bagacay',
                status: 'received',
                itemsJson: JSON.stringify(items),
                items,
                verifiedBy: null,
                verifiedAt: null,
                update: jest.fn().mockImplementation((cb) => {
                    cb(mockRecord);
                    return Promise.resolve(mockRecord);
                }),
            };
            mockDispatches.push(mockRecord);

            const verified = await CommissaryDispatchService.verifyAndPostToInventory(
                'disp-003',
                'supervisor-jumar'
            );

            expect(verified.status).toBe('verified');
            expect(verified.verifiedBy).toBe('supervisor-jumar');
            expect(mockStockMovementCollection.create).toHaveBeenCalledTimes(1);
            expect(mockMovements[0].movementType).toBe('transfer');
            expect(mockMovements[0].quantityIn).toBe(95);
        });
    });

    describe('disputeDispatch', () => {
        it('flags dispatch with disputed status and appends investigation notes', async () => {
            const mockRecord: any = {
                id: 'disp-004',
                status: 'received',
                notes: 'Initial delivery',
                update: jest.fn().mockImplementation((cb) => {
                    cb(mockRecord);
                    return Promise.resolve(mockRecord);
                }),
            };
            mockDispatches.push(mockRecord);

            const disputed = await CommissaryDispatchService.disputeDispatch(
                'disp-004',
                'Major 20kg unsealed water-logged chicken'
            );

            expect(disputed.status).toBe('disputed');
            expect(mockRecord.notes).toContain('DISPUTE: Major 20kg unsealed water-logged chicken');
        });
    });
});
