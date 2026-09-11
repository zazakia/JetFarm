import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { clearPersistedAuthSession, supabase } from '../../database/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockReplace = jest.fn();
let mockCapturedAuthCb: any = null;

jest.mock('expo-router', () => ({
    usePathname: jest.fn().mockReturnValue('/'),
    useRouter: jest.fn(),
    useSegments: jest.fn().mockReturnValue([]),
}));

jest.mock('../../services/AuthService', () => ({
    AuthService: {
        getCurrentUserRole: jest.fn(),
        resolveCollectorId: jest.fn(),
    },
}));

jest.mock('../../services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('../../database/supabase', () => ({
    supabase: {
        auth: {
            onAuthStateChange: jest.fn((cb) => {
                mockCapturedAuthCb = cb;
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            }),
            getSession: jest.fn(),
            refreshSession: jest.fn(),
            signOut: jest.fn(),
        },
    },
    clearPersistedAuthSession: jest.fn().mockResolvedValue(undefined),
    withTimeout: jest.fn((promise) => promise),
}));

const TestComponent = () => {
    const auth = useAuth();

    if (!auth.initialized) {
        return <Text>Loading...</Text>;
    }

    return <Text>{auth.user ? `User: ${auth.user.id}` : 'No User'}</Text>;
};

describe('AuthContext refresh token recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCapturedAuthCb = null;
        (usePathname as jest.Mock).mockReturnValue('/');
        (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
        (useSegments as jest.Mock).mockReturnValue([]);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('false');
        (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
        (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: {
                message: 'Invalid Refresh Token: Refresh Token Not Found',
                status: 400,
                code: 'refresh_token_not_found',
                name: 'AuthApiError',
            },
        });
    });

    it('purges persisted auth state when the refresh token is invalid', async () => {
        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('No User')).toBeTruthy();
        });

        expect(mockCapturedAuthCb).toBeTruthy();
        expect(clearPersistedAuthSession).toHaveBeenCalledTimes(1);
    });
});
