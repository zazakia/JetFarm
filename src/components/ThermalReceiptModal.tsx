import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../utils/currency';

interface ThermalReceiptModalProps {
    visible: boolean;
    onClose: () => void;
    receiptData: {
        orNumber: string;
        borrowerName: string;
        loanCode?: string;
        date: string;
        amountPaid: number;
        principalPaid: number;
        interestPaid: number;
        penaltyPaid?: number;
        collectorName?: string;
        paymentMethod?: string;
    } | null;
}

export function ThermalReceiptModal({ visible, onClose, receiptData }: ThermalReceiptModalProps) {
    if (!receiptData) return null;

    const handlePrint = () => {
        Alert.alert('Printing Receipt', `Sent receipt ${receiptData.orNumber} to ESC/POS Thermal Printer via Print Service.`);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-center items-center bg-black/60 p-4">
                <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                    {/* Header Controls */}
                    <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-gray-100">
                        <View className="flex-row items-center">
                            <MaterialIcons name="receipt" size={22} color="#1E3A8A" className="mr-2" />
                            <Text className="text-base font-bold text-gray-900 ml-2">Thermal Receipt Preview</Text>
                        </View>
                        <Pressable onPress={onClose} className="p-1 rounded-full active:bg-gray-100">
                            <MaterialIcons name="close" size={22} color="#64748B" />
                        </Pressable>
                    </View>

                    {/* Monospace 58mm Receipt Card */}
                    <ScrollView className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 mb-4">
                        <View className="items-center mb-3">
                            <Text className="text-sm font-black text-gray-900 tracking-wider">POSCURSOR COOPERATIVE</Text>
                            <Text className="text-[10px] text-gray-600 font-mono">Microfinance & Lending System</Text>
                            <Text className="text-[10px] text-gray-500 font-mono">Official Collection Receipt</Text>
                            <Text className="text-[11px] font-bold text-gray-800 font-mono mt-1">OR #: {receiptData.orNumber}</Text>
                        </View>

                        <Text className="text-[10px] text-gray-400 text-center font-mono mb-2">----------------------------------------</Text>

                        <View className="space-y-1 font-mono text-xs text-gray-800">
                            <View className="flex-row justify-between">
                                <Text className="text-[11px] text-gray-500 font-mono">Date:</Text>
                                <Text className="text-[11px] font-bold text-gray-900 font-mono">{receiptData.date}</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-[11px] text-gray-500 font-mono">Member:</Text>
                                <Text className="text-[11px] font-bold text-gray-900 font-mono">{receiptData.borrowerName}</Text>
                            </View>
                            {receiptData.loanCode && (
                                <View className="flex-row justify-between">
                                    <Text className="text-[11px] text-gray-500 font-mono">Loan Code:</Text>
                                    <Text className="text-[11px] font-bold text-gray-900 font-mono">{receiptData.loanCode}</Text>
                                </View>
                            )}
                            <View className="flex-row justify-between">
                                <Text className="text-[11px] text-gray-500 font-mono">Mode:</Text>
                                <Text className="text-[11px] font-bold text-gray-900 font-mono">{receiptData.paymentMethod || 'Cash'}</Text>
                            </View>
                        </View>

                        <Text className="text-[10px] text-gray-400 text-center font-mono my-2">----------------------------------------</Text>

                        <View className="space-y-1">
                            <View className="flex-row justify-between">
                                <Text className="text-[11px] text-gray-600 font-mono">Principal Portion:</Text>
                                <Text className="text-[11px] font-semibold text-gray-900 font-mono">{formatPHP(receiptData.principalPaid)}</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-[11px] text-gray-600 font-mono">Interest Portion:</Text>
                                <Text className="text-[11px] font-semibold text-gray-900 font-mono">{formatPHP(receiptData.interestPaid)}</Text>
                            </View>
                            {receiptData.penaltyPaid && receiptData.penaltyPaid > 0 ? (
                                <View className="flex-row justify-between">
                                    <Text className="text-[11px] text-red-600 font-mono">Penalty Fee:</Text>
                                    <Text className="text-[11px] font-bold text-red-700 font-mono">{formatPHP(receiptData.penaltyPaid)}</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text className="text-[10px] text-gray-400 text-center font-mono my-2">========================================</Text>

                        <View className="flex-row justify-between items-center py-1">
                            <Text className="text-xs font-black text-gray-900 font-mono uppercase">TOTAL RECEIVED:</Text>
                            <Text className="text-base font-black text-emerald-800 font-mono">{formatPHP(receiptData.amountPaid)}</Text>
                        </View>

                        <Text className="text-[10px] text-gray-400 text-center font-mono my-2">----------------------------------------</Text>

                        <View className="items-center mt-2">
                            <Text className="text-[10px] text-gray-500 font-mono">Collector: {receiptData.collectorName || 'Main Office'}</Text>
                            <Text className="text-[9px] text-gray-400 font-mono mt-1">Thank you for your prompt payment!</Text>
                        </View>
                    </ScrollView>

                    {/* Action Buttons */}
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={onClose}
                            className="flex-1 bg-gray-100 py-3 rounded-xl items-center active:bg-gray-200"
                        >
                            <Text className="text-gray-700 font-bold text-sm">Close</Text>
                        </Pressable>
                        <Pressable
                            onPress={handlePrint}
                            className="flex-1 bg-blue-900 py-3 rounded-xl items-center flex-row justify-center active:bg-blue-950 shadow-sm"
                        >
                            <MaterialIcons name="print" size={18} color="#FFFFFF" className="mr-1.5" />
                            <Text className="text-white font-bold text-sm ml-1">Print Thermal</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
