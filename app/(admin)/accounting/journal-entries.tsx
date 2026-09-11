import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { JournalEntryService, JournalLineInput } from '../../../src/services/JournalEntryService';
import { ChartOfAccountsService } from '../../../src/services/ChartOfAccountsService';
import JournalEntry from '../../../src/database/models/JournalEntry';
import JournalEntryLine from '../../../src/database/models/JournalEntryLine';
import ChartOfAccount from '../../../src/database/models/ChartOfAccount';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';

export default function JournalEntries() {
    const params = useLocalSearchParams<{ id?: string }>();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<{ entry: JournalEntry; lines: JournalEntryLine[] } | null>(null);
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    
    // Modal controls
    const [detailVisible, setDetailVisible] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);

    // Form state
    const [description, setDescription] = useState('');
    const [entryLines, setEntryLines] = useState<JournalLineInput[]>([
        { accountCode: '', debitAmount: 0, creditAmount: 0, description: '' },
        { accountCode: '', debitAmount: 0, creditAmount: 0, description: '' },
    ]);

    const loadEntries = async () => {
        try {
            const list = await JournalEntryService.getEntries();
            setEntries(list);
        } catch (err) {
            console.error('Failed to load journal entries:', err);
        }
    };

    const loadAccounts = async () => {
        try {
            const list = await ChartOfAccountsService.getActivePostableAccounts();
            setAccounts(list);
        } catch (err) {
            console.error('Failed to load accounts for form:', err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadEntries();
            loadAccounts();
        }, [])
    );

    // Watch for query parameter from dashboard list click
    useEffect(() => {
        if (params.id) {
            handleOpenDetail(params.id);
        }
    }, [params.id]);

    const handleOpenDetail = async (id: string) => {
        try {
            const details = await JournalEntryService.getEntryById(id);
            if (details) {
                setSelectedEntry(details);
                setDetailVisible(true);
            }
        } catch (err) {
            console.error('Failed to open journal entry detail:', err);
        }
    };

    const handleReverse = async (id: string) => {
        Alert.alert(
            'Confirm Reversal',
            'Are you sure you want to post a reversal journal entry for this transaction? This action is irreversible.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const reversal = await JournalEntryService.reverseEntry(id, 'System');
                            Alert.alert('Success', `Reversal entry ${reversal.referenceNumber} has been posted.`);
                            setDetailVisible(false);
                            await loadEntries();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to reverse entry.');
                        }
                    }
                }
            ]
        );
    };

    const handleAddLine = () => {
        setEntryLines(prev => [...prev, { accountCode: '', debitAmount: 0, creditAmount: 0, description: '' }]);
    };

    const handleRemoveLine = (index: number) => {
        if (entryLines.length <= 2) {
            Alert.alert('Warning', 'A journal entry requires at least 2 lines.');
            return;
        }
        setEntryLines(prev => prev.filter((_, i) => i !== index));
    };

    const handleLineChange = (index: number, field: keyof JournalLineInput, value: any) => {
        setEntryLines(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    };

    const handleCreateJournal = async () => {
        // Validate
        if (!description.trim()) {
            Alert.alert('Error', 'Please enter a description.');
            return;
        }

        const formattedLines = entryLines.map(line => {
            const acctObj = accounts.find(a => a.code === line.accountCode);
            return {
                accountCode: line.accountCode,
                accountName: acctObj?.name || '',
                debitAmount: line.debitAmount ? parseFloat(line.debitAmount as any) : 0,
                creditAmount: line.creditAmount ? parseFloat(line.creditAmount as any) : 0,
                description: line.description || undefined,
            };
        });

        const invalidLines = formattedLines.some(l => !l.accountCode || (l.debitAmount === 0 && l.creditAmount === 0));
        if (invalidLines) {
            Alert.alert('Error', 'Every line must have an account and either a debit or credit amount.');
            return;
        }

        try {
            await JournalEntryService.createEntry({
                entryDate: new Date(),
                description,
                entryType: 'manual',
                lines: formattedLines,
            }, 'System');

            Alert.alert('Success', 'Journal entry posted successfully.');
            setCreateVisible(false);
            
            // Reset form
            setDescription('');
            setEntryLines([
                { accountCode: '', debitAmount: 0, creditAmount: 0, description: '' },
                { accountCode: '', debitAmount: 0, creditAmount: 0, description: '' },
            ]);
            
            await loadEntries();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to post journal entry.');
        }
    };

    const totalDebits = entryLines.reduce((sum, l) => sum + (l.debitAmount ? parseFloat(l.debitAmount as any) : 0), 0);
    const totalCredits = entryLines.reduce((sum, l) => sum + (l.creditAmount ? parseFloat(l.creditAmount as any) : 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return (
        <View className="flex-1 bg-gray-50">
            {/* Action Bar */}
            <View className="flex-row justify-between items-center p-4 bg-white border-b border-gray-100">
                <Text className="text-gray-900 font-black text-sm uppercase tracking-wider">Posted Journal Entries</Text>
                <Pressable
                    onPress={() => setCreateVisible(true)}
                    className="bg-blue-900 px-4 py-2 rounded-xl active:bg-blue-800 flex-row items-center"
                >
                    <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text className="text-white font-bold text-xs">New Manual Entry</Text>
                </Pressable>
            </View>

            {/* List */}
            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                {entries.length === 0 ? (
                    <Text className="text-gray-600 text-sm text-center py-12">No journal entries found.</Text>
                ) : (
                    entries.map(entry => (
                        <Pressable
                            key={entry.id}
                            onPress={() => handleOpenDetail(entry.id)}
                            className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4 active:bg-gray-50 flex-row justify-between items-center"
                        >
                            <View className="flex-1 mr-4">
                                <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{entry.description}</Text>
                                <Text className="text-gray-600 text-[10px] font-medium mt-1">
                                    {entry.referenceNumber} • {format(new Date(entry.entryDate), 'MMM d, yyyy')}
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-gray-900 font-black text-sm">{formatPHP(entry.totalDebit)}</Text>
                                <View className="bg-gray-100 px-2 py-0.5 rounded-full mt-1.5">
                                    <Text className="text-gray-600 text-[8px] font-bold uppercase">{entry.entryType}</Text>
                                </View>
                            </View>
                        </Pressable>
                    ))
                )}
            </ScrollView>

            {/* Detail View Modal */}
            <Modal
                visible={detailVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDetailVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[80%]">
                        {selectedEntry && (
                            <View className="flex-1">
                                <View className="flex-row justify-between items-center mb-6">
                                    <View>
                                        <Text className="text-gray-900 font-black text-lg">Journal Entry Details</Text>
                                        <Text className="text-gray-600 text-xs font-medium">
                                            {selectedEntry.entry.referenceNumber} • {format(new Date(selectedEntry.entry.entryDate), 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                    <Pressable onPress={() => setDetailVisible(false)} className="p-1">
                                        <MaterialIcons name="close" size={24} color="#6B7280" />
                                    </Pressable>
                                </View>

                                <ScrollView className="flex-1 mb-6" showsVerticalScrollIndicator={false}>
                                    <View className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
                                        <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Description</Text>
                                        <Text className="text-gray-900 text-sm font-medium leading-relaxed">{selectedEntry.entry.description}</Text>
                                        
                                        <View className="flex-row mt-3 justify-between">
                                            <View>
                                                <Text className="text-gray-600 text-[10px] font-bold uppercase">Entry Type</Text>
                                                <Text className="text-gray-900 text-xs font-bold uppercase mt-0.5">{selectedEntry.entry.entryType}</Text>
                                            </View>
                                            <View className="items-end">
                                                <Text className="text-gray-600 text-[10px] font-bold uppercase">Total Balanced Amount</Text>
                                                <Text className="text-gray-900 text-xs font-black mt-0.5">{formatPHP(selectedEntry.entry.totalDebit)}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <Text className="text-gray-900 font-black text-xs uppercase tracking-wider mb-3">Accounts / Entry Lines</Text>
                                    
                                    {selectedEntry.lines.map((line, idx) => (
                                        <View key={line.id || idx} className="flex-row justify-between items-start py-3 border-b border-gray-50">
                                            <View className="flex-1 mr-4">
                                                <Text className="text-gray-900 font-bold text-xs">{line.accountCode} — {line.accountName}</Text>
                                                {line.description && (
                                                    <Text className="text-gray-600 text-[10px] mt-0.5">{line.description}</Text>
                                                )}
                                            </View>
                                            <View className="items-end">
                                                {line.debitAmount > 0 ? (
                                                    <Text className="text-emerald-700 font-bold text-xs">Dr {formatPHP(line.debitAmount)}</Text>
                                                ) : (
                                                    <Text className="text-red-700 font-bold text-xs">Cr {formatPHP(line.creditAmount)}</Text>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>

                                {selectedEntry.entry.entryType !== 'reversing' && (
                                    <View className="flex-row border-t border-gray-100 pt-4">
                                        <Pressable
                                            onPress={() => handleReverse(selectedEntry.entry.id)}
                                            className="flex-1 bg-red-500/10 py-3.5 rounded-xl flex-row justify-center items-center active:bg-red-500/20"
                                        >
                                            <MaterialIcons name="undo" size={20} color="#EF4444" style={{ marginRight: 6 }} />
                                            <Text className="text-red-600 font-bold text-sm">Reverse Entry</Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Create Manual Entry Modal */}
            <Modal
                visible={createVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCreateVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[90%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-gray-900 font-black text-lg">New Manual Journal Entry</Text>
                            <Pressable onPress={() => setCreateVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {/* General description */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">General Memo / Description</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-6 text-gray-900"
                                placeholder="e.g. Adjusting entry for depreciation"
                                value={description}
                                onChangeText={setDescription}
                             placeholderTextColor="#9CA3AF"/>

                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-gray-900 font-black text-xs uppercase tracking-wider">Lines</Text>
                                <Pressable
                                    onPress={handleAddLine}
                                    className="bg-gray-100 px-3 py-1.5 rounded-lg flex-row items-center active:bg-gray-200"
                                >
                                    <MaterialIcons name="add" size={14} color="#374151" />
                                    <Text className="text-gray-700 font-bold text-[10px] ml-1">Add Line</Text>
                                </Pressable>
                            </View>

                            {entryLines.map((line, idx) => (
                                <View key={idx} className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100 relative">
                                    <Pressable
                                        onPress={() => handleRemoveLine(idx)}
                                        className="absolute right-2 top-2 p-1 bg-red-50 rounded-full"
                                    >
                                        <MaterialIcons name="close" size={12} color="#EF4444" />
                                    </Pressable>

                                    {/* Account Selector simulation */}
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1.5">Account</Text>
                                    <View className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                                            <View className="flex-row p-2">
                                                {accounts.map(a => (
                                                    <Pressable
                                                        key={a.code}
                                                        onPress={() => handleLineChange(idx, 'accountCode', a.code)}
                                                        className={`px-3 py-1.5 rounded-full mr-2 border ${
                                                            line.accountCode === a.code
                                                                ? 'bg-blue-900 border-blue-900'
                                                                : 'bg-gray-50 border-gray-200'
                                                        }`}
                                                    >
                                                        <Text className={`text-[10px] font-bold ${
                                                            line.accountCode === a.code ? 'text-white' : 'text-gray-700'
                                                        }`}>
                                                            {a.code} - {a.name}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    </View>

                                    {/* Debit & Credit */}
                                    <View className="flex-row justify-between mb-3">
                                        <View className="w-[48%]">
                                            <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1">Debit Amount (₱)</Text>
                                            <TextInput
                                                className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900"
                                                placeholder="0.00"
                                                placeholderTextColor="#9CA3AF"
                                                value={line.debitAmount ? String(line.debitAmount) : ''}
                                                onChangeText={(v) => handleLineChange(idx, 'debitAmount', v)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View className="w-[48%]">
                                            <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1">Credit Amount (₱)</Text>
                                            <TextInput
                                                className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900"
                                                placeholder="0.00"
                                                placeholderTextColor="#9CA3AF"
                                                value={line.creditAmount ? String(line.creditAmount) : ''}
                                                onChangeText={(v) => handleLineChange(idx, 'creditAmount', v)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>

                                    {/* Line Memo */}
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1">Line Memo (Optional)</Text>
                                    <TextInput
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900"
                                        placeholder="Line explanation..."
                                        placeholderTextColor="#9CA3AF"
                                        value={line.description}
                                        onChangeText={(v) => handleLineChange(idx, 'description', v)}
                                    />
                                </View>
                            ))}

                            {/* Summary / Balanced check */}
                            <View className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100 flex-row justify-between items-center">
                                <View>
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase">Total Debits: {formatPHP(totalDebits)}</Text>
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase mt-1">Total Credits: {formatPHP(totalCredits)}</Text>
                                </View>
                                <View className={`px-3 py-1.5 rounded-full ${isBalanced ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                    <Text className={`text-[10px] font-bold uppercase ${isBalanced ? 'text-emerald-800' : 'text-red-800'}`}>
                                        {isBalanced ? 'Balanced' : 'Out of Balance'}
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Submit Button */}
                        <View className="pt-4 border-t border-gray-100 flex-row">
                            <Pressable
                                onPress={() => setCreateVisible(false)}
                                className="flex-1 bg-gray-100 py-3.5 rounded-xl mr-2 items-center active:bg-gray-200"
                            >
                                <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateJournal}
                                className={`flex-1 py-3.5 rounded-xl ml-2 items-center active:bg-blue-800 ${
                                    isBalanced ? 'bg-blue-900' : 'bg-blue-900/50'
                                }`}
                                disabled={!isBalanced}
                            >
                                <Text className="text-white font-bold text-sm">Post Entry</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
