import { Database, Q } from '@nozbe/watermelondb';
import uuid from 'react-native-uuid';
import { database as globalDatabase } from '../database';
import Borrower from '../database/models/Borrower';
import Collector from '../database/models/Collector';
import Expense from '../database/models/Expense';
import FileCase from '../database/models/FileCase';
import Loan from '../database/models/Loan';
import { LOAN_PRODUCT_PRESETS, LoanProductType } from '../utils/loanProducts';

const SAMPLE_MARKER = '[sample-data]';
const SAMPLE_COLLECTOR_ID = 'sample-collector-main';
const BORROWER_ID_PREFIX = 'sample-borrower-';
const LOAN_ID_PREFIX = 'sample-loan-';
const EXPENSE_ID_PREFIX = 'sample-expense-';
const FILE_CASE_ID_PREFIX = 'sample-file-case-';

type SampleStatus = {
    enabled: boolean;
    active: number;
    deleted: number;
    totals: {
        borrowers: number;
        loans: number;
        expenses: number;
        fileCases: number;
    };
};

type LoanSeed = {
    type: LoanProductType;
    borrowerName: string;
    principal: number;
    status: string;
    delinquent?: boolean;
    maturityOffsetDays?: number;
};

const LOAN_SEEDS: LoanSeed[] = [
    { type: 'standard', borrowerName: 'Sample Standard Client', principal: 10000, status: 'pending' },
    { type: 'petty_cash', borrowerName: 'Sample Petty Cash Client', principal: 18000, status: 'active' },
    { type: 'livelihood', borrowerName: 'Sample Livelihood Client', principal: 25000, status: 'active' },
    { type: 'salary', borrowerName: 'Sample Salary Client', principal: 12000, status: 'active' },
    { type: 'emergency', borrowerName: 'Sample Emergency Client', principal: 2000, status: 'active' },
    { type: 'standard', borrowerName: 'Sample Delinquent Client', principal: 15000, status: 'defaulted', delinquent: true, maturityOffsetDays: -120 },
];

const EXPENSE_SEEDS = [
    { category: 'Office Supplies', description: `${SAMPLE_MARKER} Printer ink and receipt paper`, amount: 1850 },
    { category: 'Transportation', description: `${SAMPLE_MARKER} Collector route fuel allowance`, amount: 2400 },
    { category: 'Legal', description: `${SAMPLE_MARKER} Case filing documentation fee`, amount: 3200 },
];

function nowMinusDays(days: number) {
    return Date.now() - days * 86400000;
}

