import { Database, Q } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { SampleDataService } from '../SampleDataService';
import AgriLandOwner from '../../database/models/AgriLandOwner';
import AgriInvestor from '../../database/models/AgriInvestor';
import AgriInvestorLedger from '../../database/models/AgriInvestorLedger';
import AgriWeeklySettlement from '../../database/models/AgriWeeklySettlement';
import AgriGrowthCheckin from '../../database/models/AgriGrowthCheckin';
import AgriHarvestLog from '../../database/models/AgriHarvestLog';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import AgriParcel from '../../database/models/AgriParcel';
import ChartOfAccount from '../../database/models/ChartOfAccount';
import JournalEntry from '../../database/models/JournalEntry';
import JournalEntryLine from '../../database/models/JournalEntryLine';
import StatutoryFundAllocation from '../../database/models/StatutoryFundAllocation';
import Supplier from '../../database/models/Supplier';
import AccountsPayableVoucher from '../../database/models/AccountsPayableVoucher';

describe('Comprehensive Sample Data CRUD & Feature Verification', () => {
    let database: Database;

    beforeEach(async () => {
        database = createTestDatabase();
        await SampleDataService.enable(database);
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Agribusiness Domain CRUD & Workflows
    // ──────────────────────────────────────────────────────────────────────────
    describe('Agribusiness Domain', () => {
        it('verifies landowner profiles, rates, and updates contact details', async () => {
            const landowners = await database.get<AgriLandOwner>('agri_land_owners')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(landowners.length).toBeGreaterThanOrEqual(2);
            const valderrama = landowners.find(l => l.name.includes('Valderrama'));
            expect(valderrama).toBeDefined();
            expect(valderrama!.defaultPerKiloRate).toBe(0.50);
            expect(valderrama!.defaultGuaranteedMinimum).toBe(5000);

            // UPDATE CRUD
            await database.write(async () => {
                await valderrama!.update(lo => {
                    lo.contactNumber = '0917-000-9999';
                    lo.notes = 'Updated contact information via field agent verification';
                });
            });

            const updated = await database.get<AgriLandOwner>('agri_land_owners').find(valderrama!.id);
            expect(updated.contactNumber).toBe('0917-000-9999');
            expect(updated.notes).toContain('Updated contact');
        });

        it('verifies growth checkin lifecycle: create, read, update stage, and soft-delete', async () => {
            const checkins = await database.get<AgriGrowthCheckin>('agri_growth_checkins')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(checkins.length).toBeGreaterThanOrEqual(2);
            const chk = checkins[0];
            expect(chk.healthStatus).toBeDefined();

            // UPDATE
            await database.write(async () => {
                await chk.update(c => {
                    c.stage = 'root_bulking';
                    c.plantHeightCm = 165;
                    c.notes = 'Cassava tuberization progressing on schedule';
                });
            });

            let reloaded = await database.get<AgriGrowthCheckin>('agri_growth_checkins').find(chk.id);
            expect(reloaded.stage).toBe('root_bulking');
            expect(reloaded.plantHeightCm).toBe(165);

            // SOFT DELETE
            await database.write(async () => {
                await reloaded.update(c => {
                    c.deletedAt = new Date();
                });
            });

            const activeCheckins = await database.get<AgriGrowthCheckin>('agri_growth_checkins')
                .query(Q.where('deleted_at', null))
                .fetch();
            expect(activeCheckins.find(c => c.id === chk.id)).toBeUndefined();
        });

        it('verifies weekly settlement math, approval, and disbursement flow', async () => {
            const settlements = await database.get<AgriWeeklySettlement>('agri_weekly_settlements')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(settlements.length).toBeGreaterThanOrEqual(2);
            const pendingSettlement = settlements.find(s => s.paymentStatus === 'approved');
            expect(pendingSettlement).toBeDefined();

            // Validate cumulative payout math: net = targetCumulative - previousCumulative
            expect(pendingSettlement!.targetCumulativePayout - pendingSettlement!.previousCumulativePayout)
                .toBe(pendingSettlement!.netPayoutDueThisWeek);

            // Execute disbursement: transition to 'paid'
            await database.write(async () => {
                await pendingSettlement!.update(s => {
                    s.paymentStatus = 'paid';
                    s.disbursementDate = new Date();
                    s.receiptReference = 'OR-CHECK-48190';
                });
            });

            const paidSettlement = await database.get<AgriWeeklySettlement>('agri_weekly_settlements').find(pendingSettlement!.id);
            expect(paidSettlement.paymentStatus).toBe('paid');
            expect(paidSettlement.receiptReference).toBe('OR-CHECK-48190');
            expect(paidSettlement.disbursementDate).toBeTruthy();
        });

        it('creates a new harvest log and validates net weight calculation', async () => {
            const cycles = await database.get<AgriCropCycle>('agri_crop_cycles').query(Q.where('deleted_at', null)).fetch();
            const parcels = await database.get<AgriParcel>('agri_parcels').query(Q.where('deleted_at', null)).fetch();

            let newHarvestId = '';
            const gross = 22400;
            const tare = 1400;
            const net = gross - tare;

            await database.write(async () => {
                const harvest = await database.get<AgriHarvestLog>('agri_harvest_logs').create(h => {
                    h.cropCycleId = cycles[0].id;
                    h.parcelId = parcels[0].id;
                    h.harvestDate = new Date();
                    h.batchNumber = 'HARV-TEST-999';
                    h.grossWeightKg = gross;
                    h.tareWeightKg = tare;
                    h.netWeightKg = net;
                    h.qualityGrade = 'A';
                    h.truckPlateNumber = 'AGR-7788';
                    h.weighInSupervisor = 'QA Lead';
                    h.notes = 'Tested harvest batch calculation';
                });
                newHarvestId = harvest.id;
            });

            const fetched = await database.get<AgriHarvestLog>('agri_harvest_logs').find(newHarvestId);
            expect(fetched.netWeightKg).toBe(21000);
            expect(fetched.batchNumber).toBe('HARV-TEST-999');
        });

        it('tracks investor ledger balance progression', async () => {
            const ledgers = await database.get<AgriInvestorLedger>('agri_investor_ledgers')
                .query(Q.where('deleted_at', null), Q.sortBy('created_at', Q.asc))
                .fetch();

            expect(ledgers.length).toBeGreaterThanOrEqual(2);
            expect(ledgers[0].type).toBe('capital_injection');
            expect(ledgers[1].type).toBe('harvest_offtake');
            expect(ledgers[1].balanceRunning).toBeGreaterThan(ledgers[0].balanceRunning);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Enterprise Accounting & CDA General Ledger Domain
    // ──────────────────────────────────────────────────────────────────────────
    describe('Enterprise Accounting Domain', () => {
        it('validates CDA chart of accounts structure and normal balances', async () => {
            const coas = await database.get<ChartOfAccount>('chart_of_accounts')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(coas.length).toBeGreaterThanOrEqual(8);

            const cash = coas.find(c => c.code === '1010');
            const payable = coas.find(c => c.code === '2010');
            const revenue = coas.find(c => c.code === '4020');

            expect(cash).toBeDefined();
            expect(cash!.accountType).toBe('asset');
            expect(cash!.normalBalance).toBe('debit');

            expect(payable).toBeDefined();
            expect(payable!.accountType).toBe('liability');
            expect(payable!.normalBalance).toBe('credit');

            expect(revenue).toBeDefined();
            expect(revenue!.accountType).toBe('income');
            expect(revenue!.normalBalance).toBe('credit');
        });

        it('ensures all seeded journal entries strictly balance debit and credit', async () => {
            const entries = await database.get<JournalEntry>('journal_entries')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(entries.length).toBeGreaterThanOrEqual(1);

            for (const entry of entries) {
                expect(entry.totalDebit).toBe(entry.totalCredit);
                expect(entry.totalDebit).toBeGreaterThan(0);
                expect(entry.isPosted).toBe(true);

                // Fetch line items for this entry
                const lines = await database.get<JournalEntryLine>('journal_entry_lines')
                    .query(Q.where('journal_entry_id', entry.id), Q.where('deleted_at', null))
                    .fetch();

                expect(lines.length).toBeGreaterThanOrEqual(2);

                const lineDebitSum = lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
                const lineCreditSum = lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);

                expect(lineDebitSum).toBe(entry.totalDebit);
                expect(lineCreditSum).toBe(entry.totalCredit);
            }
        });

        it('creates a manual adjusting journal entry with lines and verifies persistence', async () => {
            let entryId = '';
            const amount = 5000;

            await database.write(async () => {
                const entry = await database.get<JournalEntry>('journal_entries').create(je => {
                    je.entryDate = new Date();
                    je.referenceNumber = 'JV-ADJ-TEST-001';
                    je.description = 'Adjusting entry: monthly office depreciation';
                    je.entryType = 'adjusting';
                    je.sourceTable = 'manual';
                    je.postedBy = 'Senior CPA';
                    je.isPosted = true;
                    je.totalDebit = amount;
                    je.totalCredit = amount;
                    je.fiscalYear = 2026;
                    je.fiscalMonth = 9;
                });
                entryId = entry.id;

                await database.get<JournalEntryLine>('journal_entry_lines').create(l => {
                    l.journalEntryId = entryId;
                    l.accountCode = '5010';
                    l.debitAmount = amount;
                    l.creditAmount = 0;
                    l.description = 'Depreciation expense';
                });

                await database.get<JournalEntryLine>('journal_entry_lines').create(l => {
                    l.journalEntryId = entryId;
                    l.accountCode = '1070';
                    l.debitAmount = 0;
                    l.creditAmount = amount;
                    l.description = 'Accumulated depreciation';
                });
            });

            const saved = await database.get<JournalEntry>('journal_entries').find(entryId);
            expect(saved.referenceNumber).toBe('JV-ADJ-TEST-001');
            expect(saved.totalDebit).toBe(amount);

            const lines = await database.get<JournalEntryLine>('journal_entry_lines')
                .query(Q.where('journal_entry_id', entryId))
                .fetch();
            expect(lines).toHaveLength(2);
        });

        it('verifies statutory fund allocations and reserve fund percentage', async () => {
            const statutoryFunds = await database.get<StatutoryFundAllocation>('statutory_fund_allocations')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(statutoryFunds.length).toBeGreaterThanOrEqual(2);
            const reserve = statutoryFunds.find(sf => sf.fundType === 'reserve');
            expect(reserve).toBeDefined();
            expect(reserve!.percentage).toBe(50);
            expect(reserve!.amount).toBeGreaterThan(0);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Trade Payables (procurement into the agribusiness cost base)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Trade Payables Domain', () => {
        it('manages accounts payable vouchers: invoice balance and payment settlement', async () => {
            const vouchers = await database.get<AccountsPayableVoucher>('accounts_payable_vouchers')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(vouchers.length).toBeGreaterThanOrEqual(2);
            const partialVoucher = vouchers.find(v => v.status === 'partial');
            expect(partialVoucher).toBeDefined();
            expect(partialVoucher!.balance).toBe(partialVoucher!.amount - (partialVoucher!.amountPaid || 0));

            // Settle remainder
            await database.write(async () => {
                await partialVoucher!.update(v => {
                    v.amountPaid = v.amount;
                    v.balance = 0;
                    v.status = 'paid';
                });
            });

            const settled = await database.get<AccountsPayableVoucher>('accounts_payable_vouchers').find(partialVoucher!.id);
            expect(settled.status).toBe('paid');
            expect(settled.balance).toBe(0);
        });

    });

});
