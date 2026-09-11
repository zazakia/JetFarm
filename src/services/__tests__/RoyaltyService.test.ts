import { RoyaltyService } from '../RoyaltyService';
import { database } from '../../database';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((cb) => cb()),
        collections: {
            get: jest.fn(),
        },
    },
}));

describe('RoyaltyService', () => {
    let mockRoyaltyRecords: any[];
    let mockAPRecords: any[];
    let mockRoyaltyCollection: any;
    let mockAPCollection: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockRoyaltyRecords = [];
        mockAPRecords = [];

        mockRoyaltyCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = {
                    id: `roy-${Date.now()}`,
                    update: jest.fn().mockImplementation((updater) => {
                        updater(record);
                        return Promise.resolve(record);
                    }),
                };
                cb(record);
                mockRoyaltyRecords.push(record);
                return record;
            }),
            find: jest.fn().mockImplementation(async (id: string) => {
                const found = mockRoyaltyRecords.find((r) => r.id === id);
                if (!found) throw new Error('Not found');
                return found;
            }),
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockImplementation(async () => mockRoyaltyRecords),
            }),
        };

        mockAPCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = { id: `apv-${Date.now()}` };
                cb(record);
                mockAPRecords.push(record);
                return record;
            }),
        };

        (database.get as jest.Mock).mockImplementation((table: string) => {
            if (table === 'royalty_calculations') return mockRoyaltyCollection;
            if (table === 'accounts_payable_vouchers') return mockAPCollection;
            return {
                query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
                create: jest.fn().mockImplementation((cb) => {
                    const record: any = { id: `rec-${Date.now()}` };
                    cb(record);
                    return record;
                }),
            };
        });
    });

    describe('calculateMonthlyRoyalty', () => {
        it('accurately computes the 80/20 Operator/Franchisor split from branch net income', async () => {
            const result = await RoyaltyService.calculateMonthlyRoyalty({
                branchId: 'branch-bagacay',
                year: 2026,
                month: 7,
                grossSales: 512383.0,
                cogs: 332893.88,
                opex: 160446.22,
            });

            expect(result).toBeDefined();
            expect(result.branchId).toBe('branch-bagacay');
            expect(result.grossSales).toBe(512383.0);
            expect(result.cogs).toBe(332893.88);
            expect(result.cogsRatio).toBeCloseTo(64.97, 1);
            expect(result.opex).toBe(160446.22);
            expect(result.netIncome).toBeCloseTo(19042.90, 1);
            expect(result.netMargin).toBeCloseTo(3.72, 1);

            // 80% Operator share: 19042.90 * 0.80 = 15234.32
            expect(result.operatorShare).toBeCloseTo(15234.32, 1);
            // 20% Franchisor share: 19042.90 * 0.20 = 3808.58
            expect(result.franchisorShare).toBeCloseTo(3808.58, 1);
            expect(result.status).toBe('computed');
            expect(mockRoyaltyCollection.create).toHaveBeenCalled();
        });

        it('handles negative net income with zero royalty share (no franchisor dividend on loss)', async () => {
            const result = await RoyaltyService.calculateMonthlyRoyalty({
                branchId: 'branch-struggling',
                year: 2026,
                month: 7,
                grossSales: 200000.0,
                cogs: 150000.0,
                opex: 70000.0, // Loss: 200k - 150k - 70k = -20k
            });

            expect(result.netIncome).toBe(-20000.0);
            expect(result.operatorShare).toBe(0);
            expect(result.franchisorShare).toBe(0);
        });
    });

    describe('approveRoyaltySettlement', () => {
        it('approves settlement and creates AP voucher for 20% franchisor share', async () => {
            const record: any = {
                id: 'roy-001',
                branchId: 'branch-bagacay',
                periodYear: 2026,
                periodMonth: 7,
                franchisorShare: 3808.58,
                status: 'computed',
                approvedBy: null,
                approvedAt: null,
                apVoucherId: null,
                update: jest.fn().mockImplementation((updater) => {
                    updater(record);
                    return Promise.resolve(record);
                }),
            };
            mockRoyaltyRecords.push(record);

            const approved = await RoyaltyService.approveRoyaltySettlement('roy-001', 'executive-viterbo');

            expect(approved.status).toBe('approved');
            expect(approved.approvedBy).toBe('executive-viterbo');
            expect(approved.approvedAt).toBeDefined();

            // Check AP voucher creation
            expect(mockAPCollection.create).toHaveBeenCalled();
            expect(mockAPRecords[0].supplierId).toContain('ERT-Crispy King Ventures');
            expect(mockAPRecords[0].amount).toBe(3808.58);
            expect(approved.apVoucherId).toBe(mockAPRecords[0].id);
        });
    });
});
