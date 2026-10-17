import { GPSCoordinate, distanceMeters, parseCoordinateNumber } from '../coordinates';
import {
    ParcelGeometry, validateParcelGeometry, measureParcelGeometry,
    splitParcelByLine, validateBlockLayout, subtractBlocks, snapCoordinateToGeometry,
} from '../parcelGeometry';

// DUMMY: synthetic metre-based fixtures, not registered land or survey data.
const R = 6378137;
const degrees = 180 / (Math.PI * R);
const point = (x: number, y: number, lat = 0, lon = 0): GPSCoordinate => ({
    latitude: lat + y * degrees,
    longitude: lon + x * degrees / Math.cos(lat * Math.PI / 180),
});
const polygon = (xy: number[][], lat = 0, lon = 0): ParcelGeometry => ({
    outer: xy.map(([x, y]) => point(x, y, lat, lon)), holes: [],
});
const rectangle = (x = 0, y = 0, w = 100, h = 100): ParcelGeometry =>
    polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const parent = rectangle();
const holed = (): ParcelGeometry => ({ ...rectangle(), holes: [rectangle(30, 30, 40, 40).outer] });
const concave = (): ParcelGeometry => polygon([[0, 0], [100, 0], [100, 100], [70, 100], [70, 30], [30, 30], [30, 100], [0, 100]]);
const expectValid = (g: ParcelGeometry) => expect(validateParcelGeometry(g)).toEqual([]);
// Independent strict point-in-ring assertion: no geometry area tolerance can mask an outside label.
const insideRing = (p: GPSCoordinate, ring: GPSCoordinate[]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        const cross = (p.longitude - a.longitude) * (b.latitude - a.latitude) - (p.latitude - a.latitude) * (b.longitude - a.longitude);
        if (Math.abs(cross) < 1e-18 && p.longitude >= Math.min(a.longitude, b.longitude) && p.longitude <= Math.max(a.longitude, b.longitude) && p.latitude >= Math.min(a.latitude, b.latitude) && p.latitude <= Math.max(a.latitude, b.latitude)) return false;
        if ((a.latitude > p.latitude) !== (b.latitude > p.latitude) && p.longitude < (b.longitude - a.longitude) * (p.latitude - a.latitude) / (b.latitude - a.latitude) + a.longitude) inside = !inside;
    }
    return inside;
};
const usableLabel = (g: ParcelGeometry, p: GPSCoordinate) => insideRing(p, g.outer) && g.holes.every(hole => !insideRing(p, hole));
const expectInteriorLabel = (g: ParcelGeometry) => expect(usableLabel(g, measureParcelGeometry(g).labelCoordinate)).toBe(true);

