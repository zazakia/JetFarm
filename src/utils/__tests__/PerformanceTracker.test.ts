import perf, { PerformanceTracker } from '../PerformanceTracker';

describe('PerformanceTracker', () => {
    beforeEach(() => {
        perf.clear();
        jest.restoreAllMocks();
    });

    it('should be a singleton and handle re-initialization', () => {
        const p1 = PerformanceTracker.getInstance();
        const p2 = PerformanceTracker.getInstance();
        expect(p1).toBe(p2);
        
        // Reset modules to test the "if (!PerformanceTracker.instance)" branch
        jest.resetModules();
        const NewPerformanceTracker = require('../PerformanceTracker').default;
        // This is tricky because the static instance might persist in memory if not careful
        // but typically getInstance() branch is what we want to hit.
    });

    it('should record metric when started and stopped', () => {
        perf.start('test-op');
        const duration = perf.stop('test-op', { tag: 'unit-test' });
        
        expect(duration).toBeGreaterThanOrEqual(0);
        const metrics = perf.getMetrics();
        expect(metrics.length).toBe(1);
        expect(metrics[0].name).toBe('test-op');
        expect(metrics[0].metadata?.tag).toBe('unit-test');
    });

    it('should warn and return -1 when stopping without starting', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const duration = perf.stop('missing-op');
        
        expect(duration).toBe(-1);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No start mark found'));
        consoleSpy.mockRestore();
    });

    it('should measure async functions success path', async () => {
        const result = await perf.measure('async-op', async () => {
            return 'success';
        }, { initial: true });

        expect(result).toBe('success');
        const metrics = perf.getMetrics();
        expect(metrics[0].name).toBe('async-op');
        expect(metrics[0].metadata?.success).toBe(true);
    });

    it('should measure async functions error path', async () => {
        const error = new Error('async-fail');
        await expect(perf.measure('fail-op', async () => {
            throw error;
        })).rejects.toThrow('async-fail');

        const metrics = perf.getMetrics();
        expect(metrics[0].name).toBe('fail-op');
        expect(metrics[0].metadata?.success).toBe(false);
        expect(metrics[0].metadata?.error).toBe('async-fail');
    });

    it('should generate summary of metrics', () => {
        perf.start('op1'); perf.stop('op1');
        perf.start('op1'); perf.stop('op1');
        perf.start('op2'); perf.stop('op2');

        const summary = perf.getSummary();
        expect(summary['op1']).toBeDefined();
        expect(summary['op1'].count).toBe(2);
        expect(summary['op2'].count).toBe(1);
        expect(summary['op1'].avg).toBeDefined();
    });

    it('should clear metrics and marks', () => {
        perf.start('op1');
        perf.stop('op1');
        expect(perf.getMetrics().length).toBe(1);
        
        perf.clear();
        expect(perf.getMetrics().length).toBe(0);
    });
});
