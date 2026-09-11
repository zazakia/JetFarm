import { ExcessCashReceiptService } from '../ExcessCashReceiptService';

describe('ExcessCashReceiptService', () => {
    const paymentDate = new Date('2026-05-14T00:00:00Z');

    describe('buildReportRows', () => {
        it('computes excess cash as current salary less each payment', () => {
            const rows = ExcessCashReceiptService.buildReportRows(15000, [
                {
                    id: 'p1',
                    borrowerName: 'AILEENE T. DE LEON',
                    bankName: 'Land Bank',
                    bankAccountName: 'AILEENE T. DE LEON',
                    bankAccountNumber: '1234',
                    loanNumber: 'LN-001',
                    paymentAmount: 5200,
                    paymentDate,
                    receiptNumber: 'OR-1',
                },
                {
                    id: 'p2',
                    borrowerName: 'Borrower Two',
                    paymentAmount: 16000,
                    paymentDate: paymentDate.getTime(),
                },
            ]);

            expect(rows).toEqual([
                expect.objectContaining({
                    borrowerName: 'AILEENE T. DE LEON',
                    savingsBankAccount: 'Land Bank / AILEENE T. DE LEON / 1234',
                    currentSalary: 15000,
                    currentPayment: 5200,
                    excessCash: 9800,
                    loanNumber: 'LN-001',
                    receiptNumber: 'OR-1',
                }),
                expect.objectContaining({
                    borrowerName: 'Borrower Two',
                    savingsBankAccount: 'No savings bank account on file',
                    currentPayment: 16000,
                    excessCash: 0,
                    loanNumber: 'N/A',
                    receiptNumber: 'N/A',
                }),
            ]);
        });

        it('rounds currency values for report calculations', () => {
            expect(ExcessCashReceiptService.calculateExcessCash(1000.335, 250.111)).toBe(750.22);
        });
    });

    it('prints a receipt when payment exceeds the current amount due', async () => {
        const printer = { generateExcessCashReceipt: jest.fn().mockResolvedValue(undefined) };
        const service = new ExcessCashReceiptService(printer, { warn: jest.fn() });

        const result = await service.printIfNeeded({
            loan: { borrowerName: 'Borrower One', loanNumber: 'LN-1' },
            paymentAmount: 4500,
            amountDueBeforePayment: 1800,
            paymentDate,
            receiptNumber: 'R-1',
            preparedBy: 'Admin',
        });

        expect(result).toEqual({ shouldPrint: true, printed: true, excessAmount: 2700 });
        expect(printer.generateExcessCashReceipt).toHaveBeenCalledWith(expect.objectContaining({
            borrowerName: 'Borrower One',
            loanNumber: 'LN-1',
            amountReceived: 4500,
            amountDue: 1800,
            amountRemaining: 2700,
        }));
    });

    it('does not print when there is no excess cash', async () => {
        const printer = { generateExcessCashReceipt: jest.fn() };
        const service = new ExcessCashReceiptService(printer, { warn: jest.fn() });

        const result = await service.printIfNeeded({
            loan: { borrowerName: 'Borrower One', loanNumber: 'LN-1' },
            paymentAmount: 1000,
            amountDueBeforePayment: 1800,
            paymentDate,
        });

        expect(result).toEqual({ shouldPrint: false, printed: false, excessAmount: 0 });
        expect(printer.generateExcessCashReceipt).not.toHaveBeenCalled();
    });

    it('does not throw when printing fails, so payment save can still finish', async () => {
        const error = new Error('print unavailable');
        const warn = jest.fn();
        const printer = { generateExcessCashReceipt: jest.fn().mockRejectedValue(error) };
        const service = new ExcessCashReceiptService(printer, { warn });

        const result = await service.printIfNeeded({
            loan: { borrowerName: 'Borrower One', loanNumber: 'LN-1' },
            paymentAmount: 4500,
            amountDueBeforePayment: 1800,
            paymentDate,
        });

        expect(result.shouldPrint).toBe(true);
        expect(result.printed).toBe(false);
        expect(result.excessAmount).toBe(2700);
        expect(result.error).toBe(error);
        expect(warn).toHaveBeenCalledWith('[ExcessCashReceiptService] Excess cash receipt printing failed:', error);
    });

    it('handles missing loan context without throwing', async () => {
        const printer = { generateExcessCashReceipt: jest.fn() };
        const service = new ExcessCashReceiptService(printer, { warn: jest.fn() });

        const result = await service.printIfNeeded({
            loan: null,
            paymentAmount: 4500,
            amountDueBeforePayment: 1800,
            paymentDate,
        });

        expect(result).toEqual({ shouldPrint: false, printed: false, excessAmount: 2700 });
        expect(printer.generateExcessCashReceipt).not.toHaveBeenCalled();
    });
});
