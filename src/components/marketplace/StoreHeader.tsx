import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';

export interface StoreHeaderProps {
    name: string;
    description?: string | null;
    category?: string | null;
    rating?: number;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    holidayMode?: boolean;
    onContactSeller?: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
    name,
    description,
    category,
    rating = 5.0,
    logoUrl,
    bannerUrl,
    holidayMode = false,
    onContactSeller,
}) => {
    return (
        <View className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
            <View className="h-24 bg-blue-900 w-full relative">
                {bannerUrl && <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />}
            </View>

            <View className="p-4 pt-0">
                <View className="flex-row items-end justify-between -mt-8 mb-3">
                    <View className="w-16 h-16 rounded-xl bg-white border-2 border-white shadow-sm overflow-hidden items-center justify-center">
                        {logoUrl ? (
                            <Image source={{ uri: logoUrl }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <View className="w-full h-full bg-blue-100 items-center justify-center">
                                <Text className="text-blue-800 font-bold text-xl">{name.charAt(0)}</Text>
                            </View>
                        )}
                    </View>

                    {holidayMode ? (
                        <View className="bg-amber-100 px-3 py-1 rounded-full">
                            <Text className="text-amber-800 text-xs font-semibold">Vacation Mode</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={onContactSeller}
                            className="bg-blue-600 px-3 py-1.5 rounded-lg active:opacity-80"
                        >
                            <Text className="text-white text-xs font-semibold">Chat Seller</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-lg font-bold text-slate-900">{name}</Text>
                    <View className="bg-emerald-50 px-2 py-0.5 rounded-md">
                        <Text className="text-emerald-700 font-bold text-xs">Verified Member Store</Text>
                    </View>
                </View>

                {category && (
                    <Text className="text-xs text-blue-600 font-medium mb-1.5">{category}</Text>
                )}

                {description && (
                    <Text className="text-xs text-slate-600 mb-2">{description}</Text>
                )}

                <View className="flex-row items-center border-t border-slate-100 pt-2.5 mt-1">
                    <Text className="text-amber-500 font-bold text-xs mr-3">
                        ★ {rating.toFixed(1)} Rating
                    </Text>
                    <Text className="text-slate-400 text-xs">• 100% On-time Fulfillment</Text>
                </View>
            </View>
        </View>
    );
};

export default StoreHeader;
