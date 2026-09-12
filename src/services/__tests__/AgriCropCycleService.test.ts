import { AgriCropCycleService } from '../AgriCropCycleService';

describe('AgriCropCycleService', () => {
    describe('calculateDefaultHarvestDate', () => {
        it('projects standard 270-day (9-month) maturity for Cassava', () => {
            const planting = new Date('2026-01-01T00:00:00.000Z');
            const harvest = AgriCropCycleService.calculateDefaultHarvestDate(planting);
            const diffDays = Math.round((harvest.getTime() - planting.getTime()) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(270);
        });

        it('supports custom duration days', () => {
            const planting = new Date('2026-03-15T00:00:00.000Z');
            const harvest = AgriCropCycleService.calculateDefaultHarvestDate(planting, 300);
            const diffDays = Math.round((harvest.getTime() - planting.getTime()) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(300);
        });
    });
});
