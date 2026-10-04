import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AppUpdateModal } from '../AppUpdateModal';
import { AutoUpdateController } from '../AutoUpdateController';
import { type AppVersionManifest } from '../../services/AppUpdateService';
import { APP_DOWNLOAD_URL } from '../../constants/AppVersion';

describe('AppUpdateModal & AutoUpdateController Components', () => {
    const sampleManifest: AppVersionManifest = {
        latestVersion: '1.2.0',
        versionCode: 12,
        releaseTag: 'v1.2.0',
        releaseDate: '2026-09-11',
        minSupportedVersion: '0.1.0',
        apkUrl: 'https://jetfarm.pages.dev/download/v1.2.0.apk',
        apkSizeMb: 52.4,
        releaseNotes: '• Major update\n• Automatic in-app update installer',
    };

    it('returns null when manifest is not provided', () => {
        const { toJSON } = render(
            <AppUpdateModal
                visible={true}
                manifest={null}
                currentVersion="0.1.3"
                isForced={false}
                isDownloading={false}
                downloadProgress={0}
                downloadedBytes={0}
                totalExpectedBytes={0}
                errorMessage={null}
                onUpdatePress={jest.fn()}
                onDismissPress={jest.fn()}
            />
        );
        expect(toJSON()).toBeNull();
    });

    it('renders optional update modal with release notes and action buttons', () => {
        const onUpdateMock = jest.fn();
        const onDismissMock = jest.fn();

        const { getByText } = render(
            <AppUpdateModal
                visible={true}
                manifest={sampleManifest}
                currentVersion="0.1.3"
                isForced={false}
                isDownloading={false}
                downloadProgress={0}
                downloadedBytes={0}
                totalExpectedBytes={0}
                errorMessage={null}
                onUpdatePress={onUpdateMock}
                onDismissPress={onDismissMock}
            />
        );

        expect(getByText('New Update Available!')).toBeTruthy();
        expect(getByText(/Current: v0\.1\.3/)).toBeTruthy();
        expect(getByText(/New: v1\.2\.0/)).toBeTruthy();
        expect(getByText(/52\.4 MB/)).toBeTruthy();
        expect(getByText('⚡ Update & Install Now')).toBeTruthy();
        expect(getByText('Remind Me Later')).toBeTruthy();

        fireEvent.press(getByText('⚡ Update & Install Now'));
        expect(onUpdateMock).toHaveBeenCalled();

        fireEvent.press(getByText('Remind Me Later'));
        expect(onDismissMock).toHaveBeenCalled();
    });

    it('falls back to the resolved download URL when the manifest omits an APK link', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

        const manifestWithoutApkUrl: AppVersionManifest = { ...sampleManifest, apkUrl: undefined };

        const { getByText } = render(
            <AppUpdateModal
                visible={true}
                manifest={manifestWithoutApkUrl}
                currentVersion="0.1.3"
                isForced={false}
                isDownloading={false}
                downloadProgress={0}
                downloadedBytes={0}
                totalExpectedBytes={0}
                errorMessage={null}
                onUpdatePress={jest.fn()}
                onDismissPress={jest.fn()}
            />
        );

        fireEvent.press(getByText('🌐 Open Download Link in Browser'));
        await Promise.resolve();

        expect(openURL).toHaveBeenCalledWith(APP_DOWNLOAD_URL);
        expect(openURL.mock.calls[0][0]).not.toContain('jetfarm.pages.dev');

        openURL.mockRestore();
    });

    it('renders pre-fetched ready-to-install state with single click button', () => {
        const onUpdateMock = jest.fn();

        const { getByText } = render(
            <AppUpdateModal
                visible={true}
                manifest={sampleManifest}
                currentVersion="0.1.3"
                isForced={false}
                isDownloading={false}
                downloadProgress={100}
                downloadedBytes={52400000}
                totalExpectedBytes={52400000}
                errorMessage={null}
                downloadReady={true}
                onUpdatePress={onUpdateMock}
                onDismissPress={jest.fn()}
            />
        );

        expect(getByText('✅ Downloaded — ready to install')).toBeTruthy();
        expect(getByText('✅ Update Ready — Install Now')).toBeTruthy();

        fireEvent.press(getByText('✅ Update Ready — Install Now'));
        expect(onUpdateMock).toHaveBeenCalled();
    });

    it('renders mandatory update modal without remind me later option', () => {
        const { getByText, queryByText } = render(
            <AppUpdateModal
                visible={true}
                manifest={sampleManifest}
                currentVersion="0.1.0"
                isForced={true}
                isDownloading={false}
                downloadProgress={0}
                downloadedBytes={0}
                totalExpectedBytes={0}
                errorMessage={null}
                onUpdatePress={jest.fn()}
                onDismissPress={jest.fn()}
            />
        );

        expect(getByText('Mandatory Update Required')).toBeTruthy();
        expect(queryByText('Remind Me Later')).toBeNull();
    });

    it('renders AutoUpdateController without crash', () => {
        const { toJSON } = render(<AutoUpdateController />);
        // When on web or when no update is active, renders null
        expect(toJSON()).toBeNull();
    });
});
