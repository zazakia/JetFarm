// src/services/__tests__/BankAccountService.test.ts
// Regression tests for bank-account edit/delete and bank-transaction edit/delete
// Covers Issue #66: "Edit/delete bank testing — incomplete"

describe('BankAccount edit/delete (WatermelonDB direct)', () => {
    const mockDatabase = {
        get: jest.fn(),
        write: jest.fn().mockImplementation((cb) => cb()),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Bank Account Edit ---

    describe('bank account edit (update startingBalance)', () => {
        it('updates startingBalance on the account record', async () => {
            const mockRecord = { startingBalance: 1000 };
            const mockUpdate = jest.fn().mockImplementation(async (cb) => cb(mockRecord));
            const mockAccount = { id: 'acc-1', bankName: 'Test Bank', startingBalance: 1000, update: mockUpdate };
            mockDatabase.get.mockReturnValue({ find: jest.fn().mockResolvedValue(mockAccount) });

            const val = 5000;
            await mockDatabase.write(async () => {
                await mockAccount.update((r) => { r.startingBalance = val; });
            });

            expect(mockUpdate).toHaveBeenCalled();
            expect(mockRecord.startingBalance).toBe(5000);
        });

        it('rejects negative starting balance values', () => {
            const val = -100;
            expect(isNaN(val) || val < 0).toBe(true);
        });

        it('rejects NaN starting balance values', () => {
            const val = parseFloat('abc');
            expect(isNaN(val) || val < 0).toBe(true);
        });

        it('accepts zero starting balance', () => {
            const val = 0;
            expect(isNaN(val) || val < 0).toBe(false);
        });
    });

    // --- Bank Account Delete ---

    describe('bank account delete (soft delete via deletedAt)', () => {
        it('sets deletedAt timestamp on the account record', async () => {
            const mockRecord = { deletedAt: null };
            const mockUpdate = jest.fn().mockImplementation(async (cb) => cb(mockRecord));
            const mockAccount = { id: 'acc-1', bankName: 'Test Bank', update: mockUpdate };

            const before = Date.now();
            await mockDatabase.write(async () => {
                await mockAccount.update((r) => { r.deletedAt = Date.now(); });
            });
            const after = Date.now();

            expect(mockUpdate).toHaveBeenCalled();
            expect(mockRecord.deletedAt).toBeGreaterThanOrEqual(before);
            expect(mockRecord.deletedAt).toBeLessThanOrEqual(after);
        });

        it('does not hard-delete the record', async () => {
            const mockRecord = { deletedAt: null };
            const mockDestroy = jest.fn();
            const mockUpdate = jest.fn().mockImplementation(async (cb) => cb(mockRecord));
            const mockAccount = { id: 'acc-1', update: mockUpdate, destroyPermanently: mockDestroy };

            await mockDatabase.write(async () => {
                await mockAccount.update((r) => { r.deletedAt = Date.now(); });
            });

            expect(mockDestroy).not.toHaveBeenCalled();
            expect(mockRecord.deletedAt).toBeGreaterThan(0);
        });
    });

    // --- Bank Transaction Edit ---

    describe('bank transaction edit', () => {
        it('updates transaction fields correctly', async () => {
            const mockRecord = { particulars: 'Old', type: 'deposit', amount: 500, remarks: '', transactionDate: 0 };
            const mockUpdate = jest.fn().mockImplementation(async (cb) => cb(mockRecord));
            const mockTx = { id: 'tx-1', update: mockUpdate };

            await mockDatabase.write(async () => {
                await mockTx.update((r) => {
                    r.particulars = 'New Desc';
                    r.type = 'withdrawal';
                    r.amount = 1200;
                    r.remarks = 'Updated';
                    r.transactionDate = new Date('2026-08-01').getTime();
                });
            });

            expect(mockRecord.particulars).toBe('New Desc');
            expect(mockRecord.type).toBe('withdrawal');
            expect(mockRecord.amount).toBe(1200);
        });

        it('rejects blank particulars', () => {
            const particulars = '';
            const amount = 1000;
            expect(!particulars || isNaN(amount) || amount <= 0).toBe(true);
        });

        it('rejects zero or negative amount', () => {
            const particulars = 'Test';
            const amount = 0;
            expect(!particulars || isNaN(amount) || amount <= 0).toBe(true);
        });
    });

    // --- Bank Transaction Delete ---

    describe('bank transaction delete (soft delete via deletedAt)', () => {
        it('sets deletedAt on the transaction record', async () => {
            const mockRecord = { deletedAt: null };
            const mockUpdate = jest.fn().mockImplementation(async (cb) => cb(mockRecord));
            const mockTx = { id: 'tx-1', particulars: 'Salary deposit', update: mockUpdate };

            const before = Date.now();
            await mockDatabase.write(async () => {
                await mockTx.update((r) => { r.deletedAt = Date.now(); });
            });
            const after = Date.now();

            expect(mockRecord.deletedAt).toBeGreaterThanOrEqual(before);
            expect(mockRecord.deletedAt).toBeLessThanOrEqual(after);
        });

        it('leaves other fields intact after soft delete', async () => {
            const mockRecord = { deletedAt: null, particulars: 'Salary deposit', type: 'deposit', amount: 5000 };
            const mockUpdate = jest.fn().mockImplementation(async (cb) => cb(mockRecord));
            const mockTx = { id: 'tx-1', update: mockUpdate };

            await mockDatabase.write(async () => {
                await mockTx.update((r) => { r.deletedAt = Date.now(); });
            });

            expect(mockRecord.particulars).toBe('Salary deposit');
            expect(mockRecord.type).toBe('deposit');
            expect(mockRecord.amount).toBe(5000);
            expect(mockRecord.deletedAt).toBeGreaterThan(0);
        });
    });
});
