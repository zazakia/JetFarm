import { CooperativeFundService } from '../CooperativeFundService';

jest.mock('../SettingsService', () => ({
    SettingsService: {
        getNumberSetting: jest.fn((key, fallback) => Promise.resolve(fallback))
    }
}));

describe('CooperativeFundService', () => {
    it('calculates the statutory reserve appropriations from net income', async () => {
        const distribution = await CooperativeFundService.calculateSurplusDistribution(10000);

        expect(distribution.netIncome).toBe(10000);
        expect(distribution.reserveFund).toBe(1000); // 10%
        expect(distribution.educationFund).toBe(1000); // 10%
        expect(distribution.communityDevelopmentFund).toBe(300); // 3%
        expect(distribution.optionalFund).toBe(700); // 7%
        expect(distribution.totalStatutoryFunds).toBe(3000);
        expect(distribution.retainedSurplus).toBe(7000);
    });

    it('handles rounding correctly for odd amounts and still adds back to net income', async () => {
        const distribution = await CooperativeFundService.calculateSurplusDistribution(10000.55);

        expect(distribution.netIncome).toBe(10000.55);
        expect(distribution.reserveFund).toBe(1000.06); // Math.round(1000.055 * 100) / 100
        expect(distribution.educationFund).toBe(1000.06);
        expect(distribution.communityDevelopmentFund).toBe(300.02); // Math.round(300.0165 * 100) / 100
        expect(distribution.optionalFund).toBe(700.04); // Math.round(700.0385 * 100) / 100
        expect(distribution.totalStatutoryFunds).toBe(3000.18);

        const funds = distribution.reserveFund + distribution.educationFund
            + distribution.communityDevelopmentFund + distribution.optionalFund;
        expect(Math.abs(funds + distribution.retainedSurplus - distribution.netIncome)).toBeLessThan(0.005);
    });

    it('carries no member-benefit distribution pools', async () => {
        const distribution = await CooperativeFundService.calculateSurplusDistribution(10000);

        for (const retired of ['netSurplus', 'interestAndPatronageRefund', 'interestOnShareCapital', 'patronageRefund']) {
            expect(distribution).not.toHaveProperty(retired);
        }
    });
});
