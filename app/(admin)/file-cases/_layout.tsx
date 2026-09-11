import { Stack } from 'expo-router';
export default function FileCasesLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}

export { RouteErrorBoundary as ErrorBoundary } from '../../../src/components/RouteErrorBoundary';
