import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    Image,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { SettingsService } from '../../../src/services/SettingsService';
import Toast from '../../../src/components/AppToast';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';
import { setBrandData } from '../../../src/constants/brand';
import { setLogoBase64, logoBase64 as defaultLogo } from '../../../src/utils/logoBase64';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function UiBrandingSettingsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    
    const [companyName, setCompanyName] = useState('Agri-One');
    const [companyNameFull, setCompanyNameFull] = useState('Agri-One');
    const [customLogo, setCustomLogo] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const name = await SettingsService.getAppSetting('brand.company_name', 'Agri-One');
                const fullName = await SettingsService.getAppSetting('brand.company_name_full', 'Agri-One');
                const logo = await SettingsService.getAppSetting('brand.logo_base64', '');
                
                setCompanyName(name);
                setCompanyNameFull(fullName);
                setCustomLogo(logo);
            } catch (error) {
                console.error('[UiBrandingSettings] Failed to load settings:', error);
                Alert.alert('Load Error', 'Unable to retrieve branding settings.');
            } finally {
                setLoading(false);
            }
        };
        void loadSettings();
    }, []);

    const handlePickLogo = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const asset = result.assets[0];
            const mimeType = asset.mimeType?.toLowerCase();
            const fileSize = asset.size ?? (Platform.OS === 'web' ? (asset as any).file?.size : undefined);

            if (!mimeType || !SUPPORTED_LOGO_MIME_TYPES.has(mimeType)) {
                Alert.alert('Unsupported Logo', 'Choose a PNG, JPEG, or WebP image.');
                return;
            }

            if (!Number.isFinite(fileSize) || fileSize! > MAX_LOGO_SIZE_BYTES) {
                Alert.alert('Logo Too Large', 'Choose an image smaller than 2 MB.');
                return;
            }

            const fileUri = asset.uri;
            let base64String = '';

            if (Platform.OS === 'web') {
                const fileObj = (asset as any).file;
                if (fileObj) {
                    base64String = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = (e) => reject(e);
                        reader.readAsDataURL(fileObj);
                    });
                } else {
                    throw new Error('The selected web image could not be read.');
                }
            } else {
                const base64Data = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: 'base64',
                });
                base64String = `data:${mimeType};base64,${base64Data}`;
            }

            setCustomLogo(base64String);
            Toast.show({
                type: 'success',
                text1: 'Logo Selected',
                text2: 'Click Save to apply branding.'
            });
        } catch (error: any) {
            console.error('Failed to pick logo:', error);
            Alert.alert('Error', 'Failed to read image file.');
        }
    };

    const handleResetLogo = () => {
        setCustomLogo('');
        Toast.show({
            type: 'info',
            text1: 'Logo Reset',
            text2: 'Click Save to restore default logo.'
        });
    };

    const handleSave = async () => {
        if (!companyName.trim()) {
            Alert.alert('Validation Error', 'Company Name cannot be empty.');
            return;
        }
        if (!companyNameFull.trim()) {
            Alert.alert('Validation Error', 'Full Company Name cannot be empty.');
            return;
        }

        setSaving(true);
        try {
            await SettingsService.setAppSetting('brand.company_name', companyName.trim(), user?.id);
            await SettingsService.setAppSetting('brand.company_name_full', companyNameFull.trim(), user?.id);
            await SettingsService.setAppSetting('brand.logo_base64', customLogo, user?.id);

            // Update in-memory bindings immediately
            setBrandData(companyName.trim(), companyNameFull.trim());
            setLogoBase64(customLogo || defaultLogo);

            Toast.show({
                type: 'success',
                text1: 'Settings Saved',
                text2: 'Branding options updated successfully.'
            });
            
            // Navigate back
            setTimeout(() => {
                safeBack(router, '/(admin)/settings');
            }, 1000);
        } catch (error: any) {
            console.error('[UiBrandingSettings] Save failed:', error);
            Alert.alert('Save Failed', error?.message || 'Unable to update branding settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-gray-50 justify-center items-center">
                <ActivityIndicator size="large" color="#1E3A8A" />
                <Text className="text-gray-700 mt-2 font-medium">Loading settings...</Text>
            </View>
        );
    }

    const currentLogoToShow = customLogo || defaultLogo;

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/settings')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">UI Module Settings</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Customize system branding and logo</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                {/* Branding Form */}
                <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-6 gap-y-4">
                    <Text className="text-gray-900 font-black text-base mb-2">Company Information</Text>

                    <View className="gap-y-1">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">Company Short Name</Text>
                        <TextInput
                            value={companyName}
                            onChangeText={setCompanyName}
                            placeholder="e.g. POS Cursor"
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-blue-900"
                         placeholderTextColor="#9CA3AF"/>
                    </View>

                    <View className="gap-y-1">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">Full Company Name</Text>
                        <TextInput
                            value={companyNameFull}
                            onChangeText={setCompanyNameFull}
                            placeholder="e.g. POS Cursor"
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-blue-900"
                         placeholderTextColor="#9CA3AF"/>
                    </View>
                </View>

                {/* Logo Customization */}
                <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-6 flex-col items-center">
                    <Text className="text-gray-900 font-black text-base mb-4 self-start">Cooperative Logo</Text>
                    
                    <View className="w-32 h-32 rounded-3xl bg-gray-50 border border-gray-250 items-center justify-center p-3 mb-4 shadow-sm overflow-hidden">
                        {currentLogoToShow ? (
                            <Image
                                source={{ uri: currentLogoToShow }}
                                className="w-full h-full"
                                resizeMode="contain"
                            />
                        ) : (
                            <MaterialIcons name="image" size={48} color="#9CA3AF" />
                        )}
                    </View>

                    <View className="flex-row gap-x-3 w-full">
                        <Pressable
                            onPress={handlePickLogo}
                            className="flex-1 bg-blue-900 py-3 rounded-xl items-center flex-row justify-center active:bg-blue-800"
                        >
                            <MaterialIcons name="file-upload" size={18} color="white" className="mr-1" />
                            <Text className="text-white font-bold text-xs uppercase tracking-wider">Change Logo</Text>
                        </Pressable>

                        <Pressable
                            onPress={handleResetLogo}
                            className="flex-1 bg-red-50 border border-red-150 py-3 rounded-xl items-center flex-row justify-center active:bg-red-100"
                        >
                            <MaterialIcons name="refresh" size={18} color="#B91C1C" className="mr-1" />
                            <Text className="text-red-700 font-bold text-xs uppercase tracking-wider">Reset</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Action Buttons */}
                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center bg-blue-900 active:bg-blue-800 shadow-md ${saving ? 'opacity-50' : ''}`}
                >
                    {saving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <MaterialIcons name="save" size={20} color="white" className="mr-2" />
                            <Text className="text-white font-black uppercase tracking-widest text-sm">Save Branding Settings</Text>
                        </>
                    )}
                </Pressable>

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
