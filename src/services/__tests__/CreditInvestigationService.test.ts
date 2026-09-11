import { CreditInvestigationService } from '../CreditInvestigationService';
import { database } from '../../database';
import { ShareCapitalService } from '../ShareCapitalService';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
    }
}));

jest.mock('../ShareCapitalService', () => ({
    ShareCapitalService: {
        getCurrentBalance: jest.fn()
    }
}));

describe('CreditInvestigationService', () => {
    let mockFetch: any;
    let mockQuery: any;
    let mockFind: any;

    beforeEach(() => {
        mockFetch = jest.fn();
        mockQuery = jest.fn().mockReturnValue({ fetch: mockFetch });
        mockFind = jest.fn();
        
        (database.get as jest.Mock).mockReturnValue({
            query: mockQuery,
            find: mockFind,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    describe('evaluatePettyCashLoan', () => {
        it('evaluates eligibility based on active loans and share capital', async () => {
            // Mock getActiveLoans and hasDelinquentLoans returning empty/false
            mockFetch.mockResolvedValueOnce([]) // for getActiveLoans
                     .mockResolvedValueOnce([]); // for hasDelinquentLoans
            
            (ShareCapitalService.getCurrentBalance as jest.Mock).mockResolvedValue({
                amount: 2000,
                shares: 20
            });

            const result = await CreditInvestigationService.evaluatePettyCashLoan('borrower-1');

            expect(result.isEligible).toBe(true);
            expect(result.maxLoanableAmount).toBe(1500); // 75% of 2000
            expect(result.reasons).toHaveLength(0);
        });

        it('rejects if borrower has < 10 shares', async () => {
            mockFetch.mockResolvedValueOnce([]) // for getActiveLoans
                     .mockResolvedValueOnce([]); // for hasDelinquentLoans
            
            (ShareCapitalService.getCurrentBalance as jest.Mock).mockResolvedValue({
                amount: 900,
                shares: 9
            });

            const result = await CreditInvestigationService.evaluatePettyCashLoan('borrower-1');

            expect(result.isEligible).toBe(false);
            expect(result.reasons).toContain('Insufficient share capital. Required: 10 shares. Actual: 9 shares.');
        });

        it('rejects if borrower has active petty cash loan', async () => {
            mockFetch.mockResolvedValueOnce([{ loanType: 'petty_cash' }]) // for getActiveLoans
                     .mockResolvedValueOnce([]); // for hasDelinquentLoans
            
            (ShareCapitalService.getCurrentBalance as jest.Mock).mockResolvedValue({
                amount: 2000,
                shares: 20
            });

            const result = await CreditInvestigationService.evaluatePettyCashLoan('borrower-1');

            expect(result.isEligible).toBe(false);
            expect(result.reasons).toContain('Borrower already has an active Petty Cash Loan. Renewal is only allowed after full payment.');
        });
        
        it('rejects if borrower has delinquent loans', async () => {
            mockFetch.mockResolvedValueOnce([]) // for getActiveLoans
                     .mockResolvedValueOnce([{ id: 'delinquent-loan' }]); // for hasDelinquentLoans
            
            (ShareCapitalService.getCurrentBalance as jest.Mock).mockResolvedValue({
                amount: 2000,
                shares: 20
            });

            const result = await CreditInvestigationService.evaluatePettyCashLoan('borrower-1');

            expect(result.isEligible).toBe(false);
            expect(result.reasons).toContain('Borrower has existing delinquent loans. All privileges are frozen.');
        });

        it('handles errors gracefully in evaluatePettyCashLoan', async () => {
            (ShareCapitalService.getCurrentBalance as jest.Mock).mockRejectedValue(new Error('DB connection failed'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const result = await CreditInvestigationService.evaluatePettyCashLoan('borrower-1');

            expect(result.isEligible).toBe(false);
            expect(result.reasons).toContain('Error during credit investigation evaluation.');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('evaluateStandardCoopLoan', () => {
        it('allows standard cooperative loans with no active matching loans', async () => {
            mockFetch.mockResolvedValueOnce([]) // for getActiveLoans
                     .mockResolvedValueOnce([]); // for hasDelinquentLoans
            mockFind.mockResolvedValue({ id: 'borrower-1' });

            const result = await CreditInvestigationService.evaluateStandardCoopLoan('borrower-1', 'salary');

            expect(result.isEligible).toBe(true);
            expect(result.maxLoanableAmount).toBe(5000);
        });

        it('rejects if borrower has active loan of same type', async () => {
            mockFetch.mockResolvedValueOnce([{ loanType: 'livelihood' }]) // for getActiveLoans
                     .mockResolvedValueOnce([]); // for hasDelinquentLoans
            mockFind.mockResolvedValue({ id: 'borrower-1' });

            const result = await CreditInvestigationService.evaluateStandardCoopLoan('borrower-1', 'livelihood');

            expect(result.isEligible).toBe(false);
            expect(result.reasons).toContain('Borrower already has an active livelihood loan. Renewal is only allowed after full payment.');
        });

        it('handles errors gracefully in evaluateStandardCoopLoan', async () => {
            mockFind.mockRejectedValue(new Error('Borrower not found'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const result = await CreditInvestigationService.evaluateStandardCoopLoan('borrower-1', 'emergency');

            expect(result.isEligible).toBe(false);
            expect(result.reasons).toContain('Error during credit investigation evaluation.');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });
});
