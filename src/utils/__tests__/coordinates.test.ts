import {
    parseGpsCoordinates,
    serializeGpsCoordinates,
    isValidCoordinate,
    distanceMeters,
} from '../coordinates';

describe('coordinates utils', () => {
    describe('parseGpsCoordinates', () => {
        it('returns empty array for null, undefined, and empty string', () => {
            expect(parseGpsCoordinates(null)).toEqual([]);
            expect(parseGpsCoordinates(undefined)).toEqual([]);
            expect(parseGpsCoordinates('')).toEqual([]);
            expect(parseGpsCoordinates('   ')).toEqual([]);
        });

        it('parses canonical JSON array of coordinate objects', () => {
            const raw = JSON.stringify([
                { latitude: 8.3512, longitude: 124.8621 },
                { latitude: 8.3545, longitude: 124.8624 },
            ]);
            expect(parseGpsCoordinates(raw)).toEqual([
                { latitude: 8.3512, longitude: 124.8621 },
                { latitude: 8.3545, longitude: 124.8624 },
            ]);
        });

        it('parses legacy "lat, lon" seed format as a single point', () => {
            expect(parseGpsCoordinates('8.3667, 124.8667')).toEqual([
                { latitude: 8.3667, longitude: 124.8667 },
            ]);
        });

        it('parses legacy format without space after comma', () => {
            expect(parseGpsCoordinates('8.3667,124.8667')).toEqual([
                { latitude: 8.3667, longitude: 124.8667 },
            ]);
        });

        it('returns empty array for invalid JSON garbage instead of throwing', () => {
            expect(parseGpsCoordinates('not json at all')).toEqual([]);
            expect(parseGpsCoordinates('{broken')).toEqual([]);
            expect(parseGpsCoordinates('12345')).toEqual([]);
        });

        it('filters out-of-range entries from JSON arrays', () => {
            const raw = JSON.stringify([
                { latitude: 8.35, longitude: 124.86 },
                { latitude: 999, longitude: 124.86 },
                { latitude: 8.35, longitude: -400 },
            ]);
            expect(parseGpsCoordinates(raw)).toEqual([{ latitude: 8.35, longitude: 124.86 }]);
        });

        it('ignores non-object entries inside a JSON array', () => {
            const raw = JSON.stringify([{ latitude: 8.35, longitude: 124.86 }, 'x', null, 42]);
            expect(parseGpsCoordinates(raw)).toEqual([{ latitude: 8.35, longitude: 124.86 }]);
        });

        it('round-trips with serializeGpsCoordinates', () => {
            const coords = [
                { latitude: 8.3512, longitude: 124.8621 },
                { latitude: 8.3545, longitude: 124.8624 },
            ];
            expect(parseGpsCoordinates(serializeGpsCoordinates(coords))).toEqual(coords);
        });
    });

    describe('serializeGpsCoordinates', () => {
        it('returns null for empty arrays so the DB column stays NULL', () => {
            expect(serializeGpsCoordinates([])).toBeNull();
        });

        it('serializes to a JSON string', () => {
            const out = serializeGpsCoordinates([{ latitude: 8.35, longitude: 124.86 }]);
            expect(typeof out).toBe('string');
            expect(JSON.parse(out as string)).toEqual([{ latitude: 8.35, longitude: 124.86 }]);
        });
    });

    describe('isValidCoordinate', () => {
        it('accepts in-range coordinates', () => {
            expect(isValidCoordinate(8.3512, 124.8621)).toBe(true);
            expect(isValidCoordinate(-33.86, 151.2)).toBe(true);
            expect(isValidCoordinate(0, 0)).toBe(true);
            expect(isValidCoordinate(90, 180)).toBe(true);
            expect(isValidCoordinate(-90, -180)).toBe(true);
        });

        it('rejects out-of-range coordinates', () => {
            expect(isValidCoordinate(91, 0)).toBe(false);
            expect(isValidCoordinate(-91, 0)).toBe(false);
            expect(isValidCoordinate(0, 181)).toBe(false);
            expect(isValidCoordinate(0, -181)).toBe(false);
        });

        it('rejects non-finite numbers', () => {
            expect(isValidCoordinate(NaN, 0)).toBe(false);
            expect(isValidCoordinate(0, Infinity)).toBe(false);
        });
    });

    describe('distanceMeters', () => {
        it('returns 0 for identical points', () => {
            const p = { latitude: 8.3512, longitude: 124.8621 };
            expect(distanceMeters(p, p)).toBe(0);
        });

        it('is approximately 111 km per degree of latitude', () => {
            const a = { latitude: 8.0, longitude: 125.0 };
            const b = { latitude: 9.0, longitude: 125.0 };
            const d = distanceMeters(a, b);
            expect(d).toBeGreaterThan(110_000);
            expect(d).toBeLessThan(112_500);
        });

        it('is symmetric', () => {
            const a = { latitude: 8.0, longitude: 125.0 };
            const b = { latitude: 8.004, longitude: 125.007 };
            expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
        });
    });
});
