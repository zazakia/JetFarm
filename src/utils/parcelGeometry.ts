import { intersection, difference, union, Pair, Polygon, MultiPolygon } from 'polygon-clipping';
import { GPSCoordinate, isValidCoordinate, distanceMeters } from './coordinates';

// 2.0.4 supplies a Jest/Metro-compatible CommonJS entry but omits its advertised .d.ts.
// Keep the narrow signature here rather than changing global transforms or adding a dependency.
const { orient2d }: { orient2d: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => number } = require('robust-predicates');

export interface ParcelGeometry {
    outer: GPSCoordinate[];
    holes: GPSCoordinate[][];
}

export interface ParcelMeasurements {
    areaSquareMeters: number;
    areaHectares: number;
    outerPerimeterMeters: number;
    totalBoundaryMeters: number;
    /** Outer edges only, including the implicit closing edge. */
    edgeLengthsMeters: number[];
    labelCoordinate: GPSCoordinate;
}

const R = 6378137;
const RAD = Math.PI / 180;
const MAX_RADIUS_METERS = 10000;
const POLAR_LATITUDE = 80;

/** The sole area tolerance for coverage, overlaps, outside land and tiny fragments. */
function areaTolerance(parentArea: number): number {
    return Math.max(0.05, parentArea * 1e-8);
}

function validPoint(p: GPSCoordinate): boolean {
    return !!p && isValidCoordinate(p.latitude, p.longitude);
}

function sameCoordinate(a: GPSCoordinate, b: GPSCoordinate): boolean {
    return a.latitude === b.latitude && a.longitude === b.longitude;
}

/** Accept GeoJSON's optional closing duplicate, without mutating the caller's ring. */
function openRing(ring: GPSCoordinate[]): GPSCoordinate[] {
    return ring.length > 1 && sameCoordinate(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
}

function xy(p: GPSCoordinate): Pair {
    return [p.longitude, p.latitude];
}

function extentCentreOf(g: ParcelGeometry): GPSCoordinate {
    const points = [g.outer, ...g.holes].flat();
    const latitudes = points.map(p => p.latitude), longitudes = points.map(p => p.longitude);
    return { latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2, longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2 };
}

function orientation(a: Pair, b: Pair, c: Pair): number {
    // robust-predicates uses the opposite sign to the conventional cross product.
    return -orient2d(a[0], a[1], b[0], b[1], c[0], c[1]);
}

function onSegment(p: Pair, a: Pair, b: Pair): boolean {
    return orientation(a, b, p) === 0 &&
        p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) &&
        p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}

function segmentsIntersect(a: Pair, b: Pair, c: Pair, d: Pair): boolean {
    const abC = orientation(a, b, c), abD = orientation(a, b, d);
    const cdA = orientation(c, d, a), cdB = orientation(c, d, b);
    return (Math.sign(abC) * Math.sign(abD) < 0 && Math.sign(cdA) * Math.sign(cdB) < 0) ||
        onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}

/** -1 outside, 0 boundary, 1 interior; winding-independent robust ray crossing. */
function pointInRing(p: Pair, ring: Pair[]): number {
    let winding = 0;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if (onSegment(p, a, b)) return 0;
        if (a[1] <= p[1] && b[1] > p[1] && orientation(a, b, p) > 0) winding++;
        if (a[1] > p[1] && b[1] <= p[1] && orientation(a, b, p) < 0) winding--;
    }
    return winding === 0 ? -1 : 1;
}

