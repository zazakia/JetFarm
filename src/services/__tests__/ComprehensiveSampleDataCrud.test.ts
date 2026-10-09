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
import CommissaryDispatch from '../../database/models/CommissaryDispatch';
import WasteLog from '../../database/models/WasteLog';
import PosSession from '../../database/models/PosSession';
import FranchiseContract from '../../database/models/FranchiseContract';
import RoyaltyCalculation from '../../database/models/RoyaltyCalculation';
import Employee from '../../database/models/Employee';
import EmployeeLeave from '../../database/models/EmployeeLeave';
import PayrollRun from '../../database/models/PayrollRun';
import PayrollLine from '../../database/models/PayrollLine';
import LoanApplication from '../../database/models/LoanApplication';
import Guarantor from '../../database/models/Guarantor';
import ShareCapitalTransaction from '../../database/models/ShareCapitalTransaction';
import SavingsTransaction from '../../database/models/SavingsTransaction';
import MarketplaceProduct from '../../database/models/MarketplaceProduct';

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

            expect(coas.length).toBeGreaterThanOrEqual(10);

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

            expect(entries.length).toBeGreaterThanOrEqual(3);

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
    // 3. Supply Chain, Trade Payables & POS Operations
    // ──────────────────────────────────────────────────────────────────────────
    describe('Supply Chain & Operations Domain', () => {
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

        it('verifies commissary dispatches and stock movement link', async () => {
            const dispatches = await database.get<CommissaryDispatch>('commissary_dispatches')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(dispatches.length).toBeGreaterThanOrEqual(1);
            expect(dispatches[0].status).toBe('delivered');
            const items = JSON.parse(dispatches[0].itemsJson);
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBeGreaterThan(0);
        });

        it('tracks quarantine waste logs and reason categorization', async () => {
            const wasteLogs = await database.get<WasteLog>('waste_logs')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(wasteLogs.length).toBeGreaterThanOrEqual(1);
            expect(wasteLogs[0].reason).toBe('damaged');
            expect(wasteLogs[0].unitCost).toBeGreaterThan(0);
            expect(wasteLogs[0].totalCost).toBe(wasteLogs[0].unitCost * wasteLogs[0].quantity);
        });

        it('verifies POS session float auditing and cashier shift closing', async () => {
            const sessions = await database.get<PosSession>('pos_sessions')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(sessions.length).toBeGreaterThanOrEqual(1);
            const sess = sessions[0];
            expect(sess.status).toBe('closed');
            expect(sess.openingFloat).toBe(5000);
            expect(sess.varianceAmount).toBe(0);

            // Transition to audited
            await database.write(async () => {
                await sess.update(s => {
                    s.status = 'audited';
                    s.notes = 'Audited by head cashier - cash tallies perfectly';
                });
            });

            const audited = await database.get<PosSession>('pos_sessions').find(sess.id);
            expect(audited.status).toBe('audited');
            expect(audited.notes).toContain('Audited by head cashier');
        });

        it('verifies franchise contract and royalty calculation metrics', async () => {
            const contracts = await database.get<FranchiseContract>('franchise_contracts').query(Q.where('deleted_at', null)).fetch();
            const royalties = await database.get<RoyaltyCalculation>('royalty_calculations').query(Q.where('deleted_at', null)).fetch();

            expect(contracts.length).toBeGreaterThanOrEqual(1);
            expect(contracts[0].status).toBe('active');
            expect(contracts[0].royaltyPct).toBe(5.0);

            expect(royalties.length).toBeGreaterThanOrEqual(1);
            const roy = royalties[0];
            expect(roy.grossSales).toBe(450000);
            expect(roy.grossProfit).toBe(roy.grossSales - roy.cogs);
            expect(roy.operatorShare + roy.franchisorShare).toBe(roy.netIncome);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 4. HR, Payroll & Statutory Deductions
    // ──────────────────────────────────────────────────────────────────────────
    describe('HR & Payroll Domain', () => {
        it('verifies employee leave submission, approval, and balance days', async () => {
            const leaves = await database.get<EmployeeLeave>('employee_leaves')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(leaves.length).toBeGreaterThanOrEqual(2);
            for (const leave of leaves) {
                expect(['vacation', 'sick']).toContain(leave.leaveType);
                expect(leave.status).toBe('approved');
                expect(leave.daysCount).toBeGreaterThan(0);
            }
        });

        it('validates semi-monthly payroll run lines and net pay calculation', async () => {
            const runs = await database.get<PayrollRun>('payroll_runs')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(runs.length).toBeGreaterThanOrEqual(1);
            const run = runs[0];
            expect(run.status).toBe('approved');

            const lines = await database.get<PayrollLine>('payroll_lines')
                .query(Q.where('payroll_id', run.id), Q.where('deleted_at', null))
                .fetch();

            expect(lines.length).toBeGreaterThanOrEqual(2);

            let totalGrossCalculated = 0;
            let totalDeductionsCalculated = 0;
            let totalNetCalculated = 0;

            for (const line of lines) {
                const statutoryDeductions = line.sssEe + line.philhealthEe + line.pagibigEe + (line.withholdingTax || 0);
                expect(line.totalDeductions).toBeCloseTo(statutoryDeductions, 2);
                expect(line.netPay).toBeCloseTo(line.grossPay - line.totalDeductions, 2);

                totalGrossCalculated += line.grossPay;
                totalDeductionsCalculated += line.totalDeductions;
                totalNetCalculated += line.netPay;
            }

            expect(run.totalGross).toBeCloseTo(totalGrossCalculated, 2);
            expect(run.totalDeductions).toBeCloseTo(totalDeductionsCalculated, 2);
            expect(run.totalNet).toBeCloseTo(totalNetCalculated, 2);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Cooperative Capital & Credit Pipeline
    // ──────────────────────────────────────────────────────────────────────────
    describe('Member Capital & Credit Domain', () => {
        it('verifies share capital subscriptions and share balance accounting', async () => {
            const shareCaps = await database.get<ShareCapitalTransaction>('share_capital_transactions')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(shareCaps.length).toBeGreaterThanOrEqual(2);
            for (const sc of shareCaps) {
                expect(sc.transactionType).toBe('subscription');
                expect(sc.parValue).toBe(100);
                expect(sc.numberOfShares! * sc.parValue!).toBe(sc.amount);
                expect(sc.runningBalanceAmount).toBe(sc.amount);
            }
        });

        it('verifies voluntary savings deposits and round-trip transactions', async () => {
            const savings = await database.get<SavingsTransaction>('savings_transactions')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(savings.length).toBeGreaterThanOrEqual(2);
            const deposit = savings[0];
            expect(deposit.type).toBe('deposit');
            expect(deposit.amount).toBeGreaterThan(0);

            // Create an additional interest credit transaction
            let newTxId = '';
            await database.write(async () => {
                const interestTx = await database.get<SavingsTransaction>('savings_transactions').create(st => {
                    st.borrowerId = deposit.borrowerId;
                    st.type = 'interest';
                    st.amount = 125.50;
                    st.referenceId = 'INT-2026-Q3';
                    st.date = Date.now();
                    st.notes = 'Quarterly savings dividend interest credited';
                });
                newTxId = interestTx.id;
            });

            const fetchedTx = await database.get<SavingsTransaction>('savings_transactions').find(newTxId);
            expect(fetchedTx.type).toBe('interest');
            expect(fetchedTx.amount).toBe(125.50);
        });

        it('handles loan application processing, guarantor attachment, and approval', async () => {
            const apps = await database.get<LoanApplication>('loan_applications')
                .query(Q.where('deleted_at', null))
                .fetch();

            expect(apps.length).toBeGreaterThanOrEqual(2);
            const pendingApp = apps.find(a => a.status === 'pending');
            expect(pendingApp).toBeDefined();

            // Find attached guarantor
            const guarantors = await database.get<Guarantor>('guarantors')
                .query(Q.where('application_id', pendingApp!.id), Q.where('deleted_at', null))
                .fetch();

            expect(guarantors.length).toBeGreaterThanOrEqual(1);
            expect(guarantors[0].guarantorName).toBeTruthy();

            // Approve the application
            await database.write(async () => {
                await pendingApp!.update(a => {
                    a.status = 'approved';
                    a.amountApproved = a.amountApplied;
                    a.approvedBy = 'Credit Committee Resolution #2026-04';
                    a.approvedAt = Date.now();
                });
            });

            const approvedApp = await database.get<LoanApplication>('loan_applications').find(pendingApp!.id);
            expect(approvedApp.status).toBe('approved');
            expect(approvedApp.amountApproved).toBe(approvedApp.amountApplied);
            expect(approvedApp.approvedBy).toContain('Resolution');
        });
    });
});
