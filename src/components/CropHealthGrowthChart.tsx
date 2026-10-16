import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

export interface GrowthCheckinItem {
    id?: string;
    stage: string; // land_prep, germination, vegetative, root_bulking, maturity
    healthStatus: string; // excellent, good, fair, pest_risk, diseased
    plantHeightCm?: number | null;
    checkinDate?: Date | string;
    notes?: string | null;
}

export interface CropHealthGrowthChartProps {
    checkins: GrowthCheckinItem[];
    currentStage?: string;
    variety?: string;
}

export const STAGES_METADATA = [
    { id: 'land_prep', label: 'Land Prep', month: 'Mo 0', benchmarkHeight: '0 cm' },
    { id: 'germination', label: 'Germination', month: 'Mo 1', benchmarkHeight: '20-30 cm' },
    { id: 'vegetative', label: 'Vegetative', month: 'Mo 2-4', benchmarkHeight: '80-120 cm' },
    { id: 'root_bulking', label: 'Root Bulking', month: 'Mo 5-7', benchmarkHeight: '150-180 cm' },
    { id: 'maturity', label: 'Maturity', month: 'Mo 8-9', benchmarkHeight: '200+ cm' },
];

export const HEALTH_LEVELS = [
    { score: 5, status: 'excellent', label: 'Excellent', color: '#047857', bgTailwind: 'bg-emerald-100 text-emerald-800' },
    { score: 4, status: 'good', label: 'Good', color: '#0284C7', bgTailwind: 'bg-sky-100 text-sky-800' },
    { score: 3, status: 'fair', label: 'Fair', color: '#D97706', bgTailwind: 'bg-amber-100 text-amber-800' },
    { score: 2, status: 'pest_risk', label: 'Pest Risk', color: '#EA580C', bgTailwind: 'bg-orange-100 text-orange-800' },
    { score: 1, status: 'diseased', label: 'Diseased', color: '#DC2626', bgTailwind: 'bg-rose-100 text-rose-800' },
];

export function parseHealthScore(healthStatus?: string): number {
    switch ((healthStatus || '').toLowerCase()) {
        case 'excellent': return 5;
        case 'good': return 4;
        case 'fair': return 3;
        case 'pest_risk': return 2;
        case 'diseased': return 1;
        default: return 3;
    }
}

export function getHealthLevel(scoreOrStatus: number | string) {
    if (typeof scoreOrStatus === 'number') {
        return HEALTH_LEVELS.find(h => h.score === scoreOrStatus) || HEALTH_LEVELS[2];
    }
    const score = parseHealthScore(scoreOrStatus);
    return HEALTH_LEVELS.find(h => h.score === score) || HEALTH_LEVELS[2];
}

