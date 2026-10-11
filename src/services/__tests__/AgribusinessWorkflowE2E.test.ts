import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { AgriParcelService } from '../AgriParcelService';
import { AgriCropCycleService } from '../AgriCropCycleService';
import { AgriHarvestService } from '../AgriHarvestService';
import { LandSettlementEngine } from '../LandSettlementEngine';
import { AgriFinanceAnalyticsService } from '../AgriFinanceAnalyticsService';
import AgriLandOwner from '../../database/models/AgriLandOwner';
import AgriInvestor from '../../database/models/AgriInvestor';
import AgriInvestorLedger from '../../database/models/AgriInvestorLedger';
import AgriFarmWorker from '../../database/models/AgriFarmWorker';
import AgriLaborLog from '../../database/models/AgriLaborLog';
import AgriFarmExpense from '../../database/models/AgriFarmExpense';

describe('Agribusiness Outgrower Platform — Full End-to-End Workflow Audit', () => {
    let database: Database;

    beforeEach(async () => {
        database = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('successfully executes the full 10-module lifecycle with mathematically correct invariants', async () => {
        // =========================================================================
        // STEP 1 & 2: Land Owner & Parcel Registration (Module 2: Land Parcels Registry)
        // =========================================================================
        let landOwner: AgriLandOwner | null = null;
        await database.write(async () => {
            landOwner = await database.get<AgriLandOwner>('agri_land_owners').create(record => {
                record.name = 'Don Ramon Valderrama';
                record.contactNumber = '0917-123-4567';
                record.defaultPerKiloRate = 1.0;
                record.defaultGuaranteedMinimum = 25000.0;
            });
        });
        expect(landOwner).toBeDefined();

        const parcel = await AgriParcelService.createParcel({
            name: 'Sunrise Valley Parcel A',
            code: 'PCL-SV-01',
            landOwnerId: landOwner!.id,
            areaHectares: 4.5,
            locationAddress: 'Brgy. San Jose, Tacurong City, Sultan Kudarat',
            soilType: 'Sandy Loam',
            status: 'available',
        }, database);

        expect(parcel.id).toBeDefined();
        expect(parcel.areaHectares).toBe(4.5);
        expect(parcel.status).toBe('available');

        // =========================================================================
        // STEP 3: GPS Boundary Mapping (Module 3: GPS Boundary Mapping)
        // =========================================================================
        const gpsCoords = [
            { latitude: 6.6900, longitude: 124.6700 },
            { latitude: 6.6920, longitude: 124.6700 },
            { latitude: 6.6920, longitude: 124.6720 },
            { latitude: 6.6900, longitude: 124.6720 },
        ];
        const calculatedHectares = AgriParcelService.calculatePolygonAreaHectares(gpsCoords);
        expect(calculatedHectares).toBeGreaterThan(0);

        const updatedParcel = await AgriParcelService.updateParcel(parcel.id, {
            gpsCoordinates: gpsCoords,
        }, database);
        expect(updatedParcel.gpsCoordinates).not.toBeNull();

        // =========================================================================
        // STEP 4: Investor Registration & Capital Injection (Module 7: BioGreen Investor Ledger)
        // =========================================================================
        let investor: AgriInvestor | null = null;
        await database.write(async () => {
            investor = await database.get<AgriInvestor>('agri_investors').create(record => {
                record.companyName = 'BioGreen Agri Solutions Inc.';
                record.contactPerson = 'Engr. Carlos Mendoza';
                record.contactNumber = '0920-555-8888';
                record.defaultOfftakePricePerKg = 4.0;
            });
        });
        expect(investor).toBeDefined();

        // Capital injection of ₱150,000
        await database.write(async () => {
            await database.get<AgriInvestorLedger>('agri_investor_ledgers').create(record => {
                record.investorId = investor!.id;
                record.cropCycleId = null;
                record.transactionDate = new Date();
                record.type = 'capital_injection';
                record.amount = 150000;
                record.balanceRunning = -150000;
                record.notes = 'Initial operating advance for Cassava cycle';
            });
        });

        // =========================================================================
        // STEP 5: Launch Crop Cycle & Growth Monitoring (Module 4: Cassava Crop Cycles)
        // =========================================================================
        const plantingDate = new Date('2026-01-10T00:00:00Z');
        const cycle = await AgriCropCycleService.createCropCycle({
            parcelId: parcel.id,
            investorId: investor!.id,
            cycleCode: 'CYC-2026-CAS-01',
            cropType: 'Cassava',
            variety: 'KU50 Industrial Starch',
            plantingDate,
            areaPlantedHa: 4.5,
            expectedYieldKg: 112500, // 4.5 ha * 25,000 kg/ha
            offtakePricePerKg: 4.0,
            landOwnerRatePerKg: 1.0,
            landOwnerGuaranteedMin: 25000.0,
        }, database);

        expect(cycle.status).toBe('planted');
        expect(cycle.expectedYieldKg).toBe(112500);

        // Verify parcel status automatically transitions to 'planted'
        const refreshedParcel = await database.get('agri_parcels').find(parcel.id);
        expect((refreshedParcel as any).status).toBe('planted');

        // Growth stage check-in
        const checkin = await AgriCropCycleService.addGrowthCheckin({
            cropCycleId: cycle.id,
            stage: 'vegetative',
            plantHeightCm: 95,
            healthStatus: 'excellent',
            notes: 'High canopy coverage, zero stem rot',
        }, database);
        expect(checkin.stage).toBe('vegetative');
        expect(checkin.healthStatus).toBe('excellent');

        // =========================================================================
        // STEP 6: Farm Labor Logging (Module 8: Farm Labor & Payroll)
        // =========================================================================
        let worker: AgriFarmWorker | null = null;
        await database.write(async () => {
            worker = await database.get<AgriFarmWorker>('agri_farm_workers').create(record => {
                record.name = 'Ramon Santos';
                record.contactNumber = '0917-888-1234';
                record.specialization = 'Harvester';
                record.dailyRate = 500;
                record.status = 'active';
            });
        });
        expect(worker).toBeDefined();

        await database.write(async () => {
            await database.get<AgriLaborLog>('agri_labor_logs').create(record => {
                record.workerId = worker!.id;
                record.cropCycleId = cycle.id;
                record.workDate = new Date();
                record.task = 'Harvesting & Root Pulling';
                record.rateType = 'daily';
                record.unitsCompleted = 5;
                record.ratePerUnit = 500;
                record.totalPay = 2500;
                record.paymentStatus = 'paid';
            });
        });

        // =========================================================================
        // STEP 7: Farm Input Expenses (Module 9: Farm Input Expenses)
        // =========================================================================
        await database.write(async () => {
            await database.get<AgriFarmExpense>('agri_farm_expenses').create(record => {
                record.cropCycleId = cycle.id;
                record.parcelId = parcel.id;
                record.expenseDate = new Date();
                record.category = 'fertilizer';
                record.description = 'Complete 14-14-14 fertilizer (20 sacks)';
                record.amount = 26000;
                record.paidBy = 'jet';
            });
        });

        // =========================================================================
        // STEP 8: Harvest Scale Weigh-In (Module 5: Harvest Scale Terminal)
        // Truck 1: 15,000 kg gross - 5,000 kg tare = 10,000 kg net
        // Truck 2: 25,000 kg gross - 5,000 kg tare = 20,000 kg net
        // Cumulative net = 30,000 kg
        // =========================================================================
        const harvestDate = new Date('2026-09-05T08:00:00Z');
        const batch1 = await AgriHarvestService.logWeighIn({
            cropCycleId: cycle.id,
            parcelId: parcel.id,
            harvestDate,
            grossWeightKg: 15000,
            tareWeightKg: 5000,
            qualityGrade: 'Grade A',
            truckPlateNumber: 'NBC-1234',
            weighInSupervisor: 'Mr. Jojet Montera',
        }, database);
        expect(batch1.netWeightKg).toBe(10000);

        const batch2 = await AgriHarvestService.logWeighIn({
            cropCycleId: cycle.id,
            parcelId: parcel.id,
            harvestDate,
            grossWeightKg: 25000,
            tareWeightKg: 5000,
            qualityGrade: 'Grade A',
            truckPlateNumber: 'NBC-5678',
            weighInSupervisor: 'Mr. Jojet Montera',
        }, database);
        expect(batch2.netWeightKg).toBe(20000);

        // Verify crop cycle status transitioned to 'harvesting' and yield updated
        const harvestedCycle = await database.get('agri_crop_cycles').find(cycle.id);
        expect((harvestedCycle as any).status).toBe('harvesting');
        expect((harvestedCycle as any).totalActualYieldKg).toBe(30000);

        // Verify harvest summary
        const harvestSummary = await AgriHarvestService.getCycleHarvestSummary(cycle.id, database);
        expect(harvestSummary.totalBatches).toBe(2);
        expect(harvestSummary.totalNetKg).toBe(30000);
        expect(harvestSummary.averageNetPerBatch).toBe(15000);

        // =========================================================================
        // STEP 9: Land Owner Settlement Calculation (Module 6: Land Owner Settlements)
        // 30,000 kg @ ₱1.00/kg = ₱30,000 raw earnings
        // Guaranteed minimum = ₱25,000
        // Target = MAX(₱30,000, ₱25,000) = ₱30,000
        // Net due this week = ₱30,000
        // =========================================================================
        const settlement = await LandSettlementEngine.computeWeeklySettlement(
            cycle.id,
            1,
            new Date('2026-09-01'),
            new Date('2026-09-07'),
            database
        );
        expect(settlement.cumulativeKilos).toBe(30000);
        expect(settlement.ratePerKilo).toBe(1.0);
        expect(settlement.rawKiloEarnings).toBe(30000);
        expect(settlement.guaranteedMinimum).toBe(25000);
        expect(settlement.targetCumulativePayout).toBe(30000);
        expect(settlement.netPayoutDueThisWeek).toBe(30000);

        // Approve and disburse settlement
        const approvedSettlement = await LandSettlementEngine.approveSettlement(
            settlement.id,
            true,
            new Date(),
            'CHK-2026-0091',
            database
        );
        expect(approvedSettlement.paymentStatus).toBe('paid');
        expect(approvedSettlement.receiptReference).toBe('CHK-2026-0091');

        // =========================================================================
        // STEP 10: Cycle P&L & Yield Analytics (Module 10: P&L & Yield Analytics)
        // Revenue: 30,000 kg * ₱4.00/kg = ₱120,000
        // Land Settlement: ₱30,000
        // Labor: ₱2,500
        // Farm Inputs: ₱26,000
        // Total Expenses: ₱58,500
        // Net Margin: ₱120,000 - ₱58,500 = ₱61,500
        // Profit Margin: (61,500 / 120,000) * 100 = 51.25%
        // Cost per Hectare: 58,500 / 4.5 = ₱13,000 / ha
        // Cost per Kilo: 58,500 / 30,000 = ₱1.95 / kg
        // =========================================================================
        const pnl = await AgriFinanceAnalyticsService.getCropCyclePnL(cycle.id, database);
        expect(pnl.grossRevenue).toBe(120000);
        expect(pnl.landOwnerSettlementCost).toBe(30000);
        expect(pnl.laborCost).toBe(2500);
        expect(pnl.farmExpenses).toBe(26000);
        expect(pnl.totalExpenses).toBe(58500);
        expect(pnl.netMargin).toBe(61500);
        expect(pnl.profitMarginPercent).toBe(51.25);
        expect(pnl.costPerHectare).toBe(13000);
        expect(pnl.costPerKilo).toBe(1.95);
    });
});