describe('parcel geometry validation and measurements', () => {
    it('measures a known rectangle without internally rounding hectares', () => {
        const result = measureParcelGeometry(parent);
        expect(result.areaSquareMeters).toBeCloseTo(10000, 4);
        expect(result.areaHectares).toBe(result.areaSquareMeters / 10000);
        expect(result.areaHectares).not.toBe(1);
        expect(result.outerPerimeterMeters).toBeCloseTo(400, 5);
        expect(result.totalBoundaryMeters).toBe(result.outerPerimeterMeters);
        expect(result.edgeLengthsMeters).toEqual(parent.outer.map((p, i) => distanceMeters(p, parent.outer[(i + 1) % 4])));
        expectValid(parent);
    });

    it('measures triangles and concave shapes', () => {
        expect(measureParcelGeometry(polygon([[0, 0], [100, 0], [0, 100]])).areaSquareMeters).toBeCloseTo(5000, 4);
        expect(measureParcelGeometry(concave()).areaSquareMeters).toBeCloseTo(7200, 4);
        expectInteriorLabel(concave());
    });

    it('accepts reverse winding and a single closing duplicate without extra edges', () => {
        const reversed = { outer: [...parent.outer].reverse(), holes: [] };
        const closed = { outer: [...parent.outer, parent.outer[0]], holes: [] };
        expectValid(reversed);
        expectValid(closed);
        expect(measureParcelGeometry(reversed).areaSquareMeters).toBe(measureParcelGeometry(parent).areaSquareMeters);
        expect(measureParcelGeometry(closed)).toEqual(measureParcelGeometry(parent));
    });

    it('subtracts holes, distinguishes perimeters and selects a usable label', () => {
        const g = holed();
        expectValid(g);
        const m = measureParcelGeometry(g);
        expect(m.areaSquareMeters).toBeCloseTo(8400, 4);
        expect(m.totalBoundaryMeters).toBeCloseTo(560, 5);
        expect(m.outerPerimeterMeters).toBeCloseTo(400, 5);
        expect(m.edgeLengthsMeters).toHaveLength(4);
        expectInteriorLabel(g);
        const reversed = { outer: [...g.outer].reverse(), holes: g.holes.map(h => [...h].reverse()) };
        expect(measureParcelGeometry(reversed).areaSquareMeters).toBeCloseTo(m.areaSquareMeters, 8);
    });

    it.each([[8, 125], [50, 170], [-35, -150]])('avoids large-coordinate cancellation at %s,%s', (lat, lon) => {
        const g = polygon([[0, 0], [1.2345, 0], [1.2345, 2.3456], [0, 2.3456]], lat, lon);
        const expected = 1.2345 * 2.3456 * Math.cos((lat + 2.3456 * degrees / 2) * Math.PI / 180) / Math.cos(lat * Math.PI / 180);
        expect(measureParcelGeometry(g).areaSquareMeters).toBeCloseTo(expected, 7);
    });

    it.each([
        ['empty', { outer: [], holes: [] }],
        ['short', { outer: parent.outer.slice(0, 2), holes: [] }],
        ['bow-tie', { outer: [parent.outer[0], parent.outer[2], parent.outer[1], parent.outer[3]], holes: [] }],
        ['self-touch', polygon([[0, 0], [100, 0], [50, 50], [100, 100], [0, 100], [50, 50]])],
        ['backtracking', polygon([[0, 0], [100, 0], [50, 0], [100, 100], [0, 100]])],
        ['zero area', polygon([[0, 0], [50, 0], [100, 0]])],
        ['duplicate vertex', polygon([[0, 0], [100, 0], [100, 0], [0, 100]])],
        ['outside hole', { ...parent, holes: [rectangle(110, 10, 10, 10).outer] }],
        ['touching hole', { ...parent, holes: [rectangle(0, 10, 10, 10).outer] }],
        ['crossing hole', { ...parent, holes: [rectangle(90, 10, 20, 20).outer] }],
        ['short hole', { ...parent, holes: [parent.outer.slice(0, 2)] }],
        ['intersecting holes', { ...parent, holes: [rectangle(10, 10, 30, 30).outer, rectangle(20, 20, 30, 30).outer] }],
        ['nested holes', { ...parent, holes: [rectangle(10, 10, 60, 60).outer, rectangle(20, 20, 10, 10).outer] }],
        ['touching holes', { ...parent, holes: [rectangle(10, 10, 20, 20).outer, rectangle(30, 10, 20, 20).outer] }],
    ] as [string, ParcelGeometry][])('rejects %s before measuring or clipping', (_name, g) => {
        expect(validateParcelGeometry(g)).not.toEqual([]);
        expect(() => measureParcelGeometry(g)).toThrow();
        expect(() => splitParcelByLine(g, [point(50, -10), point(50, 110)])).toThrow();
    });

    it.each([NaN, Infinity, 91, '8junk', null])('rejects corrupt coordinate latitude %s', latitude => {
        const g = { ...parent, outer: [{ latitude, longitude: 0 } as GPSCoordinate, ...parent.outer.slice(1)] };
        expect(validateParcelGeometry(g)).not.toEqual([]);
    });

    it.each([null, {}, { outer: null, holes: [] }, { outer: parent.outer, holes: null }, { outer: [null, ...parent.outer], holes: [] }])('reports malformed runtime input without crashing', g => {
        expect(validateParcelGeometry(g as ParcelGeometry)).not.toEqual([]);
    });

    it('rejects farm-scale, polar and antimeridian cases clearly', () => {
        // The radius is order-independent around the extent centre (not an arbitrary first vertex).
        expect(validateParcelGeometry(rectangle(0, 0, 22000, 100)).join(' ')).toMatch(/10.km/i);
        expect(validateParcelGeometry(polygon([[0, 0], [100, 0], [100, 100]], 85, 0)).join(' ')).toMatch(/polar/i);
        expect(validateParcelGeometry({ outer: [{ latitude: 0, longitude: 179.999 }, { latitude: 0.001, longitude: -179.999 }, { latitude: 0, longitude: -179.999 }], holes: [] }).join(' ')).toMatch(/antimeridian/i);
    });
});

