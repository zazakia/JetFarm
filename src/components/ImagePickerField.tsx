/**
 * ImagePickerField
 *
 * Reusable field component for attaching a photo to any form modal.
 * - Empty state: shows "Add Photo" button with camera/gallery options
 * - Filled state: thumbnail + Remove + Full-screen view
 * - Pending state: amber badge "Uploading when online…"
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    Pressable,
    Image,
    Modal,
    ActivityIndicator,
    Platform,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AgriImageUploadService, ImagePickerSource } from '../services/AgriImageUploadService';

export interface ImagePickerFieldProps {
    /** Current URL (CDN) or local file:// URI */
    value: string | null;
    /** Called with new URL/URI after pick+upload, or null when removed */
    onChange: (url: string | null) => void;
    /** Supabase Storage subfolder, e.g. 'growth-checkins' */
    folder: string;
    /** Field label shown above the button */
    label?: string;
    /** Shows amber "pending upload" badge */
    isPending?: boolean;
    /** Disable the field (e.g. when parent form is saving) */
    disabled?: boolean;
}

export function ImagePickerField({
    value,
    onChange,
    folder,
    label = 'Attach Photo',
    isPending = false,
    disabled = false,
}: ImagePickerFieldProps) {
    const [uploading, setUploading] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);

    const handlePick = async (source: ImagePickerSource) => {
        if (disabled || uploading) return;
        setUploading(true);
        try {
            const result = await AgriImageUploadService.pickAndUpload(folder, source);
            if (result) {
                onChange(result.url);
            }
        } catch (e) {
            Alert.alert('Photo Error', 'Could not attach photo. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleSourcePrompt = () => {
        if (Platform.OS === 'web') {
            handlePick('gallery');
            return;
        }
        Alert.alert('Add Photo', 'Choose a source', [
            { text: 'Camera', onPress: () => handlePick('camera') },
            { text: 'Photo Library', onPress: () => handlePick('gallery') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleRemove = () => {
        Alert.alert('Remove Photo', 'Remove this photo?', [
            { text: 'Remove', style: 'destructive', onPress: () => onChange(null) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    return (
        <View className="mb-3">
            {/* Label */}
            <Text className="text-xs font-bold text-gray-700 mb-1">{label}</Text>

            {value ? (
                /* ── Filled state ── */
                <View>
                    <Pressable onPress={() => setViewerVisible(true)} className="rounded-lg overflow-hidden">
                        <Image
                            source={{ uri: value }}
                            className="w-full h-36 rounded-lg bg-gray-200"
                            resizeMode="cover"
                            testID="image-picker-thumbnail"
                        />
                    </Pressable>

                    {/* Pending badge */}
                    {isPending && (
                        <View className="absolute top-2 left-2 bg-amber-400 rounded-full px-2 py-0.5 flex-row items-center">
                            <MaterialIcons name="cloud-upload" size={12} color="#78350F" />
                            <Text className="text-xs text-amber-900 font-bold ml-1">Uploading when online…</Text>
                        </View>
                    )}

                    {/* Action row */}
                    <View className="flex-row mt-1.5 gap-2">
                        <Pressable
                            onPress={() => setViewerVisible(true)}
                            className="flex-1 flex-row items-center justify-center bg-gray-100 rounded-lg py-2"
                        >
                            <MaterialIcons name="zoom-in" size={16} color="#374151" />
                            <Text className="text-xs text-gray-700 font-semibold ml-1">View</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSourcePrompt}
                            disabled={disabled}
                            className="flex-1 flex-row items-center justify-center bg-blue-50 rounded-lg py-2"
                        >
                            <MaterialIcons name="refresh" size={16} color="#1D4ED8" />
                            <Text className="text-xs text-blue-700 font-semibold ml-1">Replace</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleRemove}
                            disabled={disabled}
                            className="flex-1 flex-row items-center justify-center bg-red-50 rounded-lg py-2"
                        >
                            <MaterialIcons name="delete-outline" size={16} color="#DC2626" />
                            <Text className="text-xs text-red-600 font-semibold ml-1">Remove</Text>
                        </Pressable>
                    </View>
                </View>
            ) : (
                /* ── Empty state ── */
                <Pressable
                    onPress={handleSourcePrompt}
                    disabled={disabled || uploading}
                    className={`border-2 border-dashed rounded-xl py-6 items-center justify-center ${
                        disabled || uploading ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-gray-50 active:bg-gray-100'
                    }`}
                    testID="image-picker-add-button"
                >
                    {uploading ? (
                        <>
                            <ActivityIndicator size="small" color="#6B7280" />
                            <Text className="text-xs text-gray-500 mt-2">Attaching photo…</Text>
                        </>
                    ) : (
                        <>
                            <MaterialIcons name="add-a-photo" size={28} color="#9CA3AF" />
                            <Text className="text-xs text-gray-500 mt-1.5 font-medium">Tap to add photo</Text>
                        </>
                    )}
                </Pressable>
            )}

            {/* Full-screen viewer modal */}
            {value && (
                <Modal visible={viewerVisible} transparent animationType="fade">
                    <View className="flex-1 bg-black/90 items-center justify-center">
                        <Pressable
                            onPress={() => setViewerVisible(false)}
                            className="absolute top-12 right-5 z-10 bg-white/20 rounded-full p-2"
                        >
                            <MaterialIcons name="close" size={24} color="white" />
                        </Pressable>
                        <Image
                            source={{ uri: value }}
                            className="w-full"
                            style={{ aspectRatio: 4 / 3, maxHeight: '80%' }}
                            resizeMode="contain"
                        />
                    </View>
                </Modal>
            )}
        </View>
    );
}
