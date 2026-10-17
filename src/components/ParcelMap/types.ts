import { GPSCoordinate } from '../../utils/coordinates';

export interface ParcelMapFeature {
    id: string;
    name: string;
    kind: 'parcel' | 'block';
    coordinates: GPSCoordinate[];
    holes?: GPSCoordinate[][];
    areaHectares?: number;
    labelCoordinate?: GPSCoordinate;
    selected?: boolean;
    status?: string;
}

export interface ParcelMapProps {
    coordinates: GPSCoordinate[];
    holes?: GPSCoordinate[][];
    onChange?: (next: GPSCoordinate[]) => void;
    /** Browse is the default; a drawing action must explicitly enable editing. */
    editable?: boolean;
    height?: number;
    liveCoordinate?: GPSCoordinate | null;
    features?: ParcelMapFeature[];
    onFeatureSelect?: (id: string) => void;
    onVertexSelect?: (index: number) => void;
    selectedVertexIndex?: number | null;
    selectedFeatureId?: string;
    fitRequest?: number;
    showEdgeLengths?: boolean;
    mapLayer?: 'satellite' | 'street';
    /** Open drafts/cuts remain polylines until explicitly closed. */
    closed?: boolean;
}
