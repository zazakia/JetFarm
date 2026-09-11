import { database } from '../database';
import { SettingsService } from './SettingsService';

export interface SurplusDistribution {
    netIncome: number;
    netSurplus: number; // 70% for distribution to members
    reserveFund: number; // 10%
    educationFund: number; // 10%
    communityDevelopmentFund: number; // 3%
    optionalFund: number; // 7%
    interestAndPatronageRefund: number; // alias for netSurplus, kept for existing report compatibility
    interestOnShareCapital: number; // 70% of member distribution
    patronageRefund: number; // 30% of member distribution
}

export class CooperativeFundService {
    /**
     * Calculates the statutory distribution of net income according to the POS Cursor manual.
     * Allocation percentages are fetched dynamically from settings.
     */
    static async calculateSurplusDistribution(netIncome: number): Promise<SurplusDistribution> {
        const netSurplusPct = await SettingsService.getNumberSetting('fund.net_surplus_allocation', 0.70);
        const reserveFundPct = await SettingsService.getNumberSetting('fund.reserve_fund_allocation', 0.10);
        const educationFundPct = await SettingsService.getNumberSetting('fund.education_fund_allocation', 0.10);
        const communityFundPct = await SettingsService.getNumberSetting('fund.community_development_fund_allocation', 0.03);
        const optionalFundPct = await SettingsService.getNumberSetting('fund.optional_fund_allocation', 0.07);

        const iscPct = await SettingsService.getNumberSetting('fund.isc_distribution', 0.70);
        const prPct = await SettingsService.getNumberSetting('fund.pr_distribution', 0.30);

        const netSurplus = this.roundCurrency(netIncome * netSurplusPct);
        const interestOnShareCapital = this.roundCurrency(netSurplus * iscPct);
        const patronageRefund = this.roundCurrency(netSurplus * prPct);

        return {
            netIncome,
            netSurplus,
            reserveFund: this.roundCurrency(netIncome * reserveFundPct),
            educationFund: this.roundCurrency(netIncome * educationFundPct),
            communityDevelopmentFund: this.roundCurrency(netIncome * communityFundPct),
            optionalFund: this.roundCurrency(netIncome * optionalFundPct),
            interestAndPatronageRefund: netSurplus,
            interestOnShareCapital,
            patronageRefund,
        };
    }

    static async calculateMemberDistributionPools(netIncome: number) {
        const distribution = await this.calculateSurplusDistribution(netIncome);
        return {
            totalISCPool: distribution.interestOnShareCapital,
            totalPRPool: distribution.patronageRefund,
        };
    }

    private static roundCurrency(amount: number): number {
        return Math.round(amount * 100) / 100;
    }
}
