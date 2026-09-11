import React from 'react';
import { render } from '@testing-library/react-native';
import { OfflineBanner } from '../OfflineBanner';
import { useSyncStore } from '../../stores/syncStore';

// Mocks
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../stores/syncStore', () => ({
    useSyncStore: jest.fn(),
}));

describe('OfflineBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when device is online and has never been offline', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: true,
        });

        const { toJSON } = render(<OfflineBanner />);
        expect(toJSON()).toBeNull();
    });

    it('renders warning banner when device is offline', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: false,
        });

        const { getByText } = render(<OfflineBanner />);
        expect(getByText("You're offline — changes will sync when reconnected")).toBeTruthy();
    });

    it('renders reconnecting message when device is back online after being offline', () => {
        // Set first render to offline (sets wasOffline.current = true)
        (useSyncStore as unknown as jest.Mock).mockReturnValueOnce({
            isOnline: false,
        });

        const { rerender, getByText } = render(<OfflineBanner />);
        expect(getByText("You're offline — changes will sync when reconnected")).toBeTruthy();

        // Change store mock to online
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: true,
        });

        rerender(<OfflineBanner />);
        expect(getByText('Back online — syncing your changes...')).toBeTruthy();
    });
});
