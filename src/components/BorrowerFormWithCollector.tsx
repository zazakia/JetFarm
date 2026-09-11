import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../database';
import Borrower from '../database/models/Borrower';
import { CollectorSelector } from './CollectorSelector';
import { useAuthStore } from '../stores/authStore';
import { assignCollectorToBorrower, updateBorrowerOffline, createBorrowerOffline } from '../utils/offlineUtils';
import UserProfile from '../database/models/UserProfile';
import { EncryptionService } from '../services/EncryptionService';

interface BorrowerFormProps {
    borrowerId?: string;
    onSuccess?: (borrower: Borrower) => void;
    onCancel?: () => void;
}

/**
 * Enhanced Borrower Form with Collector Assignment
 *
 * Features:
 * - Display existing borrower data
 * - Show assigned collector below gender field
 * - Modal to select collector
 * - Offline-first form submission
 * - Real-time validation
 */
export const BorrowerFormWithCollector: React.FC<BorrowerFormProps> = ({
    borrowerId,
    onSuccess,
    onCancel,
}) => {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(!!borrowerId);
    const [saving, setSaving] = useState(false);
    const [showCollectorModal, setShowCollectorModal] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        address: '',
        gender: '',
        area: '',
        dateOfBirth: '',
    });

    const [collectorAssignment, setCollectorAssignment] = useState<{
        collectorId: string;
        collectorName: string;
    } | null>(null);

    // Load existing borrower data if editing
    useEffect(() => {
        if (borrowerId) {
            loadBorrower();
        }
    }, [borrowerId]);

    const loadBorrower = async () => {
        try {
            setLoading(true);
            const borrower = await database.collections
                .get<Borrower>('borrowers')
                .find(borrowerId!);

            setFormData({
                fullName: borrower.fullName,
                phone: EncryptionService.decrypt(borrower.phone) || '',
                address: EncryptionService.decrypt(borrower.address) || '',
                gender: borrower.gender || '',
                area: borrower.area || '',
                dateOfBirth: borrower.dateOfBirth
                    ? new Date(borrower.dateOfBirth).toISOString().split('T')[0]
                    : '',
            });

            // Load assigned collector
            if (borrower.collectorId) {
                try {
                    const collector = await database.collections
                        .get<UserProfile>('user_profiles')
                        .find(borrower.collectorId);
                    setCollectorAssignment({
                        collectorId: collector.id,
                        collectorName: collector.fullName,
                    });
                } catch (err) {
                    console.warn('Could not load collector:', err);
                }
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to load borrower data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCollector = (collectorId: string, collectorName: string) => {
        setCollectorAssignment({
            collectorId,
            collectorName,
        });
        setShowCollectorModal(false);
    };

    const handleSave = async () => {
        try {
            // Validation
            if (!formData.fullName.trim()) {
                Alert.alert('Validation Error', 'Please enter borrower name');
                return;
            }

            if (!formData.phone.trim()) {
                Alert.alert('Validation Error', 'Please enter phone number');
                return;
            }

            if (!collectorAssignment) {
                Alert.alert('Validation Error', 'Please select a collector');
                return;
            }

            setSaving(true);

            if (borrowerId) {
                // Update existing borrower
                await updateBorrowerOffline(borrowerId, {
                    fullName: formData.fullName,
                    phone: formData.phone,
                    address: formData.address,
                    gender: formData.gender,
                    area: formData.area,
                    collectorId: collectorAssignment.collectorId,
                    dateOfBirth: formData.dateOfBirth
                        ? new Date(formData.dateOfBirth).getTime()
                        : 0,
                });

                Alert.alert('Success', 'Borrower updated successfully');

                // Reload borrower to get updated instance
                if (onSuccess) {
                    const updated = await database.collections
                        .get<Borrower>('borrowers')
                        .find(borrowerId);
                    onSuccess(updated);
                }
            } else {
                // Create new borrower
                if (!user) {
                    Alert.alert('Error', 'User not authenticated');
                    return;
                }

                const borrower = await createBorrowerOffline({
                    fullName: formData.fullName,
                    phone: formData.phone,
                    address: formData.address,
                    gender: formData.gender,
                    area: formData.area,
                    collectorId: collectorAssignment.collectorId,
                    dateOfBirth: formData.dateOfBirth
                        ? new Date(formData.dateOfBirth).getTime()
                        : 0,
                    createdBy: user.id,
                });

                Alert.alert('Success', 'Borrower created successfully');

                if (onSuccess) {
                    onSuccess(borrower);
                }
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed to save borrower');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <ScrollView  className="flex-1 bg-gray-50"  contentContainerStyle={{ padding: 16 }}>
            {/* Full Name */}
            <View className="mb-4">
                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">
                    Full Name *
                </Text>
                <TextInput
                    className="bg-white p-3 rounded-lg border border-gray-200 text-gray-900"
                    placeholder="Enter borrower name"
                    placeholderTextColor="#9CA3AF"
                    value={formData.fullName}
                    onChangeText={(text) =>
                        setFormData({ ...formData, fullName: text })
                    }
                    editable={!saving}
                />
            </View>

            {/* Phone */}
            <View className="mb-4">
                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">
                    Phone Number *
                </Text>
                <TextInput
                    className="bg-white p-3 rounded-lg border border-gray-200 text-gray-900"
                    placeholder="Enter phone number"
                    placeholderTextColor="#9CA3AF"
                    value={formData.phone}
                    onChangeText={(text) =>
                        setFormData({ ...formData, phone: text })
                    }
                    keyboardType="phone-pad"
                    editable={!saving}
                />
            </View>

            {/* Address */}
            <View className="mb-4">
                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">
                    Address
                </Text>
                <TextInput
                    className="bg-white p-3 rounded-lg border border-gray-200 text-gray-900 h-24"
                    placeholder="Enter address"
                    placeholderTextColor="#9CA3AF"
                    value={formData.address}
                    onChangeText={(text) =>
                        setFormData({ ...formData, address: text })
                    }
                    multiline
                    editable={!saving}
                />
            </View>

            {/* Gender */}
            <View className="mb-4">
                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">
                    Gender
                </Text>
                <View className="flex-row gap-4">
                    {['Male', 'Female', 'Other'].map((g) => (
                        <Pressable
                            key={g}
                            onPress={() =>
                                setFormData({ ...formData, gender: g })
                            }
                            disabled={saving}
                            className={`flex-1 p-3 rounded-lg border-2 ${
                                formData.gender === g
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-200 bg-white'
                            }`}
                        >
                            <Text
                                className={
                                    formData.gender === g
                                        ? 'text-center font-semibold text-blue-600'
                                        : 'text-center text-gray-700'
                                }
                            >
                                {g}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Assigned Collector - NEW FIELD */}
            <View className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">
                    Assigned Collector *
                </Text>
                <Pressable
                    onPress={() => setShowCollectorModal(true)}
                    disabled={saving}
                    className="bg-white p-3 rounded-lg border border-gray-200 flex-row items-center justify-between"
                >
                    <View>
                        <Text
                            className={`text-base ${
                                collectorAssignment
                                    ? 'text-gray-900 font-semibold'
                                    : 'text-gray-700'
                            }`}
                        >
                            {collectorAssignment?.collectorName ??
                                'Select a collector'}
                        </Text>
                        {collectorAssignment && (
                            <Text className="text-xs text-gray-700 mt-1">
                                ID: {collectorAssignment.collectorId}
                            </Text>
                        )}
                    </View>
                    <MaterialIcons
                        name="edit"
                        size={20}
                        color="#1E3A8A"
                    />
                </Pressable>
                <Text className="text-xs text-gray-700 mt-2">
                    This collector will have access to this borrower's records
                </Text>
            </View>

            {/* Area */}
            <View className="mb-4">
                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">
                    Area / Route
                </Text>
                <TextInput
                    className="bg-white p-3 rounded-lg border border-gray-200 text-gray-900"
                    placeholder="e.g., Downtown, Route A"
                    placeholderTextColor="#9CA3AF"
                    value={formData.area}
                    onChangeText={(text) =>
                        setFormData({ ...formData, area: text })
                    }
                    editable={!saving}
                />
            </View>

            {/* Date of Birth */}
            <View className="mb-6">
                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">
                    Date of Birth
                </Text>
                <TextInput
                    className="bg-white p-3 rounded-lg border border-gray-200 text-gray-900"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    value={formData.dateOfBirth}
                    onChangeText={(text) =>
                        setFormData({ ...formData, dateOfBirth: text })
                    }
                    editable={!saving}
                />
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
                <Pressable
                    onPress={onCancel || (() => {})}
                    disabled={saving}
                    className="flex-1 bg-gray-200 p-4 rounded-lg active:bg-gray-300"
                >
                    <Text className="text-center font-semibold text-gray-700">
                        Cancel
                    </Text>
                </Pressable>
                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className={`flex-1 ${
                        saving ? 'bg-blue-300' : 'bg-blue-600 active:bg-blue-700'
                    } p-4 rounded-lg flex-row items-center justify-center`}
                >
                    {saving && (
                        <ActivityIndicator
                            size="small"
                            color="white"
                            style={{ marginRight: 8 }}
                        />
                    )}
                    <Text className="text-center font-semibold text-white">
                        {saving ? 'Saving...' : borrowerId ? 'Update' : 'Create'}
                    </Text>
                </Pressable>
            </View>

            {/* Collector Selection Modal */}
            <CollectorSelector
                visible={showCollectorModal}
                selectedCollectorId={collectorAssignment?.collectorId}
                onSelect={handleSelectCollector}
                onClose={() => setShowCollectorModal(false)}
            />
        </ScrollView>
    );
};
