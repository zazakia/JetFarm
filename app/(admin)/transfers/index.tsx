import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { FundTransferService } from '../../../src/services/FundTransferService';
import { ChartOfAccountsService } from '../../../src/services/ChartOfAccountsService';
import { formatPHP } from '../../../src/utils/currency';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';

const TRANSFER_ACCOUNTS = [
    { code: '1010', name: 'Cash on Hand (COH)', category: 'Cash' },
    { code: '1011', name: 'Cash on Hand — Petty Cash', category: 'Petty Cash' },
    { code: '1020', name: 'Cash in Bank — BDO', category: 'Bank' },
    { code: '1030', name: 'Cash in Bank — PNB', category: 'Bank' },
    { code: '1040', name: 'Cash in Bank — Other', category: 'Bank' },
];

const schema = z.object({
    sourceAccountCode: z.string().min(1, 'Source account is required'),
    targetAccountCode: z.string().min(1, 'Target account is required'),
    amount: z.string().refine(v => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be greater than zero'),
    description: z.string().min(3, 'Description is required'),
}).refine(data => data.sourceAccountCode !== data.targetAccountCode, {
    message: 'Source and target accounts must be different',
    path: ['targetAccountCode'],
});

type FormData = z.infer<typeof schema>;

export default function FundTransfersScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loadingBalances, setLoadingBalances] = useState(true);

    const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            sourceAccountCode: '1010',
            targetAccountCode: '1011',
            amount: '',
            description: 'Fund Transfer',
        },
    });

    const sourceCode = watch('sourceAccountCode');
    const targetCode = watch('targetAccountCode');

    useEffect(() => {
        const load = async () => {
            try {
                const balMap: Record<string, number> = {};
                for (const acc of TRANSFER_ACCOUNTS) {
                    const account = await ChartOfAccountsService.getByCode(acc.code);
                    balMap[acc.code] = account ? 0 : 0;
                }
                setBalances(balMap);
            } catch (e) {
                console.warn('Failed to fetch account balances', e);
            } finally {
                setLoadingBalances(false);
            }
        };
        load();
    }, []);

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            const srcObj = TRANSFER_ACCOUNTS.find(a => a.code === data.sourceAccountCode);
            const tgtObj = TRANSFER_ACCOUNTS.find(a => a.code === data.targetAccountCode);

            await FundTransferService.executeTransfer({
                sourceAccountCode: data.sourceAccountCode,
                sourceAccountName: srcObj?.name,
                targetAccountCode: data.targetAccountCode,
                targetAccountName: tgtObj?.name,
                amount: parseFloat(data.amount),
                description: data.description.trim(),
                performedBy: user?.id,
            });

            if (Platform.OS === 'web') {
                window.alert('Fund transfer executed successfully.');
            } else {
                Alert.alert('Success', 'Fund transfer executed successfully.');
            }
            safeBack(router, '/(admin)');
        } catch (error: any) {
            if (Platform.OS === 'web') {
                window.alert(error?.message || 'Transfer failed.');
            } else {
                Alert.alert('Error', error?.message || 'Transfer failed.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <View className="flex-row items-center mb-6">
                    <View className="w-12 h-12 rounded-2xl bg-blue-100 items-center justify-center mr-4">
                        <MaterialIcons name="sync-alt" size={24} color="#1E3A8A" />
                    </View>
                    <View>
                        <Text className="text-2xl font-black text-gray-900">Fund Transfer & Withdrawals</Text>
                        <Text className="text-gray-500 font-bold text-xs">Transfer between COH, Petty Cash & Bank Accounts</Text>
                    </View>
                </View>

                {/* Source Account Selection */}
                <View className="mb-6">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">From (Source Account)</Text>
                    <Controller
                        control={control}
                        name="sourceAccountCode"
                        render={({ field: { onChange, value } }) => (
                            <View className="gap-2">
                                {TRANSFER_ACCOUNTS.map(acc => (
                                    <Pressable
                                        key={acc.code}
                                        onPress={() => onChange(acc.code)}
                                        className={`p-4 rounded-2xl border flex-row justify-between items-center ${
                                            value === acc.code ? 'bg-blue-50 border-blue-600' : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <View>
                                            <Text className={`font-bold text-sm ${value === acc.code ? 'text-blue-900' : 'text-gray-900'}`}>
                                                {acc.code} — {acc.name}
                                            </Text>
                                        </View>
                                        {value === acc.code && <MaterialIcons name="check-circle" size={20} color="#1E3A8A" />}
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    />
                    {errors.sourceAccountCode && <Text className="text-red-500 text-xs mt-1">{errors.sourceAccountCode.message}</Text>}
                </View>

                {/* Target Account Selection */}
                <View className="mb-6">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">To (Target Account)</Text>
                    <Controller
                        control={control}
                        name="targetAccountCode"
                        render={({ field: { onChange, value } }) => (
                            <View className="gap-2">
                                {TRANSFER_ACCOUNTS.map(acc => (
                                    <Pressable
                                        key={acc.code}
                                        onPress={() => onChange(acc.code)}
                                        className={`p-4 rounded-2xl border flex-row justify-between items-center ${
                                            value === acc.code ? 'bg-green-50 border-green-600' : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <View>
                                            <Text className={`font-bold text-sm ${value === acc.code ? 'text-green-900' : 'text-gray-900'}`}>
                                                {acc.code} — {acc.name}
                                            </Text>
                                        </View>
                                        {value === acc.code && <MaterialIcons name="check-circle" size={20} color="#16A34A" />}
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    />
                    {errors.targetAccountCode && <Text className="text-red-500 text-xs mt-1">{errors.targetAccountCode.message}</Text>}
                </View>

                {/* Amount */}
                <View className="mb-6">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Transfer Amount (₱) *</Text>
                    <Controller
                        control={control}
                        name="amount"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-2xl border ${errors.amount ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-black text-2xl`}
                                value={value}
                                onChangeText={onChange}
                                keyboardType="numeric"
                                placeholder="0.00"
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.amount && <Text className="text-red-500 text-xs mt-1">{errors.amount.message}</Text>}
                </View>

                {/* Description */}
                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Description / Reference *</Text>
                    <Controller
                        control={control}
                        name="description"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-2xl border ${errors.description ? 'border-red-500' : 'border-gray-200'} text-gray-900`}
                                value={value}
                                onChangeText={onChange}
                                placeholder="Reason for transfer (e.g. COH to Petty Cash replenishment, Bank withdrawal)"
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.description && <Text className="text-red-500 text-xs mt-1">{errors.description.message}</Text>}
                </View>

                <Pressable
                    className={`w-full py-4 rounded-2xl items-center flex-row justify-center shadow-lg ${saving ? 'bg-blue-400' : 'bg-blue-900 active:bg-blue-950'}`}
                    onPress={handleSubmit(onSubmit)}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name="swap-horiz" size={24} color="#FFFFFF" className="mr-2" />
                            <Text className="text-white font-black text-lg uppercase tracking-wider">Execute Transfer</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </ScrollView>
    );
}
