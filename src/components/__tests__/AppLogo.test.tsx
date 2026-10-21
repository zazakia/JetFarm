import React from 'react';
import { render } from '@testing-library/react-native';
import { AppLogo } from '../AppLogo';
import { getAppVersion } from '../../constants/AppVersion';

describe('AppLogo Component', () => {
    it('renders the Agri-One name and version badge by default', () => {
        const { getByText, getByTestId, queryByText } = render(<AppLogo />);
        expect(getByText('Agri-One')).toBeTruthy();
        expect(queryByText('JetFarm')).toBeNull();
        expect(getByTestId('app-logo-version-badge')).toBeTruthy();
        expect(getByText(`v${getAppVersion()}`)).toBeTruthy();
    });

    it('can hide version badge when showVersion is false', () => {
        const { getByText, queryByTestId } = render(<AppLogo showVersion={false} />);
        expect(getByText('Agri-One')).toBeTruthy();
        expect(queryByTestId('app-logo-version-badge')).toBeNull();
    });

    it('renders subtitle when provided', () => {
        const { getByText } = render(<AppLogo subtitle="Agri Operations" />);
        expect(getByText('Agri Operations')).toBeTruthy();
    });
});
