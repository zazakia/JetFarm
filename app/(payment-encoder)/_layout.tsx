import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { AuthGateLoading } from '../../src/components/AuthGateLoading';
import { ROLE_HOME_ROUTES, UserRole } from '../../src/constants/roles';
import { useRolePermissions } from '../../src/hooks/useSettingsConfig';

export default function PaymentEncoderLayout() {
    const { user, role, roleResolved, initialized } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const routeAllowed = isAllowed('route.(payment-encoder)');
    const router = useRouter();

    React.useEffect(() => {
        if (!initialized || !roleResolved) return;

        if (!user || role === null) {
            console.warn('[PaymentEncoderLayout] Missing authorized user role. Redirecting to login...');
            router.replace('/login');
            return;
        }

        if ((role !== 'payment_encoder' && role !== 'collector') || !routeAllowed) {
            console.warn(`[PaymentEncoderLayout] Access denied for role: ${role}. Redirecting...`);
            router.replace((routeAllowed ? (ROLE_HOME_ROUTES[role as UserRole] ?? '/login') : '/login') as any);
        }
    }, [initialized, user, role, roleResolved, router, routeAllowed]);

    // Route guard for Payment Encoder
    if (initialized && user && !roleResolved) {
        return <AuthGateLoading message="Restoring your access..." />;
    }

    if (initialized && (!user || (role !== 'payment_encoder' && role !== 'collector') || !routeAllowed)) {
        console.warn(`[PaymentEncoderLayout] Access denied for role: ${role}. Redirecting...`);
        return <AuthGateLoading message="Redirecting..." />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#E65100', // Orange for Payment Encoder
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Payment Encoder' }} />
        </Stack>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../src/components/RouteErrorBoundary';
