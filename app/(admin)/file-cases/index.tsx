import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import FileCase from '../../../src/database/models/FileCase';
import Borrower from '../../../src/database/models/Borrower';

type CaseRow = {
    id: string;
    borrowerId: string;
    borrowerName: string;
    status: string;
    caseNumber: string;
    filedDate: number;
    notes?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
    open: 'bg-red-100 text-red-800',
    resolved: 'bg-green-100 text-green-800',
    dismissed: 'bg-gray-100 text-gray-700',
};

export default function FileCasesScreen() {
    const router = useRouter();
    const [cases, setCases] = useState<CaseRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const fileCasesCollection = database.collections.get<FileCase>('file_cases');
            const borrowersCollection = database.collections.get<Borrower>('borrowers');

            if (!fileCasesCollection || typeof (fileCasesCollection as any).query !== 'function') {
                console.warn('[FileCases] file_cases collection is not available. The local database may need migration/reset.');
                setCases([]);
                return;
            }

            const fileCases = await fileCasesCollection.query(
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('filed_date', Q.desc),
            ).fetch();
            const borrowerIds = Array.from(new Set(fileCases.map(c => c.borrowerId)));
            const borrowers = borrowerIds.length && borrowersCollection && typeof (borrowersCollection as any).query === 'function'
                ? await borrowersCollection.query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                : [];
            const bMap = new Map(borrowers.map(b => [b.id, b.fullName]));
            setCases(fileCases.map(c => ({
                id: c.id,
                borrowerId: c.borrowerId,
                borrowerName: bMap.get(c.borrowerId) ?? 'Unknown',
                status: c.status,
                caseNumber: c.caseNumber,
                filedDate: c.filedDate,
                notes: c.notes,
            })));
        } catch (e) {
            console.error('[FileCases] load error:', e);
            Alert.alert('Error', 'Failed to load file cases.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <FlatList
                data={cases}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListHeaderComponent={
                    <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                        <Text className="text-2xl font-black text-gray-900">File Cases</Text>
                        <Text className="text-gray-700 mt-1">Legal cases filed for delinquent accounts (6+ months overdue).</Text>
                        <Text className="font-black text-gray-900 mt-2">{cases.length} case{cases.length !== 1 ? 's' : ''}</Text>
                    </View>
                }
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <MaterialIcons name="gavel" size={64} color="#E5E7EB" />
                        <Text className="text-gray-500 mt-4">No file cases yet</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const [bg, fg] = (STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-700').split(' ');
                    return (
                        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                            <View className="flex-row justify-between items-start">
                                <Text className="font-black text-gray-900 text-base">{item.borrowerName}</Text>
                                <View className={`px-2 py-1 rounded ${bg}`}>
                                    <Text className={`text-[10px] font-black uppercase ${fg}`}>{item.status}</Text>
                                </View>
                            </View>
                            <Text className="text-xs text-gray-500 mt-0.5">Case #{item.caseNumber}</Text>
                            <Text className="text-xs text-gray-500">Filed: {new Date(item.filedDate).toLocaleDateString()}</Text>
                            {item.notes ? <Text className="text-xs text-gray-700 mt-1">{item.notes}</Text> : null}
                        </View>
                    );
                }}
            />
            <Pressable
                className="absolute bottom-6 right-6 w-14 h-14 bg-blue-900 rounded-full items-center justify-center shadow-lg"
                onPress={() => router.push('/(admin)/file-cases/new')}
            >
                <MaterialIcons name="add" size={28} color="#fff" />
            </Pressable>
        </View>
    );
}