describe('shape-stable additive parcel area', () => {
    // DUMMY: a 1-km lon/lat-linear square at latitude 50, not a surveyed parcel.
    const at = (x: number, y: number) => point(x, y, 50, 170);
    const square = polygon([[0, 0], [1000, 0], [1000, 1000], [0, 1000]], 50, 170);
    // Match the documented geometry tolerance, applied to independently measured, unrounded areas.
    const tolerance = (area: number) => Math.max(0.05, area * 1e-8);
    const resample = (g: ParcelGeometry): ParcelGeometry => {
        const densify = (ring: GPSCoordinate[]) => [
            ...ring.slice(0, -1),
            ...[0, 0.0625, 0.125, 0.25, 0.5, 0.75].map(t => ({
                latitude: ring[ring.length - 1].latitude + t * (ring[0].latitude - ring[ring.length - 1].latitude),
                longitude: ring[ring.length - 1].longitude + t * (ring[0].longitude - ring[ring.length - 1].longitude),
            })),
        ];
        return { outer: densify(g.outer), holes: g.holes.map(densify) };
    };
    const reverse = (g: ParcelGeometry): ParcelGeometry => ({ outer: [...g.outer].reverse(), holes: g.holes.map(h => [...h].reverse()) });
    const withHole = { ...square, holes: [polygon([[300, 200], [700, 200], [700, 650], [300, 650]], 50, 170).outer] };
    const concaveWithHole = {
        outer: polygon([[0, 0], [1000, 0], [1000, 1000], [700, 1000], [700, 300], [300, 300], [300, 1000], [0, 1000]], 50, 170).outer,
        holes: [polygon([[50, 100], [200, 100], [200, 250], [50, 250]], 50, 170).outer],
    };

    it('matches the spherical strip area of a 1-km square rather than a local planar approximation', () => {
        const south = square.outer[0].latitude * Math.PI / 180;
        const north = square.outer[2].latitude * Math.PI / 180;
        const width = (square.outer[1].longitude - square.outer[0].longitude) * Math.PI / 180;
        const expected = R * R * width * 2 * Math.cos((north + south) / 2) * Math.sin((north - south) / 2);
        expect(Math.abs(measureParcelGeometry(square).areaSquareMeters - expected)).toBeLessThan(1e-5);
    });

    it.each([['square', square], ['holes', withHole], ['concavity and a hole', concaveWithHole]] as [string, ParcelGeometry][])(
        'keeps %s area invariant under asymmetric collinear resampling, reversal and ring rotation', (_name, g) => {
            const area = measureParcelGeometry(g).areaSquareMeters;
            const sampled = resample(g);
            const rotated = { outer: [...sampled.outer.slice(2), ...sampled.outer.slice(0, 2)], holes: sampled.holes };
            for (const variant of [sampled, reverse(g), reverse(sampled), rotated]) {
                expectValid(variant);
                expect(Math.abs(measureParcelGeometry(variant).areaSquareMeters - area)).toBeLessThan(tolerance(area));
            }
        },
    );

    it.each([
        ['unequal horizontal square pieces', square, [at(-100, 250), at(1100, 250)]],
        ['diagonal square pieces', square, [at(-100, 150), at(1100, 850)]],
        ['crossed hole', withHole, [at(-100, 450), at(1100, 450)]],
        ['uncrossed hole', withHole, [at(-100, 750), at(1100, 750)]],
        ['disconnected concavity with retained hole', concaveWithHole, [at(-100, 500), at(1100, 500)]],
    ] as [string, ParcelGeometry, [GPSCoordinate, GPSCoordinate]][])(
        'conserves independently displayed areas for %s', (_name, g, cut) => {
            const area = measureParcelGeometry(g).areaSquareMeters;
            for (const source of [g, reverse(resample(g))]) {
                const pieces = splitParcelByLine(source, cut);
                expect(validateBlockLayout(source, pieces)).toEqual([]);
                const measured = pieces.reduce((sum, piece) => sum + measureParcelGeometry(piece).areaHectares * 10000, 0);
                expect(Math.abs(measured - area)).toBeLessThan(tolerance(area));
                const remainder = subtractBlocks(source, [pieces[0]]);
                const assignedAndRemainder = [pieces[0], ...remainder].reduce((sum, piece) => sum + measureParcelGeometry(piece).areaSquareMeters, 0);
                expect(Math.abs(assignedAndRemainder - area)).toBeLessThan(tolerance(area));
            }
        },
    );

    it('keeps a sloped lon/lat edge integral unchanged when subdivided', () => {
        const triangle = polygon([[0, 0], [1000, 0], [0, 1000]], 50, 170);
        const midpoint = at(500, 500);
        const sampled = { outer: [triangle.outer[0], triangle.outer[1], midpoint, triangle.outer[2]], holes: [] };
        expectValid(sampled);
        const area = measureParcelGeometry(triangle).areaSquareMeters;
        expect(Math.abs(measureParcelGeometry(sampled).areaSquareMeters - area)).toBeLessThan(tolerance(area));
    });
});

