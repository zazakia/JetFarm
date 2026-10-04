import { GPSCoordinate } from '../../utils/coordinates';

export interface ParcelMapProps {
    /** Current boundary polygon vertices, in walk order. */
    coordinates: GPSCoordinate[];
    /** Called when the user edits the boundary (map click, vertex drag/delete). */
    onChange?: (next: GPSCoordinate[]) => void;
    /** When false the map is view-only. Defaults to true when onChange is provided. */
    editable?: boolean;
    /** Fixed height in pixels. Defaults to 320. */
    height?: number;
    /** Most recent GPS fix while walking, shown as a live position dot. */
    liveCoordinate?: GPSCoordinate | null;
}

export const PARCEL_MAP_DEFAULT_HEIGHT = 320;
