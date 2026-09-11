import { Database, Q } from '@nozbe/watermelondb';
import uuid from 'react-native-uuid';
import { database as globalDatabase } from '../database';
import CashTransaction from '../database/models/CashTransaction';
import BankTransaction from '../database/models/BankTransaction';
import { AutoPostingServiceClass } from './AutoPostingService';
import { SeriesService } from './SeriesService';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type OtherReceiptCategory =
    | 'service_charge'
    | 'processing_fee'
    | 'membership_fee'
    | 'passbook_fee'
    | 'miscellaneous_income'
    | 'other_income'
    | 'share_capital'
    | 'savings_deposit'
    | 'custom';

export interface OtherReceiptCategoryInfo {
    key: OtherReceiptCategory;
    label: string;
    accountCode: string;
    accountName: string;
    icon: string;
    color: string;
}

export const OTHER_RECEIPT_CATEGORIES: Record<OtherReceiptCategory, OtherReceiptCategoryInfo> = {
    service_charge: {
        key: 'service_charge',
        label: 'Service Charge',
        accountCode: '4020',
        accountName: 'Service Charges',
        icon: 'design-services',
        color: '#2563EB', // Blue
    },
    processing_fee: {
        key: 'processing_fee',
        label: 'Processing Fee',
        accountCode: '4020',
        accountName: 'Service Charges',
        icon: 'fact-check',
        color: '#0284C7', // Sky
    },
    membership_fee: {
        key: 'membership_fee',
        label: 'Membership Fee',
        accountCode: '4030',
        accountName: 'Membership Fees',
        icon: 'card-membership',
        color: '#16A34A', // Green
    },
    passbook_fee: {
        key: 'passbook_fee',
        label: 'Passbook Fee',
        accountCode: '4070',
        accountName: 'Miscellaneous Income',
        icon: 'menu-book',
        color: '#D97706', // Amber
    },
    miscellaneous_income: {
        key: 'miscellaneous_income',
        label: 'Miscellaneous Income',
        accountCode: '4070',
        accountName: 'Miscellaneous Income',
        icon: 'receipt',
        color: '#7C3AED', // Purple
    },
    other_income: {
        key: 'other_income',
        label: 'Other Income',
        accountCode: '4060',
        accountName: 'Other Income',
        icon: 'payments',
        color: '#059669', // Emerald
    },
    share_capital: {
        key: 'share_capital',
        label: 'Share Capital (CBU)',
        accountCode: '3010',
        accountName: 'Share Capital',
        icon: 'account-balance',
        color: '#1E3A8A', // Indigo
    },
    savings_deposit: {
        key: 'savings_deposit',
        label: 'Savings Deposit',
        accountCode: '2010',
        accountName: 'Savings Deposits Payable',
        icon: 'savings',
        color: '#0D9488', // Teal
    },
    custom: {
        key: 'custom',
        label: 'Other Receipts',
        accountCode: '4060',
        accountName: 'Other Income',
        icon: 'more-horiz',
        color: '#4B5563', // Gray
    },
};

export interface CreateOtherReceiptInput {
    receiptNumber?: string;
    payorName: string;
    borrowerId?: string;
    category: OtherReceiptCategory;
    amount: number;
    paymentMethod?: 'cash' | 'bank';
    bankAccountId?: string;
    notes?: string;
    transactionDate?: Date;
    recordedBy?: string;
}

export interface OtherReceiptItem {
    id: string;
    receiptNumber: string;
    payorName: string;
    borrowerId?: string;
    category: OtherReceiptCategory;
    categoryLabel: string;
    amount: number;
    paymentMethod: 'cash' | 'bank';
    bankAccountId?: string;
    notes?: string;
    transactionDate: number;
    recordedBy?: string;
    createdAt: number;
}

