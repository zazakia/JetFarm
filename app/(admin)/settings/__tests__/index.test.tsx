import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import SettingsScreen from '../index';
import { BackupService } from '../../../../src/services/BackupService';
import { SupabaseBackupService } from '../../../../src/services/SupabaseBackupService';
import { SyncService } from '../../../../src/services/SyncService';
import { database } from '../../../../src/database';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('../../../../src/database', () => ({
    database: {
        write: jest.fn(),
        unsafeResetDatabase: jest.fn(),
    },
}));
jest.mock('../../../../src/services/BackupService', () => ({
    BackupService: {
        exportBackup: jest.fn(),
        importBackup: jest.fn(),
    },
}));
jest.mock('../../../../src/services/SupabaseBackupService', () => ({
    SupabaseBackupService: {
        exportBackup: jest.fn(),
        importBackup: jest.fn(),
    },
}));
jest.mock('../../../../src/services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn(),
        updatePendingCount: jest.fn().mockResolvedValue(0),
    },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
}));

jest.mock('../../../../src/store/AuthContext', () => ({
    SKIP_NEXT_AUTO_SYNC_KEY: 'skip_next_auto_sync_once',
    useAuth: () => ({
        user: { email: 'admin@test.com' },
        signOut: jest.fn(),
    }),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: mockBack,
    }),
}));

jest.mock('react-native-toast-message', () => ({
    show: jest.fn(),
}));

describe('SettingsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (database.write as jest.Mock).mockImplementation(async (fn: () => Promise<void>) => fn());
        (database.unsafeResetDatabase as jest.Mock).mockResolvedValue(undefined);
        (SupabaseBackupService.exportBackup as jest.Mock).mockResolvedValue({ success: true, message: 'Done' });
        (SupabaseBackupService.importBackup as jest.Mock).mockResolvedValue({ success: true, message: 'Done' });
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('renders user email and admin badge', () => {
        render(<SettingsScreen />);
        expect(screen.getByText('admin@test.com')).toBeTruthy();
        expect(screen.getByText(/Admin Access/i)).toBeTruthy();
    });

    it('renders all main sections', () => {
        render(<SettingsScreen />);
        expect(screen.getByText(/Synchronization/i)).toBeTruthy();
        expect(screen.getByText(/Data Management/i)).toBeTruthy();
        expect(screen.getByText(/System/i)).toBeTruthy();
    });

    it('calls forced SyncService.checkAndSync when Sync Now is pressed', async () => {
        (SyncService.checkAndSync as jest.Mock).mockResolvedValue(undefined);
        render(<SettingsScreen />);
        
        const syncBtn = screen.getByText(/Sync Now/i);
        fireEvent.press(syncBtn);
        
        await waitFor(() => {
            expect(SyncService.checkAndSync).toHaveBeenCalledWith({ force: true });
        });
    });

    it('calls BackupService.exportBackup when Manual Backup is pressed', async () => {
        (BackupService.exportBackup as jest.Mock).mockResolvedValue({ success: true, message: 'Done' });
        render(<SettingsScreen />);
        
        const backupBtn = screen.getByText(/Manual Backup/i);
        fireEvent.press(backupBtn);
        
        await waitFor(() => {
            expect(BackupService.exportBackup).toHaveBeenCalled();
        });
    });

    it('opens restore modal on web when Restore from File is pressed', async () => {
        Platform.OS = 'web';
        render(<SettingsScreen />);
        
        const restoreBtn = screen.getByText(/Restore from File/i);
        fireEvent.press(restoreBtn);
        
        expect(screen.getByText(/Merge Data Safely/i)).toBeTruthy();
        expect(screen.getAllByText(/Wipe & Restore/i).length).toBeGreaterThan(0);
    });

    it('navigates to correctly when system items are pressed', () => {
        render(<SettingsScreen />);
        
        fireEvent.press(screen.getByText('Expense Categories'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/expense-categories');

        fireEvent.press(screen.getByText('Updates & Changes'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/updates');

        fireEvent.press(screen.getByText('Monthly Financial Closing'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/closing');

        fireEvent.press(screen.getByText('Audit Trail'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/audit-trail');

        // deleted with the lending domain: collection sheets / borrower groups
        expect(screen.queryByText(/Collection Groups|Borrowers|Loans/i)).toBeNull();
    });

    it('shows alert confirmation for Clear Local Database', async () => {
        Platform.OS = 'ios';
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<SettingsScreen />);
        
        fireEvent.press(screen.getByText('Clear Local Database'));
        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                "Wipe Local Data",
                expect.stringContaining("This will clear the local WatermelonDB"),
                expect.any(Array)
            );
        });
    });

    it('sets the one-shot sync skip flag before clearing the local database', async () => {
        Platform.OS = 'ios';
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<SettingsScreen />);

        fireEvent.press(screen.getByText('Clear Local Database'));

        let alertCall;
        await waitFor(() => {
            alertCall = alertSpy.mock.calls.find(([title]) => title === 'Wipe Local Data');
            expect(alertCall).toBeDefined();
        });

        const buttons = alertCall?.[2] as { text?: string; onPress?: () => void | Promise<void> }[];
        const wipeButton = buttons.find(button => button.text === 'Wipe Now');

        await wipeButton?.onPress?.();

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('skip_next_auto_sync_once', 'true');
        expect(database.write).toHaveBeenCalled();
        expect(database.unsafeResetDatabase).toHaveBeenCalled();
    });

    it('blocks database reset if there are unsynced changes', async () => {
        Platform.OS = 'ios';
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SyncService.updatePendingCount as jest.Mock).mockResolvedValueOnce(3);

        render(<SettingsScreen />);
        fireEvent.press(screen.getByText('Clear Local Database'));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                "Sync Required",
                expect.stringContaining("Wipe Blocked: You have 3 unsynced change(s)"),
                expect.any(Array)
            );
        });
        expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
    });
});
