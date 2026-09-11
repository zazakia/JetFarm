import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import FileCase from '../../../src/database/models/FileCase';
import { useAuth } from '../../../src/store/AuthContext';

type LoanOption = { id: string; label: string; borrowerId: string };

export default function NewFileCaseScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loans, setLoans] = useState<LoanOption[]>([]);
    const [selectedLoanId, setSelectedLoanId] = useState('');
    const [caseNumber, setCaseNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const loansCollection = database.collections.get<Loan>('loans');
                const borrowersCollection = database.collections.get<Borrower>('borrowers');

                if (!loansCollection || typeof (loansCollection as any).query !== 'function') {
                    console.warn('[NewFileCase] loans collection is not available.');
                    setLoans([]);
                    return;
                }

                const loanList = await loansCollection.query(
                    Q.where('deleted_at', Q.eq(null)),
                    Q.where('status', Q.oneOf(['active', 'defaulted'])),
                ).fetch();
                const borrowerIds = Array.from(new Set(loanList.map(l => l.borrowerId)));
                const borrowers = borrowerIds.length && borrowersCollection && typeof (borrowersCollection as any).query === 'function'
                    ? await borrowersCollection.query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                    : [];
                const bMap = new Map(borrowers.map(b => [b.id, b.fullName]));
                setLoans(loanList.map(l => ({
                    id: l.id,
                    borrowerId: l.borrowerId,
                    label: `${bMap.get(l.borrowerId) ?? 'Unknown'} — ${l.loanNumber}`,
                })));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const save = async () => {
        if (!selectedLoanId) return Alert.alert('Validation', 'Please select a loan.');
        if (!caseNumber.trim()) return Alert.alert('Validation', 'Case number is required.');
        setSaving(true);
        try {
            const loan = loans.find(l => l.id === selectedLoanId)!;
            const fileCasesCollection = database.collections.get<FileCase>('file_cases');
            if (!fileCasesCollection || typeof (fileCasesCollection as any).create !== 'function') {
                throw new Error('File cases are not available in the local database. Please sync or reset local data, then try again.');
            }

            await database.write(async () => {
                await fileCasesCollection.create(fc => {
                    fc.loanId = selectedLoanId;
                    fc.borrowerId = loan.borrowerId;
                    fc.caseNumber = caseNumber.trim();
                    (fc as any).filedDate = Date.now();
                    fc.status = 'open';
                    fc.notes = notes.trim();
                    fc.filedBy = user?.id ?? '';
                });
            });
            if (Platform.OS === 'web') window.alert('File case created.');
            else Alert.alert('Success', 'File case created.');
            router.back();
        } catch (e) {
            console.error('[NewFileCase] save error:', e);
            Alert.alert('Error', 'Failed to create file case.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900 mb-4">New File Case</Text>

                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Select Loan *</Text>
                <ScrollView className="border border-gray-200 rounded-xl max-h-48 mb-4" nestedScrollEnabled>
                    {loans.map(l => (
                        <Pressable
                            key={l.id}
                            className={`p-3 border-b border-gray-100 ${selectedLoanId === l.id ? 'bg-blue-50' : ''}`}
                            onPress={() => setSelectedLoanId(l.id)}
                        >
                            <Text className={`text-sm ${selectedLoanId === l.id ? 'font-black text-blue-800' : 'text-gray-900'}`}>{l.label}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Case Number *</Text>
                <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900"
                    value={caseNumber}
                    onChangeText={setCaseNumber}
                    placeholder="e.g. CASE-2026-001"
                 placeholderTextColor="#9CA3AF"/>

                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Notes</Text>
                <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 mb-6 text-gray-900"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Additional notes..."
                    multiline
                    numberOfLines={3}
                 placeholderTextColor="#9CA3AF"/>

                <Pressable
                    className="bg-blue-900 rounded-2xl py-4 items-center"
                    onPress={save}
                    disabled={saving}
                >
                    <Text className="text-white font-black text-base">{saving ? 'Saving...' : 'File Case'}</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
