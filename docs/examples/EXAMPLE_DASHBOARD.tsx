import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Custom Hooks
import { useBorrowers } from './src/hooks/useBorrowers';
import { useSync } from './src/hooks/useSync';
import { useAuthStore } from './src/stores/authStore';

// Components
import Borrower from './src/database/models/Borrower';
import { BorrowerFormWithCollector } from './src/components/BorrowerFormWithCollector';
import { OfflineBanner } from './src/components/OfflineBanner';
import { SyncStatusIndicator } from './src/components/SyncStatusIndicator';

/**
 * EXAMPLE: Enhanced Collector Dashboard with Offline-First System
 * 
 * Features:
 * - Display assigned borrowers (filtered by collector_id)
 * - Auto-sync on app resume
 * - Offline banner when disconnected
 * - Sync status indicator
 * - Create new borrower form
 * - Manual sync trigger
 * - Pending changes counter
 */
export default function EnhancedCollectorDashboard() {
    const { user } = useAuthStore();
    const { borrowers, loading, error, refetch } = useBorrowers();
    const { sync, isSyncing, isOnline, pendingChanges, syncProgress } = useSync();

    const [showNewBorrowerForm, setShowNewBorrowerForm] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Load assigned borrowers on mount
    useEffect(() => {
        if (!loading) {
            console.log(`[Dashboard] Loaded ${borrowers.length} borrowers for ${user?.id}`);
        }
    }, [loading, borrowers.length]);

    // Handle pull-to-refresh
    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refetch();
            // Optionally trigger sync
            await sync(false);
        } finally {
            setRefreshing(false);
        }
    };

    // Handle manual sync
    const handleManualSync = async () => {
        if (!isOnline) {
            console.log('[Dashboard] Cannot sync offline');
            return;
        }
        await sync(true);
    };

    // Handle new borrower creation
    const handleBorrowerCreated = (borrower: Borrower) => {
        console.log('[Dashboard] New borrower created:', borrower.id);
        setShowNewBorrowerForm(false);
        refetch();
    };

    // Render header with stats
    const renderHeader = () => (
        <View className="bg-white border-b border-gray-100 px-4 py-6">
            {/* Welcome Section */}
            <View className="mb-6">
                <Text className="text-3xl font-extrabold text-gray-900">
                    Collector Dashboard
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                    {user?.email || 'Collector'}
                </Text>
            </View>

            {/* Stats Cards */}
            <View className="flex-row gap-3">
                {/* Borrowers Card */}
                <LinearGradient
                    colors={['#1A237E', '#283593']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="flex-1 p-4 rounded-lg"
                >
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-white text-2xl font-extrabold">
                                {borrowers.length}
                            </Text>
                            <Text className="text-blue-100 text-xs mt-1">
                                Assigned Borrowers
                            </Text>
                        </View>
                        <MaterialIcons name="people" size={32} color="rgba(255,255,255,0.6)" />
                    </View>
                </LinearGradient>

                {/* Pending Card */}
                <LinearGradient
                    colors={['#FF6F00', '#F57C00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="flex-1 p-4 rounded-lg"
                >
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-white text-2xl font-extrabold">
                                {pendingChanges}
                            </Text>
                            <Text className="text-orange-100 text-xs mt-1">
                                Pending Sync
                            </Text>
                        </View>
                        <MaterialIcons name="sync" size={32} color="rgba(255,255,255,0.6)" />
                    </View>
                </LinearGradient>
            </View>
        </View>
    );

    // Render action buttons
    const renderActionBar = () => (
        <View className="bg-white border-b border-gray-100 px-4 py-4 flex-row gap-3">
            {/* New Borrower Button */}
            <Pressable
                onPress={() => setShowNewBorrowerForm(true)}
                className="flex-1 bg-blue-600 active:bg-blue-700 p-3 rounded-lg flex-row items-center justify-center gap-2"
            >
                <MaterialIcons name="person-add" size={20} color="white" />
                <Text className="text-white font-semibold">Add Borrower</Text>
            </Pressable>

            {/* Sync Button */}
            <Pressable
                onPress={handleManualSync}
                disabled={isSyncing || !isOnline}
                className={`flex-1 ${
                    isSyncing || !isOnline ? 'bg-gray-300' : 'bg-green-600 active:bg-green-700'
                } p-3 rounded-lg flex-row items-center justify-center gap-2`}
            >
                {isSyncing ? (
                    <ActivityIndicator size="small" color="white" />
                ) : (
                    <MaterialIcons name="sync" size={20} color="white" />
                )}
                <Text className="text-white font-semibold">
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
            </Pressable>
        </View>
    );

    // Render empty state
    const renderEmpty = () => (
        <View className="flex-1 justify-center items-center py-20 px-6">
            <MaterialIcons name="people-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-600 text-center mt-4 text-lg font-semibold">
                No Borrowers Yet
            </Text>
            <Text className="text-gray-500 text-center mt-2">
                {borrowers.length === 0 && !loading
                    ? 'Tap "Add Borrower" to create your first borrower'
                    : 'Loading borrowers...'}
            </Text>
        </View>
    );

    // Render borrower item
    const renderBorrowerItem = ({ item }: { item: Borrower }) => (
        <Pressable
            onPress={() => {
                // Navigate to borrower detail
                console.log('[Dashboard] Navigating to borrower:', item.id);
            }}
            className="bg-white border-b border-gray-100 px-4 py-4 flex-row items-center justify-between active:bg-gray-50"
        >
            <View className="flex-1">
                <Text className="font-semibold text-gray-900 text-base">
                    {item.fullName}
                </Text>
                <Text className="text-gray-600 text-xs mt-1">
                    {item.area || 'No area specified'}
                </Text>
                {item.phone && (
                    <Text className="text-gray-500 text-xs mt-1">
                        {item.phone.substring(0, 10)}... (masked)
                    </Text>
                )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
        </Pressable>
    );

    return (
        <>
            {/* Offline Banner */}
            {!isOnline && <OfflineBanner />}

            <SafeAreaView className="flex-1 bg-gray-50">
                {/* Header */}
                {renderHeader()}

                {/* Sync Status Indicator */}
                {isSyncing && (
                    <View className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                        <View className="flex-row items-center gap-2">
                            <ActivityIndicator size="small" color="#1A237E" />
                            <Text className="text-sm text-blue-900 font-medium">
                                {syncProgress.currentModel || 'Syncing...'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Action Bar */}
                {renderActionBar()}

                {/* Borrowers List */}
                <FlatList
                    data={borrowers}
                    renderItem={renderBorrowerItem}
                    keyExtractor={(item) => item.id}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#1A237E']}
                        />
                    }
                    contentContainerStyle={{ flexGrow: 1 }}
                />

                {/* New Borrower Form Modal */}
                {showNewBorrowerForm && (
                    <View className="absolute inset-0 bg-black/50 z-50 flex-1 justify-end">
                        <View className="bg-white rounded-t-3xl max-h-[90%]">
                            <View className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b border-gray-100">
                                <Text className="text-xl font-bold text-gray-900">
                                    Create New Borrower
                                </Text>
                                <Pressable
                                    onPress={() => setShowNewBorrowerForm(false)}
                                    className="bg-gray-100 p-2 rounded-full active:bg-gray-200"
                                >
                                    <MaterialIcons name="close" size={24} color="#4B5563" />
                                </Pressable>
                            </View>

                            <BorrowerFormWithCollector
                                onSuccess={handleBorrowerCreated}
                                onCancel={() => setShowNewBorrowerForm(false)}
                            />
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </>
    );
}

/**
 * KEY FEATURES DEMONSTRATED:
 * 
 * 1. useBorrowers() Hook
 *    - Automatically fetches borrowers for current collector
 *    - Updates when database changes
 *    - Shows loading state
 * 
 * 2. useSync() Hook
 *    - Tracks sync status and progress
 *    - Provides pendingChanges count
 *    - Detects network status
 * 
 * 3. Offline Banner
 *    - Shows when offline
 *    - Disappears when online
 * 
 * 4. Pull-to-Refresh
 *    - Refetches borrowers
 *    - Triggers sync
 * 
 * 5. New Borrower Form
 *    - Modal interface
 *    - Collector assignment included
 *    - Creates record offline-first
 * 
 * 6. Sync Status Display
 *    - Shows current operation
 *    - Displays pending changes
 *    - Manual sync trigger
 * 
 * OFFLINE-FIRST BEHAVIOR:
 * 
 * - Borrowers load from WatermelonDB (instant)
 * - New borrowers created to WatermelonDB first
 * - Sync happens in background
 * - UI updates immediately without network
 * - Auto-sync when reconnected
 */
