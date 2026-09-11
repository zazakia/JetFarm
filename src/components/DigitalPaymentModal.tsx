import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../utils/currency';

interface DigitalPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (paymentData: { method: string; referenceNo: string; amount: number }) => void;
    defaultAmount?: number;
    title?: string;
}

export function DigitalPaymentModal({ visible, onClose, onSuccess, defaultAmount = 500, title = 'Digital Payment (GCash / Maya)' }: DigitalPaymentModalProps) {
    const [method, setMethod] = useState<'GCash' | 'Maya' | 'QR-Ph'>('GCash');
    const [amount, setAmount] = useState(defaultAmount.toString());
    const [referenceNo, setReferenceNo] = useState(`REF-${Math.floor(10000000 + Math.random() * 90000000)}`);
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = () => {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
            return;
        }

        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            onSuccess({
                method,
                referenceNo: referenceNo.trim() || `REF-${Math.floor(10000000 + Math.random() * 90000000)}`,
                amount: parsedAmount,
            });
            onClose();
        }, 1200);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-[32px] p-6 shadow-2xl">
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-xl font-bold text-gray-900">{title}</Text>
                        <Pressable onPress={onClose} className="p-2 rounded-full active:bg-gray-100">
                            <MaterialIcons name="close" size={24} color="#64748B" />
                        </Pressable>
                    </View>

                    {/* Channel Selector */}
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Channel</Text>
                    <View className="flex-row gap-3 mb-4">
                        {(['GCash', 'Maya', 'QR-Ph'] as const).map(m => (
                            <Pressable
                                key={m}
                                onPress={() => {
                                    setMethod(m);
                                    setReferenceNo(`REF-${m.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`);
                                }}
                                className={`flex-1 p-3 rounded-2xl border items-center justify-center ${
                                    method === m ? 'bg-blue-50 border-blue-600' : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <MaterialIcons
                                    name={m === 'GCash' ? 'account-balance-wallet' : m === 'Maya' ? 'credit-card' : 'qr-code-scanner'}
                                    size={24}
                                    color={method === m ? '#1D4ED8' : '#64748B'}
                                />
                                <Text className={`text-xs font-bold mt-1 ${method === m ? 'text-blue-700' : 'text-gray-600'}`}>{m}</Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Amount Input */}
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount (PHP)</Text>
                    <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-4">
                        <Text className="text-gray-500 font-bold text-lg mr-2">₱</Text>
                        <TextInput
                            className="flex-1 text-gray-900 text-lg font-bold"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="0.00"
                         placeholderTextColor="#9CA3AF"/>
                    </View>

                    {/* Reference No */}
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reference No.</Text>
                    <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-6">
                        <TextInput
                            className="text-gray-900 text-sm font-semibold"
                            value={referenceNo}
                            onChangeText={setReferenceNo}
                        />
                    </View>

                    {/* Action Button */}
                    <Pressable
                        onPress={handleConfirm}
                        disabled={submitting}
                        className="bg-blue-900 py-4 rounded-2xl items-center justify-center active:bg-blue-950 shadow-md"
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text className="text-white text-base font-bold">Process Payment ({formatPHP(parseFloat(amount) || 0)})</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}
