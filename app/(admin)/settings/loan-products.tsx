import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import LoanProduct from '../../../src/database/models/LoanProduct';
import { SettingsService } from '../../../src/services/SettingsService';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';

const numericFields = [
    ['defaultRatePercent', 'Rate %'],
    ['defaultTerm', 'Term'],
    ['defaultProcessingFeeRate', 'Processing %'],
    ['defaultProcessingFeeFlat', 'Processing Flat'],
    ['defaultNotarialFee', 'Notarial'],
    ['defaultSavingsPerPayment', 'Savings / Pay'],
    ['defaultPrincipal', 'Default Principal'],
    ['maxPrincipal', 'Max Principal'],
    ['minTermMonths', 'Min Term Months'],
    ['maxTermMonths', 'Max Term Months'],
] as const;

type Draft = Record<string, string>;

const toDraft = (product: LoanProduct): Draft => ({
    label: product.label,
    description: product.description || '',
    defaultRatePercent: String(product.defaultRatePercent ?? 0),
    defaultTerm: String(product.defaultTerm ?? 1),
    defaultTermUnit: product.defaultTermUnit || 'months',
    defaultFrequency: product.defaultFrequency || 'monthly',
    defaultProcessingFeeRate: String(product.defaultProcessingFeeRate ?? 0),
    defaultProcessingFeeFlat: String(product.defaultProcessingFeeFlat ?? 0),
    defaultNotarialFee: String(product.defaultNotarialFee ?? 0),
    defaultSavingsPerPayment: String(product.defaultSavingsPerPayment ?? 0),
    defaultPrincipal: String(product.defaultPrincipal ?? 0),
    maxPrincipal: String(product.maxPrincipal ?? 0),
    minTermMonths: String(product.minTermMonths ?? 0),
    maxTermMonths: String(product.maxTermMonths ?? 0),
});

const toNumber = (value: string, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export default function LoanProductsSettingsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [products, setProducts] = useState<LoanProduct[]>([]);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const list = await SettingsService.getLoanProducts();
            setProducts(list);
            setDrafts(Object.fromEntries(list.map(product => [product.id, toDraft(product)])));
        } catch (error) {
            console.error('[LoanProductsSettings] load failed:', error);
            Alert.alert('Settings Error', 'Unable to load loan products.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const setDraftValue = (id: string, key: string, value: string) => {
        setDrafts(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] ?? {}),
                [key]: value,
            },
        }));
    };

    const save = async (product: LoanProduct) => {
        const draft = drafts[product.id] ?? toDraft(product);
        if (!draft.label.trim()) {
            Alert.alert('Validation', 'Product label is required.');
            return;
        }
        if (toNumber(draft.defaultTerm, 0) <= 0) {
            Alert.alert('Validation', 'Default term must be greater than zero.');
            return;
        }

        setSavingId(product.id);
        try {
            await SettingsService.updateLoanProduct(product, {
                label: draft.label.trim(),
                description: draft.description.trim(),
                defaultRatePercent: toNumber(draft.defaultRatePercent),
                defaultTerm: toNumber(draft.defaultTerm, 1),
                defaultTermUnit: draft.defaultTermUnit,
                defaultFrequency: draft.defaultFrequency,
                defaultProcessingFeeRate: toNumber(draft.defaultProcessingFeeRate),
                defaultProcessingFeeFlat: toNumber(draft.defaultProcessingFeeFlat),
                defaultNotarialFee: toNumber(draft.defaultNotarialFee),
                defaultSavingsPerPayment: toNumber(draft.defaultSavingsPerPayment),
                defaultPrincipal: toNumber(draft.defaultPrincipal),
                maxPrincipal: toNumber(draft.maxPrincipal),
                minTermMonths: toNumber(draft.minTermMonths),
                maxTermMonths: toNumber(draft.maxTermMonths),
            } as any, user?.id);
            await load();
            Alert.alert('Saved', 'Loan product settings updated.');
        } catch (error: any) {
            console.error('[LoanProductsSettings] save failed:', error);
            Alert.alert('Save Failed', error?.message || 'Unable to save loan product.');
        } finally {
            setSavingId(null);
        }
    };

    const toggleActive = async (product: LoanProduct, isActive: boolean) => {
        setSavingId(product.id);
        try {
            await SettingsService.updateLoanProduct(product, { isActive } as any, user?.id);
            await load();
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/settings/business-rules')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">Loan Products</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Editable defaults for new loans</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                {products.map(product => {
                    const draft = drafts[product.id] ?? toDraft(product);
                    return (
                        <View key={product.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="flex-1 pr-4">
                                    <Text className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{product.productType}</Text>
                                    <TextInput
                                        className="text-lg font-black text-gray-900 border-b border-gray-100 py-2"
                                        value={draft.label}
                                        onChangeText={text => setDraftValue(product.id, 'label', text)}
                                    />
                                </View>
                                <Switch
                                    value={product.isActive !== false}
                                    trackColor={{ true: '#1E3A8A' }}
                                    onValueChange={value => toggleActive(product, value)}
                                    disabled={savingId === product.id}
                                />
                            </View>

                            <TextInput
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-800 mb-4"
                                value={draft.description}
                                onChangeText={text => setDraftValue(product.id, 'description', text)}
                                multiline
                            />

                            <View className="flex-row flex-wrap -mx-1">
                                {numericFields.map(([key, label]) => (
                                    <View key={key} className="w-1/2 px-1 mb-3">
                                        <Text className="text-[10px] text-gray-700 font-bold uppercase mb-1">{label}</Text>
                                        <TextInput
                                            className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-bold text-gray-900"
                                            keyboardType="numeric"
                                            value={draft[key]}
                                            onChangeText={text => setDraftValue(product.id, key, text)}
                                        />
                                    </View>
                                ))}
                            </View>

                            <View className="flex-row -mx-1 mb-4">
                                <PickerButtons
                                    label="Term Unit"
                                    value={draft.defaultTermUnit}
                                    options={['months', 'days', 'weeks']}
                                    onChange={value => setDraftValue(product.id, 'defaultTermUnit', value)}
                                />
                                <PickerButtons
                                    label="Frequency"
                                    value={draft.defaultFrequency}
                                    options={['daily', 'weekly', 'bi_monthly', 'monthly']}
                                    onChange={value => setDraftValue(product.id, 'defaultFrequency', value)}
                                />
                            </View>

                            <Pressable
                                onPress={() => save(product)}
                                disabled={savingId === product.id}
                                className={`py-3 rounded-2xl items-center ${savingId === product.id ? 'bg-gray-300' : 'bg-blue-900'}`}
                            >
                                <Text className="text-white font-black">{savingId === product.id ? 'Saving...' : 'Save Product'}</Text>
                            </Pressable>
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

function PickerButtons({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
    return (
        <View className="w-1/2 px-1">
            <Text className="text-[10px] text-gray-700 font-bold uppercase mb-1">{label}</Text>
            <View className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                {options.map(option => (
                    <Pressable
                        key={option}
                        onPress={() => onChange(option)}
                        className={`px-3 py-2 ${value === option ? 'bg-green-50' : ''}`}
                    >
                        <Text className={`text-[11px] font-bold ${value === option ? 'text-blue-900' : 'text-gray-700'}`}>{option}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}