function stableId(prefix: string, value: string) {
    return `${prefix}${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
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
    static loanSeeds = LOAN_SEEDS;

    static async getStatus(db: Database = globalDatabase): Promise<SampleStatus> {
        const [borrowers, loans, expenses, fileCases] = await Promise.all([
            this.fetchSampleRecords<Borrower>(db, 'borrowers'),
            this.fetchSampleRecords<Loan>(db, 'loans'),
            this.fetchSampleRecords<Expense>(db, 'expenses'),
            this.fetchSampleRecords<FileCase>(db, 'file_cases'),
        ]);
        const all = [...borrowers, ...loans, ...expenses, ...fileCases] as any[];
        const active = all.filter(record => !record.deletedAt).length;
        const deleted = all.filter(record => record.deletedAt).length;

        return {
            enabled: active > 0,
            active,
            deleted,
            totals: {
                borrowers: borrowers.length,
                loans: loans.length,
                expenses: expenses.length,
                fileCases: fileCases.length,
            },
        };
    }

    static async enable(db: Database = globalDatabase) {
        const existing = await this.fetchAllSampleRecords(db);
        const collector = await this.ensureCollector(db);
        const currentLoanIds = new Set(existing.filter(r => (r.constructor as any).table === 'loans').map(r => r.id));
        const currentBorrowerIds = new Set(existing.filter(r => (r.constructor as any).table === 'borrowers').map(r => r.id));
        const currentExpenseIds = new Set(existing.filter(r => (r.constructor as any).table === 'expenses').map(r => r.id));
        const currentCaseIds = new Set(existing.filter(r => (r.constructor as any).table === 'file_cases').map(r => r.id));

        await db.write(async () => {
            for (const record of existing as any[]) {
                await record.update((r: any) => {
                    r.deletedAt = null;
                });
            }

            for (const seed of LOAN_SEEDS) {
                const borrowerId = stableId(BORROWER_ID_PREFIX, seed.borrowerName);
                const loanId = stableId(LOAN_ID_PREFIX, `${seed.type}-${seed.borrowerName}`);
                if (!currentBorrowerIds.has(borrowerId)) {
                    await db.get<Borrower>('borrowers').create(record => {
                        record._raw.id = borrowerId;
                        record.fullName = seed.borrowerName;
                        record.firstName = seed.borrowerName.replace(/^Sample\s+/, '').split(' ')[0] || 'Sample';
                        record.lastName = 'Client';
                        record.address = `${SAMPLE_MARKER} Demo address`;
                        record.business = seed.type.includes('salary') ? 'Sample Employer Inc.' : 'Sample Sari-sari Store';
                        record.group = seed.type.includes('salary') ? 'Institutional' : 'Community';
                        record.collectorId = collector.id;
                        record.createdBy = 'sample-data';
                    });
                }
                if (!currentLoanIds.has(loanId)) {
                    const preset = LOAN_PRODUCT_PRESETS[seed.type];
                    const releaseDate = nowMinusDays(seed.delinquent ? 240 : 14);
                    const maturityDate = seed.maturityOffsetDays ? nowMinusDays(Math.abs(seed.maturityOffsetDays)) : releaseDate + 90 * 86400000;
                    const interestRate = Number(preset.defaultRatePercent || 0);
                    const totalAmount = Math.round(seed.principal * (1 + interestRate / 100));
                    await db.get<Loan>('loans').create(record => {
                        record._raw.id = loanId;
                        record.borrowerId = borrowerId;
                        record.collectorId = collector.id;
                        record.loanNumber = `SAMPLE-${seed.type.toUpperCase()}`;
                        record.loanType = seed.type;
                        record.principalAmount = seed.principal;
                        record.interestRate = interestRate;
                        record.interestType = 'flat';
                        record.term = Number(preset.defaultTerm || 1);
                        record.termUnit = preset.defaultTermUnit;
                        record.frequency = preset.defaultFrequency;
                        record.totalAmount = totalAmount;
                        record.installmentAmount = Math.round(totalAmount / Math.max(1, Number(preset.defaultTerm || 1)));
                        record.status = seed.status;
                        record.releaseDate = releaseDate;
                        record.firstPaymentDate = releaseDate + 30 * 86400000;
                        record.maturityDate = maturityDate;
                        record.interestAmount = totalAmount - seed.principal;
                        record.notes = `${SAMPLE_MARKER} ${preset.label}`;
                        record.isDelinquent = !!seed.delinquent;
                        record.delinquentSince = seed.delinquent ? nowMinusDays(90) : null;
                        record.encodedBy = 'sample-data';
                    });
                }
            }

            for (const [index, seed] of EXPENSE_SEEDS.entries()) {
                const id = `${EXPENSE_ID_PREFIX}${index + 1}`;
                if (!currentExpenseIds.has(id)) {
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

            const delinquentLoanId = stableId(LOAN_ID_PREFIX, 'standard-Sample Delinquent Client');
            const delinquentBorrowerId = stableId(BORROWER_ID_PREFIX, 'Sample Delinquent Client');
            if (!currentCaseIds.has(`${FILE_CASE_ID_PREFIX}delinquent`)) {
                await db.get<FileCase>('file_cases').create(record => {
                    record._raw.id = `${FILE_CASE_ID_PREFIX}delinquent`;
                    record.loanId = delinquentLoanId;
                    record.borrowerId = delinquentBorrowerId;
                    record.caseNumber = 'SAMPLE-FC-001';
                    record.filedDate = nowMinusDays(7);
                    record.status = 'open';
                    record.notes = `${SAMPLE_MARKER} Six-month overdue account prepared for legal follow-up.`;
                    record.filedBy = 'sample-data';
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

    private static async ensureCollector(db: Database) {
        const existing = await findById<Collector>(db, 'collectors', SAMPLE_COLLECTOR_ID);
        if (existing) return existing;

        let collector: Collector | null = null;
        await db.write(async () => {
            collector = await db.get<Collector>('collectors').create(record => {
                record._raw.id = SAMPLE_COLLECTOR_ID;
                record.fullName = `${SAMPLE_MARKER} Main Collector`;
                record.authId = uuid.v4().toString();
                record.isActive = true;
            });
        });
        return collector!;
    }

    private static async fetchAllSampleRecords(db: Database) {
        const [borrowers, loans, expenses, fileCases] = await Promise.all([
            this.fetchSampleRecords<Borrower>(db, 'borrowers'),
            this.fetchSampleRecords<Loan>(db, 'loans'),
            this.fetchSampleRecords<Expense>(db, 'expenses'),
            this.fetchSampleRecords<FileCase>(db, 'file_cases'),
        ]);
        return [...fileCases, ...expenses, ...loans, ...borrowers];
    }

    private static async fetchSampleRecords<T>(db: Database, table: string): Promise<T[]> {
        const ids = this.sampleIdsForTable(table);
        if (ids.length === 0) return [];
        if (!db || typeof (db as any).get !== 'function') return [];
        const collection = db.get<T & any>(table);
        if (!collection || typeof (collection as any).query !== 'function') return [];
        return await collection.query(Q.where('id', Q.oneOf(ids))).fetch() as T[];
    }

    private static sampleIdsForTable(table: string) {
        if (table === 'borrowers') return LOAN_SEEDS.map(seed => stableId(BORROWER_ID_PREFIX, seed.borrowerName));
        if (table === 'loans') return LOAN_SEEDS.map(seed => stableId(LOAN_ID_PREFIX, `${seed.type}-${seed.borrowerName}`));
        if (table === 'expenses') return EXPENSE_SEEDS.map((_, index) => `${EXPENSE_ID_PREFIX}${index + 1}`);
        if (table === 'file_cases') return [`${FILE_CASE_ID_PREFIX}delinquent`];
        return [];
    }
}

export default SampleDataService;
