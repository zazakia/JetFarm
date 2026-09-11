import { SeriesService } from '../SeriesService';

describe('SeriesService', () => {
    describe('generate', () => {
        it('generates a string with the correct format [TYPE]-[YYYYMMDD]-[HHMMSS]-[RAND6]', () => {
            const result = SeriesService.generate('LN');
            const parts = result.split('-');
            
            expect(parts.length).toBe(4);
            expect(parts[0]).toBe('LN');
            expect(parts[1]).toMatch(/^\d{8}$/); // YYYYMMDD
            expect(parts[2]).toMatch(/^\d{6}$/); // HHMMSS
            expect(parts[3]).toMatch(/^\d{6}$/); // RAND6
        });

        it('generates different IDs on consecutive calls', () => {
            const id1 = SeriesService.generate('LN');
            const id2 = SeriesService.generate('LN');
            expect(id1).not.toBe(id2);
        });
    });

    describe('generateLoanNumber', () => {
        it('uses LN prefix', () => {
            const result = SeriesService.generateLoanNumber();
            expect(result.startsWith('LN-')).toBe(true);
        });
    });

    describe('generateReceiptNumber', () => {
        it('uses OR prefix', () => {
            const result = SeriesService.generateReceiptNumber();
            expect(result.startsWith('OR-')).toBe(true);
        });

        it('generates sequential receipt number starting from 615', () => {
            expect(SeriesService.getStartingOrSeries()).toBe(615);
            const receipt = SeriesService.generateReceiptNumber(true);
            expect(receipt).toBe('OR-000615');
        });
    });
});
