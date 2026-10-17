import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MappingBlock } from '../../hooks/useParcelMapping';
import { ParcelGeometry, measureParcelGeometry } from '../../utils/parcelGeometry';
interface Props { mode: 'cut' | 'block'; preview: { blocks: MappingBlock[]; remainder: ParcelGeometry[] } | null; onPreview: () => void; onAccept: (names: string[]) => void; onCancel: () => void }
export function BlockDivisionPanel({ mode, preview, onPreview, onAccept, onCancel }: Props) {
    const [names, setNames] = useState<string[]>([]);
    useEffect(() => setNames(preview?.blocks.map(block => block.name) ?? []), [preview]);
    return <View className="p-4 bg-white gap-3" testID="block-division-panel">
        <Text className="text-gray-900 font-bold">{mode === 'cut' ? 'Straight two-point cut' : 'Outline a named block'}</Text>
        <Text className="text-gray-600 text-sm">{mode === 'cut' ? 'Place two endpoints spanning the entire selected parcel or unassigned block. Every disconnected piece is retained.' : 'Outline usable land. The unassigned remainder stays visible until you divide or assign it.'}</Text>
        <Text className="text-gray-600 text-xs">Points within 2 m of a shared boundary snap to that edge.</Text>
        {!preview ? <Pressable testID="preview-division" accessibilityRole="button" accessibilityLabel="Preview block division" onPress={onPreview} className="min-h-12 p-3 border border-green-800 rounded-xl justify-center"><Text className="text-green-800 font-bold text-center">Preview division</Text></Pressable> : <>
            {preview.blocks.map((block, index) => <View key={block.id} className="gap-2">
                <Text className="text-gray-900 font-semibold">Piece {index + 1}: {measureParcelGeometry(block.geometry).areaHectares.toFixed(4)} ha</Text>
                <TextInput testID={`block-name-${block.id}`} accessibilityLabel={`Name for piece ${index + 1}`} value={names[index] ?? block.name} onChangeText={value => setNames(old => preview.blocks.map((b, i) => i === index ? value : old[i] ?? b.name))} maxLength={100} placeholder="Block name" placeholderTextColor="#9CA3AF" className="text-gray-900 min-h-12 p-3 border border-gray-300 rounded-xl" />
            </View>)}
            <Text className="text-gray-700">{preview.remainder.length ? `Unassigned remainder: ${preview.remainder.length} piece(s), ${preview.remainder.reduce((sum, g) => sum + measureParcelGeometry(g).areaHectares, 0).toFixed(4)} ha` : 'No unassigned remainder'}</Text>
            <Pressable testID="accept-division" accessibilityRole="button" accessibilityLabel="Accept block division preview" onPress={() => onAccept(names)} className="min-h-12 p-3 bg-green-800 rounded-xl justify-center"><Text className="text-white font-bold text-center">Accept layout draft</Text></Pressable>
            <Text className="text-gray-600 text-xs">Review and Save the layout to persist these blocks.</Text>
        </>}
        <Pressable testID="cancel-division" accessibilityRole="button" accessibilityLabel="Cancel block division" onPress={onCancel} className="min-h-12 p-3 justify-center"><Text className="text-gray-800 text-center font-bold">Cancel division</Text></Pressable>
    </View>;
}
