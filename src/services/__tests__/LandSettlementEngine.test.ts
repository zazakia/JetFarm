import { LandSettlementEngine } from '../LandSettlementEngine';
import { formatPHP } from '../../utils/currency';

describe('LandSettlementEngine', () => {
    describe('calculateSettlement (Mathematical Invariants)', () => {
        it('Scenario 1: Early partial harvest below guaranteed minimum (5,000 kg)', () => {
            // Land Owner earns ₱1/kg, guarantee is ₱25,000.
            // 5,000 kg * ₱1 = ₱5,000.
            // Target is max(₱5,000, ₱25,000) = ₱25,000.
            // Previously paid = 0.
            // Net payout due = ₱25,000.
            const result = LandSettlementEngine.calculateSettlement(5000, 1.0, 25000, 0);

            expect(result.cumulativeKilos).toBe(5000);
            expect(result.rawKiloEarnings).toBe(5000);
            expect(result.guaranteedMinimum).toBe(25000);
            expect(result.targetCumulativePayout).toBe(25000);
            expect(result.netPayoutDueThisWeek).toBe(25000);
            expect(result.isMinimumApplied).toBe(true);
            expect(result.excessKilosOverGuarantee).toBe(0);
        });

        it('Scenario 2: Week 2 partial harvest (+8,000 kg -> cumulative 13,000 kg)', () => {
            // Raw earnings = 13,000 * ₱1 = ₱13,000.
            // Target is max(₱13,000, ₱25,000) = ₱25,000.
            // Previously paid in Week 1 = ₱25,000.
            // Net payout due = ₱25,000 - ₱25,000 = ₱0.
            const result = LandSettlementEngine.calculateSettlement(13000, 1.0, 25000, 25000);

            expect(result.cumulativeKilos).toBe(13000);
            expect(result.rawKiloEarnings).toBe(13000);
            expect(result.targetCumulativePayout).toBe(25000);
            expect(result.previousCumulativePayout).toBe(25000);
            expect(result.netPayoutDueThisWeek).toBe(0);
            expect(result.isMinimumApplied).toBe(true);
            expect(result.excessKilosOverGuarantee).toBe(0);
        });

        it('Scenario 3: Week 3 harvest crosses guarantee (+17,000 kg -> cumulative 30,000 kg)', () => {
            // Raw earnings = 30,000 * ₱1 = ₱30,000.
            // Target is max(₱30,000, ₱25,000) = ₱30,000.
            // Previously paid = ₱25,000.
            // Net payout due = ₱30,000 - ₱25,000 = ₱5,000.
            const result = LandSettlementEngine.calculateSettlement(30000, 1.0, 25000, 25000);

            expect(result.cumulativeKilos).toBe(30000);
            expect(result.rawKiloEarnings).toBe(30000);
            expect(result.targetCumulativePayout).toBe(30000);
            expect(result.netPayoutDueThisWeek).toBe(5000);
            expect(result.isMinimumApplied).toBe(false);
            expect(result.excessKilosOverGuarantee).toBe(5000);
        });

        it('Scenario 4: High volume harvest (45,000 kg @ ₱1.20/kg, ₱25,000 min, ₱30,000 previously paid)', () => {
            // Raw earnings = 45,000 * ₱1.20 = ₱54,000.
            // Target = ₱54,000.
            // Net payout due = ₱54,000 - ₱30,000 = ₱24,000.
            const result = LandSettlementEngine.calculateSettlement(45000, 1.20, 25000, 30000);

            expect(result.cumulativeKilos).toBe(45000);
            expect(result.rawKiloEarnings).toBe(54000);
            expect(result.targetCumulativePayout).toBe(54000);
            expect(result.netPayoutDueThisWeek).toBe(24000);
            expect(result.isMinimumApplied).toBe(false);
        });

        it('Scenario 5: Zero harvest with zero previous payout ensures minimum is preserved', () => {
            const result = LandSettlementEngine.calculateSettlement(0, 1.0, 25000, 0);

            expect(result.cumulativeKilos).toBe(0);
            expect(result.rawKiloEarnings).toBe(0);
            expect(result.targetCumulativePayout).toBe(25000);
            expect(result.netPayoutDueThisWeek).toBe(25000);
            expect(result.isMinimumApplied).toBe(true);
        });
    });

    describe('generateSettlementSlip', () => {
        it('formats a complete readable settlement slip with currency symbols', () => {
            const slip = LandSettlementEngine.generateSettlementSlip({
                settlementId: 'test-settlement-123',
                cropCycleCode: 'CYC-2026-PCL01',
                landOwnerName: 'Don Ramon Valderrama',
                parcelName: 'Parcel North Alpha',
                weekNumber: 3,
                weekStartDate: new Date('2026-10-01'),
                weekEndDate: new Date('2026-10-07'),
                cumulativeKilos: 32000,
                ratePerKilo: 1.0,
                rawKiloEarnings: 32000,
                guaranteedMinimum: 25000,
                targetCumulativePayout: 32000,
                previousCumulativePayout: 25000,
                netPayoutDueThisWeek: 7000,
                paymentStatus: 'approved',
                disbursementDate: new Date('2026-10-08'),
                receiptReference: 'CHK-998811',
            });

            expect(slip).toContain('JETFARM AGRIBUSINESS PLATFORM');
            expect(slip).toContain('Don Ramon Valderrama');
            expect(slip).toContain('CYC-2026-PCL01');
            expect(slip).toContain('32,000 kg');
            expect(slip).toContain(formatPHP(7000));
            expect(slip).toContain('CHK-998811');
            expect(slip).toContain('Audited & Guarantee-Protected by JetFarm Settlement Engine');
        });
    });
});
