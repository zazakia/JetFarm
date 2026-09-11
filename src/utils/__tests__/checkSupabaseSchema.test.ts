import { supabase } from '../../database/supabase';
import {
    checkSupabaseSchema,
    inspectSampleRecords,
    findOrphanRecords,
    testRecordCreation,
} from '../checkSupabaseSchema';

jest.mock('../../database/supabase', () => {
    const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
    };
    return {
        supabase: {
            from: jest.fn(() => mockChain),
        },
    };
});

const mockFrom = supabase.from as jest.Mock;

function mockChainResult(result: { data?: any; error?: any }) {
    const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue(result),
        delete: jest.fn().mockReturnThis(),
    };
    // The last call in a chain resolves to the result
    // For select chains that end without limit, eq returns the result
    chain.eq.mockImplementation(() => {
        // Return the chain by default, but make it thenable
        const thenableChain = { ...chain };
        (thenableChain as any).then = (resolve: any) => resolve(result);
        return thenableChain;
    });
    chain.limit.mockResolvedValue(result);
    chain.select.mockReturnValue(chain);
    return chain;
}

describe('checkSupabaseSchema', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkSupabaseSchema()', () => {
        it('queries information_schema.columns for each table', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            };
            // Make the final eq() resolve with data
            let eqCallCount = 0;
            chain.eq.mockImplementation(() => {
                eqCallCount++;
                if (eqCallCount % 2 === 0) {
                    // second eq() call per table returns data
                    return Promise.resolve({
                        data: [
                            { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
                            { column_name: 'created_at', data_type: 'timestamp', is_nullable: 'YES' },
                        ],
                        error: null,
                    });
                }
                return chain;
            });
            mockFrom.mockReturnValue(chain);

            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await checkSupabaseSchema();
            expect(mockFrom).toHaveBeenCalledWith('information_schema.columns');
            logSpy.mockRestore();
        });

        it('handles fetch errors for individual tables gracefully', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            };
            let eqCallCount = 0;
            chain.eq.mockImplementation(() => {
                eqCallCount++;
                if (eqCallCount % 2 === 0) {
                    return Promise.resolve({
                        data: null,
                        error: { message: 'permission denied' },
                    });
                }
                return chain;
            });
            mockFrom.mockReturnValue(chain);

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await checkSupabaseSchema();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('handles exceptions gracefully', async () => {
            mockFrom.mockImplementationOnce(() => {
                throw new Error('Fatal database crash');
            });
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await checkSupabaseSchema();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
            logSpy.mockRestore();
        });
    });

    describe('inspectSampleRecords()', () => {
        it('fetches one sample record per table', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [{ id: '1', full_name: 'Test' }],
                    error: null,
                }),
            };
            mockFrom.mockReturnValue(chain);

            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await inspectSampleRecords();
            expect(mockFrom).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        it('handles empty results gracefully', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            };
            mockFrom.mockReturnValue(chain);

            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await inspectSampleRecords();
            logSpy.mockRestore();
        });

        it('handles errors gracefully', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
            };
            mockFrom.mockReturnValue(chain);

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await inspectSampleRecords();
            warnSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('handles exceptions gracefully', async () => {
            mockFrom.mockImplementationOnce(() => {
                throw new Error('Fatal inspect crash');
            });
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await inspectSampleRecords();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
            logSpy.mockRestore();
        });
    });

    describe('findOrphanRecords()', () => {
        it('identifies orphan borrowers with null FKs', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                or: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [{ id: '1', collector_id: null, created_by: null }],
                    error: null,
                }),
            };
            mockFrom.mockReturnValue(chain);

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await findOrphanRecords();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('reports no orphans when data is clean', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                or: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            };
            mockFrom.mockReturnValue(chain);

            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await findOrphanRecords();
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No orphan'));
            logSpy.mockRestore();
        });

        it('handles query errors for orphan checks', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                or: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
            };
            mockFrom.mockReturnValue(chain);

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await findOrphanRecords();
            warnSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('handles exceptions gracefully', async () => {
            mockFrom.mockImplementationOnce(() => {
                throw new Error('Fatal orphan check crash');
            });
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await findOrphanRecords();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
            logSpy.mockRestore();
        });
    });

    describe('testRecordCreation()', () => {
        it('creates and cleans up a test borrower', async () => {
            let eqCallCount = 0;
            const chain = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockImplementation(() => {
                    eqCallCount++;
                    if (eqCallCount === 2) {
                        return {
                            limit: jest.fn().mockResolvedValue({
                                data: [{ id: 'collector-1', role: 'collector' }],
                                error: null,
                            }),
                        };
                    }
                    return chain;
                }),
                limit: jest.fn().mockResolvedValue({
                    data: [{ id: 'collector-1', role: 'collector' }],
                    error: null,
                }),
                insert: jest.fn().mockResolvedValue({ error: null, data: [{ id: 'test-1' }] }),
                delete: jest.fn().mockReturnThis(),
            };
            mockFrom.mockReturnValue(chain);

            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await testRecordCreation();
            logSpy.mockRestore();
        });

        it('handles no collectors found', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            };
            mockFrom.mockReturnValue(chain);

            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await testRecordCreation();
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No collectors'));
            errorSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('handles failed insert gracefully', async () => {
            const chain = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [{ id: 'collector-1', role: 'collector' }],
                    error: null,
                }),
                insert: jest.fn().mockResolvedValue({ error: { message: 'Insert failed' }, data: null }),
            };
            mockFrom.mockReturnValue(chain);

            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await testRecordCreation();
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to insert'),
                expect.any(String)
            );
            errorSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('handles exceptions gracefully', async () => {
            mockFrom.mockImplementationOnce(() => {
                throw new Error('Fatal creation crash');
            });
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            await testRecordCreation();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
            logSpy.mockRestore();
        });
    });
});
