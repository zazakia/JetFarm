import { Stack } from 'expo-router';

export default function FranchiseLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="audits" />
        </Stack>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../../src/components/RouteErrorBoundary';
