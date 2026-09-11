import React from 'react';
import { View, Text } from 'react-native';

export interface AccountHealthCardProps {
    cancellationRate?: number; // e.g. 0.01 (1%)
    lateShipmentRate?: number; // e.g. 0.02 (2%)
    defectRate?: number; // e.g. 0.00 (0%)
    overallHealth?: 'Excellent' | 'Good' | 'Warning' | 'At Risk';
}

export const AccountHealthCard: React.FC<AccountHealthCardProps> = ({
    cancellationRate = 0.00,
    lateShipmentRate = 0.01,
    defectRate = 0.00,
    overallHealth = 'Excellent',
}) => {
    const healthBadgeColor = overallHealth === 'Excellent' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';

    return (
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
            <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-bold text-slate-900">POS Cursor Seller Health</Text>
                <View className={`px-2.5 py-0.5 rounded-full ${healthBadgeColor.split(' ')[0]}`}>
                    <Text className={`text-xs font-bold ${healthBadgeColor.split(' ')[1]}`}>{overallHealth}</Text>
                </View>
            </View>

            <View className="flex-row justify-between bg-slate-50 rounded-xl p-3">
                <View className="items-center flex-1">
                    <Text className="text-xs text-slate-500 mb-1">Cancellation</Text>
                    <Text className="font-bold text-slate-800 text-sm">{(cancellationRate * 100).toFixed(1)}%</Text>
                </View>

                <View className="w-px bg-slate-200 h-full mx-2" />

                <View className="items-center flex-1">
                    <Text className="text-xs text-slate-500 mb-1">Late Dispatch</Text>
                    <Text className="font-bold text-slate-800 text-sm">{(lateShipmentRate * 100).toFixed(1)}%</Text>
                </View>

                <View className="w-px bg-slate-200 h-full mx-2" />

                <View className="items-center flex-1">
                    <Text className="text-xs text-slate-500 mb-1">Order Defects</Text>
                    <Text className="font-bold text-slate-800 text-sm">{(defectRate * 100).toFixed(1)}%</Text>
                </View>
            </View>
        </View>
    );
};

export default AccountHealthCard;
