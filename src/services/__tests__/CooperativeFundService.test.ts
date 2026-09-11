import { CooperativeFundService } from '../CooperativeFundService';

jest.mock('../SettingsService', () => ({
    SettingsService: {
        getNumberSetting: jest.fn((key, fallback) => Promise.resolve(fallback))
    }
}));

describe('CooperativeFundService', () => {
    it('calculates the correct statutory distribution of net income', async () => {
        const netIncome = 10000;
        const distribution = await CooperativeFundService.calculateSurplusDistribution(netIncome);

        expect(distribution.netIncome).toBe(10000);
        expect(distribution.netSurplus).toBe(7000); // 70%
        expect(distribution.reserveFund).toBe(1000); // 10%
        expect(distribution.educationFund).toBe(1000); // 10%
        expect(distribution.communityDevelopmentFund).toBe(300); // 3%
        expect(distribution.optionalFund).toBe(700); // 7%
        expect(distribution.interestAndPatronageRefund).toBe(7000); // 70%
        expect(distribution.interestOnShareCapital).toBe(4900); // 70% of 70%
        expect(distribution.patronageRefund).toBe(2100); // 30% of 70%
    });

    it('handles rounding correctly for odd amounts', async () => {
        const netIncome = 10000.55;
        const distribution = await CooperativeFundService.calculateSurplusDistribution(netIncome);

        expect(distribution.netIncome).toBe(10000.55);
        expect(distribution.netSurplus).toBe(7000.38);
        expect(distribution.reserveFund).toBe(1000.06); // Math.round(1000.055 * 100) / 100
        expect(distribution.educationFund).toBe(1000.06);
        expect(distribution.communityDevelopmentFund).toBe(300.02); // Math.round(300.0165 * 100) / 100
        expect(distribution.optionalFund).toBe(700.04); // Math.round(700.0385 * 100) / 100
        expect(distribution.interestAndPatronageRefund).toBe(7000.38);
        expect(distribution.interestOnShareCapital).toBe(4900.27);
        expect(distribution.patronageRefund).toBe(2100.11);
    });

    it('returns the ISC and patronage pools from net income', async () => {
        const pools = await CooperativeFundService.calculateMemberDistributionPools(10000);
        expect(pools).toEqual({
            totalISCPool: 4900,
            totalPRPool: 2100,
        });
    });
});
