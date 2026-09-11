import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../../src/database';
import CashTransaction from '../../../src/database/models/CashTransaction';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { useAuth } from '../../../src/store/AuthContext';
import { BaseModelService } from '../../../src/services/BaseModelService';
import { AutoPostingService } from '../../../src/services/AutoPostingService';
import { handleFormValidationError, handleSaveError } from '../../../src/utils/errorAlerts';


const schema = z.object({
    particulars: z.string().min(3, "Particulars/description is too short"),
    amount: z.string().refine(v => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Amount must be greater than zero"),
    type: z.enum(['in', 'out']),
    remarks: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewPettyCashScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            particulars: '',
            amount: '',
            type: 'out',
            remarks: '',
        }
    });

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            const txId = uuid.v4().toString();
            const amt = parseFloat(data.amount);
            await BaseModelService.create<CashTransaction>('cash_transactions', record => {
                record._raw.id = txId;
                record.particulars = data.particulars.trim();
                record.amount = amt;
                record.type = data.type;
                record.remarks = data.remarks?.trim() || '';
                record.transactionDate = Date.now();
                record.isPettyCash = true;
                if (user?.id) record.recordedBy = user.id;
            });

            // Auto-post to accounting general ledger
            try {
                await AutoPostingService.postCashTransaction({
                    transactionId: txId,
                    type: data.type === 'in' ? 'in' : 'out',
                    amount: amt,
                    particulars: data.particulars.trim(),
                    entryDate: new Date(),
                    postedBy: user?.id,
                });
            } catch (postErr) {
                console.warn('[NewPettyCash] Auto-posting warning:', postErr);
            }

            Alert.alert("Success", "Petty cash entry recorded & posted successfully.");
            safeBack(router, '/(admin)/cash-on-hand/petty-cash');
        } catch (error) {
            handleSaveError(error, 'Petty Cash Entry', 'save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/cash-on-hand/petty-cash')} className="p-2 -ml-2 rounded-full active:bg-gray-50">
                    <Ionicons name="arrow-back" size={24} color="#0F766E" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">New Petty Cash Entry</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Encode receipt or replenishment</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    {/* Entry Type */}
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Entry Type</Text>
                        <Controller
                            control={control}
                            name="type"
                            render={({ field: { onChange, value } }) => (
                                <View className="flex-row bg-gray-50 p-1 rounded-2xl border border-gray-100">
                                    <Pressable
                                        onPress={() => onChange('out')}
                                        className={`flex-1 py-3.5 items-center rounded-xl flex-row justify-center ${
                                            value === 'out' ? 'bg-rose-600 shadow-sm' : ''
                                        }`}
                                    >
                                        <MaterialIcons name="call-made" size={16} color={value === 'out' ? '#FFF' : '#BE123C'} className="mr-2" />
                                        <Text className={`text-xs font-extrabold uppercase tracking-wider ${value === 'out' ? 'text-white' : 'text-gray-700'}`}>
                                            Disbursement (Out)
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => onChange('in')}
                                        className={`flex-1 py-3.5 items-center rounded-xl flex-row justify-center ${
                                            value === 'in' ? 'bg-teal-700 shadow-sm' : ''
                                        }`}
                                    >
                                        <MaterialIcons name="call-received" size={16} color={value === 'in' ? '#FFF' : '#0F766E'} className="mr-2" />
                                        <Text className={`text-xs font-extrabold uppercase tracking-wider ${value === 'in' ? 'text-white' : 'text-gray-700'}`}>
                                            Replenish (In)
                                        </Text>
                                    </Pressable>
                                </View>
                            )}
                        />
                    </View>

                    {/* Particulars */}
                    <View className="mb-4">
                        <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Particulars / Payee *</Text>
                        <Controller
                            control={control}
                            name="particulars"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 text-sm font-semibold"
                                    placeholder="e.g. Office cleaning materials, Courier fee"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                        {errors.particulars && <Text className="text-red-600 text-xs mt-1 ml-2 font-bold">{errors.particulars.message}</Text>}
                    </View>

                    {/* Amount */}
                    <View className="mb-4">
                        <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Amount (₱) *</Text>
                        <Controller
                            control={control}
                            name="amount"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 text-sm font-semibold"
                                    placeholder="0.00"
                                    keyboardType="numeric"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                        {errors.amount && <Text className="text-red-600 text-xs mt-1 ml-2 font-bold">{errors.amount.message}</Text>}
                    </View>

                    {/* Remarks */}
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Remarks / Invoice No.</Text>
                        <Controller
                            control={control}
                            name="remarks"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 text-sm font-semibold min-h-[80px]"
                                    placeholder="Additional details, OR/AR receipt number..."
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    multiline
                                    numberOfLines={3}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                    </View>

                    {/* Action buttons */}
                    <View className="flex-row gap-4 mt-2">
                        <Pressable
                            onPress={() => safeBack(router, '/(admin)/cash-on-hand/petty-cash')}
                            className="flex-1 bg-gray-100 py-4 rounded-2xl items-center active:bg-gray-200"
                        >
                            <Text className="text-gray-700 font-extrabold text-xs uppercase tracking-widest">Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'Petty Cash Entry'))}
                            disabled={saving}
                            className="flex-1 bg-teal-700 py-4 rounded-2xl items-center active:bg-teal-800"
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text className="text-white font-black text-xs uppercase tracking-widest">Save Entry</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
