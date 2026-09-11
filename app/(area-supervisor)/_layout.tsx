import React from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { AuthGateLoading } from '../../src/components/AuthGateLoading';
import { ROLE_HOME_ROUTES, UserRole } from '../../src/constants/roles';

export default function AreaSupervisorLayout() {
    const { user, role, roleResolved, initialized } = useAuth();
    const router = useRouter();

    const allowedRoles = ['area_supervisor', 'admin', 'main_office', 'executive'];
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
        return <AuthGateLoading message="Verifying supervisor access..." />;
    }

    if (initialized && (!user || !isAllowed)) {
        return <AuthGateLoading message="Redirecting..." />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#92400e', // Amber 800
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
            <Stack.Screen name="index" options={{ title: 'Area Supervisor Hub', headerShown: true }} />
        </Stack>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../src/components/RouteErrorBoundary';
