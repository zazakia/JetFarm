import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/store/AuthContext';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { AuthGateLoading } from '../../src/components/AuthGateLoading';
import { ROLE_HOME_ROUTES, UserRole } from '../../src/constants/roles';

export default function CashierLayout() {
    const { user, role, roleResolved, initialized } = useAuth();
    const router = useRouter();

    const allowedRoles = ['branch_cashier', 'branch_manager', 'admin', 'main_office', 'executive'];
    const isAllowed = role ? allowedRoles.includes(role) : false;
    const isAdmin = role === 'admin' || role === 'main_office' || role === 'executive';

    React.useEffect(() => {
        if (!initialized || !roleResolved) return;

        if (!user || role === null) {
            router.replace('/login');
            return;
        }

        if (!isAllowed) {
            const homeRoute = ROLE_HOME_ROUTES[role as UserRole] ?? '/login';
            router.replace(homeRoute as any);
        }
    }, [initialized, user, role, roleResolved, router, isAllowed]);

    if (initialized && user && !roleResolved) {
        return <AuthGateLoading message="Verifying cashier access..." />;
    }

    if (initialized && (!user || !isAllowed)) {
        return <AuthGateLoading message="Redirecting..." />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#047857', // Emerald 700
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerLeft: () => (
                    <Pressable
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else if (isAdmin) {
                                router.replace('/(admin)' as any);
                            }
                        }}
                        style={{ marginRight: 12, padding: 4 }}
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color="#ffffff" />
                    </Pressable>
                ),
                headerRight: () => (
                    <View style={{ marginRight: 15, flexDirection: 'row', alignItems: 'center' }}>
                        {isAdmin && (
                            <Pressable
                                onPress={() => router.replace('/(admin)' as any)}
                                style={{ marginRight: 10, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 }}
                            >
                                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>Admin Portal</Text>
                            </Pressable>
                        )}
                        <SyncStatusBadge />
                    </View>
                ),
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Crispy King POS Counter', headerShown: true }} />
            <Stack.Screen name="pos" options={{ title: 'Touch POS Terminal', headerShown: true }} />
            <Stack.Screen name="shift-open" options={{ title: 'Open Register Float', headerShown: true }} />
            <Stack.Screen name="shift-close" options={{ title: 'End Shift / Z-Reading', headerShown: true }} />
            <Stack.Screen name="cash-drop" options={{ title: 'Safe Cash Drop', headerShown: true }} />
            <Stack.Screen name="returns" options={{ title: 'Sales Return & Refund', headerShown: true }} />
        </Stack>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../src/components/RouteErrorBoundary';