export interface OtherReceiptSummary {
    totalAmount: number;
    receiptCount: number;
    averageAmount: number;
    categoryBreakdown: {
        category: OtherReceiptCategory;
        label: string;
        amount: number;
        count: number;
        percentage: number;
        color: string;
        icon: string;
    }[];
    paymentMethodBreakdown: {
        cash: number;
        bank: number;
    };
    receipts: OtherReceiptItem[];
}

export class OtherReceiptServiceClass {
    protected db: Database;
    protected autoPostingService: AutoPostingServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.autoPostingService = new AutoPostingServiceClass(db);
    }

    /**
     * Creates and records an Official Other Receipt, saves to WatermelonDB,
     * optionally records bank transaction, and triggers automatic accounting posting.
     */
    async createReceipt(input: CreateOtherReceiptInput): Promise<OtherReceiptItem> {
        if (!input.payorName || !input.payorName.trim()) {
            throw new Error('Payor name is required.');
        }

        const amount = Number(input.amount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Amount must be a positive number.');
        }

        const categoryKey = input.category || 'other_income';
        const categoryInfo = OTHER_RECEIPT_CATEGORIES[categoryKey] || OTHER_RECEIPT_CATEGORIES.other_income;
        const receiptNumber = (input.receiptNumber && input.receiptNumber.trim()) 
            ? input.receiptNumber.trim() 
            : SeriesService.generateReceiptNumber();
        
        const now = input.transactionDate ? input.transactionDate.getTime() : Date.now();
        const txnId = uuid.v4().toString();
        const paymentMethod = input.paymentMethod || 'cash';

        const metadata = {
            receiptNumber,
            payorName: input.payorName.trim(),
            borrowerId: input.borrowerId || null,
            category: categoryKey,
            paymentMethod,
            bankAccountId: input.bankAccountId || null,
            notes: input.notes?.trim() || '',
            isOtherReceipt: true,
        };

        const particulars = `[OTHER_RECEIPT:${categoryKey}] OR# ${receiptNumber} - ${input.payorName.trim()} (${categoryInfo.label})${input.notes ? `: ${input.notes.trim()}` : ''}`;

        // 1. Create main CashTransaction record
        await this.db.write(async () => {
            await this.db.get<CashTransaction>('cash_transactions').create(txn => {
                txn._raw.id = txnId;
                txn.particulars = particulars;
                txn.amount = amount;
                txn.type = 'in';
                txn.transactionDate = now;
                txn.remarks = JSON.stringify(metadata);
                txn.recordedBy = input.recordedBy || null;
                txn.isPettyCash = false;
            });

            // 2. If payment is through Bank Account, create a corresponding BankTransaction
            if (paymentMethod === 'bank' && input.bankAccountId) {
                await this.db.get<BankTransaction>('bank_transactions').create(bTxn => {
                    bTxn._raw.id = uuid.v4().toString();
                    bTxn.bankAccountId = input.bankAccountId!;
                    bTxn.transactionDate = now;
                    bTxn.type = 'deposit';
                    bTxn.amount = amount;
                    bTxn.particulars = `Other Receipt OR# ${receiptNumber} from ${input.payorName.trim()} (${categoryInfo.label})`;
                });
            }
        });

        // 3. Post to accounting General Ledger
        try {
            await this.autoPostingService.postOtherReceipt({
                receiptId: txnId,
                receiptNumber,
                payorName: input.payorName.trim(),
                amount,
                feeType: categoryKey,
                paymentMethod,
                entryDate: new Date(now),
                notes: input.notes?.trim(),
                postedBy: input.recordedBy,
            });
        } catch (postErr) {
            console.warn('[OtherReceiptService] Auto-posting warning:', postErr);
        }

        return {
            id: txnId,
            receiptNumber,
            payorName: input.payorName.trim(),
            borrowerId: input.borrowerId,
            category: categoryKey,
            categoryLabel: categoryInfo.label,
            amount,
            paymentMethod,
            bankAccountId: input.bankAccountId,
            notes: input.notes?.trim(),
            transactionDate: now,
            recordedBy: input.recordedBy,
            createdAt: now,
        };
    }

    /**
     * Parses a CashTransaction model record into an OtherReceiptItem if it matches receipt metadata
     */
    protected parseCashTransactionToReceipt(txn: CashTransaction): OtherReceiptItem | null {
        if (!txn || txn.type !== 'in') return null;

        const isReceiptFormat = txn.particulars && (
            txn.particulars.startsWith('[OTHER_RECEIPT:') ||
            txn.particulars.includes('Misc Income') ||
            txn.particulars.includes('Membership Fee') ||
            txn.particulars.includes('Passbook Fee') ||
            txn.particulars.includes('Service Charge') ||
            txn.particulars.includes('OR#')
        );

        let metadata: any = null;
        if (txn.remarks) {
            try {
                metadata = JSON.parse(txn.remarks);
            } catch {
                metadata = null;
            }
        }

        if (!isReceiptFormat && (!metadata || !metadata.isOtherReceipt)) {
            return null;
        }

        let categoryKey: OtherReceiptCategory = 'other_income';
        if (metadata?.category && OTHER_RECEIPT_CATEGORIES[metadata.category as OtherReceiptCategory]) {
            categoryKey = metadata.category as OtherReceiptCategory;
        } else if (txn.particulars) {
            const lower = txn.particulars.toLowerCase();
            if (lower.includes('service')) categoryKey = 'service_charge';
            else if (lower.includes('processing')) categoryKey = 'processing_fee';
            else if (lower.includes('membership')) categoryKey = 'membership_fee';
            else if (lower.includes('passbook')) categoryKey = 'passbook_fee';
            else if (lower.includes('misc')) categoryKey = 'miscellaneous_income';
            else if (lower.includes('share') || lower.includes('cbu')) categoryKey = 'share_capital';
            else if (lower.includes('saving')) categoryKey = 'savings_deposit';
        }

        const categoryInfo = OTHER_RECEIPT_CATEGORIES[categoryKey] || OTHER_RECEIPT_CATEGORIES.other_income;
        const receiptNumber = metadata?.receiptNumber || this.extractReceiptNumber(txn.particulars) || `OR-${txn.id.substring(0, 6).toUpperCase()}`;
        const payorName = metadata?.payorName || this.extractPayorName(txn.particulars) || 'Member / Customer';

        return {
            id: txn.id,
            receiptNumber,
            payorName,
            borrowerId: metadata?.borrowerId,
            category: categoryKey,
            categoryLabel: categoryInfo.label,
            amount: Number(txn.amount) || 0,
            paymentMethod: (metadata?.paymentMethod as 'cash' | 'bank') || 'cash',
            bankAccountId: metadata?.bankAccountId,
            notes: metadata?.notes || '',
            transactionDate: txn.transactionDate,
            recordedBy: txn.recordedBy,
            createdAt: txn.createdAt || txn.transactionDate,
        };
    }

    protected extractReceiptNumber(particulars?: string): string | null {
        if (!particulars) return null;
        const match = particulars.match(/OR#?\s*([A-Za-z0-9-]+)/i);
        return match ? match[1] : null;
    }

    protected extractPayorName(particulars?: string): string | null {
        if (!particulars) return null;
        const match = particulars.match(/-\s*([^(:\[]+)/);
        return match ? match[1].trim() : null;
    }

    /**
     * Query other receipts with optional filtering by date range, category, or search string.
     */
    async getReceipts(filters?: {
        startDate?: Date;
        endDate?: Date;
        category?: OtherReceiptCategory;
        search?: string;
    }): Promise<OtherReceiptItem[]> {
        const clauses: any[] = [
            Q.where('deleted_at', null),
            Q.where('type', 'in'),
        ];

        if (filters?.startDate && filters?.endDate) {
            clauses.push(Q.where('transaction_date', Q.between(filters.startDate.getTime(), filters.endDate.getTime())));
        } else if (filters?.startDate) {
            clauses.push(Q.where('transaction_date', Q.gte(filters.startDate.getTime())));
        } else if (filters?.endDate) {
            clauses.push(Q.where('transaction_date', Q.lte(filters.endDate.getTime())));
        }

        clauses.push(Q.sortBy('transaction_date', Q.desc));

        const cashTxns = await this.db.get<CashTransaction>('cash_transactions')
            .query(...clauses)
            .fetch();

        let receipts = cashTxns
            .map(txn => this.parseCashTransactionToReceipt(txn))
            .filter((item): item is OtherReceiptItem => item !== null);

        if (filters?.category) {
            receipts = receipts.filter(r => r.category === filters.category);
        }

        if (filters?.search && filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            receipts = receipts.filter(r => 
                r.payorName.toLowerCase().includes(q) ||
                r.receiptNumber.toLowerCase().includes(q) ||
                r.categoryLabel.toLowerCase().includes(q) ||
                (r.notes && r.notes.toLowerCase().includes(q))
            );
        }

        return receipts;
    }

    /**
     * Generates a comprehensive summary report (Daily, Monthly, Yearly)
     * with category breakdown, channel breakdown, and receipt itemization.
     */
    async getReceiptSummary(filters: {
        period: 'daily' | 'monthly' | 'yearly' | 'custom';
        date?: Date;
        startDate?: Date;
        endDate?: Date;
    }): Promise<OtherReceiptSummary> {
        const refDate = filters.date || new Date();
        let start: Date;
        let end: Date;

        if (filters.period === 'daily') {
            start = startOfDay(refDate);
            end = endOfDay(refDate);
        } else if (filters.period === 'monthly') {
            start = startOfMonth(refDate);
            end = endOfMonth(refDate);
        } else if (filters.period === 'yearly') {
            start = startOfYear(refDate);
            end = endOfYear(refDate);
        } else {
            start = filters.startDate ? startOfDay(filters.startDate) : startOfMonth(refDate);
            end = filters.endDate ? endOfDay(filters.endDate) : endOfMonth(refDate);
        }

        const receipts = await this.getReceipts({ startDate: start, endDate: end });

        const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
        const receiptCount = receipts.length;
        const averageAmount = receiptCount > 0 ? totalAmount / receiptCount : 0;

        // Category breakdown aggregation
        const categoryMap: Record<string, { amount: number; count: number }> = {};
        Object.keys(OTHER_RECEIPT_CATEGORIES).forEach(k => {
            categoryMap[k] = { amount: 0, count: 0 };
        });

        let cashTotal = 0;
        let bankTotal = 0;

        receipts.forEach(r => {
            if (!categoryMap[r.category]) {
                categoryMap[r.category] = { amount: 0, count: 0 };
            }
            categoryMap[r.category].amount += r.amount;
            categoryMap[r.category].count += 1;

            if (r.paymentMethod === 'bank') {
                bankTotal += r.amount;
            } else {
                cashTotal += r.amount;
            }
        });

        const categoryBreakdown = Object.entries(categoryMap)
            .map(([catKey, data]) => {
                const cat = catKey as OtherReceiptCategory;
                const info = OTHER_RECEIPT_CATEGORIES[cat] || OTHER_RECEIPT_CATEGORIES.other_income;
                return {
                    category: cat,
                    label: info.label,
                    amount: data.amount,
                    count: data.count,
                    percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
                    color: info.color,
                    icon: info.icon,
                };
            })
            .filter(b => b.count > 0 || totalAmount === 0)
            .sort((a, b) => b.amount - a.amount);

        return {
            totalAmount,
            receiptCount,
            averageAmount,
            categoryBreakdown,
            paymentMethodBreakdown: {
                cash: cashTotal,
                bank: bankTotal,
            },
            receipts,
        };
    }
}

const instance = new OtherReceiptServiceClass();
export { instance as OtherReceiptService };
export default instance;