function ringsIntersect(a: Pair[], b: Pair[]): boolean {
    return a.some((p, i) => b.some((q, j) => segmentsIntersect(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
}

/** Translated shoelace plus compensated summation avoids large-coordinate cancellation. */
function ringArea(ring: Pair[]): number {
    const origin = ring[0];
    let sum = 0, correction = 0;
    for (let i = 1; i < ring.length - 1; i++) {
        const a = ring[i], b = ring[i + 1];
        const term = (a[0] - origin[0]) * (b[1] - origin[1]) - (b[0] - origin[0]) * (a[1] - origin[1]);
        const adjusted = term - correction;
        const next = sum + adjusted;
        correction = (next - sum) - adjusted;
        sum = next;
    }
    return Math.abs(sum) / 2;
}

/** sin(x)/x - 1 without cancellation for short latitude spans (including x = 0). */
function sincMinusOne(x: number): number {
    if (Math.abs(x) >= 1e-3) return Math.sin(x) / x - 1;
    const squared = x * x;
    return squared * (-1 / 6 + squared * (1 / 120 - squared / 5040));
}

/**
 * -R² ∮ sin(latitude) d(longitude), integrated along straight lon/lat edges.
 * The edge's mean sine is sin(midpoint) * sinc(half latitude span), so splitting
 * an edge (including a shared cut) does not change its integral. A constant sine
 * reference cancels on the closed ring; subtract it analytically for metre-scale
 * precision far from the equator, then use compensated summation.
 */
function sphericalRingArea(input: GPSCoordinate[]): number {
    const ring = openRing(input);
    const referenceLatitude = ring[0].latitude;
    const reference = referenceLatitude * RAD;
    let sum = 0, correction = 0;
    ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length];
        const midpointOffset = ((a.latitude - referenceLatitude) + (b.latitude - referenceLatitude)) * RAD / 2;
        const halfSpan = (b.latitude - a.latitude) * RAD / 2;
        const meanSineOffset = 2 * Math.cos(reference + midpointOffset / 2) * Math.sin(midpointOffset / 2)
            + Math.sin(reference + midpointOffset) * sincMinusOne(halfSpan);
        const term = -(b.longitude - a.longitude) * RAD * meanSineOffset;
        const adjusted = term - correction;
        const next = sum + adjusted;
        correction = (next - sum) - adjusted;
        sum = next;
    });
    return Math.abs(sum) * R * R;
}

interface Projection {
    project: (p: GPSCoordinate) => Pair;
    unproject: (p: Pair) => GPSCoordinate;
}

/** Affine metric frame for clipping/topology/tolerances, not displayed area. */
function projectionFor(parent: ParcelGeometry): Projection {
    const origin = openRing(parent.outer)[0];
    const xScale = R * RAD * Math.cos(extentCentreOf(parent).latitude * RAD);
    const yScale = R * RAD;
    return {
        project: p => [(p.longitude - origin.longitude) * xScale, (p.latitude - origin.latitude) * yScale],
        unproject: p => ({ longitude: origin.longitude + p[0] / xScale, latitude: origin.latitude + p[1] / yScale }),
    };
}

function projectedPolygon(g: ParcelGeometry, projection: Projection): Polygon {
    return [g.outer, ...g.holes].map(ring => openRing(ring).map(projection.project));
}

function polygonArea(p: Polygon): number {
    return ringArea(p[0]) - p.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
}

function multiArea(multi: MultiPolygon): number {
    return multi.reduce((sum, p) => sum + polygonArea(p), 0);
}

/** Validate before passing anything to polygon-clipping (which tolerates invalid rings). */
export function validateParcelGeometry(g: ParcelGeometry): string[] {
    if (!g || !Array.isArray(g.outer) || !Array.isArray(g.holes) || g.holes.some(h => !Array.isArray(h))) {
        return ['Invalid geometry: outer and holes must be coordinate arrays'];
    }
    const errors: string[] = [];
    const allRings = [g.outer, ...g.holes];
    if (allRings.some(ring => ring.some(p => !validPoint(p)))) return ['Invalid geometry: GPS coordinates must be finite and in range'];
    const rings = allRings.map(openRing).map(ring => ring.map(xy));
    rings.forEach((ring, index) => {
        const name = index === 0 ? 'Outer ring' : `Hole ${index}`;
        if (ring.length < 3) { errors.push(`${name} needs at least three vertices`); return; }
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length], c = ring[(i + 2) % ring.length];
            if (a[0] === b[0] && a[1] === b[1]) errors.push(`${name} has a duplicate vertex`);
            if (orientation(a, b, c) === 0 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) <= 0) {
                errors.push(`${name} has a backtracking or self-touching edge`);
            }
            for (let j = i + 2; j < ring.length; j++) {
                if (i === 0 && j === ring.length - 1) continue;
                if (segmentsIntersect(a, b, ring[j], ring[(j + 1) % ring.length])) errors.push(`${name} self-intersects or self-touches`);
            }
        }
        if (ringArea(ring) === 0) errors.push(`${name} has zero area`);
    });
    if (errors.length) return errors;
    const points = allRings.flat();
    if (points.some(p => Math.abs(p.latitude) >= POLAR_LATITUDE)) errors.push('Polar geometry (latitude >= 80°) is unsupported');
    const longitudes = points.map(p => p.longitude);
    if (Math.max(...longitudes) - Math.min(...longitudes) > 180) errors.push('Antimeridian geometry is unsupported');
    // Order-independent supported extent: a 10-km radius around the bounding-box centre.
    // A clipped ring's first vertex is engine-chosen, so it cannot define the supported extent.
    const extentCentre = extentCentreOf(g);
    const latitudes = points.map(p => p.latitude);
    const extentCorners = [Math.min(...latitudes), Math.max(...latitudes)].flatMap(latitude => [Math.min(...longitudes), Math.max(...longitudes)].map(longitude => ({ latitude, longitude })));
    if (extentCorners.some(p => distanceMeters(extentCentre, p) > MAX_RADIUS_METERS)) errors.push('Geometry bounding extent must fit within a 10-km radius of its centre');
    const outer = rings[0];
    rings.slice(1).forEach((hole, i) => {
        if (ringsIntersect(outer, hole) || pointInRing(hole[0], outer) !== 1) errors.push(`Hole ${i + 1} must lie strictly inside the outer ring without touching`);
        for (let j = 1; j < i + 1; j++) {
            const other = rings[j];
            if (ringsIntersect(hole, other) || pointInRing(hole[0], other) >= 0 || pointInRing(other[0], hole) >= 0) {
                errors.push(`Holes ${j} and ${i + 1} intersect, touch or are nested`);
            }
        }
    });
    if (!errors.length && polygonArea(projectedPolygon(g, projectionFor(g))) <= 0) errors.push('Geometry has zero usable area');
    return errors;
}

