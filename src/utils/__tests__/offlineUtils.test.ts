// Mock the database module to use test database
import {
    generateUUID,
    createBorrowerOffline,
    updateBorrowerOffline,
    createPaymentOffline,
    getBorrowersByCollector,
    getPendingChangesCount,
    verifyOfflineData,
    assignCollectorToBorrower,
    getRecordSyncStatus,
} from '../offlineUtils';

const mockQuery = jest.fn();
const mockFetch = jest.fn();
const mockFetchCount = jest.fn();
const mockCreate = jest.fn();
const mockFind = jest.fn();

const mockCollection = {
    query: mockQuery,
    create: mockCreate,
    find: mockFind,
    get: jest.fn().mockReturnThis(),
};

mockQuery.mockReturnValue({
    fetch: mockFetch,
    fetchCount: mockFetchCount,
});

jest.mock('../../database', () => ({
    database: {
        collections: {
            get: jest.fn(() => mockCollection),
        },
    },
}));

jest.mock('react-native-get-random-values', () => ({}), { virtual: true });
jest.mock('react-native-uuid', () => ({
    v4: () => 'mock-uuid-1234',
}));

describe('offlineUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReturnValue({
            fetch: mockFetch,
            fetchCount: mockFetchCount,
        });
    });

    describe('generateUUID', () => {
        it('returns a non-empty string', () => {
            const uuid = generateUUID();
            expect(typeof uuid).toBe('string');
            expect(uuid.length).toBeGreaterThan(0);
        });
    });

    describe('createBorrowerOffline', () => {
        it('creates a borrower record with required fields', async () => {
            const mockBorrower = { id: 'b-1' };
            mockCollection.create.mockImplementationOnce(async (callback: any) => {
                if (callback) callback(mockBorrower);
                return mockBorrower;
            });

            const result = await createBorrowerOffline({
                fullName: 'Test Borrower',
                phone: '09171234567',
                address: '123 Main St',
                collectorId: 'c-1',
                createdBy: 'user-1',
            });

            expect(result).toEqual(mockBorrower);
            expect(mockCollection.create).toHaveBeenCalled();
        });

        it('throws when createdBy is empty', async () => {
            await expect(
                createBorrowerOffline({
                    fullName: 'Test',
                    phone: '09171234567',
                    address: '123 Main St',
                    collectorId: 'c-1',
                    createdBy: '',
                })
            ).rejects.toThrow('createdBy cannot be empty');
        });

        it('throws when createdBy is whitespace only', async () => {
            await expect(
                createBorrowerOffline({
                    fullName: 'Test',
                    phone: '09171234567',
                    address: '123 Main St',
                    collectorId: 'c-1',
                    createdBy: '   ',
                })
            ).rejects.toThrow('createdBy cannot be empty');
        });

        it('includes optional fields when provided', async () => {
            const mockBorrower = { id: 'b-2' };
            mockCollection.create.mockImplementationOnce(async (callback: any) => {
                if (callback) callback(mockBorrower);
                return mockBorrower;
            });

            const result = await createBorrowerOffline({
                fullName: 'Test Borrower',
                phone: '09171234567',
                address: '123 Main St',
                collectorId: 'c-1',
                createdBy: 'user-1',
                gender: 'Male',
                area: 'Area 1',
                dateOfBirth: 946684800000,
                notes: 'Some notes',
                latitude: 10.3157,
                longitude: 123.8854,
            });

            expect(result).toEqual(mockBorrower);
        });

        it('propagates database errors', async () => {
            mockCollection.create.mockRejectedValue(new Error('DB write failed'));

            await expect(
                createBorrowerOffline({
                    fullName: 'Test',
                    phone: '09171234567',
                    address: '123 Main St',
                    collectorId: 'c-1',
                    createdBy: 'user-1',
                })
            ).rejects.toThrow('DB write failed');
        });
    });

    describe('updateBorrowerOffline', () => {
        it('updates a borrower with partial fields', async () => {
            const mockBorrower = {
                id: 'b-1',
                update: jest.fn().mockImplementation(async (fn) => {
                    fn(mockBorrower);
                    return mockBorrower;
                }),
            };
            mockCollection.find.mockResolvedValue(mockBorrower);

            const result = await updateBorrowerOffline('b-1', {
                fullName: 'Updated Name',
                phone: '09170000000',
                address: 'Updated Address',
                collectorId: 'c-2',
                gender: 'Female',
                area: 'Updated Area',
                dateOfBirth: 946684800001,
                notes: 'Updated notes',
                latitude: 10.1,
                longitude: 123.1,
            });

            expect(mockCollection.find).toHaveBeenCalledWith('b-1');
            expect(mockBorrower.update).toHaveBeenCalled();
        });

        it('propagates errors when borrower not found', async () => {
            mockCollection.find.mockRejectedValue(new Error('Record not found'));

            await expect(
                updateBorrowerOffline('nonexistent', { fullName: 'Test' })
            ).rejects.toThrow('Record not found');
        });
    });

    describe('createPaymentOffline', () => {
        it('creates a payment record', async () => {
            const mockPayment = { id: 'p-1' };
            mockCollection.create.mockImplementationOnce(async (callback: any) => {
                if (callback) callback(mockPayment);
                return mockPayment;
            });

            const result = await createPaymentOffline({
                loanId: 'l-1',
                collectorId: 'c-1',
                amount: 500,
            });

            expect(result).toEqual(mockPayment);
        });

        it('fetches borrowerId from loan when not provided', async () => {
            const mockPayment = { id: 'p-1' };
            const mockLoan = { borrowerId: 'b-1' };
            mockCollection.create.mockImplementationOnce(async (callback: any) => {
                if (callback) callback(mockPayment);
                return mockPayment;
            });
            mockCollection.find.mockResolvedValue(mockLoan);

            const result = await createPaymentOffline({
                loanId: 'l-1',
                collectorId: 'c-1',
                amount: 500,
            });

            expect(result).toEqual(mockPayment);
        });

        it('handles failure to fetch borrowerId gracefully', async () => {
            const mockPayment = { id: 'p-1' };
            mockCollection.create.mockImplementationOnce(async (callback: any) => {
                if (callback) callback(mockPayment);
                return mockPayment;
            });
            mockCollection.find.mockRejectedValue(new Error('Loan not found'));

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const result = await createPaymentOffline({
                loanId: 'l-1',
                collectorId: 'c-1',
                amount: 500,
            });

            expect(result).toEqual(mockPayment);
            warnSpy.mockRestore();
        });

        it('uses provided borrowerId without extra fetch', async () => {
            const mockPayment = { id: 'p-1' };
            mockCollection.create.mockImplementationOnce(async (callback: any) => {
                if (callback) callback(mockPayment);
                return mockPayment;
            });

            const result = await createPaymentOffline({
                loanId: 'l-1',
                borrowerId: 'b-1',
                collectorId: 'c-1',
                amount: 500,
            });

            expect(result).toEqual(mockPayment);
        });
    });

    describe('getBorrowersByCollector', () => {
        it('returns borrowers filtered by collectorId', async () => {
            const mockBorrowers = [{ id: 'b-1' }, { id: 'b-2' }];
            mockFetch.mockResolvedValue(mockBorrowers);

            const result = await getBorrowersByCollector('c-1');
            expect(result).toEqual(mockBorrowers);
            expect(mockQuery).toHaveBeenCalled();
        });

        it('propagates errors', async () => {
            mockFetch.mockRejectedValue(new Error('Query failed'));

            await expect(
                getBorrowersByCollector('c-1')
            ).rejects.toThrow('Query failed');
        });
    });

    describe('getPendingChangesCount', () => {
        it('counts dirty records across tables', async () => {
            mockFetchCount.mockResolvedValue(3);

            const count = await getPendingChangesCount();
            // 6 tables × 3 each = 18
            expect(count).toBe(18);
        });

        it('returns 0 on total failure', async () => {
            mockQuery.mockImplementation(() => {
                throw new Error('Collection not found');
            });

            const count = await getPendingChangesCount();
            expect(count).toBe(0);
        });

        it('handles individual table errors gracefully', async () => {
            let callCount = 0;
            mockFetchCount.mockImplementation(() => {
                callCount++;
                if (callCount === 3) throw new Error('table error');
                return 2;
            });

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const count = await getPendingChangesCount();
            // 5 successful × 2 = 10
            expect(count).toBe(10);
            warnSpy.mockRestore();
        });
    });

    describe('verifyOfflineData', () => {
        it('returns valid when borrowers exist', async () => {
            mockFetch.mockResolvedValue([{ id: 'b-1' }]);

            const result = await verifyOfflineData('c-1');
            expect(result.isValid).toBe(true);
            expect(result.borrowerCount).toBe(1);
            expect(result.hasData).toBe(true);
        });

        it('returns invalid when no borrowers', async () => {
            mockFetch.mockResolvedValue([]);

            const result = await verifyOfflineData('c-1');
            expect(result.isValid).toBe(false);
            expect(result.borrowerCount).toBe(0);
        });

        it('returns error state on failure', async () => {
            mockFetch.mockRejectedValue(new Error('DB error'));

            const result = await verifyOfflineData('c-1');
            expect(result.isValid).toBe(false);
            expect(result.hasData).toBe(false);
        });
    });

    describe('assignCollectorToBorrower', () => {
        it('delegates to updateBorrowerOffline', async () => {
            const mockBorrower = {
                id: 'b-1',
                update: jest.fn().mockImplementation(async (fn) => {
                    fn(mockBorrower);
                    return mockBorrower;
                }),
            };
            mockCollection.find.mockResolvedValue(mockBorrower);

            await assignCollectorToBorrower('b-1', 'c-2');
            expect(mockCollection.find).toHaveBeenCalledWith('b-1');
            expect(mockBorrower.update).toHaveBeenCalled();
        });
    });

    describe('getRecordSyncStatus', () => {
        it('returns sync status for found records', async () => {
            const mockRecord = {
                _status: 'created',
                updated_at: 1700000000000,
            };
            mockCollection.find.mockResolvedValue(mockRecord);

            const result = await getRecordSyncStatus('borrowers', 'b-1');
            expect(result.status).toBe('created');
            expect(result.lastUpdated).toBeInstanceOf(Date);
        });

        it('returns synced status when _status is absent', async () => {
            const mockRecord = {
                updated_at: 1700000000000,
            };
            mockCollection.find.mockResolvedValue(mockRecord);

            const result = await getRecordSyncStatus('borrowers', 'b-1');
            expect(result.status).toBe('synced');
        });

        it('returns unknown on error', async () => {
            mockCollection.find.mockRejectedValue(new Error('not found'));

            const result = await getRecordSyncStatus('borrowers', 'nonexistent');
            expect(result.status).toBe('unknown');
        });
    });
});
