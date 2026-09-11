/**
 * PerformanceTracker - A utility for measuring and logging application performance metrics.
 * Supports marking time points and calculating durations for key operations.
 */

type PerformanceMetric = {
    name: string;
    duration: number; // in milliseconds
    timestamp: number;
    metadata?: Record<string, any>;
};

export class PerformanceTracker {
    private static instance: PerformanceTracker;
    private marks: Map<string, number> = new Map();
    private metrics: PerformanceMetric[] = [];

    private constructor() {}

    public static getInstance(): PerformanceTracker {
        if (!PerformanceTracker.instance) {
            PerformanceTracker.instance = new PerformanceTracker();
        }
        return PerformanceTracker.instance;
    }

    /**
     * Starts a timer for a given operation.
     */
    public start(name: string) {
        this.marks.set(name, Date.now());
    }

    /**
     * Ends a timer for a given operation and records the duration.
     * @returns The duration in milliseconds.
     */
    public stop(name: string, metadata?: Record<string, any>): number {
        const startTime = this.marks.get(name);
        if (!startTime) {
            console.warn(`[PerformanceTracker] No start mark found for: ${name}`);
            return -1;
        }

        const duration = Date.now() - startTime;
        this.marks.delete(name);

        const metric: PerformanceMetric = {
            name,
            duration,
            timestamp: Date.now(),
            metadata,
        };

        this.metrics.push(metric);
        
        const metaStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';
        console.log(`[PERF] ${name}: ${duration}ms${metaStr}`);

        return duration;
    }

    /**
     * Executes an async function and measures its duration.
     */
    public async measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
        this.start(name);
        try {
            const result = await fn();
            this.stop(name, { ...metadata, success: true });
            return result;
        } catch (error) {
            this.stop(name, { ...metadata, success: false, error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Returns all recorded metrics.
     */
    public getMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    /**
     * Clears all recorded metrics.
     */
    public clear() {
        this.metrics = [];
        this.marks.clear();
    }

    /**
     * Summarizes metrics by name.
     */
    public getSummary() {
        const summary: Record<string, { count: number; avg: number; min: number; max: number }> = {};

        this.metrics.forEach(m => {
            if (!summary[m.name]) {
                summary[m.name] = { count: 0, avg: 0, min: m.duration, max: m.duration };
            }
            const s = summary[m.name];
            s.count++;
            s.avg = (s.avg * (s.count - 1) + m.duration) / s.count;
            s.min = Math.min(s.min, m.duration);
            s.max = Math.max(s.max, m.duration);
        });

        return summary;
    }
}

export const perf = PerformanceTracker.getInstance();
export default perf;
