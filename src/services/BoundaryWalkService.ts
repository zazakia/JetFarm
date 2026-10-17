import { GPSCoordinate, distanceMeters, isValidCoordinate } from '../utils/coordinates';

/** A single GPS observation from the device (or browser). */
export interface GPSFix {
    coordinate: GPSCoordinate;
    /** Horizontal accuracy radius in meters; lower is better. Null when the platform omits it. */
    accuracyMeters: number | null;
    timestamp: number;
}

export interface WalkSettings {
    /** Fixes with accuracy worse than this are ignored while walking a boundary. */
    maxAccuracyMeters: number;
    /** A new vertex is captured after moving at least this far from the previous vertex. */
    minDistanceMeters: number;
}

export const DEFAULT_WALK_SETTINGS: WalkSettings = {
    maxAccuracyMeters: 10,
    minDistanceMeters: 5,
};

/** Accuracy and coordinate sanity gate — rejects invalid or imprecise fixes. */
export function isFixAccepted(fix: GPSFix, settings: WalkSettings): boolean {
    if (!fix || !fix.coordinate) return false;
    if (!isValidCoordinate(fix.coordinate.latitude, fix.coordinate.longitude)) return false;
    if (fix.accuracyMeters == null || !Number.isFinite(fix.accuracyMeters) || fix.accuracyMeters < 0) return false;
    return fix.accuracyMeters <= settings.maxAccuracyMeters;
}

/**
 * Decides whether a GPS fix becomes a new boundary vertex.
 * Returns the previous array (same reference) when no vertex is appended, so
 * React state stays referentially stable for rejected jitter fixes.
 */
export function appendVertexIfMoved(
    vertices: GPSCoordinate[],
    fix: GPSFix,
    settings: WalkSettings
): GPSCoordinate[] {
    const last = vertices[vertices.length - 1];
    if (!last) return [fix.coordinate];
    if (distanceMeters(last, fix.coordinate) < settings.minDistanceMeters) {
        return vertices;
    }
    return [...vertices, fix.coordinate];
}
