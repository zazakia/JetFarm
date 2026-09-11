import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';

export interface ProductCardProps {
    id: string;
    title: string;
    price: number;
    compareAtPrice?: number | null;
    storeName?: string;
    rating?: number;
    imageUrl?: string | null;
    productType?: string;
    onPress?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
    title,
    price,
    compareAtPrice,
    storeName,
    rating = 5.0,
    imageUrl,
    productType = 'physical',
    onPress,
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-3"
        >
            <View className="bg-slate-100 rounded-lg h-36 w-full items-center justify-center mb-2 overflow-hidden">
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <View className="items-center justify-center">
                        <Text className="text-slate-400 font-medium text-xs">
                            {productType.toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>

            {storeName && (
                <Text className="text-xs text-blue-600 font-semibold mb-1" numberOfLines={1}>
                    {storeName}
                </Text>
            )}

            <Text className="text-sm font-semibold text-slate-800 mb-1" numberOfLines={2}>
                {title}
            </Text>

            <View className="flex-row items-center justify-between mt-1">
                <View className="flex-row items-baseline">
                    <Text className="text-base font-bold text-emerald-600">
                        ₱{price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Text>
                    {compareAtPrice && compareAtPrice > price && (
                        <Text className="text-xs text-slate-400 line-through ml-1.5">
                            ₱{compareAtPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </Text>
                    )}
                </View>

                <View className="bg-amber-50 px-2 py-0.5 rounded-full flex-row items-center">
                    <Text className="text-amber-600 text-xs font-bold">★ {rating.toFixed(1)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default ProductCard;
