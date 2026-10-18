import React from 'react';
import { Platform, Pressable, ScrollView, Text } from 'react-native';
import { MappingMode } from '../../hooks/useParcelMapping';
interface Props { mode: MappingMode; onMode: (mode: MappingMode) => void; onCurrentPosition: () => void; onAssign: () => void; disabled?: boolean }
const actions: Array<[string, MappingMode]> = [['Browse parcels', 'browse'], ['Draw boundary', 'boundary'], ['Record GPS', 'gps'], ['Enter coordinates', 'manual'], ['Exclude area', 'exclude'], ['Divide with cut', 'cut'], ['Outline block', 'block']];
export function MappingToolbar({ mode, onMode, onCurrentPosition, onAssign, disabled }: Props) {
    // style flexGrow 0: react-native-web gives a horizontal ScrollView flex-grow:1, which
    // made this strip a competing flexible sibling in the screen column and crushed the map
    // row below its own content height. The toolbar hugs its buttons; the map owns the slack.
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} className="bg-white border-b border-gray-200" contentContainerStyle={{ padding: 6, gap: 6 }} testID="mapping-toolbar">
        {actions.map(([label, value]) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: mode === value, disabled: !!disabled }} {...(Platform.OS === 'web' ? { 'aria-pressed': mode === value } : {})} disabled={disabled} testID={`mapping-mode-${value}`} onPress={() => onMode(value)} className={`min-h-12 px-4 justify-center rounded-xl border ${mode === value ? 'bg-green-800 border-green-800' : 'bg-white border-gray-300'}`}>
            <Text className={`font-bold text-sm ${mode === value ? 'text-white' : 'text-gray-800'}`}>{label}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Add current position" testID="add-current-position" disabled={disabled} onPress={onCurrentPosition} className="min-h-12 px-4 justify-center rounded-xl border border-gray-300"><Text className="font-bold text-sm text-gray-800">Add current position</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Assign workers" testID="assign-block-workers" disabled={disabled} onPress={onAssign} className="min-h-12 px-4 justify-center rounded-xl border border-gray-300"><Text className="font-bold text-sm text-gray-800">Assign workers</Text></Pressable>
    </ScrollView>;
}
