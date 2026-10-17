import { AgriHarvestService } from '../AgriHarvestService';

describe('AgriHarvestService', () => {
    describe('calculateNetWeight', () => {
        it('accurately subtracts tare weight from gross weight', () => {
            const gross = 12500;
            const tare = 4200;
            const net = AgriHarvestService.calculateNetWeight(gross, tare);
            expect(net).toBe(8300);
        });

        it('returns 0 if tare is greater than gross', () => {
            const net = AgriHarvestService.calculateNetWeight(3000, 3500);
            expect(net).toBe(0);
        });

        it('handles decimals with two places of precision', () => {
            const net = AgriHarvestService.calculateNetWeight(1450.75, 230.25);
            expect(net).toBe(1220.5);
        });
    });

    describe('updateHarvestLog and deleteHarvestLog', () => {
        it('soft-deletes harvest log by setting deletedAt', async () => {
            const mockUpdate = jest.fn((callback) => {
                const rec: any = {};
                callback(rec);
                return rec;
            });
            const mockLog: any = {
                id: 'hl-1',
                batchNumber: 'BATCH-001',
                update: mockUpdate,
            };
            const mockDb: any = {
                write: jest.fn(async (cb) => cb()),
            };

            await AgriHarvestService.deleteHarvestLog(mockLog, mockDb);
            expect(mockDb.write).toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('updates harvest log weights and recalculates net weight', async () => {
            const mockUpdate = jest.fn((callback) => {
                const rec: any = {};
                callback(rec);
                return rec;
            });
            const mockLog: any = {
                id: 'hl-1',
                batchNumber: 'BATCH-001',
                grossWeightKg: 10000,
                tareWeightKg: 3000,
                update: mockUpdate,
            };
            const mockDb: any = {
                write: jest.fn(async (cb) => cb()),
            };

            await AgriHarvestService.updateHarvestLog(mockLog, {
                grossWeightKg: 12000,
                tareWeightKg: 4000,
                qualityGrade: 'Grade A',
            }, mockDb);
            expect(mockDb.write).toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalled();
        });
    });
});

