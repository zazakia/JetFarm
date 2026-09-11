/**
 * InitializationLogger.ts
 * 
 * Centralized logging and monitoring for app initialization lifecycle.
 * Helps identify bottlenecks, timeouts, and initialization failures.
 * 
 * Usage:
 *   InitLogger.start('AuthContext');
 *   // ... do async work
 *   InitLogger.complete('AuthContext', { duration: 1234, success: true });
 */

interface InitStageLog {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success?: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

class InitializationLoggerClass {
    private stages: Map<string, InitStageLog> = new Map();
    private startTime: number = Date.now();

    /**
     * Mark the start of an initialization stage
     */
    start(stageName: string, metadata?: Record<string, any>) {
        const log: InitStageLog = {
            name: stageName,
            startTime: Date.now(),
            metadata,
        };
        this.stages.set(stageName, log);
        console.log(
            `[InitLogger] 📍 START: ${stageName}` +
            (metadata ? ` | ${JSON.stringify(metadata)}` : '')
        );
    }

    /**
     * Mark the completion of an initialization stage
     */
    complete(stageName: string, success: boolean = true, error?: string) {
        const log = this.stages.get(stageName);
        if (!log) {
            console.warn(`[InitLogger] ⚠️ No start marker for stage: ${stageName}`);
            return;
        }

        const endTime = Date.now();
        const duration = endTime - log.startTime;

        log.endTime = endTime;
        log.duration = duration;
        log.success = success;
        log.error = error;

        const icon = success ? '✅' : '❌';
        const message = `[InitLogger] ${icon} COMPLETE: ${stageName} (${duration}ms)`;
        
        if (error) {
            console.error(`${message} | Error: ${error}`);
        } else {
            console.log(message);
        }

        // Warn if stage took too long
        if (duration > 5000) {
            console.warn(`[InitLogger] ⏱️ SLOW: ${stageName} took ${duration}ms`);
        }
    }

    /**
     * Get summary of all initialization stages
     */
    getSummary() {
        const totalDuration = Date.now() - this.startTime;
        const stages = Array.from(this.stages.values());
        const completed = stages.filter(s => s.success === true).length;
        const failed = stages.filter(s => s.success === false).length;
        const pending = stages.filter(s => s.duration === undefined).length;

        return {
            totalDuration,
            totalStages: stages.length,
            completed,
            failed,
            pending,
            stages: stages.map(s => ({
                name: s.name,
                duration: s.duration,
                success: s.success,
                error: s.error,
            })),
        };
    }

    /**
     * Log summary to console
     */
    logSummary() {
        const summary = this.getSummary();
        console.log(
            `[InitLogger] 📊 SUMMARY\n` +
            `  Total Duration: ${summary.totalDuration}ms\n` +
            `  Stages: ${summary.completed}/${summary.totalStages} completed, ` +
            `${summary.pending} pending, ${summary.failed} failed\n` +
            `  Details:\n` +
            summary.stages
                .map(s => 
                    `    • ${s.name}: ${s.duration}ms ${s.success ? '✅' : '❌'}${s.error ? ` (${s.error})` : ''}`
                )
                .join('\n')
        );

        // Return structured data for debugging
        return summary;
    }

    /**
     * Reset all logs
     */
    reset() {
        this.stages.clear();
        this.startTime = Date.now();
        console.log('[InitLogger] 🔄 Logs reset');
    }

    /**
     * Measure execution time of an async function
     */
    async measureAsync<T>(
        stageName: string,
        fn: () => Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        this.start(stageName, metadata);
        try {
            const result = await fn();
            this.complete(stageName, true);
            return result;
        } catch (error: any) {
            this.complete(stageName, false, error?.message);
            throw error;
        }
    }

    /**
     * Measure execution time of a sync function
     */
    measureSync<T>(
        stageName: string,
        fn: () => T,
        metadata?: Record<string, any>
    ): T {
        this.start(stageName, metadata);
        try {
            const result = fn();
            this.complete(stageName, true);
            return result;
        } catch (error: any) {
            this.complete(stageName, false, error?.message);
            throw error;
        }
    }
}

// Singleton instance
export const InitLogger = new InitializationLoggerClass();

export default InitLogger;
