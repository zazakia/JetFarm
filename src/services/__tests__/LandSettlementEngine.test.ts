import { LandSettlementEngine } from '../LandSettlementEngine';
import { formatPHP } from '../../utils/currency';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import AgriLandOwner from '../../database/models/AgriLandOwner';
import AgriParcel from '../../database/models/AgriParcel';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import AgriHarvestLog from '../../database/models/AgriHarvestLog';
import AgriWeeklySettlement from '../../database/models/AgriWeeklySettlement';

describe('LandSettlementEngine', () => {
    describe('calculateSettlement (Mathematical Invariants)', () => {
        it('Scenario 1: Early partial harvest below guaranteed minimum (5,000 kg)', () => {
            // Land Owner earns ₱1/kg, guarantee is ₱25,000.
            // 5,000 kg * ₱1 = ₱5,000.
            // Target is max(₱5,000, ₱25,000) = ₱25,000.
            // Previously paid = 0.
            // Net payout due = ₱25,000.
            const result = LandSettlementEngine.calculateSettlement(5000, 1.0, 25000, 0);

            expect(result.cumulativeKilos).toBe(5000);
            expect(result.rawKiloEarnings).toBe(5000);
            expect(result.guaranteedMinimum).toBe(25000);
            expect(result.targetCumulativePayout).toBe(25000);
            expect(result.netPayoutDueThisWeek).toBe(25000);
            expect(result.isMinimumApplied).toBe(true);
            expect(result.excessKilosOverGuarantee).toBe(0);
        });

        it('Scenario 2: Week 2 partial harvest (+8,000 kg -> cumulative 13,000 kg)', () => {
            // Raw earnings = 13,000 * ₱1 = ₱13,000.
            // Target is max(₱13,000, ₱25,000) = ₱25,000.
            // Previously paid in Week 1 = ₱25,000.
            // Net payout due = ₱25,000 - ₱25,000 = ₱0.
            const result = LandSettlementEngine.calculateSettlement(13000, 1.0, 25000, 25000);

            expect(result.cumulativeKilos).toBe(13000);
            expect(result.rawKiloEarnings).toBe(13000);
            expect(result.targetCumulativePayout).toBe(25000);
            expect(result.previousCumulativePayout).toBe(25000);
            expect(result.netPayoutDueThisWeek).toBe(0);
            expect(result.isMinimumApplied).toBe(true);
            expect(result.excessKilosOverGuarantee).toBe(0);
        });

        it('Scenario 3: Week 3 harvest crosses guarantee (+17,000 kg -> cumulative 30,000 kg)', () => {
            // Raw earnings = 30,000 * ₱1 = ₱30,000.
            // Target is max(₱30,000, ₱25,000) = ₱30,000.
            // Previously paid = ₱25,000.
            // Net payout due = ₱30,000 - ₱25,000 = ₱5,000.
            const result = LandSettlementEngine.calculateSettlement(30000, 1.0, 25000, 25000);

            expect(result.cumulativeKilos).toBe(30000);
            expect(result.rawKiloEarnings).toBe(30000);
            expect(result.targetCumulativePayout).toBe(30000);
            expect(result.netPayoutDueThisWeek).toBe(5000);
            expect(result.isMinimumApplied).toBe(false);
            expect(result.excessKilosOverGuarantee).toBe(5000);
        });

        it('Scenario 4: High volume harvest (45,000 kg @ ₱1.20/kg, ₱25,000 min, ₱30,000 previously paid)', () => {
            // Raw earnings = 45,000 * ₱1.20 = ₱54,000.
            // Target = ₱54,000.
            // Net payout due = ₱54,000 - ₱30,000 = ₱24,000.
            const result = LandSettlementEngine.calculateSettlement(45000, 1.20, 25000, 30000);

            expect(result.cumulativeKilos).toBe(45000);
            expect(result.rawKiloEarnings).toBe(54000);
            expect(result.targetCumulativePayout).toBe(54000);
            expect(result.netPayoutDueThisWeek).toBe(24000);
            expect(result.isMinimumApplied).toBe(false);
        });

        it('Scenario 5: Zero harvest with zero previous payout ensures minimum is preserved', () => {
            const result = LandSettlementEngine.calculateSettlement(0, 1.0, 25000, 0);

            expect(result.cumulativeKilos).toBe(0);
            expect(result.rawKiloEarnings).toBe(0);
            expect(result.targetCumulativePayout).toBe(25000);
            expect(result.netPayoutDueThisWeek).toBe(25000);
            expect(result.isMinimumApplied).toBe(true);
        });
    });

    describe('generateSettlementSlip', () => {
        it('formats a complete readable settlement slip with currency symbols', () => {
            const slip = LandSettlementEngine.generateSettlementSlip({
                settlementId: 'test-settlement-123',
                cropCycleCode: 'CYC-2026-PCL01',
                landOwnerName: 'Don Ramon Valderrama',
                parcelName: 'Parcel North Alpha',
                weekNumber: 3,
                weekStartDate: new Date('2026-10-01'),
                weekEndDate: new Date('2026-10-07'),
                cumulativeKilos: 32000,
                ratePerKilo: 1.0,
                rawKiloEarnings: 32000,
                guaranteedMinimum: 25000,
                targetCumulativePayout: 32000,
                previousCumulativePayout: 25000,
                netPayoutDueThisWeek: 7000,
                paymentStatus: 'approved',
                disbursementDate: new Date('2026-10-08'),
                receiptReference: 'CHK-998811',
            });

            expect(slip).toContain('AGRI-ONE AGRIBUSINESS PLATFORM');
            expect(slip).not.toMatch(/JETFARM|JetFarm/);
            expect(slip).toContain('Don Ramon Valderrama');
            expect(slip).toContain('CYC-2026-PCL01');
            expect(slip).toContain('32,000 kg');
            expect(slip).toContain(formatPHP(7000));
            expect(slip).toContain('CHK-998811');
            expect(slip).toContain('Audited & Guarantee-Protected by Agri-One Settlement Engine');

            // The banner is monospace-padded inside the rule; a mis-padded brand keeps the slip
            // readable but breaks the printed alignment, so pin the width.
            const banner = slip.split('\n').find(line => line.includes('AGRI-ONE'));
            expect(banner).toHaveLength(50);
        });
    });

    describe('computeWeeklySettlement database operations', () => {
        let database: Database;

        beforeEach(async () => {
            database = createTestDatabase();
        });

        afterEach(async () => {
            await closeTestDatabase(database);
        });

        it('updates existing draft settlement instead of creating duplicate records', async () => {
            let landOwner: AgriLandOwner;
            let parcel: AgriParcel;
            let cycle: AgriCropCycle;

            await database.write(async () => {
                landOwner = await database.get<AgriLandOwner>('agri_land_owners').create(r => {
                    r.name = 'Test Owner';
                    r.defaultPerKiloRate = 1.0;
                    r.defaultGuaranteedMinimum = 25000;
                });
                parcel = await database.get<AgriParcel>('agri_parcels').create(r => {
                    r.name = 'Test Parcel';
                    r.code = 'PCL-01';
                    r.landOwnerId = landOwner.id;
                    r.areaHectares = 2.0;
                    r.status = 'planted';
                });
                cycle = await database.get<AgriCropCycle>('agri_crop_cycles').create(r => {
                    r.cycleCode = 'CYC-01';
                    r.parcelId = parcel.id;
                    r.cropType = 'Cassava';
                    r.plantingDate = new Date('2026-01-01');
                    r.areaPlantedHa = 2.0;
                    r.status = 'harvesting';
                    r.totalActualYieldKg = 10000;
                    r.landOwnerRatePerKg = 1.0;
                    r.landOwnerGuaranteedMin = 25000;
                });
                await database.get<AgriHarvestLog>('agri_harvest_logs').create(r => {
                    r.cropCycleId = cycle.id;
                    r.parcelId = parcel.id;
                    r.batchNumber = 'BATCH-001';
                    r.harvestDate = new Date('2026-02-01');
                    r.grossWeightKg = 14000;
                    r.tareWeightKg = 4000;
                    r.netWeightKg = 10000;
                });
            });

            // 1st compute: creates draft
            const settlement1 = await LandSettlementEngine.computeWeeklySettlement(
                cycle!.id,
                1,
                new Date('2026-02-01'),
                new Date('2026-02-07'),
                database
            );
            expect(settlement1.paymentStatus).toBe('draft');
            expect(settlement1.cumulativeKilos).toBe(10000);

            // Add another harvest log for 5,000 kg
            await database.write(async () => {
                await database.get<AgriHarvestLog>('agri_harvest_logs').create(r => {
                    r.cropCycleId = cycle.id;
                    r.parcelId = parcel.id;
                    r.batchNumber = 'BATCH-002';
                    r.harvestDate = new Date('2026-02-03');
                    r.grossWeightKg = 9000;
                    r.tareWeightKg = 4000;
                    r.netWeightKg = 5000;
                });
            });

            // 2nd compute for same week: should update draft in-place, NOT create duplicate
            const settlement2 = await LandSettlementEngine.computeWeeklySettlement(
                cycle!.id,
                1,
                new Date('2026-02-01'),
                new Date('2026-02-07'),
                database
            );

            expect(settlement2.id).toBe(settlement1.id);
            expect(settlement2.cumulativeKilos).toBe(15000);

            // Verify total records in table for week 1 is exactly 1
            const allSettlements = await database.get<AgriWeeklySettlement>('agri_weekly_settlements').query().fetch();
            expect(allSettlements.length).toBe(1);
        });

        it('rejects recomputing if week settlement is already approved or paid', async () => {
            let cycle: AgriCropCycle;
            await database.write(async () => {
                const landOwner = await database.get<AgriLandOwner>('agri_land_owners').create(r => {
                    r.name = 'Test Owner 2';
                    r.defaultPerKiloRate = 1.0;
                    r.defaultGuaranteedMinimum = 25000;
                });
                const parcel = await database.get<AgriParcel>('agri_parcels').create(r => {
                    r.name = 'Test Parcel 2';
                    r.code = 'PCL-02';
                    r.landOwnerId = landOwner.id;
                    r.areaHectares = 2.0;
                    r.status = 'planted';
                });
                cycle = await database.get<AgriCropCycle>('agri_crop_cycles').create(r => {
                    r.cycleCode = 'CYC-02';
                    r.parcelId = parcel.id;
                    r.cropType = 'Cassava';
                    r.plantingDate = new Date('2026-01-01');
                    r.areaPlantedHa = 2.0;
                    r.status = 'harvesting';
                    r.totalActualYieldKg = 10000;
                    r.landOwnerRatePerKg = 1.0;
                    r.landOwnerGuaranteedMin = 25000;
                });
                await database.get<AgriWeeklySettlement>('agri_weekly_settlements').create(r => {
                    r.cropCycleId = cycle.id;
                    r.landOwnerId = landOwner.id;
                    r.weekNumber = 1;
                    r.weekStartDate = new Date('2026-02-01');
                    r.weekEndDate = new Date('2026-02-07');
                    r.cumulativeKilos = 10000;
                    r.ratePerKilo = 1.0;
                    r.rawKiloEarnings = 10000;
                    r.guaranteedMinimum = 25000;
                    r.targetCumulativePayout = 25000;
                    r.previousCumulativePayout = 0;
                    r.netPayoutDueThisWeek = 25000;
                    r.paymentStatus = 'approved';
                });
            });

            await expect(LandSettlementEngine.computeWeeklySettlement(
                cycle!.id,
                1,
                new Date('2026-02-01'),
                new Date('2026-02-07'),
                database
            )).rejects.toThrow(/already approved/i);
        });
    });
});
