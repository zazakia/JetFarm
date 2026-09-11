import React from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { AuthGateLoading } from '../../src/components/AuthGateLoading';
import { ROLE_HOME_ROUTES, UserRole } from '../../src/constants/roles';

export default function ExecutiveLayout() {
    const { user, role, roleResolved, initialized } = useAuth();
    const router = useRouter();

    const allowedRoles = ['executive', 'admin', 'main_office'];
    const isAllowed = role ? allowedRoles.includes(role) : false;

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
        return <AuthGateLoading message="Verifying executive access..." />;
    }

    if (initialized && (!user || !isAllowed)) {
        return <AuthGateLoading message="Redirecting..." />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#581c87', // Purple 900
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerRight: () => (
                    <View style={{ marginRight: 15 }}>
                        <SyncStatusBadge />
                    </View>
                ),
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Crispy King Executive View', headerShown: true }} />
        </Stack>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../src/components/RouteErrorBoundary';
