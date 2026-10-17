/**
 * Coordinate utilities for the GPS boundary mapping module.
 *
 * Canonical storage format for `gps_coordinates` columns is a JSON string:
 *   [{"latitude":8.3512,"longitude":124.8621}, ...]
 *
 * Legacy rows (including the agri-one seed script) store a plain
 * "lat, lon" string representing a single surveyed point. The tolerant
 * parser below accepts both so old rows are never clobbered by a parse
 * failure.
 */

export interface GPSCoordinate {
    latitude: number;
    longitude: number;
}

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

export function isValidCoordinate(latitude: number, longitude: number): boolean {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    return (
        latitude >= LAT_MIN &&
        latitude <= LAT_MAX &&
        longitude >= LON_MIN &&
        longitude <= LON_MAX
    );
}

/**
 * Tolerant parser — never throws. Returns [] for null/empty/unparseable input.
 * Legacy "lat, lon" strings parse to a single-element array.
 */
export function parseGpsCoordinates(raw: string | null | undefined): GPSCoordinate[] {
    if (raw == null) return [];
    const trimmed = raw.trim();
    if (trimmed === '') return [];

    if (trimmed.startsWith('[')) {
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (!Array.isArray(parsed)) return [];
            const out: GPSCoordinate[] = [];
            for (const entry of parsed) {
                if (entry == null || typeof entry !== 'object') continue;
                const { latitude, longitude } = entry as Record<string, unknown>;
                if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
                if (!isValidCoordinate(latitude, longitude)) continue;
                out.push({ latitude, longitude });
            }
            return out;
        } catch {
            return [];
        }
    }

    // Legacy single-point format: "8.3667, 124.8667"
    const parts = trimmed.split(',');
    if (parts.length === 2) {
        const lat = Number(parts[0].trim());
        const lon = Number(parts[1].trim());
        if (isValidCoordinate(lat, lon)) {
            return [{ latitude: lat, longitude: lon }];
        }
    }

    return [];
}

/**
 * Serializes to the canonical JSON format. Returns null for empty input so
 * the DB column is stored as NULL rather than "[]".
 */
export function serializeGpsCoordinates(coords: GPSCoordinate[] | null | undefined): string | null {
    if (!coords || coords.length === 0) return null;
    return JSON.stringify(coords);
}

/** Full decimal input only: no partial parseFloat, exponent, hex or empty values. */
export function parseCoordinateNumber(raw: string): number | null {
    if (typeof raw !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())) return null;
    const value = Number(raw.trim());
    return Number.isFinite(value) ? value : null;
}

/** Strict storage reader for writes/review: never filters a corrupt vertex. */
export function parseGpsCoordinatesStrict(raw: string | null | undefined): GPSCoordinate[] {
    if (raw == null || raw.trim() === '') return [];
    const text = raw.trim();
    let entries: unknown;
    if (text.startsWith('[')) {
        try { entries = JSON.parse(text); } catch { throw new Error('Corrupt GPS coordinates'); }
    } else {
        const parts = text.split(',');
        const latitude = parts.length === 2 ? parseCoordinateNumber(parts[0]) : null;
        const longitude = parts.length === 2 ? parseCoordinateNumber(parts[1]) : null;
        if (latitude === null || longitude === null) throw new Error('Corrupt GPS coordinates');
        entries = [{ latitude, longitude }];
    }
    if (!Array.isArray(entries) || entries.some(entry =>
        !entry || typeof entry !== 'object' || !isValidCoordinate(entry.latitude, entry.longitude)
    )) throw new Error('Corrupt GPS coordinates');
    return entries.map(({ latitude, longitude }) => ({ latitude, longitude }));
}

const EARTH_RADIUS_METERS = 6378137;

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: GPSCoordinate, b: GPSCoordinate): number {
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLon = (b.longitude - a.longitude) * rad;
    const lat1 = a.latitude * rad;
    const lat2 = b.latitude * rad;

    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
