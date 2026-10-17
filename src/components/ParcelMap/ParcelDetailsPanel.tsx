import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ParcelMeasurements } from '../../utils/parcelGeometry';
interface Props { name: string; registeredArea?: number; measurements: ParcelMeasurements | null; createdAt?: Date | null; boundarySavedAt?: Date | null; onCopy: () => void; onOpenMaps: () => void }
const dateText = (date?: Date | null) => date && Number.isFinite(date.getTime()) ? date.toLocaleDateString() : 'Not recorded';
export function ParcelDetailsPanel({ name, registeredArea, measurements: m, createdAt, boundarySavedAt, onCopy, onOpenMaps }: Props) {
    return <View className="bg-white p-4 gap-3" testID="parcel-details-panel">
        <Text className="text-lg font-bold text-gray-900">{name}</Text>
        {m ? <>
            <View className="flex-row justify-between items-end"><Text className="text-3xl font-black text-green-800" testID="measured-hectares">{m.areaHectares.toFixed(4)} ha</Text><Text className="text-gray-700 font-semibold">{Math.round(m.areaSquareMeters).toLocaleString('en-US')} m²</Text></View>
            <View className="flex-row justify-between"><Text className="text-gray-600">Outer perimeter</Text><Text className="text-gray-900 font-bold">{m.outerPerimeterMeters.toFixed(1)} m</Text></View>
            {m.totalBoundaryMeters > m.outerPerimeterMeters + 0.01 && <View className="flex-row justify-between"><Text className="text-gray-600">Total boundary length</Text><Text className="text-gray-900 font-bold">{m.totalBoundaryMeters.toFixed(1)} m</Text></View>}
            <Text className="text-gray-600 text-xs">Horizontal GPS estimates, not a legal survey. Excluded pockets are deducted from usable area.</Text>
            <Text className="text-gray-600 text-sm">Representative coordinate — not a guaranteed entrance</Text>
            <Text selectable className="text-gray-900 font-semibold">{m.labelCoordinate.latitude.toFixed(6)}, {m.labelCoordinate.longitude.toFixed(6)}</Text>
            <View className="flex-row gap-2">
                <Pressable accessibilityRole="button" accessibilityLabel="Copy parcel coordinates" onPress={onCopy} className="min-h-12 flex-1 p-3 border border-gray-300 rounded-xl justify-center"><Text className="text-gray-800 text-center font-bold">Copy coordinates</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Open representative coordinate in maps" onPress={onOpenMaps} className="min-h-12 flex-1 p-3 border border-gray-300 rounded-xl justify-center"><Text className="text-gray-800 text-center font-bold">Open in maps</Text></Pressable>
            </View>
        </> : <Text className="text-gray-700">Add at least three non-crossing points to measure the parcel. Invalid boundaries stay editable for correction.</Text>}
        {registeredArea != null && <Text className="text-gray-600 text-xs">Registered area: {registeredArea.toFixed(4)} ha. Measurements replace this only after review and Save.</Text>}
        <Text className="text-gray-600 text-xs">Parcel created: {dateText(createdAt)}</Text>
        <Text className="text-gray-600 text-xs">Boundary saved: {dateText(boundarySavedAt)}</Text>
    </View>;
}
