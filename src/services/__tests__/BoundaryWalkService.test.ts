import {
    isFixAccepted,
    appendVertexIfMoved,
    WalkSettings,
    GPSFix,
} from '../BoundaryWalkService';

const SETTINGS: WalkSettings = {
    maxAccuracyMeters: 10,
    minDistanceMeters: 5,
};

const fix = (lat: number, lon: number, accuracyMeters: number | null = 5): GPSFix => ({
    coordinate: { latitude: lat, longitude: lon },
    accuracyMeters,
    timestamp: 1727000000000,
});

// ~8.9m of latitude — more than minDistanceMeters, less than maxAccuracy-relevant scale
const STEP = 0.00008;

describe('BoundaryWalkService', () => {
    describe('isFixAccepted', () => {
        it('accepts fixes at or below the accuracy threshold', () => {
            expect(isFixAccepted(fix(8, 125, 10), SETTINGS)).toBe(true);
            expect(isFixAccepted(fix(8, 125, 3), SETTINGS)).toBe(true);
        });

        it('rejects fixes worse than the accuracy threshold', () => {
            expect(isFixAccepted(fix(8, 125, 25), SETTINGS)).toBe(false);
            expect(isFixAccepted(fix(8, 125, 10.01), SETTINGS)).toBe(false);
        });

        it('accepts fixes with unknown accuracy', () => {
            expect(isFixAccepted(fix(8, 125, null), SETTINGS)).toBe(true);
        });

        it('rejects fixes with invalid or NaN coordinates', () => {
            expect(isFixAccepted(fix(NaN, 125, 5), SETTINGS)).toBe(false);
            expect(isFixAccepted(fix(8, NaN, 5), SETTINGS)).toBe(false);
            expect(isFixAccepted(fix(95, 125, 5), SETTINGS)).toBe(false);
            expect(isFixAccepted(fix(8, 195, 5), SETTINGS)).toBe(false);
        });
    });

    describe('appendVertexIfMoved', () => {
        it('seeds the first vertex when the list is empty', () => {
            const out = appendVertexIfMoved([], fix(8, 125), SETTINGS);
            expect(out).toEqual([{ latitude: 8, longitude: 125 }]);
        });

        it('appends when the walker moved at least minDistanceMeters', () => {
            const prev = [{ latitude: 8, longitude: 125 }];
            const out = appendVertexIfMoved(prev, fix(8 + STEP, 125), SETTINGS);
            expect(out).toHaveLength(2);
            expect(out[1]).toEqual({ latitude: 8 + STEP, longitude: 125 });
        });

        it('skips jitter when the walker barely moved', () => {
            const prev = [{ latitude: 8, longitude: 125 }];
            const out = appendVertexIfMoved(prev, fix(8 + 0.00001, 125), SETTINGS);
            expect(out).toHaveLength(1);
            expect(out).toBe(prev); // same reference — no state churn
        });

        it('never mutates the input array', () => {
            const prev = [{ latitude: 8, longitude: 125 }];
            appendVertexIfMoved(prev, fix(8 + STEP, 125), SETTINGS);
            expect(prev).toHaveLength(1);
        });
    });
});
