import { AgriParcelService } from '../AgriParcelService';

describe('AgriParcelService', () => {
    describe('calculatePolygonAreaHectares', () => {
        it('calculates area for a rectangular GPS parcel in hectares', () => {
            // ~100m x ~100m square near equator (~1 hectare = 10,000 m2)
            // 1 degree latitude ~ 111,320m -> 0.001 deg ~ 111.32m
            // 0.001 deg lon at lat 8 deg ~ 111.32m * cos(8) ~ 110.2m
            // Area ~ 111.32 * 110.2 ~ 12,267 m2 ~ 1.2267 ha
            const coords = [
                { latitude: 8.000, longitude: 125.000 },
                { latitude: 8.001, longitude: 125.000 },
                { latitude: 8.001, longitude: 125.001 },
                { latitude: 8.000, longitude: 125.001 },
            ];

            const ha = AgriParcelService.calculatePolygonAreaHectares(coords);
            expect(ha).toBeGreaterThan(1.1);
            expect(ha).toBeLessThan(1.3);
        });

        it('returns 0 if fewer than 3 coordinates provided', () => {
            expect(AgriParcelService.calculatePolygonAreaHectares([])).toBe(0);
            expect(AgriParcelService.calculatePolygonAreaHectares([{ latitude: 8, longitude: 125 }])).toBe(0);
        });
    });
});
