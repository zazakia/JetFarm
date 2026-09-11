import React from 'react';
import { View, Text } from 'react-native';

export interface CartStoreGroup {
    storeId: string;
    storeName: string;
    items: {
        title: string;
        quantity: number;
        unitPrice: number;
    }[];
}

export interface MultiSellerCartSummaryProps {
    groups: CartStoreGroup[];
    commissionRate?: number;
}

export const MultiSellerCartSummary: React.FC<MultiSellerCartSummaryProps> = ({
    groups,
    commissionRate = 0.035,
}) => {
    let grandTotal = 0;
    let totalCommission = 0;

    return (
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
            <Text className="text-base font-bold text-slate-900 mb-3">Order Breakdown by Store</Text>

            {groups.map((group, idx) => {
                const storeSubtotal = group.items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
                const storeCommission = storeSubtotal * commissionRate;
                grandTotal += storeSubtotal;
                totalCommission += storeCommission;

                return (
                    <View key={group.storeId || idx} className="border-b border-slate-100 pb-3 mb-3">
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-sm font-bold text-blue-700">{group.storeName}</Text>
                            <Text className="text-xs font-semibold text-slate-500">Sub-Order #{idx + 1}</Text>
                        </View>

                        {group.items.map((item, iIdx) => (
                            <View key={iIdx} className="flex-row justify-between items-center py-1">
                                <Text className="text-xs text-slate-700 flex-1 mr-2" numberOfLines={1}>
                                    {item.quantity}x {item.title}
                                </Text>
                                <Text className="text-xs font-semibold text-slate-800">
                                    ₱{(item.unitPrice * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </Text>
                            </View>
                        ))}

                        <View className="flex-row justify-between items-center mt-2 pt-1 border-t border-dashed border-slate-200">
                            <Text className="text-xs text-slate-500">Store Subtotal</Text>
                            <Text className="text-xs font-bold text-slate-900">
                                ₱{storeSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>
                    </View>
                );
            })}

            <View className="pt-2">
                <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-xs text-slate-500">Coop Platform Fee (Included)</Text>
                    <Text className="text-xs font-semibold text-emerald-600">
                        ₱{totalCommission.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Text>
                </View>
                <View className="flex-row justify-between items-center pt-2 border-t border-slate-200">
                    <Text className="text-base font-bold text-slate-900">Grand Total</Text>
                    <Text className="text-lg font-bold text-emerald-600">
                        ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default MultiSellerCartSummary;
