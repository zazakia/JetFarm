import { AgriHarvestService } from '../AgriHarvestService';

describe('AgriHarvestService', () => {
    describe('calculateNetWeight', () => {
        it('accurately subtracts tare weight from gross weight', () => {
            const gross = 12500;
            const tare = 4200;
            const net = AgriHarvestService.calculateNetWeight(gross, tare);
            expect(net).toBe(8300);
        });

        it('returns 0 if tare is greater than gross', () => {
            const net = AgriHarvestService.calculateNetWeight(3000, 3500);
            expect(net).toBe(0);
        });

        it('handles decimals with two places of precision', () => {
            const net = AgriHarvestService.calculateNetWeight(1450.75, 230.25);
            expect(net).toBe(1220.5);
        });
    });
});