function assertValid(g: ParcelGeometry): void {
    const errors = validateParcelGeometry(g);
    if (errors.length) throw new Error(`Invalid parcel geometry: ${errors.join('; ')}`);
}

function usablePoint(p: Pair, polygon: Polygon): boolean {
    return pointInRing(p, polygon[0]) === 1 && polygon.slice(1).every(hole => pointInRing(p, hole) === -1);
}

/** Midpoints of scanline intervals always give interior candidates, even for concavity/holes. */
function interiorLabel(polygon: Polygon): Pair {
    const ys = [...new Set(polygon.flat().map(p => p[1]))].sort((a, b) => a - b);
    let best: Pair | undefined;
    let bestWidth = -1;
    for (let i = 0; i < ys.length - 1; i++) {
        const y = (ys[i] + ys[i + 1]) / 2;
        const xs: number[] = [];
        for (const ring of polygon) {
            ring.forEach((a, j) => {
                const b = ring[(j + 1) % ring.length];
                if ((a[1] < y && b[1] > y) || (b[1] < y && a[1] > y)) {
                    xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
                }
            });
        }
        xs.sort((a, b) => a - b);
        for (let j = 0; j < xs.length - 1; j++) {
            const p: Pair = [(xs[j] + xs[j + 1]) / 2, y];
            if (xs[j + 1] - xs[j] > bestWidth && usablePoint(p, polygon)) {
                best = p; bestWidth = xs[j + 1] - xs[j];
            }
        }
    }
    if (!best) throw new Error('Geometry has no representable interior label point');
    return best;
}

/**
 * Horizontal spherical GPS estimates, not legal survey measurements. Never rounded here.
 * Straight lon/lat clipped pieces conserve measured area within areaTolerance(parentArea).
 */
export function measureParcelGeometry(g: ParcelGeometry): ParcelMeasurements {
    assertValid(g);
    const projection = projectionFor(g);
    const polygon = projectedPolygon(g, projection);
    const areaSquareMeters = sphericalRingArea(g.outer) - g.holes.reduce((sum, hole) => sum + sphericalRingArea(hole), 0);
    const lengths = (ring: GPSCoordinate[]) => openRing(ring).map((p, i, points) => distanceMeters(p, points[(i + 1) % points.length]));
    const edgeLengthsMeters = lengths(g.outer);
    const outerPerimeterMeters = edgeLengthsMeters.reduce((sum, length) => sum + length, 0);
    const labelCoordinate = projection.unproject(interiorLabel(polygon));
    // Confirm the geographic round-trip did not put a label on an edge of an extremely thin ring.
    if (!usablePoint(xy(labelCoordinate), [g.outer, ...g.holes].map(ring => openRing(ring).map(xy)))) {
        throw new Error('Geometry has no representable interior label point');
    }
    return {
        areaSquareMeters, areaHectares: areaSquareMeters / 10000,
        outerPerimeterMeters, totalBoundaryMeters: outerPerimeterMeters + g.holes.flatMap(lengths).reduce((sum, length) => sum + length, 0),
        edgeLengthsMeters, labelCoordinate,
    };
}

