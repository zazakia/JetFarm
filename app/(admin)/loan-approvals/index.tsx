import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert } from 'react-native';
import { loanApplicationService } from '../../../src/services/LoanApplicationService';
import LoanApplication from '../../../src/database/models/LoanApplication';
import { Button } from '../../../src/components/Button';
import { useAuth } from '../../../src/store/AuthContext';

export default function LoanApprovalsScreen() {
    const { user } = useAuth();
    const [applications, setApplications] = useState<LoanApplication[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const data = await loanApplicationService.getApplicationsByStatus('under_review');
            setApplications(data);
        } catch (error) {
            console.error('Failed to load applications for approval:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const handleApprove = async (app: LoanApplication) => {
        try {
            await loanApplicationService.approveApplication(app.id, user?.id || 'admin', app.amountApplied);
            Alert.alert('Success', 'Application approved.');
            fetchApplications();
        } catch (error) {
            Alert.alert('Error', 'Failed to approve application.');
        }
    };

    const handleReject = async (app: LoanApplication) => {
        try {
            await loanApplicationService.rejectApplication(app.id, 'Rejected by admin');
            Alert.alert('Success', 'Application rejected.');
            fetchApplications();
        } catch (error) {
            Alert.alert('Error', 'Failed to reject application.');
        }
    };

    const renderItem = ({ item }: { item: LoanApplication }) => (
        <View className="bg-white p-4 rounded-lg shadow mb-3">
            <Text className="font-bold text-lg">Applied: ₱{item.amountApplied}</Text>
            <Text className="text-gray-600 mb-2">Purpose: {item.purpose || 'N/A'}</Text>
            <View className="flex-row space-x-2">
                <Button title="Approve" onPress={() => handleApprove(item)} className="bg-green-600 flex-1" />
                <Button title="Reject" onPress={() => handleReject(item)} variant="outline" className="flex-1" />
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-100 p-4">
            <Text className="text-xl font-bold text-gray-800 mb-4">Loan Approvals</Text>
            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : applications.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-500">No pending applications to approve.</Text>
                </View>
            ) : (
                <FlatList
                    data={applications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
            )}
        </View>
    );
}
