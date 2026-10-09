import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { loanApplicationService } from '../../../src/services/LoanApplicationService';
import LoanApplication from '../../../src/database/models/LoanApplication';
import { Button } from '../../../src/components/Button';

export default function LoanApplicationsListScreen() {
    const router = useRouter();
    const [applications, setApplications] = useState<LoanApplication[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const data = await loanApplicationService.getApplicationsByStatus('under_review');
            setApplications(data);
        } catch (error) {
            console.error('Failed to load applications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const renderItem = ({ item }: { item: LoanApplication }) => (
        <View className="bg-white p-4 rounded-lg shadow mb-3">
            <Text className="font-bold text-lg">Amount: ₱{item.amountApplied}</Text>
            <Text className="text-gray-600">Status: {item.status}</Text>
            <Text className="text-gray-500 text-sm mt-1">Date: {new Date(item.applicationDate).toLocaleDateString()}</Text>
            <Button 
                title="View Details" 
                onPress={() => router.push(`/(loan-encoder)/loan-applications/${item.id}`)} 
                className="mt-3" 
            />
        </View>
    );

    return (
        <View className="flex-1 bg-gray-100 p-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">Loan Applications</Text>
                <Button 
                    title="New Application" 
                    onPress={() => router.push('/(loan-encoder)/loan-applications/new')}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : applications.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-500">No applications currently under review.</Text>
                </View>
            ) : (
                <FlatList
                    data={applications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </View>
    );
}
