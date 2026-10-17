import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { GPSCoordinate } from '../../utils/coordinates';
interface Props { points: GPSCoordinate[]; selectedIndex?: number | null; onSelect: (index: number) => void; onDelete: (index: number) => void; onManual: (latitude: string, longitude: string) => unknown; onUndo: () => void; onRedo: () => void; onClose: () => void; onCancel: () => void; onClear: () => void; error?: string | null }
export function BoundaryEditorPanel({ points, selectedIndex, onSelect, onDelete, onManual, onUndo, onRedo, onClose, onCancel, onClear, error }: Props) {
    const [latitude, setLatitude] = useState(''), [longitude, setLongitude] = useState('');
    return <View className="p-4 bg-white gap-3" testID="boundary-editor-panel">
        <Text className="text-gray-900 font-bold">Boundary coordinates · {points.length} points</Text>
        <Text className="text-gray-600 text-xs">Tap to add · drag to move · select a numbered vertex, then Delete. Coordinates are the accessible map alternative.</Text>
        <View className="flex-row flex-wrap gap-2">
            {[["Undo", onUndo, 'mapping-undo'], ["Redo", onRedo, 'mapping-redo'], ["Close boundary", onClose, 'close-boundary'], ["Clear points", onClear, 'clear-boundary']] .map(([label, action, testID]) => <Pressable key={String(testID)} testID={String(testID)} accessibilityRole="button" accessibilityLabel={String(label)} onPress={action as () => void} className="min-h-12 px-3 border border-gray-300 rounded-lg justify-center"><Text className="text-gray-800 font-bold">{String(label)}</Text></Pressable>)}
        </View>
        {points.length === 0 && <Text className="text-gray-600">No vertices recorded.</Text>}
        {points.map((point, index) => <View key={index} className={`flex-row border rounded-xl ${selectedIndex === index ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
            <Pressable testID={`select-vertex-${index}`} accessibilityRole="button" accessibilityLabel={`Select vertex ${index + 1}`} onPress={() => onSelect(index)} className="min-h-12 flex-1 p-3 justify-center"><Text className="text-gray-900 font-semibold">{index + 1}. {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</Text></Pressable>
            <Pressable testID={`remove-vertex-${index}`} accessibilityRole="button" accessibilityLabel={`Delete vertex ${index + 1}`} onPress={() => onDelete(index)} className="min-h-12 min-w-12 p-3 justify-center"><Text className="text-red-700 font-bold">Delete</Text></Pressable>
        </View>)}
        <TextInput testID="manual-latitude" accessibilityLabel="Latitude in decimal degrees" value={latitude} onChangeText={setLatitude} placeholder="Latitude (e.g. 8.3512)" placeholderTextColor="#9CA3AF" keyboardType="numbers-and-punctuation" className="text-gray-900 min-h-12 p-3 border border-gray-300 rounded-xl" />
        <TextInput testID="manual-longitude" accessibilityLabel="Longitude in decimal degrees" value={longitude} onChangeText={setLongitude} placeholder="Longitude (e.g. 124.8621)" placeholderTextColor="#9CA3AF" keyboardType="numbers-and-punctuation" className="text-gray-900 min-h-12 p-3 border border-gray-300 rounded-xl" />
        <Pressable testID="add-vertex" accessibilityRole="button" accessibilityLabel="Add coordinate vertex" onPress={() => { if (onManual(latitude, longitude) === true) { setLatitude(''); setLongitude(''); } }} className="min-h-12 bg-green-800 rounded-xl p-3 justify-center"><Text className="text-white font-bold text-center">Add point</Text></Pressable>
        {error && <Text testID="vertex-input-error" accessibilityRole="alert" className="text-red-700">{error}</Text>}
        <Pressable testID="cancel-boundary-edit" accessibilityRole="button" accessibilityLabel="Cancel boundary editing" onPress={onCancel} className="min-h-12 p-3 justify-center"><Text className="text-gray-800 text-center font-bold">Cancel editing</Text></Pressable>
    </View>;
}
