import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Modal, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../src/database/supabase';
import { format } from 'date-fns';

interface StoreAudit {
    id: string;
    branch_id: string;
    audit_date: string;
    auditor_name: string;
    cleanliness_score: number;
    food_quality_score: number;
    staff_compliance_score: number;
    inventory_accuracy_score: number;
    overall_score: number;
    findings: string | null;
    action_items: string | null;
    status: string;
}

export default function StoreAuditsScreen() {
    const router = useRouter();
    const [audits, setAudits] = useState<StoreAudit[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    // Audit Form
    const [branchId, setBranchId] = useState('');
    const [auditorName, setAuditorName] = useState('');
    const [cleanliness, setCleanliness] = useState(5);
    const [foodQuality, setFoodQuality] = useState(5);
    const [staffCompliance, setStaffCompliance] = useState(5);
    const [inventoryAccuracy, setInventoryAccuracy] = useState(5);
    const [findings, setFindings] = useState('');
    const [actionItems, setActionItems] = useState('');

    const loadAudits = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('store_audits')
                .select('*')
                .order('audit_date', { ascending: false });

            if (error) {
                console.error('[Audits] Fetch error:', error.message);
            } else {
                setAudits(data || []);
            }
        } catch (err) {
            console.error('[Audits] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadAudits();
        }, [])
    );

    const handleSaveAudit = async () => {
        if (!branchId.trim() || !auditorName.trim()) {
            Alert.alert('Validation Error', 'Branch ID and Supervisor / Auditor Name are required.');
            return;
        }

        setSaving(true);
        try {
            const overall = ((cleanliness + foodQuality + staffCompliance + inventoryAccuracy) / 4);

            const newAudit = {
                branch_id: branchId.trim(),
                audit_date: new Date().toISOString().split('T')[0],
                auditor_name: auditorName.trim(),
                cleanliness_score: cleanliness,
                food_quality_score: foodQuality,
                staff_compliance_score: staffCompliance,
                inventory_accuracy_score: inventoryAccuracy,
                overall_score: parseFloat(overall.toFixed(1)),
                findings: findings.trim() || null,
                action_items: actionItems.trim() || null,
                status: 'open',
            };

            const { data, error } = await supabase
                .from('store_audits')
                .insert(newAudit)
                .select()
                .single();

            if (error) {
                Alert.alert('Database Error', error.message);
            } else {
                Alert.alert('Audit Saved', `Store audit for ${branchId} recorded successfully!`);
                setAudits(prev => [data, ...prev]);
                setModalVisible(false);
                setBranchId('');
                setFindings('');
                setActionItems('');
            }
        } finally {
            setSaving(false);
        }
    };

    const renderScoreSelector = (label: string, value: number, onChange: (v: number) => void) => (
        <View className="mb-3">
            <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-semibold text-gray-700">{label}</Text>
                <Text className="text-xs font-bold text-blue-900">{value} / 5</Text>
            </View>
            <View className="flex-row gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                    <Pressable
                        key={star}
                        onPress={() => onChange(star)}
                        className={`flex-1 py-2 rounded-lg items-center border ${
                            value === star
                                ? 'bg-blue-900 border-blue-900'
                                : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                        }`}
                    >
                        <Text className={`text-xs font-bold ${value === star ? 'text-white' : 'text-gray-700'}`}>
                            {star}★
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadAudits(); }} />}
        >
            <View className="p-6 max-w-6xl mx-auto w-full">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Text className="text-2xl font-bold text-gray-900">Branch Store Audits</Text>
                        <Text className="text-sm text-gray-500 mt-0.5">
                            Supervisor inspections, cleanliness & compliance scorecards
                        </Text>
                    </View>

                    <Pressable
                        onPress={() => setModalVisible(true)}
                        className="bg-blue-900 active:bg-blue-800 px-4 py-2.5 rounded-xl flex-row items-center shadow-sm"
                    >
                        <MaterialIcons name="rate-review" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text className="text-sm font-bold text-white">Record Audit</Text>
                    </Pressable>
                </View>

                {/* Audit Cards */}
                {loading ? (
                    <View className="py-16 items-center">
                        <ActivityIndicator size="large" color="#1E3A8A" />
                        <Text className="text-sm text-gray-500 mt-3 font-medium">Loading store inspections...</Text>
                    </View>
                ) : audits.length === 0 ? (
                    <View className="bg-white rounded-2xl p-12 border border-gray-200 items-center">
                        <MaterialIcons name="fact-check" size={48} color="#9CA3AF" />
                        <Text className="text-lg font-bold text-gray-800 mt-4">No Store Audits Logged</Text>
                        <Text className="text-sm text-gray-500 text-center mt-1 max-w-sm">
                            Area supervisors can record branch cleanliness, compliance, and food safety scores here.
                        </Text>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {audits.map(audit => (
                            <View key={audit.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                                <View className="flex-row flex-wrap items-start justify-between gap-4">
                                    <View>
                                        <View className="flex-row items-center gap-2">
                                            <Text className="text-base font-bold text-gray-900">
                                                Branch: {audit.branch_id}
                                            </Text>
                                            <View className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                <Text className="text-[10px] font-bold text-blue-900 uppercase">
                                                    {audit.status}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text className="text-xs text-gray-500 mt-0.5">
                                            Audited by: <Text className="font-semibold text-gray-800">{audit.auditor_name}</Text> • Date:{' '}
                                            {format(new Date(audit.audit_date), 'MMM dd, yyyy')}
                                        </Text>
                                    </View>

                                    {/* Overall Score Badge */}
                                    <View className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl items-center">
                                        <Text className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Overall Score</Text>
                                        <Text className="text-xl font-black text-emerald-700">{audit.overall_score} / 5.0</Text>
                                    </View>
                                </View>

                                {/* Scores Breakdown Grid */}
                                <View className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <View>
                                        <Text className="text-[11px] text-gray-500">Cleanliness</Text>
                                        <Text className="text-sm font-bold text-gray-900">{audit.cleanliness_score} / 5</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[11px] text-gray-500">Food Quality</Text>
                                        <Text className="text-sm font-bold text-gray-900">{audit.food_quality_score} / 5</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[11px] text-gray-500">Staff Compliance</Text>
                                        <Text className="text-sm font-bold text-gray-900">{audit.staff_compliance_score} / 5</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[11px] text-gray-500">Inventory Count</Text>
                                        <Text className="text-sm font-bold text-gray-900">{audit.inventory_accuracy_score} / 5</Text>
                                    </View>
                                </View>

                                {audit.findings && (
                                    <View className="mt-2">
                                        <Text className="text-xs font-semibold text-gray-700">Findings & Notes:</Text>
                                        <Text className="text-xs text-gray-600 mt-0.5">{audit.findings}</Text>
                                    </View>
                                )}

                                {audit.action_items && (
                                    <View className="mt-2">
                                        <Text className="text-xs font-semibold text-amber-800">Required Action Items:</Text>
                                        <Text className="text-xs text-amber-900 mt-0.5">{audit.action_items}</Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Record Audit Modal */}
                <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                    <View className="flex-1 bg-black/50 justify-center items-center p-4">
                        <View className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-xl max-h-[90vh]">
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="flex-row items-center justify-between mb-4">
                                    <Text className="text-lg font-bold text-gray-900">Conduct Store Audit</Text>
                                    <Pressable onPress={() => setModalVisible(false)}>
                                        <MaterialIcons name="close" size={22} color="#6B7280" />
                                    </Pressable>
                                </View>

                                <View className="space-y-3">
                                    <View>
                                        <Text className="text-xs font-semibold text-gray-700 mb-1">Branch Code</Text>
                                        <TextInput
                                            value={branchId}
                                            onChangeText={setBranchId}
                                            placeholder="e.g. CK-BAGACAY"
                                            placeholderTextColor="#9CA3AF"
                                            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                        />
                                    </View>

                                    <View>
                                        <Text className="text-xs font-semibold text-gray-700 mb-1">Auditor / Supervisor Name</Text>
                                        <TextInput
                                            value={auditorName}
                                            onChangeText={setAuditorName}
                                            placeholder="Your full name"
                                            placeholderTextColor="#9CA3AF"
                                            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                        />
                                    </View>

                                    <View className="pt-2">
                                        {renderScoreSelector('Cleanliness & Sanitation', cleanliness, setCleanliness)}
                                        {renderScoreSelector('Food Preparation & Quality', foodQuality, setFoodQuality)}
                                        {renderScoreSelector('Staff SOP Compliance', staffCompliance, setStaffCompliance)}
                                        {renderScoreSelector('Inventory Count Accuracy', inventoryAccuracy, setInventoryAccuracy)}
                                    </View>

                                    <View>
                                        <Text className="text-xs font-semibold text-gray-700 mb-1">Inspection Findings</Text>
                                        <TextInput
                                            value={findings}
                                            onChangeText={setFindings}
                                            multiline
                                            numberOfLines={3}
                                            placeholder="Describe observations, store condition..."
                                            placeholderTextColor="#9CA3AF"
                                            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50 text-top"
                                        />
                                    </View>

                                    <View>
                                        <Text className="text-xs font-semibold text-gray-700 mb-1">Corrective Actions Required</Text>
                                        <TextInput
                                            value={actionItems}
                                            onChangeText={setActionItems}
                                            multiline
                                            numberOfLines={2}
                                            placeholder="Steps for crew before next visit..."
                                            placeholderTextColor="#9CA3AF"
                                            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50 text-top"
                                        />
                                    </View>
                                </View>

                                <View className="flex-row gap-3 mt-6">
                                    <Pressable
                                        onPress={() => setModalVisible(false)}
                                        className="flex-1 py-3 rounded-xl bg-gray-100 active:bg-gray-200 items-center"
                                    >
                                        <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={handleSaveAudit}
                                        disabled={saving}
                                        className="flex-1 py-3 rounded-xl bg-blue-900 active:bg-blue-800 items-center flex-row justify-center"
                                    >
                                        {saving ? (
                                            <ActivityIndicator color="#FFFFFF" size="small" />
                                        ) : (
                                            <Text className="text-sm font-bold text-white">Save Audit</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        </ScrollView>
    );
}
