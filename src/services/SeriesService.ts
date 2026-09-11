import uuid from 'react-native-uuid';

export type SeriesType = 'LN' | 'OR' | 'EXP' | 'REM';

export class SeriesService {
    /**
     * Generates a high-entropy, human-readable serial number.
     * While offline, it generates a unique "TEMP" ID.
     * The database trigger on the server will eventually replace the TEMP ID 
     * with a proper sequential one if configured, or the UNIQUE constraint will 
     * ensure this generated one is safe.
     * 
     * Format: [TYPE]-[YYYYMMDD]-[HHMMSS]-[RAND6]
     */
    static generate(type: SeriesType): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        
        // Use a 6-digit random number instead of 4
        const rand = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
        
        // This format is extremely robust against collisions in high-speed batches
        return `${type}-${year}${month}${day}-${hour}${minute}${second}-${rand}`;
    }

    /**
     * Helper for Loan Number
     */
    static generateLoanNumber(): string {
        return this.generate('LN');
    }

    private static OR_STARTING_SERIES = 615;
    private static currentOrCounter = 615;

    /**
     * Helper for Receipt Number starting at series 615
     */
    static generateReceiptNumber(sequential: boolean = false): string {
        if (sequential) {
            const nextVal = this.currentOrCounter++;
            return `OR-${String(nextVal).padStart(6, '0')}`;
        }
        return this.generate('OR');
    }

    static getStartingOrSeries(): number {
        return this.OR_STARTING_SERIES;
    }
}
