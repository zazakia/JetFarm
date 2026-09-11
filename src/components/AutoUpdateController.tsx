import React from 'react';
import { Platform } from 'react-native';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { AppUpdateModal } from './AppUpdateModal';

function AutoUpdateControllerInner() {
    const {
        manifest,
        modalVisible,
        currentVersion,
        isForced,
        isDownloading,
        downloadProgress,
        downloadedBytes,
        totalExpectedBytes,
        errorMessage,
        downloadReady,
        startDownloadAndInstall,
        dismissModal,
    } = useAppUpdate(true);

    return (
        <AppUpdateModal
            visible={modalVisible}
            manifest={manifest}
            currentVersion={currentVersion}
            isForced={isForced}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            downloadedBytes={downloadedBytes}
            totalExpectedBytes={totalExpectedBytes}
            errorMessage={errorMessage}
            downloadReady={downloadReady}
            onUpdatePress={startDownloadAndInstall}
            onDismissPress={() => dismissModal(true)}
        />
    );
}

export function AutoUpdateController() {
    if (Platform.OS === 'web') {
        return null;
    }
    return <AutoUpdateControllerInner />;
}
