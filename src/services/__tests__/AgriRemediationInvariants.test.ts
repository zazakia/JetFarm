import { database } from '../../database';
import { AutoPostingService } from '../AutoPostingService';
import { LandSettlementEngine } from '../LandSettlementEngine';
import { AgriHarvestService } from '../AgriHarvestService';
import { AgriCropCycleService } from '../AgriCropCycleService';
import { AgriParcelService } from '../AgriParcelService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase } from '../../__tests__/test-utils';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import AgriHarvestLog from '../../database/models/AgriHarvestLog';
import AgriWeeklySettlement from '../../database/models/AgriWeeklySettlement';
import AgriLandOwner from '../../database/models/AgriLandOwner';
import AgriParcel from '../../database/models/AgriParcel';
import JournalEntry from '../../database/models/JournalEntry';
import JournalEntryLine from '../../database/models/JournalEntryLine';

describe('Agribusiness Remediation: Workflow, Auto-Posting & Reversal Invariants', () => {
    let testDb: any;

    beforeEach(async () => {
        testDb = createTestDatabase();
        (JournalEntryService as any).db = testDb;
        (ChartOfAccountsService as any).db = testDb;
        (AutoPostingService as any).db = testDb;
        (AutoPostingService as any).journalEntryService = new (require('../JournalEntryService').JournalEntryServiceClass)(testDb);
        await ChartOfAccountsService.seed('TestUser');
    });

    it('settlement approval followed by disbursement must clear 2035 payable without double-debiting 5160 expense', async () => {
        // Create land owner, parcel, crop cycle
        let landOwner: any;
        let parcel: any;
        let cycle: any;
        let settlement: any;

        await testDb.write(async () => {
            landOwner = await testDb.get('agri_land_owners').create((r: any) => {
                r.name = 'Don Emilio';
                r.defaultPerKiloRate = 1.0;
                r.defaultGuaranteedMinimum = 25000.0;
            });
            parcel = await testDb.get('agri_parcels').create((r: any) => {
                r.name = 'Hacienda San Jose';
                r.code = 'HSJ-01';
                r.landOwnerId = landOwner.id;
                r.areaHectares = 10;
                r.status = 'planted';
            });
            cycle = await testDb.get('agri_crop_cycles').create((r: any) => {
                r.cycleCode = 'CYC-2026-HSJ';
                r.parcelId = parcel.id;
                r.areaPlantedHa = 10;
                r.status = 'harvesting';
                r.landOwnerRatePerKg = 1.0;
                r.landOwnerGuaranteedMin = 25000.0;
                r.offtakePricePerKg = 4.0;
                r.totalActualYieldKg = 0;
            });
        });

        // 1. Compute settlement for week 1 (0 kilos, 25k guarantee)
        settlement = await LandSettlementEngine.computeWeeklySettlement(
            cycle.id,
            1,
            new Date('2026-10-01'),
            new Date('2026-10-07'),
            testDb
        );

        expect(settlement.netPayoutDueThisWeek).toBe(25000);
        expect(settlement.paymentStatus).toBe('draft');

        // 2. Step 1: Approve settlement (markAsPaid = false)
        await LandSettlementEngine.approveSettlement(settlement.id, false, new Date(), undefined, testDb);

        // Fetch journal entries
        const entriesAfterApproval = await testDb.get('journal_entries').query().fetch();
        expect(entriesAfterApproval.length).toBe(1);

        const linesAfterApproval = await testDb.get('journal_entry_lines').query().fetch();
        const debit5160 = linesAfterApproval.find((l: any) => l.accountCode === '5160');
        const credit2035 = linesAfterApproval.find((l: any) => l.accountCode === '2035');

        expect(debit5160).toBeDefined();
        expect(debit5160.debitAmount).toBe(25000);
        expect(credit2035).toBeDefined();
        expect(credit2035.creditAmount).toBe(25000);

        // 3. Step 2: Disburse settlement (markAsPaid = true)
        await LandSettlementEngine.approveSettlement(settlement.id, true, new Date(), 'CHK-123456', testDb);

        const entriesAfterDisbursement = await testDb.get('journal_entries').query().fetch();
        expect(entriesAfterDisbursement.length).toBe(2);

        const allLines = await testDb.get('journal_entry_lines').query().fetch();
        
        // Sum total debits for 5160 across all lines
        const totalDebits5160 = allLines
            .filter((l: any) => l.accountCode === '5160')
            .reduce((sum: number, l: any) => sum + (l.debitAmount || 0), 0);
        
        // Expense 5160 must ONLY be debited ONCE (₱25,000), not twice (₱50,000)!
        expect(totalDebits5160).toBe(25000);

        // Second entry must clear 2035 (DR 2035, CR 1010)
        const secondEntryLines = allLines.filter((l: any) => l.journalEntryId === entriesAfterDisbursement[1].id);
        const debit2035 = secondEntryLines.find((l: any) => l.accountCode === '2035');
        const credit1010 = secondEntryLines.find((l: any) => l.accountCode === '1010');

        expect(debit2035).toBeDefined();
        expect(debit2035.debitAmount).toBe(25000);
        expect(credit1010).toBeDefined();
        expect(credit1010.creditAmount).toBe(25000);
    });

    it('soft-deleting an operational settlement must automatically generate a reversing journal entry', async () => {
        let landOwner: any;
        let parcel: any;
        let cycle: any;
        let settlement: any;

        await testDb.write(async () => {
            landOwner = await testDb.get('agri_land_owners').create((r: any) => {
                r.name = 'Don Emilio';
                r.defaultPerKiloRate = 1.0;
                r.defaultGuaranteedMinimum = 25000.0;
            });
            parcel = await testDb.get('agri_parcels').create((r: any) => {
                r.name = 'Hacienda San Jose';
                r.code = 'HSJ-01';
                r.landOwnerId = landOwner.id;
                r.areaHectares = 10;
                r.status = 'planted';
            });
            cycle = await testDb.get('agri_crop_cycles').create((r: any) => {
                r.cycleCode = 'CYC-2026-HSJ';
                r.parcelId = parcel.id;
                r.areaPlantedHa = 10;
                r.status = 'harvesting';
                r.landOwnerRatePerKg = 1.0;
                r.landOwnerGuaranteedMin = 25000.0;
                r.offtakePricePerKg = 4.0;
                r.totalActualYieldKg = 0;
            });
        });

        settlement = await LandSettlementEngine.computeWeeklySettlement(
            cycle.id,
            1,
            new Date('2026-10-01'),
            new Date('2026-10-07'),
            testDb
        );

        await LandSettlementEngine.approveSettlement(settlement.id, false, new Date(), undefined, testDb);

        // Verify initial entry
        const entriesBefore = await testDb.get('journal_entries').query().fetch();
        expect(entriesBefore.length).toBe(1);

        // Now call deleteSettlement
        await LandSettlementEngine.deleteSettlement(settlement.id, 'admin-tester', testDb);

        const updatedSettlement = await testDb.get('agri_weekly_settlements').find(settlement.id);
        expect(updatedSettlement.deletedAt).not.toBeNull();

        // Verify reversal entry created
        const entriesAfter = await testDb.get('journal_entries').query().fetch();
        expect(entriesAfter.length).toBe(2);

        const reversal = entriesAfter.find((e: any) => e.entryType === 'reversing');
        expect(reversal).toBeDefined();

        const reversalLines = await testDb.get('journal_entry_lines').query().fetch();
        const revLines = reversalLines.filter((l: any) => l.journalEntryId === reversal.id);
        
        // Reversal should have CR 5160 and DR 2035
        const cr5160 = revLines.find((l: any) => l.accountCode === '5160');
        const dr2035 = revLines.find((l: any) => l.accountCode === '2035');
        expect(cr5160.creditAmount).toBe(25000);
        expect(dr2035.debitAmount).toBe(25000);
    });

    it('updating or deleting a harvest log must reconcile crop cycle yield and reverse associated journal entries', async () => {
        let investor: any;
        let parcel: any;
        let cycle: any;

        await testDb.write(async () => {
            investor = await testDb.get('agri_investors').create((r: any) => {
                r.name = 'Starch Ventures Inc';
                r.defaultOfftakePricePerKg = 4.0;
            });
            parcel = await testDb.get('agri_parcels').create((r: any) => {
                r.name = 'Parcel Alpha';
                r.code = 'PA-01';
                r.areaHectares = 5;
                r.status = 'planted';
            });
            cycle = await testDb.get('agri_crop_cycles').create((r: any) => {
                r.cycleCode = 'CYC-ALPHA';
                r.parcelId = parcel.id;
                r.investorId = investor.id;
                r.areaPlantedHa = 5;
                r.status = 'harvesting';
                r.offtakePricePerKg = 4.0;
                r.totalActualYieldKg = 0;
            });
        });

        // 1. Log weigh in 10,000 gross - 2,000 tare = 8,000 net kg
        const log = await AgriHarvestService.logWeighIn({
            cropCycleId: cycle.id,
            parcelId: parcel.id,
            grossWeightKg: 10000,
            tareWeightKg: 2000,
            batchNumber: 'BATCH-001',
        }, testDb);

        let refetchedCycle = await testDb.get('agri_crop_cycles').find(cycle.id);
        expect(refetchedCycle.totalActualYieldKg).toBe(8000);

        let investorLedger = await testDb.get('agri_investor_ledgers').query().fetch();
        expect(investorLedger.length).toBe(1);
        expect(investorLedger[0].kilosReceived).toBe(8000);
        expect(investorLedger[0].amount).toBe(32000); // 8000 * 4

        // 2. Update harvest log: Tare revised from 2,000 to 1,000 -> net becomes 9,000 kg (+1,000 kg)
        await AgriHarvestService.updateHarvestLog(log, {
            tareWeightKg: 1000,
        }, testDb);

        refetchedCycle = await testDb.get('agri_crop_cycles').find(cycle.id);
        expect(refetchedCycle.totalActualYieldKg).toBe(9000);

        investorLedger = await testDb.get('agri_investor_ledgers').query().fetch();
        expect(investorLedger[0].kilosReceived).toBe(9000);
        expect(investorLedger[0].amount).toBe(36000); // 9000 * 4

        // 3. Delete harvest log
        await AgriHarvestService.deleteHarvestLog(log, testDb);

        refetchedCycle = await testDb.get('agri_crop_cycles').find(cycle.id);
        expect(refetchedCycle.totalActualYieldKg).toBe(0);

        // Verify investor ledger marked deleted
        const refetchedLedger = await testDb.get('agri_investor_ledgers').find(investorLedger[0].id);
        expect(refetchedLedger.deletedAt).not.toBeNull();

        // Verify reversal of harvest off-take sale entry
        const entries = await testDb.get('journal_entries').query().fetch();
        const reversal = entries.find((e: any) => e.entryType === 'reversing');
        expect(reversal).toBeDefined();
    });
});