export function CropHealthGrowthChart({
    checkins = [],
    currentStage,
    variety = 'Golden Yellow',
}: CropHealthGrowthChartProps) {
    const width = 360;
    const height = 160;
    const paddingLeft = 40;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Map latest checkin per stage
    const stageCheckinMap = new Map<string, GrowthCheckinItem>();
    for (const c of checkins) {
        stageCheckinMap.set(c.stage, c);
    }

    // Compute coordinates for each stage
    const points = STAGES_METADATA.map((stage, index) => {
        const x = paddingLeft + (index / (STAGES_METADATA.length - 1)) * chartWidth;
        const checkin = stageCheckinMap.get(stage.id);
        const score = checkin ? parseHealthScore(checkin.healthStatus) : null;
        // score 1..5 mapped to chartHeight..0
        const y = score !== null
            ? paddingTop + chartHeight - ((score - 1) / 4) * chartHeight
            : null;

        return {
            stage,
            checkin,
            score,
            x,
            y,
        };
    });

    // Create SVG path for plotted points
    const plottedPoints = points.filter(p => p.y !== null) as Array<{
        stage: typeof STAGES_METADATA[0];
        checkin: GrowthCheckinItem;
        score: number;
        x: number;
        y: number;
    }>;

    let pathD = '';
    let areaD = '';
    if (plottedPoints.length > 0) {
        pathD = `M ${plottedPoints[0].x} ${plottedPoints[0].y}`;
        for (let i = 1; i < plottedPoints.length; i++) {
            pathD += ` L ${plottedPoints[i].x} ${plottedPoints[i].y}`;
        }

        // Fill area underneath path down to baseline
        const baselineY = paddingTop + chartHeight;
        areaD = `${pathD} L ${plottedPoints[plottedPoints.length - 1].x} ${baselineY} L ${plottedPoints[0].x} ${baselineY} Z`;
    }

    return (
        <View testID="crop-health-growth-chart" className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mt-3">
            <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-2">
                    <MaterialIcons name="show-chart" size={20} color="#047857" />
                    <Text className="text-sm font-black text-gray-900">
                        Crop Health Trajectory ({variety} Cassava)
                    </Text>
                </View>
                <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-emerald-800 uppercase">
                        {plottedPoints.length} / 5 Stages Evaluated
                    </Text>
                </View>
            </View>

            <Text className="text-xs text-gray-500 mb-3">
                Crop health status progression monitored per 9-month Cassava growth stage
            </Text>

            {/* SVG Line Graph */}
            <View className="items-center justify-center my-1 overflow-hidden">
                <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
                    {/* Background Grid Lines */}
                    {[5, 4, 3, 2, 1].map(score => {
                        const y = paddingTop + chartHeight - ((score - 1) / 4) * chartHeight;
                        return (
                            <G key={`grid-${score}`}>
                                <Line
                                    x1={paddingLeft}
                                    y1={y}
                                    x2={width - paddingRight}
                                    y2={y}
                                    stroke="#E5E7EB"
                                    strokeWidth={1}
                                    strokeDasharray="4, 4"
                                />
                            </G>
                        );
                    })}

                    {/* Area under curve */}
                    {areaD ? (
                        <Path d={areaD} fill="#047857" fillOpacity={0.12} />
                    ) : null}

                    {/* Connecting line */}
                    {pathD ? (
                        <Path
                            d={pathD}
                            stroke="#047857"
                            strokeWidth={3}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ) : null}

                    {/* Stage milestone vertical ticks and points */}
                    {points.map((pt, idx) => {
                        const isRecorded = pt.y !== null;
                        const baselineY = paddingTop + chartHeight;
                        const level = isRecorded ? getHealthLevel(pt.score!) : null;

                        return (
                            <G key={`pt-${idx}`}>
                                {/* Vertical guideline */}
                                <Line
                                    x1={pt.x}
                                    y1={paddingTop}
                                    x2={pt.x}
                                    y2={baselineY}
                                    stroke="#F3F4F6"
                                    strokeWidth={1}
                                />

                                {isRecorded ? (
                                    <>
                                        {/* Outer pulse */}
                                        <Circle
                                            cx={pt.x}
                                            cy={pt.y!}
                                            r={7}
                                            fill={level!.color}
                                            fillOpacity={0.25}
                                        />
                                        {/* Outer ring */}
                                        <Circle
                                            cx={pt.x}
                                            cy={pt.y!}
                                            r={5}
                                            fill={level!.color}
                                        />
                                        {/* Center white core */}
                                        <Circle
                                            cx={pt.x}
                                            cy={pt.y!}
                                            r={2.5}
                                            fill="#FFFFFF"
                                        />
                                    </>
                                ) : (
                                    /* Future / unrecorded stage dot */
                                    <Circle
                                        cx={pt.x}
                                        cy={baselineY}
                                        r={3}
                                        fill="#D1D5DB"
                                    />
                                )}
                            </G>
                        );
                    })}
                </Svg>
            </View>

            {/* Stage Milestone Strip */}
            <View className="flex-row justify-between items-start mt-2 pt-2 border-t border-gray-100">
                {points.map(({ stage, checkin, score }) => {
                    const isRecorded = checkin !== undefined;
                    const level = isRecorded ? getHealthLevel(score!) : null;
                    const isCurrent = currentStage === stage.id;

                    return (
                        <View key={stage.id} className="flex-1 items-center px-0.5">
                            <Text
                                className={`text-[10px] text-center font-bold ${
                                    isCurrent ? 'text-emerald-800' : 'text-gray-700'
                                }`}
                                numberOfLines={1}
                            >
                                {stage.label}
                            </Text>
                            <Text className="text-[9px] text-gray-400 mt-0.5">{stage.month}</Text>

                            {isRecorded ? (
                                <View
                                    className="mt-1 px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: `${level!.color}20` }}
                                >
                                    <Text
                                        className="text-[8px] font-bold uppercase"
                                        style={{ color: level!.color }}
                                    >
                                        {level!.label}
                                    </Text>
                                </View>
                            ) : (
                                <Text className="text-[8px] text-gray-300 mt-1 uppercase font-semibold">
                                    Pending
                                </Text>
                            )}

                            {checkin?.plantHeightCm ? (
                                <Text className="text-[9px] text-gray-500 font-medium mt-0.5">
                                    {checkin.plantHeightCm} cm
                                </Text>
                            ) : null}
                        </View>
                    );
                })}
            </View>

            {plottedPoints.length === 0 && (
                <View className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-3 flex-row items-center gap-2">
                    <MaterialIcons name="info-outline" size={16} color="#D97706" />
                    <Text className="text-amber-800 text-xs flex-1">
                        Awaiting growth stage check-ins. Click "Record Growth Checkin" above to log stage observations and plot health metrics.
                    </Text>
                </View>
            )}
        </View>
    );
}

export default CropHealthGrowthChart;
