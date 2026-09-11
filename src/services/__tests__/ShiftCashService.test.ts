import { ShiftCashService, CashDenominations, ShiftSummaryInput } from '../ShiftCashService';
import { database } from '../../database';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((cb) => cb()),
        collections: {},
    },
}));

describe('ShiftCashService', () => {
    describe('calculateCashDenominationTotal', () => {
        it('correctly calculates total from denomination breakdown', () => {
            const breakdown: CashDenominations = {
                p1000: 5, // 5,000
                p500: 4,  // 2,000
                p200: 3,  // 600
                p100: 10, // 1,000
                p50: 8,   // 400
                p20: 15,  // 300
                coins: 45.50, // 45.50
            }; // Total = 9,345.50

            const total = ShiftCashService.calculateCashDenominationTotal(breakdown);
            expect(total).toBe(9345.50);
        });

        it('handles all zeros correctly', () => {
            const empty: CashDenominations = {
                p1000: 0,
                p500: 0,
                p200: 0,
                p100: 0,
                p50: 0,
                p20: 0,
                coins: 0,
            };
            expect(ShiftCashService.calculateCashDenominationTotal(empty)).toBe(0);
        });
    });

    describe('generateXReading', () => {
        it('calculates mid-shift X-Reading expected cash correctly', () => {
            const shiftInput: ShiftSummaryInput = {
                branchId: 'branch-bagacay',
                cashierId: 'user-cashier-1',
                openingFloat: 2000.0,
                grossSales: 15450.0,
                cashSales: 12000.0,
                nonCashSales: 3450.0,
                totalDrops: 8000.0, // Mid-shift safe drop
                orderCount: 48,
            };

            const xReading = ShiftCashService.generateXReading(shiftInput);

            expect(xReading.openingFloat).toBe(2000.0);
            expect(xReading.cashSales).toBe(12000.0);
            expect(xReading.totalDrops).toBe(8000.0);
            // Expected drawer cash = openingFloat + cashSales - totalDrops = 2000 + 12000 - 8000 = 6000
            expect(xReading.expectedDrawerCash).toBe(6000.0);
            expect(xReading.orderCount).toBe(48);
        });
    });

    describe('closeShiftZReading', () => {
        const shiftInput: ShiftSummaryInput = {
            branchId: 'branch-bagacay',
            cashierId: 'user-cashier-1',
            openingFloat: 2000.0,
            grossSales: 25000.0,
            cashSales: 20000.0,
            nonCashSales: 5000.0,
            totalDrops: 15000.0,
            orderCount: 82,
        }; // Expected cash = 2000 + 20000 - 15000 = 7000.00

        it('detects exact balance when counted cash matches expected', () => {
            const exactCount: CashDenominations = {
                p1000: 7,
                p500: 0,
                p200: 0,
                p100: 0,
                p50: 0,
                p20: 0,
                coins: 0,
            }; // Exactly 7,000

            const zReading = ShiftCashService.computeZReading(shiftInput, exactCount);

            expect(zReading.expectedDrawerCash).toBe(7000.0);
            expect(zReading.actualCashCount).toBe(7000.0);
            expect(zReading.variance).toBe(0);
            expect(zReading.varianceStatus).toBe('exact');
        });

        it('detects cash overage correctly', () => {
            const overCount: CashDenominations = {
                p1000: 7,
                p500: 0,
                p200: 0,
                p100: 1, // 100 over!
                p50: 0,
                p20: 0,
                coins: 0,
            }; // 7,100

            const zReading = ShiftCashService.computeZReading(shiftInput, overCount);

            expect(zReading.expectedDrawerCash).toBe(7000.0);
            expect(zReading.actualCashCount).toBe(7100.0);
            expect(zReading.variance).toBe(100.0);
            expect(zReading.varianceStatus).toBe('over');
        });

        it('detects cash shortage correctly', () => {
            const shortCount: CashDenominations = {
                p1000: 6,
                p500: 1,
                p200: 2, // 6900 (100 short)
                p100: 0,
                p50: 0,
                p20: 0,
                coins: 0,
            }; // 6,900

            const zReading = ShiftCashService.computeZReading(shiftInput, shortCount);

            expect(zReading.expectedDrawerCash).toBe(7000.0);
            expect(zReading.actualCashCount).toBe(6900.0);
            expect(zReading.variance).toBe(-100.0);
            expect(zReading.varianceStatus).toBe('short');
        });
    });

    describe('openShift and blindCloseShift', () => {
        let service: ShiftCashService;
        let mockSessions: any[];
        let mockCashTxns: any[];

        beforeEach(() => {
            mockSessions = [];
            mockCashTxns = [];

            const mockSessionCollection = {
                create: jest.fn().mockImplementation(async (cb) => {
                    const session: any = { id: 'sess-1' };
                    cb(session);
                    mockSessions.push(session);
                    return session;
                }),
                find: jest.fn().mockImplementation(async (id) => {
                    return mockSessions.find((s) => s.id === id);
                }),
            };

            const mockCashCollection = {
                create: jest.fn().mockImplementation(async (cb) => {
                    const txn: any = { id: 'cash-txn-1' };
                    cb(txn);
                    mockCashTxns.push(txn);
                    return txn;
                }),
            };

            const mockDb: any = {
                write: jest.fn().mockImplementation(async (cb) => cb()),
                get: jest.fn((table) => {
                    if (table === 'pos_sessions') return mockSessionCollection;
                    if (table === 'cash_transactions') return mockCashCollection;
                    return {};
                }),
            };

            service = new ShiftCashService(mockDb);
        });

        it('opens shift, sets branchId and registers pos session', async () => {
            const txnId = await service.openShift('branch-001', 'cashier-1', 2500, 'Morning Shift');
            expect(txnId).toBe('cash-txn-1');
            expect(mockSessions.length).toBe(1);
            expect(mockSessions[0].branchId).toBe('branch-001');
            expect(mockSessions[0].openingFloat).toBe(2500);
            expect(mockSessions[0].status).toBe('open');

            expect(mockCashTxns.length).toBe(1);
            expect(mockCashTxns[0].branchId).toBe('branch-001');
            expect(mockCashTxns[0].posSessionId).toBe('sess-1');
        });

        it('performs blind close shift without pre-revealing expected drawer cash', async () => {
            const session: any = {
                id: 'sess-blind-1',
                branchId: 'branch-001',
                openingFloat: 1000,
                status: 'open',
                update: jest.fn().mockImplementation(async (cb) => cb(session)),
            };
            mockSessions.push(session);

            const shiftSummary: ShiftSummaryInput = {
                branchId: 'branch-001',
                cashierId: 'cashier-1',
                openingFloat: 1000,
                grossSales: 5000,
                cashSales: 4000,
                nonCashSales: 1000,
                totalDrops: 2000,
                orderCount: 15,
            }; // Expected drawer cash = 1000 + 4000 - 2000 = 3000

            // Cashier blinds counts: 3 x 1000 bills = 3000
            const blindCount: CashDenominations = {
                p1000: 3,
                p500: 0,
                p200: 0,
                p100: 0,
                p50: 0,
                p20: 0,
                coins: 0,
            };

            const zReport = await service.blindCloseShift('sess-blind-1', blindCount, 'Supervisor Alan', shiftSummary);
            expect(zReport.actualCashCount).toBe(3000);
            expect(zReport.expectedDrawerCash).toBe(3000);
            expect(zReport.variance).toBe(0);
            expect(zReport.varianceStatus).toBe('exact');
            expect(session.status).toBe('closed');
        });
    });
});
