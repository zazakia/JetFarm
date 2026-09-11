import React from 'react';
import { render, screen } from '@testing-library/react-native';
import UpdatesScreen from '../updates';
import { GENERATED_APP_UPDATES } from '../../../../src/constants/generatedAppUpdates';

describe('UpdatesScreen', () => {
    it('renders the commit-history header', () => {
        render(<UpdatesScreen />);

        expect(screen.getByText('What Changed')).toBeTruthy();
        expect(screen.getByText(/Full app change history generated from repository commits/i)).toBeTruthy();
    });

    it('shows commit-derived summaries and touched files', () => {
        render(<UpdatesScreen />);

        const latestUpdate = GENERATED_APP_UPDATES[0];
        const latestTouchedFile = latestUpdate.codeChanges[0];

        expect(screen.getAllByText(latestUpdate.title).length).toBeGreaterThan(0);
        expect(screen.getAllByText(latestUpdate.summary).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Change Summary').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Files Touched').length).toBeGreaterThan(0);
        expect(screen.getAllByText(latestTouchedFile).length).toBeGreaterThan(0);
    });
});
