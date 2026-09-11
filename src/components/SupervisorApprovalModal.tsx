import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupervisorApprovalService, SupervisorInfo } from '../services/SupervisorApprovalService';

interface SupervisorApprovalModalProps {
    visible: boolean;
    onClose: () => void;
    onApproved: (result: { supervisorId: string; supervisorName: string }) => void;
    branchId: string;
    actionTitle: string;
    actionDescription?: string;
}

export function SupervisorApprovalModal({
    visible,
    onClose,
    onApproved,
    branchId,
    actionTitle,
    actionDescription,
}: SupervisorApprovalModalProps) {
    const [supervisors, setSupervisors] = useState<SupervisorInfo[]>([]);
    const [selectedSupervisor, setSelectedSupervisor] = useState<SupervisorInfo | null>(null);
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setPin('');
            setError(null);
            loadSupervisors();
        }
    }, [visible, branchId]);

    const loadSupervisors = async () => {
        setLoading(true);
        try {
            const list = await SupervisorApprovalService.getEligibleSupervisors(branchId);
            setSupervisors(list);
            if (list.length > 0) {
                setSelectedSupervisor(list[0]);
            } else {
                setSelectedSupervisor(null);
            }
        } catch (err) {
            console.warn('[SupervisorApprovalModal] Error loading supervisors:', err);
            setSelectedSupervisor(null);
        } finally {
            setLoading(false);
        }
    };

    const handleAuthorize = async () => {
        if (!selectedSupervisor) {
            setError('Please select an authorized supervisor.');
            return;
        }

        if (!pin.trim()) {
            setError('Please enter supervisor PIN.');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const validation = await SupervisorApprovalService.validateApproval({
                supervisor: selectedSupervisor,
                targetBranchId: branchId,
                pin: pin.trim(),
                actionType: actionTitle,
            });

            if (!validation.authorized) {
                setError(validation.error || 'Authorization denied.');
                setSubmitting(false);
                return;
            }

            onApproved({
                supervisorId: validation.supervisorId || selectedSupervisor.id || 'supervisor',
                supervisorName: validation.supervisorName || selectedSupervisor.fullName || 'Supervisor',
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Authorization failed.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-center items-center bg-black/60 p-4">
                <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                    {/* Header */}
                    <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-slate-100">
                        <View className="flex-row items-center">
                            <View className="w-9 h-9 rounded-xl bg-amber-100 items-center justify-center mr-2.5">
                                <Ionicons name="shield-checkmark" size={20} color="#b45309" />
                            </View>
                            <View>
                                <Text className="text-base font-black text-slate-900">Supervisor Override</Text>
                                <Text className="text-[11px] font-semibold text-amber-700">Approval Required</Text>
                            </View>
                        </View>
                        <Pressable onPress={onClose} className="p-1 rounded-full active:bg-slate-100">
                            <Ionicons name="close" size={20} color="#64748b" />
                        </Pressable>
                    </View>

                    {/* Action Context Box */}
                    <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-4">
                        <Text className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            {actionTitle}
                        </Text>
                        {actionDescription ? (
                            <Text className="text-xs text-slate-600 mt-0.5">{actionDescription}</Text>
                        ) : null}
                        <View className="flex-row items-center mt-2 pt-2 border-t border-slate-200">
                            <Ionicons name="business" size={14} color="#64748b" />
                            <Text className="text-xs text-slate-700 font-medium ml-1.5">
                                Branch: {branchId || 'Bagacay'}
                            </Text>
                        </View>
                    </View>

                    {/* Supervisor Selection */}
                    <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Authorizing Supervisor
                    </Text>
                    {loading ? (
                        <ActivityIndicator size="small" color="#047857" className="py-2" />
                    ) : (
                        <ScrollView className="max-h-28 mb-3" nestedScrollEnabled>
                            {supervisors.map((sup, idx) => {
                                const isSelected = selectedSupervisor?.id === sup.id;
                                return (
                                    <Pressable
                                        key={sup.id || idx}
                                        onPress={() => {
                                            setSelectedSupervisor(sup);
                                            setError(null);
                                        }}
                                        className={`p-2.5 rounded-xl border mb-1.5 flex-row items-center justify-between ${
                                            isSelected
                                                ? 'bg-amber-50 border-amber-500'
                                                : 'bg-white border-slate-200'
                                        }`}
                                    >
                                        <View className="flex-1 mr-2">
                                            <Text
                                                className={`text-xs font-bold ${
                                                    isSelected ? 'text-amber-900' : 'text-slate-800'
                                                }`}
                                                numberOfLines={1}
                                            >
                                                {sup.fullName || 'Authorized Supervisor'}
                                            </Text>
                                            <Text className="text-[10px] text-slate-500 capitalize">
                                                {sup.role ? sup.role.replace('_', ' ') : 'Manager'}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color="#b45309" />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* PIN Input */}
                    <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Supervisor PIN
                    </Text>
                    <TextInput
                        value={pin}
                        onChangeText={(val) => {
                            setPin(val);
                            if (error) setError(null);
                        }}
                        keyboardType="numeric"
                        secureTextEntry
                        maxLength={6}
                        placeholder="Enter 4-digit PIN"
                        placeholderTextColor="#9CA3AF"
                        className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-base font-bold mb-2 tracking-widest text-center"
                    />

                    {/* No Supervisor Available Notice */}
                    {!loading && supervisors.length === 0 && (
                        <View className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3 flex-row items-center">
                            <Ionicons name="warning" size={16} color="#d97706" />
                            <Text className="text-amber-800 text-xs font-medium ml-1.5 flex-1">
                                No supervisor profile found on this device. Please sync staff data.
                            </Text>
                        </View>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <View className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 mb-3 flex-row items-center">
                            <Ionicons name="alert-circle" size={16} color="#e11d48" />
                            <Text className="text-rose-700 text-xs font-bold ml-1.5 flex-1">{error}</Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View className="flex-row justify-between space-x-2 pt-1">
                        <Pressable
                            onPress={onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-100 active:bg-slate-200 items-center justify-center mr-2"
                        >
                            <Text className="text-slate-700 text-xs font-bold uppercase tracking-wider">
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleAuthorize}
                            disabled={submitting}
                            className={`flex-1 py-3 rounded-xl items-center justify-center ${
                                submitting ? 'bg-amber-400' : 'bg-amber-600 active:bg-amber-700'
                            }`}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text className="text-white text-xs font-black uppercase tracking-wider">
                                    Authorize
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
