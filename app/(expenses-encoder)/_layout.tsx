import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { AuthGateLoading } from '../../src/components/AuthGateLoading';
import { ROLE_HOME_ROUTES, UserRole } from '../../src/constants/roles';
import { useRolePermissions } from '../../src/hooks/useSettingsConfig';

export default function ExpensesEncoderLayout() {
    const { user, role, roleResolved, initialized } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const routeAllowed = isAllowed('route.(expenses-encoder)');
    const router = useRouter();

    React.useEffect(() => {
        if (!initialized || !roleResolved) return;

        if (!user || role === null) {
            console.warn('[ExpensesEncoderLayout] Missing authorized user role. Redirecting to login...');
            router.replace('/login');
            return;
        }

        if (role !== 'expenses_encoder' || !routeAllowed) {
            console.warn(`[ExpensesEncoderLayout] Access denied for role: ${role}. Redirecting...`);
            router.replace((routeAllowed ? (ROLE_HOME_ROUTES[role as UserRole] ?? '/login') : '/login') as any);
        }
    }, [initialized, user, role, roleResolved, router, routeAllowed]);

    // Route guard for Expenses Encoder
    if (initialized && user && !roleResolved) {
        return <AuthGateLoading message="Restoring your access..." />;
    }

    if (initialized && (!user || role !== 'expenses_encoder' || !routeAllowed)) {
        console.warn(`[ExpensesEncoderLayout] Access denied for role: ${role}. Redirecting...`);
        return <AuthGateLoading message="Redirecting..." />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#7B1FA2', // Purple for Expenses Encoder
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Expenses Encoder' }} />
        </Stack>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../src/components/RouteErrorBoundary';