export function snapCoordinateToGeometry(point: GPSCoordinate, parent: ParcelGeometry, maxDistanceMeters = 2): GPSCoordinate {
    assertValid(parent);
    if (!validPoint(point) || !Number.isFinite(maxDistanceMeters) || maxDistanceMeters < 0) throw new Error('Invalid snap coordinate or distance');
    const projection = projectionFor(parent);
    const p = projection.project(point);
    let best = point, bestDistance = Math.min(2, maxDistanceMeters);
    for (const ring of [parent.outer, ...parent.holes].map(openRing)) {
        ring.forEach((a, i) => {
            const b = ring[(i + 1) % ring.length];
            const start = projection.project(a), end = projection.project(b);
            const dx = end[0] - start[0], dy = end[1] - start[1];
            const t = Math.max(0, Math.min(1, ((p[0] - start[0]) * dx + (p[1] - start[1]) * dy) / (dx * dx + dy * dy)));
            const candidate = t === 0 ? a : t === 1 ? b : projection.unproject([start[0] + t * dx, start[1] + t * dy]);
            const distance = distanceMeters(point, candidate);
            if (distance <= bestDistance) { best = candidate; bestDistance = distance; }
        });
    }
    return best;
}

/** Restore exact existing vertices; intern new intersections so sibling edges share coordinates. */
function fromMultiPolygon(multi: MultiPolygon, projection: Projection, sources: ParcelGeometry[], tolerance: number): ParcelGeometry[] {
    const known = new Map<string, GPSCoordinate>();
    const key = (p: Pair) => `${p[0]},${p[1]}`;
    sources.forEach(g => [g.outer, ...g.holes].flat().forEach(p => known.set(key(projection.project(p)), p)));
    return multi.map(polygon => {
        if (polygonArea(polygon) <= tolerance) throw new Error('Tiny geometry fragment requires correction');
        const rings = polygon.map(ring => {
            const points = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
            return points.map(p => {
                const id = key(p);
                if (!known.has(id)) known.set(id, projection.unproject(p));
                return known.get(id)!;
            });
        });
        const geometry = { outer: rings[0], holes: rings.slice(1) };
        assertValid(geometry);
        return geometry;
    });
}

/** Blocks may leave unassigned land. Touching shared edges are allowed; positive-area conflicts are not. */
export function validateBlockLayout(parent: ParcelGeometry, blocks: ParcelGeometry[]): string[] {
    const parentErrors = validateParcelGeometry(parent);
    if (parentErrors.length) return parentErrors.map(error => `Parent: ${error}`);
    if (!Array.isArray(blocks)) return ['Blocks must be a geometry array'];
    const errors = blocks.flatMap((g, i) => validateParcelGeometry(g).map(error => `Block ${i + 1}: ${error}`));
    if (errors.length) return errors;
    const projection = projectionFor(parent);
    const parentPolygon = projectedPolygon(parent, projection);
    const tolerance = areaTolerance(polygonArea(parentPolygon));
    const polygons = blocks.map(g => projectedPolygon(g, projection));
    polygons.forEach((polygon, i) => {
        if (polygonArea(polygon) <= tolerance) errors.push(`Block ${i + 1} is a tiny fragment requiring correction`);
        if (multiArea(difference(polygon, parentPolygon)) > tolerance) errors.push(`Block ${i + 1} lies outside usable parent geometry`);
    });
    // Sum intersections with the prior union: many individually tiny overlaps must not evade tolerance.
    let accepted: MultiPolygon = [];
    let overlapArea = 0;
    polygons.forEach((polygon, i) => {
        const overlap = accepted.length ? multiArea(intersection(polygon, accepted)) : 0;
        overlapArea += overlap;
        if (overlap > tolerance) errors.push(`Block ${i + 1} overlaps another block`);
        accepted = accepted.length ? union(accepted, polygon) : [polygon];
    });
    if (overlapArea > tolerance && !errors.some(e => /overlap/.test(e))) errors.push('Blocks collectively overlap');
    if (polygons.reduce((sum, p) => sum + multiArea(difference(p, parentPolygon)), 0) > tolerance && !errors.some(e => /outside/.test(e))) {
        errors.push('Blocks collectively lie outside usable parent geometry');
    }
    return errors;
}

