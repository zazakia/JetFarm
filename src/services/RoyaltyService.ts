/**
 * RoyaltyService
 *
 * Computes and manages the 80/20 Franchise Royalty Split for Crispy King:
 * - Net Income = Gross Sales - COGS - OPEX
 * - Operator Share = 80% of Net Income
 * - Franchisor Share = 20% of Net Income (payable to ERT-Crispy King Ventures Inc.)
 * - Automatically generates Accounts Payable Voucher upon executive settlement approval
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import RoyaltyCalculation from '../database/models/RoyaltyCalculation';
import AccountsPayableVoucher from '../database/models/AccountsPayableVoucher';
import { MSRService, MSRServiceClass } from './MSRService';

export interface RoyaltyCalculationInput {
    branchId: string;
    year: number;
    month: number;
    grossSales?: number;
    cogs?: number;
    opex?: number;
    notes?: string;
}

export class RoyaltyServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    /**
     * Compute monthly royalty for a branch based on 80/20 formula
     */
    async calculateMonthlyRoyalty(input: RoyaltyCalculationInput): Promise<RoyaltyCalculation> {
        let grossSales = input.grossSales;
        let cogs = input.cogs;
        let opex = input.opex;

        // If financial figures were not provided, fetch from MSR rollup using the same db instance
        if (grossSales === undefined || cogs === undefined || opex === undefined) {
            const msrService = new MSRServiceClass(this.db);
            const msr = await msrService.generateMonthlyStoreReport(
                input.branchId,
                input.year,
                input.month
            );
            grossSales = msr.grossSales;
            cogs = msr.cogs;
            opex = msr.opex;
        }

        const grossProfit = Math.round((grossSales - cogs) * 100) / 100;
        const netIncome = Math.round((grossProfit - opex) * 100) / 100;
        const cogsRatio = grossSales > 0 ? (cogs / grossSales) * 100 : 0;
        const netMargin = grossSales > 0 ? (netIncome / grossSales) * 100 : 0;

        // If net income is positive, split 80% Operator / 20% Franchisor
        // If loss, no franchisor royalty dividend is levied
        const operatorShare = netIncome > 0 ? Math.round(netIncome * 0.8 * 100) / 100 : 0;
        const franchisorShare = netIncome > 0 ? Math.round(netIncome * 0.2 * 100) / 100 : 0;

        let record!: RoyaltyCalculation;

        await this.db.write(async () => {
            record = await this.db.get<RoyaltyCalculation>('royalty_calculations').create((rec) => {
                rec.branchId = input.branchId;
                rec.periodYear = input.year;
                rec.periodMonth = input.month;
                rec.grossSales = grossSales;
                rec.cogs = cogs;
                rec.cogsRatio = Math.round(cogsRatio * 100) / 100;
                rec.grossProfit = grossProfit;
                rec.opex = opex;
                rec.netIncome = netIncome;
                rec.netMargin = Math.round(netMargin * 100) / 100;
                rec.operatorShare = operatorShare;
                rec.franchisorShare = franchisorShare;
                rec.status = 'computed';
                rec.notes = input.notes ?? null;
            });
        });

        return record;
    }

    /**
     * Batch calculate royalties for all branches for a given month
     */
    async calculateAllBranchesRoyalty(
        year: number,
        month: number,
        branchIds: string[]
    ): Promise<RoyaltyCalculation[]> {
        const results: RoyaltyCalculation[] = [];
        for (const branchId of branchIds) {
            const res = await this.calculateMonthlyRoyalty({ branchId, year, month });
            results.push(res);
        }
        return results;
    }

    /**
     * Approve royalty settlement:
     * - Flags royalty as 'approved'
     * - Automatically posts Accounts Payable Voucher for 20% Franchisor Share
     */
    async approveRoyaltySettlement(
        royaltyId: string,
        approverId: string
    ): Promise<RoyaltyCalculation> {
        const royalty = await this.db
            .get<RoyaltyCalculation>('royalty_calculations')
            .find(royaltyId);

        let apVoucher: AccountsPayableVoucher | null = null;

        await this.db.write(async () => {
            const voucherNumber = `AP-ROY-${royalty.periodYear}${String(royalty.periodMonth).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

            apVoucher = await this.db
                .get<AccountsPayableVoucher>('accounts_payable_vouchers')
                .create((voucher) => {
                    voucher.supplierId = 'ERT-Crispy King Ventures Inc.';
                    voucher.voucherNumber = voucherNumber;
                    voucher.invoiceDate = new Date();
                    voucher.description = `20% Franchisor Royalty Share — ${royalty.branchId} (${royalty.periodYear}-${royalty.periodMonth})`;
                    voucher.amount = royalty.franchisorShare;
                    voucher.balance = royalty.franchisorShare;
                    voucher.status = 'approved';
                    voucher.postedBy = approverId;
                });

            await royalty.update((rec) => {
                rec.status = 'approved';
                rec.approvedBy = approverId;
                rec.approvedAt = new Date();
                rec.apVoucherId = apVoucher?.id ?? null;
            });
        });

        return royalty;
    }

    /**
     * Get royalty calculation history for a branch or all branches
     */
    async getRoyalties(year?: number, month?: number, branchId?: string): Promise<RoyaltyCalculation[]> {
        const conditions = [Q.where('deleted_at', Q.eq(null))];
        if (year) conditions.push(Q.where('period_year', year));
        if (month) conditions.push(Q.where('period_month', month));
        if (branchId) conditions.push(Q.where('branch_id', branchId));

        return await this.db
            .get<RoyaltyCalculation>('royalty_calculations')
            .query(...conditions, Q.sortBy('created_at', Q.desc))
            .fetch();
    }
}

const instance = new RoyaltyServiceClass();
export { instance as RoyaltyService };
export default instance;
