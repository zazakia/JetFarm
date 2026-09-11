import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

interface ChartData {
    label: string;
    value: number;
}

interface LendingPerformanceChartProps {
    data: ChartData[];
    title: string;
    subtitle?: string;
}

export function LendingPerformanceChart({ data, title, subtitle }: LendingPerformanceChartProps) {
    const screenWidth = Dimensions.get('window').width - 48; // Padding

    const chartData = {
        labels: data.map(d => d.label),
        datasets: [
            {
                data: data.map(d => d.value),
            },
        ],
    };

    const chartConfig = {
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        color: (opacity = 1) => `rgba(30, 58, 95, ${opacity})`, // Indigo-900 (matches header)
        strokeWidth: 3,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
        decimalPlaces: 0,
        labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Slate-500
        propsForVerticalLabels: {
            fontSize: 10,
            fontWeight: '900',
        },
        propsForHorizontalLabels: {
            fontSize: 10,
            fontWeight: '900',
        },
        fillShadowGradient: '#3B82F6', // Blue-500
        fillShadowGradientOpacity: 1,
        style: {
            borderRadius: 16,
        },
        propsForBackgroundLines: {
            strokeDasharray: '', // solid background lines
            strokeWidth: 1,
            stroke: '#F1F5F9',
        },
    };

    return (
        <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
            <View className="mb-4">
                <Text className="text-gray-900 font-black text-xl">{title}</Text>
                {!!subtitle && <Text className="text-gray-700 text-xs font-bold mt-1 uppercase tracking-wider">{subtitle}</Text>}
            </View>

            <View className="items-center justify-center -ml-4">
                <BarChart
                    data={chartData}
                    width={screenWidth}
                    height={220}
                    yAxisLabel="PHP "
                    yAxisSuffix=""
                    chartConfig={chartConfig}
                    verticalLabelRotation={0}
                    fromZero={true}
                    showValuesOnTopOfBars={false}
                    withInnerLines={true}
                    segments={4}
                    style={{
                        marginVertical: 8,
                        borderRadius: 16,
                    }}
                />
            </View>
        </View>
    );
}
