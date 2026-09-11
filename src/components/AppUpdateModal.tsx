import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Linking,
    Platform,
} from 'react-native';
import { type AppVersionManifest } from '../services/AppUpdateService';

interface AppUpdateModalProps {
    visible: boolean;
    manifest: AppVersionManifest | null;
    currentVersion: string;
    isForced: boolean;
    isDownloading: boolean;
    downloadProgress: number;
    downloadedBytes: number;
    totalExpectedBytes: number;
    errorMessage: string | null;
    downloadReady?: boolean;
    onUpdatePress: () => void;
    onDismissPress: () => void;
}

export function AppUpdateModal({
    visible,
    manifest,
    currentVersion,
    isForced,
    isDownloading,
    downloadProgress,
    downloadedBytes,
    totalExpectedBytes,
    errorMessage,
    downloadReady = false,
    onUpdatePress,
    onDismissPress,
}: AppUpdateModalProps) {
    if (!manifest) return null;

    const targetVersion = manifest.latestVersion || 'Latest';
    const sizeMbText = manifest.apkSizeMb
        ? `${manifest.apkSizeMb.toFixed(1)} MB`
        : totalExpectedBytes > 0
        ? `${(totalExpectedBytes / (1024 * 1024)).toFixed(1)} MB`
        : null;

    const downloadedMbText =
        downloadedBytes > 0 ? `${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB` : '0 MB';

    const handleOpenInBrowser = async () => {
        const url = manifest.apkUrl || manifest.apkLatestUrl || 'https://jetfarm.pages.dev/download';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.open(url, '_blank');
        } else {
            await Linking.openURL(url);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismissPress}>
            <View className="flex-1 bg-black/60 items-center justify-center p-4">
                <View className="bg-white rounded-3xl p-5 w-full max-w-md border border-gray-200 shadow-2xl">
                    {/* Header Rocket Icon */}
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                            <Text className="text-3xl">🚀</Text>
                        </View>
                        <Text className="text-gray-900 font-black text-xl text-center">
                            {isForced ? 'Mandatory Update Required' : 'New Update Available!'}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1.5">
                            <View className="bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                                <Text className="text-gray-700 text-xs font-semibold">
                                    Current: v{currentVersion}
                                </Text>
                            </View>
                            <Text className="text-gray-400 font-bold">→</Text>
                            <View className="bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                                <Text className="text-emerald-800 text-xs font-bold">
                                    New: v{targetVersion}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Release Notes */}
                    <View className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 mb-4 max-h-48">
                        <Text className="text-gray-800 font-bold text-xs mb-1.5">What's New in this Release:</Text>
                        <ScrollView showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                            <Text className="text-gray-600 text-xs leading-relaxed">
                                {manifest.releaseNotes || '• General performance optimizations and latest bug fixes.'}
                            </Text>
                        </ScrollView>
                    </View>

                    {/* Package Size Info */}
                    {sizeMbText && !isDownloading && !downloadReady && (
                        <View className="flex-row items-center justify-between px-1 mb-4">
                            <Text className="text-gray-500 text-xs font-medium">Download Package Size:</Text>
                            <Text className="text-gray-800 text-xs font-bold">{sizeMbText}</Text>
                        </View>
                    )}

                    {/* Downloaded State Badge: Ready to install */}
                    {downloadReady && !isDownloading && (
                        <View className="flex-row items-center justify-center bg-emerald-50 rounded-xl py-2 px-3 border border-emerald-200 mb-4">
                            <Text className="text-emerald-700 text-xs font-bold">✅ Downloaded — ready to install</Text>
                        </View>
                    )}

                    {/* Download Progress Bar */}
                    {isDownloading && (
                        <View className="mb-4">
                            <View className="flex-row justify-between items-center mb-1.5">
                                <Text className="text-gray-700 font-bold text-xs">
                                    Downloading update...
                                </Text>
                                <Text className="text-red-700 font-black text-xs">
                                    {downloadProgress}%
                                </Text>
                            </View>
                            <View className="h-3 bg-gray-200 rounded-full overflow-hidden w-full">
                                <View
                                    className="h-full bg-red-700 rounded-full"
                                    style={{ width: `${Math.max(4, Math.min(100, downloadProgress))}%` }}
                                />
                            </View>
                            {totalExpectedBytes > 0 && (
                                <Text className="text-gray-400 text-[10px] text-right mt-1">
                                    {downloadedMbText} / {sizeMbText}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Error Notice */}
                    {errorMessage && (
                        <View className="bg-red-50 p-2.5 rounded-xl border border-red-200 mb-4">
                            <Text className="text-red-700 text-xs font-medium text-center">
                                {errorMessage}
                            </Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View className="gap-2">
                        {!isDownloading ? (
                            <>
                                <TouchableOpacity
                                    onPress={onUpdatePress}
                                    activeOpacity={0.8}
                                    className="bg-red-800 rounded-2xl py-3.5 items-center shadow-sm"
                                >
                                    <Text className="text-white font-bold text-sm">
                                        {downloadReady ? '✅ Update Ready — Install Now' : '⚡ Update & Install Now'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleOpenInBrowser}
                                    activeOpacity={0.7}
                                    className="bg-gray-100 rounded-2xl py-2.5 items-center border border-gray-200"
                                >
                                    <Text className="text-gray-700 font-semibold text-xs">
                                        🌐 Open Download Link in Browser
                                    </Text>
                                </TouchableOpacity>

                                {!isForced && (
                                    <TouchableOpacity
                                        onPress={onDismissPress}
                                        activeOpacity={0.7}
                                        className="py-2 items-center"
                                    >
                                        <Text className="text-gray-500 font-medium text-xs">
                                            Remind Me Later
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <View className="py-2 items-center">
                                <ActivityIndicator size="small" color="#991B1B" />
                                <Text className="text-gray-500 text-xs font-medium mt-1">
                                    Preparing installer...
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
