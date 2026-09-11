import { AuditService } from '../AuditService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import { LoanCalcResult } from '../LoanCalculatorService';

describe('AuditService Pre-Save Validation', () => {
    let database: Database;
    let service: AuditService;

    const mockCalcResult: LoanCalcResult = {
        totalInterest: 1000,
        totalFees: 100,
        totalAmount: 6100,
        installmentAmount: 1016.67,
        numPayments: 6,
        maturityDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        firstPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        schedule: [
            { number: 1, dueDate: new Date(), principal: 833.33, interest: 166.67, fees: 16.67, scheduledAmount: 1016.67, balance: 5083.33 },
            { number: 2, dueDate: new Date(), principal: 833.33, interest: 166.67, fees: 16.67, scheduledAmount: 1016.67, balance: 4066.66 },
            { number: 3, dueDate: new Date(), principal: 833.33, interest: 166.67, fees: 16.67, scheduledAmount: 1016.67, balance: 3049.99 },
            { number: 4, dueDate: new Date(), principal: 833.33, interest: 166.67, fees: 16.67, scheduledAmount: 1016.67, balance: 2033.32 },
            { number: 5, dueDate: new Date(), principal: 833.33, interest: 166.67, fees: 16.67, scheduledAmount: 1016.67, balance: 1016.65 },
            { number: 6, dueDate: new Date(), principal: 833.33, interest: 166.67, fees: 16.67, scheduledAmount: 1016.67, balance: 0 },
        ]
    };

    beforeEach(async () => {
        database = createTestDatabase();
        service = new AuditService(database);
    });

    it('returns critical if total amount mismatch', async () => {
        const data = { principal: '5000', ratePercent: '20', deposit: '50', insurance: '50', releaseDate: new Date().toISOString() };
        // totalAmount 6100 matches principal 5000 + interest 1000 + fees 100.
        // Let's create a mismatch
        const badCalc = { ...mockCalcResult, totalAmount: 7000 };
        const issues = await service.validateLoanPreSave(data, badCalc);
        expect(issues.some(i => i.id === 'pre_save_calc_mismatch' && i.category === 'Critical')).toBe(true);
    });

    it('returns warning if borrower has active loan', async () => {
        const borrowerId = 'B1';
        await database.write(async () => {
            await database.get('borrowers').create((r: any) => { r.fullName = 'Borrower 1'; r._raw.id = borrowerId; });
            await database.get('loans').create((l: any) => {
                l.borrowerId = borrowerId;
                l.status = 'active';
                l.loanNumber = 'L-OLD';
            });
        });

        const data = { borrowerId, principal: '5000', ratePercent: '20', deposit: '50', insurance: '50', releaseDate: new Date().toISOString() };
        const issues = await service.validateLoanPreSave(data, mockCalcResult);
        expect(issues.some(i => i.id === 'pre_save_active_loan' && i.category === 'Warning')).toBe(true);
    });

    it('returns critical if renewal has negative net proceeds', async () => {
        const data = { 
            isReloan: true, 
            principal: '5000', 
            deductedAmount: '6000', // Deducting more than principal
            ratePercent: '20', releaseDate: new Date().toISOString() 
        };
        const issues = await service.validateLoanPreSave(data, mockCalcResult);
        expect(issues.some(i => i.id === 'pre_save_negative_net' && i.category === 'Critical')).toBe(true);
    });

    it('returns warning for high interest rate', async () => {
        const data = { ratePercent: '60', principal: '5000', releaseDate: new Date().toISOString() };
        const issues = await service.validateLoanPreSave(data, mockCalcResult);
        expect(issues.some(i => i.id === 'pre_save_high_rate' && i.category === 'Warning')).toBe(true);
    });

    it('returns warning for extreme backdating (>60 days)', async () => {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const data = { releaseDate: ninetyDaysAgo.toISOString(), principal: '5000', ratePercent: '20' };
        const issues = await service.validateLoanPreSave(data, mockCalcResult);
        expect(issues.some(i => i.id === 'pre_save_backdated' && i.category === 'Warning')).toBe(true);
    });
});