describe('strict manual coordinate numbers', () => {
    it.each(['8junk', '1e2', '0x10', '', ' ', '8,3', 'Infinity', '--8', '8 3'])('rejects the entire invalid string %j', raw => {
        expect(parseCoordinateNumber(raw)).toBeNull();
    });
    it.each([['  +8.35 ', 8.35], ['-.125', -0.125], ['125', 125], ['8.', 8]])('accepts decimal %j', (raw, value) => {
        expect(parseCoordinateNumber(raw)).toBe(value);
    });
});

describe('parcel cutting, layouts and snapping', () => {
    it('keeps supported near-radius cuts and remainders valid regardless of ring start', () => {
        const wide = polygon([[0, 0], [-9000, 100], [9000, 100]]);
        expectValid(wide);
        expectValid({ outer: [wide.outer[1], wide.outer[2], wide.outer[0]], holes: [] });
        const pieces = splitParcelByLine(wide, [point(-5000, 50), point(5000, 50)]);
        expect(pieces).toHaveLength(2);
        pieces.forEach(expectValid);
        expect(subtractBlocks(wide, pieces)).toEqual([]);
        expect(subtractBlocks(wide, [pieces[0]])).toHaveLength(1);
    });

    it('strict label assertions reject points outside, on edges or in excluded pockets', () => {
        expect(usableLabel(parent, point(110, 50))).toBe(false);
        expect(usableLabel(parent, point(0, 50))).toBe(false);
        expect(usableLabel(holed(), point(50, 50))).toBe(false);
        expect(usableLabel(concave(), point(50, 60))).toBe(false);
        expect(usableLabel(holed(), point(15, 50))).toBe(true);
    });

    it('splits a rectangle and accepts shared edges without overlap', () => {
        const pieces = splitParcelByLine(parent, [point(50, -10), point(50, 110)]);
        expect(pieces).toHaveLength(2);
        pieces.forEach(expectValid);
        expect(validateBlockLayout(parent, pieces)).toEqual([]);
        expect(subtractBlocks(parent, pieces)).toEqual([]);
        expect(pieces.reduce((sum, g) => sum + measureParcelGeometry(g).areaSquareMeters, 0)).toBeCloseTo(10000, 4);
    });

    it('returns all disconnected pieces of a concave cut', () => {
        const g = concave();
        const pieces = splitParcelByLine(g, [point(-10, 50), point(110, 50)]);
        expect(pieces).toHaveLength(3);
        expect(validateBlockLayout(g, pieces)).toEqual([]);
        expect(subtractBlocks(g, pieces)).toEqual([]);
        pieces.forEach(expectValid);
    });

    it('cuts across a hole and preserves holes not crossed', () => {
        const g = holed();
        const crossed = splitParcelByLine(g, [point(50, -10), point(50, 110)]);
        expect(crossed).toHaveLength(2);
        expect(crossed.every(piece => piece.holes.length === 0)).toBe(true);
        expect(validateBlockLayout(g, crossed)).toEqual([]);
        const beside = splitParcelByLine(g, [point(20, -10), point(20, 110)]);
        expect(beside.flatMap(piece => piece.holes)).toHaveLength(1);
        expect(validateBlockLayout(g, beside)).toEqual([]);
    });

    it('cuts through vertices and is independent of line direction', () => {
        const cut: [GPSCoordinate, GPSCoordinate] = [parent.outer[0], parent.outer[2]];
        expect(splitParcelByLine(parent, cut)).toHaveLength(2);
        expect(validateBlockLayout(parent, splitParcelByLine(parent, [cut[1], cut[0]]))).toEqual([]);
    });

    it.each([
        [point(-10, 0), point(110, 0)],
        [point(-10, 120), point(110, 120)],
        [point(-10, 10), point(10, -10)],
        [point(50, 50), point(50, 50)],
        [point(50, 40), point(50, 60)],
        [{ latitude: NaN, longitude: 0 }, point(50, 110)],
    ] as [GPSCoordinate, GPSCoordinate][])('rejects tangent, no-op, unspanned or invalid cuts %#', (a, b) => {
        expect(() => splitParcelByLine(parent, [a, b])).toThrow();
    });

    it('reports tiny fragments rather than deleting them', () => {
        expect(() => splitParcelByLine(parent, [point(0.0001, 0), point(0.0001, 100)])).toThrow(/fragment/i);
        expect(validateBlockLayout(parent, [rectangle(10, 10, 0.1, 0.1)]).join(' ')).toMatch(/fragment/i);
    });

    it('rejects overlaps, outside blocks and excluded land but allows gaps', () => {
        expect(validateBlockLayout(parent, [rectangle(0, 0, 60, 100), rectangle(50, 0, 50, 100)]).join(' ')).toMatch(/overlap/i);
        expect(validateBlockLayout(parent, [rectangle(90, 10, 20, 20)]).join(' ')).toMatch(/outside/i);
        expect(validateBlockLayout(holed(), [rectangle(40, 40, 10, 10)]).join(' ')).toMatch(/outside/i);
        expect(validateBlockLayout(parent, [rectangle(0, 0, 20, 100)])).toEqual([]);
        expect(validateBlockLayout(parent, [])).toEqual([]);
        expect(validateBlockLayout(parent, [polygon([[0, 0], [100, 100], [100, 0], [0, 100]])])).not.toEqual([]);
        expect(() => subtractBlocks(parent, [rectangle(90, 10, 20, 20)])).toThrow();
    });

    it('uses max(0.05m²,parentArea*1e-8) for overlap and outside tolerance', () => {
        expect(validateBlockLayout(parent, [rectangle(0, 0, 50, 100), rectangle(49.9999, 0, 50.0001, 100)])).toEqual([]);
        expect(validateBlockLayout(parent, [rectangle(0, 0, 50, 100), rectangle(49.999, 0, 50.001, 100)]).join(' ')).toMatch(/overlap/i);
        expect(validateBlockLayout(parent, [rectangle(0, 0, 100.0001, 100)])).toEqual([]);
        expect(validateBlockLayout(parent, [rectangle(0, 0, 100.001, 100)]).join(' ')).toMatch(/outside/i);
    });

    it('rejects accumulated overlaps even when each pair is below tolerance', () => {
        const blocks = [rectangle(0, 0, 30, 100), rectangle(29.9997, 0, 30.0003, 100), rectangle(59.9997, 0, 40.0003, 100)];
        expect(validateBlockLayout(parent, blocks).join(' ')).toMatch(/overlap/i);
        expect(() => subtractBlocks(parent, blocks)).toThrow(/overlap/i);
    });

    it('scales tolerance with the area for larger farm-scale parents', () => {
        const large = rectangle(0, 0, 3000, 3000);
        expect(validateBlockLayout(large, [rectangle(0, 0, 1500, 3000), rectangle(1499.99998, 0, 1500.00002, 3000)])).toEqual([]);
        expect(validateBlockLayout(large, [rectangle(0, 0, 1500, 3000), rectangle(1499.99996, 0, 1500.00004, 3000)]).join(' ')).toMatch(/overlap/i);
    });

    it('retains unassigned disconnected remainder and holes', () => {
        const remainder = subtractBlocks(parent, [rectangle(40, 0, 20, 100)]);
        expect(remainder).toHaveLength(2);
        remainder.forEach(expectValid);
        const pocket = subtractBlocks(parent, [rectangle(30, 30, 40, 40)]);
        expect(pocket).toHaveLength(1);
        expect(pocket[0].holes).toHaveLength(1);
        expect(measureParcelGeometry(pocket[0]).areaSquareMeters).toBeCloseTo(8400, 4);
        expect(subtractBlocks(holed(), [])).toEqual([holed()]);
        expect(() => subtractBlocks(parent, [rectangle(0, 0, 99.9999, 100)])).toThrow(/fragment/i);
    });

    it('uses one parent projection for translated conservation including holes', () => {
        const translate = (p: GPSCoordinate): GPSCoordinate => ({ latitude: p.latitude + 50, longitude: p.longitude + 170 });
        const g = { outer: holed().outer.map(translate), holes: holed().holes.map(h => h.map(translate)) };
        const pieces = splitParcelByLine(g, [translate(point(-10, 50)), translate(point(110, 50))]);
        expect(validateBlockLayout(g, pieces)).toEqual([]);
        expect(subtractBlocks(g, pieces)).toEqual([]);
    });

    it('snaps to exact existing vertices or nearest edges, including holes, within a capped 2m', () => {
        expect(snapCoordinateToGeometry(point(-0.1, -0.1), parent)).toBe(parent.outer[0]);
        const edge = snapCoordinateToGeometry(point(50, -1), parent);
        expect(edge.latitude).toBe(parent.outer[0].latitude);
        expect(edge.longitude).toBeCloseTo(point(50, 0).longitude, 12);
        const distant = point(50, -3);
        expect(snapCoordinateToGeometry(distant, parent, 20)).toBe(distant);
        const restricted = point(50, -1);
        expect(snapCoordinateToGeometry(restricted, parent, 0.5)).toBe(restricted);
        expect(snapCoordinateToGeometry(point(50, 29), holed()).latitude).toBeCloseTo(point(50, 30).latitude, 12);
        expect(() => snapCoordinateToGeometry(point(0, 0), parent, -1)).toThrow();
    });
});