export function subtractBlocks(parent: ParcelGeometry, blocks: ParcelGeometry[]): ParcelGeometry[] {
    const errors = validateBlockLayout(parent, blocks);
    if (errors.length) throw new Error(`Invalid block layout: ${errors.join('; ')}`);
    if (!blocks.length) return [parent];
    const projection = projectionFor(parent);
    const polygon = projectedPolygon(parent, projection);
    return fromMultiPolygon(difference(polygon, ...blocks.map(g => projectedPolygon(g, projection))), projection, [parent, ...blocks], areaTolerance(polygonArea(polygon)));
}

/** Two complementary bounded half-planes; polygon-clipping handles concavity, holes and disconnections. */
export function splitParcelByLine(g: ParcelGeometry, cut: [GPSCoordinate, GPSCoordinate]): ParcelGeometry[] {
    assertValid(g);
    if (!Array.isArray(cut) || cut.length !== 2 || cut.some(p => !validPoint(p))) throw new Error('Cut needs two valid GPS coordinates');
    const projection = projectionFor(g);
    const endpoints = cut.map(p => snapCoordinateToGeometry(p, g));
    const [a, b] = endpoints.map(projection.project);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length === 0) throw new Error('Cut endpoints must be distinct');
    const extentCentre = extentCentreOf(g);
    if (endpoints.some(p => Math.abs(p.latitude) >= POLAR_LATITUDE || Math.abs(p.longitude - extentCentre.longitude) > 180 || distanceMeters(extentCentre, p) > MAX_RADIUS_METERS)) {
        throw new Error('Cut must stay within the non-polar, non-antimeridian 10-km parcel-local radius');
    }
    const direction: Pair = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    const normal: Pair = [-direction[1], direction[0]];
    const polygon = projectedPolygon(g, projection);
    const dot = (p: Pair, axis: Pair) => (p[0] - a[0]) * axis[0] + (p[1] - a[1]) * axis[1];
    const outer = polygon[0];
    // Require the finite drawn segment to span every intersection with the selected outer shape.
    const roundoff = Number.EPSILON * Math.max(1, length) * 32;
    outer.forEach((p, i) => {
        const q = outer[(i + 1) % outer.length];
        const pSide = dot(p, normal), qSide = dot(q, normal);
        if (pSide * qSide > 0) return;
        const intersections = pSide === qSide ? [p, q] : [[
            p[0] + pSide / (pSide - qSide) * (q[0] - p[0]),
            p[1] + pSide / (pSide - qSide) * (q[1] - p[1]),
        ] as Pair];
        if (intersections.some(p => dot(p, direction) < -roundoff || dot(p, direction) > length + roundoff)) {
            throw new Error('Cut segment must span the entire selected geometry');
        }
    });
    const all = polygon.flat();
    const extent = Math.max(length, ...all.map(p => Math.hypot(p[0] - a[0], p[1] - a[1]))) * 2 + 1;
    const at = (along: number, across: number): Pair => [a[0] + along * direction[0] + across * normal[0], a[1] + along * direction[1] + across * normal[1]];
    const halfPlane = (side: number): Polygon => [[at(-extent, 0), at(extent, 0), at(extent, side * extent), at(-extent, side * extent)]];
    const left = intersection(polygon, halfPlane(1));
    const right = intersection(polygon, halfPlane(-1));
    if (!left.length || !right.length) throw new Error('Tangent or no-op cut does not divide usable land');
    const tolerance = areaTolerance(polygonArea(polygon));
    const pieces = fromMultiPolygon([...left, ...right], projection, [g], tolerance);
    const errors = validateBlockLayout(g, pieces);
    const accepted = pieces.map(piece => projectedPolygon(piece, projection));
    const coverage = union(accepted[0], ...accepted.slice(1));
    if (multiArea(difference(polygon, coverage)) > tolerance || Math.abs(multiArea(coverage) - polygonArea(polygon)) > tolerance) {
        errors.push('Cut does not conserve the entire usable area');
    }
    if (errors.length) throw new Error(`Invalid cut: ${errors.join('; ')}`);
    return pieces;
}
