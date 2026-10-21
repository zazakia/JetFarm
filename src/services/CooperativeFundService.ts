import { SettingsService } from './SettingsService';

/**
 * Statutory reserve appropriations under R.A. 9520.
 *
 * The member-benefit split that used to live here (interest on share capital and patronage refund,
 * along with the 'net surplus for distribution' pool they were drawn from) is retired with the
 * lending cooperative on this variant. A farm cooperative that takes no member deposits and issues
 * no loans to members has no patronage base to refund, so whatever the statutory appropriations do
 * not claim is retained and shared out through the crop-partner investor ledger instead.
 */
export interface SurplusDistribution {
    netIncome: number;
    reserveFund: number; // 10%
    educationFund: number; // 10%
    communityDevelopmentFund: number; // 3%
    optionalFund: number; // 7%
    totalStatutoryFunds: number;
    retainedSurplus: number; // net income less the appropriations above
}

export class CooperativeFundService {
    /**
     * Calculates the statutory reserve appropriations from net income.
     * Allocation percentages are fetched dynamically from settings.
     */
    static async calculateSurplusDistribution(netIncome: number): Promise<SurplusDistribution> {
        const reserveFundPct = await SettingsService.getNumberSetting('fund.reserve_fund_allocation', 0.10);
        const educationFundPct = await SettingsService.getNumberSetting('fund.education_fund_allocation', 0.10);
        const communityFundPct = await SettingsService.getNumberSetting('fund.community_development_fund_allocation', 0.03);
        const optionalFundPct = await SettingsService.getNumberSetting('fund.optional_fund_allocation', 0.07);

        const reserveFund = this.roundCurrency(netIncome * reserveFundPct);
        const educationFund = this.roundCurrency(netIncome * educationFundPct);
        const communityDevelopmentFund = this.roundCurrency(netIncome * communityFundPct);
        const optionalFund = this.roundCurrency(netIncome * optionalFundPct);

        const totalStatutoryFunds = this.roundCurrency(
            reserveFund + educationFund + communityDevelopmentFund + optionalFund,
        );

        return {
            netIncome,
            reserveFund,
            educationFund,
            communityDevelopmentFund,
            optionalFund,
            totalStatutoryFunds,
            retainedSurplus: this.roundCurrency(netIncome - totalStatutoryFunds),
        };
    }

    private static roundCurrency(amount: number): number {
        return Math.round(amount * 100) / 100;
    }
}
