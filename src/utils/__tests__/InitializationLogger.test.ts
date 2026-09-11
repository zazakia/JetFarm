import { InitLogger } from '../InitializationLogger';

describe('InitializationLogger', () => {
    beforeEach(() => {
        InitLogger.reset();
        jest.clearAllMocks();
    });

    describe('start / complete lifecycle', () => {
        it('logs a stage start and completion', () => {
            InitLogger.start('TestStage');
            InitLogger.complete('TestStage', true);

            const summary = InitLogger.getSummary();
            expect(summary.totalStages).toBe(1);
            expect(summary.completed).toBe(1);
            expect(summary.failed).toBe(0);
            expect(summary.stages[0].name).toBe('TestStage');
            expect(summary.stages[0].success).toBe(true);
            expect(typeof summary.stages[0].duration).toBe('number');
        });

        it('records a failed stage with error message', () => {
            InitLogger.start('FailStage');
            InitLogger.complete('FailStage', false, 'Something went wrong');

            const summary = InitLogger.getSummary();
            expect(summary.failed).toBe(1);
            expect(summary.stages[0].success).toBe(false);
            expect(summary.stages[0].error).toBe('Something went wrong');
        });

        it('handles complete without start gracefully', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            InitLogger.complete('NonExistent');
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('No start marker for stage: NonExistent')
            );
            warnSpy.mockRestore();
        });

        it('records metadata passed to start', () => {
            InitLogger.start('MetaStage', { key: 'value' });
            const summary = InitLogger.getSummary();
            expect(summary.totalStages).toBe(1);
        });
    });

    describe('getSummary', () => {
        it('tracks pending stages (started but not completed)', () => {
            InitLogger.start('PendingStage');

            const summary = InitLogger.getSummary();
            expect(summary.pending).toBe(1);
            expect(summary.completed).toBe(0);
        });

        it('tracks multiple mixed stages', () => {
            InitLogger.start('A');
            InitLogger.complete('A', true);
            InitLogger.start('B');
            InitLogger.complete('B', false, 'err');
            InitLogger.start('C'); // pending

            const summary = InitLogger.getSummary();
            expect(summary.totalStages).toBe(3);
            expect(summary.completed).toBe(1);
            expect(summary.failed).toBe(1);
            expect(summary.pending).toBe(1);
        });

        it('includes totalDuration since logger start', () => {
            const summary = InitLogger.getSummary();
            expect(typeof summary.totalDuration).toBe('number');
            expect(summary.totalDuration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('logSummary', () => {
        it('prints summary to console and returns structured data', () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            InitLogger.start('LogTest');
            InitLogger.complete('LogTest', true);

            const result = InitLogger.logSummary();
            expect(result.totalStages).toBe(1);
            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        it('prints error details for failed stages', () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            InitLogger.start('ErrStage');
            InitLogger.complete('ErrStage', false, 'kaboom');

            const result = InitLogger.logSummary();
            expect(result.stages[0].error).toBe('kaboom');
            logSpy.mockRestore();
        });
    });

    describe('reset', () => {
        it('clears all stages', () => {
            InitLogger.start('A');
            InitLogger.complete('A', true);
            expect(InitLogger.getSummary().totalStages).toBe(1);

            InitLogger.reset();
            expect(InitLogger.getSummary().totalStages).toBe(0);
        });
    });

    describe('measureAsync', () => {
        it('records success for resolved promise', async () => {
            const result = await InitLogger.measureAsync('AsyncOK', async () => 42);
            expect(result).toBe(42);
            const summary = InitLogger.getSummary();
            expect(summary.completed).toBe(1);
            expect(summary.stages[0].success).toBe(true);
        });

        it('records failure and rethrows for rejected promise', async () => {
            await expect(
                InitLogger.measureAsync('AsyncFail', async () => {
                    throw new Error('async boom');
                })
            ).rejects.toThrow('async boom');

            const summary = InitLogger.getSummary();
            expect(summary.failed).toBe(1);
            expect(summary.stages[0].error).toBe('async boom');
        });

        it('passes metadata to the underlying start call', async () => {
            await InitLogger.measureAsync('WithMeta', async () => 'ok', { env: 'test' });
            expect(InitLogger.getSummary().totalStages).toBe(1);
        });
    });

    describe('measureSync', () => {
        it('records success for synchronous function', () => {
            const result = InitLogger.measureSync('SyncOK', () => 'hello');
            expect(result).toBe('hello');
            const summary = InitLogger.getSummary();
            expect(summary.completed).toBe(1);
            expect(summary.stages[0].success).toBe(true);
        });

        it('records failure and rethrows for sync function that throws', () => {
            expect(() =>
                InitLogger.measureSync('SyncFail', () => {
                    throw new Error('sync boom');
                })
            ).toThrow('sync boom');

            const summary = InitLogger.getSummary();
            expect(summary.failed).toBe(1);
            expect(summary.stages[0].error).toBe('sync boom');
        });

        it('passes metadata to start call', () => {
            InitLogger.measureSync('SyncMeta', () => 1, { cpu: 'fast' });
            expect(InitLogger.getSummary().totalStages).toBe(1);
        });
    });

    describe('slow stage warning', () => {
        it('warns when a stage exceeds 5000ms', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const nowSpy = jest.spyOn(Date, 'now');
            nowSpy
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(7001);

            InitLogger.start('SlowStage');
            InitLogger.complete('SlowStage', true);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('SLOW')
            );

            warnSpy.mockRestore();
            nowSpy.mockRestore();
        });
    });
});
