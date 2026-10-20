import { Database, Q } from '@nozbe/watermelondb';
import uuid from 'react-native-uuid';
import { database as globalDatabase } from '../database';
import Area from '../database/models/Area';
import AgriParcel from '../database/models/AgriParcel';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriFarmWorker from '../database/models/AgriFarmWorker';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import AgriLaborLog from '../database/models/AgriLaborLog';
import AgriHarvestLog from '../database/models/AgriHarvestLog';
import AgriLandOwner from '../database/models/AgriLandOwner';
import AgriInvestor from '../database/models/AgriInvestor';
import AgriInvestorLedger from '../database/models/AgriInvestorLedger';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriGrowthCheckin from '../database/models/AgriGrowthCheckin';
import Branch from '../database/models/Branch';
import Warehouse from '../database/models/Warehouse';
import BankAccount from '../database/models/BankAccount';
import CashTransaction from '../database/models/CashTransaction';
import Expense from '../database/models/Expense';
import BusinessUnit from '../database/models/BusinessUnit';
import ChartOfAccount from '../database/models/ChartOfAccount';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import StatutoryFundAllocation from '../database/models/StatutoryFundAllocation';
import Supplier from '../database/models/Supplier';
import AccountsPayableVoucher from '../database/models/AccountsPayableVoucher';

const SAMPLE_MARKER = '[sample-data]';
const SAMPLE_BRANCH_ID = sampleUuid('sample-branch-main');
const SAMPLE_WAREHOUSE_ID = sampleUuid('sample-warehouse-main');
const SAMPLE_AREA_ID = sampleUuid('sample-area-poblacion');
const EXPENSE_ID_PREFIX = 'sample-expense-';

/**
 * The demo-data ledger. Every key is a table the agribusiness build actually seeds, so the
 * settings screen can show what "enable sample data" produced without listing credit,
 * marketplace, water-station or payroll counters that can never be non-zero here.
 */
export type SampleStatus = {
    enabled: boolean;
    active: number;
    deleted: number;
    totals: {
        areas: number;
        expenses: number;
        branches: number;
        warehouses: number;
        bankAccounts: number;
        cashTransactions: number;
        businessUnits: number;
        chartOfAccounts: number;
        journalEntries: number;
        journalEntryLines: number;
        statutoryFundAllocations: number;
        suppliers: number;
        accountsPayableVouchers: number;
        agriParcels: number;
        agriCropCycles: number;
        agriFarmWorkers: number;
        agriFarmExpenses: number;
        agriLaborLogs: number;
        agriHarvestLogs: number;
        agriLandOwners: number;
        agriInvestors: number;
        agriInvestorLedgers: number;
        agriWeeklySettlements: number;
        agriGrowthCheckins: number;
    };
};

const EXPENSE_SEEDS = [
    { category: 'Field Operations', description: `${SAMPLE_MARKER} Parcel survey and soil testing`, amount: 1850 },
    { category: 'Transportation', description: `${SAMPLE_MARKER} Harvest haulage to the offtake point`, amount: 2400 },
    { category: 'Repairs & Maintenance', description: `${SAMPLE_MARKER} Farm road and canal clearing`, amount: 3200 },
];

function nowMinusDays(days: number) {
    return Date.now() - days * 86400000;
}

/**
 * Deterministic demo-data id generator (2026-10-08).
 *
 * WHY: several synced remote tables declare `id UUID PRIMARY KEY` (app_areas,
 * app_borrowers, ws_customers, employees, ...). PostgREST rejects readable ids
 * like "sample-area-poblacion" with error 22P02, which made the ENTIRE table
 * push fail on every sync and also blocked real (non-sample) records batched
 * with them. Sample records now carry stable UUIDv4-shaped ids derived from a
 * pure, platform-independent 128-bit hash of the historical readable key, so
 * every device computes the same id and enable/disable/purge lookups stay in
 * sync. Legacy readable ids are purged once at bootstrap
 * (purgeLegacyReadableIds) so existing installs stop failing sync.
 */
