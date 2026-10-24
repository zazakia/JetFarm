import { AgriHarvestService } from '../AgriHarvestService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import AgriHarvestLog from '../../database/models/AgriHarvestLog';
import AgriParcel from '../../database/models/AgriParcel';
import AgriLandOwner from '../../database/models/AgriLandOwner';

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

        it('recalculates crop cycle totalActualYieldKg when log is updated or deleted in database', async () => {
            const database = createTestDatabase();
            try {
                let parcel: AgriParcel;
                let cycle: AgriCropCycle;
                let log1: AgriHarvestLog;
                let log2: AgriHarvestLog;

                await database.write(async () => {
                    const landOwner = await database.get<AgriLandOwner>('agri_land_owners').create(r => {
                        r.name = 'Test Landowner';
                    });
                    parcel = await database.get<AgriParcel>('agri_parcels').create(r => {
                        r.name = 'Test Parcel';
                        r.code = 'PCL-01';
                        r.landOwnerId = landOwner.id;
                        r.areaHectares = 2.0;
                    });
                    cycle = await database.get<AgriCropCycle>('agri_crop_cycles').create(r => {
                        r.cycleCode = 'CYC-01';
                        r.parcelId = parcel.id;
                        r.cropType = 'Cassava';
                        r.plantingDate = new Date('2026-01-01');
                        r.areaPlantedHa = 2.0;
                        r.status = 'harvesting';
                        r.totalActualYieldKg = 15000;
                    });
                    log1 = await database.get<AgriHarvestLog>('agri_harvest_logs').create(r => {
                        r.cropCycleId = cycle.id;
                        r.parcelId = parcel.id;
                        r.batchNumber = 'BATCH-001';
                        r.harvestDate = new Date();
                        r.grossWeightKg = 14000;
                        r.tareWeightKg = 4000;
                        r.netWeightKg = 10000;
                    });
                    log2 = await database.get<AgriHarvestLog>('agri_harvest_logs').create(r => {
                        r.cropCycleId = cycle.id;
                        r.parcelId = parcel.id;
                        r.batchNumber = 'BATCH-002';
                        r.harvestDate = new Date();
                        r.grossWeightKg = 9000;
                        r.tareWeightKg = 4000;
                        r.netWeightKg = 5000;
                    });
                });

                // Update log1 from 10,000 kg net to 8,000 kg net (12,000 - 4,000)
                await AgriHarvestService.updateHarvestLog(log1!, {
                    grossWeightKg: 12000,
                    tareWeightKg: 4000,
                }, database);

                const refreshedCycleAfterUpdate = await database.get<AgriCropCycle>('agri_crop_cycles').find(cycle!.id);
                // Total should now be 8,000 + 5,000 = 13,000 kg
                expect(refreshedCycleAfterUpdate.totalActualYieldKg).toBe(13000);

                // Soft-delete log2 (5,000 kg)
                await AgriHarvestService.deleteHarvestLog(log2!, database);

                const refreshedCycleAfterDelete = await database.get<AgriCropCycle>('agri_crop_cycles').find(cycle!.id);
                // Total should now be 8,000 kg
                expect(refreshedCycleAfterDelete.totalActualYieldKg).toBe(8000);
            } finally {
                await closeTestDatabase(database);
            }
        });
    });
});