export function sampleUuid(key: string): string {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < key.length; i++) {
        const k = key.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2713634553);
    }
    h1 = (Math.imul(h3 ^ h1, 597399067) ^ Math.imul(h2 ^ h3, 2869860233)) >>> 0;
    h2 = (Math.imul(h4 ^ h2, 951274213) ^ Math.imul(h1 ^ h3, 2713634553)) >>> 0;
    h3 = (Math.imul(h1 ^ h3, 597399067) ^ Math.imul(h2 ^ h4, 2869860233)) >>> 0;
    h4 = (Math.imul(h2 ^ h4, 951274213) ^ Math.imul(h1 ^ h4, 2713634553)) >>> 0;
    const hex = [h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('');
    const version = `4${hex.slice(13, 16)}`;
    const variant = (((parseInt(hex.slice(16, 20), 16) & 0x3fff) | 0x8000) >>> 0).toString(16).padStart(4, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${version}-${variant}-${hex.slice(20, 32)}`;
}

async function findById<T>(db: Database, table: string, id: string): Promise<T | null> {
    try {
        return await db.get<T & any>(table).find(id) as T;
    } catch {
        return null;
    }
}

export class SampleDataService {
    static marker = SAMPLE_MARKER;
    /**
     * Counts the demo records this build seeds, split per table. Reads go through
     * `sampleTables`, so a table that stops being seeded must also leave that list --
     * otherwise the settings screen would keep showing a counter that can never move.
     */
    static async getStatus(db: Database = globalDatabase): Promise<SampleStatus> {
        const tables = SampleDataService.sampleTables;
        const groups = await Promise.all(tables.map(table => this.fetchSampleRecords(db, table)));

        const counts = new Map<string, number>();
        const all: any[] = [];
        groups.forEach((rows, index) => {
            counts.set(tables[index], rows.length);
            all.push(...(rows as any[]));
        });
        const count = (table: string) => counts.get(table) ?? 0;

        const active = all.filter(record => !record.deletedAt).length;
        const deleted = all.filter(record => record.deletedAt).length;

        return {
            enabled: active > 0,
            active,
            deleted,
            totals: {
                areas: count('areas'),
                expenses: count('expenses'),
                branches: count('branches'),
                warehouses: count('warehouses'),
                bankAccounts: count('bank_accounts'),
                cashTransactions: count('cash_transactions'),
                businessUnits: count('business_units'),
                chartOfAccounts: count('chart_of_accounts'),
                journalEntries: count('journal_entries'),
                journalEntryLines: count('journal_entry_lines'),
                statutoryFundAllocations: count('statutory_fund_allocations'),
                suppliers: count('suppliers'),
                accountsPayableVouchers: count('accounts_payable_vouchers'),
                agriParcels: count('agri_parcels'),
                agriCropCycles: count('agri_crop_cycles'),
                agriFarmWorkers: count('agri_farm_workers'),
                agriFarmExpenses: count('agri_farm_expenses'),
                agriLaborLogs: count('agri_labor_logs'),
                agriHarvestLogs: count('agri_harvest_logs'),
                agriLandOwners: count('agri_land_owners'),
                agriInvestors: count('agri_investors'),
                agriInvestorLedgers: count('agri_investor_ledgers'),
                agriWeeklySettlements: count('agri_weekly_settlements'),
                agriGrowthCheckins: count('agri_growth_checkins'),
            },
        };
    }

    static async enable(db: Database = globalDatabase) {
        const existing = await this.fetchAllSampleRecords(db);
        const existingIds = new Set(existing.map((r: any) => r.id));

        await db.write(async () => {
            // Restore any previously soft-deleted sample records
            for (const record of existing as any[]) {
                if (record.deletedAt) {
                    await record.update((r: any) => {
                        r.deletedAt = null;
                    });
                }
            }

            // 1. Area master data
            if (!existingIds.has(SAMPLE_AREA_ID)) {
                await db.get<Area>('areas').create(record => {
                    record._raw.id = SAMPLE_AREA_ID;
                    record.name = `${SAMPLE_MARKER} District 1 - Poblacion Agri-Center`;
                    record.code = 'AREA-POB-01';
                    record.isActive = true;
                });
            }

            // 3. Operating Expenses
            for (const [index, seed] of EXPENSE_SEEDS.entries()) {
                const id = sampleUuid(`${EXPENSE_ID_PREFIX}${index + 1}`);
                if (!existingIds.has(id)) {
                    await db.get<Expense>('expenses').create(record => {
                        record._raw.id = id;
                        record.category = seed.category;
                        record.description = seed.description;
                        record.amount = seed.amount;
                        record.expenseDate = nowMinusDays(index + 1);
                        record.frequency = 'none';
                        record.encodedBy = 'sample-data';
                    });
                }
            }

            // 5. Agribusiness (Agri-One Outgrower Operations)
            // Parcels hang off the two sample land owners, so their ids are resolved once here
            // (they were previously derived from the retired sample borrowers).
            const landowner1Id = sampleUuid('sample-landowner-1');
            const landowner2Id = sampleUuid('sample-landowner-2');

            const parcel1Id = sampleUuid('sample-parcel-1');
            const parcel2Id = sampleUuid('sample-parcel-2');
            if (!existingIds.has(parcel1Id)) {
                await db.get<AgriParcel>('agri_parcels').create(p => {
                    p._raw.id = parcel1Id;
                    p.name = `${SAMPLE_MARKER} Sunrise Valley Parcel A`;
                    p.code = 'PARCEL-SV-01';
                    p.landOwnerId = landowner1Id;
                    p.areaHectares = 4.5;
                    p.locationAddress = 'Barangay San Emmanuel, Tacurong City';
                    p.soilType = 'Sandy Loam';
                    p.status = 'planted';
                });
            }
            if (!existingIds.has(parcel2Id)) {
                await db.get<AgriParcel>('agri_parcels').create(p => {
                    p._raw.id = parcel2Id;
                    p.name = `${SAMPLE_MARKER} Highland Ridge Parcel B`;
                    p.code = 'PARCEL-HR-02';
                    p.landOwnerId = landowner2Id;
                    p.areaHectares = 3.2;
                    p.locationAddress = 'Barangay Upper Katungal, Tacurong City';
                    p.soilType = 'Clay Loam';
                    p.status = 'harvesting';
                });
            }

            const cycle1Id = sampleUuid('sample-cycle-1');
            const cycle2Id = sampleUuid('sample-cycle-2');
            if (!existingIds.has(cycle1Id)) {
                await db.get<AgriCropCycle>('agri_crop_cycles').create(c => {
                    c._raw.id = cycle1Id;
                    c.cycleCode = 'CYCLE-2026-CAS-01';
                    c.parcelId = parcel1Id;
                    c.cropType = 'Cassava';
                    c.variety = 'KU50 Industrial High-Starch';
                    c.plantingDate = new Date(nowMinusDays(120));
                    c.targetHarvestDate = new Date(nowMinusDays(-60));
                    c.areaPlantedHa = 4.5;
                    c.status = 'growing';
                    c.expectedYieldKg = 28000;
                    c.totalActualYieldKg = 0;
                    c.capitalAllocated = 45000;
                    c.landOwnerRatePerKg = 0.50;
                    c.landOwnerGuaranteedMin = 5000;
                    c.offtakePricePerKg = 4.50;
                    c.notes = `${SAMPLE_MARKER} High-starch cassava outgrower cycle`;
                });
            }
            if (!existingIds.has(cycle2Id)) {
                await db.get<AgriCropCycle>('agri_crop_cycles').create(c => {
                    c._raw.id = cycle2Id;
                    c.cycleCode = 'CYCLE-2026-CRN-02';
                    c.parcelId = parcel2Id;
                    c.cropType = 'Yellow Corn';
                    c.variety = 'Pioneer 30T80 Hybrid';
                    c.plantingDate = new Date(nowMinusDays(90));
                    c.targetHarvestDate = new Date(nowMinusDays(5));
                    c.actualHarvestDate = new Date(nowMinusDays(3));
                    c.areaPlantedHa = 3.2;
                    c.status = 'harvesting';
                    c.expectedYieldKg = 18000;
                    c.totalActualYieldKg = 17200;
                    c.capitalAllocated = 38000;
                    c.landOwnerRatePerKg = 1.20;
                    c.landOwnerGuaranteedMin = 6000;
                    c.offtakePricePerKg = 16.50;
                    c.notes = `${SAMPLE_MARKER} Feed-grade hybrid yellow corn harvest`;
                });
            }

            const worker1Id = sampleUuid('sample-worker-1');
            const worker2Id = sampleUuid('sample-worker-2');
            if (!existingIds.has(worker1Id)) {
                await db.get<AgriFarmWorker>('agri_farm_workers').create(w => {
                    w._raw.id = worker1Id;
                    w.name = `${SAMPLE_MARKER} Ramon Santos`;
                    w.contactNumber = '0917-888-1234';
                    w.specialization = 'Field Supervisor & Harvester';
                    w.dailyRate = 550;
                    w.status = 'active';
                });
            }
            if (!existingIds.has(worker2Id)) {
                await db.get<AgriFarmWorker>('agri_farm_workers').create(w => {
                    w._raw.id = worker2Id;
                    w.name = `${SAMPLE_MARKER} Eduardo Reyes`;
                    w.contactNumber = '0928-777-5678';
                    w.specialization = 'Tractor Operator & Plowing';
                    w.dailyRate = 600;
                    w.status = 'active';
                });
            }

            const agriExp1Id = sampleUuid('sample-agri-exp-1');
            const agriExp2Id = sampleUuid('sample-agri-exp-2');
            if (!existingIds.has(agriExp1Id)) {
                await db.get<AgriFarmExpense>('agri_farm_expenses').create(e => {
                    e._raw.id = agriExp1Id;
                    e.cropCycleId = cycle1Id;
                    e.parcelId = parcel1Id;
                    e.expenseDate = new Date(nowMinusDays(60));
                    e.category = 'Fertilizer';
                    e.description = `${SAMPLE_MARKER} Complete 14-14-14 Fertilizer (30 bags)`;
                    e.amount = 39000;
                    e.paidBy = 'jet';
                });
            }
            if (!existingIds.has(agriExp2Id)) {
                await db.get<AgriFarmExpense>('agri_farm_expenses').create(e => {
                    e._raw.id = agriExp2Id;
                    e.cropCycleId = cycle2Id;
                    e.parcelId = parcel2Id;
                    e.expenseDate = new Date(nowMinusDays(30));
                    e.category = 'Labor';
                    e.description = `${SAMPLE_MARKER} Weeding and foliar spraying service`;
                    e.amount = 8500;
                    e.paidBy = 'jet';
                });
            }

            const labor1Id = sampleUuid('sample-labor-1');
            if (!existingIds.has(labor1Id)) {
                await db.get<AgriLaborLog>('agri_labor_logs').create(l => {
                    l._raw.id = labor1Id;
                    l.workerId = worker1Id;
                    l.cropCycleId = cycle1Id;
                    l.workDate = new Date(nowMinusDays(5));
                    l.task = 'Crop monitoring, furrow weeding, fertilizer application';
                    l.rateType = 'daily';
                    l.unitsCompleted = 3;
                    l.ratePerUnit = 550;
                    l.totalPay = 1650;
                    l.paymentStatus = 'paid';
                    l.notes = `${SAMPLE_MARKER} Logged by field supervisor`;
                });
            }

            const harvest1Id = sampleUuid('sample-harvest-1');
            if (!existingIds.has(harvest1Id)) {
                await db.get<AgriHarvestLog>('agri_harvest_logs').create(h => {
                    h._raw.id = harvest1Id;
                    h.cropCycleId = cycle2Id;
                    h.parcelId = parcel2Id;
                    h.harvestDate = new Date(nowMinusDays(3));
                    h.batchNumber = 'HARV-2026-001';
                    h.grossWeightKg = 18500;
                    h.tareWeightKg = 1300;
                    h.netWeightKg = 17200;
                    h.qualityGrade = 'A';
                    h.truckPlateNumber = 'NBC-4819';
                    h.weighInSupervisor = 'Ramon Santos';
                    h.notes = `${SAMPLE_MARKER} Yellow corn passed quality moisture scale (14%)`;
                });
            }

            // 6. Branch, Warehouse, Marketplace & POS Inventory
            if (!existingIds.has(SAMPLE_BRANCH_ID)) {
                await db.get<Branch>('branches').create(b => {
                    b._raw.id = SAMPLE_BRANCH_ID;
                    b.name = `${SAMPLE_MARKER} JetFarm Main Operations Hub`;
                    b.code = 'JFB-01';
                    b.isHq = true;
                    b.isActive = true;
                });
            }

            if (!existingIds.has(SAMPLE_WAREHOUSE_ID)) {
                await db.get<Warehouse>('warehouses').create(w => {
                    w._raw.id = SAMPLE_WAREHOUSE_ID;
                    w.branchId = SAMPLE_BRANCH_ID;
                    w.name = `${SAMPLE_MARKER} Central Agri & Cold Storage Warehouse`;
                    w.type = 'store';
                    w.isActive = true;
                });
            }

            // 9. Financials: Bank Accounts & Vault Float
            const bank1Id = sampleUuid('sample-bank-1');
            const bank2Id = sampleUuid('sample-bank-2');
            if (!existingIds.has(bank1Id)) {
                await db.get<BankAccount>('bank_accounts').create(b => {
                    b._raw.id = bank1Id;
                    b.bankName = 'LandBank of the Philippines';
                    b.accountName = `${SAMPLE_MARKER} JetFarm Agri-Operations Account`;
                    b.accountNumber = '0421-9981-22';
                    b.startingBalance = 250000;
                });
            }
            if (!existingIds.has(bank2Id)) {
                await db.get<BankAccount>('bank_accounts').create(b => {
                    b._raw.id = bank2Id;
                    b.bankName = 'BDO Unibank';
                    b.accountName = `${SAMPLE_MARKER} JetFarm Treasury & Lending Float`;
                    b.accountNumber = '1009-4452-11';
                    b.startingBalance = 180000;
                });
            }

            const cashTx1Id = sampleUuid('sample-cashtx-1');
            if (!existingIds.has(cashTx1Id)) {
                await db.get<CashTransaction>('cash_transactions').create(tx => {
                    tx._raw.id = cashTx1Id;
                    tx.transactionDate = nowMinusDays(30);
                    tx.branchId = SAMPLE_BRANCH_ID;
                    tx.particulars = `${SAMPLE_MARKER} Initial vault cash operating float`;
                    tx.type = 'cash_in';
                    tx.amount = 50000;
                    tx.remarks = 'Authorized starting petty and vault float';
                    tx.recordedBy = 'sample-data';
                    tx.isPettyCash = false;
                });
            }

            // 11. Agribusiness Outgrowers, Investors, Growth Logs & Weekly Settlements
            if (!existingIds.has(landowner1Id)) {
                await db.get<AgriLandOwner>('agri_land_owners').create(lo => {
                    lo._raw.id = landowner1Id;
                    lo.userId = null;
                    lo.name = `${SAMPLE_MARKER} Don Alejandro Valderrama`;
                    lo.contactNumber = '0917-555-1122';
                    lo.bankName = 'LandBank of the Philippines';
                    lo.accountNumber = '0421-5582-90';
                    lo.defaultPerKiloRate = 0.50;
                    lo.defaultGuaranteedMinimum = 5000;
                    lo.notes = `${SAMPLE_MARKER} Agrarian beneficiary - Sunrise Valley Cassava Parcel`;
                });
            }
            if (!existingIds.has(landowner2Id)) {
                await db.get<AgriLandOwner>('agri_land_owners').create(lo => {
                    lo._raw.id = landowner2Id;
                    lo.userId = null;
                    lo.name = `${SAMPLE_MARKER} Faustina Dizon`;
                    lo.contactNumber = '0928-333-4455';
                    lo.bankName = 'BDO Unibank';
                    lo.accountNumber = '1009-8871-34';
                    lo.defaultPerKiloRate = 1.20;
                    lo.defaultGuaranteedMinimum = 6000;
                    lo.notes = `${SAMPLE_MARKER} High-yield hybrid yellow corn parcel owner`;
                });
            }

            const investor1Id = sampleUuid('sample-investor-1');
            const investor2Id = sampleUuid('sample-investor-2');
            if (!existingIds.has(investor1Id)) {
                await db.get<AgriInvestor>('agri_investors').create(inv => {
                    inv._raw.id = investor1Id;
                    inv.companyName = `${SAMPLE_MARKER} South Cotabato Bio-Feed Mills`;
                    inv.contactPerson = 'Engr. Roberto Dizon';
                    inv.contactNumber = '0917-999-0011';
                    inv.email = 'procurement@scfeedmills.ph';
                    inv.defaultOfftakePricePerKg = 16.50;
                    inv.notes = `${SAMPLE_MARKER} Institutional contract offtaker for grade-A yellow corn`;
                });
            }
            if (!existingIds.has(investor2Id)) {
                await db.get<AgriInvestor>('agri_investors').create(inv => {
                    inv._raw.id = investor2Id;
                    inv.companyName = `${SAMPLE_MARKER} Sultan Kudarat Agri-Commodities Inc.`;
                    inv.contactPerson = 'Cynthia Tan';
                    inv.contactNumber = '0918-888-2233';
                    inv.email = 'trade@skagri.ph';
                    inv.defaultOfftakePricePerKg = 4.50;
                    inv.notes = `${SAMPLE_MARKER} Industrial high-starch cassava processor`;
                });
            }

            const checkin1Id = sampleUuid('sample-checkin-1');
            const checkin2Id = sampleUuid('sample-checkin-2');
            if (!existingIds.has(checkin1Id)) {
                await db.get<AgriGrowthCheckin>('agri_growth_checkins').create(chk => {
                    chk._raw.id = checkin1Id;
                    chk.cropCycleId = cycle1Id;
                    chk.checkinDate = new Date(nowMinusDays(30));
                    chk.stage = 'vegetative';
                    chk.plantHeightCm = 145;
                    chk.healthStatus = 'optimal';
                    chk.notes = `${SAMPLE_MARKER} Cassava canopy dense, healthy chlorophyll levels`;
                });
            }
            if (!existingIds.has(checkin2Id)) {
                await db.get<AgriGrowthCheckin>('agri_growth_checkins').create(chk => {
                    chk._raw.id = checkin2Id;
                    chk.cropCycleId = cycle2Id;
                    chk.checkinDate = new Date(nowMinusDays(10));
                    chk.stage = 'maturity';
                    chk.plantHeightCm = 185;
                    chk.healthStatus = 'good';
                    chk.notes = `${SAMPLE_MARKER} Corn ears filled, moisture testing 15.2% ready for harvest`;
                });
            }

            const settle1Id = sampleUuid('sample-settlement-1');
            const settle2Id = sampleUuid('sample-settlement-2');
            if (!existingIds.has(settle1Id)) {
                await db.get<AgriWeeklySettlement>('agri_weekly_settlements').create(st => {
                    st._raw.id = settle1Id;
                    st.cropCycleId = cycle2Id;
                    st.landOwnerId = landowner2Id;
                    st.weekNumber = 1;
                    st.weekStartDate = new Date(nowMinusDays(14));
                    st.weekEndDate = new Date(nowMinusDays(8));
                    st.cumulativeKilos = 10000;
                    st.ratePerKilo = 1.20;
                    st.rawKiloEarnings = 12000;
                    st.guaranteedMinimum = 6000;
                    st.targetCumulativePayout = 12000;
                    st.previousCumulativePayout = 0;
                    st.netPayoutDueThisWeek = 12000;
                    st.paymentStatus = 'paid';
                    st.disbursementDate = new Date(nowMinusDays(7));
                    st.receiptReference = 'SETTLE-2026-WK01';
                    st.calculationBreakdownJson = JSON.stringify({ formula: '10000kg * 1.20 = 12000 (exceeds min 6000)' });
                });
            }
            if (!existingIds.has(settle2Id)) {
                await db.get<AgriWeeklySettlement>('agri_weekly_settlements').create(st => {
                    st._raw.id = settle2Id;
                    st.cropCycleId = cycle2Id;
                    st.landOwnerId = landowner2Id;
                    st.weekNumber = 2;
                    st.weekStartDate = new Date(nowMinusDays(7));
                    st.weekEndDate = new Date(nowMinusDays(1));
                    st.cumulativeKilos = 17200;
                    st.ratePerKilo = 1.20;
                    st.rawKiloEarnings = 20640;
                    st.guaranteedMinimum = 12000;
                    st.targetCumulativePayout = 20640;
                    st.previousCumulativePayout = 12000;
                    st.netPayoutDueThisWeek = 8640;
                    st.paymentStatus = 'approved';
                    st.disbursementDate = null;
                    st.receiptReference = 'SETTLE-2026-WK02';
                    st.calculationBreakdownJson = JSON.stringify({ formula: 'cumulative 17200kg * 1.20 - previous 12000 = 8640' });
                });
            }

            const invLedger1Id = sampleUuid('sample-inv-ledger-1');
            const invLedger2Id = sampleUuid('sample-inv-ledger-2');
            if (!existingIds.has(invLedger1Id)) {
                await db.get<AgriInvestorLedger>('agri_investor_ledgers').create(il => {
                    il._raw.id = invLedger1Id;
                    il.investorId = investor1Id;
                    il.cropCycleId = cycle2Id;
                    il.transactionDate = new Date(nowMinusDays(60));
                    il.type = 'capital_injection';
                    il.kilosReceived = null;
                    il.pricePerKilo = null;
                    il.amount = 150000;
                    il.balanceRunning = 150000;
                    il.notes = `${SAMPLE_MARKER} Pre-harvest working capital allocation for corn inputs`;
                });
            }
            if (!existingIds.has(invLedger2Id)) {
                await db.get<AgriInvestorLedger>('agri_investor_ledgers').create(il => {
                    il._raw.id = invLedger2Id;
                    il.investorId = investor1Id;
                    il.cropCycleId = cycle2Id;
                    il.transactionDate = new Date(nowMinusDays(3));
                    il.type = 'harvest_offtake';
                    il.kilosReceived = 17200;
                    il.pricePerKilo = 16.50;
                    il.amount = 283800;
                    il.balanceRunning = 433800;
                    il.notes = `${SAMPLE_MARKER} Offtake liquidation for batch HARV-2026-001`;
                });
            }

            // 12. Enterprise Accounting & CDA General Ledger
            const buAgriId = sampleUuid('sample-bu-agri');

            const buList = [
                { id: buAgriId, name: `${SAMPLE_MARKER} JetFarm Agri Operations`, slug: 'agri-operations', moduleId: 'agri-operations' },
            ];

            for (const bu of buList) {
                if (!existingIds.has(bu.id)) {
                    await db.get<BusinessUnit>('business_units').create(record => {
                        record._raw.id = bu.id;
                        record.name = bu.name;
                        record.slug = bu.slug;
                        record.moduleId = bu.moduleId;
                        record.branchId = SAMPLE_BRANCH_ID;
                        record.isActive = true;
                        record.description = `${SAMPLE_MARKER} Operational business unit`;
                    });
                }
            }

            const coaSeeds = [
                { id: sampleUuid('sample-coa-1010'), code: '1010', name: 'Cash on Hand - Vault', type: 'asset', normal: 'debit', sort: 10 },
                { id: sampleUuid('sample-coa-1020'), code: '1020', name: 'Cash in Bank - Operations', type: 'asset', normal: 'debit', sort: 20 },
                { id: sampleUuid('sample-coa-1070'), code: '1070', name: 'Inventory - Agri Supplies & Produce', type: 'asset', normal: 'debit', sort: 40 },
                { id: sampleUuid('sample-coa-2010'), code: '2010', name: 'Accounts Payable - Trade Suppliers', type: 'liability', normal: 'credit', sort: 50 },
                { id: sampleUuid('sample-coa-3010'), code: '3010', name: 'Paid-Up Share Capital', type: 'equity', normal: 'credit', sort: 60 },
                { id: sampleUuid('sample-coa-4020'), code: '4020', name: 'Sales Revenue - Agri Produce & Store', type: 'income', normal: 'credit', sort: 80 },
                { id: sampleUuid('sample-coa-5010'), code: '5010', name: 'Salaries & Wages Expense', type: 'expense', normal: 'debit', sort: 90 },
                { id: sampleUuid('sample-coa-5020'), code: '5020', name: 'Farm Inputs & Fertilizer Expense', type: 'expense', normal: 'debit', sort: 100 },
            ];

            for (const coa of coaSeeds) {
                if (!existingIds.has(coa.id)) {
                    await db.get<ChartOfAccount>('chart_of_accounts').create(acc => {
                        acc._raw.id = coa.id;
                        acc.code = coa.code;
                        acc.name = `${SAMPLE_MARKER} ${coa.name}`;
                        acc.accountType = coa.type;
                        acc.normalBalance = coa.normal;
                        acc.isActive = true;
                        acc.isHeader = false;
                        acc.parentCode = null;
                        acc.sortOrder = coa.sort;
                        acc.description = `${SAMPLE_MARKER} Standard CDA compliant account`;
                    });
                }
            }

            // Balanced Journal Entries (Debit === Credit)
            const je3Id = sampleUuid('sample-je-3');

            if (!existingIds.has(je3Id)) {
                await db.get<JournalEntry>('journal_entries').create(je => {
                    je._raw.id = je3Id;
                    je.entryDate = new Date(nowMinusDays(3));
                    je.referenceNumber = 'JV-2026-003';
                    je.description = `${SAMPLE_MARKER} Corn harvest delivery inventory recognition`;
                    je.entryType = 'auto';
                    je.sourceTable = 'agri_harvest_logs';
                    je.sourceId = harvest1Id;
                    je.postedBy = 'Inventory Officer';
                    je.isPosted = true;
                    je.totalDebit = 17200;
                    je.totalCredit = 17200;
                    je.fiscalYear = 2026;
                    je.fiscalMonth = 8;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-3-dr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-3-dr');
                    jel.journalEntryId = je3Id;
                    jel.accountCode = '1070';
                    jel.accountName = 'Inventory - Agri Supplies & Produce';
                    jel.debitAmount = 17200;
                    jel.creditAmount = 0;
                    jel.description = 'Yellow corn harvest incoming to warehouse';
                    jel.businessUnitId = buAgriId;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-3-cr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-3-cr');
                    jel.journalEntryId = je3Id;
                    jel.accountCode = '2010';
                    jel.accountName = 'Accounts Payable - Trade Suppliers';
                    jel.debitAmount = 0;
                    jel.creditAmount = 17200;
                    jel.description = 'Payable to outgrower landowner';
                    jel.businessUnitId = buAgriId;
                });
            }

            const statfund1Id = sampleUuid('sample-statfund-1');
            const statfund2Id = sampleUuid('sample-statfund-2');
            if (!existingIds.has(statfund1Id)) {
                await db.get<StatutoryFundAllocation>('statutory_fund_allocations').create(sf => {
                    sf._raw.id = statfund1Id;
                    sf.fiscalYear = 2026;
                    sf.fiscalMonth = 8;
                    sf.fundType = 'reserve';
                    sf.amount = 25000;
                    sf.percentage = 50;
                    sf.notes = `${SAMPLE_MARKER} General Reserve Fund allocation (50% CDA mandate)`;
                    sf.performedBy = 'Chief Accountant';
                });
            }
            if (!existingIds.has(statfund2Id)) {
                await db.get<StatutoryFundAllocation>('statutory_fund_allocations').create(sf => {
                    sf._raw.id = statfund2Id;
                    sf.fiscalYear = 2026;
                    sf.fiscalMonth = 8;
                    sf.fundType = 'education';
                    sf.amount = 5000;
                    sf.percentage = 10;
                    sf.notes = `${SAMPLE_MARKER} Cooperative Education and Training Fund`;
                    sf.performedBy = 'Chief Accountant';
                });
            }

            // 13. Supply Chain: agri suppliers and their payables
            const supp1Id = sampleUuid('sample-supplier-1');
            const supp2Id = sampleUuid('sample-supplier-2');
            if (!existingIds.has(supp1Id)) {
                await db.get<Supplier>('suppliers').create(sp => {
                    sp._raw.id = supp1Id;
                    sp.name = `${SAMPLE_MARKER} Mindanao Bio-Agri Solutions Corp`;
                    sp.contactPerson = 'Rogelio Mendoza';
                    sp.phone = '0917-333-7788';
                    sp.email = 'sales@bioagri-solutions.ph';
                    sp.address = 'Industrial Zone, General Santos City';
                    sp.tin = '234-567-890-000';
                    sp.paymentTermsDays = 30;
                    sp.isActive = true;
                });
            }
            if (!existingIds.has(supp2Id)) {
                await db.get<Supplier>('suppliers').create(sp => {
                    sp._raw.id = supp2Id;
                    sp.name = `${SAMPLE_MARKER} Pioneer Grain & Seed Corp`;
                    sp.contactPerson = 'Grace Villar';
                    sp.phone = '0928-111-4455';
                    sp.email = 'distributors@pioneer-seeds.ph';
                    sp.address = 'KM 7 Highway, Koronadal City';
                    sp.tin = '345-678-901-000';
                    sp.paymentTermsDays = 15;
                    sp.isActive = true;
                });
            }

            const voucher1Id = sampleUuid('sample-voucher-1');
            const voucher2Id = sampleUuid('sample-voucher-2');
            if (!existingIds.has(voucher1Id)) {
                await db.get<AccountsPayableVoucher>('accounts_payable_vouchers').create(apv => {
                    apv._raw.id = voucher1Id;
                    apv.supplierId = supp1Id;
                    apv.voucherNumber = 'APV-2026-001';
                    apv.invoiceNumber = 'INV-MBAS-9012';
                    apv.invoiceDate = new Date(nowMinusDays(15));
                    apv.dueDate = new Date(nowMinusDays(-15));
                    apv.description = `${SAMPLE_MARKER} Bulk Bio-Organic Complete 14-14-14 Fertilizer shipment`;
                    apv.amount = 172500;
                    apv.amountPaid = 100000;
                    apv.balance = 72500;
                    apv.status = 'partial';
                    apv.expenseAccountCode = '1070';
                    apv.moduleId = 'agri-store';
                    apv.postedBy = 'Finance Officer';
                });
            }
            if (!existingIds.has(voucher2Id)) {
                await db.get<AccountsPayableVoucher>('accounts_payable_vouchers').create(apv => {
                    apv._raw.id = voucher2Id;
                    apv.supplierId = supp2Id;
                    apv.voucherNumber = 'APV-2026-002';
                    apv.invoiceNumber = 'INV-PGSC-4411';
                    apv.invoiceDate = new Date(nowMinusDays(20));
                    apv.dueDate = new Date(nowMinusDays(-5));
                    apv.description = `${SAMPLE_MARKER} Certified Pioneer 30T80 Hybrid seeds shipment`;
                    apv.amount = 32300;
                    apv.amountPaid = 32300;
                    apv.balance = 0;
                    apv.status = 'paid';
                    apv.expenseAccountCode = '1070';
                    apv.moduleId = 'agri-store';
                    apv.postedBy = 'Finance Officer';
                });
            }

        });
    }

    static async disable(db: Database = globalDatabase) {
        const records = await this.fetchAllSampleRecords(db);
        const timestamp = Date.now();
        await db.write(async () => {
            for (const record of records as any[]) {
                if (record.deletedAt) continue;
                await record.update((r: any) => {
                    r.deletedAt = timestamp;
                });
            }
        });
    }

    static async restore(db: Database = globalDatabase) {
        const records = await this.fetchAllSampleRecords(db);
        await db.write(async () => {
            for (const record of records as any[]) {
                await record.update((r: any) => {
                    r.deletedAt = null;
                });
            }
        });
    }

    static async purge(db: Database = globalDatabase) {
        const records = await this.fetchAllSampleRecords(db);
        await db.write(async () => {
            for (const record of records as any[]) {
                await record.destroyPermanently();
            }
        });
    }

    private static async fetchAllSampleRecords(db: Database) {
        const results = await Promise.all(
            SampleDataService.sampleTables.map(table => this.fetchSampleRecords(db, table))
        );

        return results.flat();
    }

    /**
     * One-time repair for the pre-UUID demo-id scheme (2026-10-08).
     *
     * Devices that enabled sample data before sample ids became real UUIDs carry
     * local records with readable ids ("sample-area-poblacion", ...). Remote
     * tables with `id UUID PRIMARY KEY` reject them (PostgREST 22P02), which
     * fails the whole table push on EVERY sync and also blocks real records
     * batched in the same table. Real records are always UUID v4 (see
     * database/index.ts), so any id starting with "sample-" is legacy demo
     * data by definition and safe to destroy locally. Rows that never pushed
     * successfully exist only on the device, so destroyPermanently (no sync
     * tombstone) is exactly right.
     */
    static async purgeLegacyReadableIds(db: Database = globalDatabase): Promise<number> {
        let purged = 0;
        for (const table of SampleDataService.sampleTables) {
            if (!db || typeof (db as any).get !== 'function') continue;
            const collection = db.get<any>(table);
            if (!collection || typeof (collection as any).query !== 'function') continue;
            const rows = await collection.query().fetch() as any[];
            const legacy = rows.filter(record => typeof record.id === 'string' && record.id.startsWith('sample-'));
            if (legacy.length === 0) continue;
            await db.write(async () => {
                for (const record of legacy) {
                    await record.destroyPermanently();
                    purged++;
                }
            });
        }
        if (purged > 0) {
            console.log(`[SampleDataService] Purged ${purged} legacy readable-id sample record(s)`);
        }
        return purged;
    }

    private static readonly sampleTables = [
        'areas', 'expenses', 'branches', 'warehouses',
        'bank_accounts', 'cash_transactions', 'suppliers', 'accounts_payable_vouchers',
        'business_units', 'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
        'statutory_fund_allocations',
        'agri_parcels', 'agri_crop_cycles', 'agri_farm_workers', 'agri_farm_expenses',
        'agri_labor_logs', 'agri_harvest_logs', 'agri_land_owners', 'agri_investors',
        'agri_investor_ledgers', 'agri_weekly_settlements', 'agri_growth_checkins'
    ];

    private static async fetchSampleRecords<T>(db: Database, table: string): Promise<T[]> {
        const ids = this.sampleIdsForTable(table);
        if (ids.length === 0) return [];
        if (!db || typeof (db as any).get !== 'function') return [];
        const collection = db.get<T & any>(table);
        if (!collection || typeof (collection as any).query !== 'function') return [];
        return await collection.query(Q.where('id', Q.oneOf(ids))).fetch() as T[];
    }

    /** The demo ids behind every seeded table; anything absent here is never counted or purged. */
    private static sampleIdsForTable(table: string): string[] {
        if (table === 'areas') return [SAMPLE_AREA_ID];
        if (table === 'branches') return [SAMPLE_BRANCH_ID];
        if (table === 'warehouses') return [SAMPLE_WAREHOUSE_ID];
        if (table === 'expenses') return EXPENSE_SEEDS.map((_, index) => sampleUuid(`${EXPENSE_ID_PREFIX}${index + 1}`));

        if (table === 'agri_parcels') return ['sample-parcel-1', 'sample-parcel-2'].map(sampleUuid);
        if (table === 'agri_crop_cycles') return ['sample-cycle-1', 'sample-cycle-2'].map(sampleUuid);
        if (table === 'agri_farm_workers') return ['sample-worker-1', 'sample-worker-2'].map(sampleUuid);
        if (table === 'agri_farm_expenses') return ['sample-agri-exp-1', 'sample-agri-exp-2'].map(sampleUuid);
        if (table === 'agri_labor_logs') return ['sample-labor-1'].map(sampleUuid);
        if (table === 'agri_harvest_logs') return ['sample-harvest-1'].map(sampleUuid);
        if (table === 'agri_land_owners') return ['sample-landowner-1', 'sample-landowner-2'].map(sampleUuid);
        if (table === 'agri_investors') return ['sample-investor-1', 'sample-investor-2'].map(sampleUuid);
        if (table === 'agri_weekly_settlements') return ['sample-settlement-1', 'sample-settlement-2'].map(sampleUuid);
        if (table === 'agri_growth_checkins') return ['sample-checkin-1', 'sample-checkin-2'].map(sampleUuid);
        if (table === 'agri_investor_ledgers') return ['sample-inv-ledger-1', 'sample-inv-ledger-2'].map(sampleUuid);

        if (table === 'business_units') return ['sample-bu-agri'].map(sampleUuid);
        if (table === 'chart_of_accounts') return [
            'sample-coa-1010', 'sample-coa-1020', 'sample-coa-1070',
            'sample-coa-2010', 'sample-coa-3010', 'sample-coa-4020',
            'sample-coa-5010', 'sample-coa-5020'
        ].map(sampleUuid);
        if (table === 'journal_entries') return ['sample-je-3'].map(sampleUuid);
        if (table === 'journal_entry_lines') return ['sample-jel-3-dr', 'sample-jel-3-cr'].map(sampleUuid);
        if (table === 'statutory_fund_allocations') return ['sample-statfund-1', 'sample-statfund-2'].map(sampleUuid);

        if (table === 'suppliers') return ['sample-supplier-1', 'sample-supplier-2'].map(sampleUuid);
        if (table === 'accounts_payable_vouchers') return ['sample-voucher-1', 'sample-voucher-2'].map(sampleUuid);

        if (table === 'bank_accounts') return ['sample-bank-1', 'sample-bank-2'].map(sampleUuid);
        if (table === 'cash_transactions') return ['sample-cashtx-1'].map(sampleUuid);

        return [];
    }
}

export default SampleDataService;
